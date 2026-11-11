"""Repository for Project persistence operations."""

import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import Project


class ProjectRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, project_id: uuid.UUID) -> Optional[Project]:
        stmt = select(Project).where(Project.id == project_id)
        return self.db.scalar(stmt)

    def list_by_owner(
        self,
        owner_id: uuid.UUID,
        status_filter: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> List[Project]:
        stmt = (
            select(Project)
            .where(Project.owner_id == owner_id)
            .order_by(Project.updated_at.desc())
        )
        if status_filter:
            stmt = stmt.where(Project.status == status_filter)
        if search_query:
            stmt = stmt.where(Project.title.ilike(f"%{search_query.strip()}%"))
        return list(self.db.scalars(stmt).all())

    def create(
        self,
        owner_id: uuid.UUID,
        title: str,
        description: Optional[str],
        status: str,
    ) -> Project:
        project = Project(
            owner_id=owner_id,
            title=title,
            description=description,
            status=status,
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def update(self, project: Project) -> Project:
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def delete(self, project: Project) -> None:
        self.db.delete(project)
        self.db.commit()
