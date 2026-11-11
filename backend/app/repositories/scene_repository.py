"""
Repository Layer for TR STUDIO Step 5 — Professional Scene Builder & Storyboard Studio.
"""

import uuid
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.scene import (
    SceneAssetAssignment,
    SceneCharacterAssignment,
    SceneGenerationJob,
    SceneShot,
)
from app.models.story import StoryScene


class SceneRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # StoryScene Queries
    # ------------------------------------------------------------------

    def get_scene_by_id(self, scene_id: uuid.UUID) -> Optional[StoryScene]:
        stmt = select(StoryScene).where(StoryScene.id == scene_id)
        return self.db.scalar(stmt)

    def list_scenes_by_story(self, story_id: uuid.UUID) -> List[StoryScene]:
        stmt = (
            select(StoryScene)
            .where(StoryScene.story_id == story_id)
            .order_by(StoryScene.scene_number.asc(), StoryScene.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def save_scene(self, scene: StoryScene) -> StoryScene:
        self.db.add(scene)
        self.db.commit()
        self.db.refresh(scene)
        return scene

    def delete_scene_children(self, scene_id: uuid.UUID) -> None:
        self.db.execute(
            delete(SceneShot).where(SceneShot.scene_id == scene_id)
        )
        self.db.execute(
            delete(SceneCharacterAssignment).where(
                SceneCharacterAssignment.scene_id == scene_id
            )
        )
        self.db.execute(
            delete(SceneAssetAssignment).where(
                SceneAssetAssignment.scene_id == scene_id
            )
        )
        self.db.commit()

    # ------------------------------------------------------------------
    # SceneShot Queries
    # ------------------------------------------------------------------

    def list_shots_by_scene(self, scene_id: uuid.UUID) -> List[SceneShot]:
        stmt = (
            select(SceneShot)
            .where(SceneShot.scene_id == scene_id)
            .order_by(SceneShot.shot_number.asc(), SceneShot.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def list_shots_by_story(self, story_id: uuid.UUID) -> List[SceneShot]:
        stmt = (
            select(SceneShot)
            .where(SceneShot.story_id == story_id)
            .order_by(SceneShot.shot_number.asc(), SceneShot.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_shot_by_id(self, shot_id: uuid.UUID) -> Optional[SceneShot]:
        stmt = select(SceneShot).where(SceneShot.id == shot_id)
        return self.db.scalar(stmt)

    def create_shot(self, shot: SceneShot) -> SceneShot:
        self.db.add(shot)
        self.db.commit()
        self.db.refresh(shot)
        return shot

    def save_shot(self, shot: SceneShot) -> SceneShot:
        self.db.add(shot)
        self.db.commit()
        self.db.refresh(shot)
        return shot

    def delete_shot(self, shot: SceneShot) -> None:
        scene_id = shot.scene_id
        self.db.delete(shot)
        self.db.flush()
        remaining = self.list_shots_by_scene(scene_id)
        for idx, item in enumerate(remaining, start=1):
            item.shot_number = idx
            self.db.add(item)
        self.db.commit()

    # ------------------------------------------------------------------
    # SceneCharacterAssignment Queries
    # ------------------------------------------------------------------

    def list_character_assignments_by_scene(
        self, scene_id: uuid.UUID
    ) -> List[SceneCharacterAssignment]:
        stmt = (
            select(SceneCharacterAssignment)
            .where(SceneCharacterAssignment.scene_id == scene_id)
            .order_by(
                SceneCharacterAssignment.layer_order.asc(),
                SceneCharacterAssignment.created_at.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def list_character_assignments_by_story(
        self, story_id: uuid.UUID
    ) -> List[SceneCharacterAssignment]:
        stmt = (
            select(SceneCharacterAssignment)
            .where(SceneCharacterAssignment.story_id == story_id)
            .order_by(
                SceneCharacterAssignment.layer_order.asc(),
                SceneCharacterAssignment.created_at.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_character_assignment_by_id(
        self, assignment_id: uuid.UUID
    ) -> Optional[SceneCharacterAssignment]:
        stmt = select(SceneCharacterAssignment).where(
            SceneCharacterAssignment.id == assignment_id
        )
        return self.db.scalar(stmt)

    def create_character_assignment(
        self, assignment: SceneCharacterAssignment
    ) -> SceneCharacterAssignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def save_character_assignment(
        self, assignment: SceneCharacterAssignment
    ) -> SceneCharacterAssignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def delete_character_assignment(
        self, assignment: SceneCharacterAssignment
    ) -> None:
        self.db.delete(assignment)
        self.db.commit()

    # ------------------------------------------------------------------
    # SceneAssetAssignment Queries
    # ------------------------------------------------------------------

    def list_asset_assignments_by_scene(
        self, scene_id: uuid.UUID
    ) -> List[SceneAssetAssignment]:
        stmt = (
            select(SceneAssetAssignment)
            .where(SceneAssetAssignment.scene_id == scene_id)
            .order_by(
                SceneAssetAssignment.layer_order.asc(),
                SceneAssetAssignment.created_at.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def list_asset_assignments_by_story(
        self, story_id: uuid.UUID
    ) -> List[SceneAssetAssignment]:
        stmt = (
            select(SceneAssetAssignment)
            .where(SceneAssetAssignment.story_id == story_id)
            .order_by(
                SceneAssetAssignment.layer_order.asc(),
                SceneAssetAssignment.created_at.asc(),
            )
        )
        return list(self.db.scalars(stmt).all())

    def get_asset_assignment_by_id(
        self, assignment_id: uuid.UUID
    ) -> Optional[SceneAssetAssignment]:
        stmt = select(SceneAssetAssignment).where(
            SceneAssetAssignment.id == assignment_id
        )
        return self.db.scalar(stmt)

    def create_asset_assignment(
        self, assignment: SceneAssetAssignment
    ) -> SceneAssetAssignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def save_asset_assignment(
        self, assignment: SceneAssetAssignment
    ) -> SceneAssetAssignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def delete_asset_assignment(
        self, assignment: SceneAssetAssignment
    ) -> None:
        self.db.delete(assignment)
        self.db.commit()

    # ------------------------------------------------------------------
    # SceneGenerationJob Queries
    # ------------------------------------------------------------------

    def create_job(self, job: SceneGenerationJob) -> SceneGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def save_job(self, job: SceneGenerationJob) -> SceneGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_job_by_id(
        self, job_id: uuid.UUID
    ) -> Optional[SceneGenerationJob]:
        stmt = select(SceneGenerationJob).where(SceneGenerationJob.id == job_id)
        return self.db.scalar(stmt)

    def list_jobs_by_project(
        self, project_id: uuid.UUID
    ) -> List[SceneGenerationJob]:
        stmt = (
            select(SceneGenerationJob)
            .where(SceneGenerationJob.project_id == project_id)
            .order_by(SceneGenerationJob.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def list_jobs_by_story(
        self, story_id: uuid.UUID
    ) -> List[SceneGenerationJob]:
        stmt = (
            select(SceneGenerationJob)
            .where(SceneGenerationJob.story_id == story_id)
            .order_by(SceneGenerationJob.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())
