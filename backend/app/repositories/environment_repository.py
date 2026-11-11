"""
Repository Layer for TR STUDIO Step 4 — World & Environment Creation Studio.
Provides SQLAlchemy 2.0 persistence operations for:
- `Environment`
- `EnvironmentAsset`
- `EnvironmentVariation`
- `EnvironmentGenerationJob`
- `World`
- `WorldLocation`
"""

from typing import List, Optional
import uuid

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.environment import (
    Environment,
    EnvironmentAsset,
    EnvironmentGenerationJob,
    EnvironmentVariation,
    World,
    WorldLocation,
)


class EnvironmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Environments
    # ------------------------------------------------------------------

    def create(self, env: Environment) -> Environment:
        self.db.add(env)
        self.db.commit()
        self.db.refresh(env)
        return self.get_by_id_with_relations(env.id) or env

    def get_by_id_with_relations(
        self, environment_id: uuid.UUID
    ) -> Optional[Environment]:
        stmt = (
            select(Environment)
            .where(Environment.id == environment_id)
            .options(
                selectinload(Environment.assets),
                selectinload(Environment.variations),
                selectinload(Environment.generation_jobs),
            )
        )
        return self.db.scalars(stmt).first()

    def list_by_owner(
        self,
        owner_id: uuid.UUID,
        project_id: Optional[uuid.UUID] = None,
        story_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        art_style: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Environment]:
        stmt = (
            select(Environment)
            .where(Environment.owner_id == owner_id)
            .options(
                selectinload(Environment.assets),
                selectinload(Environment.variations),
            )
        )
        if project_id:
            stmt = stmt.where(Environment.project_id == project_id)
        if story_id:
            stmt = stmt.where(Environment.story_id == story_id)
        if category and category.lower() != "all":
            stmt = stmt.where(Environment.category == category)
        if art_style and art_style.lower() != "all":
            stmt = stmt.where(Environment.art_style == art_style)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Environment.name.ilike(term),
                    Environment.description.ilike(term),
                    Environment.category.ilike(term),
                    Environment.visual_mood.ilike(term),
                )
            )
        stmt = stmt.order_by(Environment.updated_at.desc())
        return list(self.db.scalars(stmt).all())

    def save(self, env: Environment) -> Environment:
        self.db.add(env)
        self.db.commit()
        self.db.refresh(env)
        return self.get_by_id_with_relations(env.id) or env

    def delete(self, env: Environment) -> None:
        self.db.delete(env)
        self.db.commit()

    # ------------------------------------------------------------------
    # Assets
    # ------------------------------------------------------------------

    def create_asset(self, asset: EnvironmentAsset) -> EnvironmentAsset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def get_asset_by_id(
        self, asset_id: uuid.UUID
    ) -> Optional[EnvironmentAsset]:
        stmt = select(EnvironmentAsset).where(EnvironmentAsset.id == asset_id)
        return self.db.scalars(stmt).first()

    def list_assets(
        self,
        environment_id: uuid.UUID,
        asset_type: Optional[str] = None,
    ) -> List[EnvironmentAsset]:
        stmt = select(EnvironmentAsset).where(
            EnvironmentAsset.environment_id == environment_id
        )
        if asset_type and asset_type.lower() != "all":
            stmt = stmt.where(EnvironmentAsset.asset_type == asset_type)
        stmt = stmt.order_by(EnvironmentAsset.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def save_asset(self, asset: EnvironmentAsset) -> EnvironmentAsset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete_asset(self, asset: EnvironmentAsset) -> None:
        self.db.delete(asset)
        self.db.commit()

    # ------------------------------------------------------------------
    # Variations
    # ------------------------------------------------------------------

    def create_variation(
        self, variation: EnvironmentVariation
    ) -> EnvironmentVariation:
        self.db.add(variation)
        self.db.commit()
        self.db.refresh(variation)
        return variation

    def get_variation_by_id(
        self, variation_id: uuid.UUID
    ) -> Optional[EnvironmentVariation]:
        stmt = select(EnvironmentVariation).where(
            EnvironmentVariation.id == variation_id
        )
        return self.db.scalars(stmt).first()

    def list_variations(
        self, environment_id: uuid.UUID
    ) -> List[EnvironmentVariation]:
        stmt = (
            select(EnvironmentVariation)
            .where(EnvironmentVariation.environment_id == environment_id)
            .order_by(EnvironmentVariation.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def clear_default_variations(self, environment_id: uuid.UUID) -> None:
        stmt = (
            update(EnvironmentVariation)
            .where(EnvironmentVariation.environment_id == environment_id)
            .values(is_default=False)
        )
        self.db.execute(stmt)
        self.db.commit()

    def save_variation(
        self, variation: EnvironmentVariation
    ) -> EnvironmentVariation:
        self.db.add(variation)
        self.db.commit()
        self.db.refresh(variation)
        return variation

    def delete_variation(self, variation: EnvironmentVariation) -> None:
        self.db.delete(variation)
        self.db.commit()

    # ------------------------------------------------------------------
    # Generation Jobs
    # ------------------------------------------------------------------

    def create_job(
        self, job: EnvironmentGenerationJob
    ) -> EnvironmentGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_job_by_id(
        self, job_id: uuid.UUID
    ) -> Optional[EnvironmentGenerationJob]:
        stmt = select(EnvironmentGenerationJob).where(
            EnvironmentGenerationJob.id == job_id
        )
        return self.db.scalars(stmt).first()

    def list_jobs(
        self, environment_id: uuid.UUID
    ) -> List[EnvironmentGenerationJob]:
        stmt = (
            select(EnvironmentGenerationJob)
            .where(EnvironmentGenerationJob.environment_id == environment_id)
            .order_by(EnvironmentGenerationJob.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def save_job(
        self, job: EnvironmentGenerationJob
    ) -> EnvironmentGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    # ------------------------------------------------------------------
    # Worlds & WorldLocations
    # ------------------------------------------------------------------

    def create_world(self, world: World) -> World:
        self.db.add(world)
        self.db.commit()
        self.db.refresh(world)
        return self.get_world_by_id(world.id) or world

    def get_world_by_id(self, world_id: uuid.UUID) -> Optional[World]:
        stmt = (
            select(World)
            .where(World.id == world_id)
            .options(
                selectinload(World.locations).selectinload(
                    WorldLocation.environment
                )
            )
        )
        return self.db.scalars(stmt).first()

    def list_worlds_by_owner(
        self,
        owner_id: uuid.UUID,
        project_id: Optional[uuid.UUID] = None,
    ) -> List[World]:
        stmt = (
            select(World)
            .where(World.owner_id == owner_id)
            .options(
                selectinload(World.locations).selectinload(
                    WorldLocation.environment
                )
            )
        )
        if project_id:
            stmt = stmt.where(World.project_id == project_id)
        stmt = stmt.order_by(World.updated_at.desc())
        return list(self.db.scalars(stmt).all())

    def save_world(self, world: World) -> World:
        self.db.add(world)
        self.db.commit()
        self.db.refresh(world)
        return self.get_world_by_id(world.id) or world

    def delete_world(self, world: World) -> None:
        self.db.delete(world)
        self.db.commit()

    def create_world_location(
        self, loc: WorldLocation
    ) -> WorldLocation:
        self.db.add(loc)
        self.db.commit()
        self.db.refresh(loc)
        return loc

    def get_world_location_by_id(
        self, location_id: uuid.UUID
    ) -> Optional[WorldLocation]:
        stmt = (
            select(WorldLocation)
            .where(WorldLocation.id == location_id)
            .options(selectinload(WorldLocation.environment))
        )
        return self.db.scalars(stmt).first()

    def save_world_location(
        self, loc: WorldLocation
    ) -> WorldLocation:
        self.db.add(loc)
        self.db.commit()
        self.db.refresh(loc)
        return loc

    def delete_world_location(self, loc: WorldLocation) -> None:
        self.db.delete(loc)
        self.db.commit()
