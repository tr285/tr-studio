"""
REST API Endpoints for TR STUDIO Step 5 — Professional Scene Builder & Storyboard Studio.
"""

import uuid
from typing import List

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.scene import (
    SceneAIApplyProposalRequest,
    SceneAIGenerationProposalResponse,
    SceneAIGenerationRequest,
    SceneAssetAssignmentCreateRequest,
    SceneAssetAssignmentReorderRequest,
    SceneAssetAssignmentResponse,
    SceneAssetAssignmentUpdateRequest,
    SceneBuilderCreateRequest,
    SceneBuilderUpdateRequest,
    SceneCharacterAssignmentCreateRequest,
    SceneCharacterAssignmentReorderRequest,
    SceneCharacterAssignmentResponse,
    SceneCharacterAssignmentUpdateRequest,
    SceneDetailResponse,
    SceneEnvironmentAssignmentRequest,
    SceneGenerationJobResponse,
    SceneShotCreateRequest,
    SceneShotReorderRequest,
    SceneShotResponse,
    SceneShotUpdateRequest,
    SceneStorySyncResponse,
    StoryboardOverviewResponse,
)
from app.schemas.story import SceneReorderRequest
from app.services.scene_service import SceneService

project_scenes_router = APIRouter(
    prefix="/projects/{project_id}",
    tags=["Scene Builder & Storyboard Studio"],
)

scene_builder_router = APIRouter(
    prefix="/scene-builder",
    tags=["Scene Builder & Storyboard Studio"],
)

scene_shots_router = APIRouter(
    prefix="/scene-shots",
    tags=["Scene Shot List"],
)

scene_character_assignments_router = APIRouter(
    prefix="/scene-character-assignments",
    tags=["Scene Character Assignments"],
)

scene_asset_assignments_router = APIRouter(
    prefix="/scene-asset-assignments",
    tags=["Scene Asset Assignments"],
)

scene_jobs_router = APIRouter(
    prefix="/scene-generation-jobs",
    tags=["Scene Generation Jobs"],
)


# ---------------------------------------------------------------------------
# 1. Project-Scoped Scene Builder & Storyboard Endpoints
# ---------------------------------------------------------------------------


@project_scenes_router.get(
    "/scene-builder",
    response_model=List[SceneDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List all scenes with full composition, character, environment, asset, and shot details for a project",
)
def list_project_scenes(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneDetailResponse]:
    service = SceneService(db)
    return service.list_project_scenes(current_user, project_id)


@project_scenes_router.post(
    "/scene-builder",
    response_model=SceneDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new scene in the project's story",
)
def create_project_scene(
    project_id: uuid.UUID,
    payload: SceneBuilderCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneDetailResponse:
    service = SceneService(db)
    return service.create_scene(current_user, project_id, payload)


@project_scenes_router.post(
    "/scene-builder/reorder",
    response_model=List[SceneDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder scenes in the project's story",
)
def reorder_project_scenes(
    project_id: uuid.UUID,
    payload: SceneReorderRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneDetailResponse]:
    service = SceneService(db)
    return service.reorder_project_scenes(current_user, project_id, payload.scene_ids)


@project_scenes_router.post(
    "/scene-builder/sync",
    response_model=SceneStorySyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Synchronize scenes with Step 2 Story, Step 3 Characters, and Step 4 Environments",
)
def sync_project_scenes_with_story(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneStorySyncResponse:
    service = SceneService(db)
    return service.sync_scenes_with_story(current_user, project_id)


@project_scenes_router.post(
    "/scene-builder/ai-generate",
    response_model=SceneAIGenerationProposalResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI scene or shot-list proposals (non-destructive review by default)",
)
def generate_ai_scene_proposal(
    project_id: uuid.UUID,
    payload: SceneAIGenerationRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAIGenerationProposalResponse:
    service = SceneService(db)
    return service.generate_ai_scene_proposal(current_user, project_id, payload)


@project_scenes_router.post(
    "/scene-builder/ai-apply",
    response_model=List[SceneDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="Apply user-approved AI scene and shot-list proposals",
)
def apply_ai_scene_proposal(
    project_id: uuid.UUID,
    payload: SceneAIApplyProposalRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneDetailResponse]:
    service = SceneService(db)
    return service.apply_ai_scene_proposal(current_user, project_id, payload)


@project_scenes_router.get(
    "/storyboard",
    response_model=StoryboardOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve full storyboard overview and cards for a project",
)
def get_project_storyboard(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> StoryboardOverviewResponse:
    service = SceneService(db)
    return service.get_storyboard_overview(current_user, project_id)


@project_scenes_router.get(
    "/shots",
    response_model=List[SceneShotResponse],
    status_code=status.HTTP_200_OK,
    summary="List all planned shots across all scenes in the project",
)
def list_project_shots(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneShotResponse]:
    service = SceneService(db)
    return service.list_project_shots(current_user, project_id)


@project_scenes_router.get(
    "/scene-generation-jobs",
    response_model=List[SceneGenerationJobResponse],
    status_code=status.HTTP_200_OK,
    summary="List AI scene generation jobs for a project",
)
def list_project_scene_jobs(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneGenerationJobResponse]:
    service = SceneService(db)
    return service.list_project_scene_jobs(current_user, project_id)


# ---------------------------------------------------------------------------
# 2. Scene-Specific Composition, Environment, Character, Asset & Shot Endpoints
# ---------------------------------------------------------------------------


@scene_builder_router.get(
    "/{scene_id}",
    response_model=SceneDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full composition details for a single scene",
)
def get_scene_detail(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneDetailResponse:
    service = SceneService(db)
    return service.get_scene_detail(current_user, scene_id)


@scene_builder_router.patch(
    "/{scene_id}",
    response_model=SceneDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update scene metadata, staging, atmosphere, dialogue, narration, and directions",
)
def update_scene_detail(
    scene_id: uuid.UUID,
    payload: SceneBuilderUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneDetailResponse:
    service = SceneService(db)
    return service.update_scene(current_user, scene_id, payload)


@scene_builder_router.delete(
    "/{scene_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a scene, its shots and assignments, and renumber remaining scenes",
)
def delete_scene_detail(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = SceneService(db)
    service.delete_scene(current_user, scene_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scene_builder_router.post(
    "/{scene_id}/duplicate",
    response_model=SceneDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate a scene along with its character assignments, asset layers, and shots",
)
def duplicate_scene_detail(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneDetailResponse:
    service = SceneService(db)
    return service.duplicate_scene(current_user, scene_id)


@scene_builder_router.put(
    "/{scene_id}/environment",
    response_model=SceneDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Assign or clear a Step 4 Environment, WorldLocation, Variation, or Background Asset on a scene",
)
def assign_scene_environment(
    scene_id: uuid.UUID,
    payload: SceneEnvironmentAssignmentRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneDetailResponse:
    service = SceneService(db)
    return service.assign_environment(current_user, scene_id, payload)


@scene_builder_router.post(
    "/{scene_id}/characters",
    response_model=SceneCharacterAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a Step 3 Character or Step 2 StoryCharacter to a scene",
)
def add_scene_character_assignment(
    scene_id: uuid.UUID,
    payload: SceneCharacterAssignmentCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneCharacterAssignmentResponse:
    service = SceneService(db)
    return service.add_character_assignment(current_user, scene_id, payload)


@scene_builder_router.post(
    "/{scene_id}/characters/reorder",
    response_model=List[SceneCharacterAssignmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder character composition layers in a scene",
)
def reorder_scene_character_assignments(
    scene_id: uuid.UUID,
    payload: SceneCharacterAssignmentReorderRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneCharacterAssignmentResponse]:
    service = SceneService(db)
    return service.reorder_character_assignments(current_user, scene_id, payload)


@scene_builder_router.post(
    "/{scene_id}/assets",
    response_model=SceneAssetAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a background, foreground, prop, or overlay asset layer to a scene",
)
def add_scene_asset_assignment(
    scene_id: uuid.UUID,
    payload: SceneAssetAssignmentCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAssetAssignmentResponse:
    service = SceneService(db)
    return service.add_asset_assignment(current_user, scene_id, payload)


@scene_builder_router.post(
    "/{scene_id}/assets/reorder",
    response_model=List[SceneAssetAssignmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder visual asset layers in a scene",
)
def reorder_scene_asset_assignments(
    scene_id: uuid.UUID,
    payload: SceneAssetAssignmentReorderRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneAssetAssignmentResponse]:
    service = SceneService(db)
    return service.reorder_asset_assignments(current_user, scene_id, payload)


@scene_builder_router.get(
    "/{scene_id}/shots",
    response_model=List[SceneShotResponse],
    status_code=status.HTTP_200_OK,
    summary="List ordered shots for a specific scene",
)
def list_scene_shots(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneShotResponse]:
    service = SceneService(db)
    return service.list_scene_shots(current_user, scene_id)


@scene_builder_router.post(
    "/{scene_id}/shots",
    response_model=SceneShotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new shot in a scene's shot list",
)
def create_scene_shot(
    scene_id: uuid.UUID,
    payload: SceneShotCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneShotResponse:
    service = SceneService(db)
    return service.create_shot(current_user, scene_id, payload)


@scene_builder_router.post(
    "/{scene_id}/shots/reorder",
    response_model=List[SceneShotResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder shots within a scene",
)
def reorder_scene_shots(
    scene_id: uuid.UUID,
    payload: SceneShotReorderRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> List[SceneShotResponse]:
    service = SceneService(db)
    return service.reorder_shots(current_user, scene_id, payload)


# ---------------------------------------------------------------------------
# 3. Direct Item Endpoints (Shots, Character Assignments, Asset Assignments, Jobs)
# ---------------------------------------------------------------------------


@scene_shots_router.patch(
    "/{shot_id}",
    response_model=SceneShotResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a specific shot by ID",
)
def update_shot(
    shot_id: uuid.UUID,
    payload: SceneShotUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneShotResponse:
    service = SceneService(db)
    return service.update_shot(current_user, shot_id, payload)


@scene_shots_router.delete(
    "/{shot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a specific shot by ID and renumber remaining shots in the scene",
)
def delete_shot(
    shot_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = SceneService(db)
    service.delete_shot(current_user, shot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scene_character_assignments_router.patch(
    "/{assignment_id}",
    response_model=SceneCharacterAssignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a scene character assignment (expression, pose, outfit, placement, role)",
)
def update_character_assignment(
    assignment_id: uuid.UUID,
    payload: SceneCharacterAssignmentUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneCharacterAssignmentResponse:
    service = SceneService(db)
    return service.update_character_assignment(current_user, assignment_id, payload)


@scene_character_assignments_router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a character assignment from a scene",
)
def delete_character_assignment(
    assignment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = SceneService(db)
    service.delete_character_assignment(current_user, assignment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scene_asset_assignments_router.patch(
    "/{assignment_id}",
    response_model=SceneAssetAssignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a scene visual asset layer assignment",
)
def update_asset_assignment(
    assignment_id: uuid.UUID,
    payload: SceneAssetAssignmentUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAssetAssignmentResponse:
    service = SceneService(db)
    return service.update_asset_assignment(current_user, assignment_id, payload)


@scene_asset_assignments_router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a visual asset layer from a scene",
)
def delete_asset_assignment(
    assignment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = SceneService(db)
    service.delete_asset_assignment(current_user, assignment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@scene_jobs_router.get(
    "/{job_id}",
    response_model=SceneGenerationJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Get status and metadata for a specific AI scene generation job",
)
def get_scene_generation_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneGenerationJobResponse:
    service = SceneService(db)
    return service.get_scene_job(current_user, job_id)
