"""
Service Layer for TR STUDIO Step 5 — Professional Scene Builder & Storyboard Studio.
Coordinates:
- Scene CRUD, duplication, and sequence reordering (`StoryScene`)
- Scene Shot-List planning (`SceneShot`)
- Scene Character assignments (`SceneCharacterAssignment`) referencing Step 3 `Character` & Step 2 `StoryCharacter` without duplicating character records
- Scene Environment & World Location linking referencing Step 4 `Environment` & `WorldLocation` without duplicating environment records
- Scene Visual Asset layer assignments (`SceneAssetAssignment`) referencing Step 3 `CharacterAsset` & Step 4 `EnvironmentAsset`
- Missing reference detection (gracefully reporting missing/deleted characters, environments, or assets without crashing)
- Story <-> Scene bidirectional synchronization (`sync_scenes_with_story`)
- AI-assisted scene and shot-list generation with non-destructive review workflow (`SceneGenerationJob`)
"""

import json
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    AIConfigurationException,
    AIProviderException,
    AppException,
    ForbiddenException,
    NotFoundException,
)
from app.models.character import (
    Character,
    CharacterAsset,
    CharacterExpression,
    CharacterOutfit,
    CharacterPose,
)
from app.models.environment import (
    Environment,
    EnvironmentAsset,
    EnvironmentVariation,
    World,
    WorldLocation,
)
from app.models.project import Project
from app.models.scene import (
    SceneAssetAssignment,
    SceneCharacterAssignment,
    SceneGenerationJob,
    SceneShot,
)
from app.models.story import (
    DialogueEntry,
    NarrationEntry,
    Story,
    StoryCharacter,
    StoryLocation,
    StoryScene,
)
from app.models.user import User
from app.repositories.character_repository import CharacterRepository
from app.repositories.environment_repository import EnvironmentRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.scene_repository import SceneRepository
from app.repositories.story_repository import StoryRepository
from app.schemas.scene import (
    ProposedSceneItem,
    ProposedShotItem,
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
    SceneEnvironmentPreview,
    SceneGenerationJobResponse,
    SceneShotCreateRequest,
    SceneShotReorderRequest,
    SceneShotResponse,
    SceneShotUpdateRequest,
    SceneStorySyncResponse,
    SceneWorldLocationPreview,
    StoryboardCardResponse,
    StoryboardOverviewResponse,
)
from app.schemas.story import DialogueEntryData, NarrationEntryData
from app.services.ai_provider import get_ai_story_provider
from app.services.storage_service import get_storage_backend


SCENE_AI_SYSTEM_PROMPT = """You are the Lead Storyboard Director & Cinematographer for TR STUDIO, a professional animated story creation platform.
Return ONLY a single valid JSON object matching this exact structure (no markdown fences):
{
  "summary_of_suggestions": "Concise 1-2 sentence explanation of the scene/shot recommendations.",
  "proposed_scenes": [
    {
      "id": "uuid-v4",
      "scene_number": 1,
      "title": "Scene title",
      "scene_type": "Opening | Dialogue | Action | Emotional | Travel / Transition | Climax | Ending | Custom",
      "scene_heading": "INT./EXT. LOCATION - TIME",
      "summary": "1-2 sentence summary",
      "description": "Rich visual setting and atmospheric description",
      "action_description": "Staging and character blocking",
      "location_name": "Location name",
      "suggested_environment_name": "Suggested environment name",
      "suggested_characters": ["Character Name"],
      "time_of_day": "Day | Sunset | Night | Dawn",
      "weather": "Clear | Rain | Fog | Snow | Storm",
      "mood": "Cinematic | Tense | Hopeful | Mysterious | Joyful",
      "duration_seconds": 30,
      "camera_framing": "Wide establishing shot | Medium shot | Close-up | Over-the-shoulder",
      "transition_type": "Cut | Fade in | Fade out | Cross dissolve | Wipe",
      "visual_directions": ["Key lighting cue", "Staging detail"],
      "camera_directions": ["Camera movement cue"],
      "audio_directions": ["Ambient audio / music cue"],
      "production_notes": "Director notes",
      "shots": [
        {
          "id": "uuid-v4",
          "shot_number": 1,
          "title": "Shot title",
          "description": "Shot staging description",
          "shot_type": "establishing | wide | medium | close-up | extreme close-up | over-the-shoulder | point-of-view | custom",
          "camera_perspective": "Wide establishing shot",
          "character_focus": ["Character Name"],
          "visual_direction": "Lighting and focal depth note",
          "duration_seconds": 6,
          "production_notes": "Compositing note"
        }
      ]
    }
  ],
  "proposed_shots": [
    {
      "id": "uuid-v4",
      "shot_number": 1,
      "title": "Shot title",
      "description": "Shot staging description",
      "shot_type": "establishing | wide | medium | close-up | extreme close-up | over-the-shoulder | point-of-view | custom",
      "camera_perspective": "Medium shot",
      "character_focus": ["Character Name"],
      "visual_direction": "Visual direction",
      "duration_seconds": 5,
      "production_notes": "Production note"
    }
  ],
  "suggested_environments": ["Environment Name 1"],
  "suggested_characters": ["Character Name 1"],
  "suggested_visual_directions": ["Visual direction 1"],
  "suggested_transition": "Cross dissolve",
  "rewritten_description": "Optional rewritten scene description"
}
"""


class SceneService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.project_repo = ProjectRepository(db)
        self.story_repo = StoryRepository(db)
        self.scene_repo = SceneRepository(db)
        self.character_repo = CharacterRepository(db)
        self.environment_repo = EnvironmentRepository(db)
        self.storage = get_storage_backend()

    # ------------------------------------------------------------------
    # Ownership & Authorization Helpers
    # ------------------------------------------------------------------

    def _get_owned_project(self, project_id: uuid.UUID, current_user: User) -> Project:
        project = self.project_repo.get_by_id(project_id)
        if not project:
            raise NotFoundException(f"Project with ID '{project_id}' was not found.")
        if project.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this project.")
        return project

    def _get_owned_story_by_project(
        self, project_id: uuid.UUID, current_user: User
    ) -> Tuple[Project, Story]:
        project = self._get_owned_project(project_id, current_user)
        story = self.story_repo.get_by_project_id(project.id)
        if not story:
            raise NotFoundException(
                f"No story exists yet for project '{project_id}'. Create or initialize a story first."
            )
        if story.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this story.")
        return project, story

    def _get_owned_story(self, story_id: uuid.UUID, current_user: User) -> Story:
        story = self.story_repo.get_by_id(story_id)
        if not story:
            raise NotFoundException(f"Story with ID '{story_id}' was not found.")
        if story.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this story.")
        return story

    def _get_owned_scene(
        self, scene_id: uuid.UUID, current_user: User
    ) -> Tuple[StoryScene, Story]:
        scene = self.scene_repo.get_scene_by_id(scene_id)
        if not scene:
            raise NotFoundException(f"Scene with ID '{scene_id}' was not found.")
        story = self._get_owned_story(scene.story_id, current_user)
        return scene, story

    def _get_owned_shot(
        self, shot_id: uuid.UUID, current_user: User
    ) -> Tuple[SceneShot, StoryScene, Story]:
        shot = self.scene_repo.get_shot_by_id(shot_id)
        if not shot:
            raise NotFoundException(f"Shot with ID '{shot_id}' was not found.")
        if shot.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this shot.")
        scene, story = self._get_owned_scene(shot.scene_id, current_user)
        return shot, scene, story

    def _get_owned_character_assignment(
        self, assignment_id: uuid.UUID, current_user: User
    ) -> Tuple[SceneCharacterAssignment, StoryScene, Story]:
        assignment = self.scene_repo.get_character_assignment_by_id(assignment_id)
        if not assignment:
            raise NotFoundException(
                f"Scene character assignment '{assignment_id}' was not found."
            )
        if assignment.owner_id != current_user.id:
            raise ForbiddenException(
                "You do not have permission to access this character assignment."
            )
        scene, story = self._get_owned_scene(assignment.scene_id, current_user)
        return assignment, scene, story

    def _get_owned_asset_assignment(
        self, assignment_id: uuid.UUID, current_user: User
    ) -> Tuple[SceneAssetAssignment, StoryScene, Story]:
        assignment = self.scene_repo.get_asset_assignment_by_id(assignment_id)
        if not assignment:
            raise NotFoundException(
                f"Scene asset assignment '{assignment_id}' was not found."
            )
        if assignment.owner_id != current_user.id:
            raise ForbiddenException(
                "You do not have permission to access this asset assignment."
            )
        scene, story = self._get_owned_scene(assignment.scene_id, current_user)
        return assignment, scene, story

    def _sync_story_json_from_orm(self, story: Story) -> None:
        """
        Keep `story.structured_data` synchronized with relational tables
        without destroying any Step 5 scene columns or child assignments.
        """
        doc = self.story_repo.build_document_from_orm(story)
        story.structured_data = doc.model_dump(mode="json")
        self.db.add(story)
        self.db.commit()
        self.db.refresh(story)

    # ------------------------------------------------------------------
    # Media & Reference Resolution (With Missing Reference Detection)
    # ------------------------------------------------------------------

    def _resolve_environment_preview(
        self,
        scene: StoryScene,
        current_user: User,
        missing_references: List[str],
    ) -> Tuple[Optional[SceneEnvironmentPreview], Optional[str], bool]:
        """
        Resolve the assigned Step 4 `Environment` and its primary asset URL.
        Returns `(preview, thumbnail_url, has_actual_asset)`.
        Never fabricates an image URL if no asset is saved.
        """
        env_preview: Optional[SceneEnvironmentPreview] = None
        thumbnail_url: Optional[str] = None
        has_actual_asset = False

        # Check explicit scene_metadata reference if an environment was deleted or invalid
        meta = dict(scene.scene_metadata or {})
        expected_env_id = meta.get("requested_environment_id")
        if expected_env_id and not scene.environment_id:
            missing_references.append(
                f"Referenced environment '{expected_env_id}' is missing or was deleted."
            )

        if scene.environment_id:
            env = self.environment_repo.get_by_id_with_relations(scene.environment_id)
            if not env or env.owner_id != current_user.id:
                missing_references.append(
                    f"Environment '{scene.environment_id}' could not be found."
                )
            else:
                env_img_url: Optional[str] = None
                primary_env_asset_id = env.default_asset_id or next(
                    (a.id for a in (env.assets or []) if a.is_primary), None
                )
                if primary_env_asset_id:
                    asset = self.environment_repo.get_asset_by_id(primary_env_asset_id)
                    if asset and asset.owner_id == current_user.id:
                        env_img_url = self.storage.build_signed_environment_media_url(
                            asset_id=asset.id,
                        )
                        thumbnail_url = env_img_url
                        has_actual_asset = True
                    else:
                        missing_references.append(
                            f"Primary image asset '{primary_env_asset_id}' for environment '{env.name}' is missing."
                        )
                env_preview = SceneEnvironmentPreview(
                    id=env.id,
                    name=env.name,
                    category=env.category,
                    art_style=env.art_style,
                    time_of_day=env.time_of_day,
                    weather=env.weather,
                    camera_perspective=env.camera_perspective,
                    image_url=env_img_url,
                    color_palette=list(env.color_palette or []),
                )

        return env_preview, thumbnail_url, has_actual_asset

    def _resolve_world_location_preview(
        self,
        scene: StoryScene,
        current_user: User,
        missing_references: List[str],
    ) -> Optional[SceneWorldLocationPreview]:
        if not scene.world_location_id:
            return None
        wloc = self.environment_repo.get_world_location_by_id(scene.world_location_id)
        if not wloc:
            missing_references.append(
                f"World location '{scene.world_location_id}' could not be found."
            )
            return None
        world = self.environment_repo.get_world_by_id(wloc.world_id)
        if not world or world.owner_id != current_user.id:
            missing_references.append(
                f"World location '{scene.world_location_id}' could not be found."
            )
            return None
        return SceneWorldLocationPreview(
            id=wloc.id,
            world_id=wloc.world_id,
            world_name=world.name if world else None,
            name=wloc.name,
            location_type=wloc.location_type,
            description=wloc.description,
        )

    def _build_character_assignment_response(
        self,
        assignment: SceneCharacterAssignment,
        current_user: User,
        missing_references: List[str],
    ) -> SceneCharacterAssignmentResponse:
        image_url: Optional[str] = None
        expression_name: Optional[str] = None
        pose_name: Optional[str] = None
        outfit_name: Optional[str] = None
        reference_status: str = "no_visual_asset"

        char: Optional[Character] = None
        if assignment.character_id:
            char = self.character_repo.get_by_id(assignment.character_id)
            if not char or char.owner_id != current_user.id:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Assigned character '{assignment.character_name}' ({assignment.character_id}) is missing."
                )
        elif not assignment.story_character_id and assignment.notes and "requested_character_id:" in (assignment.notes or ""):
            reference_status = "missing_reference"
            missing_references.append(
                f"Assigned character '{assignment.character_name}' reference is missing."
            )

        # Resolve expression
        if assignment.expression_id:
            expr = self.db.get(CharacterExpression, assignment.expression_id)
            if expr and expr.character and expr.character.owner_id == current_user.id:
                expression_name = expr.name
                if expr.asset_id and not assignment.asset_id:
                    expr_asset = self.character_repo.get_asset_by_id(expr.asset_id)
                    if expr_asset and expr_asset.owner_id == current_user.id:
                        image_url = self.storage.build_signed_media_url(
                            asset_id=expr_asset.id,
                        )
                        reference_status = "ok"
            else:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Expression '{assignment.expression_id}' for '{assignment.character_name}' is missing."
                )

        # Resolve pose
        if assignment.pose_id:
            pose = self.db.get(CharacterPose, assignment.pose_id)
            if pose and pose.character and pose.character.owner_id == current_user.id:
                pose_name = pose.name
                if pose.asset_id and not image_url and not assignment.asset_id:
                    pose_asset = self.character_repo.get_asset_by_id(pose.asset_id)
                    if pose_asset and pose_asset.owner_id == current_user.id:
                        image_url = self.storage.build_signed_media_url(
                            asset_id=pose_asset.id,
                        )
                        reference_status = "ok"
            else:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Pose '{assignment.pose_id}' for '{assignment.character_name}' is missing."
                )

        # Resolve outfit
        if assignment.outfit_id:
            outfit = self.db.get(CharacterOutfit, assignment.outfit_id)
            if outfit and outfit.character and outfit.character.owner_id == current_user.id:
                outfit_name = outfit.name
                if outfit.asset_id and not image_url and not assignment.asset_id:
                    outfit_asset = self.character_repo.get_asset_by_id(outfit.asset_id)
                    if outfit_asset and outfit_asset.owner_id == current_user.id:
                        image_url = self.storage.build_signed_media_url(
                            asset_id=outfit_asset.id,
                        )
                        reference_status = "ok"
            else:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Outfit '{assignment.outfit_id}' for '{assignment.character_name}' is missing."
                )

        # Resolve explicit asset_id or fallback to character canonical_reference_asset_id
        if assignment.asset_id:
            asset = self.character_repo.get_asset_by_id(assignment.asset_id)
            if asset and asset.owner_id == current_user.id:
                image_url = self.storage.build_signed_media_url(
                    asset_id=asset.id,
                )
                reference_status = "ok"
            else:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Character visual asset '{assignment.asset_id}' for '{assignment.character_name}' is missing."
                )
        elif not image_url and char:
            primary_char_asset_id = char.canonical_reference_asset_id or next(
                (a.id for a in (char.assets or []) if a.is_primary), None
            )
            if primary_char_asset_id:
                primary_asset = self.character_repo.get_asset_by_id(primary_char_asset_id)
                if primary_asset and primary_asset.owner_id == current_user.id:
                    image_url = self.storage.build_signed_media_url(
                        asset_id=primary_asset.id,
                    )
                    if reference_status != "missing_reference":
                        reference_status = "ok"
                else:
                    reference_status = "missing_reference"
                    missing_references.append(
                        f"Primary visual asset '{primary_char_asset_id}' for character '{char.name}' is missing."
                    )

        return SceneCharacterAssignmentResponse(
            id=assignment.id,
            scene_id=assignment.scene_id,
            story_id=assignment.story_id,
            project_id=assignment.project_id,
            owner_id=assignment.owner_id,
            character_id=assignment.character_id,
            story_character_id=assignment.story_character_id,
            character_name=assignment.character_name,
            role_in_scene=assignment.role_in_scene,
            expression_id=assignment.expression_id,
            expression_name=expression_name,
            pose_id=assignment.pose_id,
            pose_name=pose_name,
            outfit_id=assignment.outfit_id,
            outfit_name=outfit_name,
            asset_id=assignment.asset_id,
            image_url=image_url,
            reference_status=reference_status,  # type: ignore[arg-type]
            layer_order=assignment.layer_order,
            position_x=assignment.position_x,
            position_y=assignment.position_y,
            scale_percent=assignment.scale_percent,
            notes=assignment.notes,
            created_at=assignment.created_at,
            updated_at=assignment.updated_at,
        )

    def _build_asset_assignment_response(
        self,
        assignment: SceneAssetAssignment,
        current_user: User,
        missing_references: List[str],
    ) -> SceneAssetAssignmentResponse:
        image_url: Optional[str] = None
        reference_status = "ok"

        if assignment.environment_asset_id:
            env_asset = self.environment_repo.get_asset_by_id(
                assignment.environment_asset_id
            )
            if env_asset and env_asset.owner_id == current_user.id:
                image_url = self.storage.build_signed_environment_media_url(
                    asset_id=env_asset.id,
                )
            else:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Environment asset '{assignment.environment_asset_id}' for layer '{assignment.label}' is missing."
                )
        elif assignment.character_asset_id:
            char_asset = self.character_repo.get_asset_by_id(
                assignment.character_asset_id
            )
            if char_asset and char_asset.owner_id == current_user.id:
                image_url = self.storage.build_signed_media_url(
                    asset_id=char_asset.id,
                )
            else:
                reference_status = "missing_reference"
                missing_references.append(
                    f"Character asset '{assignment.character_asset_id}' for layer '{assignment.label}' is missing."
                )
        else:
            reference_status = "missing_reference"
            missing_references.append(
                f"Layer '{assignment.label}' has no valid visual asset reference."
            )

        return SceneAssetAssignmentResponse(
            id=assignment.id,
            scene_id=assignment.scene_id,
            story_id=assignment.story_id,
            project_id=assignment.project_id,
            owner_id=assignment.owner_id,
            layer_type=assignment.layer_type,
            label=assignment.label,
            environment_asset_id=assignment.environment_asset_id,
            character_asset_id=assignment.character_asset_id,
            image_url=image_url,
            reference_status=reference_status,  # type: ignore[arg-type]
            layer_order=assignment.layer_order,
            position_x=assignment.position_x,
            position_y=assignment.position_y,
            scale_percent=assignment.scale_percent,
            notes=assignment.notes,
            created_at=assignment.created_at,
            updated_at=assignment.updated_at,
        )

    def _build_shot_response(
        self,
        shot: SceneShot,
        current_user: User,
        missing_references: Optional[List[str]] = None,
    ) -> SceneShotResponse:
        env_name: Optional[str] = None
        env_img_url: Optional[str] = None
        if shot.environment_id:
            env = self.environment_repo.get_by_id_with_relations(shot.environment_id)
            if env and env.owner_id == current_user.id:
                env_name = env.name
                primary_env_asset_id = env.default_asset_id or next(
                    (a.id for a in (env.assets or []) if a.is_primary), None
                )
                if primary_env_asset_id:
                    asset = self.environment_repo.get_asset_by_id(primary_env_asset_id)
                    if asset and asset.owner_id == current_user.id:
                        env_img_url = self.storage.build_signed_environment_media_url(
                            asset_id=asset.id,
                        )
            elif missing_references is not None:
                missing_references.append(
                    f"Shot #{shot.shot_number} references missing environment '{shot.environment_id}'."
                )

        return SceneShotResponse(
            id=shot.id,
            scene_id=shot.scene_id,
            story_id=shot.story_id,
            project_id=shot.project_id,
            owner_id=shot.owner_id,
            shot_number=shot.shot_number,
            title=shot.title,
            description=shot.description,
            shot_type=shot.shot_type,
            camera_perspective=shot.camera_perspective,
            character_focus=list(shot.character_focus or []),
            environment_id=shot.environment_id,
            environment_name=env_name,
            environment_image_url=env_img_url,
            visual_direction=shot.visual_direction,
            duration_seconds=shot.duration_seconds,
            production_notes=shot.production_notes,
            created_at=shot.created_at,
            updated_at=shot.updated_at,
        )

    def _to_scene_detail_response(
        self,
        scene: StoryScene,
        story: Story,
        current_user: User,
    ) -> SceneDetailResponse:
        missing_references: List[str] = []

        env_preview, env_thumb_url, has_env_asset = self._resolve_environment_preview(
            scene, current_user, missing_references
        )
        wloc_preview = self._resolve_world_location_preview(
            scene, current_user, missing_references
        )

        raw_char_assignments = self.scene_repo.list_character_assignments_by_scene(
            scene.id
        )
        char_assignments = [
            self._build_character_assignment_response(
                ca, current_user, missing_references
            )
            for ca in raw_char_assignments
        ]

        raw_asset_assignments = self.scene_repo.list_asset_assignments_by_scene(
            scene.id
        )
        asset_assignments = [
            self._build_asset_assignment_response(
                aa, current_user, missing_references
            )
            for aa in raw_asset_assignments
        ]

        raw_shots = self.scene_repo.list_shots_by_scene(scene.id)
        shots = [
            self._build_shot_response(sh, current_user, missing_references)
            for sh in raw_shots
        ]

        # Determine scene thumbnail strictly from actual saved assets (never fabricated)
        thumbnail_url = env_thumb_url
        if not thumbnail_url:
            for aa in asset_assignments:
                if aa.layer_type == "background" and aa.image_url:
                    thumbnail_url = aa.image_url
                    break
        if not thumbnail_url:
            for aa in asset_assignments:
                if aa.image_url:
                    thumbnail_url = aa.image_url
                    break

        dialogues = [
            DialogueEntryData(
                id=str(d.id),
                character_id=str(d.character_id) if d.character_id else None,
                character_name=d.character_name,
                line=d.line,
                emotion=d.emotion or "Neutral",
                delivery_direction=d.delivery_direction or "",
            )
            for d in sorted(scene.dialogue_entries, key=lambda x: x.line_order)
        ]

        narrations = [
            NarrationEntryData(
                id=str(n.id),
                narrator_voice=n.narrator_voice or "Narrator",
                text=n.text,
                emotion=n.emotion or "Warm",
            )
            for n in sorted(scene.narration_entries, key=lambda x: x.entry_order)
        ]

        return SceneDetailResponse(
            id=scene.id,
            story_id=scene.story_id,
            project_id=story.project_id,
            owner_id=story.owner_id,
            scene_number=scene.scene_number,
            title=scene.title,
            scene_type=scene.scene_type or "Narrative",
            scene_heading=scene.scene_heading or "EXT. LOCATION - DAY",
            summary=scene.summary or "",
            description=scene.description or "",
            action_description=scene.action_description or "",
            location_id=str(scene.location_id) if scene.location_id else None,
            location_name=scene.location_name or "",
            environment_id=scene.environment_id,
            environment=env_preview,
            world_location_id=scene.world_location_id,
            world_location=wloc_preview,
            time_of_day=scene.time_of_day or "Day",
            weather=scene.weather or "Clear",
            mood=scene.mood or "Cinematic",
            duration_seconds=scene.duration_seconds,
            camera_framing=scene.camera_framing or "Wide establishing shot",
            transition_type=scene.transition_type or "Cut",
            production_notes=scene.production_notes or "",
            storyboard_notes=scene.storyboard_notes or "",
            thumbnail_url=thumbnail_url,
            characters=list(scene.characters or []),
            dialogue=dialogues,
            narration=narrations,
            camera_directions=list(scene.camera_directions or []),
            audio_directions=list(scene.audio_directions or []),
            visual_directions=list(scene.visual_directions or []),
            emotional_directions=list(scene.emotional_directions or []),
            character_assignments=char_assignments,
            asset_assignments=asset_assignments,
            shots=shots,
            missing_references=missing_references,
            created_at=scene.created_at,
            updated_at=scene.updated_at,
        )

    # ------------------------------------------------------------------
    # 1. Scene CRUD, Duplication & Ordering
    # ------------------------------------------------------------------

    def list_project_scenes(
        self,
        current_user: User,
        project_id: uuid.UUID,
    ) -> List[SceneDetailResponse]:
        _, story = self._get_owned_story_by_project(project_id, current_user)
        scenes = self.scene_repo.list_scenes_by_story(story.id)
        return [
            self._to_scene_detail_response(scene, story, current_user)
            for scene in scenes
        ]

    def get_scene_detail(
        self,
        current_user: User,
        scene_id: uuid.UUID,
    ) -> SceneDetailResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)
        return self._to_scene_detail_response(scene, story, current_user)

    def create_scene(
        self,
        current_user: User,
        project_id: uuid.UUID,
        payload: SceneBuilderCreateRequest,
    ) -> SceneDetailResponse:
        _, story = self._get_owned_story_by_project(project_id, current_user)
        existing_scenes = self.scene_repo.list_scenes_by_story(story.id)
        next_scene_num = len(existing_scenes) + 1

        # Validate environment / world_location ownership if provided
        scene_metadata: Dict[str, Any] = {}
        resolved_env_id: Optional[uuid.UUID] = None
        location_name = (payload.location_name or "").strip()

        if payload.environment_id:
            env = self.environment_repo.get_by_id_with_relations(payload.environment_id)
            if not env:
                scene_metadata["requested_environment_id"] = str(payload.environment_id)
            elif env.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this environment."
                )
            else:
                resolved_env_id = env.id
                if not location_name:
                    location_name = env.name

        resolved_wloc_id: Optional[uuid.UUID] = None
        if payload.world_location_id:
            wloc = self.environment_repo.get_world_location_by_id(
                payload.world_location_id
            )
            if not wloc:
                scene_metadata["requested_world_location_id"] = str(
                    payload.world_location_id
                )
            elif not wloc.world or wloc.world.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this world location."
                )
            else:
                resolved_wloc_id = wloc.id
                if not location_name:
                    location_name = wloc.name

        # Resolve StoryLocation FK if provided
        resolved_story_loc_id: Optional[uuid.UUID] = None
        if payload.location_id:
            try:
                loc_uuid = uuid.UUID(str(payload.location_id))
                for sloc in story.locations:
                    if sloc.id == loc_uuid:
                        resolved_story_loc_id = sloc.id
                        if not location_name:
                            location_name = sloc.name
                        break
            except ValueError:
                pass

        char_names = list(payload.characters)
        scene = StoryScene(
            id=uuid.uuid4(),
            story_id=story.id,
            scene_number=next_scene_num,
            title=payload.title.strip(),
            scene_type=payload.scene_type or "Narrative",
            scene_heading=(
                payload.scene_heading or f"EXT. {(location_name or payload.title).upper()} - {payload.time_of_day.upper()}"
            )[:255],
            summary=payload.summary or "",
            description=payload.description or "",
            action_description=payload.action_description or "",
            location_id=resolved_story_loc_id,
            location_name=location_name,
            environment_id=resolved_env_id,
            world_location_id=resolved_wloc_id,
            time_of_day=payload.time_of_day,
            weather=payload.weather,
            mood=payload.mood,
            duration_seconds=payload.duration_seconds,
            camera_framing=payload.camera_framing,
            transition_type=payload.transition_type,
            production_notes=payload.production_notes or "",
            storyboard_notes=payload.storyboard_notes or "",
            characters=char_names,
            camera_directions=list(payload.camera_directions),
            audio_directions=list(payload.audio_directions),
            visual_directions=list(payload.visual_directions),
            emotional_directions=list(payload.emotional_directions),
            scene_metadata=scene_metadata,
        )
        self.db.add(scene)
        self.db.flush()

        # Persist dialogue & narration rows
        for d_idx, d in enumerate(payload.dialogue, start=1):
            self.db.add(
                DialogueEntry(
                    id=uuid.uuid4(),
                    scene_id=scene.id,
                    character_id=None,
                    character_name=d.character_name,
                    line=d.line,
                    emotion=d.emotion,
                    delivery_direction=d.delivery_direction,
                    line_order=d_idx,
                )
            )
        for n_idx, n in enumerate(payload.narration, start=1):
            self.db.add(
                NarrationEntry(
                    id=uuid.uuid4(),
                    scene_id=scene.id,
                    narrator_voice=n.narrator_voice,
                    text=n.text,
                    emotion=n.emotion,
                    entry_order=n_idx,
                )
            )

        # Assign requested Step 3 character_ids without duplicating Character rows
        for c_idx, cid in enumerate(payload.character_ids, start=1):
            char = self.character_repo.get_by_id(cid)
            if char and char.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's character."
                )
            cname = char.name if char else f"Character {c_idx}"
            if cname not in char_names:
                char_names.append(cname)
            self.db.add(
                SceneCharacterAssignment(
                    id=uuid.uuid4(),
                    scene_id=scene.id,
                    story_id=story.id,
                    project_id=story.project_id,
                    owner_id=current_user.id,
                    character_id=char.id if char else None,
                    character_name=cname,
                    role_in_scene=char.role if char else "Lead",
                    asset_id=char.canonical_reference_asset_id if char else None,
                    layer_order=c_idx,
                    position_x=min(85, 25 + (c_idx - 1) * 25),
                    position_y=75,
                    scale_percent=100,
                    notes="" if char else f"requested_character_id:{cid}",
                )
            )

        scene.characters = char_names

        # Optionally seed default establishing + medium shots
        if payload.seed_default_shots:
            est_dur = max(2, payload.duration_seconds // 3)
            med_dur = max(3, payload.duration_seconds - est_dur)
            self.db.add(
                SceneShot(
                    id=uuid.uuid4(),
                    scene_id=scene.id,
                    story_id=story.id,
                    project_id=story.project_id,
                    owner_id=current_user.id,
                    shot_number=1,
                    title=f"Establishing — {location_name or payload.title}",
                    description=payload.description or payload.summary or "",
                    shot_type="establishing",
                    camera_perspective=payload.camera_framing,
                    character_focus=list(char_names[:2]),
                    environment_id=resolved_env_id,
                    visual_direction=(
                        payload.visual_directions[0]
                        if payload.visual_directions
                        else f"{payload.time_of_day}, {payload.weather} lighting"
                    ),
                    duration_seconds=est_dur,
                    production_notes="Opening establishing shot",
                )
            )
            self.db.add(
                SceneShot(
                    id=uuid.uuid4(),
                    scene_id=scene.id,
                    story_id=story.id,
                    project_id=story.project_id,
                    owner_id=current_user.id,
                    shot_number=2,
                    title=f"Main Action — {payload.title}",
                    description=payload.action_description or payload.description or "",
                    shot_type="medium",
                    camera_perspective="Medium shot",
                    character_focus=list(char_names),
                    environment_id=resolved_env_id,
                    visual_direction=f"{payload.mood} staging",
                    duration_seconds=med_dur,
                    production_notes="",
                )
            )

        self.db.commit()
        self.db.refresh(scene)
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)
        return self._to_scene_detail_response(scene, story, current_user)

    def update_scene(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneBuilderUpdateRequest,
    ) -> SceneDetailResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)

        if payload.scene_number is not None:
            scene.scene_number = payload.scene_number
        if payload.title is not None:
            scene.title = payload.title.strip()
        if payload.scene_type is not None:
            scene.scene_type = payload.scene_type
        if payload.scene_heading is not None:
            scene.scene_heading = payload.scene_heading
        if payload.summary is not None:
            scene.summary = payload.summary
        if payload.description is not None:
            scene.description = payload.description
        if payload.action_description is not None:
            scene.action_description = payload.action_description
        if payload.location_name is not None:
            scene.location_name = payload.location_name
        if payload.location_id is not None:
            try:
                loc_uuid = uuid.UUID(str(payload.location_id))
                scene.location_id = loc_uuid
            except ValueError:
                scene.location_id = None

        meta = dict(scene.scene_metadata or {})
        if payload.clear_environment:
            scene.environment_id = None
            meta.pop("requested_environment_id", None)
        elif payload.environment_id is not None:
            env = self.environment_repo.get_by_id_with_relations(payload.environment_id)
            if not env:
                scene.environment_id = None
                meta["requested_environment_id"] = str(payload.environment_id)
            elif env.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this environment."
                )
            else:
                scene.environment_id = env.id
                meta.pop("requested_environment_id", None)
                if not scene.location_name:
                    scene.location_name = env.name

        if payload.clear_world_location:
            scene.world_location_id = None
            meta.pop("requested_world_location_id", None)
        elif payload.world_location_id is not None:
            wloc = self.environment_repo.get_world_location_by_id(
                payload.world_location_id
            )
            if not wloc:
                scene.world_location_id = None
                meta["requested_world_location_id"] = str(payload.world_location_id)
            elif not wloc.world or wloc.world.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this world location."
                )
            else:
                scene.world_location_id = wloc.id
                meta.pop("requested_world_location_id", None)

        scene.scene_metadata = meta

        if payload.time_of_day is not None:
            scene.time_of_day = payload.time_of_day
        if payload.weather is not None:
            scene.weather = payload.weather
        if payload.mood is not None:
            scene.mood = payload.mood
        if payload.duration_seconds is not None:
            scene.duration_seconds = payload.duration_seconds
        if payload.camera_framing is not None:
            scene.camera_framing = payload.camera_framing
        if payload.transition_type is not None:
            scene.transition_type = payload.transition_type
        if payload.production_notes is not None:
            scene.production_notes = payload.production_notes
        if payload.storyboard_notes is not None:
            scene.storyboard_notes = payload.storyboard_notes
        if payload.characters is not None:
            scene.characters = list(payload.characters)
        if payload.camera_directions is not None:
            scene.camera_directions = list(payload.camera_directions)
        if payload.audio_directions is not None:
            scene.audio_directions = list(payload.audio_directions)
        if payload.visual_directions is not None:
            scene.visual_directions = list(payload.visual_directions)
        if payload.emotional_directions is not None:
            scene.emotional_directions = list(payload.emotional_directions)

        if payload.dialogue is not None:
            for existing_d in list(scene.dialogue_entries):
                self.db.delete(existing_d)
            self.db.flush()
            for d_idx, d in enumerate(payload.dialogue, start=1):
                self.db.add(
                    DialogueEntry(
                        id=uuid.uuid4(),
                        scene_id=scene.id,
                        character_id=None,
                        character_name=d.character_name,
                        line=d.line,
                        emotion=d.emotion,
                        delivery_direction=d.delivery_direction,
                        line_order=d_idx,
                    )
                )

        if payload.narration is not None:
            for existing_n in list(scene.narration_entries):
                self.db.delete(existing_n)
            self.db.flush()
            for n_idx, n in enumerate(payload.narration, start=1):
                self.db.add(
                    NarrationEntry(
                        id=uuid.uuid4(),
                        scene_id=scene.id,
                        narrator_voice=n.narrator_voice,
                        text=n.text,
                        emotion=n.emotion,
                        entry_order=n_idx,
                    )
                )

        self.db.add(scene)
        self.db.commit()
        self.db.refresh(scene)
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)
        return self._to_scene_detail_response(scene, story, current_user)

    def delete_scene(
        self,
        current_user: User,
        scene_id: uuid.UUID,
    ) -> None:
        scene, story = self._get_owned_scene(scene_id, current_user)
        self.scene_repo.delete_scene_children(scene.id)
        self.db.delete(scene)
        self.db.flush()

        remaining = self.scene_repo.list_scenes_by_story(story.id)
        for idx, rem in enumerate(remaining, start=1):
            rem.scene_number = idx
            self.db.add(rem)
        self.db.commit()
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)

    def duplicate_scene(
        self,
        current_user: User,
        scene_id: uuid.UUID,
    ) -> SceneDetailResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)
        all_scenes = self.scene_repo.list_scenes_by_story(story.id)

        new_scene_id = uuid.uuid4()
        target_number = scene.scene_number + 1

        for existing in all_scenes:
            if existing.scene_number >= target_number:
                existing.scene_number += 1
                self.db.add(existing)

        dup = StoryScene(
            id=new_scene_id,
            story_id=story.id,
            scene_number=target_number,
            title=f"{scene.title} (Copy)",
            scene_type=scene.scene_type,
            scene_heading=scene.scene_heading,
            summary=scene.summary,
            description=scene.description,
            action_description=scene.action_description,
            location_id=scene.location_id,
            location_name=scene.location_name,
            environment_id=scene.environment_id,
            world_location_id=scene.world_location_id,
            time_of_day=scene.time_of_day,
            weather=scene.weather,
            mood=scene.mood,
            duration_seconds=scene.duration_seconds,
            camera_framing=scene.camera_framing,
            transition_type=scene.transition_type,
            production_notes=scene.production_notes,
            storyboard_notes=scene.storyboard_notes,
            characters=list(scene.characters or []),
            camera_directions=list(scene.camera_directions or []),
            audio_directions=list(scene.audio_directions or []),
            visual_directions=list(scene.visual_directions or []),
            emotional_directions=list(scene.emotional_directions or []),
            scene_metadata=dict(scene.scene_metadata or {}),
        )
        self.db.add(dup)
        self.db.flush()

        for d in sorted(scene.dialogue_entries, key=lambda x: x.line_order):
            self.db.add(
                DialogueEntry(
                    id=uuid.uuid4(),
                    scene_id=dup.id,
                    character_id=d.character_id,
                    character_name=d.character_name,
                    line=d.line,
                    emotion=d.emotion,
                    delivery_direction=d.delivery_direction,
                    line_order=d.line_order,
                )
            )
        for n in sorted(scene.narration_entries, key=lambda x: x.entry_order):
            self.db.add(
                NarrationEntry(
                    id=uuid.uuid4(),
                    scene_id=dup.id,
                    narrator_voice=n.narrator_voice,
                    text=n.text,
                    emotion=n.emotion,
                    entry_order=n.entry_order,
                )
            )

        # Duplicate character assignments (referencing same Character records, never duplicating Character)
        for ca in self.scene_repo.list_character_assignments_by_scene(scene.id):
            self.db.add(
                SceneCharacterAssignment(
                    id=uuid.uuid4(),
                    scene_id=dup.id,
                    story_id=story.id,
                    project_id=story.project_id,
                    owner_id=current_user.id,
                    character_id=ca.character_id,
                    story_character_id=ca.story_character_id,
                    character_name=ca.character_name,
                    role_in_scene=ca.role_in_scene,
                    expression_id=ca.expression_id,
                    pose_id=ca.pose_id,
                    outfit_id=ca.outfit_id,
                    asset_id=ca.asset_id,
                    layer_order=ca.layer_order,
                    position_x=ca.position_x,
                    position_y=ca.position_y,
                    scale_percent=ca.scale_percent,
                    notes=ca.notes,
                )
            )

        # Duplicate asset assignments
        for aa in self.scene_repo.list_asset_assignments_by_scene(scene.id):
            self.db.add(
                SceneAssetAssignment(
                    id=uuid.uuid4(),
                    scene_id=dup.id,
                    story_id=story.id,
                    project_id=story.project_id,
                    owner_id=current_user.id,
                    layer_type=aa.layer_type,
                    label=aa.label,
                    environment_asset_id=aa.environment_asset_id,
                    character_asset_id=aa.character_asset_id,
                    layer_order=aa.layer_order,
                    position_x=aa.position_x,
                    position_y=aa.position_y,
                    scale_percent=aa.scale_percent,
                    notes=aa.notes,
                )
            )

        # Duplicate shots
        for sh in self.scene_repo.list_shots_by_scene(scene.id):
            self.db.add(
                SceneShot(
                    id=uuid.uuid4(),
                    scene_id=dup.id,
                    story_id=story.id,
                    project_id=story.project_id,
                    owner_id=current_user.id,
                    shot_number=sh.shot_number,
                    title=sh.title,
                    description=sh.description,
                    shot_type=sh.shot_type,
                    camera_perspective=sh.camera_perspective,
                    character_focus=list(sh.character_focus or []),
                    environment_id=sh.environment_id,
                    visual_direction=sh.visual_direction,
                    duration_seconds=sh.duration_seconds,
                    production_notes=sh.production_notes,
                )
            )

        self.db.commit()
        self.db.refresh(dup)
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)
        return self._to_scene_detail_response(dup, story, current_user)

    def reorder_project_scenes(
        self,
        current_user: User,
        project_id: uuid.UUID,
        scene_ids: List[str],
    ) -> List[SceneDetailResponse]:
        _, story = self._get_owned_story_by_project(project_id, current_user)
        scenes = self.scene_repo.list_scenes_by_story(story.id)
        scene_by_id = {str(s.id): s for s in scenes}

        ordered: List[StoryScene] = []
        for sid in scene_ids:
            if str(sid) in scene_by_id:
                ordered.append(scene_by_id.pop(str(sid)))
        for remaining in scene_by_id.values():
            ordered.append(remaining)

        for idx, sc in enumerate(ordered, start=1):
            sc.scene_number = idx
            self.db.add(sc)

        self.db.commit()
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)
        return [
            self._to_scene_detail_response(sc, story, current_user)
            for sc in ordered
        ]

    # ------------------------------------------------------------------
    # 2. Scene Environment Assignment
    # ------------------------------------------------------------------

    def assign_environment(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneEnvironmentAssignmentRequest,
    ) -> SceneDetailResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)
        meta = dict(scene.scene_metadata or {})

        if payload.clear_environment:
            scene.environment_id = None
            meta.pop("requested_environment_id", None)
        elif payload.environment_id is not None:
            env = self.environment_repo.get_by_id_with_relations(payload.environment_id)
            if not env:
                scene.environment_id = None
                meta["requested_environment_id"] = str(payload.environment_id)
            elif env.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this environment."
                )
            else:
                scene.environment_id = env.id
                meta.pop("requested_environment_id", None)
                scene.location_name = env.name
                scene.time_of_day = env.time_of_day or scene.time_of_day
                scene.weather = env.weather or scene.weather

        if payload.clear_world_location:
            scene.world_location_id = None
            meta.pop("requested_world_location_id", None)
        elif payload.world_location_id is not None:
            wloc = self.environment_repo.get_world_location_by_id(
                payload.world_location_id
            )
            if not wloc:
                scene.world_location_id = None
                meta["requested_world_location_id"] = str(payload.world_location_id)
            elif not wloc.world or wloc.world.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this world location."
                )
            else:
                scene.world_location_id = wloc.id
                meta.pop("requested_world_location_id", None)
                if wloc.environment_id and not scene.environment_id:
                    scene.environment_id = wloc.environment_id
                if not scene.location_name:
                    scene.location_name = wloc.name

        if payload.variation_id is not None:
            var = self.environment_repo.get_variation_by_id(payload.variation_id)
            if not var or not var.environment or var.environment.owner_id != current_user.id:
                raise NotFoundException(
                    f"Environment variation '{payload.variation_id}' was not found."
                )
            scene.time_of_day = var.time_of_day or scene.time_of_day
            scene.weather = var.weather or scene.weather
            if var.asset_id:
                self._upsert_background_asset_layer(
                    scene=scene,
                    story=story,
                    current_user=current_user,
                    environment_asset_id=var.asset_id,
                    label=f"{var.name} Background",
                )

        if payload.background_asset_id is not None:
            env_asset = self.environment_repo.get_asset_by_id(
                payload.background_asset_id
            )
            if not env_asset:
                # Record as missing reference layer so missing reference handling is transparent
                self._upsert_background_asset_layer(
                    scene=scene,
                    story=story,
                    current_user=current_user,
                    environment_asset_id=payload.background_asset_id,
                    label="Scene Background Layer",
                )
            elif env_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign this environment asset."
                )
            else:
                self._upsert_background_asset_layer(
                    scene=scene,
                    story=story,
                    current_user=current_user,
                    environment_asset_id=env_asset.id,
                    label="Scene Background Layer",
                )

        scene.scene_metadata = meta
        self.db.add(scene)
        self.db.commit()
        self.db.refresh(scene)
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)
        return self._to_scene_detail_response(scene, story, current_user)

    def _upsert_background_asset_layer(
        self,
        scene: StoryScene,
        story: Story,
        current_user: User,
        environment_asset_id: uuid.UUID,
        label: str,
    ) -> None:
        existing_layers = self.scene_repo.list_asset_assignments_by_scene(scene.id)
        for layer in existing_layers:
            if layer.layer_type == "background":
                layer.environment_asset_id = environment_asset_id
                layer.label = label
                self.db.add(layer)
                return
        self.db.add(
            SceneAssetAssignment(
                id=uuid.uuid4(),
                scene_id=scene.id,
                story_id=story.id,
                project_id=story.project_id,
                owner_id=current_user.id,
                layer_type="background",
                label=label,
                environment_asset_id=environment_asset_id,
                layer_order=1,
                position_x=50,
                position_y=50,
                scale_percent=100,
                notes="",
            )
        )

    # ------------------------------------------------------------------
    # 3. Scene Character Assignment CRUD & Reordering
    # ------------------------------------------------------------------

    def add_character_assignment(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneCharacterAssignmentCreateRequest,
    ) -> SceneCharacterAssignmentResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)
        existing = self.scene_repo.list_character_assignments_by_scene(scene.id)

        resolved_char_id: Optional[uuid.UUID] = None
        resolved_story_char_id: Optional[uuid.UUID] = None
        resolved_name = (payload.character_name or "").strip()
        resolved_role = payload.role_in_scene
        resolved_asset_id = payload.asset_id
        notes = payload.notes or ""

        if payload.character_id:
            char = self.character_repo.get_by_id(payload.character_id)
            if not char:
                notes = f"{notes} requested_character_id:{payload.character_id}".strip()
                if not resolved_name:
                    resolved_name = "Missing Character"
            elif char.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's character."
                )
            else:
                resolved_char_id = char.id
                if not resolved_name:
                    resolved_name = char.name
                if not resolved_asset_id and char.canonical_reference_asset_id:
                    resolved_asset_id = char.canonical_reference_asset_id

        if payload.story_character_id:
            for sc_char in story.characters:
                if sc_char.id == payload.story_character_id:
                    resolved_story_char_id = sc_char.id
                    if not resolved_name:
                        resolved_name = sc_char.name
                    break

        if not resolved_name:
            resolved_name = "Scene Character"

        # Validate expression / pose / outfit / asset ownership if they exist
        if payload.expression_id:
            expr = self.db.get(CharacterExpression, payload.expression_id)
            if expr and expr.character and expr.character.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character expression."
                )
        if payload.pose_id:
            pose = self.db.get(CharacterPose, payload.pose_id)
            if pose and pose.character and pose.character.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character pose."
                )
        if payload.outfit_id:
            outfit = self.db.get(CharacterOutfit, payload.outfit_id)
            if outfit and outfit.character and outfit.character.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character outfit."
                )
        if resolved_asset_id:
            c_asset = self.character_repo.get_asset_by_id(resolved_asset_id)
            if c_asset and c_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character asset."
                )

        layer_order = payload.layer_order or (len(existing) + 1)
        assignment = SceneCharacterAssignment(
            id=uuid.uuid4(),
            scene_id=scene.id,
            story_id=story.id,
            project_id=story.project_id,
            owner_id=current_user.id,
            character_id=resolved_char_id,
            story_character_id=resolved_story_char_id,
            character_name=resolved_name,
            role_in_scene=resolved_role,
            expression_id=payload.expression_id,
            pose_id=payload.pose_id,
            outfit_id=payload.outfit_id,
            asset_id=resolved_asset_id,
            layer_order=layer_order,
            position_x=payload.position_x,
            position_y=payload.position_y,
            scale_percent=payload.scale_percent,
            notes=notes,
        )
        assignment = self.scene_repo.create_character_assignment(assignment)

        # Keep scene.characters list in sync
        char_names = list(scene.characters or [])
        if resolved_name not in char_names:
            char_names.append(resolved_name)
            scene.characters = char_names
            self.db.add(scene)
            self.db.commit()
            self._sync_story_json_from_orm(story)

        missing_refs: List[str] = []
        return self._build_character_assignment_response(
            assignment, current_user, missing_refs
        )

    def update_character_assignment(
        self,
        current_user: User,
        assignment_id: uuid.UUID,
        payload: SceneCharacterAssignmentUpdateRequest,
    ) -> SceneCharacterAssignmentResponse:
        assignment, _, _ = self._get_owned_character_assignment(
            assignment_id, current_user
        )

        if payload.character_id is not None:
            char = self.character_repo.get_by_id(payload.character_id)
            if char and char.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's character."
                )
            assignment.character_id = char.id if char else None
            if char and not payload.character_name:
                assignment.character_name = char.name

        if payload.character_name is not None:
            assignment.character_name = payload.character_name.strip()
        if payload.role_in_scene is not None:
            assignment.role_in_scene = payload.role_in_scene

        if payload.clear_expression:
            assignment.expression_id = None
        elif payload.expression_id is not None:
            expr = self.db.get(CharacterExpression, payload.expression_id)
            if expr and expr.character and expr.character.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character expression."
                )
            assignment.expression_id = payload.expression_id

        if payload.clear_pose:
            assignment.pose_id = None
        elif payload.pose_id is not None:
            pose = self.db.get(CharacterPose, payload.pose_id)
            if pose and pose.character and pose.character.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character pose."
                )
            assignment.pose_id = payload.pose_id

        if payload.clear_outfit:
            assignment.outfit_id = None
        elif payload.outfit_id is not None:
            outfit = self.db.get(CharacterOutfit, payload.outfit_id)
            if outfit and outfit.character and outfit.character.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character outfit."
                )
            assignment.outfit_id = payload.outfit_id

        if payload.clear_asset:
            assignment.asset_id = None
        elif payload.asset_id is not None:
            c_asset = self.character_repo.get_asset_by_id(payload.asset_id)
            if c_asset and c_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to use this character asset."
                )
            assignment.asset_id = payload.asset_id

        if payload.layer_order is not None:
            assignment.layer_order = payload.layer_order
        if payload.position_x is not None:
            assignment.position_x = payload.position_x
        if payload.position_y is not None:
            assignment.position_y = payload.position_y
        if payload.scale_percent is not None:
            assignment.scale_percent = payload.scale_percent
        if payload.notes is not None:
            assignment.notes = payload.notes

        assignment = self.scene_repo.save_character_assignment(assignment)
        missing_refs: List[str] = []
        return self._build_character_assignment_response(
            assignment, current_user, missing_refs
        )

    def delete_character_assignment(
        self,
        current_user: User,
        assignment_id: uuid.UUID,
    ) -> None:
        assignment, _, _ = self._get_owned_character_assignment(
            assignment_id, current_user
        )
        self.scene_repo.delete_character_assignment(assignment)

    def reorder_character_assignments(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneCharacterAssignmentReorderRequest,
    ) -> List[SceneCharacterAssignmentResponse]:
        scene, _ = self._get_owned_scene(scene_id, current_user)
        existing = self.scene_repo.list_character_assignments_by_scene(scene.id)
        by_id = {ca.id: ca for ca in existing}

        ordered: List[SceneCharacterAssignment] = []
        for aid in payload.assignment_ids:
            if aid in by_id:
                ordered.append(by_id.pop(aid))
        for rem in by_id.values():
            ordered.append(rem)

        for idx, ca in enumerate(ordered, start=1):
            ca.layer_order = idx
            self.db.add(ca)
        self.db.commit()

        missing_refs: List[str] = []
        return [
            self._build_character_assignment_response(ca, current_user, missing_refs)
            for ca in ordered
        ]

    # ------------------------------------------------------------------
    # 4. Scene Asset Assignment CRUD & Reordering
    # ------------------------------------------------------------------

    def add_asset_assignment(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneAssetAssignmentCreateRequest,
    ) -> SceneAssetAssignmentResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)
        existing = self.scene_repo.list_asset_assignments_by_scene(scene.id)

        resolved_env_asset_id: Optional[uuid.UUID] = None
        if payload.environment_asset_id:
            env_asset = self.environment_repo.get_asset_by_id(
                payload.environment_asset_id
            )
            if env_asset and env_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's environment asset."
                )
            if env_asset:
                resolved_env_asset_id = env_asset.id

        resolved_char_asset_id: Optional[uuid.UUID] = None
        if payload.character_asset_id:
            char_asset = self.character_repo.get_asset_by_id(
                payload.character_asset_id
            )
            if char_asset and char_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's character asset."
                )
            if char_asset:
                resolved_char_asset_id = char_asset.id

        layer_order = payload.layer_order or (len(existing) + 1)
        assignment = SceneAssetAssignment(
            id=uuid.uuid4(),
            scene_id=scene.id,
            story_id=story.id,
            project_id=story.project_id,
            owner_id=current_user.id,
            layer_type=payload.layer_type,
            label=payload.label.strip(),
            environment_asset_id=resolved_env_asset_id,
            character_asset_id=resolved_char_asset_id,
            layer_order=layer_order,
            position_x=payload.position_x,
            position_y=payload.position_y,
            scale_percent=payload.scale_percent,
            notes=payload.notes or "",
        )
        assignment = self.scene_repo.create_asset_assignment(assignment)
        missing_refs: List[str] = []
        return self._build_asset_assignment_response(
            assignment, current_user, missing_refs
        )

    def update_asset_assignment(
        self,
        current_user: User,
        assignment_id: uuid.UUID,
        payload: SceneAssetAssignmentUpdateRequest,
    ) -> SceneAssetAssignmentResponse:
        assignment, _, _ = self._get_owned_asset_assignment(
            assignment_id, current_user
        )

        if payload.layer_type is not None:
            assignment.layer_type = payload.layer_type
        if payload.label is not None:
            assignment.label = payload.label.strip()
        if payload.environment_asset_id is not None:
            env_asset = self.environment_repo.get_asset_by_id(
                payload.environment_asset_id
            )
            if env_asset and env_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's environment asset."
                )
            assignment.environment_asset_id = payload.environment_asset_id
        if payload.character_asset_id is not None:
            char_asset = self.character_repo.get_asset_by_id(
                payload.character_asset_id
            )
            if char_asset and char_asset.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's character asset."
                )
            assignment.character_asset_id = payload.character_asset_id
        if payload.layer_order is not None:
            assignment.layer_order = payload.layer_order
        if payload.position_x is not None:
            assignment.position_x = payload.position_x
        if payload.position_y is not None:
            assignment.position_y = payload.position_y
        if payload.scale_percent is not None:
            assignment.scale_percent = payload.scale_percent
        if payload.notes is not None:
            assignment.notes = payload.notes

        assignment = self.scene_repo.save_asset_assignment(assignment)
        missing_refs: List[str] = []
        return self._build_asset_assignment_response(
            assignment, current_user, missing_refs
        )

    def delete_asset_assignment(
        self,
        current_user: User,
        assignment_id: uuid.UUID,
    ) -> None:
        assignment, _, _ = self._get_owned_asset_assignment(
            assignment_id, current_user
        )
        self.scene_repo.delete_asset_assignment(assignment)

    def reorder_asset_assignments(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneAssetAssignmentReorderRequest,
    ) -> List[SceneAssetAssignmentResponse]:
        scene, _ = self._get_owned_scene(scene_id, current_user)
        existing = self.scene_repo.list_asset_assignments_by_scene(scene.id)
        by_id = {aa.id: aa for aa in existing}

        ordered: List[SceneAssetAssignment] = []
        for aid in payload.assignment_ids:
            if aid in by_id:
                ordered.append(by_id.pop(aid))
        for rem in by_id.values():
            ordered.append(rem)

        for idx, aa in enumerate(ordered, start=1):
            aa.layer_order = idx
            self.db.add(aa)
        self.db.commit()

        missing_refs: List[str] = []
        return [
            self._build_asset_assignment_response(aa, current_user, missing_refs)
            for aa in ordered
        ]

    # ------------------------------------------------------------------
    # 5. Shot-List Planning CRUD & Ordering
    # ------------------------------------------------------------------

    def list_scene_shots(
        self,
        current_user: User,
        scene_id: uuid.UUID,
    ) -> List[SceneShotResponse]:
        scene, _ = self._get_owned_scene(scene_id, current_user)
        shots = self.scene_repo.list_shots_by_scene(scene.id)
        return [self._build_shot_response(sh, current_user) for sh in shots]

    def list_project_shots(
        self,
        current_user: User,
        project_id: uuid.UUID,
    ) -> List[SceneShotResponse]:
        _, story = self._get_owned_story_by_project(project_id, current_user)
        scenes = self.scene_repo.list_scenes_by_story(story.id)
        all_shots: List[SceneShotResponse] = []
        for sc in scenes:
            for sh in self.scene_repo.list_shots_by_scene(sc.id):
                all_shots.append(self._build_shot_response(sh, current_user))
        return all_shots

    def create_shot(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneShotCreateRequest,
    ) -> SceneShotResponse:
        scene, story = self._get_owned_scene(scene_id, current_user)
        existing = self.scene_repo.list_shots_by_scene(scene.id)

        resolved_env_id = payload.environment_id or scene.environment_id
        if resolved_env_id:
            env = self.environment_repo.get_by_id_with_relations(resolved_env_id)
            if env and env.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's environment to this shot."
                )

        shot = SceneShot(
            id=uuid.uuid4(),
            scene_id=scene.id,
            story_id=story.id,
            project_id=story.project_id,
            owner_id=current_user.id,
            shot_number=len(existing) + 1,
            title=payload.title.strip(),
            description=payload.description or "",
            shot_type=payload.shot_type,
            camera_perspective=payload.camera_perspective,
            character_focus=list(payload.character_focus),
            environment_id=resolved_env_id,
            visual_direction=payload.visual_direction or "",
            duration_seconds=payload.duration_seconds,
            production_notes=payload.production_notes or "",
        )
        shot = self.scene_repo.create_shot(shot)
        return self._build_shot_response(shot, current_user)

    def update_shot(
        self,
        current_user: User,
        shot_id: uuid.UUID,
        payload: SceneShotUpdateRequest,
    ) -> SceneShotResponse:
        shot, _, _ = self._get_owned_shot(shot_id, current_user)

        if payload.shot_number is not None:
            shot.shot_number = payload.shot_number
        if payload.title is not None:
            shot.title = payload.title.strip()
        if payload.description is not None:
            shot.description = payload.description
        if payload.shot_type is not None:
            shot.shot_type = payload.shot_type
        if payload.camera_perspective is not None:
            shot.camera_perspective = payload.camera_perspective
        if payload.character_focus is not None:
            shot.character_focus = list(payload.character_focus)
        if payload.clear_environment:
            shot.environment_id = None
        elif payload.environment_id is not None:
            env = self.environment_repo.get_by_id_with_relations(payload.environment_id)
            if env and env.owner_id != current_user.id:
                raise ForbiddenException(
                    "You do not have permission to assign another user's environment to this shot."
                )
            shot.environment_id = payload.environment_id
        if payload.visual_direction is not None:
            shot.visual_direction = payload.visual_direction
        if payload.duration_seconds is not None:
            shot.duration_seconds = payload.duration_seconds
        if payload.production_notes is not None:
            shot.production_notes = payload.production_notes

        shot = self.scene_repo.save_shot(shot)
        return self._build_shot_response(shot, current_user)

    def delete_shot(
        self,
        current_user: User,
        shot_id: uuid.UUID,
    ) -> None:
        shot, _, _ = self._get_owned_shot(shot_id, current_user)
        self.scene_repo.delete_shot(shot)

    def reorder_shots(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneShotReorderRequest,
    ) -> List[SceneShotResponse]:
        scene, _ = self._get_owned_scene(scene_id, current_user)
        existing = self.scene_repo.list_shots_by_scene(scene.id)
        by_id = {sh.id: sh for sh in existing}

        ordered: List[SceneShot] = []
        for sid in payload.shot_ids:
            if sid in by_id:
                ordered.append(by_id.pop(sid))
        for rem in by_id.values():
            ordered.append(rem)

        for idx, sh in enumerate(ordered, start=1):
            sh.shot_number = idx
            self.db.add(sh)
        self.db.commit()

        return [self._build_shot_response(sh, current_user) for sh in ordered]

    # ------------------------------------------------------------------
    # 6. Storyboard Overview Data Retrieval
    # ------------------------------------------------------------------

    def get_storyboard_overview(
        self,
        current_user: User,
        project_id: uuid.UUID,
    ) -> StoryboardOverviewResponse:
        project, story = self._get_owned_story_by_project(project_id, current_user)
        scenes = self.scene_repo.list_scenes_by_story(story.id)

        cards: List[StoryboardCardResponse] = []
        total_shots = 0
        total_duration = 0

        for sc in scenes:
            detail = self._to_scene_detail_response(sc, story, current_user)
            shot_count = len(detail.shots)
            total_shots += shot_count
            total_duration += detail.duration_seconds

            main_chars = list(detail.characters)
            for ca in detail.character_assignments:
                if ca.character_name not in main_chars:
                    main_chars.append(ca.character_name)

            cards.append(
                StoryboardCardResponse(
                    id=detail.id,
                    story_id=detail.story_id,
                    project_id=detail.project_id,
                    scene_number=detail.scene_number,
                    title=detail.title,
                    scene_type=detail.scene_type,
                    scene_heading=detail.scene_heading,
                    summary=detail.summary,
                    description=detail.description,
                    duration_seconds=detail.duration_seconds,
                    time_of_day=detail.time_of_day,
                    weather=detail.weather,
                    mood=detail.mood,
                    camera_framing=detail.camera_framing,
                    transition_type=detail.transition_type,
                    location_name=detail.location_name,
                    environment_id=detail.environment_id,
                    environment_name=(
                        detail.environment.name if detail.environment else None
                    ),
                    world_location_id=detail.world_location_id,
                    world_location_name=(
                        detail.world_location.name if detail.world_location else None
                    ),
                    thumbnail_url=detail.thumbnail_url,
                    has_actual_asset=bool(detail.thumbnail_url),
                    main_characters=main_chars,
                    character_assignments=detail.character_assignments,
                    shot_count=shot_count,
                    dialogue_count=len(detail.dialogue),
                    narration_count=len(detail.narration),
                    missing_references=detail.missing_references,
                    updated_at=detail.updated_at,
                )
            )

        return StoryboardOverviewResponse(
            project_id=project.id,
            story_id=story.id,
            story_title=story.title,
            total_scenes=len(cards),
            total_shots=total_shots,
            total_duration_seconds=total_duration,
            cards=cards,
        )

    # ------------------------------------------------------------------
    # 7. Story <-> Scene Synchronization (Step 2 + Step 3 + Step 4 -> Step 5)
    # ------------------------------------------------------------------

    def sync_scenes_with_story(
        self,
        current_user: User,
        project_id: uuid.UUID,
    ) -> SceneStorySyncResponse:
        """
        Synchronize every `StoryScene` in the project's story with:
        - Step 3 `Character` records (by matching name or `story_character_id`), creating
          `SceneCharacterAssignment` rows without duplicating `Character` rows.
        - Step 4 `Environment` and `WorldLocation` records (by matching `location_name`
          or `story_location_id`), linking `scene.environment_id` and `scene.world_location_id`
          without duplicating `Environment` rows.
        -Step 2 `StoryLocation` `time_of_day` and `atmosphere` defaults if not yet customized.
        """
        project, story = self._get_owned_story_by_project(project_id, current_user)
        scenes = self.scene_repo.list_scenes_by_story(story.id)

        # Load owner's characters (project + global) and environments (project + global)
        owner_characters = self.character_repo.list_for_owner(
            owner_id=current_user.id, limit=200
        )
        char_by_name: Dict[str, Character] = {}
        char_by_story_char_id: Dict[uuid.UUID, Character] = {}
        for ch in owner_characters:
            # Prefer project-matched characters
            if ch.name.lower() not in char_by_name or ch.project_id == project.id:
                char_by_name[ch.name.lower()] = ch
            raw_sc_id = (ch.character_metadata or {}).get("story_character_id")
            if raw_sc_id:
                try:
                    char_by_story_char_id[uuid.UUID(str(raw_sc_id))] = ch
                except ValueError:
                    pass

        story_char_by_name: Dict[str, StoryCharacter] = {
            sc.name.lower(): sc for sc in story.characters
        }
        story_char_by_id: Dict[str, StoryCharacter] = {
            str(sc.id): sc for sc in story.characters
        }

        owner_envs = self.environment_repo.list_by_owner(
            owner_id=current_user.id
        )
        env_by_name: Dict[str, Environment] = {}
        for env in owner_envs:
            if env.name.lower() not in env_by_name or env.project_id == project.id:
                env_by_name[env.name.lower()] = env

        owner_worlds = self.environment_repo.list_worlds_by_owner(
            owner_id=current_user.id
        )
        wloc_by_name: Dict[str, WorldLocation] = {}
        for w in owner_worlds:
            for wl in w.locations:
                wloc_by_name[wl.name.lower()] = wl

        characters_matched = 0
        environments_matched = 0
        missing_refs_all: List[str] = []

        for sc in scenes:
            # 1. Match environment & world location
            loc_key = (sc.location_name or "").strip().lower()
            if not sc.world_location_id and loc_key and loc_key in wloc_by_name:
                sc.world_location_id = wloc_by_name[loc_key].id

            if not sc.environment_id:
                if sc.world_location_id:
                    wloc_obj = self.environment_repo.get_world_location_by_id(
                        sc.world_location_id
                    )
                    if wloc_obj and wloc_obj.environment_id:
                        sc.environment_id = wloc_obj.environment_id
                        environments_matched += 1
                if not sc.environment_id and loc_key and loc_key in env_by_name:
                    matched_env = env_by_name[loc_key]
                    sc.environment_id = matched_env.id
                    environments_matched += 1

            # Sync time_of_day from StoryLocation if still default
            if sc.location_id:
                for sloc in story.locations:
                    if sloc.id == sc.location_id:
                        if not sc.location_name:
                            sc.location_name = sloc.name
                        if sc.time_of_day == "Day" and sloc.time_of_day:
                            sc.time_of_day = sloc.time_of_day
                        break

            # 2. Match characters appearing in the scene or its dialogue
            existing_ca = self.scene_repo.list_character_assignments_by_scene(sc.id)
            assigned_names = {ca.character_name.lower() for ca in existing_ca}
            assigned_char_ids = {
                ca.character_id for ca in existing_ca if ca.character_id
            }

            candidate_names: List[str] = []
            for raw_c in sc.characters or []:
                if raw_c in story_char_by_id:
                    candidate_names.append(story_char_by_id[raw_c].name)
                else:
                    candidate_names.append(str(raw_c))
            for d in sc.dialogue_entries:
                if d.character_name and d.character_name not in candidate_names:
                    candidate_names.append(d.character_name)

            next_order = len(existing_ca) + 1
            for cname in candidate_names:
                ckey = cname.strip().lower()
                if not ckey or ckey in assigned_names:
                    continue

                matched_story_char = story_char_by_name.get(ckey)
                matched_char: Optional[Character] = None
                if (
                    matched_story_char
                    and matched_story_char.id in char_by_story_char_id
                ):
                    matched_char = char_by_story_char_id[matched_story_char.id]
                elif ckey in char_by_name:
                    matched_char = char_by_name[ckey]

                if matched_char and matched_char.id in assigned_char_ids:
                    continue

                self.db.add(
                    SceneCharacterAssignment(
                        id=uuid.uuid4(),
                        scene_id=sc.id,
                        story_id=story.id,
                        project_id=project.id,
                        owner_id=current_user.id,
                        character_id=matched_char.id if matched_char else None,
                        story_character_id=(
                            matched_story_char.id if matched_story_char else None
                        ),
                        character_name=(
                            matched_char.name if matched_char else cname.strip()
                        ),
                        role_in_scene=(
                            matched_char.role
                            if matched_char
                            else (
                                matched_story_char.role
                                if matched_story_char
                                else "Lead"
                            )
                        ),
                        asset_id=(
                            matched_char.canonical_reference_asset_id if matched_char else None
                        ),
                        layer_order=next_order,
                        position_x=min(85, 25 + (next_order - 1) * 25),
                        position_y=75,
                        scale_percent=100,
                        notes="",
                    )
                )
                assigned_names.add(ckey)
                if matched_char:
                    assigned_char_ids.add(matched_char.id)
                characters_matched += 1
                next_order += 1

            self.db.add(sc)

        self.db.commit()
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)

        detailed_scenes = [
            self._to_scene_detail_response(sc, story, current_user)
            for sc in self.scene_repo.list_scenes_by_story(story.id)
        ]
        for ds in detailed_scenes:
            for mref in ds.missing_references:
                if mref not in missing_refs_all:
                    missing_refs_all.append(mref)

        return SceneStorySyncResponse(
            project_id=project.id,
            story_id=story.id,
            scenes_synced=len(detailed_scenes),
            characters_matched=characters_matched,
            environments_matched=environments_matched,
            missing_references_detected=missing_refs_all,
            scenes=detailed_scenes,
        )

    # ------------------------------------------------------------------
    # 8. AI-Assisted Scene & Shot-List Generation (Non-Destructive Review)
    # ------------------------------------------------------------------

    def generate_ai_scene_proposal(
        self,
        current_user: User,
        project_id: uuid.UUID,
        payload: SceneAIGenerationRequest,
    ) -> SceneAIGenerationProposalResponse:
        project, story = self._get_owned_story_by_project(project_id, current_user)

        target_scene: Optional[StoryScene] = None
        if payload.scene_id:
            target_scene, _ = self._get_owned_scene(payload.scene_id, current_user)

        settings = get_settings()
        job = SceneGenerationJob(
            id=uuid.uuid4(),
            project_id=project.id,
            story_id=story.id,
            scene_id=target_scene.id if target_scene else None,
            owner_id=current_user.id,
            job_type=f"ai_{payload.action}",
            status="running",
            provider=settings.AI_PROVIDER,
            model_name=settings.AI_MODEL,
            prompt_summary=f"Action: {payload.action} | Instructions: {(payload.instructions or '')[:180]}",
            result_metadata={},
        )
        job = self.scene_repo.create_job(job)

        try:
            provider = get_ai_story_provider(settings)
            user_prompt = self._build_ai_scene_prompt(
                story=story,
                target_scene=target_scene,
                payload=payload,
                current_user=current_user,
            )
            raw_dict = provider.complete_structured_json(
                SCENE_AI_SYSTEM_PROMPT, user_prompt
            )
            proposal = self._validate_and_normalize_ai_proposal(
                raw_dict=raw_dict,
                job=job,
                payload=payload,
            )
        except (AIConfigurationException, AIProviderException) as exc:
            job.status = "failed"
            job.error_message = exc.detail
            self.scene_repo.save_job(job)
            raise
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            self.scene_repo.save_job(job)
            raise AIProviderException(
                detail=f"Unexpected error during AI scene generation: {exc}",
                error_code="AI_SCENE_GENERATION_FAILED",
            ) from exc

        if payload.apply_immediately:
            self.apply_ai_scene_proposal(
                current_user=current_user,
                project_id=project.id,
                payload=SceneAIApplyProposalRequest(
                    action=payload.action,
                    scene_id=target_scene.id if target_scene else None,
                    accepted_scenes=proposal.proposed_scenes,
                    accepted_shots=proposal.proposed_shots,
                    replace_existing_shots=False,
                    accepted_description=proposal.rewritten_description,
                    accepted_visual_directions=(
                        proposal.suggested_visual_directions or None
                    ),
                    accepted_transition_type=proposal.suggested_transition,
                    accepted_characters=(
                        proposal.suggested_characters or None
                    ),
                ),
            )
            proposal.applied = True

        job.status = "completed"
        job.result_metadata = {
            "action": payload.action,
            "proposed_scenes_count": len(proposal.proposed_scenes),
            "proposed_shots_count": len(proposal.proposed_shots),
            "applied": proposal.applied,
        }
        job = self.scene_repo.save_job(job)
        proposal.job = SceneGenerationJobResponse.model_validate(job)
        return proposal

    def _build_ai_scene_prompt(
        self,
        story: Story,
        target_scene: Optional[StoryScene],
        payload: SceneAIGenerationRequest,
        current_user: User,
    ) -> str:
        chars = self.character_repo.list_for_owner(
            owner_id=current_user.id, limit=50
        )
        envs = self.environment_repo.list_by_owner(
            owner_id=current_user.id
        )[:50]
        char_list = (
            ", ".join(f"{c.name} ({c.role})" for c in chars)
            or ", ".join(f"{sc.name} ({sc.role})" for sc in story.characters)
            or "None yet"
        )
        env_list = (
            ", ".join(f"{e.name} ({e.category}, {e.time_of_day})" for e in envs)
            or ", ".join(f"{loc.name} ({loc.time_of_day})" for loc in story.locations)
            or "None yet"
        )

        scene_context = ""
        if target_scene:
            scene_context = (
                f"\nTarget Scene #{target_scene.scene_number}: {target_scene.title}\n"
                f"- Type: {target_scene.scene_type}\n"
                f"- Heading: {target_scene.scene_heading}\n"
                f"- Location: {target_scene.location_name}\n"
                f"- Time/Weather/Mood: {target_scene.time_of_day} / {target_scene.weather} / {target_scene.mood}\n"
                f"- Description: {target_scene.description}\n"
                f"- Action: {target_scene.action_description}\n"
                f"- Characters: {', '.join(target_scene.characters or [])}\n"
            )

        return (
            f"Requested AI Scene Builder Action: {payload.action}\n"
            f"Desired Item Count: {payload.desired_count}\n"
            f"Target Tone Override: {payload.target_tone or story.tone}\n"
            f"Story Section / Input Text: {payload.story_section_text or story.summary or story.idea}\n"
            f"User Instructions: {payload.instructions or 'Generate production-ready storyboard scenes and shot breakdowns.'}\n\n"
            f"Story Context:\n"
            f"- Title: {story.title}\n"
            f"- Genre & Style: {story.genre} / {story.animation_style}\n"
            f"- Available Characters: {char_list}\n"
            f"- Available Environments: {env_list}\n"
            f"{scene_context}"
        )

    def _validate_and_normalize_ai_proposal(
        self,
        raw_dict: Dict[str, Any],
        job: SceneGenerationJob,
        payload: SceneAIGenerationRequest,
    ) -> SceneAIGenerationProposalResponse:
        if not isinstance(raw_dict, dict):
            raise AIProviderException(
                detail="AI provider did not return a JSON dictionary for scene proposal.",
                error_code="AI_INVALID_SCHEMA",
            )

        raw_scenes = raw_dict.get("proposed_scenes")
        raw_shots = raw_dict.get("proposed_shots")
        if raw_scenes is not None and not isinstance(raw_scenes, list):
            raise AIProviderException(
                detail="AI response 'proposed_scenes' field must be a list.",
                error_code="AI_SCHEMA_VALIDATION_FAILED",
            )
        if raw_shots is not None and not isinstance(raw_shots, list):
            raise AIProviderException(
                detail="AI response 'proposed_shots' field must be a list.",
                error_code="AI_SCHEMA_VALIDATION_FAILED",
            )

        try:
            proposed_scenes = [
                ProposedSceneItem.model_validate(item)
                for item in (raw_scenes or [])
            ]
            proposed_shots = [
                ProposedShotItem.model_validate(item)
                for item in (raw_shots or [])
            ]
        except ValidationError as exc:
            raise AIProviderException(
                detail=f"AI scene proposal failed schema validation: {exc.errors()[0].get('msg', 'invalid field')}",
                error_code="AI_SCHEMA_VALIDATION_FAILED",
            ) from exc

        summary = str(
            raw_dict.get("summary_of_suggestions")
            or f"Generated {len(proposed_scenes)} scene(s) and {len(proposed_shots)} shot(s) for review."
        )

        return SceneAIGenerationProposalResponse(
            schema_version="1.0",
            job=SceneGenerationJobResponse.model_validate(job),
            action=payload.action,
            summary_of_suggestions=summary,
            applied=False,
            scene_id=payload.scene_id,
            proposed_scenes=proposed_scenes,
            proposed_shots=proposed_shots,
            suggested_environments=[
                str(x) for x in (raw_dict.get("suggested_environments") or [])
            ],
            suggested_characters=[
                str(x) for x in (raw_dict.get("suggested_characters") or [])
            ],
            suggested_visual_directions=[
                str(x) for x in (raw_dict.get("suggested_visual_directions") or [])
            ],
            suggested_transition=raw_dict.get("suggested_transition"),
            rewritten_description=raw_dict.get("rewritten_description"),
        )

    def apply_ai_scene_proposal(
        self,
        current_user: User,
        project_id: uuid.UUID,
        payload: SceneAIApplyProposalRequest,
    ) -> List[SceneDetailResponse]:
        """
        Apply user-approved AI scene and/or shot suggestions non-destructively.
        """
        project, story = self._get_owned_story_by_project(project_id, current_user)

        # 1. If targeting a specific existing scene, update approved fields and/or add shots
        if payload.scene_id:
            scene, _ = self._get_owned_scene(payload.scene_id, current_user)
            if payload.accepted_title:
                scene.title = payload.accepted_title.strip()
            if payload.accepted_summary is not None:
                scene.summary = payload.accepted_summary
            if payload.accepted_description is not None:
                scene.description = payload.accepted_description
            if payload.accepted_visual_directions is not None:
                scene.visual_directions = list(payload.accepted_visual_directions)
            if payload.accepted_transition_type is not None:
                scene.transition_type = payload.accepted_transition_type
            if payload.accepted_characters is not None:
                scene.characters = list(payload.accepted_characters)
            if payload.accepted_environment_name:
                scene.location_name = payload.accepted_environment_name
            self.db.add(scene)

            if payload.replace_existing_shots and payload.accepted_shots:
                for old_shot in self.scene_repo.list_shots_by_scene(scene.id):
                    self.db.delete(old_shot)
                self.db.flush()

            existing_shots = self.scene_repo.list_shots_by_scene(scene.id)
            start_shot_num = len(existing_shots) + 1
            for idx, pshot in enumerate(payload.accepted_shots, start=start_shot_num):
                self.db.add(
                    SceneShot(
                        id=uuid.uuid4(),
                        scene_id=scene.id,
                        story_id=story.id,
                        project_id=project.id,
                        owner_id=current_user.id,
                        shot_number=idx,
                        title=pshot.title,
                        description=pshot.description,
                        shot_type=pshot.shot_type,
                        camera_perspective=pshot.camera_perspective,
                        character_focus=list(pshot.character_focus),
                        environment_id=scene.environment_id,
                        visual_direction=pshot.visual_direction,
                        duration_seconds=pshot.duration_seconds,
                        production_notes=pshot.production_notes,
                    )
                )

        # 2. Append any accepted new scenes
        existing_scenes = self.scene_repo.list_scenes_by_story(story.id)
        next_scene_num = len(existing_scenes) + 1
        for pscene in payload.accepted_scenes:
            new_sc = StoryScene(
                id=uuid.uuid4(),
                story_id=story.id,
                scene_number=next_scene_num,
                title=pscene.title,
                scene_type=pscene.scene_type or "Narrative",
                scene_heading=pscene.scene_heading or "EXT. LOCATION - DAY",
                summary=pscene.summary,
                description=pscene.description,
                action_description=pscene.action_description,
                location_name=pscene.location_name or pscene.suggested_environment_name,
                time_of_day=pscene.time_of_day or "Day",
                weather=pscene.weather or "Clear",
                mood=pscene.mood or "Cinematic",
                duration_seconds=pscene.duration_seconds,
                camera_framing=pscene.camera_framing or "Wide establishing shot",
                transition_type=pscene.transition_type or "Cut",
                production_notes=pscene.production_notes,
                storyboard_notes=pscene.production_notes,
                characters=list(pscene.suggested_characters),
                visual_directions=list(pscene.visual_directions),
                camera_directions=list(pscene.camera_directions),
                audio_directions=list(pscene.audio_directions),
                emotional_directions=[pscene.mood] if pscene.mood else [],
                scene_metadata={},
            )
            self.db.add(new_sc)
            self.db.flush()

            for s_idx, pshot in enumerate(pscene.shots, start=1):
                self.db.add(
                    SceneShot(
                        id=uuid.uuid4(),
                        scene_id=new_sc.id,
                        story_id=story.id,
                        project_id=project.id,
                        owner_id=current_user.id,
                        shot_number=s_idx,
                        title=pshot.title,
                        description=pshot.description,
                        shot_type=pshot.shot_type,
                        camera_perspective=pshot.camera_perspective,
                        character_focus=list(pshot.character_focus),
                        environment_id=None,
                        visual_direction=pshot.visual_direction,
                        duration_seconds=pshot.duration_seconds,
                        production_notes=pshot.production_notes,
                    )
                )
            next_scene_num += 1

        self.db.commit()
        self.db.refresh(story)
        self._sync_story_json_from_orm(story)
        # Run character/environment synchronization so newly added scenes auto-link matching characters/environments
        self.sync_scenes_with_story(current_user, project.id)
        return self.list_project_scenes(current_user, project.id)

    def list_project_scene_jobs(
        self,
        current_user: User,
        project_id: uuid.UUID,
    ) -> List[SceneGenerationJobResponse]:
        self._get_owned_project(project_id, current_user)
        jobs = self.scene_repo.list_jobs_by_project(project_id)
        return [SceneGenerationJobResponse.model_validate(j) for j in jobs]

    def get_scene_job(
        self,
        current_user: User,
        job_id: uuid.UUID,
    ) -> SceneGenerationJobResponse:
        job = self.scene_repo.get_job_by_id(job_id)
        if not job:
            raise NotFoundException(f"Scene generation job '{job_id}' was not found.")
        if job.owner_id != current_user.id:
            raise ForbiddenException(
                "You do not have permission to access this scene generation job."
            )
        return SceneGenerationJobResponse.model_validate(job)
