"""
Project management service enforcing strict ownership checks on every operation.
A user must never access, modify, or delete another user's project.
"""

import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.logging import logger
from app.models.project import Project
from app.models.user import User
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    def __init__(self, db: Session) -> None:
        self.project_repo = ProjectRepository(db)

    def _get_owned_project_or_raise(self, project_id: uuid.UUID, current_user: User) -> Project:
        project = self.project_repo.get_by_id(project_id)
        if project is None:
            raise NotFoundException(f"Project '{project_id}' was not found.")
        if project.owner_id != current_user.id:
            logger.warning(
                "Unauthorized project access attempt: user=%s tried to access project=%s owned by=%s",
                current_user.id,
                project.id,
                project.owner_id,
            )
            raise ForbiddenException("You do not have permission to access this project.")
        return project

    def create_project(self, current_user: User, payload: ProjectCreate) -> Project:
        project = self.project_repo.create(
            owner_id=current_user.id,
            title=payload.title,
            description=payload.description,
            status=payload.status.value,
        )
        logger.info("Created project id=%s owner=%s title=%r", project.id, current_user.id, project.title)
        return project

    def list_user_projects(
        self,
        current_user: User,
        status_filter: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> List[Project]:
        return self.project_repo.list_by_owner(
            owner_id=current_user.id,
            status_filter=status_filter,
            search_query=search_query,
        )

    def get_project_details(self, current_user: User, project_id: uuid.UUID) -> Project:
        return self._get_owned_project_or_raise(project_id, current_user)

    def update_project(
        self,
        current_user: User,
        project_id: uuid.UUID,
        payload: ProjectUpdate,
    ) -> Project:
        project = self._get_owned_project_or_raise(project_id, current_user)

        if payload.title is not None:
            project.title = payload.title
        if "description" in payload.model_fields_set:
            project.description = payload.description
        if payload.status is not None:
            project.status = payload.status.value

        updated = self.project_repo.update(project)
        logger.info("Updated project id=%s owner=%s", updated.id, current_user.id)
        return updated

    def delete_project(self, current_user: User, project_id: uuid.UUID) -> None:
        project = self._get_owned_project_or_raise(project_id, current_user)
        self.project_repo.delete(project)
        logger.info("Deleted project id=%s owner=%s", project_id, current_user.id)
