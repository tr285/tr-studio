"""
API v1 Endpoints for TR STUDIO Step 8 — Professional Dialogue, Voice & Audio Studio.
"""

from typing import Any, Dict, List, Literal, Optional
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
from app.core.exceptions import AppException, ForbiddenException, NotFoundException
from app.models.project import Project
from app.repositories.audio_repository import AudioRepository
from app.schemas.audio import (
    AudioAssetListResponse,
    AudioAssetResponse,
    BatchGenerateSpeechRequest,
    BatchGenerateSpeechResponse,
    CharacterVoiceProfileCreate,
    CharacterVoiceProfileResponse,
    CharacterVoiceProfileUpdate,
    DialogueLineResponse,
    DialogueLineUpdate,
    GenerateDialogueSpeechRequest,
    GenerateNarrationSpeechRequest,
    NarrationLineResponse,
    NarrationLineUpdate,
    SubtitleExportResponse,
    SubtitleTrackCreate,
    SubtitleTrackResponse,
    TimelineAudioSyncRequest,
    TimelineAudioSyncResponse,
    VoiceOption,
)
from app.services.audio_service import AudioService
from app.services.storage_service import get_storage_backend, verify_media_signature

router = APIRouter(prefix="/projects/{project_id}/audio", tags=["Audio Studio"])
assets_router = APIRouter(prefix="/audio-assets", tags=["Audio Assets"])


def _get_service(db: Session = Depends(get_db)) -> AudioService:
    return AudioService(db)


def _verify_project_access(project_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise NotFoundException("Project not found.")
    if project.owner_id != user_id:
        raise ForbiddenException("You do not have permission to access this project.")
    return project


# ---------------------------------------------------------------------------
# Voices & Profiles
# ---------------------------------------------------------------------------

@router.get("/voices", response_model=List[VoiceOption])
async def list_available_voices(
    project_id: uuid.UUID,
    provider: Optional[str] = Query(None, description="Filter by provider: mock, google, elevenlabs"),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> List[VoiceOption]:
    _verify_project_access(project_id, current_user.id, service.db)
    return await service.list_available_voices(provider)


@router.get("/voice-profiles", response_model=List[CharacterVoiceProfileResponse])
def list_character_voice_profiles(
    project_id: uuid.UUID,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> List[CharacterVoiceProfileResponse]:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.list_voice_profiles(project_id)


@router.post("/voice-profiles", response_model=CharacterVoiceProfileResponse, status_code=status.HTTP_201_CREATED)
def upsert_character_voice_profile(
    project_id: uuid.UUID,
    payload: CharacterVoiceProfileCreate,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> CharacterVoiceProfileResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.upsert_voice_profile(
        project_id=project_id,
        owner_id=current_user.id,
        req=payload,
    )


@router.put("/voice-profiles/{profile_id}", response_model=CharacterVoiceProfileResponse)
def update_character_voice_profile(
    project_id: uuid.UUID,
    profile_id: uuid.UUID,
    payload: CharacterVoiceProfileUpdate,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> CharacterVoiceProfileResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.update_voice_profile(
        profile_id=profile_id,
        owner_id=current_user.id,
        req=payload,
    )


@router.delete("/voice-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character_voice_profile(
    project_id: uuid.UUID,
    profile_id: uuid.UUID,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> Response:
    _verify_project_access(project_id, current_user.id, service.db)
    service.delete_voice_profile(profile_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Audio Assets (Music, Sound Effects, Ambience, Voice)
# ---------------------------------------------------------------------------

@router.get("/assets", response_model=AudioAssetListResponse)
def list_project_audio_assets(
    project_id: uuid.UUID,
    category: Optional[str] = Query(None, description="music, sound_effect, dialogue, narration, ambience"),
    sub_category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> AudioAssetListResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    items, total = service.list_audio_assets(
        project_id=project_id,
        category=category,
        sub_category=sub_category,
        search=search,
        page=page,
        page_size=page_size,
    )
    return AudioAssetListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/assets/upload", response_model=AudioAssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_audio_asset(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    category: str = Form(..., description="music, sound_effect, dialogue, narration, ambience"),
    title: str = Form(...),
    sub_category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    licensing_notes: Optional[str] = Form(None),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> AudioAssetResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    data = await file.read()
    return service.upload_audio_asset(
        project_id=project_id,
        owner_id=current_user.id,
        file_bytes=data,
        filename=file.filename or "audio_file",
        category=category,
        title=title,
        sub_category=sub_category,
        description=description,
        licensing_notes=licensing_notes,
    )


# Standalone audio asset operations
@assets_router.get("/{asset_id}", response_model=AudioAssetResponse)
def get_audio_asset_detail(
    asset_id: uuid.UUID,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> AudioAssetResponse:
    asset = service.repo.get_audio_asset_by_id(asset_id)
    if not asset:
        raise NotFoundException("Audio asset not found.")
    if asset.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to access this audio asset.")
    return service.get_audio_asset(asset_id)


@assets_router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audio_asset(
    asset_id: uuid.UUID,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> Response:
    asset = service.repo.get_audio_asset_by_id(asset_id)
    if not asset:
        raise NotFoundException("Audio asset not found.")
    if asset.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to delete this audio asset.")
    service.delete_audio_asset(asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@assets_router.get("/{asset_id}/media")
def stream_audio_asset_media(
    asset_id: uuid.UUID,
    expires: int = Query(...),
    sig: str = Query(...),
    download: bool = Query(False),
    db: Session = Depends(get_db),
) -> Response:
    if not verify_media_signature(asset_id=asset_id, expires=expires, sig=sig):
        raise ForbiddenException("Invalid or expired signed audio URL.")

    repo = AudioRepository(db)
    asset = repo.get_audio_asset_by_id(asset_id)
    if not asset:
        raise NotFoundException("Audio asset not found.")

    storage = get_storage_backend()
    raw_bytes = storage.read_asset_bytes(asset.file_path)

    filename = f"{asset.title}.{asset.file_path.split('.')[-1]}"
    disposition = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": f'{disposition}; filename="{filename}"',
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
    }
    return Response(content=raw_bytes, media_type=asset.mime_type, headers=headers)


# ---------------------------------------------------------------------------
# Dialogue Lines & Speech Generation
# ---------------------------------------------------------------------------

@router.get("/dialogue", response_model=List[DialogueLineResponse])
def list_dialogue_lines(
    project_id: uuid.UUID,
    scene_id: Optional[uuid.UUID] = Query(None),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> List[DialogueLineResponse]:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.list_dialogue(project_id, scene_id)


@router.patch("/dialogue/{dialogue_id}", response_model=DialogueLineResponse)
def update_dialogue_line(
    project_id: uuid.UUID,
    dialogue_id: uuid.UUID,
    payload: DialogueLineUpdate,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> DialogueLineResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.update_dialogue_line(dialogue_id, payload)


@router.post("/dialogue/{dialogue_id}/generate", response_model=DialogueLineResponse)
async def generate_speech_for_dialogue(
    project_id: uuid.UUID,
    dialogue_id: uuid.UUID,
    payload: Optional[GenerateDialogueSpeechRequest] = None,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> DialogueLineResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    voice_override = payload.voice_id if payload else None
    provider_override = payload.provider if payload else None
    speed = payload.speaking_speed if payload else None
    pitch = payload.pitch if payload else None

    return await service.generate_dialogue_speech(
        dialogue_id=dialogue_id,
        owner_id=current_user.id,
        project_id=project_id,
        provider_override=provider_override,
        voice_override=voice_override,
        speaking_speed=speed,
        pitch=pitch,
    )


# ---------------------------------------------------------------------------
# Narration Lines & Speech Generation
# ---------------------------------------------------------------------------

@router.get("/narration", response_model=List[NarrationLineResponse])
def list_narration_lines(
    project_id: uuid.UUID,
    scene_id: Optional[uuid.UUID] = Query(None),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> List[NarrationLineResponse]:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.list_narration(project_id, scene_id)


@router.patch("/narration/{narration_id}", response_model=NarrationLineResponse)
def update_narration_line(
    project_id: uuid.UUID,
    narration_id: uuid.UUID,
    payload: NarrationLineUpdate,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> NarrationLineResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.update_narration_line(narration_id, payload)


@router.post("/narration/{narration_id}/generate", response_model=NarrationLineResponse)
async def generate_speech_for_narration(
    project_id: uuid.UUID,
    narration_id: uuid.UUID,
    payload: Optional[GenerateNarrationSpeechRequest] = None,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> NarrationLineResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    voice_override = payload.voice_id if payload else None
    provider_override = payload.provider if payload else None
    speed = payload.speaking_speed if payload else None

    return await service.generate_narration_speech(
        narration_id=narration_id,
        owner_id=current_user.id,
        project_id=project_id,
        provider_override=provider_override,
        voice_override=voice_override,
        speaking_speed=speed,
    )


# ---------------------------------------------------------------------------
# Batch Generation
# ---------------------------------------------------------------------------

@router.post("/generate-batch", response_model=BatchGenerateSpeechResponse)
async def batch_generate_speech(
    project_id: uuid.UUID,
    payload: BatchGenerateSpeechRequest,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> BatchGenerateSpeechResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    result = await service.batch_generate_speech(
        project_id=project_id,
        owner_id=current_user.id,
        scene_id=payload.scene_id,
        dialogue_ids=payload.dialogue_ids,
        narration_ids=payload.narration_ids,
        force_regenerate=payload.force_regenerate,
    )
    return BatchGenerateSpeechResponse(
        total_requested=result["total_requested"],
        completed=result["completed"],
        failed=result["failed"],
        jobs=result["jobs"],
    )


# ---------------------------------------------------------------------------
# Subtitles
# ---------------------------------------------------------------------------

@router.get("/subtitles", response_model=List[SubtitleTrackResponse])
def list_subtitle_tracks(
    project_id: uuid.UUID,
    scene_id: Optional[uuid.UUID] = Query(None),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> List[SubtitleTrackResponse]:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.list_subtitle_tracks(project_id, scene_id)


@router.post("/subtitles", response_model=SubtitleTrackResponse, status_code=status.HTTP_201_CREATED)
def create_subtitle_track(
    project_id: uuid.UUID,
    payload: SubtitleTrackCreate,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> SubtitleTrackResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.create_subtitle_track(project_id, current_user.id, payload)


@router.post("/subtitles/{track_id}/populate", response_model=SubtitleTrackResponse)
def populate_subtitles_from_scene(
    project_id: uuid.UUID,
    track_id: uuid.UUID,
    scene_id: uuid.UUID = Query(...),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> SubtitleTrackResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    return service.populate_subtitles_from_scene(scene_id=scene_id, track_id=track_id)


@router.get("/subtitles/{track_id}/export", response_model=SubtitleExportResponse)
def export_subtitles(
    project_id: uuid.UUID,
    track_id: uuid.UUID,
    format: Literal["srt", "vtt"] = Query("srt"),
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> SubtitleExportResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    if format == "srt":
        content = service.export_subtitles_srt(track_id)
        filename = f"subtitles_{track_id}.srt"
    else:
        content = service.export_subtitles_vtt(track_id)
        filename = f"subtitles_{track_id}.vtt"

    track = service.repo.get_subtitle_track(track_id)
    language = track.language if track else "en"

    return SubtitleExportResponse(
        track_id=track_id,
        language=language,
        format=format,
        content=content,
        filename=filename,
    )


# ---------------------------------------------------------------------------
# Timeline Audio Sync
# ---------------------------------------------------------------------------

@router.post("/timeline-sync", response_model=TimelineAudioSyncResponse)
def sync_audio_to_timeline(
    project_id: uuid.UUID,
    payload: TimelineAudioSyncRequest,
    current_user: CurrentUser = None,
    service: AudioService = Depends(_get_service),
) -> TimelineAudioSyncResponse:
    _verify_project_access(project_id, current_user.id, service.db)
    res = service.sync_audio_to_timeline(
        project_id=project_id,
        owner_id=current_user.id,
        scene_id=payload.scene_id,
        include_dialogue=payload.include_dialogue,
        include_narration=payload.include_narration,
        auto_place_clips=payload.auto_place_clips,
    )
    return TimelineAudioSyncResponse(**res)
