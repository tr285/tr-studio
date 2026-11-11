"""
SQLAlchemy ORM Models for TR STUDIO Step 9 — Professional Video Rendering, Export & Production Pipeline.

Models:
- RenderJob: Tracks async rendering jobs, stage progression, frame counters, export settings, and error handling.
- RenderOutput: Persisted completed video exports with ffprobe validation metadata, resolution, codecs, and signed media URLs.
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
    from app.models.project import Project
    from app.models.story import StoryScene
    from app.models.user import User

JSONBType = JSON().with_variant(JSONB(), "postgresql")


class RenderJob(Base):
    __tablename__ = "render_jobs"

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
    scene_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_scenes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Status: queued | preparing | rendering | encoding | validating | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_stage: Mapped[str] = mapped_column(String(100), default="queued", nullable=False)

    total_frames: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rendered_frames: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Video Settings
    fps: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    resolution_width: Mapped[int] = mapped_column(Integer, default=1920, nullable=False)
    resolution_height: Mapped[int] = mapped_column(Integer, default=1080, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(String(20), default="16:9", nullable=False)
    container_format: Mapped[str] = mapped_column(String(20), default="mp4", nullable=False)
    video_codec: Mapped[str] = mapped_column(String(50), default="h264", nullable=False)
    audio_codec: Mapped[str] = mapped_column(String(50), default="aac", nullable=False)
    quality_preset: Mapped[str] = mapped_column(String(50), default="standard", nullable=False)
    bitrate_kbps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Audio & Subtitle inclusion
    include_audio: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    include_subtitles: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    burn_subtitles: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    subtitle_track_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), nullable=True)

    # Export Range
    export_range_type: Mapped[str] = mapped_column(String(50), default="full", nullable=False)  # full | scene | custom
    export_range_start_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    export_range_end_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Result & Diagnostics
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    render_logs: Mapped[List[str]] = mapped_column(JSONBType, default=list, nullable=False)
    settings_json: Mapped[Dict[str, Any]] = mapped_column(JSONBType, default=dict, nullable=False)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
    scene: Mapped[Optional["StoryScene"]] = relationship("StoryScene")
    output: Mapped[Optional["RenderOutput"]] = relationship("RenderOutput", back_populates="job", uselist=False)

    __table_args__ = (
        Index("ix_render_job_project_status", "project_id", "status"),
        Index("ix_render_job_created_at", "created_at"),
    )


class RenderOutput(Base):
    __tablename__ = "render_outputs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("render_jobs.id", ondelete="CASCADE"),
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
    scene_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("story_scenes.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="video/mp4", nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    fps: Mapped[int] = mapped_column(Integer, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(String(20), nullable=False)

    video_codec: Mapped[str] = mapped_column(String(50), nullable=False)
    audio_codec: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    has_audio: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    has_subtitles: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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

    job: Mapped["RenderJob"] = relationship("RenderJob", back_populates="output")
    project: Mapped["Project"] = relationship("Project")
    owner: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_render_output_project_created", "project_id", "created_at"),
    )
