"""
Service Layer for TR STUDIO Step 6 — Professional 2D Animation Engine.
Handles:
- Animation document creation & synchronization from Step 5 scenes
- Concurrency protection & document validation
- Preset application
- AI-assisted animation suggestions with non-destructive review
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import (
    AIConfigurationException,
    AIProviderException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.animation import AnimationGenerationJob, SceneAnimation
from app.models.project import Project
from app.models.scene import SceneAssetAssignment, SceneCharacterAssignment
from app.models.story import Story, StoryScene
from app.models.user import User
from app.repositories.animation_repository import AnimationRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.scene_repository import SceneRepository
from app.repositories.story_repository import StoryRepository
from app.schemas.animation import (
    AnimationAIAssistProposalResponse,
    AnimationAIAssistRequest,
    AnimationAIApplyProposalRequest,
    AnimationGenerationJobResponse,
    AnimationPresetResponse,
    AnimationProposedTrack,
    AnimationApplyPresetRequest,
    SceneAnimationResponse,
    SceneAnimationSaveRequest,
)
from app.services.ai_provider import get_ai_story_provider

logger = logging.getLogger("tr_studio.animation_service")

ALLOWED_FPS = [12, 24, 25, 30, 60]

PRESET_DEFINITIONS: List[Dict[str, Any]] = [
    {"id": "fade-in", "label": "Fade in", "category": "transition", "description": "Opacity 0 -> current.", "default_duration_ms": 1000, "params": []},
    {"id": "fade-out", "label": "Fade out", "category": "transition", "description": "Opacity current -> 0.", "default_duration_ms": 1000, "params": []},
    {"id": "slide-left", "label": "Slide left", "category": "motion", "description": "Move left by distance.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 300.0},
    {"id": "slide-right", "label": "Slide right", "category": "motion", "description": "Move right by distance.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 300.0},
    {"id": "slide-up", "label": "Slide up", "category": "motion", "description": "Move up by distance.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 200.0},
    {"id": "slide-down", "label": "Slide down", "category": "motion", "description": "Move down by distance.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 200.0},
    {"id": "zoom-in", "label": "Zoom in", "category": "motion", "description": "Scale up by amount.", "default_duration_ms": 1000, "params": ["amount"], "default_amount": 0.5},
    {"id": "zoom-out", "label": "Zoom out", "category": "motion", "description": "Scale down by amount.", "default_duration_ms": 1000, "params": ["amount"], "default_amount": 0.4},
    {"id": "rotate", "label": "Rotate", "category": "motion", "description": "Rotate by amount degrees.", "default_duration_ms": 1000, "params": ["amount"], "default_amount": 360.0},
    {"id": "bounce", "label": "Bounce", "category": "motion", "description": "Vertical bounces decaying.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 120.0},
    {"id": "shake", "label": "Shake", "category": "motion", "description": "Rapid horizontal shake.", "default_duration_ms": 600, "params": ["distance"], "default_distance": 14.0},
    {"id": "pulse", "label": "Pulse", "category": "motion", "description": "Scale pulses twice.", "default_duration_ms": 1000, "params": ["amount"], "default_amount": 0.12},
    {"id": "float", "label": "Float", "category": "motion", "description": "Gentle vertical drift.", "default_duration_ms": 3000, "params": ["distance"], "default_distance": 20.0},
    {"id": "custom", "label": "Custom (X position)", "category": "motion", "description": "Two editable X keyframes at start and end.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 100.0},
    {"id": "idle", "label": "Idle (breathing)", "category": "character", "description": "Subtle vertical scale breathing.", "default_duration_ms": 2000, "params": ["amount"], "default_amount": 0.02},
    {"id": "walk", "label": "Walk", "category": "character", "description": "Travel with bob and sway (transform-based).", "default_duration_ms": 3000, "params": ["distance"], "default_distance": 400.0},
    {"id": "run", "label": "Run", "category": "character", "description": "Faster travel with bigger bob and forward lean.", "default_duration_ms": 2000, "params": ["distance"], "default_distance": 700.0},
    {"id": "jump", "label": "Jump", "category": "character", "description": "Crouch, leap and land with squash and stretch.", "default_duration_ms": 900, "params": ["distance"], "default_distance": 220.0},
    {"id": "talk", "label": "Talking gesture", "category": "character", "description": "Small head-bob and sway while speaking.", "default_duration_ms": 2000, "params": ["amount"], "default_amount": 2.0},
    {"id": "wave", "label": "Wave", "category": "character", "description": "Whole-body rocking wave gesture.", "default_duration_ms": 1500, "params": ["amount"], "default_amount": 10.0},
    {"id": "turn", "label": "Turn around", "category": "character", "description": "Flip horizontally via scale X.", "default_duration_ms": 500, "params": []},
    {"id": "react-happy", "label": "Reaction: happy", "category": "character", "description": "Cheerful hop.", "default_duration_ms": 900, "params": ["distance"], "default_distance": 40.0},
    {"id": "react-sad", "label": "Reaction: sad", "category": "character", "description": "Slump and slow sway.", "default_duration_ms": 1500, "params": ["distance"], "default_distance": 18.0},
    {"id": "react-surprised", "label": "Reaction: surprised", "category": "character", "description": "Pop scale and recoil.", "default_duration_ms": 700, "params": ["amount"], "default_amount": 0.15},
    {"id": "react-angry", "label": "Reaction: angry", "category": "character", "description": "Tremble and swell.", "default_duration_ms": 1000, "params": ["distance"], "default_distance": 8.0},
    {"id": "camera-static", "label": "Camera: static", "category": "camera", "description": "Clears camera tracks in the range.", "default_duration_ms": 1000, "params": []},
    {"id": "camera-pan", "label": "Camera: pan", "category": "camera", "description": "Pan horizontally by distance.", "default_duration_ms": 3000, "params": ["distance"], "default_distance": 400.0},
    {"id": "camera-zoom-in", "label": "Camera: zoom in", "category": "camera", "description": "Zoom to 1 + amount.", "default_duration_ms": 3000, "params": ["amount"], "default_amount": 0.4},
    {"id": "camera-zoom-out", "label": "Camera: zoom out", "category": "camera", "description": "Zoom to 1 - amount.", "default_duration_ms": 3000, "params": ["amount"], "default_amount": 0.3},
    {"id": "camera-follow", "label": "Camera: follow target", "category": "camera", "description": "Bakes editable keyframes following the selected object.", "default_duration_ms": 3000, "params": []},
]

ANIMATION_AI_SYSTEM_PROMPT = """You are the Senior 2D Animation Director for TR STUDIO.
Your role is to propose clean, editable animation keyframe tracks for scenes, characters, objects, or camera.
Always return structured JSON matching the requested schema.
Never fabricate finished video; suggest exact keyframe timings, properties, and values that animator-users can inspect and edit.
"""


class AnimationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.anim_repo = AnimationRepository(db)
        self.scene_repo = SceneRepository(db)
        self.story_repo = StoryRepository(db)
        self.project_repo = ProjectRepository(db)

    # ------------------------------------------------------------------
    # Ownership helpers
    # ------------------------------------------------------------------
    def _get_owned_scene(
        self, scene_id: uuid.UUID, current_user: User
    ) -> Tuple[StoryScene, Story, Project]:
        scene = self.scene_repo.get_scene_by_id(scene_id)
        if not scene:
            raise NotFoundException(f"Scene with ID '{scene_id}' was not found.")
        story = self.story_repo.get_by_id(scene.story_id)
        if not story:
            raise NotFoundException(f"Story for scene '{scene_id}' was not found.")
        if story.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this scene.")
        project = self.project_repo.get_by_id(story.project_id)
        if not project or project.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this project.")
        return scene, story, project

    def _get_owned_project(
        self, project_id: uuid.UUID, current_user: User
    ) -> Tuple[Project, Story]:
        project = self.project_repo.get_by_id(project_id)
        if not project:
            raise NotFoundException(f"Project with ID '{project_id}' was not found.")
        if project.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to access this project.")
        story = self.story_repo.get_by_project_id(project_id)
        if not story:
            raise NotFoundException(f"No story found for project '{project_id}'.")
        return project, story

    # ------------------------------------------------------------------
    # Document initialization from Step 5 Scene
    # ------------------------------------------------------------------
    def _build_initial_document(
        self, scene: StoryScene, width: int = 1920, height: int = 1080, fps: int = 24
    ) -> Dict[str, Any]:
        duration_ms = max(1000, min(600_000, int((scene.duration_seconds or 5) * 1000)))
        asset_assignments = self.scene_repo.list_asset_assignments_by_scene(scene.id)
        char_assignments = self.scene_repo.list_character_assignments_by_scene(scene.id)

        objects: List[Dict[str, Any]] = []
        order = 0

        # Background assets
        bg_assets = [a for a in asset_assignments if a.layer_type == "background"]
        for a in sorted(bg_assets, key=lambda x: x.layer_order):
            objects.append({
                "id": f"obj_asset_{a.id}",
                "kind": "background",
                "label": a.label or "Background",
                "source_ref": {"type": "scene_asset", "id": str(a.id)},
                "layer_order": order,
                "base": {
                    "x": width / 2.0,
                    "y": height / 2.0,
                    "scale_x": 1.0,
                    "scale_y": 1.0,
                    "rotation": 0.0,
                    "opacity": 1.0,
                    "visible": True,
                    "anchor_x": 0.5,
                    "anchor_y": 0.5,
                    "width": width,
                    "height": height,
                },
            })
            order += 1

        if not bg_assets:
            # Fallback environment background
            objects.append({
                "id": "obj_scene_environment",
                "kind": "background",
                "label": "Scene Environment",
                "source_ref": {"type": "scene_environment", "id": str(scene.id)},
                "layer_order": -1,
                "base": {
                    "x": width / 2.0,
                    "y": height / 2.0,
                    "scale_x": 1.0,
                    "scale_y": 1.0,
                    "rotation": 0.0,
                    "opacity": 1.0,
                    "visible": True,
                    "anchor_x": 0.5,
                    "anchor_y": 0.5,
                    "width": width,
                    "height": height,
                },
            })

        # Midground props
        mid_assets = [
            a for a in asset_assignments
            if a.layer_type not in ("background", "foreground", "overlay")
        ]
        for a in sorted(mid_assets, key=lambda x: x.layer_order):
            w = width * 0.3 * (a.scale_percent / 100.0)
            objects.append({
                "id": f"obj_asset_{a.id}",
                "kind": "prop",
                "label": a.label or "Prop",
                "source_ref": {"type": "scene_asset", "id": str(a.id)},
                "layer_order": order,
                "base": {
                    "x": (a.position_x / 100.0) * width,
                    "y": (a.position_y / 100.0) * height,
                    "scale_x": 1.0,
                    "scale_y": 1.0,
                    "rotation": 0.0,
                    "opacity": 1.0,
                    "visible": True,
                    "anchor_x": 0.5,
                    "anchor_y": 0.5,
                    "width": max(40.0, w),
                    "height": max(40.0, w),
                },
            })
            order += 1

        # Characters (anchor at bottom-center so feet stay on staging coordinates)
        for c in sorted(char_assignments, key=lambda x: x.layer_order):
            h = max(60.0, height * 0.6 * (c.scale_percent / 100.0))
            objects.append({
                "id": f"obj_char_{c.id}",
                "kind": "character",
                "label": c.character_name or "Character",
                "source_ref": {"type": "scene_character", "id": str(c.id)},
                "layer_order": order,
                "base": {
                    "x": (c.position_x / 100.0) * width,
                    "y": (c.position_y / 100.0) * height,
                    "scale_x": 1.0,
                    "scale_y": 1.0,
                    "rotation": 0.0,
                    "opacity": 1.0,
                    "visible": True,
                    "anchor_x": 0.5,
                    "anchor_y": 1.0,
                    "width": max(40.0, h * 0.6),
                    "height": h,
                },
            })
            order += 1

        # Foreground & overlay assets
        fore_assets = [
            a for a in asset_assignments
            if a.layer_type in ("foreground", "overlay")
        ]
        for a in sorted(fore_assets, key=lambda x: x.layer_order):
            w = width * 0.3 * (a.scale_percent / 100.0)
            objects.append({
                "id": f"obj_asset_{a.id}",
                "kind": "foreground" if a.layer_type == "foreground" else "overlay",
                "label": a.label or "Foreground Layer",
                "source_ref": {"type": "scene_asset", "id": str(a.id)},
                "layer_order": order,
                "base": {
                    "x": (a.position_x / 100.0) * width,
                    "y": (a.position_y / 100.0) * height,
                    "scale_x": 1.0,
                    "scale_y": 1.0,
                    "rotation": 0.0,
                    "opacity": 1.0,
                    "visible": True,
                    "anchor_x": 0.5,
                    "anchor_y": 0.5,
                    "width": max(40.0, w),
                    "height": max(40.0, w),
                },
            })
            order += 1

        return {
            "schema_version": "1.0",
            "scene_id": str(scene.id),
            "fps": fps,
            "width": width,
            "height": height,
            "duration_ms": duration_ms,
            "playback": {
                "loop": False,
                "speed": 1.0,
                "range_start_ms": 0,
                "range_end_ms": None,
            },
            "camera": {
                "x": width / 2.0,
                "y": height / 2.0,
                "zoom": 1.0,
                "rotation": 0.0,
            },
            "objects": objects,
            "tracks": [],
            "motion_paths": [],
            "rigs": [],
            "clips": [],
            "markers": [],
            "groups": [],
        }

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    def get_or_create_scene_animation(
        self, current_user: User, scene_id: uuid.UUID
    ) -> SceneAnimationResponse:
        scene, story, project = self._get_owned_scene(scene_id, current_user)
        anim = self.anim_repo.get_animation_by_scene_id(scene.id)
        if not anim:
            doc = self._build_initial_document(scene)
            anim = SceneAnimation(
                id=uuid.uuid4(),
                scene_id=scene.id,
                story_id=story.id,
                project_id=project.id,
                owner_id=current_user.id,
                schema_version=doc["schema_version"],
                version_number=1,
                fps=doc["fps"],
                duration_ms=doc["duration_ms"],
                width=doc["width"],
                height=doc["height"],
                document=doc,
            )
            anim = self.anim_repo.save_animation(anim)
        return SceneAnimationResponse.model_validate(anim)

    def save_scene_animation(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: SceneAnimationSaveRequest,
    ) -> SceneAnimationResponse:
        scene, story, project = self._get_owned_scene(scene_id, current_user)
        anim = self.anim_repo.get_animation_by_scene_id(scene.id)
        if not anim:
            # Create first version
            anim = SceneAnimation(
                id=uuid.uuid4(),
                scene_id=scene.id,
                story_id=story.id,
                project_id=project.id,
                owner_id=current_user.id,
                schema_version="1.0",
                version_number=1,
                fps=24,
                duration_ms=5000,
                width=1920,
                height=1080,
                document={},
            )

        # Concurrency conflict check
        if (
            payload.expected_version_number is not None
            and anim.version_number != payload.expected_version_number
        ):
            raise ConflictException(
                f"Concurrent edit conflict: animation document was updated to version {anim.version_number} by another session."
            )

        doc = payload.document
        if not isinstance(doc, dict):
            raise AIProviderException(
                detail="Animation document must be a JSON object.",
                error_code="INVALID_ANIMATION_SCHEMA",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        fps = int(doc.get("fps") or 24)
        if fps not in ALLOWED_FPS:
            fps = 24
            doc["fps"] = 24

        duration_ms = int(doc.get("duration_ms") or 5000)
        duration_ms = max(500, min(600_000, duration_ms))
        doc["duration_ms"] = duration_ms

        width = int(doc.get("width") or 1920)
        height = int(doc.get("height") or 1080)
        doc["width"] = width
        doc["height"] = height
        doc["schema_version"] = "1.0"
        doc["scene_id"] = str(scene.id)

        anim.schema_version = "1.0"
        anim.version_number += 1
        anim.fps = fps
        anim.duration_ms = duration_ms
        anim.width = width
        anim.height = height
        anim.document = doc

        anim = self.anim_repo.save_animation(anim)
        return SceneAnimationResponse.model_validate(anim)

    def reset_scene_animation(
        self, current_user: User, scene_id: uuid.UUID
    ) -> SceneAnimationResponse:
        scene, story, project = self._get_owned_scene(scene_id, current_user)
        anim = self.anim_repo.get_animation_by_scene_id(scene.id)
        doc = self._build_initial_document(scene)
        if not anim:
            anim = SceneAnimation(
                id=uuid.uuid4(),
                scene_id=scene.id,
                story_id=story.id,
                project_id=project.id,
                owner_id=current_user.id,
                schema_version="1.0",
                version_number=1,
                fps=doc["fps"],
                duration_ms=doc["duration_ms"],
                width=doc["width"],
                height=doc["height"],
                document=doc,
            )
        else:
            anim.version_number += 1
            anim.document = doc
            anim.fps = doc["fps"]
            anim.duration_ms = doc["duration_ms"]
            anim.width = doc["width"]
            anim.height = doc["height"]
        anim = self.anim_repo.save_animation(anim)
        return SceneAnimationResponse.model_validate(anim)

    # ------------------------------------------------------------------
    # Presets
    # ------------------------------------------------------------------
    def list_presets(self) -> List[AnimationPresetResponse]:
        return [AnimationPresetResponse.model_validate(p) for p in PRESET_DEFINITIONS]

    def apply_preset(
        self,
        current_user: User,
        scene_id: uuid.UUID,
        payload: AnimationApplyPresetRequest,
    ) -> SceneAnimationResponse:
        scene, _, _ = self._get_owned_scene(scene_id, current_user)
        anim_res = self.get_or_create_scene_animation(current_user, scene.id)
        anim = self.anim_repo.get_animation_by_id(anim_res.id)
        assert anim is not None

        doc = dict(anim.document)
        tracks = list(doc.get("tracks") or [])
        target = payload.target_id
        preset_id = payload.preset_id
        t0 = payload.start_ms
        t1 = payload.start_ms + payload.duration_ms

        # Generate keyframes based on preset
        new_kfs: List[Dict[str, Any]] = []
        prop = "x"

        if preset_id == "fade-in":
            prop = "opacity"
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "linear"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": 1.0, "interpolation": "linear"},
            ]
        elif preset_id == "fade-out":
            prop = "opacity"
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 1.0, "interpolation": "linear"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": 0.0, "interpolation": "linear"},
            ]
        elif preset_id == "slide-right":
            prop = "x"
            dist = payload.distance if payload.distance is not None else 300.0
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "ease-in-out"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": dist, "interpolation": "linear"},
            ]
        elif preset_id == "slide-left":
            prop = "x"
            dist = payload.distance if payload.distance is not None else 300.0
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "ease-in-out"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": -dist, "interpolation": "linear"},
            ]
        elif preset_id == "slide-up":
            prop = "y"
            dist = payload.distance if payload.distance is not None else 200.0
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "ease-in-out"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": -dist, "interpolation": "linear"},
            ]
        elif preset_id == "slide-down":
            prop = "y"
            dist = payload.distance if payload.distance is not None else 200.0
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "ease-in-out"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": dist, "interpolation": "linear"},
            ]
        elif preset_id == "rotate":
            prop = "rotation"
            amt = payload.amount if payload.amount is not None else 360.0
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "linear"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": amt, "interpolation": "linear"},
            ]
        elif preset_id == "camera-pan":
            target = "camera"
            prop = "camera_x"
            dist = payload.distance if payload.distance is not None else 400.0
            cam_x = float(doc.get("camera", {}).get("x", 960.0))
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": cam_x, "interpolation": "ease-in-out"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": cam_x + dist, "interpolation": "linear"},
            ]
        elif preset_id == "camera-zoom-in":
            target = "camera"
            prop = "camera_zoom"
            amt = payload.amount if payload.amount is not None else 0.4
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 1.0, "interpolation": "ease-in-out"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": 1.0 + amt, "interpolation": "linear"},
            ]
        else:
            # Generic motion track
            prop = "x"
            dist = payload.distance if payload.distance is not None else 100.0
            new_kfs = [
                {"id": str(uuid.uuid4()), "time_ms": t0, "value": 0.0, "interpolation": "linear"},
                {"id": str(uuid.uuid4()), "time_ms": t1, "value": dist, "interpolation": "linear"},
            ]

        # Find existing track or add
        existing_tr = next(
            (t for t in tracks if t.get("target_id") == target and t.get("property") == prop),
            None,
        )
        if existing_tr:
            old_kfs = [k for k in existing_tr.get("keyframes", []) if k.get("time_ms", 0) < t0 or k.get("time_ms", 0) > t1]
            existing_tr["keyframes"] = sorted(old_kfs + new_kfs, key=lambda x: x["time_ms"])
        else:
            tracks.append({
                "id": f"trk_{uuid.uuid4().hex[:8]}",
                "target_id": target,
                "property": prop,
                "enabled": True,
                "metadata": {"preset": preset_id},
                "keyframes": new_kfs,
            })

        doc["tracks"] = tracks
        anim.version_number += 1
        anim.document = doc
        anim = self.anim_repo.save_animation(anim)
        return SceneAnimationResponse.model_validate(anim)

    # ------------------------------------------------------------------
    # AI Assisted Animation
    # ------------------------------------------------------------------
    def generate_ai_animation_proposal(
        self,
        current_user: User,
        project_id: uuid.UUID,
        payload: AnimationAIAssistRequest,
    ) -> AnimationAIAssistProposalResponse:
        project, story = self._get_owned_project(project_id, current_user)
        scene = self.scene_repo.get_scene_by_id(payload.scene_id)
        if not scene or scene.story_id != story.id:
            raise NotFoundException(f"Scene with ID '{payload.scene_id}' was not found in this project.")

        settings = get_settings()
        job = AnimationGenerationJob(
            id=uuid.uuid4(),
            project_id=project.id,
            story_id=story.id,
            scene_id=scene.id,
            owner_id=current_user.id,
            job_type=f"ai_{payload.action}",
            status="running",
            provider=settings.AI_PROVIDER,
            model_name=settings.AI_MODEL,
            prompt_summary=f"Action: {payload.action} | Target: {payload.object_id} | Instructions: {(payload.instructions or '')[:180]}",
            result_metadata={},
        )
        job = self.anim_repo.create_job(job)

        try:
            provider = get_ai_story_provider(settings)
            user_prompt = self._build_ai_animation_prompt(
                scene=scene,
                payload=payload,
            )
            raw_dict = provider.complete_structured_json(
                ANIMATION_AI_SYSTEM_PROMPT, user_prompt
            )
            proposal = self._validate_and_normalize_ai_proposal(
                raw_dict=raw_dict,
                job=job,
                payload=payload,
                scene=scene,
            )
        except (AIConfigurationException, AIProviderException) as exc:
            job.status = "failed"
            job.error_message = exc.detail
            self.anim_repo.save_job(job)
            raise
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            self.anim_repo.save_job(job)
            raise AIProviderException(
                detail=f"Unexpected error during AI animation generation: {exc}",
                error_code="AI_ANIMATION_GENERATION_FAILED",
            ) from exc

        if payload.apply_immediately:
            self.apply_ai_animation_proposal(
                current_user=current_user,
                project_id=project.id,
                payload=AnimationAIApplyProposalRequest(
                    action=payload.action,
                    scene_id=scene.id,
                    accepted_tracks=proposal.proposed_tracks,
                    accepted_camera_tracks=proposal.proposed_camera_tracks,
                    overwrite_existing=False,
                ),
            )
            proposal.applied = True

        job.status = "completed"
        job.result_metadata = {
            "action": payload.action,
            "proposed_tracks_count": len(proposal.proposed_tracks),
            "proposed_camera_tracks_count": len(proposal.proposed_camera_tracks),
            "applied": proposal.applied,
        }
        job = self.anim_repo.save_job(job)
        proposal.job = AnimationGenerationJobResponse.model_validate(job)
        return proposal

    def _build_ai_animation_prompt(
        self,
        scene: StoryScene,
        payload: AnimationAIAssistRequest,
    ) -> str:
        return (
            f"Scene Title: {scene.title}\n"
            f"Scene Summary: {scene.summary or scene.description or 'No summary'}\n"
            f"Visual Action: {scene.action_description or 'No action'}\n"
            f"Scene Duration: {scene.duration_seconds}s (total {int(scene.duration_seconds * 1000)}ms)\n"
            f"Requested Action: {payload.action}\n"
            f"Target Object: {payload.object_id or 'all'}\n"
            f"Target Tone: {payload.target_tone or 'Cinematic'}\n"
            f"Extra Instructions: {payload.instructions or 'None'}\n\n"
            "Return JSON adhering to this schema:\n"
            "{\n"
            '  "summary_of_suggestions": "Short overview of keyframe animation suggested",\n'
            '  "suggested_preset_id": "optional preset id like walk or bounce or null",\n'
            '  "explanation": "Why this motion fits the scene beat",\n'
            '  "proposed_tracks": [\n'
            "    {\n"
            '      "target_id": "object id string or hero",\n'
            '      "property": "x | y | scale_x | scale_y | rotation | opacity",\n'
            '      "keyframes": [\n'
            '        {"time_ms": 0, "value": 0, "interpolation": "ease-in-out"},\n'
            '        {"time_ms": 1000, "value": 200, "interpolation": "linear"}\n'
            "      ]\n"
            "    }\n"
            "  ],\n"
            '  "proposed_camera_tracks": [\n'
            "    {\n"
            '      "target_id": "camera",\n'
            '      "property": "camera_x | camera_y | camera_zoom",\n'
            '      "keyframes": [\n'
            '        {"time_ms": 0, "value": 960, "interpolation": "ease-in-out"},\n'
            '        {"time_ms": 2000, "value": 1160, "interpolation": "linear"}\n'
            "      ]\n"
            "    }\n"
            "  ]\n"
            "}\n"
        )

    def _validate_and_normalize_ai_proposal(
        self,
        raw_dict: Dict[str, Any],
        job: AnimationGenerationJob,
        payload: AnimationAIAssistRequest,
        scene: StoryScene,
    ) -> AnimationAIAssistProposalResponse:
        max_duration_ms = max(1000, int((scene.duration_seconds or 5) * 1000))

        proposed_tracks: List[AnimationProposedTrack] = []
        for raw_tr in raw_dict.get("proposed_tracks") or []:
            if isinstance(raw_tr, dict):
                tid = str(raw_tr.get("target_id") or payload.object_id or "target")
                prop = str(raw_tr.get("property") or "x")
                kfs: List[Dict[str, Any]] = []
                for k in raw_tr.get("keyframes") or []:
                    if isinstance(k, dict):
                        t_ms = min(max_duration_ms, max(0, int(k.get("time_ms") or 0)))
                        val = float(k.get("value") or 0.0)
                        interp = str(k.get("interpolation") or "linear")
                        kfs.append({
                            "id": str(uuid.uuid4()),
                            "time_ms": t_ms,
                            "value": val,
                            "interpolation": interp,
                        })
                kfs.sort(key=lambda x: x["time_ms"])
                proposed_tracks.append(AnimationProposedTrack(
                    id=f"ai_trk_{uuid.uuid4().hex[:8]}",
                    target_id=tid,
                    property=prop,
                    enabled=True,
                    metadata={"ai_generated": True},
                    keyframes=kfs,
                ))

        proposed_cam_tracks: List[AnimationProposedTrack] = []
        for raw_tr in raw_dict.get("proposed_camera_tracks") or []:
            if isinstance(raw_tr, dict):
                prop = str(raw_tr.get("property") or "camera_zoom")
                kfs = []
                for k in raw_tr.get("keyframes") or []:
                    if isinstance(k, dict):
                        t_ms = min(max_duration_ms, max(0, int(k.get("time_ms") or 0)))
                        val = float(k.get("value") or 1.0)
                        interp = str(k.get("interpolation") or "ease-in-out")
                        kfs.append({
                            "id": str(uuid.uuid4()),
                            "time_ms": t_ms,
                            "value": val,
                            "interpolation": interp,
                        })
                kfs.sort(key=lambda x: x["time_ms"])
                proposed_cam_tracks.append(AnimationProposedTrack(
                    id=f"ai_cam_{uuid.uuid4().hex[:8]}",
                    target_id="camera",
                    property=prop,
                    enabled=True,
                    metadata={"ai_generated": True},
                    keyframes=kfs,
                ))

        summary = str(
            raw_dict.get("summary_of_suggestions")
            or f"AI proposed {len(proposed_tracks)} object tracks and {len(proposed_cam_tracks)} camera tracks."
        )

        return AnimationAIAssistProposalResponse(
            schema_version="1.0",
            job=AnimationGenerationJobResponse.model_validate(job),
            action=payload.action,
            summary_of_suggestions=summary,
            applied=False,
            scene_id=scene.id,
            target_object_id=payload.object_id,
            suggested_preset_id=raw_dict.get("suggested_preset_id"),
            proposed_tracks=proposed_tracks,
            proposed_camera_tracks=proposed_cam_tracks,
            explanation=raw_dict.get("explanation"),
        )

    def apply_ai_animation_proposal(
        self,
        current_user: User,
        project_id: uuid.UUID,
        payload: AnimationAIApplyProposalRequest,
    ) -> SceneAnimationResponse:
        scene, _, _ = self._get_owned_scene(payload.scene_id, current_user)
        anim_res = self.get_or_create_scene_animation(current_user, scene.id)
        anim = self.anim_repo.get_animation_by_id(anim_res.id)
        assert anim is not None

        doc = dict(anim.document)
        existing_tracks = list(doc.get("tracks") or [])

        all_to_apply = payload.accepted_tracks + payload.accepted_camera_tracks
        for tr in all_to_apply:
            tr_dict = tr.model_dump()
            target = tr_dict["target_id"]
            prop = tr_dict["property"]

            matched = next(
                (x for x in existing_tracks if x.get("target_id") == target and x.get("property") == prop),
                None,
            )
            if matched:
                if payload.overwrite_existing:
                    matched["keyframes"] = tr_dict["keyframes"]
                else:
                    # Append non-colliding
                    existing_times = {k["time_ms"] for k in matched.get("keyframes", [])}
                    new_non_colliding = [k for k in tr_dict["keyframes"] if k["time_ms"] not in existing_times]
                    matched["keyframes"] = sorted(
                        matched.get("keyframes", []) + new_non_colliding,
                        key=lambda x: x["time_ms"],
                    )
            else:
                existing_tracks.append(tr_dict)

        doc["tracks"] = existing_tracks
        anim.version_number += 1
        anim.document = doc
        anim = self.anim_repo.save_animation(anim)
        return SceneAnimationResponse.model_validate(anim)

    def list_animation_jobs(
        self, current_user: User, project_id: uuid.UUID
    ) -> List[AnimationGenerationJobResponse]:
        self._get_owned_project(project_id, current_user)
        jobs = self.anim_repo.list_jobs_by_project(project_id)
        return [AnimationGenerationJobResponse.model_validate(j) for j in jobs]

    def get_animation_job(
        self, current_user: User, job_id: uuid.UUID
    ) -> AnimationGenerationJobResponse:
        job = self.anim_repo.get_job_by_id(job_id)
        if not job:
            raise NotFoundException(f"Job with ID '{job_id}' was not found.")
        if job.owner_id != current_user.id:
            raise ForbiddenException("You do not have permission to view this job.")
        return AnimationGenerationJobResponse.model_validate(job)
