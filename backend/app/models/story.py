"""
SQLAlchemy 2.0 ORM Models for TR STUDIO Step 2 — AI Story Creation Engine.
Includes:
- Story (metadata + JSONB structured document)
- StoryVersion (version snapshots for safe history inspection & restoration)
- StoryCharacter (characters belonging to a story)
- CharacterRelationship (directed or mutual relationships between characters)
- StoryLocation (world locations & environments)
- StoryScene (scene-by-scene breakdown & screenplay body)
- DialogueEntry (character dialogue lines with emotional & delivery directions)
- NarrationEntry (voiceover/narrator entries per scene)
- StoryGenerationJob (trackable & recoverable generation job state)
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
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
    from app.models.project import Project

# Portable JSONB that uses PostgreSQL JSONB in Postgres and JSON elsewhere
JSONBType = JSON().with_variant(JSONB(), "postgresql")


class Story(Base):
    __tablename__ = "stories"

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
        unique=True,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    schema_version: Mapped[str] = mapped_column(
        String(20),
        default="1.0",
        server_default="1.0",
        nullable=False,
    )
    idea: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    logline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Full plot & 3-act structure
    full_plot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    beginning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    middle: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ending_act: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Creative configuration
    genre: Mapped[str] = mapped_column(String(100), default="Fantasy", nullable=False)
    animation_style: Mapped[str] = mapped_column(String(100), default="Anime", nullable=False)
    target_audience: Mapped[str] = mapped_column(String(100), default="Everyone", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    language: Mapped[str] = mapped_column(String(80), default="English", nullable=False)
    main_character_count: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    tone: Mapped[str] = mapped_column(String(100), default="Emotional", nullable=False)
    complexity: Mapped[str] = mapped_column(String(50), default="Medium", nullable=False)
    ending_type: Mapped[str] = mapped_column(String(100), default="AI decides", nullable=False)
    additional_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    themes: Mapped[List[str]] = mapped_column(
        JSONBType,
        default=list,
         nullable=False,
    )
    world_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Full validated JSONB snapshot of the versioned StoryOutputDocument
    structured_data: Mapped[Dict[str, Any]] = mapped_column(
        JSONBType,
        default=dict,
        nullable=False,
    )

    current_version_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="story")
    characters: Mapped[List["StoryCharacter"]] = relationship(
        "StoryCharacter",
        back_populates="story",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StoryCharacter.created_at",
    )
    character_relationships: Mapped[List["CharacterRelationship"]] = relationship(
        "CharacterRelationship",
        back_populates="story",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    locations: Mapped[List["StoryLocation"]] = relationship(
        "StoryLocation",
        back_populates="story",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StoryLocation.created_at",
    )
    scenes: Mapped[List["StoryScene"]] = relationship(
        "StoryScene",
        back_populates="story",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StoryScene.scene_number",
    )
    versions: Mapped[List["StoryVersion"]] = relationship(
        "StoryVersion",
        back_populates="story",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StoryVersion.version_number.desc()",
    )
    generation_jobs: Mapped[List["StoryGenerationJob"]] = relationship(
        "StoryGenerationJob",
        back_populates="story",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StoryGenerationJob.created_at.desc()",
    )


class StoryVersion(Base):
    __tablename__ = "story_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[str] = mapped_column(
        String(50),
        default="manual_save",
        nullable=False,
    )
    snapshot: Mapped[Dict[str, Any]] = mapped_column(
        JSONBType,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    story: Mapped["Story"] = relationship("Story", back_populates="versions")

    __table_args__ = (
        Index("ix_story_versions_story_id_version_number", "story_id", "version_number"),
    )


class StoryCharacter(Base):
    __tablename__ = "story_characters"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(100), default="Protagonist", nullable=False)
    age_description: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    personality: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    appearance_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    backstory: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    relationships_data: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONBType,
        default=list,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    story: Mapped["Story"] = relationship("Story", back_populates="characters")


class CharacterRelationship(Base):
    __tablename__ = "character_relationships"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_characters.id", ondelete="CASCADE"),
        nullable=True,
    )
    target_character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_characters.id", ondelete="CASCADE"),
        nullable=True,
    )
    source_character_name: Mapped[str] = mapped_column(String(150), nullable=False)
    target_character_name: Mapped[str] = mapped_column(String(150), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    story: Mapped["Story"] = relationship("Story", back_populates="character_relationships")


class StoryLocation(Base):
    __tablename__ = "story_locations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    atmosphere: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    time_of_day: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    environment_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    story: Mapped["Story"] = relationship("Story", back_populates="locations")


class StoryScene(Base):
    __tablename__ = "story_scenes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    location_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    scene_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    scene_heading: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    characters: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    camera_directions: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    audio_directions: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    visual_directions: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    emotional_directions: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    storyboard_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Step 5: Professional Scene Builder & Storyboard Studio fields
    environment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("environments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    world_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("world_locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    scene_type: Mapped[str] = mapped_column(
        String(100),
        default="Narrative",
        server_default="Narrative",
        nullable=False,
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_of_day: Mapped[str] = mapped_column(
        String(80),
        default="Day",
        server_default="Day",
        nullable=False,
    )
    weather: Mapped[str] = mapped_column(
        String(80),
        default="Clear",
        server_default="Clear",
        nullable=False,
    )
    mood: Mapped[str] = mapped_column(
        String(120),
        default="Cinematic",
        server_default="Cinematic",
        nullable=False,
    )
    camera_framing: Mapped[str] = mapped_column(
        String(120),
        default="Wide establishing shot",
        server_default="Wide establishing shot",
        nullable=False,
    )
    transition_type: Mapped[str] = mapped_column(
        String(80),
        default="Cut",
        server_default="Cut",
        nullable=False,
    )
    production_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scene_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONBType,
        default=dict,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    story: Mapped["Story"] = relationship("Story", back_populates="scenes")
    dialogue_entries: Mapped[List["DialogueEntry"]] = relationship(
        "DialogueEntry",
        back_populates="scene",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DialogueEntry.line_order",
    )
    narration_entries: Mapped[List["NarrationEntry"]] = relationship(
        "NarrationEntry",
        back_populates="scene",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="NarrationEntry.entry_order",
    )

    __table_args__ = (
        Index("ix_story_scenes_story_id_scene_number", "story_id", "scene_number"),
    )


class DialogueEntry(Base):
    __tablename__ = "dialogue_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    scene_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    character_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_characters.id", ondelete="SET NULL"),
        nullable=True,
    )
    character_name: Mapped[str] = mapped_column(String(150), nullable=False)
    line: Mapped[str] = mapped_column(Text, nullable=False)
    emotion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_direction: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    line_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    shot_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("scene_shots.id", ondelete="SET NULL"),
        nullable=True,
    )
    speaking_speed: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    pause_duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pronunciation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    audio_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("audio_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    scene: Mapped["StoryScene"] = relationship("StoryScene", back_populates="dialogue_entries")

    @property
    def line_text(self) -> str:
        return self.line

    @line_text.setter
    def line_text(self, val: str) -> None:
        self.line = val

    @property
    def delivery_style(self) -> Optional[str]:
        return self.delivery_direction

    @delivery_style.setter
    def delivery_style(self, val: Optional[str]) -> None:
        self.delivery_direction = val


class NarrationEntry(Base):
    __tablename__ = "narration_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    scene_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    narrator_voice: Mapped[str] = mapped_column(
        String(100),
        default="Narrator (V.O.)",
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    emotion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entry_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    audio_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    audio_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("audio_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    language: Mapped[str] = mapped_column(String(20), default="en-US", nullable=False)
    voice_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONBType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    scene: Mapped["StoryScene"] = relationship("StoryScene", back_populates="narration_entries")

    @property
    def narration_text(self) -> str:
        return self.text

    @narration_text.setter
    def narration_text(self, val: str) -> None:
        self.text = val

    @property
    def narrator_style(self) -> Optional[str]:
        return self.narrator_voice

    @narrator_style.setter
    def narrator_style(self, val: Optional[str]) -> None:
        self.narrator_voice = val or "Narrator (V.O.)"

    @property
    def line_order(self) -> int:
        return self.entry_order

    @line_order.setter
    def line_order(self, val: int) -> None:
        self.entry_order = val


class StoryGenerationJob(Base):
    __tablename__ = "story_generation_jobs"

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
    story_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_type: Mapped[str] = mapped_column(
        String(60),
        default="generate_story",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(40),
        default="pending",
        nullable=False,
        index=True,
    )
    current_step: Mapped[str] = mapped_column(
        String(150),
        default="Initializing request",
        nullable=False,
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    request_payload: Mapped[Dict[str, Any]] = mapped_column(
        JSONBType,
        default=dict,
        nullable=False,
    )
    result_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONBType,
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    story: Mapped[Optional["Story"]] = relationship("Story", back_populates="generation_jobs")
