"""
API v1 Endpoints for TR STUDIO Step 4 — World & Environment Creation Studio.
"""

from typing import List, Optional
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_db
from app.schemas.character import ImageProviderStatusResponse
from app.schemas.environment import (
    EnvironmentAssetResponse,
    EnvironmentAssetUpdateRequest,
    EnvironmentCreateRequest,
    EnvironmentGenerateImageRequest,
    EnvironmentGenerateVariationRequest,
    EnvironmentGenerationJobResponse,
    EnvironmentGenerationResultResponse,
    EnvironmentPromptPreviewRequest,
    EnvironmentPromptPreviewResponse,
    EnvironmentResponse,
    EnvironmentStorySyncRequest,
    EnvironmentSummaryResponse,
    EnvironmentUpdateRequest,
    EnvironmentVariationCreateRequest,
    EnvironmentVariationResponse,
    EnvironmentVariationUpdateRequest,
    WorldCreateRequest,
    WorldLocationCreateRequest,
    WorldLocationResponse,
    WorldLocationUpdateRequest,
    WorldResponse,
    WorldUpdateRequest,
)
from app.services.environment_service import EnvironmentService
from app.services.image_provider import get_image_provider_status

router = APIRouter(prefix="/environments", tags=["Environments"])
variations_router = APIRouter(
    prefix="/environment-variations", tags=["Environment Variations"]
)
assets_router = APIRouter(
    prefix="/environment-assets", tags=["Environment Assets"]
)
jobs_router = APIRouter(
    prefix="/environment-generation-jobs", tags=["Environment Generation Jobs"]
)
worlds_router = APIRouter(prefix="/worlds", tags=["Worlds"])
world_locations_router = APIRouter(
    prefix="/world-locations", tags=["World Locations"]
)


def _get_service(db: Session = Depends(get_db)) -> EnvironmentService:
    return EnvironmentService(db)


# ------------------------------------------------------------------
# Environment Management
# ------------------------------------------------------------------


@router.get("/ai-status", response_model=ImageProviderStatusResponse)
def get_environment_ai_status(
    current_user: CurrentUser,
) -> ImageProviderStatusResponse:
    return get_image_provider_status()


@router.post(
    "",
    response_model=EnvironmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_environment(
    payload: EnvironmentCreateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentResponse:
    return service.create_environment(user=current_user, payload=payload)


@router.get("", response_model=List[EnvironmentSummaryResponse])
def list_environments(
    current_user: CurrentUser,
    project_id: Optional[uuid.UUID] = Query(default=None),
    story_id: Optional[uuid.UUID] = Query(default=None),
    category: Optional[str] = Query(default=None),
    art_style: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    service: EnvironmentService = Depends(_get_service),
) -> List[EnvironmentSummaryResponse]:
    return service.list_environments(
        user=current_user,
        project_id=project_id,
        story_id=story_id,
        category=category,
        art_style=art_style,
        search=search,
    )


@router.get("/{environment_id}", response_model=EnvironmentResponse)
def get_environment(
    environment_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentResponse:
    return service.get_environment(
        user=current_user, environment_id=environment_id
    )


@router.patch("/{environment_id}", response_model=EnvironmentResponse)
def update_environment(
    environment_id: uuid.UUID,
    payload: EnvironmentUpdateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentResponse:
    return service.update_environment(
        user=current_user, environment_id=environment_id, payload=payload
    )


@router.delete(
    "/{environment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_environment(
    environment_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> Response:
    service.delete_environment(user=current_user, environment_id=environment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------
# Prompt Preview & AI Generation
# ------------------------------------------------------------------


@router.post(
    "/{environment_id}/preview-prompt",
    response_model=EnvironmentPromptPreviewResponse,
)
def preview_environment_prompt(
    environment_id: uuid.UUID,
    payload: EnvironmentPromptPreviewRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentPromptPreviewResponse:
    return service.preview_prompt(
        user=current_user, environment_id=environment_id, payload=payload
    )


@router.post(
    "/{environment_id}/generate",
    response_model=EnvironmentGenerationResultResponse,
)
def generate_environment_image(
    environment_id: uuid.UUID,
    payload: EnvironmentGenerateImageRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentGenerationResultResponse:
    return service.generate_environment_image(
        user=current_user, environment_id=environment_id, payload=payload
    )


@router.post(
    "/{environment_id}/generate-variation",
    response_model=EnvironmentGenerationResultResponse,
)
def generate_environment_variation(
    environment_id: uuid.UUID,
    payload: EnvironmentGenerateVariationRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentGenerationResultResponse:
    return service.generate_environment_variation(
        user=current_user, environment_id=environment_id, payload=payload
    )


@router.get(
    "/{environment_id}/jobs",
    response_model=List[EnvironmentGenerationJobResponse],
)
def list_environment_jobs(
    environment_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> List[EnvironmentGenerationJobResponse]:
    return service.list_jobs(user=current_user, environment_id=environment_id)


@jobs_router.get(
    "/{job_id}", response_model=EnvironmentGenerationJobResponse
)
def get_environment_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentGenerationJobResponse:
    return service.get_job(user=current_user, job_id=job_id)


# ------------------------------------------------------------------
# Environment Variations
# ------------------------------------------------------------------


@router.get(
    "/{environment_id}/variations",
    response_model=List[EnvironmentVariationResponse],
)
def list_environment_variations(
    environment_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> List[EnvironmentVariationResponse]:
    return service.list_variations(
        user=current_user, environment_id=environment_id
    )


@router.post(
    "/{environment_id}/variations",
    response_model=EnvironmentVariationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_environment_variation(
    environment_id: uuid.UUID,
    payload: EnvironmentVariationCreateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentVariationResponse:
    return service.create_variation(
        user=current_user, environment_id=environment_id, payload=payload
    )


@variations_router.patch(
    "/{variation_id}", response_model=EnvironmentVariationResponse
)
def update_environment_variation(
    variation_id: uuid.UUID,
    payload: EnvironmentVariationUpdateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentVariationResponse:
    return service.update_variation(
        user=current_user, variation_id=variation_id, payload=payload
    )


@variations_router.delete(
    "/{variation_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_environment_variation(
    variation_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> Response:
    service.delete_variation(user=current_user, variation_id=variation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------
# Environment Assets & Uploads
# ------------------------------------------------------------------


@router.get(
    "/{environment_id}/assets",
    response_model=List[EnvironmentAssetResponse],
)
def list_environment_assets(
    environment_id: uuid.UUID,
    current_user: CurrentUser,
    asset_type: Optional[str] = Query(default=None),
    service: EnvironmentService = Depends(_get_service),
) -> List[EnvironmentAssetResponse]:
    return service.list_assets(
        user=current_user,
        environment_id=environment_id,
        asset_type=asset_type,
    )


@router.post(
    "/{environment_id}/assets/upload",
    response_model=EnvironmentAssetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_environment_asset(
    environment_id: uuid.UUID,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    asset_type: str = Form(default="uploaded_reference"),
    label: Optional[str] = Form(default=None),
    set_as_default: bool = Form(default=False),
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentAssetResponse:
    raw_bytes = await file.read()
    return service.upload_asset(
        user=current_user,
        environment_id=environment_id,
        raw_bytes=raw_bytes,
        filename=file.filename,
        asset_type=asset_type,
        label=label,
        set_as_default=set_as_default,
    )


@assets_router.patch("/{asset_id}", response_model=EnvironmentAssetResponse)
def update_environment_asset(
    asset_id: uuid.UUID,
    payload: EnvironmentAssetUpdateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentAssetResponse:
    return service.update_asset(
        user=current_user, asset_id=asset_id, payload=payload
    )


@assets_router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment_asset(
    asset_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> Response:
    service.delete_asset(user=current_user, asset_id=asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@assets_router.get("/{asset_id}/media")
def get_environment_asset_media(
    asset_id: uuid.UUID,
    expires: Optional[int] = Query(default=None),
    sig: Optional[str] = Query(default=None),
    download: Optional[int] = Query(default=None),
    service: EnvironmentService = Depends(_get_service),
) -> Response:
    raw_bytes, mime, filename = service.read_signed_or_owned_media(
        asset_id=asset_id,
        expires=expires,
        sig=sig,
        current_user=None,
    )
    headers = {"Cache-Control": "private, max-age=3600"}
    if download == 1:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return Response(content=raw_bytes, media_type=mime, headers=headers)


# ------------------------------------------------------------------
# Story & Scene Integration
# ------------------------------------------------------------------


@router.post(
    "/{environment_id}/sync-to-story",
    response_model=EnvironmentResponse,
)
def sync_environment_to_story(
    environment_id: uuid.UUID,
    payload: EnvironmentStorySyncRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> EnvironmentResponse:
    return service.sync_environment_to_story(
        user=current_user, environment_id=environment_id, payload=payload
    )


@router.post(
    "/import-from-story/{story_id}",
    response_model=List[EnvironmentResponse],
)
def import_environments_from_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> List[EnvironmentResponse]:
    return service.import_environments_from_story(
        user=current_user, story_id=story_id
    )


# ------------------------------------------------------------------
# Worlds & WorldLocations
# ------------------------------------------------------------------


@worlds_router.post(
    "",
    response_model=WorldResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_world(
    payload: WorldCreateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> WorldResponse:
    return service.create_world(user=current_user, payload=payload)


@worlds_router.get("", response_model=List[WorldResponse])
def list_worlds(
    current_user: CurrentUser,
    project_id: Optional[uuid.UUID] = Query(default=None),
    service: EnvironmentService = Depends(_get_service),
) -> List[WorldResponse]:
    return service.list_worlds(user=current_user, project_id=project_id)


@worlds_router.get("/{world_id}", response_model=WorldResponse)
def get_world(
    world_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> WorldResponse:
    return service.get_world(user=current_user, world_id=world_id)


@worlds_router.patch("/{world_id}", response_model=WorldResponse)
def update_world(
    world_id: uuid.UUID,
    payload: WorldUpdateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> WorldResponse:
    return service.update_world(
        user=current_user, world_id=world_id, payload=payload
    )


@worlds_router.delete("/{world_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_world(
    world_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> Response:
    service.delete_world(user=current_user, world_id=world_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@worlds_router.post(
    "/{world_id}/locations",
    response_model=WorldLocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_world_location(
    world_id: uuid.UUID,
    payload: WorldLocationCreateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> WorldLocationResponse:
    return service.create_world_location(
        user=current_user, world_id=world_id, payload=payload
    )


@world_locations_router.patch(
    "/{location_id}", response_model=WorldLocationResponse
)
def update_world_location(
    location_id: uuid.UUID,
    payload: WorldLocationUpdateRequest,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> WorldLocationResponse:
    return service.update_world_location(
        user=current_user, location_id=location_id, payload=payload
    )


@world_locations_router.delete(
    "/{location_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_world_location(
    location_id: uuid.UUID,
    current_user: CurrentUser,
    service: EnvironmentService = Depends(_get_service),
) -> Response:
    service.delete_world_location(user=current_user, location_id=location_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
