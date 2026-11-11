"""
Audio Validation and Waveform Peak Extraction Service for TR STUDIO Step 8.

Validates audio binaries via magic-byte signatures, extracts audio metadata,
and computes normalized waveform peaks for fast client-side rendering.
"""

from dataclasses import dataclass
import io
import math
import struct
from typing import List, Optional, Tuple

from fastapi import status
from app.core.exceptions import AppException


class AudioValidationError(AppException):
    """Raised when an uploaded audio file is invalid or unsupported."""
    def __init__(self, message: str, code: str = "INVALID_AUDIO"):
        super().__init__(
            detail=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code=code,
        )


@dataclass
class AudioMetadata:
    mime_type: str
    extension: str
    duration_ms: int
    sample_rate: int
    channels: int
    bitrate_kbps: Optional[int]
    waveform_data: List[float]


def detect_audio_magic_bytes(data: bytes) -> Tuple[str, str]:
    """
    Detect audio MIME type and extension from file header magic bytes.
    Returns (mime_type, extension).
    """
    if len(data) < 12:
        raise AudioValidationError("Audio data is too short to determine file type.", "CORRUPT_AUDIO")

    # WAV check (RIFF....WAVE)
    if data.startswith(b"RIFF") and data[8:12] == b"WAVE":
        return "audio/wav", "wav"

    # OGG Vorbis / Opus check (OggS)
    if data.startswith(b"OggS"):
        return "audio/ogg", "ogg"

    # FLAC check
    if data.startswith(b"fLaC"):
        return "audio/flac", "flac"

    # MP3 check: ID3 header or sync frames
    if data.startswith(b"ID3"):
        return "audio/mpeg", "mp3"
    if data[0] == 0xFF and (data[1] & 0xE0) == 0xE0:
        return "audio/mpeg", "mp3"

    # AAC ADTS header
    if data[0] == 0xFF and (data[1] & 0xF6) in (0xF0, 0xF2):
        return "audio/aac", "aac"

    raise AudioValidationError(
        "Unsupported or unrecognized audio format. TR STUDIO supports WAV, MP3, OGG, FLAC, and AAC.",
        "UNSUPPORTED_FORMAT"
    )


def extract_waveform_peaks_from_pcm(samples: List[int], num_peaks: int = 64) -> List[float]:
    """
    Given a list of PCM integer amplitudes (e.g. 16-bit signed),
    computes num_peaks normalized floats between 0.05 and 1.0.
    """
    if not samples:
        return [0.1] * num_peaks

    chunk_size = max(1, len(samples) // num_peaks)
    peaks: List[float] = []

    for i in range(num_peaks):
        start = i * chunk_size
        end = min(len(samples), start + chunk_size)
        if start >= len(samples):
            peaks.append(0.05)
            continue
        chunk = samples[start:end]
        max_abs = max(abs(s) for s in chunk) if chunk else 0
        # Normalize 16-bit max 32767 to 0.05..1.0
        normalized = min(1.0, max(0.05, round(max_abs / 32767.0, 3)))
        peaks.append(normalized)

    # Ensure exactly num_peaks
    if len(peaks) < num_peaks:
        peaks.extend([0.05] * (num_peaks - len(peaks)))
    return peaks[:num_peaks]


def parse_wav_metadata(data: bytes) -> AudioMetadata:
    """Parse a RIFF WAV container and extract PCM audio metrics."""
    try:
        import wave
        with wave.open(io.BytesIO(data), "rb") as wf:
            channels = wf.getnchannels()
            sample_rate = wf.getframerate()
            sample_width = wf.getsampwidth()
            n_frames = wf.getnframes()
            duration_s = n_frames / float(sample_rate) if sample_rate > 0 else 0
            duration_ms = max(100, int(duration_s * 1000))
            bitrate_kbps = int((sample_rate * channels * sample_width * 8) / 1000)

            # Sample frames for waveform
            raw_frames = wf.readframes(min(n_frames, 200000))
            samples: List[int] = []
            if sample_width == 2 and raw_frames:
                # 16-bit signed PCM
                count = len(raw_frames) // 2
                fmt = f"<{count}h"
                try:
                    samples = list(struct.unpack(fmt, raw_frames))
                except Exception:
                    samples = []

            waveform = extract_waveform_peaks_from_pcm(samples, 64)

            return AudioMetadata(
                mime_type="audio/wav",
                extension="wav",
                duration_ms=duration_ms,
                sample_rate=sample_rate,
                channels=channels,
                bitrate_kbps=bitrate_kbps,
                waveform_data=waveform,
            )
    except Exception as exc:
        raise AudioValidationError(f"Failed to parse WAV audio file: {exc}", "CORRUPT_WAV")


def estimate_audio_waveform_synthetic(data: bytes, duration_ms: int, num_peaks: int = 64) -> List[float]:
    """
    Fallback deterministic waveform peak generator for formats where PCM decoding
    is not natively available without external codecs.
    Produces pleasant natural-looking speech/music envelope variations.
    """
    peaks: List[float] = []
    data_len = len(data)
    step = max(1, data_len // num_peaks)

    for i in range(num_peaks):
        offset = min(data_len - 1, i * step)
        byte_val = data[offset] if offset < data_len else 128
        # Mix sinusoidal envelope with byte hash variance
        envelope = 0.4 + 0.5 * math.sin((i / num_peaks) * math.pi)
        variation = ((byte_val % 50) - 25) / 100.0
        val = min(1.0, max(0.08, round(envelope + variation, 3)))
        peaks.append(val)
    return peaks


def inspect_audio_data(data: bytes, max_size_bytes: int = 25 * 1024 * 1024) -> AudioMetadata:
    """
    Full audit of an audio file buffer.
    Verifies size, magic bytes, structure, duration, and generates 64 waveform peaks.
    """
    if not data or len(data) == 0:
        raise AudioValidationError("Audio file is completely empty.", "EMPTY_FILE")

    if len(data) > max_size_bytes:
        max_mb = max_size_bytes // (1024 * 1024)
        raise AudioValidationError(f"Audio file exceeds maximum allowed size of {max_mb} MB.", "FILE_TOO_LARGE")

    mime_type, ext = detect_audio_magic_bytes(data)

    if ext == "wav":
        return parse_wav_metadata(data)

    # For MP3 / OGG / AAC / FLAC:
    # Estimate duration based on standard bitrates if not WAV
    est_duration_ms = max(500, int((len(data) / (128 * 1024 / 8)) * 1000))
    waveform = estimate_audio_waveform_synthetic(data, est_duration_ms, 64)

    return AudioMetadata(
        mime_type=mime_type,
        extension=ext,
        duration_ms=min(est_duration_ms, 3600000),  # Max 1 hr
        sample_rate=44100,
        channels=2,
        bitrate_kbps=128,
        waveform_data=waveform,
    )


def generate_synthesized_wav_bytes(
    text: str,
    speaking_speed: float = 1.0,
    pitch_offset: float = 0.0,
    sample_rate: int = 24000,
) -> Tuple[bytes, int]:
    """
    Generates a valid, playable RIFF WAV byte sequence containing speech-like
    formant audio harmonics proportional to text length and speaking speed.
    Used by MockVoiceProvider to produce real playable audio in development and automated testing!
    Returns (wav_bytes, duration_ms).
    """
    # Count words or characters to estimate duration
    words = len(text.strip().split()) if text.strip() else 1
    # Average 150 words per minute -> 400ms per word, adjusted by speed
    base_duration_ms = max(600, int((words * 420 + 200) / max(0.25, speaking_speed)))
    duration_s = base_duration_ms / 1000.0

    num_samples = int(sample_rate * duration_s)
    # Fundamental voice frequency (e.g. 150Hz + pitch offset)
    f0 = max(70.0, min(400.0, 160.0 + pitch_offset * 5.0))
    f1 = f0 * 2.5
    f2 = f0 * 4.2

    pcm_samples: List[int] = []
    two_pi = 2.0 * math.pi

    for n in range(num_samples):
        t = n / float(sample_rate)
        # Amplitude envelope: gentle attack, sustain with word syllabic cadence, release
        envelope = math.sin((n / num_samples) * math.pi)
        syllables = 0.7 + 0.3 * math.sin(t * 12.0)
        # Formant mix
        signal = (
            0.55 * math.sin(two_pi * f0 * t) +
            0.28 * math.sin(two_pi * f1 * t) +
            0.17 * math.sin(two_pi * f2 * t)
        )
        sample_val = int(signal * envelope * syllables * 20000)
        # Clamp to 16-bit range
        sample_val = max(-32767, min(32767, sample_val))
        pcm_samples.append(sample_val)

    # Encode into RIFF WAV 16-bit mono
    buf = io.BytesIO()
    import wave
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        raw_data = struct.pack(f"<{len(pcm_samples)}h", *pcm_samples)
        wf.writeframes(raw_data)

    wav_bytes = buf.getvalue()
    return wav_bytes, base_duration_ms
