"""
Modular AI Image Provider Architecture for TR STUDIO Step 3 — Character Creation Studio.
Provides:
- Abstract `AIImageProvider` with all 7 required character generation interfaces:
  1. `generate_character_concept`
  2. `generate_character_portrait`
  3. `generate_full_body_character`
  4. `generate_character_turnaround_sheet`
  5. `generate_expressions`
  6. `generate_pose_variations`
  7. `generate_outfit_variations`
- Concrete `GeminiImageProvider` (Google Imagen / Gemini Image Generation REST API)
- Concrete `OpenAIImageProvider` (OpenAI / OpenAI-compatible Images API)
- Strict validation of returned image binary bytes, rate-limit (429) & timeout (504) handling,
  and honest missing-credentials behavior (`ImageAIConfigurationException` 503).
"""

import abc
import base64
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx
from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import (
    AppException,
    ImageAIConfigurationException,
    ImageProviderException,
)
from app.core.logging import logger
from app.schemas.character import CHARACTER_VISUAL_STYLES, ImageProviderStatusResponse
from app.services.storage_service import (
    ValidatedImageInfo,
    validate_and_inspect_image_bytes,
)


@dataclass
class ReferenceImageInput:
    asset_id: str
    mime_type: str
    image_bytes: bytes


@dataclass
class GeneratedImageArtifact:
    image_bytes: bytes
    image_info: ValidatedImageInfo
    prompt: str
    provider: str
    model: str
    view_type: str = "concept"
    used_reference_asset_ids: List[str] = field(default_factory=list)
    provider_metadata: Dict[str, Any] = field(default_factory=dict)


class AIImageProvider(abc.ABC):
    """Abstract interface for AI Character Image Generation providers."""

    provider_name: str = "abstract"
    model_name: str = "abstract"

    @property
    def supported_styles(self) -> List[str]:
        return list(CHARACTER_VISUAL_STYLES)

    @property
    def unsupported_styles(self) -> List[str]:
        return []

    @property
    def supports_reference_images(self) -> bool:
        return False

    @property
    def supports_combined_sheet(self) -> bool:
        return True

    def ensure_style_supported(self, style: str) -> None:
        normalized = style.strip()
        if normalized in self.unsupported_styles:
            raise AppException(
                detail=(
                    f"Visual style '{normalized}' is not supported by the active image provider "
                    f"({self.provider_name}/{self.model_name}). Supported styles: "
                    f"{', '.join(self.supported_styles)}"
                ),
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_code="UNSUPPORTED_CHARACTER_STYLE",
            )

    @abc.abstractmethod
    def _generate_raw_image(
        self,
        prompt: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
        aspect_ratio: str = "1:1",
    ) -> bytes:
        """Execute provider HTTP call and return raw binary image bytes (PNG/JPEG/WebP)."""

    def _generate_and_validate(
        self,
        prompt: str,
        view_type: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
        aspect_ratio: str = "1:1",
    ) -> GeneratedImageArtifact:
        self.ensure_style_supported(style)
        raw_bytes = self._generate_raw_image(
            prompt=prompt,
            reference_images=reference_images,
            aspect_ratio=aspect_ratio,
        )
        try:
            info = validate_and_inspect_image_bytes(raw_bytes)
        except AppException as exc:
            raise ImageProviderException(
                detail=f"AI image provider returned an invalid image payload: {exc.detail}",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="INVALID_PROVIDER_IMAGE",
            ) from exc

        used_refs = (
            [r.asset_id for r in (reference_images or [])]
            if self.supports_reference_images and reference_images
            else []
        )
        return GeneratedImageArtifact(
            image_bytes=raw_bytes,
            image_info=info,
            prompt=prompt,
            provider=self.provider_name,
            model=self.model_name,
            view_type=view_type,
            used_reference_asset_ids=used_refs,
            provider_metadata={
                "style": style,
                "aspect_ratio": aspect_ratio,
                "supports_reference_images": self.supports_reference_images,
                "used_reference_images_count": len(used_refs),
            },
        )

    # ------------------------------------------------------------------
    # 7 Required Character Generation Capabilities
    # ------------------------------------------------------------------

    def generate_character_concept(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="concept",
            style=style,
            reference_images=reference_images,
            aspect_ratio="1:1",
        )

    def generate_character_portrait(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="portrait",
            style=style,
            reference_images=reference_images,
            aspect_ratio="1:1",
        )

    def generate_full_body_character(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="full_body",
            style=style,
            reference_images=reference_images,
            aspect_ratio="3:4",
        )

    def generate_character_turnaround_sheet(
        self,
        prompts_by_view: Dict[str, str],
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> List[GeneratedImageArtifact]:
        artifacts: List[GeneratedImageArtifact] = []
        for view_key, view_prompt in prompts_by_view.items():
            artifact = self._generate_and_validate(
                prompt=view_prompt,
                view_type=view_key,
                style=style,
                reference_images=reference_images,
                aspect_ratio="16:9" if view_key == "turnaround_sheet" else "3:4",
            )
            artifacts.append(artifact)
        return artifacts

    def generate_expressions(
        self,
        prompt: str,
        expression_name: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"expression:{expression_name}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="1:1",
        )

    def generate_pose_variations(
        self,
        prompt: str,
        pose_name: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"pose:{pose_name}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="3:4",
        )

    def generate_outfit_variations(
        self,
        prompt: str,
        outfit_name: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"outfit:{outfit_name}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="3:4",
        )

    # ------------------------------------------------------------------
    # 9 Required Environment Generation Capabilities (Step 4)
    # ------------------------------------------------------------------

    def generate_environment_concept(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="concept",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_landscape_background(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="landscape",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_interior_background(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="interior",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_exterior_background(
        self,
        prompt: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type="exterior",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_environment_variation(
        self,
        prompt: str,
        variation_name: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"variation:{variation_name}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_lighting_variation(
        self,
        prompt: str,
        lighting_name: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"lighting_variation:{lighting_name}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_weather_variation(
        self,
        prompt: str,
        weather_name: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"weather_variation:{weather_name}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_camera_view(
        self,
        prompt: str,
        camera_perspective: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"camera_view:{camera_perspective}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="16:9",
        )

    def generate_environment_detail(
        self,
        prompt: str,
        detail_focus: str,
        style: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
    ) -> GeneratedImageArtifact:
        return self._generate_and_validate(
            prompt=prompt,
            view_type=f"environment_detail:{detail_focus}",
            style=style,
            reference_images=reference_images,
            aspect_ratio="1:1",
        )


class GeminiImageProvider(AIImageProvider):
    """
    Google Gemini / Imagen REST API provider.
    - When `model_name` starts with `imagen`, calls `:predict` endpoint.
    - When `model_name` is a Gemini multimodal image model (`gemini-*`), calls `:generateContent`
      with `responseModalities: ["TEXT", "IMAGE"]` and passes inline reference images if provided.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "imagen-3.0-generate-002",
        base_url: Optional[str] = None,
        timeout_seconds: float = 90.0,
    ) -> None:
        self.provider_name = "gemini"
        self.api_key = api_key
        self.model_name = model_name
        self.base_url = (
            base_url.rstrip("/")
            if base_url
            else "https://generativelanguage.googleapis.com/v1beta"
        )
        self.timeout_seconds = timeout_seconds

    @property
    def supports_reference_images(self) -> bool:
        return self.model_name.lower().startswith("gemini-")

    def _generate_raw_image(
        self,
        prompt: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
        aspect_ratio: str = "1:1",
    ) -> bytes:
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                if self.model_name.lower().startswith("gemini-"):
                    url = f"{self.base_url}/models/{self.model_name}:generateContent"
                    parts: List[Dict[str, Any]] = [{"text": prompt}]
                    if reference_images:
                        for ref in reference_images[:3]:
                            parts.append(
                                {
                                    "inlineData": {
                                        "mimeType": ref.mime_type,
                                        "data": base64.b64encode(ref.image_bytes).decode("ascii"),
                                    }
                                }
                            )
                    payload = {
                        "contents": [{"role": "user", "parts": parts}],
                        "generationConfig": {
                            "responseModalities": ["TEXT", "IMAGE"],
                        },
                    }
                    res = client.post(url, params={"key": self.api_key}, json=payload)
                else:
                    url = f"{self.base_url}/models/{self.model_name}:predict"
                    payload = {
                        "instances": [{"prompt": prompt}],
                        "parameters": {
                            "sampleCount": 1,
                            "aspectRatio": aspect_ratio if aspect_ratio in ("1:1", "3:4", "4:3", "16:9", "9:16") else "1:1",
                            "outputOptions": {"mimeType": "image/png"},
                        },
                    }
                    res = client.post(url, params={"key": self.api_key}, json=payload)
        except httpx.TimeoutException as exc:
            logger.error("GeminiImageProvider timed out: %s", exc)
            raise ImageProviderException(
                detail="AI image provider request timed out. Please try again.",
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                error_code="IMAGE_PROVIDER_TIMEOUT",
            ) from exc
        except httpx.RequestError as exc:
            logger.error("GeminiImageProvider network error: %s", exc)
            raise ImageProviderException(
                detail="Could not reach the configured AI image provider.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_NETWORK_ERROR",
            ) from exc

        if res.status_code == 429:
            raise ImageProviderException(
                detail="AI image provider rate limit exceeded. Please wait before generating again.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                error_code="IMAGE_PROVIDER_RATE_LIMITED",
            )
        if res.status_code >= 400:
            raise ImageProviderException(
                detail=f"AI image provider error (HTTP {res.status_code}). Verify IMAGE_API_KEY and IMAGE_MODEL.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_ERROR",
            )

        data = res.json()
        # Extract base64 image from either Imagen `predictions` or Gemini `candidates`
        b64_str: Optional[str] = None
        predictions = data.get("predictions")
        if isinstance(predictions, list) and predictions:
            b64_str = predictions[0].get("bytesBase64Encoded")

        if not b64_str:
            candidates = data.get("candidates")
            if isinstance(candidates, list) and candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    inline = part.get("inlineData") or part.get("inline_data")
                    if isinstance(inline, dict) and inline.get("data"):
                        b64_str = inline["data"]
                        break

        if not b64_str:
            raise ImageProviderException(
                detail="AI image provider response did not contain encoded image data.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_EMPTY_RESPONSE",
            )

        try:
            return base64.b64decode(b64_str)
        except Exception as exc:
            raise ImageProviderException(
                detail="AI image provider returned corrupted base64 image data.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_DECODE_ERROR",
            ) from exc


class OpenAIImageProvider(AIImageProvider):
    """
    OpenAI / OpenAI-compatible Images API provider (`/v1/images/generations`).
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "dall-e-3",
        base_url: Optional[str] = None,
        timeout_seconds: float = 90.0,
    ) -> None:
        self.provider_name = "openai"
        self.api_key = api_key
        self.model_name = model_name
        self.base_url = (
            base_url.rstrip("/") if base_url else "https://api.openai.com/v1"
        )
        self.timeout_seconds = timeout_seconds

    @property
    def supports_reference_images(self) -> bool:
        return False

    def _generate_raw_image(
        self,
        prompt: str,
        reference_images: Optional[List[ReferenceImageInput]] = None,
        aspect_ratio: str = "1:1",
    ) -> bytes:
        url = f"{self.base_url}/images/generations"
        payload: Dict[str, Any] = {
            "model": self.model_name,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
            "response_format": "b64_json",
        }
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                res = client.post(
                    url,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise ImageProviderException(
                detail="OpenAI image provider timed out.",
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                error_code="IMAGE_PROVIDER_TIMEOUT",
            ) from exc
        except httpx.RequestError as exc:
            raise ImageProviderException(
                detail="Could not reach OpenAI image provider.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_NETWORK_ERROR",
            ) from exc

        if res.status_code == 429:
            raise ImageProviderException(
                detail="OpenAI image provider rate limit exceeded.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                error_code="IMAGE_PROVIDER_RATE_LIMITED",
            )
        if res.status_code >= 400:
            raise ImageProviderException(
                detail=f"OpenAI image provider returned HTTP {res.status_code}.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_ERROR",
            )

        body = res.json()
        items = body.get("data")
        if not isinstance(items, list) or not items or not items[0].get("b64_json"):
            raise ImageProviderException(
                detail="OpenAI image provider response did not include b64_json data.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_EMPTY_RESPONSE",
            )
        try:
            return base64.b64decode(items[0]["b64_json"])
        except Exception as exc:
            raise ImageProviderException(
                detail="Failed to decode base64 image from OpenAI provider.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="IMAGE_PROVIDER_DECODE_ERROR",
            ) from exc


def get_image_provider_status() -> ImageProviderStatusResponse:
    settings = get_settings()
    provider_key = (settings.IMAGE_PROVIDER or "gemini").strip().lower()
    model_name = settings.IMAGE_MODEL or "imagen-3.0-generate-002"
    configured = settings.is_image_ai_configured
    supports_ref = provider_key == "gemini" and model_name.lower().startswith("gemini-")

    consistency_disclaimer = (
        "Visual consistency across generated images uses the canonical Character Bible prompt "
        + (
            "and passes selected reference images to the multimodal Gemini image model."
            if supports_ref
            else "(note: the active text-to-image model generates from the canonical Character Bible description without direct pixel reference conditioning)."
        )
    )

    if configured:
        message = (
            f"AI Character Image Engine is active ({provider_key} / {model_name})."
        )
    else:
        message = (
            "AI character image generation is not configured (IMAGE_API_KEY is not set in backend .env). "
            "Manual character creation, Character Bible editing, expressions, poses, outfits, and "
            "reference image uploads are fully available."
        )

    return ImageProviderStatusResponse(
        configured=configured,
        provider=provider_key,
        model=model_name,
        supported_styles=list(CHARACTER_VISUAL_STYLES),
        unsupported_styles=[],
        supports_reference_images=supports_ref,
        supports_combined_sheet=True,
        supports_separate_views=True,
        consistency_disclaimer=consistency_disclaimer,
        message=message,
    )


def get_ai_image_provider() -> AIImageProvider:
    settings = get_settings()
    if not settings.is_image_ai_configured or not settings.IMAGE_API_KEY:
        raise ImageAIConfigurationException()

    provider_key = (settings.IMAGE_PROVIDER or "gemini").strip().lower()
    api_key = settings.IMAGE_API_KEY.strip()
    model = (settings.IMAGE_MODEL or "imagen-3.0-generate-002").strip()

    if provider_key == "gemini":
        return GeminiImageProvider(
            api_key=api_key,
            model_name=model,
            base_url=settings.IMAGE_BASE_URL,
            timeout_seconds=settings.IMAGE_TIMEOUT_SECONDS,
        )
    if provider_key in ("openai", "openai_compatible"):
        return OpenAIImageProvider(
            api_key=api_key,
            model_name=model,
            base_url=settings.IMAGE_BASE_URL,
            timeout_seconds=settings.IMAGE_TIMEOUT_SECONDS,
        )

    raise ImageAIConfigurationException(
        detail=f"Unsupported IMAGE_PROVIDER '{provider_key}'. Supported values: 'gemini', 'openai', 'openai_compatible'."
    )
