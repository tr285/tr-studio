"""
StoryService for TR STUDIO Step 2 — AI Story Creation Engine.
Handles:
- 10-step tracked AI story generation workflow with job persistence
- Manual story creation & initialization
- Full story editing & autosave vs. explicit versioned saves
- Granular scene operations (create, update, delete, duplicate, reorder)
- Granular character queries
- Non-destructive AI assistant actions (continue, improve, rewrite, translate, summarize)
- Story version history inspection & safe restoration
- Strict ownership checks on every project, story, scene, version, and job
"""

import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    AppException,
    ForbiddenException,
    NotFoundException,
)
from app.core.logging import logger
from app.models.project import Project, ProjectStatus
from app.models.story import (
    Story,
    StoryGenerationJob,
    StoryScene,
    StoryVersion,
)
from app.models.user import User
from app.repositories.project_repository import ProjectRepository
from app.repositories.story_repository import StoryRepository
from app.schemas.story import (
    AIProviderStatusResponse,
    DialogueEntryData,
    ManualStoryCreateRequest,
    NarrationEntryData,
    SceneCreateRequest,
    SceneReorderRequest,
    SceneUpdateRequest,
    StoryAIAssistProposalResponse,
    StoryAIAssistRequest,
    StoryCharacterData,
    StoryCoreMetadata,
    StoryGenerationRequest,
    StoryLocationData,
    StoryOutputDocument,
    StoryResponse,
    StorySceneData,
    StoryUpdateRequest,
)
from app.services.ai_provider import get_ai_story_provider


class StoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.story_repo = StoryRepository(db)
        self.project_repo = ProjectRepository(db)

    # ------------------------------------------------------------------
    # Ownership & Helper Methods
    # ------------------------------------------------------------------

    def _get_owned_project(self, project_id: uuid.UUID, current_user: User) -> Project:
        project = self.project_repo.get_by_id(project_id)
        if project is None:
            raise NotFoundException(f"Project '{project_id}' was not found.")
        if project.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this project.")
        return project

    def _get_owned_story(self, story_id: uuid.UUID, current_user: User) -> Story:
        story = self.story_repo.get_by_id(story_id)
        if story is None:
            raise NotFoundException(f"Story '{story_id}' was not found.")
        if story.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this story.")
        return story

    def _get_owned_scene(self, scene_id: uuid.UUID, current_user: User) -> tuple[StoryScene, Story]:
        scene = self.story_repo.get_scene_by_id(scene_id)
        if scene is None:
            raise NotFoundException(f"Scene '{scene_id}' was not found.")
        story = self._get_owned_story(scene.story_id, current_user)
        return scene, story

    def _to_story_response(self, story: Story) -> StoryResponse:
        doc = self.story_repo.build_document_from_orm(story)
        return StoryResponse(
            id=story.id,
            project_id=story.project_id,
            owner_id=story.owner_id,
            schema_version=story.schema_version,
            idea=story.idea,
            title=story.title,
            logline=story.logline,
            summary=story.summary,
            full_plot=story.full_plot,
            beginning=story.beginning,
            middle=story.middle,
            ending_act=story.ending_act,
            genre=story.genre,
            animation_style=story.animation_style,
            target_audience=story.target_audience,
            duration_minutes=story.duration_minutes,
            language=story.language,
            main_character_count=story.main_character_count,
            tone=story.tone,
            complexity=story.complexity,
            ending_type=story.ending_type,
            additional_instructions=story.additional_instructions,
            themes=list(story.themes or []),
            world_description=story.world_description,
            current_version_number=story.current_version_number,
            document=doc,
            created_at=story.created_at,
            updated_at=story.updated_at,
        )

    def get_ai_status(self) -> AIProviderStatusResponse:
        settings = get_settings()
        configured = settings.is_ai_configured
        if configured:
            msg = f"AI Story Engine ready ({settings.AI_PROVIDER} • {settings.AI_MODEL})."
        else:
            msg = (
                "AI_API_KEY is not configured in backend .env. "
                "Manual story creation, screenplay editing, and versioning are fully active. "
                "Set AI_API_KEY, AI_PROVIDER, and AI_MODEL to enable live AI generation."
            )
        return AIProviderStatusResponse(
            configured=configured,
            provider=settings.AI_PROVIDER,
            model=settings.AI_MODEL,
            message=msg,
        )

    # ------------------------------------------------------------------
    # 1. AI Story Generation Workflow (Steps 1–10)
    # ------------------------------------------------------------------

    def generate_story(
        self,
        current_user: User,
        payload: StoryGenerationRequest,
    ) -> StoryResponse:
        settings = get_settings()

        # Verify AI provider is configured before mutating project or creating fake data
        provider = get_ai_story_provider(settings)

        # Resolve or create the owning Project
        if payload.project_id:
            project = self._get_owned_project(payload.project_id, current_user)
        else:
            initial_title = (
                payload.title.strip()
                if payload.title and payload.title.strip()
                else f"Story: {payload.idea[:48].strip()}..."
            )
            project = self.project_repo.create(
                owner_id=current_user.id,
                title=initial_title,
                description=payload.idea[:300],
                status=ProjectStatus.IN_PROGRESS.value,
            )

        # Create trackable StoryGenerationJob record
        job = StoryGenerationJob(
            project_id=project.id,
            owner_id=current_user.id,
            job_type="generate_story",
            status="running",
            current_step="Step 3–8: Generating story plan, characters, locations, scenes & screenplay",
            progress=25,
            provider=settings.AI_PROVIDER,
            model_name=settings.AI_MODEL,
            request_payload=payload.model_dump(mode="json"),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        try:
            # Execute AI generation and strict schema validation (Step 3–9)
            validated_doc = provider.generate_story(payload)

            job.current_step = "Step 10: Saving validated story and screenplay to project"
            job.progress = 90
            self.db.add(job)
            self.db.commit()

            # Check if project already has a story
            story = self.story_repo.get_by_project_id(project.id)
            if story is None:
                story = Story(
                    project_id=project.id,
                    owner_id=current_user.id,
                    idea=payload.idea,
                    title=validated_doc.story.title,
                    genre=payload.resolved_genre,
                    animation_style=payload.resolved_animation_style,
                    target_audience=payload.target_audience,
                    duration_minutes=payload.duration_minutes,
                    language=payload.resolved_language,
                    main_character_count=payload.main_character_count,
                    tone=payload.tone,
                    complexity=payload.complexity,
                    ending_type=payload.ending_type,
                    additional_instructions=payload.additional_instructions,
                )
                self.db.add(story)
                self.db.flush()
            else:
                story.idea = payload.idea
                story.main_character_count = payload.main_character_count
                story.additional_instructions = payload.additional_instructions

            # Sync document to relational tables and create a version snapshot
            story = self.story_repo.sync_document_to_relational_tables(
                story=story,
                document=validated_doc,
                create_version=True,
                version_label=f"AI Generated ({settings.AI_PROVIDER}/{settings.AI_MODEL})",
                version_source="ai_generation",
            )

            # Sync project title & description
            project.title = story.title
            project.description = story.logline or story.summary or payload.idea[:300]
            project.status = ProjectStatus.IN_PROGRESS.value
            self.project_repo.update(project)

            # Mark job completed
            job.story_id = story.id
            job.status = "completed"
            job.current_step = "Completed"
            job.progress = 100
            job.result_payload = {"story_id": str(story.id), "title": story.title}
            self.db.add(job)
            self.db.commit()

            logger.info("Completed AI story generation story_id=%s project_id=%s", story.id, project.id)
            return self._to_story_response(story)

        except Exception as exc:
            job.status = "failed"
            job.current_step = "Generation failed"
            job.error_message = str(getattr(exc, "detail", str(exc)))
            self.db.add(job)
            self.db.commit()
            raise

    # ------------------------------------------------------------------
    # 2. Manual Story Creation & Retrieval
    # ------------------------------------------------------------------

    def create_manual_story(
        self,
        current_user: User,
        payload: ManualStoryCreateRequest,
    ) -> StoryResponse:
        if payload.project_id:
            project = self._get_owned_project(payload.project_id, current_user)
        else:
            project = self.project_repo.create(
                owner_id=current_user.id,
                title=payload.title.strip(),
                description=payload.logline or payload.summary or payload.idea[:300],
                status=ProjectStatus.IN_PROGRESS.value,
            )

        existing = self.story_repo.get_by_project_id(project.id)
        if existing is not None:
            raise AppException(
                detail="This project already has a story initialized. Use PATCH to update it.",
                status_code=409,
                error_code="STORY_ALREADY_EXISTS",
            )

        if payload.document is not None:
            doc = payload.document
        else:
            # Build clean editable starter structure from the user's manual inputs
            default_loc_id = str(uuid.uuid4())
            default_char_id = str(uuid.uuid4())
            doc = StoryOutputDocument(
                schema_version="1.0",
                story=StoryCoreMetadata(
                    title=payload.title.strip(),
                    logline=payload.logline or payload.idea[:180],
                    summary=payload.summary or payload.idea,
                    full_plot=payload.summary or payload.idea,
                    beginning="Act I — Setup and inciting incident.",
                    middle="Act II — Rising challenges and character transformation.",
                    ending="Act III — Climax and resolution.",
                    genre=payload.genre,
                    animation_style=payload.animation_style,
                    tone=payload.tone,
                    complexity=payload.complexity,
                    ending_type=payload.ending_type,
                    target_audience=payload.target_audience,
                    duration_minutes=payload.duration_minutes,
                    language=payload.language,
                    themes=[payload.genre, payload.tone],
                    world_description="Primary world setting for the story.",
                ),
                characters=[
                    StoryCharacterData(
                        id=default_char_id,
                        name="Protagonist",
                        role="Protagonist",
                        age_description="Young lead",
                        personality=["Determined", "Curious"],
                        appearance_description="Lead character visual design.",
                        motivation="Fulfill the core journey of the story.",
                        backstory="Introduced in Scene 1.",
                        relationships=[],
                    )
                ],
                locations=[
                    StoryLocationData(
                        id=default_loc_id,
                        name="Opening Setting",
                        description="Primary opening environment.",
                        atmosphere=payload.tone,
                        time_of_day="Day",
                        environment_requirements="Standard lighting and background layers.",
                    )
                ],
                scenes=[
                    StorySceneData(
                        id=str(uuid.uuid4()),
                        scene_number=1,
                        title="Scene 1: Opening",
                        scene_heading="EXT. OPENING SETTING - DAY",
                        location_id=default_loc_id,
                        location_name="Opening Setting",
                        description=payload.idea,
                        action_description="The camera establishes the opening setting as the protagonist enters.",
                        duration_seconds=30,
                        characters=["Protagonist"],
                        dialogue=[
                            DialogueEntryData(
                                id=str(uuid.uuid4()),
                                character_id=default_char_id,
                                character_name="Protagonist",
                                line="Everything changes starting today.",
                                emotion="Determined",
                                delivery_direction="Looking toward the horizon",
                            )
                        ],
                        narration=[
                            NarrationEntryData(
                                id=str(uuid.uuid4()),
                                narrator_voice="Narrator (V.O.)",
                                text=payload.idea,
                                emotion=payload.tone,
                            )
                        ],
                        camera_directions=["WIDE ESTABLISHING SHOT", "MEDIUM TRACKING SHOT"],
                        audio_directions=["Ambient wind and subtle theme motif"],
                        visual_directions=["Warm key light across the foreground"],
                        emotional_directions=[payload.tone],
                        storyboard_notes="Establish world scale in Frame 1.",
                    )
                ],
            )

        story = Story(
            project_id=project.id,
            owner_id=current_user.id,
            idea=payload.idea,
            title=doc.story.title,
            genre=doc.story.genre,
            animation_style=doc.story.animation_style,
            target_audience=doc.story.target_audience,
            duration_minutes=doc.story.duration_minutes,
            language=doc.story.language,
            main_character_count=payload.main_character_count,
            tone=doc.story.tone,
            complexity=doc.story.complexity,
            ending_type=doc.story.ending_type,
            additional_instructions=payload.additional_instructions,
        )
        self.db.add(story)
        self.db.flush()

        story = self.story_repo.sync_document_to_relational_tables(
            story=story,
            document=doc,
            create_version=True,
            version_label="Initial Manual Story Creation",
            version_source="manual_create",
        )

        project.title = story.title
        project.description = story.logline or story.summary or payload.idea[:300]
        project.status = ProjectStatus.IN_PROGRESS.value
        self.project_repo.update(project)

        return self._to_story_response(story)

    def get_story(self, current_user: User, story_id: uuid.UUID) -> StoryResponse:
        story = self._get_owned_story(story_id, current_user)
        return self._to_story_response(story)

    def get_story_by_project(self, current_user: User, project_id: uuid.UUID) -> StoryResponse:
        self._get_owned_project(project_id, current_user)
        story = self.story_repo.get_by_project_id(project_id)
        if story is None:
            raise NotFoundException("No story has been created for this project yet.")
        return self._to_story_response(story)

    def update_story(
        self,
        current_user: User,
        story_id: uuid.UUID,
        payload: StoryUpdateRequest,
    ) -> StoryResponse:
        story = self._get_owned_story(story_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)

        if payload.idea is not None:
            story.idea = payload.idea
        if payload.title is not None:
            doc.story.title = payload.title.strip()
        if payload.logline is not None:
            doc.story.logline = payload.logline
        if payload.summary is not None:
            doc.story.summary = payload.summary
        if payload.full_plot is not None:
            doc.story.full_plot = payload.full_plot
        if payload.beginning is not None:
            doc.story.beginning = payload.beginning
        if payload.middle is not None:
            doc.story.middle = payload.middle
        if payload.ending_act is not None:
            doc.story.ending = payload.ending_act
        if payload.genre is not None:
            doc.story.genre = payload.genre
        if payload.animation_style is not None:
            doc.story.animation_style = payload.animation_style
        if payload.target_audience is not None:
            doc.story.target_audience = payload.target_audience
        if payload.duration_minutes is not None:
            doc.story.duration_minutes = payload.duration_minutes
        if payload.language is not None:
            doc.story.language = payload.language
        if payload.tone is not None:
            doc.story.tone = payload.tone
        if payload.complexity is not None:
            doc.story.complexity = payload.complexity
        if payload.ending_type is not None:
            doc.story.ending_type = payload.ending_type
        if payload.themes is not None:
            doc.story.themes = payload.themes
        if payload.world_description is not None:
            doc.story.world_description = payload.world_description
        if payload.characters is not None:
            doc.characters = payload.characters
        if payload.locations is not None:
            doc.locations = payload.locations
        if payload.scenes is not None:
            doc.scenes = payload.scenes

        story = self.story_repo.sync_document_to_relational_tables(
            story=story,
            document=doc,
            create_version=payload.create_version,
            version_label=payload.version_label,
            version_source="manual_save" if payload.create_version else "autosave",
        )

        # Keep parent project title synchronized
        project = self.project_repo.get_by_id(story.project_id)
        if project:
            project.title = story.title
            project.description = story.logline or story.summary or story.idea[:300]
            self.project_repo.update(project)

        return self._to_story_response(story)

    def delete_story(self, current_user: User, story_id: uuid.UUID) -> None:
        story = self._get_owned_story(story_id, current_user)
        self.db.delete(story)
        self.db.commit()

    # ------------------------------------------------------------------
    # 3. Granular Character & Scene Endpoints
    # ------------------------------------------------------------------

    def list_characters(self, current_user: User, story_id: uuid.UUID) -> List[StoryCharacterData]:
        story = self._get_owned_story(story_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)
        return doc.characters

    def list_scenes(self, current_user: User, story_id: uuid.UUID) -> List[StorySceneData]:
        story = self._get_owned_story(story_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)
        return doc.scenes

    def add_scene(
        self,
        current_user: User,
        story_id: uuid.UUID,
        payload: SceneCreateRequest,
    ) -> StorySceneData:
        story = self._get_owned_story(story_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)

        next_number = len(doc.scenes) + 1
        new_scene = StorySceneData(
            id=str(uuid.uuid4()),
            scene_number=next_number,
            title=payload.title,
            scene_heading=payload.scene_heading,
            location_id=payload.location_id,
            location_name=payload.location_name,
            description=payload.description,
            action_description=payload.action_description,
            duration_seconds=payload.duration_seconds,
            characters=payload.characters,
            dialogue=payload.dialogue,
            narration=payload.narration,
            camera_directions=payload.camera_directions,
            audio_directions=payload.audio_directions,
            visual_directions=payload.visual_directions,
            emotional_directions=payload.emotional_directions,
            storyboard_notes=payload.storyboard_notes,
        )
        doc.scenes.append(new_scene)
        self.story_repo.sync_document_to_relational_tables(story, doc, create_version=False)
        return new_scene

    def update_scene(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneUpdateRequest,
    ) -> StorySceneData:
        _, story = self._get_owned_scene(scene_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)

        target_scene: Optional[StorySceneData] = None
        for sc in doc.scenes:
            if sc.id == str(scene_id):
                if payload.title is not None:
                    sc.title = payload.title
                if payload.scene_heading is not None:
                    sc.scene_heading = payload.scene_heading
                if payload.location_id is not None:
                    sc.location_id = payload.location_id
                if payload.location_name is not None:
                    sc.location_name = payload.location_name
                if payload.description is not None:
                    sc.description = payload.description
                if payload.action_description is not None:
                    sc.action_description = payload.action_description
                if payload.duration_seconds is not None:
                    sc.duration_seconds = payload.duration_seconds
                if payload.characters is not None:
                    sc.characters = payload.characters
                if payload.dialogue is not None:
                    sc.dialogue = payload.dialogue
                if payload.narration is not None:
                    sc.narration = payload.narration
                if payload.camera_directions is not None:
                    sc.camera_directions = payload.camera_directions
                if payload.audio_directions is not None:
                    sc.audio_directions = payload.audio_directions
                if payload.visual_directions is not None:
                    sc.visual_directions = payload.visual_directions
                if payload.emotional_directions is not None:
                    sc.emotional_directions = payload.emotional_directions
                if payload.storyboard_notes is not None:
                    sc.storyboard_notes = payload.storyboard_notes
                target_scene = sc
                break

        if target_scene is None:
            raise NotFoundException(f"Scene '{scene_id}' not found in story.")

        self.story_repo.sync_document_to_relational_tables(story, doc, create_version=False)
        return target_scene

    def delete_scene(self, current_user: User, scene_id: uuid.UUID) -> None:
        _, story = self._get_owned_scene(scene_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)
        doc.scenes = [sc for sc in doc.scenes if sc.id != str(scene_id)]
        for idx, sc in enumerate(doc.scenes, start=1):
            sc.scene_number = idx
        self.story_repo.sync_document_to_relational_tables(story, doc, create_version=False)

    def duplicate_scene(self, current_user: User, scene_id: uuid.UUID) -> StorySceneData:
        _, story = self._get_owned_scene(scene_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)

        insert_idx = len(doc.scenes)
        duplicated: Optional[StorySceneData] = None

        for idx, sc in enumerate(doc.scenes):
            if sc.id == str(scene_id):
                insert_idx = idx + 1
                duplicated = StorySceneData(
                    id=str(uuid.uuid4()),
                    scene_number=sc.scene_number + 1,
                    title=f"{sc.title} (Copy)",
                    scene_heading=sc.scene_heading,
                    location_id=sc.location_id,
                    location_name=sc.location_name,
                    description=sc.description,
                    action_description=sc.action_description,
                    duration_seconds=sc.duration_seconds,
                    characters=list(sc.characters),
                    dialogue=[
                        DialogueEntryData(
                            id=str(uuid.uuid4()),
                            character_id=d.character_id,
                            character_name=d.character_name,
                            line=d.line,
                            emotion=d.emotion,
                            delivery_direction=d.delivery_direction,
                        )
                        for d in sc.dialogue
                    ],
                    narration=[
                        NarrationEntryData(
                            id=str(uuid.uuid4()),
                            narrator_voice=n.narrator_voice,
                            text=n.text,
                            emotion=n.emotion,
                        )
                        for n in sc.narration
                    ],
                    camera_directions=list(sc.camera_directions),
                    audio_directions=list(sc.audio_directions),
                    visual_directions=list(sc.visual_directions),
                    emotional_directions=list(sc.emotional_directions),
                    storyboard_notes=sc.storyboard_notes,
                )
                break

        if duplicated is None:
            raise NotFoundException(f"Scene '{scene_id}' not found.")

        doc.scenes.insert(insert_idx, duplicated)
        for idx, sc in enumerate(doc.scenes, start=1):
            sc.scene_number = idx

        self.story_repo.sync_document_to_relational_tables(story, doc, create_version=False)
        return duplicated

    def reorder_scenes(
        self,
        current_user: User,
        story_id: uuid.UUID,
        payload: SceneReorderRequest,
    ) -> List[StorySceneData]:
        story = self._get_owned_story(story_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)

        scene_by_id = {sc.id: sc for sc in doc.scenes}
        reordered: List[StorySceneData] = []
        for s_id in payload.scene_ids:
            if s_id in scene_by_id:
                reordered.append(scene_by_id.pop(s_id))
        # Append any remaining scenes not explicitly listed so no scene is ever lost
        for remaining in scene_by_id.values():
            reordered.append(remaining)

        for idx, sc in enumerate(reordered, start=1):
            sc.scene_number = idx

        doc.scenes = reordered
        self.story_repo.sync_document_to_relational_tables(story, doc, create_version=False)
        return doc.scenes

    # ------------------------------------------------------------------
    # 4. Contextual AI Assistant Actions (Non-Destructive by Default)
    # ------------------------------------------------------------------

    def run_ai_assist(
        self,
        current_user: User,
        story_id: uuid.UUID,
        payload: StoryAIAssistRequest,
    ) -> StoryAIAssistProposalResponse:
        story = self._get_owned_story(story_id, current_user)
        original_doc = self.story_repo.build_document_from_orm(story)
        provider = get_ai_story_provider()

        if payload.action == "continue_story":
            proposed_doc, summary = provider.continue_story(original_doc, payload.instructions)
        elif payload.action == "translate_story":
            target_lang = payload.target_language or "Japanese"
            proposed_doc, summary = provider.translate_story(original_doc, target_lang)
        elif payload.action == "summarize_story":
            proposed_doc, summary = provider.summarize_story(original_doc)
        elif payload.action == "rewrite_dialogue":
            proposed_doc, summary = provider.rewrite_story(original_doc, payload)
        else:
            proposed_doc, summary = provider.improve_story(original_doc, payload)

        applied = False
        if payload.apply_immediately:
            self.story_repo.sync_document_to_relational_tables(
                story=story,
                document=proposed_doc,
                create_version=True,
                version_label=f"AI Action: {payload.action}",
                version_source=f"ai_{payload.action}",
            )
            applied = True

        return StoryAIAssistProposalResponse(
            story_id=story.id,
            action=payload.action,
            summary_of_changes=summary,
            applied=applied,
            original_document=original_doc,
            proposed_document=proposed_doc,
        )

    # ------------------------------------------------------------------
    # 5. Story Versioning (List, Create Snapshot, Restore Version)
    # ------------------------------------------------------------------

    def list_story_versions(
        self,
        current_user: User,
        story_id: uuid.UUID,
    ) -> List[StoryVersion]:
        story = self._get_owned_story(story_id, current_user)
        return self.story_repo.list_versions(story.id)

    def create_story_version(
        self,
        current_user: User,
        story_id: uuid.UUID,
        label: Optional[str] = None,
    ) -> StoryVersion:
        story = self._get_owned_story(story_id, current_user)
        doc = self.story_repo.build_document_from_orm(story)
        self.story_repo.sync_document_to_relational_tables(
            story=story,
            document=doc,
            create_version=True,
            version_label=label or f"Manual Snapshot — {story.title}",
            version_source="manual_snapshot",
        )
        versions = self.story_repo.list_versions(story.id)
        return versions[0]

    def restore_story_version(
        self,
        current_user: User,
        story_id: uuid.UUID,
        version_id: uuid.UUID,
    ) -> StoryResponse:
        story = self._get_owned_story(story_id, current_user)
        version = self.story_repo.get_version(story.id, version_id)
        if version is None:
            raise NotFoundException(f"Story version '{version_id}' was not found.")

        restored_doc = StoryOutputDocument.model_validate(version.snapshot)
        story = self.story_repo.sync_document_to_relational_tables(
            story=story,
            document=restored_doc,
            create_version=True,
            version_label=f"Restored from Version #{version.version_number} ({version.label})",
            version_source="version_restore",
        )
        return self._to_story_response(story)

    def list_project_jobs(
        self,
        current_user: User,
        project_id: uuid.UUID,
    ) -> List[StoryGenerationJob]:
        self._get_owned_project(project_id, current_user)
        return self.story_repo.list_jobs_by_project(project_id)
