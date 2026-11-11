"""
SQLAlchemy 2.0 ORM Models for TR STUDIO Step 4 — World & Environment Creation Studio:
- Environment (`environments`)
- EnvironmentAsset (`environment_assets`)
- EnvironmentVariation (`environment_variations`)
- World (`worlds`)
- WorldLocation (`world_locations`)
- EnvironmentGenerationJob (`environment_generation_jobs`)

All entities enforce ownership through `owner_id` and `project_id` foreign keys.
Deleting an Environment or WorldLocation uses safe `SET NULL` / child `CASCADE` rules
so deleting an environment NEVER deletes a Story, Project, or Character.
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.story import JSONBType

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.story import Story
    from app.models.user import User


class Environment(Base):
    """
    Core Environment entity representing a reusable visual world background,
    interior, exterior, or natural landscape.
    """

    __tablename__ = "environments"

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

    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(100),
        default="Natural",
        nullable=False,
        index=True,
    )
    art_style: Mapped[str] = mapped_column(
        String(100),
        default="Anime",
        nullable=False,
        index=True,
    )
    visual_mood: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    time_of_day: Mapped[str] = mapped_column(
        String(80),
        default="Afternoon",
        nullable=False,
    )
    weather: Mapped[str] = mapped_column(
        String(80),
        default="Clear",
        nullable=False,
    )
    color_palette: Mapped[List[str]] = mapped_column(
        JSONBType,
        default=list,
        nullable=False,
    )
    camera_perspective: Mapped[str] = mapped_column(
        String(120),
        default="Wide establishing shot",
        nullable=False,
    )
    environment_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
        JSONBType,
        default=dict,
        nullable=False,
    )
    default_asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
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
    owner: Mapped["User"] = relationship("User")
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="environments",
    )
    story: Mapped[Optional["Story"]] = relationship("Story")

    assets: Mapped[List["EnvironmentAsset"]] = relationship(
        "EnvironmentAsset",
        back_populates="environment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="EnvironmentAsset.created_at.desc()",
    )
    variations: Mapped[List["EnvironmentVariation"]] = relationship(
        "EnvironmentVariation",
        back_populates="environment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="EnvironmentVariation.created_at.asc()",
    )
    generation_jobs: Mapped[List["EnvironmentGenerationJob"]] = relationship(
        "EnvironmentGenerationJob",
        back_populates="environment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="EnvironmentGenerationJob.created_at.desc()",
    )

    __table_args__ = (
        Index("ix_environments_owner_project", "owner_id", "project_id"),
        Index("ix_environments_project_updated_at", "project_id", "updated_at"),
    )


class EnvironmentAsset(Base):
    """
    Stores generated or uploaded visual assets for an environment:
    `concept`, `landscape`, `interior`, `exterior`, `variation`,
    `lighting_variation`, `weather_variation`, `camera_view`,
    `environment_detail`, `architecture_reference`, `uploaded_reference`.
    """

    __tablename__ = "environment_assets"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    environment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
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
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
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

    environment: Mapped["Environment"] = relationship(
        "Environment",
        back_populates="assets",
    )

    __table_args__ = (
        Index(
            "ix_environment_assets_env_type",
            "environment_id",
            "asset_type",
        ),
    )


class EnvironmentVariation(Base):
    """
    Represents a distinct variation of an environment (e.g., Morning, Night,
    Rainy, Winter, Sunset, Daytime Lighting, Custom Decoration) linked to an
    `EnvironmentAsset` without overwriting the canonical environment.
    """

    __tablename__ = "environment_variations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    environment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variation_type: Mapped[str] = mapped_column(
        String(80),
        default="time_of_day",
        nullable=False,
        index=True,
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("environment_assets.id", ondelete="SET NULL"),
        nullable=True,
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

    environment: Mapped["Environment"] = relationship(
        "Environment",
        back_populates="variations",
    )
    asset: Mapped[Optional["EnvironmentAsset"]] = relationship("EnvironmentAsset")


class World(Base):
    """
    Top-level World container for a project, organizing Regions, Locations,
    Buildings, Rooms, and Natural Areas in a hierarchy.
    """

    __tablename__ = "worlds"

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
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    world_metadata: Mapped[Dict[str, Any]] = mapped_column(
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

    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="worlds",
    )
    locations: Mapped[List["WorldLocation"]] = relationship(
        "WorldLocation",
        back_populates="world",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="WorldLocation.sort_order.asc(), WorldLocation.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_worlds_owner_project", "owner_id", "project_id"),
    )


class WorldLocation(Base):
    """
    Hierarchical node inside a World (`region`, `location`, `building`,
    `room`, `natural_area`). May optionally reference a reusable `Environment`
    without duplicating environment assets.
    """

    __tablename__ = "world_locations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    world_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("worlds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("world_locations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    environment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("environments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    location_type: Mapped[str] = mapped_column(
        String(80),
        default="location",
        nullable=False,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    world: Mapped["World"] = relationship(
        "World",
        back_populates="locations",
    )
    environment: Mapped[Optional["Environment"]] = relationship("Environment")

    __table_args__ = (
        Index(
            "ix_world_locations_world_parent_sort",
            "world_id",
            "parent_id",
            "sort_order",
        ),
    )


class EnvironmentGenerationJob(Base):
    """
    Audit and status tracking record for AI environment image generation jobs.
    """

    __tablename__ = "environment_generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    environment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
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
        default="queued",
        nullable=False,
        index=True,
    )
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
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

    environment: Mapped["Environment"] = relationship(
        "Environment",
        back_populates="generation_jobs",
    )

    __table_args__ = (
        Index(
            "ix_environment_generation_jobs_env_created",
            "environment_id",
            "created_at",
        ),
    )
