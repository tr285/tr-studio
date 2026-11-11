"""Step 3: Character Creation Studio tables (characters, character_assets, character_expressions, character_poses, character_outfits, character_generation_jobs).

Revision ID: 20261110_0003
Revises: 20261110_0002
Create Date: 2026-11-10 22:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20261110_0003"
down_revision: Union[str, None] = "20261110_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. characters
    op.create_table(
        "characters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("story_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("nickname", sa.String(length=150), nullable=True),
        sa.Column("role", sa.String(length=100), nullable=False, server_default="Main character"),
        sa.Column("species", sa.String(length=100), nullable=False, server_default="Human"),
        sa.Column("age_description", sa.String(length=100), nullable=True),
        sa.Column("personality", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("backstory", sa.Text(), nullable=True),
        sa.Column("motivation", sa.Text(), nullable=True),
        sa.Column("appearance_description", sa.Text(), nullable=True),
        sa.Column("canonical_reference_asset_id", sa.Uuid(), nullable=True),
        sa.Column("style", sa.String(length=100), nullable=False, server_default="Anime"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_characters_id"), "characters", ["id"], unique=False)
    op.create_index(op.f("ix_characters_owner_id"), "characters", ["owner_id"], unique=False)
    op.create_index(op.f("ix_characters_project_id"), "characters", ["project_id"], unique=False)
    op.create_index(op.f("ix_characters_story_id"), "characters", ["story_id"], unique=False)
    op.create_index(op.f("ix_characters_name"), "characters", ["name"], unique=False)
    op.create_index(op.f("ix_characters_role"), "characters", ["role"], unique=False)
    op.create_index(op.f("ix_characters_style"), "characters", ["style"], unique=False)
    op.create_index(op.f("ix_characters_canonical_reference_asset_id"), "characters", ["canonical_reference_asset_id"], unique=False)
    op.create_index("ix_characters_owner_project", "characters", ["owner_id", "project_id"], unique=False)
    op.create_index("ix_characters_project_updated", "characters", ["project_id", "updated_at"], unique=False)

    # 2. character_assets
    op.create_table(
        "character_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("asset_type", sa.String(length=80), nullable=False, server_default="concept"),
        sa.Column("file_reference", sa.String(length=500), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=True),
        sa.Column("generation_status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_character_assets_id"), "character_assets", ["id"], unique=False)
    op.create_index(op.f("ix_character_assets_character_id"), "character_assets", ["character_id"], unique=False)
    op.create_index(op.f("ix_character_assets_owner_id"), "character_assets", ["owner_id"], unique=False)
    op.create_index(op.f("ix_character_assets_asset_type"), "character_assets", ["asset_type"], unique=False)
    op.create_index(op.f("ix_character_assets_generation_status"), "character_assets", ["generation_status"], unique=False)
    op.create_index("ix_character_assets_char_type", "character_assets", ["character_id", "asset_type"], unique=False)

    # 3. character_expressions
    op.create_table(
        "character_expressions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("generation_status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("asset_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["character_assets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_character_expressions_id"), "character_expressions", ["id"], unique=False)
    op.create_index(op.f("ix_character_expressions_character_id"), "character_expressions", ["character_id"], unique=False)
    op.create_index(op.f("ix_character_expressions_asset_id"), "character_expressions", ["asset_id"], unique=False)

    # 4. character_poses
    op.create_table(
        "character_poses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False, server_default="Standing"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("generation_status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("asset_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["character_assets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_character_poses_id"), "character_poses", ["id"], unique=False)
    op.create_index(op.f("ix_character_poses_character_id"), "character_poses", ["character_id"], unique=False)
    op.create_index(op.f("ix_character_poses_asset_id"), "character_poses", ["asset_id"], unique=False)

    # 5. character_outfits
    op.create_table(
        "character_outfits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color_palette", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("accessories", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("generation_status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("asset_id", sa.Uuid(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["character_assets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_character_outfits_id"), "character_outfits", ["id"], unique=False)
    op.create_index(op.f("ix_character_outfits_character_id"), "character_outfits", ["character_id"], unique=False)
    op.create_index(op.f("ix_character_outfits_asset_id"), "character_outfits", ["asset_id"], unique=False)

    # 6. character_generation_jobs
    op.create_table(
        "character_generation_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("generation_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("provider", sa.String(length=80), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_character_generation_jobs_id"), "character_generation_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_character_generation_jobs_character_id"), "character_generation_jobs", ["character_id"], unique=False)
    op.create_index(op.f("ix_character_generation_jobs_owner_id"), "character_generation_jobs", ["owner_id"], unique=False)
    op.create_index(op.f("ix_character_generation_jobs_generation_type"), "character_generation_jobs", ["generation_type"], unique=False)
    op.create_index(op.f("ix_character_generation_jobs_status"), "character_generation_jobs", ["status"], unique=False)
    op.create_index("ix_char_gen_jobs_char_created", "character_generation_jobs", ["character_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("character_generation_jobs")
    op.drop_table("character_outfits")
    op.drop_table("character_poses")
    op.drop_table("character_expressions")
    op.drop_table("character_assets")
    op.drop_table("characters")
