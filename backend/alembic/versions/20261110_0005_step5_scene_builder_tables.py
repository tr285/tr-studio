"""Step 5 Scene Builder and Storyboard Studio tables and columns

Revision ID: 20261110_0005
Revises: 20261110_0004
Create Date: 2026-11-10 23:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261110_0005"
down_revision: Union[str, None] = "20261110_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(
        postgresql.JSONB(astext_type=sa.Text()), "postgresql"
    )

    # 1. Extend story_scenes with Step 5 Scene Builder columns
    op.add_column(
        "story_scenes",
        sa.Column("environment_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "story_scenes",
        sa.Column("world_location_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "scene_type",
            sa.String(length=100),
            server_default="Narrative",
            nullable=False,
        ),
    )
    op.add_column(
        "story_scenes",
        sa.Column("summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "time_of_day",
            sa.String(length=80),
            server_default="Day",
            nullable=False,
        ),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "weather",
            sa.String(length=80),
            server_default="Clear",
            nullable=False,
        ),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "mood",
            sa.String(length=120),
            server_default="Cinematic",
            nullable=False,
        ),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "camera_framing",
            sa.String(length=120),
            server_default="Wide establishing shot",
            nullable=False,
        ),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "transition_type",
            sa.String(length=80),
            server_default="Cut",
            nullable=False,
        ),
    )
    op.add_column(
        "story_scenes",
        sa.Column("production_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "story_scenes",
        sa.Column(
            "scene_metadata",
            json_type,
            server_default="{}",
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_story_scenes_environment_id",
        "story_scenes",
        "environments",
        ["environment_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_story_scenes_world_location_id",
        "story_scenes",
        "world_locations",
        ["world_location_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_story_scenes_environment_id"),
        "story_scenes",
        ["environment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_story_scenes_world_location_id"),
        "story_scenes",
        ["world_location_id"],
        unique=False,
    )

    # 2. scene_shots
    op.create_table(
        "scene_shots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("shot_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "shot_type",
            sa.String(length=100),
            server_default="wide",
            nullable=False,
        ),
        sa.Column(
            "camera_perspective",
            sa.String(length=120),
            server_default="Wide establishing shot",
            nullable=False,
        ),
        sa.Column("character_focus", json_type, nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=True),
        sa.Column("visual_direction", sa.Text(), nullable=True),
        sa.Column(
            "duration_seconds",
            sa.Integer(),
            server_default="5",
            nullable=False,
        ),
        sa.Column("production_notes", sa.Text(), nullable=True),
        sa.Column("shot_metadata", json_type, nullable=False),
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
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["environment_id"], ["environments.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scene_shots_id"), "scene_shots", ["id"], unique=False)
    op.create_index(
        op.f("ix_scene_shots_scene_id"), "scene_shots", ["scene_id"], unique=False
    )
    op.create_index(
        op.f("ix_scene_shots_story_id"), "scene_shots", ["story_id"], unique=False
    )
    op.create_index(
        op.f("ix_scene_shots_project_id"), "scene_shots", ["project_id"], unique=False
    )
    op.create_index(
        op.f("ix_scene_shots_owner_id"), "scene_shots", ["owner_id"], unique=False
    )
    op.create_index(
        op.f("ix_scene_shots_environment_id"),
        "scene_shots",
        ["environment_id"],
        unique=False,
    )
    op.create_index(
        "ix_scene_shots_scene_id_shot_number",
        "scene_shots",
        ["scene_id", "shot_number"],
        unique=False,
    )

    # 3. scene_character_assignments
    op.create_table(
        "scene_character_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=True),
        sa.Column("story_character_id", sa.Uuid(), nullable=True),
        sa.Column("character_name", sa.String(length=160), nullable=False),
        sa.Column(
            "role_in_scene",
            sa.String(length=100),
            server_default="Lead",
            nullable=False,
        ),
        sa.Column("expression_id", sa.Uuid(), nullable=True),
        sa.Column("pose_id", sa.Uuid(), nullable=True),
        sa.Column("outfit_id", sa.Uuid(), nullable=True),
        sa.Column("asset_id", sa.Uuid(), nullable=True),
        sa.Column("layer_order", sa.Integer(), server_default="1", nullable=False),
        sa.Column("position_x", sa.Integer(), server_default="50", nullable=False),
        sa.Column("position_y", sa.Integer(), server_default="75", nullable=False),
        sa.Column("scale_percent", sa.Integer(), server_default="100", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["character_id"], ["characters.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["expression_id"], ["character_expressions.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["pose_id"], ["character_poses.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["outfit_id"], ["character_outfits.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["character_assets.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_scene_character_assignments_id"),
        "scene_character_assignments",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_character_assignments_scene_id"),
        "scene_character_assignments",
        ["scene_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_character_assignments_story_id"),
        "scene_character_assignments",
        ["story_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_character_assignments_project_id"),
        "scene_character_assignments",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_character_assignments_owner_id"),
        "scene_character_assignments",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_character_assignments_character_id"),
        "scene_character_assignments",
        ["character_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_character_assignments_story_character_id"),
        "scene_character_assignments",
        ["story_character_id"],
        unique=False,
    )
    op.create_index(
        "ix_scene_char_assignments_scene_layer",
        "scene_character_assignments",
        ["scene_id", "layer_order"],
        unique=False,
    )

    # 4. scene_asset_assignments
    op.create_table(
        "scene_asset_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "layer_type",
            sa.String(length=60),
            server_default="background",
            nullable=False,
        ),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("environment_asset_id", sa.Uuid(), nullable=True),
        sa.Column("character_asset_id", sa.Uuid(), nullable=True),
        sa.Column("layer_order", sa.Integer(), server_default="1", nullable=False),
        sa.Column("position_x", sa.Integer(), server_default="50", nullable=False),
        sa.Column("position_y", sa.Integer(), server_default="50", nullable=False),
        sa.Column("scale_percent", sa.Integer(), server_default="100", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("asset_metadata", json_type, nullable=False),
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
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["environment_asset_id"], ["environment_assets.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["character_asset_id"], ["character_assets.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_id"),
        "scene_asset_assignments",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_scene_id"),
        "scene_asset_assignments",
        ["scene_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_story_id"),
        "scene_asset_assignments",
        ["story_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_project_id"),
        "scene_asset_assignments",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_owner_id"),
        "scene_asset_assignments",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_environment_asset_id"),
        "scene_asset_assignments",
        ["environment_asset_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_asset_assignments_character_asset_id"),
        "scene_asset_assignments",
        ["character_asset_id"],
        unique=False,
    )
    op.create_index(
        "ix_scene_asset_assignments_scene_layer",
        "scene_asset_assignments",
        ["scene_id", "layer_order"],
        unique=False,
    )

    # 5. scene_generation_jobs
    op.create_table(
        "scene_generation_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "job_type",
            sa.String(length=80),
            server_default="generate_scenes",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=40),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("prompt_summary", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_metadata", json_type, nullable=False),
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
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_scene_generation_jobs_id"),
        "scene_generation_jobs",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_generation_jobs_project_id"),
        "scene_generation_jobs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_generation_jobs_story_id"),
        "scene_generation_jobs",
        ["story_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_generation_jobs_scene_id"),
        "scene_generation_jobs",
        ["scene_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_generation_jobs_owner_id"),
        "scene_generation_jobs",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scene_generation_jobs_status"),
        "scene_generation_jobs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("scene_generation_jobs")
    op.drop_table("scene_asset_assignments")
    op.drop_table("scene_character_assignments")
    op.drop_table("scene_shots")

    op.drop_index(op.f("ix_story_scenes_world_location_id"), table_name="story_scenes")
    op.drop_index(op.f("ix_story_scenes_environment_id"), table_name="story_scenes")
    op.drop_constraint(
        "fk_story_scenes_world_location_id", "story_scenes", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_story_scenes_environment_id", "story_scenes", type_="foreignkey"
    )
    op.drop_column("story_scenes", "scene_metadata")
    op.drop_column("story_scenes", "production_notes")
    op.drop_column("story_scenes", "transition_type")
    op.drop_column("story_scenes", "camera_framing")
    op.drop_column("story_scenes", "mood")
    op.drop_column("story_scenes", "weather")
    op.drop_column("story_scenes", "time_of_day")
    op.drop_column("story_scenes", "summary")
    op.drop_column("story_scenes", "scene_type")
    op.drop_column("story_scenes", "world_location_id")
    op.drop_column("story_scenes", "environment_id")
