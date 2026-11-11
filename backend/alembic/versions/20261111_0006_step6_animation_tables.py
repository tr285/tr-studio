"""Step 6 2D Animation Engine tables (scene_animations and animation_generation_jobs)

Revision ID: 20261111_0006
Revises: 20261110_0005
Create Date: 2026-11-11 00:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261111_0006"
down_revision: Union[str, None] = "20261110_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(
        postgresql.JSONB(astext_type=sa.Text()), "postgresql"
    )

    # 1. Create scene_animations table
    op.create_table(
        "scene_animations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("schema_version", sa.String(length=20), server_default="1.0", nullable=False),
        sa.Column("version_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("fps", sa.Integer(), server_default="24", nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="5000", nullable=False),
        sa.Column("width", sa.Integer(), server_default="1920", nullable=False),
        sa.Column("height", sa.Integer(), server_default="1080", nullable=False),
        sa.Column("document", json_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scene_id"),
    )
    op.create_index(
        "ix_scene_animations_id",
        "scene_animations",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_scene_animations_scene_id",
        "scene_animations",
        ["scene_id"],
        unique=True,
    )
    op.create_index(
        "ix_scene_animations_project_id",
        "scene_animations",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_scene_animations_story_id",
        "scene_animations",
        ["story_id"],
        unique=False,
    )
    op.create_index(
        "ix_scene_animations_owner_id",
        "scene_animations",
        ["owner_id"],
        unique=False,
    )

    # 2. Create animation_generation_jobs table
    op.create_table(
        "animation_generation_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("job_type", sa.String(length=80), server_default="animation_assist", nullable=False),
        sa.Column("status", sa.String(length=40), server_default="pending", nullable=False),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("prompt_summary", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_metadata", json_type, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_animation_jobs_id",
        "animation_generation_jobs",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_animation_jobs_project_id",
        "animation_generation_jobs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_animation_jobs_scene_id",
        "animation_generation_jobs",
        ["scene_id"],
        unique=False,
    )
    op.create_index(
        "ix_animation_jobs_status",
        "animation_generation_jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_animation_jobs_owner_id",
        "animation_generation_jobs",
        ["owner_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("animation_generation_jobs")
    op.drop_table("scene_animations")
