"""
Secure Character Asset Storage & Binary Image Validation Service for TR STUDIO Step 3.
Responsibilities:
- Binary magic-byte inspection & header dimension parsing for PNG, JPEG, and WebP
  (never trusting user-supplied filenames or Content-Type headers alone).
- Enforcing file size limits and dimension bounds.
- Abstracting local development storage (`LocalSignedStorageBackend`) and future S3-compatible
  object storage (`S3CompatibleStorageBackend`) without exposing local filesystem paths.
- Generating and verifying HMAC-SHA256 signed URLs for private character media.
"""

import abc
import hashlib
import hmac
import os
import struct
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import AppException, NotFoundException


@dataclass
class ValidatedImageInfo:
    mime_type: str
    extension: str
    width: int
    height: int
    size_bytes: int
    sha256: str


MIN_IMAGE_DIMENSION = 16
MAX_IMAGE_DIMENSION = 8192


def _parse_png_dimensions(data: bytes) -> Tuple[int, int]:
    # PNG signature (8 bytes) + IHDR length (4 bytes) + 'IHDR' (4 bytes) + width (4) + height (4)
    if len(data) < 24 or data[12:16] != b"IHDR":
        raise AppException(
            detail="Invalid or corrupted PNG header.",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_IMAGE_FILE",
        )
    width, height = struct.unpack(">II", data[16:24])
    return int(width), int(height)


def _parse_jpeg_dimensions(data: bytes) -> Tuple[int, int]:
    # Scan JPEG markers starting after SOI (\xff\xd8)
    idx = 2
    size = len(data)
    sof_markers = {
        0xC0,
        0xC1,
        0xC2,
        0xC3,
        0xC5,
        0xC6,
        0xC7,
        0xC9,
        0xCA,
        0xCB,
        0xCD,
        0xCE,
        0xCF,
    }
    while idx < size - 1:
        if data[idx] != 0xFF:
            idx += 1
            continue
        # Skip fill bytes 0xFF
        while idx < size and data[idx] == 0xFF:
            idx += 1
        if idx >= size:
            break
        marker = data[idx]
        idx += 1
        if marker in (0xD8, 0xD9) or (0xD0 <= marker <= 0xD7):
            continue
        if idx + 2 > size:
            break
        seg_len = struct.unpack(">H", data[idx : idx + 2])[0]
        if seg_len < 2 or idx + seg_len > size:
            break
        if marker in sof_markers:
            if idx + 7 > size:
                break
            height, width = struct.unpack(">HH", data[idx + 3 : idx + 7])
            return int(width), int(height)
        idx += seg_len
    raise AppException(
        detail="Invalid or corrupted JPEG file: could not read image dimensions.",
        status_code=status.HTTP_400_BAD_REQUEST,
        error_code="INVALID_IMAGE_FILE",
    )


def _parse_webp_dimensions(data: bytes) -> Tuple[int, int]:
    if len(data) < 30:
        raise AppException(
            detail="Invalid or truncated WebP image.",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_IMAGE_FILE",
        )
    chunk_type = data[12:16]
    if chunk_type == b"VP8 ":
        # Lossy WebP: frame header starts at 20; 3-byte start code 0x9d 0x01 0x2a at 23..26
        if data[23:26] != b"\x9d\x01\x2a":
            raise AppException(
                detail="Invalid VP8 WebP frame header.",
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="INVALID_IMAGE_FILE",
            )
        w, h = struct.unpack("<HH", data[26:30])
        return int(w & 0x3FFF), int(h & 0x3FFF)
    if chunk_type == b"VP8L":
        # Lossless WebP: signature 0x2f at byte 20, then 4 bytes packing 14-bit width-1 & height-1
        if data[20] != 0x2F:
            raise AppException(
                detail="Invalid VP8L WebP header.",
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="INVALID_IMAGE_FILE",
            )
        b0, b1, b2, b3 = data[21:25]
        width = 1 + (((b1 & 0x3F) << 8) | b0)
        height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
        return int(width), int(height)
    if chunk_type == b"VP8X":
        # Extended WebP: 24-bit width-1 at 24..27, 24-bit height-1 at 27..30
        w_minus_1 = int.from_bytes(data[24:27], "little")
        h_minus_1 = int.from_bytes(data[27:30], "little")
        return w_minus_1 + 1, h_minus_1 + 1
    raise AppException(
        detail="Unsupported WebP chunk format.",
        status_code=status.HTTP_400_BAD_REQUEST,
        error_code="INVALID_IMAGE_FILE",
    )


def validate_and_inspect_image_bytes(
    data: bytes,
    max_size_bytes: Optional[int] = None,
) -> ValidatedImageInfo:
    """
    Validate binary image content using magic bytes and header dimensions.
    Never trusts filename extensions or Content-Type headers alone.
    """
    settings = get_settings()
    limit_bytes = max_size_bytes or (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024)

    if not data:
        raise AppException(
            detail="Uploaded image file is empty.",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="EMPTY_IMAGE_FILE",
        )

    if len(data) > limit_bytes:
        raise AppException(
            detail=f"Image file exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            error_code="IMAGE_FILE_TOO_LARGE",
        )

    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime_type = "image/png"
        extension = "png"
        width, height = _parse_png_dimensions(data)
    elif data.startswith(b"\xff\xd8\xff"):
        mime_type = "image/jpeg"
        extension = "jpg"
        width, height = _parse_jpeg_dimensions(data)
    elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime_type = "image/webp"
        extension = "webp"
        width, height = _parse_webp_dimensions(data)
    else:
        raise AppException(
            detail="Unsupported or invalid image format. Only valid PNG, JPEG, and WebP images are accepted.",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="UNSUPPORTED_IMAGE_FORMAT",
        )

    if (
        width < MIN_IMAGE_DIMENSION
        or height < MIN_IMAGE_DIMENSION
        or width > MAX_IMAGE_DIMENSION
        or height > MAX_IMAGE_DIMENSION
    ):
        raise AppException(
            detail=(
                f"Image dimensions ({width}x{height}) are out of bounds. "
                f"Supported range is {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION} to "
                f"{MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION} pixels."
            ),
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_IMAGE_DIMENSIONS",
        )

    digest = hashlib.sha256(data).hexdigest()
    return ValidatedImageInfo(
        mime_type=mime_type,
        extension=extension,
        width=width,
        height=height,
        size_bytes=len(data),
        sha256=digest,
    )


class MediaStorageBackend(abc.ABC):
    """Abstract interface for character media storage."""

    @abc.abstractmethod
    def save_asset_bytes(
        self,
        character_id: uuid.UUID,
        asset_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        """Persist bytes and return logical `file_reference` (never a raw OS path)."""

    @abc.abstractmethod
    def read_asset_bytes(self, file_reference: str) -> bytes:
        """Read bytes for a logical `file_reference`."""

    @abc.abstractmethod
    def delete_asset(self, file_reference: str) -> None:
        """Delete stored bytes for a logical `file_reference` if present."""

    @abc.abstractmethod
    def build_signed_media_url(
        self,
        asset_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        """Return a time-limited signed URL for accessing the private asset."""

    @abc.abstractmethod
    def save_environment_asset_bytes(
        self,
        environment_id: uuid.UUID,
        asset_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        """Persist environment asset bytes and return logical `file_reference`."""

    @abc.abstractmethod
    def build_signed_environment_media_url(
        self,
        asset_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        """Return a time-limited signed URL for accessing the private environment asset."""

    @abc.abstractmethod
    def save_audio_asset_bytes(
        self,
        project_id: uuid.UUID,
        asset_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        """Persist audio asset bytes and return logical `file_reference`."""

    @abc.abstractmethod
    def build_signed_audio_media_url(
        self,
        asset_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        """Return a time-limited signed URL for accessing the audio asset."""

    @abc.abstractmethod
    def save_render_output_bytes(
        self,
        project_id: uuid.UUID,
        output_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        """Persist rendered video bytes and return logical `file_reference`."""

    @abc.abstractmethod
    def build_signed_render_media_url(
        self,
        output_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        """Return a time-limited signed URL for accessing the rendered video."""


class LocalSignedStorageBackend(MediaStorageBackend):
    """
    Stores character assets inside an internal storage directory and serves them
    only via HMAC-SHA256 signed URLs (`/api/v1/character-assets/{asset_id}/media`).
    Never exposes local filesystem paths publicly.
    """

    def __init__(self, base_dir: str) -> None:
        self.base_path = Path(base_dir).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, file_reference: str) -> Path:
        cleaned = file_reference.lstrip("/").replace("..", "")
        target = (self.base_path / cleaned).resolve()
        if not str(target).startswith(str(self.base_path)):
            raise AppException(
                detail="Invalid storage file reference.",
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="INVALID_STORAGE_REFERENCE",
            )
        return target

    def save_asset_bytes(
        self,
        character_id: uuid.UUID,
        asset_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        safe_ext = extension.lower().strip(".")
        file_reference = f"characters/{character_id}/{asset_id}.{safe_ext}"
        target_path = self._resolve_safe_path(file_reference)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            target_path.write_bytes(data)
        except OSError as exc:
            raise AppException(
                detail="Failed to write character asset to secure storage.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="STORAGE_WRITE_FAILED",
            ) from exc
        return file_reference

    def read_asset_bytes(self, file_reference: str) -> bytes:
        target_path = self._resolve_safe_path(file_reference)
        if not target_path.is_file():
            raise NotFoundException("Stored character image file was not found.")
        try:
            return target_path.read_bytes()
        except OSError as exc:
            raise AppException(
                detail="Failed to read character asset from storage.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="STORAGE_READ_FAILED",
            ) from exc

    def delete_asset(self, file_reference: str) -> None:
        try:
            target_path = self._resolve_safe_path(file_reference)
            if target_path.is_file():
                target_path.unlink()
        except Exception:
            pass

    def build_signed_media_url(
        self,
        asset_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        settings = get_settings()
        expires = int(time.time()) + int(settings.SIGNED_URL_EXPIRE_SECONDS)
        sig = compute_media_signature(asset_id=asset_id, expires=expires)
        dl_Flag = "&download=1" if download else ""
        return f"/api/v1/character-assets/{asset_id}/media?expires={expires}&sig={sig}{dl_Flag}"

    def save_environment_asset_bytes(
        self,
        environment_id: uuid.UUID,
        asset_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        safe_ext = extension.lower().strip(".")
        file_reference = f"environments/{environment_id}/{asset_id}.{safe_ext}"
        target_path = self._resolve_safe_path(file_reference)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            target_path.write_bytes(data)
        except OSError as exc:
            raise AppException(
                detail="Failed to write environment asset to secure storage.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="STORAGE_WRITE_FAILED",
            ) from exc
        return file_reference

    def build_signed_environment_media_url(
        self,
        asset_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        settings = get_settings()
        expires = int(time.time()) + int(settings.SIGNED_URL_EXPIRE_SECONDS)
        sig = compute_media_signature(asset_id=asset_id, expires=expires)
        dl_flag = "&download=1" if download else ""
        return f"/api/v1/environment-assets/{asset_id}/media?expires={expires}&sig={sig}{dl_flag}"

    def save_audio_asset_bytes(
        self,
        project_id: uuid.UUID,
        asset_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        safe_ext = extension.lower().strip(".")
        file_reference = f"audio/{project_id}/{asset_id}.{safe_ext}"
        target_path = self._resolve_safe_path(file_reference)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            target_path.write_bytes(data)
        except OSError as exc:
            raise AppException(
                detail="Failed to write audio asset to secure storage.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="STORAGE_WRITE_FAILED",
            ) from exc
        return file_reference

    def build_signed_audio_media_url(
        self,
        asset_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        settings = get_settings()
        expires = int(time.time()) + int(settings.SIGNED_URL_EXPIRE_SECONDS)
        sig = compute_media_signature(asset_id=asset_id, expires=expires)
        dl_flag = "&download=1" if download else ""
        return f"/api/v1/audio-assets/{asset_id}/media?expires={expires}&sig={sig}{dl_flag}"

    def save_render_output_bytes(
        self,
        project_id: uuid.UUID,
        output_id: uuid.UUID,
        extension: str,
        data: bytes,
    ) -> str:
        safe_ext = extension.lower().strip(".")
        file_reference = f"exports/{project_id}/{output_id}.{safe_ext}"
        target_path = self._resolve_safe_path(file_reference)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            target_path.write_bytes(data)
        except OSError as exc:
            raise AppException(
                detail="Failed to write rendered video to secure storage.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="STORAGE_WRITE_FAILED",
            ) from exc
        return file_reference

    def build_signed_render_media_url(
        self,
        output_id: uuid.UUID,
        download: bool = False,
    ) -> str:
        settings = get_settings()
        expires = int(time.time()) + int(settings.SIGNED_URL_EXPIRE_SECONDS)
        sig = compute_media_signature(asset_id=output_id, expires=expires)
        dl_flag = "&download=1" if download else ""
        return f"/api/v1/exports/{output_id}/media?expires={expires}&sig={sig}{dl_flag}"

    def resolve_safe_path(self, file_reference: str) -> Path:
        return self._resolve_safe_path(file_reference)


class S3CompatibleStorageBackend(LocalSignedStorageBackend):
    """
    Prepared S3-compatible storage adapter. Uses the same logical `file_reference`
    (`characters/{character_id}/{asset_id}.{ext}`) and signed URL verification contract.
    """


def compute_media_signature(asset_id: uuid.UUID, expires: int) -> str:
    settings = get_settings()
    msg = f"{asset_id}:{expires}".encode("utf-8")
    key = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_media_signature(asset_id: uuid.UUID, expires: int, sig: str) -> bool:
    if expires < int(time.time()):
        return False
    expected = compute_media_signature(asset_id=asset_id, expires=expires)
    return hmac.compare_digest(expected, sig or "")


def get_storage_backend() -> MediaStorageBackend:
    settings = get_settings()
    if settings.STORAGE_BACKEND.lower() == "s3" and settings.S3_BUCKET:
        return S3CompatibleStorageBackend(settings.STORAGE_LOCAL_DIR)
    return LocalSignedStorageBackend(settings.STORAGE_LOCAL_DIR)
