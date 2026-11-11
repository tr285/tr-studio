"""
API v1 Endpoints for TR STUDIO Step 2 — AI Story Creation Engine.
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Query, Response, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.schemas.story import (
    AIProviderStatusResponse,
    ManualStoryCreateRequest,
    SceneCreateRequest,
    SceneReorderRequest,
    SceneUpdateRequest,
    StoryAIAssistProposalResponse,
    StoryAIAssistRequest,
    StoryCharacterData,
    StoryGenerationJobResponse,
    StoryGenerationRequest,
    StoryResponse,
    StorySceneData,
    StoryUpdateRequest,
    StoryVersionResponse,
)
from app.services.story_service import StoryService

stories_router = APIRouter()
scenes_router = APIRouter()


class CreateVersionRequest(BaseModel):
    label: Optional[str] = None


@stories_router.get(
    "/ai-status",
    response_model=AIProviderStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Check whether the backend AI Story Provider is configured",
)
def get_ai_provider_status(
    current_user: CurrentUser,
    db: DbSession,
) -> AIProviderStatusResponse:
    service = StoryService(db)
    return service.get_ai_status()


@stories_router.post(
    "/generate",
    response_model=StoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a complete animated story and screenplay via the configured AI provider",
)
def generate_story(
    payload: StoryGenerationRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryResponse:
    service = StoryService(db)
    return service.generate_story(current_user, payload)


@stories_router.post(
    "",
    response_model=StoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a manual or structured story record in PostgreSQL",
)
def create_story(
    payload: ManualStoryCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryResponse:
    service = StoryService(db)
    return service.create_manual_story(current_user, payload)


@stories_router.get(
    "/by-project/{project_id}",
    response_model=StoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve the story belonging to a specific project (owner only)",
)
def get_story_by_project(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryResponse:
    service = StoryService(db)
    return service.get_story_by_project(current_user, project_id)


@stories_router.get(
    "/jobs/{project_id}",
    response_model=List[StoryGenerationJobResponse],
    status_code=status.HTTP_200_OK,
    summary="List trackable story generation jobs for a project (owner only)",
)
def list_project_generation_jobs(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[StoryGenerationJobResponse]:
    service = StoryService(db)
    jobs = service.list_project_jobs(current_user, project_id)
    return [StoryGenerationJobResponse.model_validate(j) for j in jobs]


@stories_router.get(
    "/{story_id}",
    response_model=StoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete story details including characters, locations, scenes, and screenplay",
)
def get_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryResponse:
    service = StoryService(db)
    return service.get_story(current_user, story_id)


@stories_router.patch(
    "/{story_id}",
    response_model=StoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update story metadata, characters, locations, or scenes (supports autosave & versioned save)",
)
def update_story(
    story_id: uuid.UUID,
    payload: StoryUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryResponse:
    service = StoryService(db)
    return service.update_story(current_user, story_id, payload)


@stories_router.delete(
    "/{story_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a story (owner only)",
)
def delete_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = StoryService(db)
    service.delete_story(current_user, story_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@stories_router.post(
    "/{story_id}/continue",
    response_model=StoryAIAssistProposalResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Assistant: Continue the story with new scenes (returns non-destructive proposal by default)",
)
def continue_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    payload: Optional[StoryAIAssistRequest] = None,
) -> StoryAIAssistProposalResponse:
    req = payload or StoryAIAssistRequest(action="continue_story")
    req.action = "continue_story"
    service = StoryService(db)
    return service.run_ai_assist(current_user, story_id, req)


@stories_router.post(
    "/{story_id}/improve",
    response_model=StoryAIAssistProposalResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Assistant: Improve or transform the story (funny, emotional, suspense, twist, translate, etc.)",
)
def improve_story(
    story_id: uuid.UUID,
    payload: StoryAIAssistRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryAIAssistProposalResponse:
    service = StoryService(db)
    return service.run_ai_assist(current_user, story_id, payload)


@stories_router.post(
    "/{story_id}/rewrite",
    response_model=StoryAIAssistProposalResponse,
    status_code=status.HTTP_200_OK,
    summary="AI Assistant: Rewrite selected dialogue, character, or scene without overwriting until accepted",
)
def rewrite_story(
    story_id: uuid.UUID,
    payload: StoryAIAssistRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryAIAssistProposalResponse:
    service = StoryService(db)
    return service.run_ai_assist(current_user, story_id, payload)


@stories_router.get(
    "/{story_id}/characters",
    response_model=List[StoryCharacterData],
    status_code=status.HTTP_200_OK,
    summary="List characters for a story (owner only)",
)
def list_story_characters(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[StoryCharacterData]:
    service = StoryService(db)
    return service.list_characters(current_user, story_id)


@stories_router.get(
    "/{story_id}/scenes",
    response_model=List[StorySceneData],
    status_code=status.HTTP_200_OK,
    summary="List ordered scenes for a story (owner only)",
)
def list_story_scenes(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> List[StorySceneData]:
    service = StoryService(db)
    scenes = service.list_scenes(current_user, story_id)
    return scenes[skip : skip + limit]


@stories_router.post(
    "/{story_id}/scenes",
    response_model=StorySceneData,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new scene to a story (owner only)",
)
def create_story_scene(
    story_id: uuid.UUID,
    payload: SceneCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StorySceneData:
    service = StoryService(db)
    return service.add_scene(current_user, story_id, payload)


@stories_router.post(
    "/{story_id}/scenes/reorder",
    response_model=List[StorySceneData],
    status_code=status.HTTP_200_OK,
    summary="Reorder scenes in a story (owner only)",
)
def reorder_story_scenes(
    story_id: uuid.UUID,
    payload: SceneReorderRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> List[StorySceneData]:
    service = StoryService(db)
    return service.reorder_scenes(current_user, story_id, payload)


@stories_router.get(
    "/{story_id}/versions",
    response_model=List[StoryVersionResponse],
    status_code=status.HTTP_200_OK,
    summary="List saved version snapshots for a story (owner only)",
)
def list_story_versions(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[StoryVersionResponse]:
    service = StoryService(db)
    versions = service.list_story_versions(current_user, story_id)
    return [StoryVersionResponse.model_validate(v) for v in versions]


@stories_router.post(
    "/{story_id}/versions",
    response_model=StoryVersionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new named version snapshot of the current story state",
)
def create_story_version(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    payload: Optional[CreateVersionRequest] = None,
) -> StoryVersionResponse:
    service = StoryService(db)
    v = service.create_story_version(
        current_user,
        story_id,
        label=payload.label if payload else None,
    )
    return StoryVersionResponse.model_validate(v)


@stories_router.post(
    "/{story_id}/versions/{version_id}/restore",
    response_model=StoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Safely restore a story to a previous saved version",
)
def restore_story_version(
    story_id: uuid.UUID,
    version_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryResponse:
    service = StoryService(db)
    return service.restore_story_version(current_user, story_id, version_id)


# ------------------------------------------------------------------
# Direct /api/v1/scenes/{scene_id} Endpoints
# ------------------------------------------------------------------

@scenes_router.patch(
    "/{scene_id}",
    response_model=StorySceneData,
    status_code=status.HTTP_200_OK,
    summary="Update a specific scene by ID (owner only)",
)
def update_scene(
    scene_id: uuid.UUID,
    payload: SceneUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> StorySceneData:
    service = StoryService(db)
    return service.update_scene(current_user, scene_id, payload)


@scenes_router.delete(
    "/{scene_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a specific scene by ID and renumber remaining scenes (owner only)",
)
def delete_scene(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = StoryService(db)
    service.delete_scene(current_user, scene_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scenes_router.post(
    "/{scene_id}/duplicate",
    response_model=StorySceneData,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate a specific scene by ID (owner only)",
)
def duplicate_scene(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> StorySceneData:
    service = StoryService(db)
    return service.duplicate_scene(current_user, scene_id)
