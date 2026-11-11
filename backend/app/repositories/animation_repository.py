"""
Database Repository for TR STUDIO Step 6 — Professional 2D Animation Engine.
"""

from typing import List, Optional
import uuid

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.animation import AnimationGenerationJob, SceneAnimation


class AnimationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_animation_by_scene_id(self, scene_id: uuid.UUID) -> Optional[SceneAnimation]:
        stmt = select(SceneAnimation).where(SceneAnimation.scene_id == scene_id)
        return self.db.execute(stmt).scalars().first()

    def get_animation_by_id(self, animation_id: uuid.UUID) -> Optional[SceneAnimation]:
        return self.db.get(SceneAnimation, animation_id)

    def list_animations_by_story(self, story_id: uuid.UUID) -> List[SceneAnimation]:
        stmt = (
            select(SceneAnimation)
            .where(SceneAnimation.story_id == story_id)
            .order_by(SceneAnimation.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def save_animation(self, animation: SceneAnimation) -> SceneAnimation:
        self.db.add(animation)
        self.db.commit()
        self.db.refresh(animation)
        return animation

    def delete_animation(self, animation: SceneAnimation) -> None:
        self.db.delete(animation)
        self.db.commit()

    def get_job_by_id(self, job_id: uuid.UUID) -> Optional[AnimationGenerationJob]:
        return self.db.get(AnimationGenerationJob, job_id)

    def list_jobs_by_project(self, project_id: uuid.UUID) -> List[AnimationGenerationJob]:
        stmt = (
            select(AnimationGenerationJob)
            .where(AnimationGenerationJob.project_id == project_id)
            .order_by(desc(AnimationGenerationJob.created_at))
        )
        return list(self.db.execute(stmt).scalars().all())

    def create_job(self, job: AnimationGenerationJob) -> AnimationGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def save_job(self, job: AnimationGenerationJob) -> AnimationGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job
