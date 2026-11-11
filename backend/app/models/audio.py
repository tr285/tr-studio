"""
SQLAlchemy Data Models for TR STUDIO Step 8 — Professional Dialogue, Voice & Audio Studio.

Models:
- CharacterVoiceProfile: Voice provider, voice ID, pitch, speed, and settings per character
- AudioAsset: Uploaded, generated, or library audio files (music, sfx, dialogue, narration, ambience)
- AudioGenerationJob: Async TTS synthesis tracking and error handling
- SubtitleTrack: Subtitle language track linked to a project/story/scene
- SubtitleEntry: Individual timecoded caption line with speaker attribution
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.character import Character
    from app.models.project import Project
    from app.models.scene import SceneShot, StoryScene
    from app.models.story import DialogueEntry, NarrationEntry, Story
    from app.models.user import User

JSONBType = JSON().with_variant(JSONB(), "postgresql")


class CharacterVoiceProfile(Base):
    __tablename__ = "character_voice_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    character_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    voice_provider: Mapped[str] = mapped_column(String(50), default="google", nullable=False)
    voice_id: Mapped[str] = mapped_column(String(150), nullable=False)
    voice_name: Mapped[str] = mapped_column(String(150), nullable=False)
    language: Mapped[str] = mapped_column(String(50), default="en-US", nullable=False)
    accent: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    voice_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    speaking_speed: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    pitch: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    stability: Mapped[float] = mapped_column(Float, default=0.75, nullable=False)
    default_emotion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    settings_json: Mapped[Dict[str, Any]] = mapped_column(JSONBType, default=dict, nullable=False)
    sample_audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __init__(self, **kwargs: Any) -> None:
        # Normalize aliases
        if "provider" in kwargs and "voice_provider" not in kwargs:
            kwargs["voice_provider"] = kwargs.pop("provider")
        if "speaking_rate" in kwargs and "speaking_speed" not in kwargs:
            kwargs["speaking_speed"] = kwargs.pop("speaking_rate")
        if "sample_url" in kwargs and "sample_audio_url" not in kwargs:
            kwargs["sample_audio_url"] = kwargs.pop("sample_url")
        if "notes" in kwargs and "voice_description" not in kwargs:
            kwargs["voice_description"] = kwargs.pop("notes")
        # Custom extra fields can go into settings_json
        extra_keys = ["custom_pronunciations", "voice_style", "age_category", "gender", "similarity_boost"]
        settings = kwargs.setdefault("settings_json", {})
        for k in extra_keys:
            if k in kwargs:
                settings[k] = kwargs.pop(k)
        super().__init__(**kwargs)

    @property
    def provider(self) -> str:
        return self.voice_provider

    @provider.setter
    def provider(self, val: str) -> None:
        self.voice_provider = val

    @property
    def speaking_rate(self) -> float:
        return self.speaking_speed

    @speaking_rate.setter
    def speaking_rate(self, val: float) -> None:
        self.speaking_speed = val

    @property
    def sample_url(self) -> Optional[str]:
        return self.sample_audio_url

    @sample_url.setter
    def sample_url(self, val: Optional[str]) -> None:
        self.sample_audio_url = val

    @property
    def notes(self) -> Optional[str]:
        return self.voice_description

    @notes.setter
    def notes(self, val: Optional[str]) -> None:
        self.voice_description = val

    @property
    def custom_pronunciations(self) -> Dict[str, str]:
        return self.settings_json.get("custom_pronunciations", {})

    @property
    def voice_style(self) -> Optional[str]:
        return self.settings_json.get("voice_style")

    @property
    def similarity_boost(self) -> Optional[float]:
        return self.settings_json.get("similarity_boost")

    @property
    def age_category(self) -> Optional[str]:
        return self.settings_json.get("age_category")

    @property
    def gender(self) -> Optional[str]:
        return self.settings_json.get("gender")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    character: Mapped["Character"] = relationship("Character", backref="voice_profile")
    project: Mapped["Project"] = relationship("Project")
    owner: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_char_voice_project_char", "project_id", "character_id"),
    )


class AudioAsset(Base):
    __tablename__ = "audio_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Categories: music | sound_effect | dialogue | narration | ambience
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sub_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_rate: Mapped[int] = mapped_column(Integer, default=44100, nullable=False)
    channels: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    bitrate_kbps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Waveform visualization peak data (normalized floats [0..1])
    waveform_data: Mapped[Optional[List[float]]] = mapped_column(JSONBType, nullable=True)

    # Source: uploaded | generated | library
    source_type: Mapped[str] = mapped_column(String(50), default="uploaded", nullable=False)
    licensing_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSONBType, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project: Mapped["Project"] = relationship("Project")
    owner: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_audio_project_category", "project_id", "category"),
    )


class AudioGenerationJob(Base):
    __tablename__ = "audio_generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dialogue_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("dialogue_entries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    narration_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("narration_entries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("characters.id", ondelete="SET NULL"),
        nullable=True,
    )

    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    voice_id: Mapped[str] = mapped_column(String(150), nullable=False)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    audio_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("audio_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSONBType, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project: Mapped["Project"] = relationship("Project")
    audio_asset: Mapped[Optional["AudioAsset"]] = relationship("AudioAsset")

    __table_args__ = (
        Index("ix_audio_job_project_status", "project_id", "status"),
    )


class SubtitleTrack(Base):
    __tablename__ = "subtitle_tracks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    story_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=True,
    )
    scene_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_scenes.id", ondelete="CASCADE"),
        nullable=True,
    )

    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)
    name: Mapped[str] = mapped_column(String(150), default="English (Main)", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    entries: Mapped[List["SubtitleEntry"]] = relationship(
        "SubtitleEntry",
        back_populates="track",
        cascade="all, delete-orphan",
        order_by="SubtitleEntry.entry_order",
    )


class SubtitleEntry(Base):
    __tablename__ = "subtitle_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    track_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("subtitle_tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scene_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_scenes.id", ondelete="CASCADE"),
        nullable=True,
    )
    dialogue_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("dialogue_entries.id", ondelete="SET NULL"),
        nullable=True,
    )
    narration_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("narration_entries.id", ondelete="SET NULL"),
        nullable=True,
    )

    speaker_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    track: Mapped["SubtitleTrack"] = relationship("SubtitleTrack", back_populates="entries")

    __table_args__ = (
        Index("ix_sub_entry_track_order", "track_id", "entry_order"),
    )
