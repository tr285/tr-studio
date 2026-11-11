"""
Modular AI Voice & Speech Provider Architecture for TR STUDIO Step 8.

Supports:
- MockVoiceProvider: Generates real, synthesized PCM RIFF WAV audio bytes with
  accurate timing and waveform envelopes for development and automated testing.
- GoogleVoiceProvider: Google Cloud Text-to-Speech / Gemini Voice synthesis.
- ElevenLabsVoiceProvider: ElevenLabs low-latency emotional voice synthesis.

Follows strict honest error reporting:
- Missing API keys return HTTP 503 (VOICE_AI_NOT_CONFIGURED).
- Rate limits return HTTP 429.
- Timeouts return HTTP 504.
- Never creates fake audio or claims success when an API call fails.
"""

import abc
import base64
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from fastapi import status

from app.core.config import get_settings
from app.core.exceptions import VoiceAIConfigurationException, VoiceProviderException
from app.core.logging import logger
from app.schemas.audio import VoiceOption
from app.services.audio_validator import (
    AudioMetadata,
    generate_synthesized_wav_bytes,
    inspect_audio_data,
)


@dataclass
class GeneratedAudioResult:
    audio_bytes: bytes
    mime_type: str
    extension: str
    duration_ms: int
    sample_rate: int
    channels: int
    bitrate_kbps: Optional[int]
    waveform_data: List[float]


# Standard catalog of high quality voice presets available in TR STUDIO
BUILTIN_ANIME_VOICES: List[VoiceOption] = [
    VoiceOption(
        voice_id="tr-hero-male-1",
        provider="mock",
        name="Ren (Shonen Protagonist)",
        gender="male",
        accent="Japanese / Neutral English",
        age="teen",
        description="Determined, vibrant, energetic young anime hero.",
        sample_text="I will never give up, no matter what stands in our way!",
        traits=["energetic", "determined", "clear"],
    ),
    VoiceOption(
        voice_id="tr-heroine-female-1",
        provider="mock",
        name="Aoi (Heroine)",
        gender="female",
        accent="Neutral",
        age="teen",
        description="Gentle, bright, expressive young anime heroine with emotional depth.",
        sample_text="The stars are so bright tonight. Let's make sure tomorrow is peaceful.",
        traits=["bright", "gentle", "expressive"],
    ),
    VoiceOption(
        voice_id="tr-mentor-wise-1",
        provider="mock",
        name="Master Tenzin (Wise Mentor)",
        gender="male",
        accent="Deep",
        age="senior",
        description="Deep, calm, measured cadence of an experienced martial artist or ancient master.",
        sample_text="True power is not in the destruction of your foe, but in mastering yourself.",
        traits=["deep", "authoritative", "calm"],
    ),
    VoiceOption(
        voice_id="tr-villain-dark-1",
        provider="mock",
        name="Kaelen (Dark Antagonist)",
        gender="male",
        accent="Crisp",
        age="adult",
        description="Cold, calculating, sharp theatrical cadence suitable for formidable adversaries.",
        sample_text="You thought you were a hero? You were merely opening the gate for us.",
        traits=["dark", "theatrical", "menacing"],
    ),
    VoiceOption(
        voice_id="tr-rival-fiery-1",
        provider="mock",
        name="Shin (Fiery Rival)",
        gender="male",
        accent="Punchy",
        age="teen",
        description="Fierce, competitive, fast-paced dialogue delivery.",
        sample_text="Don't think you can outrun me that easily! Face me head on!",
        traits=["fast", "competitive", "bold"],
    ),
    VoiceOption(
        voice_id="tr-companion-cute-1",
        provider="mock",
        name="Pico (Mascot Companion)",
        gender="non-binary",
        accent="Melodic",
        age="young",
        description="High-pitched, playful, cheerful magical creature or mascot companion.",
        sample_text="Wahoo! We did it! Look at that shiny treasure over there!",
        traits=["playful", "high-pitched", "cheerful"],
    ),
    VoiceOption(
        voice_id="tr-narrator-cinematic-1",
        provider="mock",
        name="Cinematic Narrator",
        gender="male",
        accent="Cinematic Neutral",
        age="adult",
        description="Resonant, dramatic, epic documentary-style voiceover narration.",
        sample_text="In the era before the realm shattered, legends walked among mortals.",
        traits=["epic", "dramatic", "resonant"],
    ),
    VoiceOption(
        voice_id="tr-narrator-calm-1",
        provider="mock",
        name="Storybook Narrator (Calm)",
        gender="female",
        accent="Soft Neutral",
        age="adult",
        description="Intimate, warm, comforting bedtime storybook narration.",
        sample_text="Once upon a time in a quiet forest bathed in golden light...",
        traits=["warm", "comforting", "intimate"],
    ),
]


class VoiceProvider(abc.ABC):
    """Abstract base class for all speech & voice synthesis providers."""

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. google, elevenlabs, mock)."""
        pass

    @abc.abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the provider has necessary credentials and configuration."""
        pass

    @abc.abstractmethod
    async def list_supported_voices(self) -> List[VoiceOption]:
        """Returns the list of voices available under this provider."""
        pass

    @abc.abstractmethod
    async def generate_speech(
        self,
        text: str,
        voice_id: str,
        speaking_speed: float = 1.0,
        pitch: float = 0.0,
        voice_style: Optional[str] = None,
        stability: Optional[float] = None,
        similarity_boost: Optional[float] = None,
    ) -> GeneratedAudioResult:
        """Synthesizes text into audio binary bytes with metadata."""
        pass


class MockVoiceProvider(VoiceProvider):
    """
    Mock Voice Provider for development, continuous integration, and offline testing.
    Synthesizes genuine playable 16-bit PCM RIFF WAV audio bytes with dynamic
    duration proportional to text length and speaking speed, and extracts authentic
    64-point waveform peak data.
    """

    @property
    def provider_name(self) -> str:
        return "mock"

    def is_configured(self) -> bool:
        return True

    async def list_supported_voices(self) -> List[VoiceOption]:
        return BUILTIN_ANIME_VOICES

    async def generate_speech(
        self,
        text: str,
        voice_id: str,
        speaking_speed: float = 1.0,
        pitch: float = 0.0,
        voice_style: Optional[str] = None,
        stability: Optional[float] = None,
        similarity_boost: Optional[float] = None,
    ) -> GeneratedAudioResult:
        logger.info(
            f"MockVoiceProvider generating speech for voice '{voice_id}' "
            f"({len(text)} chars, speed={speaking_speed}, pitch={pitch})"
        )
        wav_bytes, duration_ms = generate_synthesized_wav_bytes(
            text=text,
            speaking_speed=speaking_speed,
            pitch_offset=pitch,
            sample_rate=24000,
        )
        metadata = inspect_audio_data(wav_bytes)

        return GeneratedAudioResult(
            audio_bytes=wav_bytes,
            mime_type=metadata.mime_type,
            extension=metadata.extension,
            duration_ms=metadata.duration_ms,
            sample_rate=metadata.sample_rate,
            channels=metadata.channels,
            bitrate_kbps=metadata.bitrate_kbps,
            waveform_data=metadata.waveform_data,
        )


class GoogleVoiceProvider(VoiceProvider):
    """Google Cloud Text-to-Speech API integration."""

    def __init__(self, api_key: str, model: str = "en-US-Neural2-C", timeout_s: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout_s = timeout_s
        self.endpoint = "https://texttospeech.googleapis.com/v1/text:synthesize"

    @property
    def provider_name(self) -> str:
        return "google"

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def list_supported_voices(self) -> List[VoiceOption]:
        # Combines predefined character archetypes with Google voices
        google_voices = [
            VoiceOption(
                voice_id="en-US-Journey-F",
                provider="google",
                name="Journey Female (Natural / Storyteller)",
                gender="female",
                accent="US",
                age="adult",
                description="Modern emotional Journey voice suitable for narrative & anime heroines.",
                traits=["emotional", "natural", "versatile"],
            ),
            VoiceOption(
                voice_id="en-US-Journey-D",
                provider="google",
                name="Journey Male (Warm / Protagonist)",
                gender="male",
                accent="US",
                age="adult",
                description="Expressive Journey voice for protagonists and heroes.",
                traits=["warm", "expressive", "clear"],
            ),
            VoiceOption(
                voice_id="en-US-Neural2-J",
                provider="google",
                name="Neural2 Male (Authoritative)",
                gender="male",
                accent="US",
                age="adult",
                description="Strong, grounded voice for mentors and warriors.",
                traits=["strong", "grounded"],
            ),
            VoiceOption(
                voice_id="en-US-Neural2-F",
                provider="google",
                name="Neural2 Female (Bright)",
                gender="female",
                accent="US",
                age="young",
                description="Clear, upbeat voice for companions and energetic heroines.",
                traits=["bright", "upbeat"],
            ),
            VoiceOption(
                voice_id="en-US-Studio-O",
                provider="google",
                name="Studio Narrator",
                gender="female",
                accent="US",
                age="adult",
                description="Ultra-high fidelity studio voice for cinematic voiceovers.",
                traits=["cinematic", "studio", "resonant"],
            ),
        ]
        return BUILTIN_ANIME_VOICES + google_voices

    async def generate_speech(
        self,
        text: str,
        voice_id: str,
        speaking_speed: float = 1.0,
        pitch: float = 0.0,
        voice_style: Optional[str] = None,
        stability: Optional[float] = None,
        similarity_boost: Optional[float] = None,
    ) -> GeneratedAudioResult:
        if not self.is_configured():
            raise VoiceAIConfigurationException(
                "Google Text-to-Speech API key is not configured. Set VOICE_API_KEY in your .env file."
            )

        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": "en-US",
                "name": voice_id if voice_id.startswith("en-") else "en-US-Neural2-C",
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": max(0.25, min(4.0, speaking_speed)),
                "pitch": max(-20.0, min(20.0, pitch)),
            },
        }

        url = f"{self.endpoint}?key={self.api_key}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                response = await client.post(url, json=payload)
        except httpx.TimeoutException:
            raise VoiceProviderException(
                "Google Cloud Text-to-Speech request timed out.",
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                error_code="VOICE_TIMEOUT",
            )
        except Exception as exc:
            raise VoiceProviderException(
                f"Failed to communicate with Google Cloud Text-to-Speech: {exc}",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_PROVIDER_NETWORK_ERROR",
            )

        if response.status_code == 429:
            raise VoiceProviderException(
                "Google Cloud Text-to-Speech quota or rate limit exceeded.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                error_code="VOICE_RATE_LIMIT",
            )
        if response.status_code >= 400:
            raise VoiceProviderException(
                f"Google Cloud Text-to-Speech error ({response.status_code}): {response.text}",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_API_ERROR",
            )

        data = response.json()
        audio_content_b64 = data.get("audioContent")
        if not audio_content_b64:
            raise VoiceProviderException(
                "Google Cloud Text-to-Speech response was missing 'audioContent'.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_EMPTY_OUTPUT",
            )

        try:
            audio_bytes = base64.b64decode(audio_content_b64)
        except Exception as exc:
            raise VoiceProviderException(
                f"Failed to decode audio content from Google TTS: {exc}",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_CORRUPT_PAYLOAD",
            )

        metadata = inspect_audio_data(audio_bytes)
        return GeneratedAudioResult(
            audio_bytes=audio_bytes,
            mime_type=metadata.mime_type,
            extension=metadata.extension,
            duration_ms=metadata.duration_ms,
            sample_rate=metadata.sample_rate,
            channels=metadata.channels,
            bitrate_kbps=metadata.bitrate_kbps,
            waveform_data=metadata.waveform_data,
        )


class ElevenLabsVoiceProvider(VoiceProvider):
    """ElevenLabs Text-to-Speech integration."""

    def __init__(
        self,
        api_key: str,
        model: str = "eleven_multilingual_v2",
        base_url: str = "https://api.elevenlabs.io",
        timeout_s: float = 45.0,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s

    @property
    def provider_name(self) -> str:
        return "elevenlabs"

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def list_supported_voices(self) -> List[VoiceOption]:
        if not self.is_configured():
            return BUILTIN_ANIME_VOICES

        try:
            headers = {"xi-api-key": self.api_key}
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(f"{self.base_url}/v1/voices", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    voices: List[VoiceOption] = []
                    for v in data.get("voices", []):
                        labels = v.get("labels", {})
                        voices.append(
                            VoiceOption(
                                voice_id=v["voice_id"],
                                provider="elevenlabs",
                                name=v.get("name", "ElevenLabs Voice"),
                                gender=labels.get("gender", "unspecified"),
                                accent=labels.get("accent"),
                                age=labels.get("age"),
                                description=labels.get("description") or v.get("category"),
                                preview_url=v.get("preview_url"),
                                traits=list(labels.values()),
                            )
                        )
                    return voices
        except Exception as exc:
            logger.warning(f"Failed to fetch ElevenLabs live voice list, falling back to builtin: {exc}")

        return BUILTIN_ANIME_VOICES

    async def generate_speech(
        self,
        text: str,
        voice_id: str,
        speaking_speed: float = 1.0,
        pitch: float = 0.0,
        voice_style: Optional[str] = None,
        stability: Optional[float] = None,
        similarity_boost: Optional[float] = None,
    ) -> GeneratedAudioResult:
        if not self.is_configured():
            raise VoiceAIConfigurationException(
                "ElevenLabs API key is not configured. Set VOICE_API_KEY in your .env file."
            )

        url = f"{self.base_url}/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        body: Dict[str, Any] = {
            "text": text,
            "model_id": self.model,
            "voice_settings": {
                "stability": stability if stability is not None else 0.5,
                "similarity_boost": similarity_boost if similarity_boost is not None else 0.75,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                response = await client.post(url, headers=headers, json=body)
        except httpx.TimeoutException:
            raise VoiceProviderException(
                "ElevenLabs text-to-speech request timed out.",
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                error_code="VOICE_TIMEOUT",
            )
        except Exception as exc:
            raise VoiceProviderException(
                f"Failed to connect to ElevenLabs API: {exc}",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_NETWORK_ERROR",
            )

        if response.status_code == 429:
            raise VoiceProviderException(
                "ElevenLabs rate limit or quota exceeded.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                error_code="VOICE_RATE_LIMIT",
            )
        if response.status_code >= 400:
            raise VoiceProviderException(
                f"ElevenLabs API error ({response.status_code}): {response.text}",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_API_ERROR",
            )

        audio_bytes = response.content
        if not audio_bytes:
            raise VoiceProviderException(
                "ElevenLabs returned an empty audio stream.",
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="VOICE_EMPTY_OUTPUT",
            )

        metadata = inspect_audio_data(audio_bytes)
        return GeneratedAudioResult(
            audio_bytes=audio_bytes,
            mime_type=metadata.mime_type,
            extension=metadata.extension,
            duration_ms=metadata.duration_ms,
            sample_rate=metadata.sample_rate,
            channels=metadata.channels,
            bitrate_kbps=metadata.bitrate_kbps,
            waveform_data=metadata.waveform_data,
        )


def get_voice_provider(requested_provider: Optional[str] = None) -> VoiceProvider:
    """
    Factory function returning the configured VoiceProvider.
    Respects VOICE_PROVIDER, requested override, and tests.
    """
    settings = get_settings()
    provider_name = (requested_provider or settings.VOICE_PROVIDER or "mock").lower()

    if provider_name == "mock":
        return MockVoiceProvider()

    if provider_name == "google":
        provider = GoogleVoiceProvider(
            api_key=settings.VOICE_API_KEY,
            model=settings.VOICE_MODEL or "en-US-Neural2-C",
            timeout_s=float(settings.VOICE_TIMEOUT_SECONDS),
        )
        if not provider.is_configured():
            raise VoiceAIConfigurationException(
                "Google Cloud Text-to-Speech is selected as VOICE_PROVIDER, but VOICE_API_KEY is not set. "
                "Add your key to the backend .env or configure 'VOICE_PROVIDER=mock' for local synthesis."
            )
        return provider

    if provider_name == "elevenlabs":
        provider = ElevenLabsVoiceProvider(
            api_key=settings.VOICE_API_KEY,
            model=settings.VOICE_MODEL or "eleven_multilingual_v2",
            base_url=settings.VOICE_BASE_URL or "https://api.elevenlabs.io",
            timeout_s=float(settings.VOICE_TIMEOUT_SECONDS),
        )
        if not provider.is_configured():
            raise VoiceAIConfigurationException(
                "ElevenLabs is selected as VOICE_PROVIDER, but VOICE_API_KEY is not set. "
                "Add your XI API key to the backend .env or configure 'VOICE_PROVIDER=mock' for local synthesis."
            )
        return provider

    # Unknown provider
    raise VoiceAIConfigurationException(
        f"Unsupported voice provider '{provider_name}'. Supported options are: 'mock', 'google', 'elevenlabs'."
    )
