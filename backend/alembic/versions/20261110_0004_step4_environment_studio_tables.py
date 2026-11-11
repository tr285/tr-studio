"""Step 4 World and Environment Creation Studio tables

Revision ID: 20261110_0004
Revises: 20261110_0003
Create Date: 2026-11-10 22:42:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261110_0004"
down_revision: Union[str, None] = "20261110_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(
        postgresql.JSONB(astext_type=sa.Text()), "postgresql"
    )

    # 1. environments
    op.create_table(
        "environments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "category",
            sa.String(length=100),
            server_default="Natural",
            nullable=False,
        ),
        sa.Column(
            "art_style",
            sa.String(length=100),
            server_default="Anime",
            nullable=False,
        ),
        sa.Column("visual_mood", sa.String(length=150), nullable=True),
        sa.Column(
            "time_of_day",
            sa.String(length=80),
            server_default="Afternoon",
            nullable=False,
        ),
        sa.Column(
            "weather",
            sa.String(length=80),
            server_default="Clear",
            nullable=False,
        ),
        sa.Column("color_palette", json_type, nullable=False),
        sa.Column(
            "camera_perspective",
            sa.String(length=120),
            server_default="Wide establishing shot",
            nullable=False,
        ),
        sa.Column("metadata", json_type, nullable=False),
        sa.Column("default_asset_id", sa.Uuid(), nullable=True),
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
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_environments_id", "environments", ["id"], unique=False)
    op.create_index(
        "ix_environments_owner_id", "environments", ["owner_id"], unique=False
    )
    op.create_index(
        "ix_environments_project_id", "environments", ["project_id"], unique=False
    )
    op.create_index(
        "ix_environments_story_id", "environments", ["story_id"], unique=False
    )
    op.create_index("ix_environments_name", "environments", ["name"], unique=False)
    op.create_index(
        "ix_environments_category", "environments", ["category"], unique=False
    )
    op.create_index(
        "ix_environments_art_style", "environments", ["art_style"], unique=False
    )
    op.create_index(
        "ix_environments_owner_project",
        "environments",
        ["owner_id", "project_id"],
        unique=False,
    )
    op.create_index(
        "ix_environments_project_updated_at",
        "environments",
        ["project_id", "updated_at"],
        unique=False,
    )

    # 2. environment_assets
    op.create_table(
        "environment_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "asset_type",
            sa.String(length=80),
            server_default="concept",
            nullable=False,
        ),
        sa.Column("file_reference", sa.String(length=500), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(length=100), nullable=True),
        sa.Column(
            "generation_status",
            sa.String(length=50),
            server_default="completed",
            nullable=False,
        ),
        sa.Column("metadata", json_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["environment_id"], ["environments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_environment_assets_id", "environment_assets", ["id"], unique=False
    )
    op.create_index(
        "ix_environment_assets_environment_id",
        "environment_assets",
        ["environment_id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_assets_owner_id",
        "environment_assets",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_assets_asset_type",
        "environment_assets",
        ["asset_type"],
        unique=False,
    )
    op.create_index(
        "ix_environment_assets_generation_status",
        "environment_assets",
        ["generation_status"],
        unique=False,
    )
    op.create_index(
        "ix_environment_assets_env_type",
        "environment_assets",
        ["environment_id", "asset_type"],
        unique=False,
    )

    # 3. environment_variations
    op.create_table(
        "environment_variations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "variation_type",
            sa.String(length=80),
            server_default="time_of_day",
            nullable=False,
        ),
        sa.Column("asset_id", sa.Uuid(), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["environment_id"], ["environments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["environment_assets.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_environment_variations_id",
        "environment_variations",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_variations_environment_id",
        "environment_variations",
        ["environment_id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_variations_variation_type",
        "environment_variations",
        ["variation_type"],
        unique=False,
    )

    # 4. worlds
    op.create_table(
        "worlds",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", json_type, nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_worlds_id", "worlds", ["id"], unique=False)
    op.create_index("ix_worlds_owner_id", "worlds", ["owner_id"], unique=False)
    op.create_index("ix_worlds_project_id", "worlds", ["project_id"], unique=False)
    op.create_index("ix_worlds_name", "worlds", ["name"], unique=False)
    op.create_index(
        "ix_worlds_owner_project", "worlds", ["owner_id", "project_id"], unique=False
    )

    # 5. world_locations
    op.create_table(
        "world_locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("world_id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("environment_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column(
            "location_type",
            sa.String(length=80),
            server_default="location",
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "sort_order", sa.Integer(), server_default="0", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["world_id"], ["worlds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["world_locations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["environment_id"], ["environments.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_world_locations_id", "world_locations", ["id"], unique=False)
    op.create_index(
        "ix_world_locations_world_id", "world_locations", ["world_id"], unique=False
    )
    op.create_index(
        "ix_world_locations_parent_id",
        "world_locations",
        ["parent_id"],
        unique=False,
    )
    op.create_index(
        "ix_world_locations_environment_id",
        "world_locations",
        ["environment_id"],
        unique=False,
    )
    op.create_index(
        "ix_world_locations_location_type",
        "world_locations",
        ["location_type"],
        unique=False,
    )
    op.create_index(
        "ix_world_locations_world_parent_sort",
        "world_locations",
        ["world_id", "parent_id", "sort_order"],
        unique=False,
    )

    # 6. environment_generation_jobs
    op.create_table(
        "environment_generation_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("generation_type", sa.String(length=80), nullable=False),
        sa.Column(
            "status",
            sa.String(length=50),
            server_default="queued",
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=100), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["environment_id"], ["environments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_environment_generation_jobs_id",
        "environment_generation_jobs",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_generation_jobs_environment_id",
        "environment_generation_jobs",
        ["environment_id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_generation_jobs_owner_id",
        "environment_generation_jobs",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        "ix_environment_generation_jobs_generation_type",
        "environment_generation_jobs",
        ["generation_type"],
        unique=False,
    )
    op.create_index(
        "ix_environment_generation_jobs_status",
        "environment_generation_jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_environment_generation_jobs_env_created",
        "environment_generation_jobs",
        ["environment_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("environment_generation_jobs")
    op.drop_table("world_locations")
    op.drop_table("worlds")
    op.drop_table("environment_variations")
    op.drop_table("environment_assets")
    op.drop_table("environments")
