"""
Project management CRUD API routes.
All endpoints require authentication and enforce user ownership via ProjectService.
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import ProjectService

router = APIRouter()


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new animated story project",
)
def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ProjectResponse:
    service = ProjectService(db)
    project = service.create_project(current_user, payload)
    return ProjectResponse.model_validate(project)


@router.get(
    "",
    response_model=List[ProjectResponse],
    status_code=status.HTTP_200_OK,
    summary="List all projects belonging to the authenticated user",
)
def list_projects(
    current_user: CurrentUser,
    db: DbSession,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by project status"),
    search: Optional[str] = Query(None, description="Search by project title"),
) -> List[ProjectResponse]:
    service = ProjectService(db)
    projects = service.list_user_projects(
        current_user=current_user,
        status_filter=status_filter,
        search_query=search,
    )
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Get project details (owner only)",
)
def get_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> ProjectResponse:
    service = ProjectService(db)
    project = service.get_project_details(current_user, project_id)
    return ProjectResponse.model_validate(project)


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Update project details (owner only)",
)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ProjectResponse:
    service = ProjectService(db)
    project = service.update_project(current_user, project_id, payload)
    return ProjectResponse.model_validate(project)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Replace/update project details (owner only)",
)
def replace_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ProjectResponse:
    service = ProjectService(db)
    project = service.update_project(current_user, project_id, payload)
    return ProjectResponse.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project (owner only)",
)
def delete_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = ProjectService(db)
    service.delete_project(current_user, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
