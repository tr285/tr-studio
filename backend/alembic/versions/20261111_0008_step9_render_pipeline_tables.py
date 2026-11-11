"""Step 9 Professional Video Rendering, Export & Production Pipeline tables

Revision ID: 20261111_0008
Revises: 20261111_0007
Create Date: 2026-11-11 09:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261111_0008"
down_revision: Union[str, None] = "20261111_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(
        postgresql.JSONB(astext_type=sa.Text()), "postgresql"
    )

    # 1. Create render_jobs table
    op.create_table(
        "render_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="queued", nullable=False),
        sa.Column("progress_pct", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("current_stage", sa.String(length=100), server_default="queued", nullable=False),
        sa.Column("total_frames", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rendered_frames", sa.Integer(), server_default="0", nullable=False),
        sa.Column("fps", sa.Integer(), server_default="24", nullable=False),
        sa.Column("resolution_width", sa.Integer(), server_default="1920", nullable=False),
        sa.Column("resolution_height", sa.Integer(), server_default="1080", nullable=False),
        sa.Column("aspect_ratio", sa.String(length=20), server_default="16:9", nullable=False),
        sa.Column("container_format", sa.String(length=20), server_default="mp4", nullable=False),
        sa.Column("video_codec", sa.String(length=50), server_default="h264", nullable=False),
        sa.Column("audio_codec", sa.String(length=50), server_default="aac", nullable=False),
        sa.Column("quality_preset", sa.String(length=50), server_default="standard", nullable=False),
        sa.Column("bitrate_kbps", sa.Integer(), nullable=True),
        sa.Column("include_audio", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("include_subtitles", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("burn_subtitles", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("subtitle_track_id", sa.Uuid(), nullable=True),
        sa.Column("export_range_type", sa.String(length=50), server_default="full", nullable=False),
        sa.Column("export_range_start_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("export_range_end_ms", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("output_file_path", sa.String(length=500), nullable=True),
        sa.Column("output_file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("render_logs", json_type, server_default="[]", nullable=False),
        sa.Column("settings_json", json_type, server_default="{}", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scene_id"], ["story_scenes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_render_jobs_id", "render_jobs", ["id"], unique=False)
    op.create_index("ix_render_jobs_project_id", "render_jobs", ["project_id"], unique=False)
    op.create_index("ix_render_jobs_owner_id", "render_jobs", ["owner_id"], unique=False)
    op.create_index("ix_render_jobs_scene_id", "render_jobs", ["scene_id"], unique=False)
    op.create_index("ix_render_jobs_status", "render_jobs", ["status"], unique=False)
    op.create_index("ix_render_job_project_status", "render_jobs", ["project_id", "status"], unique=False)
    op.create_index("ix_render_job_created_at", "render_jobs", ["created_at"], unique=False)

    # 2. Create render_outputs table
    op.create_table(
        "render_outputs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), server_default="video/mp4", nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("fps", sa.Integer(), nullable=False),
        sa.Column("aspect_ratio", sa.String(length=20), nullable=False),
        sa.Column("video_codec", sa.String(length=50), nullable=False),
        sa.Column("audio_codec", sa.String(length=50), nullable=True),
        sa.Column("has_audio", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("has_subtitles", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("metadata_json", json_type, server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["render_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scene_id"], ["story_scenes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id"),
    )
    op.create_index("ix_render_outputs_id", "render_outputs", ["id"], unique=False)
    op.create_index("ix_render_outputs_project_id", "render_outputs", ["project_id"], unique=False)
    op.create_index("ix_render_outputs_owner_id", "render_outputs", ["owner_id"], unique=False)
    op.create_index("ix_render_outputs_job_id", "render_outputs", ["job_id"], unique=True)
    op.create_index("ix_render_output_project_created", "render_outputs", ["project_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("render_outputs")
    op.drop_table("render_jobs")
