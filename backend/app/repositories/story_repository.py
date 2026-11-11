"""
Repository for Story, StoryVersion, StoryCharacter, CharacterRelationship,
StoryLocation, StoryScene, DialogueEntry, NarrationEntry, and StoryGenerationJob.
Synchronizes relational tables with the canonical StoryOutputDocument JSONB structure.
"""

import uuid
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.story import (
    CharacterRelationship,
    DialogueEntry,
    NarrationEntry,
    Story,
    StoryCharacter,
    StoryGenerationJob,
    StoryLocation,
    StoryScene,
    StoryVersion,
)
from app.schemas.story import (
    CharacterRelationshipData,
    DialogueEntryData,
    NarrationEntryData,
    StoryCharacterData,
    StoryCoreMetadata,
    StoryLocationData,
    StoryOutputDocument,
    StorySceneData,
)


def _safe_uuid(val: Optional[str]) -> uuid.UUID:
    if val:
        try:
            return uuid.UUID(str(val))
        except ValueError:
            pass
    return uuid.uuid4()


def _safe_optional_uuid(val: Optional[str]) -> Optional[uuid.UUID]:
    if not val:
        return None
    try:
        return uuid.UUID(str(val))
    except ValueError:
        return None


class StoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, story_id: uuid.UUID) -> Optional[Story]:
        stmt = select(Story).where(Story.id == story_id)
        return self.db.scalar(stmt)

    def get_by_project_id(self, project_id: uuid.UUID) -> Optional[Story]:
        stmt = select(Story).where(Story.project_id == project_id)
        return self.db.scalar(stmt)

    def get_scene_by_id(self, scene_id: uuid.UUID) -> Optional[StoryScene]:
        stmt = select(StoryScene).where(StoryScene.id == scene_id)
        return self.db.scalar(stmt)

    def get_job_by_id(self, job_id: uuid.UUID) -> Optional[StoryGenerationJob]:
        stmt = select(StoryGenerationJob).where(StoryGenerationJob.id == job_id)
        return self.db.scalar(stmt)

    def list_jobs_by_project(self, project_id: uuid.UUID) -> List[StoryGenerationJob]:
        stmt = (
            select(StoryGenerationJob)
            .where(StoryGenerationJob.project_id == project_id)
            .order_by(StoryGenerationJob.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def list_versions(self, story_id: uuid.UUID) -> List[StoryVersion]:
        stmt = (
            select(StoryVersion)
            .where(StoryVersion.story_id == story_id)
            .order_by(StoryVersion.version_number.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_version(self, story_id: uuid.UUID, version_id: uuid.UUID) -> Optional[StoryVersion]:
        stmt = select(StoryVersion).where(
            StoryVersion.story_id == story_id,
            StoryVersion.id == version_id,
        )
        return self.db.scalar(stmt)

    def build_document_from_orm(self, story: Story) -> StoryOutputDocument:
        """Reconstruct a validated `StoryOutputDocument` from relational rows."""
        characters_data: List[StoryCharacterData] = []
        for ch in story.characters:
            rels = [
                CharacterRelationshipData.model_validate(r)
                for r in (ch.relationships_data or [])
            ]
            characters_data.append(
                StoryCharacterData(
                    id=str(ch.id),
                    name=ch.name,
                    role=ch.role,
                    age_description=ch.age_description or "",
                    personality=list(ch.personality or []),
                    appearance_description=ch.appearance_description or "",
                    motivation=ch.motivation or "",
                    backstory=ch.backstory or "",
                    relationships=rels,
                )
            )

        locations_data: List[StoryLocationData] = []
        for loc in story.locations:
            locations_data.append(
                StoryLocationData(
                    id=str(loc.id),
                    name=loc.name,
                    description=loc.description or "",
                    atmosphere=loc.atmosphere or "",
                    time_of_day=loc.time_of_day or "",
                    environment_requirements=loc.environment_requirements or "",
                )
            )

        scenes_data: List[StorySceneData] = []
        ordered_scenes = sorted(story.scenes, key=lambda s: s.scene_number)
        for sc in ordered_scenes:
            dialogue_list = [
                DialogueEntryData(
                    id=str(d.id),
                    character_id=str(d.character_id) if d.character_id else None,
                    character_name=d.character_name,
                    line=d.line,
                    emotion=d.emotion or "",
                    delivery_direction=d.delivery_direction or "",
                )
                for d in sorted(sc.dialogue_entries, key=lambda x: x.line_order)
            ]
            narration_list = [
                NarrationEntryData(
                    id=str(n.id),
                    narrator_voice=n.narrator_voice,
                    text=n.text,
                    emotion=n.emotion or "",
                )
                for n in sorted(sc.narration_entries, key=lambda x: x.entry_order)
            ]
            scenes_data.append(
                StorySceneData(
                    id=str(sc.id),
                    scene_number=sc.scene_number,
                    title=sc.title,
                    scene_heading=sc.scene_heading or "EXT. LOCATION - DAY",
                    location_id=str(sc.location_id) if sc.location_id else None,
                    location_name=sc.location_name or "",
                    description=sc.description or "",
                    action_description=sc.action_description or "",
                    duration_seconds=sc.duration_seconds,
                    characters=list(sc.characters or []),
                    dialogue=dialogue_list,
                    narration=narration_list,
                    camera_directions=list(sc.camera_directions or []),
                    audio_directions=list(sc.audio_directions or []),
                    visual_directions=list(sc.visual_directions or []),
                    emotional_directions=list(sc.emotional_directions or []),
                    storyboard_notes=sc.storyboard_notes or "",
                )
            )

        return StoryOutputDocument(
            schema_version=story.schema_version or "1.0",
            story=StoryCoreMetadata(
                title=story.title,
                logline=story.logline or "",
                summary=story.summary or "",
                full_plot=story.full_plot or "",
                beginning=story.beginning or "",
                middle=story.middle or "",
                ending=story.ending_act or "",
                genre=story.genre,
                animation_style=story.animation_style,
                tone=story.tone,
                complexity=story.complexity,
                ending_type=story.ending_type,
                target_audience=story.target_audience,
                duration_minutes=story.duration_minutes,
                language=story.language,
                themes=list(story.themes or []),
                world_description=story.world_description or "",
            ),
            characters=characters_data,
            locations=locations_data,
            scenes=scenes_data,
        )

    def sync_document_to_relational_tables(
        self,
        story: Story,
        document: StoryOutputDocument,
        create_version: bool = False,
        version_label: Optional[str] = None,
        version_source: str = "manual_save",
    ) -> Story:
        """
        Atomically synchronize a validated `StoryOutputDocument` into:
        - `stories` metadata & `structured_data` JSONB
        - `story_characters` & `character_relationships`
        - `story_locations`
        - `story_scenes`, `dialogue_entries`, `narration_entries`
        - `story_versions` (when `create_version=True`)
        """
        story_id = story.id

        # Snapshot existing Step 5 Scene Builder attributes by scene UUID so they are never lost during sync
        existing_scene_rows = list(
            self.db.scalars(
                select(StoryScene).where(StoryScene.story_id == story_id)
            ).all()
        )
        preserved_scene_attrs: dict[str, dict] = {}
        for prev_sc in existing_scene_rows:
            preserved_scene_attrs[str(prev_sc.id)] = {
                "environment_id": prev_sc.environment_id,
                "world_location_id": prev_sc.world_location_id,
                "scene_type": prev_sc.scene_type or "Narrative",
                "summary": prev_sc.summary,
                "time_of_day": prev_sc.time_of_day or "Day",
                "weather": prev_sc.weather or "Clear",
                "mood": prev_sc.mood or "Cinematic",
                "camera_framing": prev_sc.camera_framing or "Wide establishing shot",
                "transition_type": prev_sc.transition_type or "Cut",
                "production_notes": prev_sc.production_notes,
                "scene_metadata": dict(prev_sc.scene_metadata or {}),
            }

        # Clear existing child entities for this story in PostgreSQL
        self.db.execute(
            delete(DialogueEntry)
            .where(
                DialogueEntry.scene_id.in_(
                    select(StoryScene.id).where(StoryScene.story_id == story_id)
                )
            )
            .execution_options(synchronize_session=False)
        )
        self.db.execute(
            delete(NarrationEntry)
            .where(
                NarrationEntry.scene_id.in_(
                    select(StoryScene.id).where(StoryScene.story_id == story_id)
                )
            )
            .execution_options(synchronize_session=False)
        )
        self.db.execute(
            delete(StoryScene)
            .where(StoryScene.story_id == story_id)
            .execution_options(synchronize_session=False)
        )
        self.db.execute(
            delete(CharacterRelationship)
            .where(CharacterRelationship.story_id == story_id)
            .execution_options(synchronize_session=False)
        )
        self.db.execute(
            delete(StoryCharacter)
            .where(StoryCharacter.story_id == story_id)
            .execution_options(synchronize_session=False)
        )
        self.db.execute(
            delete(StoryLocation)
            .where(StoryLocation.story_id == story_id)
            .execution_options(synchronize_session=False)
        )
        self.db.flush()

        # Clear session identity map so re-inserting entities with preserved UUIDs never conflicts
        self.db.expunge_all()
        reloaded_story = self.db.get(Story, story_id)
        assert reloaded_story is not None
        story = reloaded_story

        meta = document.story
        story.schema_version = document.schema_version or "1.0"
        story.title = meta.title
        story.logline = meta.logline
        story.summary = meta.summary
        story.full_plot = meta.full_plot
        story.beginning = meta.beginning
        story.middle = meta.middle
        story.ending_act = meta.ending
        story.genre = meta.genre
        story.animation_style = meta.animation_style
        story.tone = meta.tone
        story.complexity = meta.complexity
        story.ending_type = meta.ending_type
        story.target_audience = meta.target_audience
        story.duration_minutes = meta.duration_minutes
        story.language = meta.language
        story.themes = list(meta.themes or [])
        story.world_description = meta.world_description

        # 1. Insert Characters
        char_id_map: dict[str, uuid.UUID] = {}
        char_name_map: dict[str, uuid.UUID] = {}
        for ch_data in document.characters:
            c_uuid = _safe_uuid(ch_data.id)
            ch_data.id = str(c_uuid)
            char_id_map[ch_data.id] = c_uuid
            char_name_map[ch_data.name.strip().lower()] = c_uuid

            ch_orm = StoryCharacter(
                id=c_uuid,
                story_id=story.id,
                name=ch_data.name,
                role=ch_data.role,
                age_description=ch_data.age_description,
                personality=list(ch_data.personality or []),
                appearance_description=ch_data.appearance_description,
                motivation=ch_data.motivation,
                backstory=ch_data.backstory,
                relationships_data=[r.model_dump() for r in ch_data.relationships],
            )
            self.db.add(ch_orm)

        self.db.flush()

        # 2. Insert Character Relationships
        for ch_data in document.characters:
            src_uuid = char_id_map.get(ch_data.id)
            for rel_data in ch_data.relationships:
                r_uuid = _safe_uuid(rel_data.id)
                rel_data.id = str(r_uuid)
                tgt_uuid = _safe_optional_uuid(rel_data.target_character_id)
                if not tgt_uuid:
                    tgt_uuid = char_name_map.get(rel_data.target_character_name.strip().lower())
                if tgt_uuid:
                    rel_data.target_character_id = str(tgt_uuid)

                rel_orm = CharacterRelationship(
                    id=r_uuid,
                    story_id=story.id,
                    source_character_id=src_uuid,
                    target_character_id=tgt_uuid,
                    source_character_name=ch_data.name,
                    target_character_name=rel_data.target_character_name,
                    relationship_type=rel_data.relationship_type,
                    description=rel_data.description,
                )
                self.db.add(rel_orm)

        # 3. Insert Locations
        loc_id_map: dict[str, uuid.UUID] = {}
        loc_name_map: dict[str, uuid.UUID] = {}
        for loc_data in document.locations:
            l_uuid = _safe_uuid(loc_data.id)
            loc_data.id = str(l_uuid)
            loc_id_map[loc_data.id] = l_uuid
            loc_name_map[loc_data.name.strip().lower()] = l_uuid

            loc_orm = StoryLocation(
                id=l_uuid,
                story_id=story.id,
                name=loc_data.name,
                description=loc_data.description,
                atmosphere=loc_data.atmosphere,
                time_of_day=loc_data.time_of_day,
                environment_requirements=loc_data.environment_requirements,
            )
            self.db.add(loc_orm)

        self.db.flush()

        # 4. Insert Scenes, Dialogue, and Narration
        for idx, sc_data in enumerate(document.scenes, start=1):
            s_uuid = _safe_uuid(sc_data.id)
            sc_data.id = str(s_uuid)
            sc_data.scene_number = idx

            resolved_loc_uuid = _safe_optional_uuid(sc_data.location_id)
            if resolved_loc_uuid and str(resolved_loc_uuid) not in loc_id_map:
                resolved_loc_uuid = None
            if not resolved_loc_uuid and sc_data.location_name:
                resolved_loc_uuid = loc_name_map.get(sc_data.location_name.strip().lower())
            sc_data.location_id = str(resolved_loc_uuid) if resolved_loc_uuid else None

            prev_ext = preserved_scene_attrs.get(str(s_uuid), {})
            sc_orm = StoryScene(
                id=s_uuid,
                story_id=story.id,
                location_id=resolved_loc_uuid,
                location_name=sc_data.location_name,
                scene_number=idx,
                title=sc_data.title,
                scene_heading=sc_data.scene_heading,
                description=sc_data.description,
                action_description=sc_data.action_description,
                duration_seconds=sc_data.duration_seconds,
                characters=list(sc_data.characters or []),
                camera_directions=list(sc_data.camera_directions or []),
                audio_directions=list(sc_data.audio_directions or []),
                visual_directions=list(sc_data.visual_directions or []),
                emotional_directions=list(sc_data.emotional_directions or []),
                storyboard_notes=sc_data.storyboard_notes,
                environment_id=prev_ext.get("environment_id"),
                world_location_id=prev_ext.get("world_location_id"),
                scene_type=prev_ext.get("scene_type", "Narrative"),
                summary=prev_ext.get("summary") or sc_data.description,
                time_of_day=prev_ext.get("time_of_day", "Day"),
                weather=prev_ext.get("weather", "Clear"),
                mood=prev_ext.get("mood", "Cinematic"),
                camera_framing=prev_ext.get("camera_framing", "Wide establishing shot"),
                transition_type=prev_ext.get("transition_type", "Cut"),
                production_notes=prev_ext.get("production_notes") or sc_data.storyboard_notes,
                scene_metadata=prev_ext.get("scene_metadata", {}),
            )
            self.db.add(sc_orm)
            self.db.flush()

            for d_idx, d_data in enumerate(sc_data.dialogue, start=1):
                d_uuid = _safe_uuid(d_data.id)
                d_data.id = str(d_uuid)
                c_uuid = _safe_optional_uuid(d_data.character_id)
                if c_uuid and str(c_uuid) not in char_id_map:
                    c_uuid = None
                if not c_uuid and d_data.character_name:
                    c_uuid = char_name_map.get(d_data.character_name.strip().lower())
                d_data.character_id = str(c_uuid) if c_uuid else None

                d_orm = DialogueEntry(
                    id=d_uuid,
                    scene_id=s_uuid,
                    character_id=c_uuid,
                    character_name=d_data.character_name,
                    line=d_data.line,
                    emotion=d_data.emotion,
                    delivery_direction=d_data.delivery_direction,
                    line_order=d_idx,
                )
                self.db.add(d_orm)

            for n_idx, n_data in enumerate(sc_data.narration, start=1):
                n_uuid = _safe_uuid(n_data.id)
                n_data.id = str(n_uuid)
                n_orm = NarrationEntry(
                    id=n_uuid,
                    scene_id=s_uuid,
                    narrator_voice=n_data.narrator_voice,
                    text=n_data.text,
                    emotion=n_data.emotion,
                    entry_order=n_idx,
                )
                self.db.add(n_orm)

        # Store normalized JSONB document on Story
        normalized_dict = document.model_dump(mode="json")
        story.structured_data = normalized_dict

        if create_version:
            existing_versions = self.list_versions(story.id)
            next_v = (existing_versions[0].version_number + 1) if existing_versions else 1
            story.current_version_number = next_v
            v_orm = StoryVersion(
                story_id=story.id,
                version_number=next_v,
                label=version_label or f"Version {next_v} — {story.title}",
                source=version_source,
                snapshot=normalized_dict,
            )
            self.db.add(v_orm)

        self.db.add(story)
        self.db.commit()
        self.db.refresh(story)
        return story
