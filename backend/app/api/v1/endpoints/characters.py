"""
API v1 Endpoints for TR STUDIO Step 3 — Professional AI Character Creation Studio.
Includes routers for:
- `/api/v1/characters`
- `/api/v1/character-generation-jobs`
- `/api/v1/character-expressions`
- `/api/v1/character-poses`
- `/api/v1/character-outfits`
- `/api/v1/character-assets`
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.core.exceptions import ForbiddenException
from app.schemas.character import (
    CharacterAssetResponse,
    CharacterAssetUpdateRequest,
    CharacterCreateRequest,
    CharacterExpressionCreateRequest,
    CharacterExpressionResponse,
    CharacterExpressionUpdateRequest,
    CharacterGenerateExpressionRequest,
    CharacterGenerateImageRequest,
    CharacterGenerateOutfitRequest,
    CharacterGeneratePoseRequest,
    CharacterGenerateSheetRequest,
    CharacterGenerationJobResponse,
    CharacterGenerationResultResponse,
    CharacterOutfitCreateRequest,
    CharacterOutfitResponse,
    CharacterOutfitUpdateRequest,
    CharacterPoseCreateRequest,
    CharacterPoseResponse,
    CharacterPoseUpdateRequest,
    CharacterPromptPreviewRequest,
    CharacterPromptPreviewResponse,
    CharacterResponse,
    CharacterStorySyncRequest,
    CharacterSummaryResponse,
    CharacterUpdateRequest,
    CharacterVariationRequest,
    ImageProviderStatusResponse,
)
from app.services.character_service import CharacterService
from app.services.storage_service import verify_media_signature

characters_router = APIRouter()
character_jobs_router = APIRouter()
character_expressions_router = APIRouter()
character_poses_router = APIRouter()
character_outfits_router = APIRouter()
character_assets_router = APIRouter()


# ------------------------------------------------------------------
# 1. AI Image Provider Status & Character Management (`/api/v1/characters`)
# ------------------------------------------------------------------


@characters_router.get(
    "/ai-status",
    response_model=ImageProviderStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Check whether the backend AI Character Image Provider is configured",
)
def get_character_image_ai_status(
    current_user: CurrentUser,
    db: DbSession,
) -> ImageProviderStatusResponse:
    service = CharacterService(db)
    return service.get_image_ai_status()


@characters_router.post(
    "",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new character (manual or linked to a project/story)",
)
def create_character(
    payload: CharacterCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterResponse:
    service = CharacterService(db)
    return service.create_character(current_user, payload)


@characters_router.get(
    "",
    response_model=List[CharacterSummaryResponse],
    status_code=status.HTTP_200_OK,
    summary="List characters owned by the authenticated user with filters and pagination",
)
def list_characters(
    current_user: CurrentUser,
    db: DbSession,
    project_id: Optional[uuid.UUID] = Query(None),
    story_id: Optional[uuid.UUID] = Query(None),
    role: Optional[str] = Query(None),
    style: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> List[CharacterSummaryResponse]:
    service = CharacterService(db)
    return service.list_characters(
        user=current_user,
        project_id=project_id,
        story_id=story_id,
        role=role,
        style=style,
        search=search,
        skip=skip,
        limit=limit,
    )


@characters_router.post(
    "/import-from-story/{story_id}",
    response_model=List[CharacterResponse],
    status_code=status.HTTP_200_OK,
    summary="Import or synchronize all characters from an existing Story into Character Studio without duplicates",
)
def import_characters_from_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[CharacterResponse]:
    service = CharacterService(db)
    return service.import_characters_from_story(current_user, story_id)


@characters_router.get(
    "/{character_id}",
    response_model=CharacterResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete character details, Character Bible, expressions, poses, outfits, and assets",
)
def get_character(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterResponse:
    service = CharacterService(db)
    return service.get_character(current_user, character_id)


@characters_router.patch(
    "/{character_id}",
    response_model=CharacterResponse,
    status_code=status.HTTP_200_OK,
    summary="Update character attributes, appearance, style, canonical reference, or Character Bible",
)
def update_character(
    character_id: uuid.UUID,
    payload: CharacterUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterResponse:
    service = CharacterService(db)
    return service.update_character(current_user, character_id, payload)


@characters_router.delete(
    "/{character_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a character and its stored media assets (owner only)",
)
def delete_character(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = CharacterService(db)
    service.delete_character(current_user, character_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@characters_router.post(
    "/{character_id}/variations",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new variation of an existing character",
)
def create_character_variation(
    character_id: uuid.UUID,
    payload: CharacterVariationRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterResponse:
    service = CharacterService(db)
    return service.create_character_variation(current_user, character_id, payload)


@characters_router.post(
    "/{character_id}/sync-to-story",
    response_model=CharacterResponse,
    status_code=status.HTTP_200_OK,
    summary="Import or sync a Character Studio character into a Story and optional scenes without duplication",
)
def sync_character_to_story(
    character_id: uuid.UUID,
    payload: CharacterStorySyncRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterResponse:
    service = CharacterService(db)
    return service.sync_character_to_story(current_user, character_id, payload)


@characters_router.post(
    "/{character_id}/preview-prompt",
    response_model=CharacterPromptPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Preview the sanitized CharacterPromptBuilder prompt before generating images",
)
def preview_character_prompt(
    character_id: uuid.UUID,
    payload: CharacterPromptPreviewRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterPromptPreviewResponse:
    service = CharacterService(db)
    return service.preview_prompt(current_user, character_id, payload)


# ------------------------------------------------------------------
# 2. AI Character Image Generation Endpoints
# ------------------------------------------------------------------


@characters_router.post(
    "/{character_id}/generate",
    response_model=CharacterGenerationResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a character concept, portrait, or full-body image via the configured image provider",
)
def generate_character_image(
    character_id: uuid.UUID,
    payload: CharacterGenerateImageRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterGenerationResultResponse:
    service = CharacterService(db)
    return service.generate_character_image(current_user, character_id, payload)


@characters_router.post(
    "/{character_id}/generate-sheet",
    response_model=CharacterGenerationResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate character turnaround or reference sheet views",
)
def generate_character_sheet(
    character_id: uuid.UUID,
    payload: CharacterGenerateSheetRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterGenerationResultResponse:
    service = CharacterService(db)
    return service.generate_character_sheet(current_user, character_id, payload)


@characters_router.post(
    "/{character_id}/generate-expression",
    response_model=CharacterGenerationResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a facial expression asset for a character",
)
def generate_character_expression(
    character_id: uuid.UUID,
    payload: CharacterGenerateExpressionRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterGenerationResultResponse:
    service = CharacterService(db)
    return service.generate_expression_asset(current_user, character_id, payload)


@characters_router.post(
    "/{character_id}/generate-pose",
    response_model=CharacterGenerationResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a pose variation asset for a character",
)
def generate_character_pose(
    character_id: uuid.UUID,
    payload: CharacterGeneratePoseRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterGenerationResultResponse:
    service = CharacterService(db)
    return service.generate_pose_asset(current_user, character_id, payload)


@characters_router.post(
    "/{character_id}/generate-outfit",
    response_model=CharacterGenerationResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an outfit variation asset for a character",
)
def generate_character_outfit(
    character_id: uuid.UUID,
    payload: CharacterGenerateOutfitRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterGenerationResultResponse:
    service = CharacterService(db)
    return service.generate_outfit_asset(current_user, character_id, payload)


# ------------------------------------------------------------------
# 3. Generation Tracking
# ------------------------------------------------------------------


@characters_router.get(
    "/{character_id}/jobs",
    response_model=List[CharacterGenerationJobResponse],
    status_code=status.HTTP_200_OK,
    summary="List generation jobs for a character (owner only)",
)
def list_character_jobs(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[CharacterGenerationJobResponse]:
    service = CharacterService(db)
    return service.list_character_jobs(current_user, character_id)


@character_jobs_router.get(
    "/{job_id}",
    response_model=CharacterGenerationJobResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a specific character generation job by ID (owner only)",
)
def get_character_generation_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterGenerationJobResponse:
    service = CharacterService(db)
    return service.get_generation_job(current_user, job_id)


# ------------------------------------------------------------------
# 4. Expressions Management
# ------------------------------------------------------------------


@characters_router.get(
    "/{character_id}/expressions",
    response_model=List[CharacterExpressionResponse],
    status_code=status.HTTP_200_OK,
    summary="List expressions for a character (owner only)",
)
def list_character_expressions(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[CharacterExpressionResponse]:
    service = CharacterService(db)
    return service.list_expressions(current_user, character_id)


@characters_router.post(
    "/{character_id}/expressions",
    response_model=CharacterExpressionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new expression entry for a character (owner only)",
)
def create_character_expression(
    character_id: uuid.UUID,
    payload: CharacterExpressionCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterExpressionResponse:
    service = CharacterService(db)
    return service.create_expression(current_user, character_id, payload)


@character_expressions_router.patch(
    "/{expression_id}",
    response_model=CharacterExpressionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update or rename an expression entry (owner only)",
)
def update_character_expression(
    expression_id: uuid.UUID,
    payload: CharacterExpressionUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterExpressionResponse:
    service = CharacterService(db)
    return service.update_expression(current_user, expression_id, payload)


@character_expressions_router.delete(
    "/{expression_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expression entry (owner only)",
)
def delete_character_expression(
    expression_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = CharacterService(db)
    service.delete_expression(current_user, expression_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------
# 5. Poses Management
# ------------------------------------------------------------------


@characters_router.get(
    "/{character_id}/poses",
    response_model=List[CharacterPoseResponse],
    status_code=status.HTTP_200_OK,
    summary="List poses for a character (owner only)",
)
def list_character_poses(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[CharacterPoseResponse]:
    service = CharacterService(db)
    return service.list_poses(current_user, character_id)


@characters_router.post(
    "/{character_id}/poses",
    response_model=CharacterPoseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new pose entry for a character (owner only)",
)
def create_character_pose(
    character_id: uuid.UUID,
    payload: CharacterPoseCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterPoseResponse:
    service = CharacterService(db)
    return service.create_pose(current_user, character_id, payload)


@character_poses_router.patch(
    "/{pose_id}",
    response_model=CharacterPoseResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a pose entry (owner only)",
)
def update_character_pose(
    pose_id: uuid.UUID,
    payload: CharacterPoseUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterPoseResponse:
    service = CharacterService(db)
    return service.update_pose(current_user, pose_id, payload)


@character_poses_router.delete(
    "/{pose_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a pose entry (owner only)",
)
def delete_character_pose(
    pose_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = CharacterService(db)
    service.delete_pose(current_user, pose_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------
# 6. Outfits Management
# ------------------------------------------------------------------


@characters_router.get(
    "/{character_id}/outfits",
    response_model=List[CharacterOutfitResponse],
    status_code=status.HTTP_200_OK,
    summary="List outfits for a character (owner only)",
)
def list_character_outfits(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> List[CharacterOutfitResponse]:
    service = CharacterService(db)
    return service.list_outfits(current_user, character_id)


@characters_router.post(
    "/{character_id}/outfits",
    response_model=CharacterOutfitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new outfit for a character (owner only)",
)
def create_character_outfit(
    character_id: uuid.UUID,
    payload: CharacterOutfitCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterOutfitResponse:
    service = CharacterService(db)
    return service.create_outfit(current_user, character_id, payload)


@character_outfits_router.patch(
    "/{outfit_id}",
    response_model=CharacterOutfitResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an outfit or mark it as the default outfit (owner only)",
)
def update_character_outfit(
    outfit_id: uuid.UUID,
    payload: CharacterOutfitUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterOutfitResponse:
    service = CharacterService(db)
    return service.update_outfit(current_user, outfit_id, payload)


@character_outfits_router.delete(
    "/{outfit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an outfit (owner only)",
)
def delete_character_outfit(
    outfit_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = CharacterService(db)
    service.delete_outfit(current_user, outfit_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------
# 7. Assets Upload, Gallery, Canonical Reference & Signed Media Delivery
# ------------------------------------------------------------------


@characters_router.post(
    "/{character_id}/assets/upload",
    response_model=CharacterAssetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and validate a reference or character image asset (owner only)",
)
async def upload_character_asset(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
    asset_type: str = Form("reference_upload"),
    label: Optional[str] = Form(None),
    set_as_canonical_reference: bool = Form(False),
) -> CharacterAssetResponse:
    raw_bytes = await file.read()
    service = CharacterService(db)
    return service.upload_character_asset(
        user=current_user,
        character_id=character_id,
        file_bytes=raw_bytes,
        original_filename=file.filename,
        asset_type=asset_type,
        label=label,
        set_as_canonical_reference=set_as_canonical_reference,
    )


@characters_router.get(
    "/{character_id}/assets",
    response_model=List[CharacterAssetResponse],
    status_code=status.HTTP_200_OK,
    summary="List image assets for a character (owner only)",
)
def list_character_assets(
    character_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    asset_type: Optional[str] = Query(None),
) -> List[CharacterAssetResponse]:
    service = CharacterService(db)
    return service.list_character_assets(
        user=current_user,
        character_id=character_id,
        asset_type=asset_type,
    )


@character_assets_router.patch(
    "/{asset_id}",
    response_model=CharacterAssetResponse,
    status_code=status.HTTP_200_OK,
    summary="Update character asset category, label, or set as canonical reference (owner only)",
)
def update_character_asset(
    asset_id: uuid.UUID,
    payload: CharacterAssetUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> CharacterAssetResponse:
    service = CharacterService(db)
    return service.update_character_asset(current_user, asset_id, payload)


@character_assets_router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a character image asset (owner only)",
)
def delete_character_asset(
    asset_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    service = CharacterService(db)
    service.delete_character_asset(current_user, asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@character_assets_router.get(
    "/{asset_id}/media",
    status_code=status.HTTP_200_OK,
    summary="Serve private character asset bytes via verified HMAC-SHA256 signed URL",
)
def get_signed_character_media(
    asset_id: uuid.UUID,
    db: DbSession,
    expires: int = Query(...),
    sig: str = Query(...),
    download: int = Query(0),
) -> Response:
    if not verify_media_signature(asset_id=asset_id, expires=expires, sig=sig):
        raise ForbiddenException("Invalid or expired signed media URL.")

    service = CharacterService(db)
    asset, raw_bytes = service.get_asset_for_signed_delivery(asset_id)
    meta = asset.asset_metadata or {}
    mime_type = meta.get("mime_type", "image/png")
    ext = meta.get("extension", "png")

    headers = {"Cache-Control": "private, max-age=300"}
    if download:
        filename = f"character-{asset.character_id}-{asset.id}.{ext}"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return Response(content=raw_bytes, media_type=mime_type, headers=headers)
