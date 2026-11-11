"""
SQLAlchemy 2.0 ORM Models for TR STUDIO Step 3 — Professional AI Character Creation Studio.
Includes:
- Character (canonical character profile, appearance, style, Character Bible metadata, canonical_reference_asset_id)
- CharacterAsset (generated or uploaded images with storage file_reference, prompt, provider, status, metadata)
- CharacterExpression (expression library entries linked to CharacterAsset)
- CharacterPose (pose library entries linked to CharacterAsset)
- CharacterOutfit (outfit management entries with color_palette, accessories, is_default, linked to CharacterAsset)
- CharacterGenerationJob (trackable AI image generation jobs with status, prompt, provider, result_metadata)
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
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
    from app.models.story import Story

JSONBType = JSON().with_variant(JSONB(), "postgresql")


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
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
        ForeignKey("stories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    nickname: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    role: Mapped[str] = mapped_column(
        String(100),
        default="Main character",
        nullable=False,
        index=True,
    )
    species: Mapped[str] = mapped_column(
        String(100),
        default="Human",
        nullable=False,
    )
    age_description: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    personality: Mapped[List[str]] = mapped_column(
        JSONBType,
        default=list,
        nullable=False,
    )
    backstory: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    appearance_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    canonical_reference_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
        index=True,
    )

    style: Mapped[str] = mapped_column(
        String(100),
        default="Anime",
        nullable=False,
        index=True,
    )

    # Mapped to column "metadata" in PostgreSQL while avoiding SQLAlchemy Base.metadata collision
    character_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
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

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="characters")
    story: Mapped[Optional["Story"]] = relationship("Story")
    assets: Mapped[List["CharacterAsset"]] = relationship(
        "CharacterAsset",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CharacterAsset.created_at.desc()",
    )
    expressions: Mapped[List["CharacterExpression"]] = relationship(
        "CharacterExpression",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CharacterExpression.created_at.asc()",
    )
    poses: Mapped[List["CharacterPose"]] = relationship(
        "CharacterPose",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CharacterPose.created_at.asc()",
    )
    outfits: Mapped[List["CharacterOutfit"]] = relationship(
        "CharacterOutfit",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CharacterOutfit.created_at.asc()",
    )
    generation_jobs: Mapped[List["CharacterGenerationJob"]] = relationship(
        "CharacterGenerationJob",
        back_populates="character",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CharacterGenerationJob.created_at.desc()",
    )

    __table_args__ = (
        Index("ix_characters_owner_project", "owner_id", "project_id"),
        Index("ix_characters_project_updated", "project_id", "updated_at"),
    )


class CharacterAsset(Base):
    __tablename__ = "character_assets"

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
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[str] = mapped_column(
        String(80),
        default="concept",
        nullable=False,
        index=True,
    )
    file_reference: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    generation_status: Mapped[str] = mapped_column(
        String(50),
        default="completed",
        nullable=False,
        index=True,
    )
    asset_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
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

    character: Mapped["Character"] = relationship("Character", back_populates="assets")

    __table_args__ = (
        Index("ix_character_assets_char_type", "character_id", "asset_type"),
    )


class CharacterExpression(Base):
    __tablename__ = "character_expressions"

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
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generation_status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("character_assets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    character: Mapped["Character"] = relationship(
        "Character",
        back_populates="expressions",
    )
    asset: Mapped[Optional["CharacterAsset"]] = relationship("CharacterAsset")


class CharacterPose(Base):
    __tablename__ = "character_poses"

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
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(
        String(100),
        default="Standing",
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    generation_status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("character_assets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    character: Mapped["Character"] = relationship(
        "Character",
        back_populates="poses",
    )
    asset: Mapped[Optional["CharacterAsset"]] = relationship("CharacterAsset")


class CharacterOutfit(Base):
    __tablename__ = "character_outfits"

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
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color_palette: Mapped[List[str]] = mapped_column(
        JSONBType,
        default=list,
        nullable=False,
    )
    accessories: Mapped[List[str]] = mapped_column(
        JSONBType,
        default=list,
        nullable=False,
    )
    generation_status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("character_assets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    character: Mapped["Character"] = relationship(
        "Character",
        back_populates="outfits",
    )
    asset: Mapped[Optional["CharacterAsset"]] = relationship("CharacterAsset")


class CharacterGenerationJob(Base):
    __tablename__ = "character_generation_jobs"

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
        index=True,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    generation_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
        index=True,
    )
    provider: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_metadata: Mapped[Dict[str, Any]] = mapped_column(
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

    character: Mapped["Character"] = relationship(
        "Character",
        back_populates="generation_jobs",
    )

    __table_args__ = (
        Index("ix_char_gen_jobs_char_created", "character_id", "created_at"),
    )
