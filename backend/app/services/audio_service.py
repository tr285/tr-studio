"""
Business Logic & Service Layer for TR STUDIO Step 8 — Professional Dialogue, Voice & Audio Studio.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppException, NotFoundException, VoiceAIConfigurationException, VoiceProviderException
from app.core.logging import logger
from app.models.animation import SceneAnimation
from app.models.audio import (
    AudioAsset,
    AudioGenerationJob,
    CharacterVoiceProfile,
    SubtitleEntry,
    SubtitleTrack,
)
from app.models.character import Character
from app.models.story import DialogueEntry, NarrationEntry, StoryScene
from app.repositories.audio_repository import AudioRepository
from app.schemas.audio import (
    AudioAssetResponse,
    CharacterVoiceProfileCreate,
    CharacterVoiceProfileResponse,
    CharacterVoiceProfileUpdate,
    DialogueLineResponse,
    DialogueLineUpdate,
    NarrationLineResponse,
    NarrationLineUpdate,
    SubtitleEntryCreate,
    SubtitleEntryResponse,
    SubtitleEntryUpdate,
    SubtitleTrackCreate,
    SubtitleTrackResponse,
    VoiceOption,
)
from app.services.audio_validator import inspect_audio_data
from app.services.storage_service import get_storage_backend
from app.services.voice_provider import get_voice_provider


def format_ms_to_srt_time(ms: int) -> str:
    """Format milliseconds into SRT time string: HH:MM:SS,mmm"""
    total_seconds = ms // 1000
    milliseconds = ms % 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def format_ms_to_vtt_time(ms: int) -> str:
    """Format milliseconds into WebVTT time string: HH:MM:SS.mmm"""
    total_seconds = ms // 1000
    milliseconds = ms % 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


class AudioService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = AudioRepository(db)
        self.storage = get_storage_backend()

    # ------------------------------------------------------------------
    # Voices and Profiles
    # ------------------------------------------------------------------

    async def list_available_voices(self, provider_name: Optional[str] = None) -> List[VoiceOption]:
        if provider_name:
            provider = get_voice_provider(provider_name)
            return await provider.list_supported_voices()
        try:
            provider = get_voice_provider()
            return await provider.list_supported_voices()
        except VoiceAIConfigurationException:
            from app.services.voice_provider import BUILTIN_ANIME_VOICES
            return BUILTIN_ANIME_VOICES

    def list_voice_profiles(self, project_id: uuid.UUID) -> List[CharacterVoiceProfileResponse]:
        profiles = self.repo.list_voice_profiles_by_project(project_id)
        results = []
        for p in profiles:
            char_name = p.character.name if p.character else None
            data = CharacterVoiceProfileResponse.model_validate(p)
            data.character_name = char_name
            results.append(data)
        return results

    def get_voice_profile_by_character(self, character_id: uuid.UUID) -> Optional[CharacterVoiceProfileResponse]:
        p = self.repo.get_voice_profile_by_character(character_id)
        if not p:
            return None
        data = CharacterVoiceProfileResponse.model_validate(p)
        data.character_name = p.character.name if p.character else None
        return data

    def upsert_voice_profile(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
        req: CharacterVoiceProfileCreate,
    ) -> CharacterVoiceProfileResponse:
        # Check if profile already exists for this character
        existing = self.repo.get_voice_profile_by_character(req.character_id)
        if existing:
            existing.provider = req.provider
            existing.voice_id = req.voice_id
            existing.voice_name = req.voice_name
            existing.voice_style = req.voice_style
            existing.speaking_rate = req.speaking_rate
            existing.pitch = req.pitch
            existing.stability = req.stability
            existing.similarity_boost = req.similarity_boost
            existing.accent = req.accent
            existing.age_category = req.age_category
            existing.gender = req.gender
            existing.custom_pronunciations = req.custom_pronunciations
            existing.notes = req.notes
            saved = self.repo.save_voice_profile(existing)
        else:
            profile = CharacterVoiceProfile(
                project_id=project_id,
                owner_id=owner_id,
                character_id=req.character_id,
                provider=req.provider,
                voice_id=req.voice_id,
                voice_name=req.voice_name,
                voice_style=req.voice_style,
                speaking_rate=req.speaking_rate,
                pitch=req.pitch,
                stability=req.stability,
                similarity_boost=req.similarity_boost,
                accent=req.accent,
                age_category=req.age_category,
                gender=req.gender,
                sample_url=req.sample_url,
                custom_pronunciations=req.custom_pronunciations,
                notes=req.notes,
            )
            saved = self.repo.save_voice_profile(profile)

        res = CharacterVoiceProfileResponse.model_validate(saved)
        res.character_name = saved.character.name if saved.character else None
        return res

    def update_voice_profile(
        self,
        profile_id: uuid.UUID,
        owner_id: uuid.UUID,
        req: CharacterVoiceProfileUpdate,
    ) -> CharacterVoiceProfileResponse:
        profile = self.repo.get_voice_profile_by_id(profile_id)
        if not profile:
            raise NotFoundException("Character voice profile not found.")

        data = req.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(profile, key, val)

        saved = self.repo.save_voice_profile(profile)
        res = CharacterVoiceProfileResponse.model_validate(saved)
        res.character_name = saved.character.name if saved.character else None
        return res

    def delete_voice_profile(self, profile_id: uuid.UUID) -> None:
        profile = self.repo.get_voice_profile_by_id(profile_id)
        if profile:
            self.repo.delete_voice_profile(profile)

    # ------------------------------------------------------------------
    # Audio Assets (Music / SFX / Ambience / Dialogue)
    # ------------------------------------------------------------------

    def upload_audio_asset(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
        file_bytes: bytes,
        filename: str,
        category: str,
        title: str,
        sub_category: Optional[str] = None,
        description: Optional[str] = None,
        licensing_notes: Optional[str] = None,
    ) -> AudioAssetResponse:
        settings = get_settings()
        max_bytes = settings.MAX_AUDIO_UPLOAD_SIZE_MB * 1024 * 1024
        meta = inspect_audio_data(file_bytes, max_bytes)

        asset_id = uuid.uuid4()
        file_ref = self.storage.save_audio_asset_bytes(
            project_id=project_id,
            asset_id=asset_id,
            extension=meta.extension,
            data=file_bytes,
        )

        asset = AudioAsset(
            id=asset_id,
            project_id=project_id,
            owner_id=owner_id,
            category=category,
            sub_category=sub_category,
            title=title or filename,
            description=description,
            file_path=file_ref,
            file_size_bytes=len(file_bytes),
            mime_type=meta.mime_type,
            duration_ms=meta.duration_ms,
            sample_rate=meta.sample_rate,
            channels=meta.channels,
            bitrate_kbps=meta.bitrate_kbps,
            waveform_data=meta.waveform_data,
            source_type="uploaded",
            licensing_notes=licensing_notes,
            metadata_json={"original_filename": filename},
        )
        saved = self.repo.save_audio_asset(asset)

        res = AudioAssetResponse.model_validate(saved)
        res.audio_url = self.storage.build_signed_audio_media_url(saved.id)
        return res

    def get_audio_asset(self, asset_id: uuid.UUID) -> AudioAssetResponse:
        asset = self.repo.get_audio_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Audio asset not found.")
        res = AudioAssetResponse.model_validate(asset)
        res.audio_url = self.storage.build_signed_audio_media_url(asset.id)
        return res

    def list_audio_assets(
        self,
        project_id: uuid.UUID,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[AudioAssetResponse], int]:
        items, total = self.repo.list_audio_assets(
            project_id=project_id,
            category=category,
            sub_category=sub_category,
            search=search,
            page=page,
            page_size=page_size,
        )
        responses = []
        for item in items:
            res = AudioAssetResponse.model_validate(item)
            res.audio_url = self.storage.build_signed_audio_media_url(item.id)
            responses.append(res)
        return responses, total

    def delete_audio_asset(self, asset_id: uuid.UUID) -> None:
        asset = self.repo.get_audio_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Audio asset not found.")
        try:
            self.storage.delete_asset(asset.file_path)
        except Exception as exc:
            logger.warning(f"Failed to delete audio file {asset.file_path}: {exc}")
        self.repo.delete_audio_asset(asset)

    # ------------------------------------------------------------------
    # Dialogue & Speech Generation
    # ------------------------------------------------------------------

    def list_dialogue(self, project_id: uuid.UUID, scene_id: Optional[uuid.UUID] = None) -> List[DialogueLineResponse]:
        if scene_id:
            lines = self.repo.list_dialogue_by_scene(scene_id)
        else:
            lines = self.repo.list_dialogue_by_project(project_id)

        responses = []
        for line in lines:
            res = DialogueLineResponse.model_validate(line)
            res.character_name = line.character_name
            if line.audio_asset_id:
                res.audio_url = self.storage.build_signed_audio_media_url(line.audio_asset_id)
            responses.append(res)
        return responses

    def update_dialogue_line(self, line_id: uuid.UUID, req: DialogueLineUpdate) -> DialogueLineResponse:
        line = self.repo.get_dialogue_line(line_id)
        if not line:
            raise NotFoundException("Dialogue line not found.")

        data = req.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(line, key, val)

        saved = self.repo.save_dialogue_line(line)
        res = DialogueLineResponse.model_validate(saved)
        res.character_name = saved.character_name
        if saved.audio_asset_id:
            res.audio_url = self.storage.build_signed_audio_media_url(saved.audio_asset_id)
        return res

    async def generate_dialogue_speech(
        self,
        dialogue_id: uuid.UUID,
        owner_id: uuid.UUID,
        project_id: Optional[uuid.UUID] = None,
        provider_override: Optional[str] = None,
        voice_override: Optional[str] = None,
        speaking_speed: Optional[float] = None,
        pitch: Optional[float] = None,
    ) -> DialogueLineResponse:
        line = self.repo.get_dialogue_line(dialogue_id)
        if not line:
            raise NotFoundException("Dialogue line not found.")

        # Determine voice settings from character profile if available
        profile = None
        if line.character_id:
            profile = self.repo.get_voice_profile_by_character(line.character_id)

        provider_name = provider_override or (profile.provider if profile else None) or "mock"
        voice_id = voice_override or (profile.voice_id if profile else None) or "tr-hero-male-1"
        speed = speaking_speed or (profile.speaking_rate if profile else None) or line.speaking_speed or 1.0
        pitch_val = pitch or (profile.pitch if profile else 0.0)

        # Record generation job
        if not project_id:
            scene = line.scene
            if scene and hasattr(scene, "story") and scene.story:
                project_id = scene.story.project_id
            else:
                project_id = uuid.uuid4()

        job = AudioGenerationJob(
            project_id=project_id,
            owner_id=owner_id,
            dialogue_id=line.id,
            character_id=line.character_id,
            provider=provider_name,
            voice_id=voice_id,
            input_text=line.line_text,
            status="processing",
        )
        self.repo.create_generation_job(job)

        try:
            voice_provider = get_voice_provider(provider_name)
            result = await voice_provider.generate_speech(
                text=line.line_text,
                voice_id=voice_id,
                speaking_speed=speed,
                pitch=pitch_val,
                stability=profile.stability if profile else None,
                similarity_boost=profile.similarity_boost if profile else None,
            )

            # Save generated audio as AudioAsset
            asset_id = uuid.uuid4()
            char_title = line.character_name or "Unknown"
            file_ref = self.storage.save_audio_asset_bytes(
                project_id=project_id,
                asset_id=asset_id,
                extension=result.extension,
                data=result.audio_bytes,
            )

            audio_asset = AudioAsset(
                id=asset_id,
                project_id=project_id,
                owner_id=owner_id,
                category="dialogue",
                sub_category="character_dialogue",
                title=f"{char_title}: \"{line.line_text[:40]}\"",
                description=f"Generated speech for {char_title}",
                file_path=file_ref,
                file_size_bytes=len(result.audio_bytes),
                mime_type=result.mime_type,
                duration_ms=result.duration_ms,
                sample_rate=result.sample_rate,
                channels=result.channels,
                bitrate_kbps=result.bitrate_kbps,
                waveform_data=result.waveform_data,
                source_type="generated",
                metadata_json={
                    "voice_id": voice_id,
                    "provider": provider_name,
                    "character_id": str(line.character_id) if line.character_id else None,
                    "dialogue_id": str(line.id),
                },
            )
            saved_asset = self.repo.save_audio_asset(audio_asset)

            # Update dialogue line
            line.audio_status = "ready"
            line.audio_asset_id = saved_asset.id
            line.duration_ms = result.duration_ms
            if line.start_ms is None:
                line.start_ms = 0
            self.repo.save_dialogue_line(line)

            # Mark job complete
            job.status = "completed"
            job.audio_asset_id = saved_asset.id
            job.duration_ms = result.duration_ms
            self.repo.save_generation_job(job)

        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            self.repo.save_generation_job(job)
            line.audio_status = "failed"
            self.repo.save_dialogue_line(line)
            raise

        res = DialogueLineResponse.model_validate(line)
        res.character_name = line.character_name
        res.audio_url = self.storage.build_signed_audio_media_url(line.audio_asset_id)
        return res

    # ------------------------------------------------------------------
    # Narration & Speech Generation
    # ------------------------------------------------------------------

    def list_narration(self, project_id: uuid.UUID, scene_id: Optional[uuid.UUID] = None) -> List[NarrationLineResponse]:
        if scene_id:
            lines = self.repo.list_narration_by_scene(scene_id)
        else:
            lines = self.repo.list_narration_by_project(project_id)

        responses = []
        for line in lines:
            res = NarrationLineResponse.model_validate(line)
            if line.audio_asset_id:
                res.audio_url = self.storage.build_signed_audio_media_url(line.audio_asset_id)
            responses.append(res)
        return responses

    def update_narration_line(self, line_id: uuid.UUID, req: NarrationLineUpdate) -> NarrationLineResponse:
        line = self.repo.get_narration_line(line_id)
        if not line:
            raise NotFoundException("Narration line not found.")

        data = req.model_dump(exclude_unset=True)
        for key, val in data.items():
            setattr(line, key, val)

        saved = self.repo.save_narration_line(line)
        res = NarrationLineResponse.model_validate(saved)
        if saved.audio_asset_id:
            res.audio_url = self.storage.build_signed_audio_media_url(saved.audio_asset_id)
        return res

    async def generate_narration_speech(
        self,
        narration_id: uuid.UUID,
        owner_id: uuid.UUID,
        project_id: Optional[uuid.UUID] = None,
        provider_override: Optional[str] = None,
        voice_override: Optional[str] = None,
        speaking_speed: Optional[float] = None,
    ) -> NarrationLineResponse:
        line = self.repo.get_narration_line(narration_id)
        if not line:
            raise NotFoundException("Narration line not found.")

        provider_name = provider_override or "mock"
        voice_id = voice_override or "tr-narrator-cinematic-1"
        speed = speaking_speed or 1.0

        if not project_id:
            scene = line.scene
            if scene and hasattr(scene, "story") and scene.story:
                project_id = scene.story.project_id
            else:
                project_id = uuid.uuid4()

        job = AudioGenerationJob(
            project_id=project_id,
            owner_id=owner_id,
            narration_id=line.id,
            provider=provider_name,
            voice_id=voice_id,
            input_text=line.narration_text,
            status="processing",
        )
        self.repo.create_generation_job(job)

        try:
            voice_provider = get_voice_provider(provider_name)
            result = await voice_provider.generate_speech(
                text=line.narration_text,
                voice_id=voice_id,
                speaking_speed=speed,
            )

            asset_id = uuid.uuid4()
            file_ref = self.storage.save_audio_asset_bytes(
                project_id=project_id,
                asset_id=asset_id,
                extension=result.extension,
                data=result.audio_bytes,
            )

            audio_asset = AudioAsset(
                id=asset_id,
                project_id=project_id,
                owner_id=owner_id,
                category="narration",
                sub_category="voiceover",
                title=f"Narration: \"{line.narration_text[:40]}\"",
                description="Generated voiceover narration",
                file_path=file_ref,
                file_size_bytes=len(result.audio_bytes),
                mime_type=result.mime_type,
                duration_ms=result.duration_ms,
                sample_rate=result.sample_rate,
                channels=result.channels,
                bitrate_kbps=result.bitrate_kbps,
                waveform_data=result.waveform_data,
                source_type="generated",
                metadata_json={
                    "voice_id": voice_id,
                    "provider": provider_name,
                    "narration_id": str(line.id),
                },
            )
            saved_asset = self.repo.save_audio_asset(audio_asset)

            line.audio_status = "ready"
            line.audio_asset_id = saved_asset.id
            line.duration_ms = result.duration_ms
            if line.start_ms is None:
                line.start_ms = 0
            self.repo.save_narration_line(line)

            job.status = "completed"
            job.audio_asset_id = saved_asset.id
            job.duration_ms = result.duration_ms
            self.repo.save_generation_job(job)

        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            self.repo.save_generation_job(job)
            line.audio_status = "failed"
            self.repo.save_narration_line(line)
            raise

        res = NarrationLineResponse.model_validate(line)
        res.audio_url = self.storage.build_signed_audio_media_url(line.audio_asset_id)
        return res

    # ------------------------------------------------------------------
    # Batch Speech Generation
    # ------------------------------------------------------------------

    async def batch_generate_speech(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
        scene_id: Optional[uuid.UUID] = None,
        dialogue_ids: Optional[List[uuid.UUID]] = None,
        narration_ids: Optional[List[uuid.UUID]] = None,
        force_regenerate: bool = False,
    ) -> Dict[str, Any]:
        target_dialogues: List[DialogueEntry] = []
        target_narrations: List[NarrationEntry] = []

        if dialogue_ids:
            for did in dialogue_ids:
                d = self.repo.get_dialogue_line(did)
                if d and (force_regenerate or d.audio_status != "ready"):
                    target_dialogues.append(d)
        elif scene_id:
            lines = self.repo.list_dialogue_by_scene(scene_id)
            target_dialogues = [d for d in lines if force_regenerate or d.audio_status != "ready"]

        if narration_ids:
            for nid in narration_ids:
                n = self.repo.get_narration_line(nid)
                if n and (force_regenerate or n.audio_status != "ready"):
                    target_narrations.append(n)
        elif scene_id:
            n_lines = self.repo.list_narration_by_scene(scene_id)
            target_narrations = [n for n in n_lines if force_regenerate or n.audio_status != "ready"]

        total_requested = len(target_dialogues) + len(target_narrations)
        completed = 0
        failed = 0
        jobs: List[AudioGenerationJob] = []

        # Sequential processing to prevent provider rate limits
        for d in target_dialogues:
            try:
                await self.generate_dialogue_speech(d.id, owner_id, project_id=project_id)
                completed += 1
            except Exception as exc:
                logger.error(f"Failed speech gen for dialogue {d.id}: {exc}")
                failed += 1

        for n in target_narrations:
            try:
                await self.generate_narration_speech(n.id, owner_id, project_id=project_id)
                completed += 1
            except Exception as exc:
                logger.error(f"Failed speech gen for narration {n.id}: {exc}")
                failed += 1

        recent_jobs = self.repo.list_jobs_by_project(project_id, limit=total_requested or 10)
        return {
            "total_requested": total_requested,
            "completed": completed,
            "failed": failed,
            "jobs": recent_jobs,
        }

    # ------------------------------------------------------------------
    # Subtitles & Captions
    # ------------------------------------------------------------------

    def list_subtitle_tracks(
        self, project_id: uuid.UUID, scene_id: Optional[uuid.UUID] = None
    ) -> List[SubtitleTrackResponse]:
        tracks = self.repo.list_subtitle_tracks_by_project(project_id, scene_id)
        return [SubtitleTrackResponse.model_validate(t) for t in tracks]

    def create_subtitle_track(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
        req: SubtitleTrackCreate,
    ) -> SubtitleTrackResponse:
        track = SubtitleTrack(
            project_id=project_id,
            owner_id=owner_id,
            story_id=req.story_id,
            scene_id=req.scene_id,
            language=req.language,
            name=req.name,
            is_default=req.is_default,
        )
        saved = self.repo.save_subtitle_track(track)
        return SubtitleTrackResponse.model_validate(saved)

    def populate_subtitles_from_scene(
        self,
        scene_id: uuid.UUID,
        track_id: uuid.UUID,
    ) -> SubtitleTrackResponse:
        track = self.repo.get_subtitle_track(track_id)
        if not track:
            raise NotFoundException("Subtitle track not found.")

        # Clear existing entries in track
        for e in list(track.entries):
            self.repo.delete_subtitle_entry(e)

        dialogues = self.repo.list_dialogue_by_scene(scene_id)
        narrations = self.repo.list_narration_by_scene(scene_id)

        # Merge and sort entries by timing or order
        order_idx = 1
        current_cursor_ms = 0

        for d in dialogues:
            start = d.start_ms if d.start_ms is not None else current_cursor_ms
            duration = d.duration_ms or max(1500, len(d.line_text) * 60)
            end = start + duration
            speaker = d.character_name or "Character"

            entry = SubtitleEntry(
                track_id=track.id,
                scene_id=scene_id,
                dialogue_id=d.id,
                start_ms=start,
                end_ms=end,
                text=d.line_text,
                speaker_name=speaker,
                entry_order=order_idx,
            )
            self.repo.save_subtitle_entry(entry)
            order_idx += 1
            current_cursor_ms = end + 300  # small gap

        for n in narrations:
            start = n.start_ms if n.start_ms is not None else current_cursor_ms
            duration = n.duration_ms or max(2000, len(n.narration_text) * 60)
            end = start + duration

            entry = SubtitleEntry(
                track_id=track.id,
                scene_id=scene_id,
                narration_id=n.id,
                start_ms=start,
                end_ms=end,
                text=n.narration_text,
                speaker_name="Narrator",
                entry_order=order_idx,
            )
            self.repo.save_subtitle_entry(entry)
            order_idx += 1
            current_cursor_ms = end + 300

        refreshed = self.repo.get_subtitle_track(track.id)
        return SubtitleTrackResponse.model_validate(refreshed)

    def export_subtitles_srt(self, track_id: uuid.UUID) -> str:
        track = self.repo.get_subtitle_track(track_id)
        if not track:
            raise NotFoundException("Subtitle track not found.")

        lines: List[str] = []
        entries = sorted(track.entries, key=lambda e: (e.start_ms, e.entry_order))

        for idx, entry in enumerate(entries, start=1):
            start_str = format_ms_to_srt_time(entry.start_ms)
            end_str = format_ms_to_srt_time(entry.end_ms)
            speaker_prefix = f"[{entry.speaker_name}] " if entry.speaker_name else ""
            lines.append(str(idx))
            lines.append(f"{start_str} --> {end_str}")
            lines.append(f"{speaker_prefix}{entry.text}")
            lines.append("")  # Blank separator

        return "\n".join(lines)

    def export_subtitles_vtt(self, track_id: uuid.UUID) -> str:
        track = self.repo.get_subtitle_track(track_id)
        if not track:
            raise NotFoundException("Subtitle track not found.")

        lines: List[str] = ["WEBVTT", ""]
        entries = sorted(track.entries, key=lambda e: (e.start_ms, e.entry_order))

        for idx, entry in enumerate(entries, start=1):
            start_str = format_ms_to_vtt_time(entry.start_ms)
            end_str = format_ms_to_vtt_time(entry.end_ms)
            lines.append(str(idx))
            lines.append(f"{start_str} --> {end_str}")
            if entry.speaker_name:
                lines.append(f"<v {entry.speaker_name}>{entry.text}")
            else:
                lines.append(entry.text)
            lines.append("")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Timeline Audio Sync
    # ------------------------------------------------------------------

    def sync_audio_to_timeline(
        self,
        project_id: uuid.UUID,
        owner_id: uuid.UUID,
        scene_id: uuid.UUID,
        include_dialogue: bool = True,
        include_narration: bool = True,
        auto_place_clips: bool = True,
    ) -> Dict[str, Any]:
        """
        Synchronizes scene dialogue and narration audio into the multi-track
        animation document for the scene, creating audio tracks and clips.
        """
        scene_anim = self.db.query(SceneAnimation).filter(SceneAnimation.scene_id == scene_id).first()
        if not scene_anim:
            return {
                "scene_id": scene_id,
                "tracks_created": 0,
                "clips_created": 0,
                "message": "No animation document exists yet for this scene. Create an animation in the Timeline Editor first.",
            }

        doc = dict(scene_anim.document)
        tracks = list(doc.get("tracks", []))
        clips = list(doc.get("clips", []))

        # Look for existing audio tracks or create them
        dialogue_track_id = "track-audio-dialogue"
        narration_track_id = "track-audio-narration"

        has_dialogue_track = any(t.get("id") == dialogue_track_id for t in tracks)
        has_narration_track = any(t.get("id") == narration_track_id for t in tracks)

        tracks_created = 0
        if include_dialogue and not has_dialogue_track:
            tracks.append({
                "id": dialogue_track_id,
                "name": "Dialogue Track",
                "type": "dialogue",
                "target_id": None,
                "height": 56,
                "muted": False,
                "solo": False,
                "order_index": len(tracks),
            })
            tracks_created += 1

        if include_narration and not has_narration_track:
            tracks.append({
                "id": narration_track_id,
                "name": "Narration Track",
                "type": "narration",
                "target_id": None,
                "height": 56,
                "muted": False,
                "solo": False,
                "order_index": len(tracks),
            })
            tracks_created += 1

        clips_created = 0

        # Sync dialogue lines
        if include_dialogue:
            dialogue_lines = self.repo.list_dialogue_by_scene(scene_id)
            cursor_ms = 0
            for d in dialogue_lines:
                clip_id = f"clip-dialogue-{d.id}"
                # If clip already exists, skip or update
                existing_clip = next((c for c in clips if c.get("id") == clip_id), None)
                start = d.start_ms if d.start_ms is not None else cursor_ms
                duration = d.duration_ms or 2000

                audio_url = ""
                waveform = None
                if d.audio_asset_id:
                    asset = self.repo.get_audio_asset_by_id(d.audio_asset_id)
                    if asset:
                        audio_url = self.storage.build_signed_audio_media_url(asset.id)
                        waveform = asset.waveform_data

                clip_data = {
                    "id": clip_id,
                    "track_id": dialogue_track_id,
                    "target_id": None,
                    "name": f"{(d.character_name or 'Char')}: {d.line_text[:20]}",
                    "start_time_ms": start,
                    "duration_ms": duration,
                    "color": "#3B82F6",
                    "volume": 1.0,
                    "audio_asset_id": str(d.audio_asset_id) if d.audio_asset_id else None,
                    "audio_url": audio_url,
                    "waveform": waveform,
                }

                if existing_clip:
                    existing_clip.update(clip_data)
                else:
                    clips.append(clip_data)
                    clips_created += 1

                cursor_ms = start + duration + 200

        # Sync narration lines
        if include_narration:
            narrations = self.repo.list_narration_by_scene(scene_id)
            cursor_ms = 0
            for n in narrations:
                clip_id = f"clip-narration-{n.id}"
                existing_clip = next((c for c in clips if c.get("id") == clip_id), None)
                start = n.start_ms if n.start_ms is not None else cursor_ms
                duration = n.duration_ms or 2500

                audio_url = ""
                waveform = None
                if n.audio_asset_id:
                    asset = self.repo.get_audio_asset_by_id(n.audio_asset_id)
                    if asset:
                        audio_url = self.storage.build_signed_audio_media_url(asset.id)
                        waveform = asset.waveform_data

                clip_data = {
                    "id": clip_id,
                    "track_id": narration_track_id,
                    "target_id": None,
                    "name": f"Narrator: {n.narration_text[:20]}",
                    "start_time_ms": start,
                    "duration_ms": duration,
                    "color": "#8B5CF6",
                    "volume": 1.0,
                    "audio_asset_id": str(n.audio_asset_id) if n.audio_asset_id else None,
                    "audio_url": audio_url,
                    "waveform": waveform,
                }

                if existing_clip:
                    existing_clip.update(clip_data)
                else:
                    clips.append(clip_data)
                    clips_created += 1

                cursor_ms = start + duration + 200

        doc["tracks"] = tracks
        doc["clips"] = clips
        scene_anim.document = doc
        scene_anim.version_number = (scene_anim.version_number or 1) + 1
        scene_anim.updated_at = datetime.now(timezone.utc)
        self.db.commit()

        return {
            "scene_id": scene_id,
            "tracks_created": tracks_created,
            "clips_created": clips_created,
            "message": f"Successfully synchronized {clips_created} audio clips into timeline.",
        }
