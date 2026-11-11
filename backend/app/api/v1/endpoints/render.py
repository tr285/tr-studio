"""
API Endpoints for TR STUDIO Step 9 — Professional Video Rendering, Export & Production Pipeline.
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.project import Project
from app.models.render import RenderOutput
from app.schemas.render import (
    RenderJobCreateRequest,
    RenderJobListResponse,
    RenderJobResponse,
    RenderOutputListResponse,
    RenderOutputResponse,
)
from app.services.render.render_service import RenderService
from app.services.storage_service import (
    get_storage_backend,
    verify_media_signature,
)

router = APIRouter()
exports_router = APIRouter()
_service = RenderService()


def _to_output_response(output: RenderOutput) -> RenderOutputResponse:
    storage = get_storage_backend()
    media_url = storage.build_signed_render_media_url(output.id, download=False)
    download_url = storage.build_signed_render_media_url(output.id, download=True)
    return RenderOutputResponse(
        id=output.id,
        job_id=output.job_id,
        project_id=output.project_id,
        owner_id=output.owner_id,
        scene_id=output.scene_id,
        title=output.title,
        file_path=output.file_path,
        mime_type=output.mime_type,
        file_size_bytes=output.file_size_bytes,
        duration_ms=output.duration_ms,
        width=output.width,
        height=output.height,
        fps=output.fps,
        aspect_ratio=output.aspect_ratio,
        video_codec=output.video_codec,
        audio_codec=output.audio_codec,
        has_audio=output.has_audio,
        has_subtitles=output.has_subtitles,
        metadata_json=output.metadata_json or {},
        media_url=media_url,
        download_url=download_url,
        created_at=output.created_at,
        updated_at=output.updated_at,
    )


# ---------------------------------------------------------------------------
# Project Render Jobs & Exports
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/render",
    response_model=RenderJobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_render_job(
    project_id: uuid.UUID,
    payload: RenderJobCreateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderJobResponse:
    job = _service.create_render_job(
        session=db,
        project_id=project_id,
        owner_id=current_user.id,
        req=payload,
    )
    return RenderJobResponse.model_validate(job)


@router.get(
    "/projects/{project_id}/render/jobs",
    response_model=RenderJobListResponse,
)
def list_project_render_jobs(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderJobListResponse:
    proj = db.get(Project, project_id)
    if not proj:
        raise NotFoundException("Project not found.")
    if proj.owner_id != current_user.id:
        raise ForbiddenException("You do not have access to this project.")
    jobs = _service.list_jobs(session=db, project_id=project_id, owner_id=current_user.id)
    return RenderJobListResponse(
        jobs=[RenderJobResponse.model_validate(j) for j in jobs],
        total=len(jobs),
    )


@router.get(
    "/render/jobs/{job_id}",
    response_model=RenderJobResponse,
)
def get_render_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderJobResponse:
    job = _service.get_job(session=db, job_id=job_id, owner_id=current_user.id)
    return RenderJobResponse.model_validate(job)


@router.post(
    "/render/jobs/{job_id}/cancel",
    response_model=RenderJobResponse,
)
def cancel_render_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderJobResponse:
    job = _service.cancel_render_job(session=db, job_id=job_id, owner_id=current_user.id)
    return RenderJobResponse.model_validate(job)


@router.post(
    "/render/jobs/{job_id}/retry",
    response_model=RenderJobResponse,
)
def retry_render_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderJobResponse:
    job = _service.retry_render_job(session=db, job_id=job_id, owner_id=current_user.id)
    return RenderJobResponse.model_validate(job)


@router.get(
    "/render/jobs/{job_id}/output",
    response_model=RenderOutputResponse,
)
def get_render_job_output(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderOutputResponse:
    job = _service.get_job(session=db, job_id=job_id, owner_id=current_user.id)
    if not job.output:
        raise NotFoundException("Render output is not ready or failed.")
    return _to_output_response(job.output)


@router.get(
    "/projects/{project_id}/exports",
    response_model=RenderOutputListResponse,
)
def list_project_exports(
    project_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderOutputListResponse:
    proj = db.get(Project, project_id)
    if not proj:
        raise NotFoundException("Project not found.")
    if proj.owner_id != current_user.id:
        raise ForbiddenException("You do not have access to this project.")
    outputs = _service.list_outputs(session=db, project_id=project_id, owner_id=current_user.id)
    return RenderOutputListResponse(
        outputs=[_to_output_response(o) for o in outputs],
        total=len(outputs),
    )


# ---------------------------------------------------------------------------
# Individual Export & Signed Media Streaming
# ---------------------------------------------------------------------------

@exports_router.get(
    "/{export_id}",
    response_model=RenderOutputResponse,
)
def get_export_detail(
    export_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> RenderOutputResponse:
    output = _service.get_output(session=db, output_id=export_id, owner_id=current_user.id)
    return _to_output_response(output)


@exports_router.delete(
    "/{export_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_export(
    export_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> Response:
    _service.delete_output(session=db, output_id=export_id, owner_id=current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@exports_router.get("/{export_id}/media")
def stream_render_media(
    export_id: uuid.UUID,
    expires: int = Query(...),
    sig: str = Query(...),
    download: bool = Query(False),
    db: DbSession = None,
) -> Response:
    if not verify_media_signature(asset_id=export_id, expires=expires, sig=sig):
        raise ForbiddenException("Invalid or expired signed render URL.")

    output = db.get(RenderOutput, export_id)
    if not output:
        raise NotFoundException("Render output not found.")

    storage = get_storage_backend()
    raw_bytes = storage.read_asset_bytes(output.file_path)

    ext = output.file_path.split(".")[-1]
    safe_title = "".join(c for c in output.title if c.isalnum() or c in (" ", "-", "_")).strip()
    filename = f"{safe_title or 'export'}.{ext}"
    disposition = "attachment" if download else "inline"

    headers = {
        "Content-Disposition": f'{disposition}; filename="{filename}"',
        "Content-Length": str(len(raw_bytes)),
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
    }
    return Response(content=raw_bytes, media_type=output.mime_type, headers=headers)
