"""
Repository Layer for TR STUDIO Step 8 — Professional Dialogue, Voice & Audio Studio.
"""

from typing import List, Optional, Tuple
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.audio import (
    AudioAsset,
    AudioGenerationJob,
    CharacterVoiceProfile,
    SubtitleEntry,
    SubtitleTrack,
)
from app.models.character import Character
from app.models.story import DialogueEntry, NarrationEntry, StoryScene


class AudioRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Character Voice Profiles
    # ------------------------------------------------------------------

    def get_voice_profile_by_character(self, character_id: uuid.UUID) -> Optional[CharacterVoiceProfile]:
        stmt = (
            select(CharacterVoiceProfile)
            .options(joinedload(CharacterVoiceProfile.character))
            .where(CharacterVoiceProfile.character_id == character_id)
        )
        return self.db.scalar(stmt)

    def get_voice_profile_by_id(self, profile_id: uuid.UUID) -> Optional[CharacterVoiceProfile]:
        stmt = (
            select(CharacterVoiceProfile)
            .options(joinedload(CharacterVoiceProfile.character))
            .where(CharacterVoiceProfile.id == profile_id)
        )
        return self.db.scalar(stmt)

    def list_voice_profiles_by_project(self, project_id: uuid.UUID) -> List[CharacterVoiceProfile]:
        stmt = (
            select(CharacterVoiceProfile)
            .options(joinedload(CharacterVoiceProfile.character))
            .where(CharacterVoiceProfile.project_id == project_id)
            .order_by(CharacterVoiceProfile.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def save_voice_profile(self, profile: CharacterVoiceProfile) -> CharacterVoiceProfile:
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def delete_voice_profile(self, profile: CharacterVoiceProfile) -> None:
        self.db.delete(profile)
        self.db.commit()

    # ------------------------------------------------------------------
    # Audio Assets (Music, Sound Effects, Ambience, Dialogue, Narration)
    # ------------------------------------------------------------------

    def get_audio_asset_by_id(self, asset_id: uuid.UUID) -> Optional[AudioAsset]:
        stmt = select(AudioAsset).where(AudioAsset.id == asset_id)
        return self.db.scalar(stmt)

    def list_audio_assets(
        self,
        project_id: uuid.UUID,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[AudioAsset], int]:
        stmt = select(AudioAsset).where(AudioAsset.project_id == project_id)

        if category:
            stmt = stmt.where(AudioAsset.category == category)
        if sub_category:
            stmt = stmt.where(AudioAsset.sub_category == sub_category)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                (AudioAsset.title.ilike(pattern)) | (AudioAsset.description.ilike(pattern))
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        # Pagination & sorting
        offset = max(0, (page - 1) * page_size)
        stmt = stmt.order_by(AudioAsset.created_at.desc()).offset(offset).limit(page_size)
        items = list(self.db.scalars(stmt).all())

        return items, total

    def save_audio_asset(self, asset: AudioAsset) -> AudioAsset:
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete_audio_asset(self, asset: AudioAsset) -> None:
        self.db.delete(asset)
        self.db.commit()

    # ------------------------------------------------------------------
    # Dialogue & Narration Lines
    # ------------------------------------------------------------------

    def get_dialogue_line(self, line_id: uuid.UUID) -> Optional[DialogueEntry]:
        stmt = select(DialogueEntry).where(DialogueEntry.id == line_id)
        return self.db.scalar(stmt)

    def list_dialogue_by_scene(self, scene_id: uuid.UUID) -> List[DialogueEntry]:
        stmt = (
            select(DialogueEntry)
            .where(DialogueEntry.scene_id == scene_id)
            .order_by(DialogueEntry.line_order.asc())
        )
        return list(self.db.scalars(stmt).all())

    def list_dialogue_by_project(self, project_id: uuid.UUID) -> List[DialogueEntry]:
        stmt = (
            select(DialogueEntry)
            .join(StoryScene, DialogueEntry.scene_id == StoryScene.id)
            .where(StoryScene.project_id == project_id)
            .order_by(StoryScene.scene_number.asc(), DialogueEntry.line_order.asc())
        )
        return list(self.db.scalars(stmt).all())

    def save_dialogue_line(self, line: DialogueEntry) -> DialogueEntry:
        self.db.add(line)
        self.db.commit()
        self.db.refresh(line)
        return line

    def get_narration_line(self, line_id: uuid.UUID) -> Optional[NarrationEntry]:
        stmt = select(NarrationEntry).where(NarrationEntry.id == line_id)
        return self.db.scalar(stmt)

    def list_narration_by_scene(self, scene_id: uuid.UUID) -> List[NarrationEntry]:
        stmt = (
            select(NarrationEntry)
            .where(NarrationEntry.scene_id == scene_id)
            .order_by(NarrationEntry.entry_order.asc())
        )
        return list(self.db.scalars(stmt).all())

    def list_narration_by_project(self, project_id: uuid.UUID) -> List[NarrationEntry]:
        stmt = (
            select(NarrationEntry)
            .join(StoryScene, NarrationEntry.scene_id == StoryScene.id)
            .where(StoryScene.project_id == project_id)
            .order_by(StoryScene.scene_number.asc(), NarrationEntry.entry_order.asc())
        )
        return list(self.db.scalars(stmt).all())

    def save_narration_line(self, line: NarrationEntry) -> NarrationEntry:
        self.db.add(line)
        self.db.commit()
        self.db.refresh(line)
        return line

    # ------------------------------------------------------------------
    # Audio Generation Jobs
    # ------------------------------------------------------------------

    def create_generation_job(self, job: AudioGenerationJob) -> AudioGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_generation_job(self, job_id: uuid.UUID) -> Optional[AudioGenerationJob]:
        stmt = select(AudioGenerationJob).where(AudioGenerationJob.id == job_id)
        return self.db.scalar(stmt)

    def list_jobs_by_project(self, project_id: uuid.UUID, limit: int = 50) -> List[AudioGenerationJob]:
        stmt = (
            select(AudioGenerationJob)
            .where(AudioGenerationJob.project_id == project_id)
            .order_by(AudioGenerationJob.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def save_generation_job(self, job: AudioGenerationJob) -> AudioGenerationJob:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    # ------------------------------------------------------------------
    # Subtitle Tracks and Entries
    # ------------------------------------------------------------------

    def list_subtitle_tracks_by_project(
        self, project_id: uuid.UUID, scene_id: Optional[uuid.UUID] = None
    ) -> List[SubtitleTrack]:
        stmt = (
            select(SubtitleTrack)
            .options(joinedload(SubtitleTrack.entries))
            .where(SubtitleTrack.project_id == project_id)
        )
        if scene_id:
            stmt = stmt.where(SubtitleTrack.scene_id == scene_id)
        stmt = stmt.order_by(SubtitleTrack.created_at.asc())
        return list(self.db.scalars(stmt).unique().all())

    def get_subtitle_track(self, track_id: uuid.UUID) -> Optional[SubtitleTrack]:
        stmt = (
            select(SubtitleTrack)
            .options(joinedload(SubtitleTrack.entries))
            .where(SubtitleTrack.id == track_id)
        )
        return self.db.scalar(stmt)

    def save_subtitle_track(self, track: SubtitleTrack) -> SubtitleTrack:
        self.db.add(track)
        self.db.commit()
        self.db.refresh(track)
        return track

    def delete_subtitle_track(self, track: SubtitleTrack) -> None:
        self.db.delete(track)
        self.db.commit()

    def get_subtitle_entry(self, entry_id: uuid.UUID) -> Optional[SubtitleEntry]:
        stmt = select(SubtitleEntry).where(SubtitleEntry.id == entry_id)
        return self.db.scalar(stmt)

    def save_subtitle_entry(self, entry: SubtitleEntry) -> SubtitleEntry:
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete_subtitle_entry(self, entry: SubtitleEntry) -> None:
        self.db.delete(entry)
        self.db.commit()
