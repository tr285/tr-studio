"""Step 8 Professional Dialogue, Voice & Audio Studio tables and column extensions

Revision ID: 20261111_0007
Revises: 20261111_0006
Create Date: 2026-11-11 01:25:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261111_0007"
down_revision: Union[str, None] = "20261111_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(
        postgresql.JSONB(astext_type=sa.Text()), "postgresql"
    )

    # 1. Create audio_assets table
    op.create_table(
        "audio_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("sub_category", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("sample_rate", sa.Integer(), server_default="44100", nullable=False),
        sa.Column("channels", sa.Integer(), server_default="2", nullable=False),
        sa.Column("bitrate_kbps", sa.Integer(), nullable=True),
        sa.Column("waveform_data", json_type, nullable=True),
        sa.Column("source_type", sa.String(length=50), server_default="uploaded", nullable=False),
        sa.Column("licensing_notes", sa.Text(), nullable=True),
        sa.Column("metadata_json", json_type, nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audio_assets_id", "audio_assets", ["id"])
    op.create_index("ix_audio_assets_project_id", "audio_assets", ["project_id"])
    op.create_index("ix_audio_assets_category", "audio_assets", ["category"])
    op.create_index("ix_audio_project_category", "audio_assets", ["project_id", "category"])

    # 2. Create character_voice_profiles table
    op.create_table(
        "character_voice_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("voice_provider", sa.String(length=50), server_default="google", nullable=False),
        sa.Column("voice_id", sa.String(length=150), nullable=False),
        sa.Column("voice_name", sa.String(length=150), nullable=False),
        sa.Column("language", sa.String(length=50), server_default="en-US", nullable=False),
        sa.Column("accent", sa.String(length=100), nullable=True),
        sa.Column("voice_description", sa.Text(), nullable=True),
        sa.Column("speaking_speed", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("pitch", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("stability", sa.Float(), server_default="0.75", nullable=False),
        sa.Column("default_emotion", sa.String(length=100), nullable=True),
        sa.Column("settings_json", json_type, nullable=False),
        sa.Column("sample_audio_url", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("character_id"),
    )
    op.create_index("ix_character_voice_profiles_id", "character_voice_profiles", ["id"])
    op.create_index("ix_character_voice_profiles_character_id", "character_voice_profiles", ["character_id"])
    op.create_index("ix_character_voice_profiles_project_id", "character_voice_profiles", ["project_id"])
    op.create_index("ix_char_voice_project_char", "character_voice_profiles", ["project_id", "character_id"])

    # 3. Alter dialogue_entries table
    op.add_column("dialogue_entries", sa.Column("shot_id", sa.Uuid(), nullable=True))
    op.add_column("dialogue_entries", sa.Column("speaking_speed", sa.Float(), server_default="1.0", nullable=False))
    op.add_column("dialogue_entries", sa.Column("pause_duration_ms", sa.Integer(), server_default="0", nullable=False))
    op.add_column("dialogue_entries", sa.Column("pronunciation_notes", sa.Text(), nullable=True))
    op.add_column("dialogue_entries", sa.Column("audio_status", sa.String(length=50), server_default="pending", nullable=False))
    op.add_column("dialogue_entries", sa.Column("audio_asset_id", sa.Uuid(), nullable=True))
    op.add_column("dialogue_entries", sa.Column("start_ms", sa.Integer(), nullable=True))
    op.add_column("dialogue_entries", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_dialogue_entries_shot_id",
        "dialogue_entries",
        "scene_shots",
        ["shot_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_dialogue_entries_audio_asset_id",
        "dialogue_entries",
        "audio_assets",
        ["audio_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 4. Alter narration_entries table
    op.add_column("narration_entries", sa.Column("audio_status", sa.String(length=50), server_default="pending", nullable=False))
    op.add_column("narration_entries", sa.Column("audio_asset_id", sa.Uuid(), nullable=True))
    op.add_column("narration_entries", sa.Column("start_ms", sa.Integer(), nullable=True))
    op.add_column("narration_entries", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.add_column("narration_entries", sa.Column("language", sa.String(length=20), server_default="en-US", nullable=False))
    op.add_column("narration_entries", sa.Column("voice_settings", json_type, nullable=True))
    op.create_foreign_key(
        "fk_narration_entries_audio_asset_id",
        "narration_entries",
        "audio_assets",
        ["audio_asset_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 5. Create audio_generation_jobs table
    op.create_table(
        "audio_generation_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("dialogue_id", sa.Uuid(), nullable=True),
        sa.Column("narration_id", sa.Uuid(), nullable=True),
        sa.Column("character_id", sa.Uuid(), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("voice_id", sa.String(length=150), nullable=False),
        sa.Column("input_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("audio_asset_id", sa.Uuid(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("metadata_json", json_type, nullable=False),
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
        sa.ForeignKeyConstraint(["audio_asset_id"], ["audio_assets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["dialogue_id"], ["dialogue_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["narration_id"], ["narration_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audio_generation_jobs_id", "audio_generation_jobs", ["id"])
    op.create_index("ix_audio_generation_jobs_project_id", "audio_generation_jobs", ["project_id"])
    op.create_index("ix_audio_generation_jobs_status", "audio_generation_jobs", ["status"])
    op.create_index("ix_audio_job_project_status", "audio_generation_jobs", ["project_id", "status"])

    # 6. Create subtitle_tracks table
    op.create_table(
        "subtitle_tracks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=True),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("language", sa.String(length=20), server_default="en", nullable=False),
        sa.Column("name", sa.String(length=150), server_default="English (Main)", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="true", nullable=False),
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
        sa.ForeignKeyConstraint(["scene_id"], ["story_scenes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subtitle_tracks_id", "subtitle_tracks", ["id"])
    op.create_index("ix_subtitle_tracks_project_id", "subtitle_tracks", ["project_id"])

    # 7. Create subtitle_entries table
    op.create_table(
        "subtitle_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("track_id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("dialogue_id", sa.Uuid(), nullable=True),
        sa.Column("narration_id", sa.Uuid(), nullable=True),
        sa.Column("speaker_name", sa.String(length=150), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_ms", sa.Integer(), nullable=False),
        sa.Column("end_ms", sa.Integer(), nullable=False),
        sa.Column("entry_order", sa.Integer(), server_default="1", nullable=False),
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
        sa.ForeignKeyConstraint(["dialogue_id"], ["dialogue_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["narration_id"], ["narration_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["scene_id"], ["story_scenes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["track_id"], ["subtitle_tracks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subtitle_entries_id", "subtitle_entries", ["id"])
    op.create_index("ix_subtitle_entries_track_id", "subtitle_entries", ["track_id"])
    op.create_index("ix_sub_entry_track_order", "subtitle_entries", ["track_id", "entry_order"])


def downgrade() -> None:
    op.drop_table("subtitle_entries")
    op.drop_table("subtitle_tracks")
    op.drop_table("audio_generation_jobs")
    op.drop_constraint("fk_narration_entries_audio_asset_id", "narration_entries", type_="foreignkey")
    op.drop_column("narration_entries", "voice_settings")
    op.drop_column("narration_entries", "language")
    op.drop_column("narration_entries", "duration_ms")
    op.drop_column("narration_entries", "start_ms")
    op.drop_column("narration_entries", "audio_asset_id")
    op.drop_column("narration_entries", "audio_status")
    op.drop_constraint("fk_dialogue_entries_audio_asset_id", "dialogue_entries", type_="foreignkey")
    op.drop_constraint("fk_dialogue_entries_shot_id", "dialogue_entries", type_="foreignkey")
    op.drop_column("dialogue_entries", "duration_ms")
    op.drop_column("dialogue_entries", "start_ms")
    op.drop_column("dialogue_entries", "audio_asset_id")
    op.drop_column("dialogue_entries", "audio_status")
    op.drop_column("dialogue_entries", "pronunciation_notes")
    op.drop_column("dialogue_entries", "pause_duration_ms")
    op.drop_column("dialogue_entries", "speaking_speed")
    op.drop_column("dialogue_entries", "shot_id")
    op.drop_table("character_voice_profiles")
    op.drop_table("audio_assets")
