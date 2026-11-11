"""
REST API Endpoints for TR STUDIO Step 6 — Professional 2D Animation Engine.
"""

from typing import List
import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.animation import (
    AnimationAIAssistProposalResponse,
    AnimationAIAssistRequest,
    AnimationAIApplyProposalRequest,
    AnimationApplyPresetRequest,
    AnimationGenerationJobResponse,
    AnimationPresetResponse,
    SceneAnimationResponse,
    SceneAnimationSaveRequest,
)
from app.services.animation_service import AnimationService

animation_router = APIRouter(tags=["2D Animation Engine"])


# ---------------------------------------------------------------------------
# 1. Presets
# ---------------------------------------------------------------------------
@animation_router.get(
    "/animation/presets",
    response_model=List[AnimationPresetResponse],
    status_code=status.HTTP_200_OK,
    summary="List all available 2D animation and camera presets",
)
def list_animation_presets(
    db: DbSession,
) -> List[AnimationPresetResponse]:
    service = AnimationService(db)
    return service.list_presets()


# ---------------------------------------------------------------------------
# 2. Scene Animation CRUD & Reset
# ---------------------------------------------------------------------------
@animation_router.get(
    "/scenes/{scene_id}/animation",
    response_model=SceneAnimationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get or initialize the 2D Animation Document for a scene",
)
def get_scene_animation(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAnimationResponse:
    service = AnimationService(db)
    return service.get_or_create_scene_animation(current_user, scene_id)


@animation_router.put(
    "/scenes/{scene_id}/animation",
    response_model=SceneAnimationResponse,
    status_code=status.HTTP_200_OK,
    summary="Save the 2D Animation Document for a scene with version concurrency protection",
)
def save_scene_animation(
    scene_id: uuid.UUID,
    payload: SceneAnimationSaveRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAnimationResponse:
    service = AnimationService(db)
    return service.save_scene_animation(current_user, scene_id, payload)


@animation_router.post(
    "/scenes/{scene_id}/animation/reset",
    response_model=SceneAnimationResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset animation document to match the latest Step 5 scene composition",
)
def reset_scene_animation(
    scene_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAnimationResponse:
    service = AnimationService(db)
    return service.reset_scene_animation(current_user, scene_id)


@animation_router.post(
    "/scenes/{scene_id}/animation/apply-preset",
    response_model=SceneAnimationResponse,
    status_code=status.HTTP_200_OK,
    summary="Apply an animation preset to a target object or camera in the scene",
)
def apply_animation_preset(
    scene_id: uuid.UUID,
    payload: AnimationApplyPresetRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAnimationResponse:
    service = AnimationService(db)
    return service.apply_preset(current_user, scene_id, payload)


# ---------------------------------------------------------------------------
# 3. AI Assisted Animation
# ---------------------------------------------------------------------------
@animation_router.post(
    "/projects/{project_id}/animation/ai-assist",
    response_model=AnimationAIAssistProposalResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI animation keyframe suggestions (review before applying)",
)
def generate_ai_animation_proposal(
    project_id: uuid.UUID,
    payload: AnimationAIAssistRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> AnimationAIAssistProposalResponse:
    service = AnimationService(db)
    return service.generate_ai_animation_proposal(current_user, project_id, payload)


@animation_router.post(
    "/projects/{project_id}/animation/ai-apply",
    response_model=SceneAnimationResponse,
    status_code=status.HTTP_200_OK,
    summary="Apply user-accepted AI animation suggestions to the scene animation document",
)
def apply_ai_animation_proposal(
    project_id: uuid.UUID,
    payload: AnimationAIApplyProposalRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SceneAnimationResponse:
    service = AnimationService(db)
    return service.apply_ai_animation_proposal(current_user, project_id, payload)


@animation_router.get(
    "/projects/{project_id}/animation-jobs",
    response_model=List[AnimationGenerationJobResponse],
    status_code=status.HTTP_200_OK,
    summary="List all AI animation jobs for a project",
)
def list_animation_jobs(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[AnimationGenerationJobResponse]:
    service = AnimationService(db)
    return service.list_animation_jobs(current_user, project_id)


@animation_router.get(
    "/animation-jobs/{job_id}",
    response_model=AnimationGenerationJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Get status and details of an AI animation job",
)
def get_animation_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> AnimationGenerationJobResponse:
    service = AnimationService(db)
    return service.get_animation_job(current_user, job_id)
