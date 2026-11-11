"""
SQLAlchemy 2.0 ORM Models for TR STUDIO Step 6 — Professional 2D Animation Engine.
Includes:
- SceneAnimation (holds versioned AnimationDocument JSONB, concurrency version_number, scene_id, project_id, owner_id)
- AnimationGenerationJob (trackable AI animation assist jobs)
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database.base import Base

JSONBType = JSON().with_variant(JSONB(), "postgresql")


class SceneAnimation(Base):
    __tablename__ = "scene_animations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    scene_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        unique=True,
        index=True,
    )
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
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

    schema_version: Mapped[str] = mapped_column(
        String(20),
        default="1.0",
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    fps: Mapped[int] = mapped_column(
        Integer,
        default=24,
        nullable=False,
    )
    duration_ms: Mapped[int] = mapped_column(
        Integer,
        default=5000,
        nullable=False,
    )
    width: Mapped[int] = mapped_column(
        Integer,
        default=1920,
        nullable=False,
    )
    height: Mapped[int] = mapped_column(
        Integer,
        default=1080,
        nullable=False,
    )

    document: Mapped[Dict[str, Any]] = mapped_column(
        JSONBType,
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

    __table_args__ = (
        Index("ix_scene_animations_project_id", "project_id"),
        Index("ix_scene_animations_story_id", "story_id"),
        Index("ix_scene_animations_owner_id", "owner_id"),
    )


class AnimationGenerationJob(Base):
    __tablename__ = "animation_generation_jobs"

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
    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scene_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
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
        String(80),
        default="animation_assist",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(40),
        default="pending",
        nullable=False,
        index=True,
    )
    provider: Mapped[Optional[str]] = mapped_column(
        String(60),
        nullable=True,
    )
    model_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    prompt_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
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

    __table_args__ = (
        Index("ix_animation_jobs_project_id", "project_id"),
        Index("ix_animation_jobs_status", "status"),
        Index("ix_animation_jobs_owner_id", "owner_id"),
    )
