"""
Repository layer for TR STUDIO Step 3 — Character Creation Studio.
Provides database CRUD operations for:
- Character
- CharacterAsset
- CharacterExpression
- CharacterPose
- CharacterOutfit
- CharacterGenerationJob
"""

import uuid
from typing import List, Optional
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.character import (
    Character,
    CharacterAsset,
    CharacterExpression,
    CharacterGenerationJob,
    CharacterOutfit,
    CharacterPose,
)


class CharacterRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, character_id: uuid.UUID) -> Optional[Character]:
        stmt = (
            select(Character)
            .where(Character.id == character_id)
            .options(
                selectinload(Character.assets),
                selectinload(Character.expressions).selectinload(CharacterExpression.asset),
                selectinload(Character.poses).selectinload(CharacterPose.asset),
                selectinload(Character.outfits).selectinload(CharacterOutfit.asset),
                selectinload(Character.generation_jobs),
            )
        )
        return self.db.scalar(stmt)

    def list_for_owner(
        self,
        owner_id: uuid.UUID,
        project_id: Optional[uuid.UUID] = None,
        story_id: Optional[uuid.UUID] = None,
        role: Optional[str] = None,
        style: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Character]:
        stmt = (
            select(Character)
            .where(Character.owner_id == owner_id)
            .options(
                selectinload(Character.assets),
                selectinload(Character.expressions),
                selectinload(Character.poses),
                selectinload(Character.outfits),
            )
        )
        if project_id:
            stmt = stmt.where(Character.project_id == project_id)
        if story_id:
            stmt = stmt.where(Character.story_id == story_id)
        if role and role.strip():
            stmt = stmt.where(Character.role == role.strip())
        if style and style.strip():
            stmt = stmt.where(Character.style == style.strip())
        if search and search.strip():
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Character.name.ilike(q),
                    Character.nickname.ilike(q),
                    Character.role.ilike(q),
                    Character.species.ilike(q),
                    Character.appearance_description.ilike(q),
                )
            )
        stmt = stmt.order_by(Character.updated_at.desc()).offset(skip).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_asset_by_id(self, asset_id: uuid.UUID) -> Optional[CharacterAsset]:
        stmt = select(CharacterAsset).where(CharacterAsset.id == asset_id)
        return self.db.scalar(stmt)

    def list_assets(
        self,
        character_id: uuid.UUID,
        asset_type: Optional[str] = None,
    ) -> List[CharacterAsset]:
        stmt = select(CharacterAsset).where(CharacterAsset.character_id == character_id)
        if asset_type and asset_type.strip():
            stmt = stmt.where(CharacterAsset.asset_type == asset_type.strip())
        stmt = stmt.order_by(CharacterAsset.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def get_expression_by_id(
        self, expression_id: uuid.UUID
    ) -> Optional[CharacterExpression]:
        stmt = (
            select(CharacterExpression)
            .where(CharacterExpression.id == expression_id)
            .options(selectinload(CharacterExpression.asset))
        )
        return self.db.scalar(stmt)

    def list_expressions(self, character_id: uuid.UUID) -> List[CharacterExpression]:
        stmt = (
            select(CharacterExpression)
            .where(CharacterExpression.character_id == character_id)
            .options(selectinload(CharacterExpression.asset))
            .order_by(CharacterExpression.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_pose_by_id(self, pose_id: uuid.UUID) -> Optional[CharacterPose]:
        stmt = (
            select(CharacterPose)
            .where(CharacterPose.id == pose_id)
            .options(selectinload(CharacterPose.asset))
        )
        return self.db.scalar(stmt)

    def list_poses(self, character_id: uuid.UUID) -> List[CharacterPose]:
        stmt = (
            select(CharacterPose)
            .where(CharacterPose.character_id == character_id)
            .options(selectinload(CharacterPose.asset))
            .order_by(CharacterPose.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_outfit_by_id(self, outfit_id: uuid.UUID) -> Optional[CharacterOutfit]:
        stmt = (
            select(CharacterOutfit)
            .where(CharacterOutfit.id == outfit_id)
            .options(selectinload(CharacterOutfit.asset))
        )
        return self.db.scalar(stmt)

    def list_outfits(self, character_id: uuid.UUID) -> List[CharacterOutfit]:
        stmt = (
            select(CharacterOutfit)
            .where(CharacterOutfit.character_id == character_id)
            .options(selectinload(CharacterOutfit.asset))
            .order_by(CharacterOutfit.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def clear_default_outfits(self, character_id: uuid.UUID) -> None:
        self.db.execute(
            update(CharacterOutfit)
            .where(CharacterOutfit.character_id == character_id)
            .values(is_default=False)
        )

    def get_job_by_id(self, job_id: uuid.UUID) -> Optional[CharacterGenerationJob]:
        stmt = select(CharacterGenerationJob).where(CharacterGenerationJob.id == job_id)
        return self.db.scalar(stmt)

    def list_jobs(self, character_id: uuid.UUID) -> List[CharacterGenerationJob]:
        stmt = (
            select(CharacterGenerationJob)
            .where(CharacterGenerationJob.character_id == character_id)
            .order_by(CharacterGenerationJob.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())
