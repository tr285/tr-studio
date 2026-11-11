"""
Pydantic Schemas for TR STUDIO Step 8 — Professional Dialogue, Voice & Audio Studio.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Character Voice Profiles
# ---------------------------------------------------------------------------

class VoiceOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    voice_id: str
    provider: str
    name: str
    gender: Optional[str] = "unspecified"
    accent: Optional[str] = None
    age: Optional[str] = None
    description: Optional[str] = None
    preview_url: Optional[str] = None
    sample_text: Optional[str] = None
    traits: List[str] = Field(default_factory=list)


class CharacterVoiceProfileBase(BaseModel):
    provider: str = Field(default="mock", description="Voice provider (google, elevenlabs, mock)")
    voice_id: str = Field(..., description="Provider voice identifier")
    voice_name: str = Field(..., description="Display name for the voice")
    voice_style: Optional[str] = Field(None, description="Style or tone preset")
    speaking_rate: float = Field(default=1.0, ge=0.25, le=4.0)
    pitch: float = Field(default=0.0, ge=-20.0, le=20.0)
    stability: Optional[float] = Field(None, ge=0.0, le=1.0)
    similarity_boost: Optional[float] = Field(None, ge=0.0, le=1.0)
    accent: Optional[str] = None
    age_category: Optional[str] = None
    gender: Optional[str] = None
    sample_url: Optional[str] = None
    custom_pronunciations: Dict[str, str] = Field(default_factory=dict)
    notes: Optional[str] = None


class CharacterVoiceProfileCreate(CharacterVoiceProfileBase):
    character_id: uuid.UUID


class CharacterVoiceProfileUpdate(BaseModel):
    provider: Optional[str] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    voice_style: Optional[str] = None
    speaking_rate: Optional[float] = Field(None, ge=0.25, le=4.0)
    pitch: Optional[float] = Field(None, ge=-20.0, le=20.0)
    stability: Optional[float] = Field(None, ge=0.0, le=1.0)
    similarity_boost: Optional[float] = Field(None, ge=0.0, le=1.0)
    accent: Optional[str] = None
    age_category: Optional[str] = None
    gender: Optional[str] = None
    sample_url: Optional[str] = None
    custom_pronunciations: Optional[Dict[str, str]] = None
    notes: Optional[str] = None


class CharacterVoiceProfileResponse(CharacterVoiceProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    character_id: uuid.UUID
    character_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Audio Assets (Music, Sound Effects, Ambience, Generated Dialogue/Narration)
# ---------------------------------------------------------------------------

AudioCategory = Literal["music", "sound_effect", "dialogue", "narration", "ambience"]
AudioSourceType = Literal["uploaded", "generated", "library"]


class AudioAssetBase(BaseModel):
    category: AudioCategory
    sub_category: Optional[str] = None
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    licensing_notes: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class AudioAssetCreate(AudioAssetBase):
    project_id: uuid.UUID
    file_path: str
    file_size_bytes: int
    mime_type: str
    duration_ms: int
    sample_rate: int = 44100
    channels: int = 2
    bitrate_kbps: Optional[int] = None
    waveform_data: Optional[List[float]] = None
    source_type: AudioSourceType = "uploaded"


class AudioAssetUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    sub_category: Optional[str] = None
    licensing_notes: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class AudioAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    category: str
    sub_category: Optional[str] = None
    title: str
    description: Optional[str] = None
    file_path: str
    audio_url: str = ""
    file_size_bytes: int
    mime_type: str
    duration_ms: int
    sample_rate: int
    channels: int
    bitrate_kbps: Optional[int] = None
    waveform_data: Optional[List[float]] = None
    source_type: str
    licensing_notes: Optional[str] = None
    metadata_json: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AudioAssetListResponse(BaseModel):
    items: List[AudioAssetResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Dialogue Line Audio Timing & Generation
# ---------------------------------------------------------------------------

class DialogueLineUpdate(BaseModel):
    line_text: Optional[str] = None
    emotion: Optional[str] = None
    delivery_style: Optional[str] = None
    speaking_speed: Optional[float] = Field(None, ge=0.25, le=4.0)
    pause_duration_ms: Optional[int] = Field(None, ge=0)
    pronunciation_notes: Optional[str] = None
    character_id: Optional[uuid.UUID] = None
    shot_id: Optional[uuid.UUID] = None
    start_ms: Optional[int] = Field(None, ge=0)
    duration_ms: Optional[int] = Field(None, ge=0)


class DialogueLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    character_id: Optional[uuid.UUID] = None
    character_name: Optional[str] = None
    line_text: str
    emotion: Optional[str] = None
    delivery_style: Optional[str] = None
    line_order: int
    shot_id: Optional[uuid.UUID] = None
    speaking_speed: float
    pause_duration_ms: int
    pronunciation_notes: Optional[str] = None
    audio_status: str
    audio_asset_id: Optional[uuid.UUID] = None
    audio_url: Optional[str] = None
    start_ms: Optional[int] = None
    duration_ms: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Narration Line Audio Timing & Generation
# ---------------------------------------------------------------------------

class NarrationLineUpdate(BaseModel):
    narration_text: Optional[str] = None
    narrator_style: Optional[str] = None
    start_ms: Optional[int] = Field(None, ge=0)
    duration_ms: Optional[int] = Field(None, ge=0)
    language: Optional[str] = None
    voice_settings: Optional[Dict[str, Any]] = None


class NarrationLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    narration_text: str
    narrator_style: Optional[str] = None
    line_order: int
    audio_status: str
    audio_asset_id: Optional[uuid.UUID] = None
    audio_url: Optional[str] = None
    start_ms: Optional[int] = None
    duration_ms: Optional[int] = None
    language: str
    voice_settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Voice Generation Requests and Jobs
# ---------------------------------------------------------------------------

class GenerateDialogueSpeechRequest(BaseModel):
    dialogue_id: Optional[uuid.UUID] = None
    voice_id: Optional[str] = None
    provider: Optional[str] = None
    speaking_speed: Optional[float] = Field(None, ge=0.25, le=4.0)
    pitch: Optional[float] = Field(None, ge=-20.0, le=20.0)


class GenerateNarrationSpeechRequest(BaseModel):
    narration_id: Optional[uuid.UUID] = None
    voice_id: Optional[str] = None
    provider: Optional[str] = None
    speaking_speed: Optional[float] = Field(None, ge=0.25, le=4.0)


class BatchGenerateSpeechRequest(BaseModel):
    scene_id: Optional[uuid.UUID] = None
    dialogue_ids: Optional[List[uuid.UUID]] = None
    narration_ids: Optional[List[uuid.UUID]] = None
    force_regenerate: bool = False


class AudioGenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    dialogue_id: Optional[uuid.UUID] = None
    narration_id: Optional[uuid.UUID] = None
    character_id: Optional[uuid.UUID] = None
    provider: str
    voice_id: str
    input_text: str
    status: str
    error_message: Optional[str] = None
    audio_asset_id: Optional[uuid.UUID] = None
    duration_ms: Optional[int] = None
    metadata_json: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class BatchGenerateSpeechResponse(BaseModel):
    total_requested: int
    completed: int
    failed: int
    jobs: List[AudioGenerationJobResponse]


# ---------------------------------------------------------------------------
# Subtitles
# ---------------------------------------------------------------------------

class SubtitleEntryBase(BaseModel):
    start_ms: int = Field(..., ge=0)
    end_ms: int = Field(..., ge=0)
    text: str = Field(..., max_length=1000)
    speaker_name: Optional[str] = None
    scene_id: Optional[uuid.UUID] = None
    dialogue_id: Optional[uuid.UUID] = None
    narration_id: Optional[uuid.UUID] = None
    entry_order: int = 0
    styling_json: Dict[str, Any] = Field(default_factory=dict)


class SubtitleEntryCreate(SubtitleEntryBase):
    pass


class SubtitleEntryUpdate(BaseModel):
    start_ms: Optional[int] = Field(None, ge=0)
    end_ms: Optional[int] = Field(None, ge=0)
    text: Optional[str] = Field(None, max_length=1000)
    speaker_name: Optional[str] = None
    entry_order: Optional[int] = None
    styling_json: Optional[Dict[str, Any]] = None


class SubtitleEntryResponse(SubtitleEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    track_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class SubtitleTrackBase(BaseModel):
    language: str = Field(default="en", max_length=20)
    name: str = Field(default="English (Main)", max_length=150)
    is_default: bool = True
    scene_id: Optional[uuid.UUID] = None
    story_id: Optional[uuid.UUID] = None


class SubtitleTrackCreate(SubtitleTrackBase):
    pass


class SubtitleTrackUpdate(BaseModel):
    language: Optional[str] = None
    name: Optional[str] = None
    is_default: Optional[bool] = None


class SubtitleTrackResponse(SubtitleTrackBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    entries: List[SubtitleEntryResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SubtitleExportResponse(BaseModel):
    track_id: uuid.UUID
    language: str
    format: Literal["srt", "vtt"]
    content: str
    filename: str


# ---------------------------------------------------------------------------
# Timeline Sync
# ---------------------------------------------------------------------------

class TimelineAudioSyncRequest(BaseModel):
    scene_id: uuid.UUID
    include_dialogue: bool = True
    include_narration: bool = True
    auto_place_clips: bool = True


class TimelineAudioSyncResponse(BaseModel):
    scene_id: uuid.UUID
    tracks_created: int
    clips_created: int
    message: str
