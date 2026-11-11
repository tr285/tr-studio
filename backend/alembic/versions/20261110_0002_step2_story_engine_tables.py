"""Step 2 AI Story Creation Engine tables

Revision ID: 20261110_0002
Revises: 20261110_0001
Create Date: 2026-11-10 20:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20261110_0002"
down_revision: Union[str, None] = "20261110_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSONBType = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    # 1. stories
    op.create_table(
        "stories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("schema_version", sa.String(length=20), server_default="1.0", nullable=False),
        sa.Column("idea", sa.Text(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("logline", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("full_plot", sa.Text(), nullable=True),
        sa.Column("beginning", sa.Text(), nullable=True),
        sa.Column("middle", sa.Text(), nullable=True),
        sa.Column("ending_act", sa.Text(), nullable=True),
        sa.Column("genre", sa.String(length=100), nullable=False),
        sa.Column("animation_style", sa.String(length=100), nullable=False),
        sa.Column("target_audience", sa.String(length=100), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=80), nullable=False),
        sa.Column("main_character_count", sa.Integer(), nullable=False),
        sa.Column("tone", sa.String(length=100), nullable=False),
        sa.Column("complexity", sa.String(length=50), nullable=False),
        sa.Column("ending_type", sa.String(length=100), nullable=False),
        sa.Column("additional_instructions", sa.Text(), nullable=True),
        sa.Column("themes", JSONBType, nullable=False),
        sa.Column("world_description", sa.Text(), nullable=True),
        sa.Column("structured_data", JSONBType, nullable=False),
        sa.Column("current_version_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_stories_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_stories_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stories")),
    )
    op.create_index(op.f("ix_stories_id"), "stories", ["id"], unique=False)
    op.create_index(op.f("ix_stories_project_id"), "stories", ["project_id"], unique=True)
    op.create_index(op.f("ix_stories_owner_id"), "stories", ["owner_id"], unique=False)
    op.create_index(op.f("ix_stories_title"), "stories", ["title"], unique=False)

    # 2. story_versions
    op.create_table(
        "story_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("snapshot", JSONBType, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
            name=op.f("fk_story_versions_story_id_stories"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_story_versions")),
    )
    op.create_index(op.f("ix_story_versions_id"), "story_versions", ["id"], unique=False)
    op.create_index(op.f("ix_story_versions_story_id"), "story_versions", ["story_id"], unique=False)
    op.create_index(
        "ix_story_versions_story_id_version_number",
        "story_versions",
        ["story_id", "version_number"],
        unique=False,
    )

    # 3. story_characters
    op.create_table(
        "story_characters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("role", sa.String(length=100), nullable=False),
        sa.Column("age_description", sa.String(length=100), nullable=True),
        sa.Column("personality", JSONBType, nullable=False),
        sa.Column("appearance_description", sa.Text(), nullable=True),
        sa.Column("motivation", sa.Text(), nullable=True),
        sa.Column("backstory", sa.Text(), nullable=True),
        sa.Column("relationships_data", JSONBType, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
            name=op.f("fk_story_characters_story_id_stories"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_story_characters")),
    )
    op.create_index(op.f("ix_story_characters_id"), "story_characters", ["id"], unique=False)
    op.create_index(op.f("ix_story_characters_story_id"), "story_characters", ["story_id"], unique=False)

    # 4. character_relationships
    op.create_table(
        "character_relationships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("source_character_id", sa.Uuid(), nullable=True),
        sa.Column("target_character_id", sa.Uuid(), nullable=True),
        sa.Column("source_character_name", sa.String(length=150), nullable=False),
        sa.Column("target_character_name", sa.String(length=150), nullable=False),
        sa.Column("relationship_type", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
            name=op.f("fk_character_relationships_story_id_stories"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_character_id"],
            ["story_characters.id"],
            name=op.f("fk_character_relationships_source_character_id_story_characters"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["target_character_id"],
            ["story_characters.id"],
            name=op.f("fk_character_relationships_target_character_id_story_characters"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_character_relationships")),
    )
    op.create_index(op.f("ix_character_relationships_id"), "character_relationships", ["id"], unique=False)
    op.create_index(op.f("ix_character_relationships_story_id"), "character_relationships", ["story_id"], unique=False)

    # 5. story_locations
    op.create_table(
        "story_locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("atmosphere", sa.String(length=150), nullable=True),
        sa.Column("time_of_day", sa.String(length=100), nullable=True),
        sa.Column("environment_requirements", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
            name=op.f("fk_story_locations_story_id_stories"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_story_locations")),
    )
    op.create_index(op.f("ix_story_locations_id"), "story_locations", ["id"], unique=False)
    op.create_index(op.f("ix_story_locations_story_id"), "story_locations", ["story_id"], unique=False)

    # 6. story_scenes
    op.create_table(
        "story_scenes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=True),
        sa.Column("location_name", sa.String(length=200), nullable=True),
        sa.Column("scene_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("scene_heading", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_description", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("characters", JSONBType, nullable=False),
        sa.Column("camera_directions", JSONBType, nullable=False),
        sa.Column("audio_directions", JSONBType, nullable=False),
        sa.Column("visual_directions", JSONBType, nullable=False),
        sa.Column("emotional_directions", JSONBType, nullable=False),
        sa.Column("storyboard_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
            name=op.f("fk_story_scenes_story_id_stories"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["story_locations.id"],
            name=op.f("fk_story_scenes_location_id_story_locations"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_story_scenes")),
    )
    op.create_index(op.f("ix_story_scenes_id"), "story_scenes", ["id"], unique=False)
    op.create_index(op.f("ix_story_scenes_story_id"), "story_scenes", ["story_id"], unique=False)
    op.create_index(
        "ix_story_scenes_story_id_scene_number",
        "story_scenes",
        ["story_id", "scene_number"],
        unique=False,
    )

    # 7. dialogue_entries
    op.create_table(
        "dialogue_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=True),
        sa.Column("character_name", sa.String(length=150), nullable=False),
        sa.Column("line", sa.Text(), nullable=False),
        sa.Column("emotion", sa.String(length=100), nullable=True),
        sa.Column("delivery_direction", sa.String(length=200), nullable=True),
        sa.Column("line_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["scene_id"],
            ["story_scenes.id"],
            name=op.f("fk_dialogue_entries_scene_id_story_scenes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["character_id"],
            ["story_characters.id"],
            name=op.f("fk_dialogue_entries_character_id_story_characters"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_dialogue_entries")),
    )
    op.create_index(op.f("ix_dialogue_entries_id"), "dialogue_entries", ["id"], unique=False)
    op.create_index(op.f("ix_dialogue_entries_scene_id"), "dialogue_entries", ["scene_id"], unique=False)

    # 8. narration_entries
    op.create_table(
        "narration_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
        sa.Column("narrator_voice", sa.String(length=100), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("emotion", sa.String(length=100), nullable=True),
        sa.Column("entry_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["scene_id"],
            ["story_scenes.id"],
            name=op.f("fk_narration_entries_scene_id_story_scenes"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_narration_entries")),
    )
    op.create_index(op.f("ix_narration_entries_id"), "narration_entries", ["id"], unique=False)
    op.create_index(op.f("ix_narration_entries_scene_id"), "narration_entries", ["scene_id"], unique=False)

    # 9. story_generation_jobs
    op.create_table(
        "story_generation_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("job_type", sa.String(length=60), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("current_step", sa.String(length=150), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("request_payload", JSONBType, nullable=False),
        sa.Column("result_payload", JSONBType, nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_story_generation_jobs_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
            name=op.f("fk_story_generation_jobs_story_id_stories"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_story_generation_jobs_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_story_generation_jobs")),
    )
    op.create_index(op.f("ix_story_generation_jobs_id"), "story_generation_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_story_generation_jobs_project_id"), "story_generation_jobs", ["project_id"], unique=False)
    op.create_index(op.f("ix_story_generation_jobs_story_id"), "story_generation_jobs", ["story_id"], unique=False)
    op.create_index(op.f("ix_story_generation_jobs_owner_id"), "story_generation_jobs", ["owner_id"], unique=False)
    op.create_index(op.f("ix_story_generation_jobs_status"), "story_generation_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_story_generation_jobs_status"), table_name="story_generation_jobs")
    op.drop_index(op.f("ix_story_generation_jobs_owner_id"), table_name="story_generation_jobs")
    op.drop_index(op.f("ix_story_generation_jobs_story_id"), table_name="story_generation_jobs")
    op.drop_index(op.f("ix_story_generation_jobs_project_id"), table_name="story_generation_jobs")
    op.drop_index(op.f("ix_story_generation_jobs_id"), table_name="story_generation_jobs")
    op.drop_table("story_generation_jobs")

    op.drop_index(op.f("ix_narration_entries_scene_id"), table_name="narration_entries")
    op.drop_index(op.f("ix_narration_entries_id"), table_name="narration_entries")
    op.drop_table("narration_entries")

    op.drop_index(op.f("ix_dialogue_entries_scene_id"), table_name="dialogue_entries")
    op.drop_index(op.f("ix_dialogue_entries_id"), table_name="dialogue_entries")
    op.drop_table("dialogue_entries")

    op.drop_index("ix_story_scenes_story_id_scene_number", table_name="story_scenes")
    op.drop_index(op.f("ix_story_scenes_story_id"), table_name="story_scenes")
    op.drop_index(op.f("ix_story_scenes_id"), table_name="story_scenes")
    op.drop_table("story_scenes")

    op.drop_index(op.f("ix_story_locations_story_id"), table_name="story_locations")
    op.drop_index(op.f("ix_story_locations_id"), table_name="story_locations")
    op.drop_table("story_locations")

    op.drop_index(op.f("ix_character_relationships_story_id"), table_name="character_relationships")
    op.drop_index(op.f("ix_character_relationships_id"), table_name="character_relationships")
    op.drop_table("character_relationships")

    op.drop_index(op.f("ix_story_characters_story_id"), table_name="story_characters")
    op.drop_index(op.f("ix_story_characters_id"), table_name="story_characters")
    op.drop_table("story_characters")

    op.drop_index("ix_story_versions_story_id_version_number", table_name="story_versions")
    op.drop_index(op.f("ix_story_versions_story_id"), table_name="story_versions")
    op.drop_index(op.f("ix_story_versions_id"), table_name="story_versions")
    op.drop_table("story_versions")

    op.drop_index(op.f("ix_stories_title"), table_name="stories")
    op.drop_index(op.f("ix_stories_owner_id"), table_name="stories")
    op.drop_index(op.f("ix_stories_project_id"), table_name="stories")
    op.drop_index(op.f("ix_stories_id"), table_name="stories")
    op.drop_table("stories")
