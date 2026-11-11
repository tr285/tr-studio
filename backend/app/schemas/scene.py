"""
Pydantic v2 Schemas for TR STUDIO Step 5 — Professional Scene Builder & Storyboard Studio.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.story import DialogueEntryData, NarrationEntryData


# ---------------------------------------------------------------------------
# 1. Shot List Schemas (SceneShot)
# ---------------------------------------------------------------------------

ShotTypeLiteral = Literal[
    "establishing",
    "wide",
    "medium",
    "close-up",
    "extreme close-up",
    "over-the-shoulder",
    "point-of-view",
    "custom",
]


class SceneShotCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=2500)
    shot_type: str = Field(default="wide", max_length=100)
    camera_perspective: str = Field(
        default="Wide establishing shot", max_length=120
    )
    character_focus: List[str] = Field(default_factory=list)
    environment_id: Optional[uuid.UUID] = None
    visual_direction: Optional[str] = Field(default="", max_length=2000)
    duration_seconds: int = Field(default=5, ge=1, le=600)
    production_notes: Optional[str] = Field(default="", max_length=2000)


class SceneShotUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shot_number: Optional[int] = Field(default=None, ge=1)
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2500)
    shot_type: Optional[str] = Field(default=None, max_length=100)
    camera_perspective: Optional[str] = Field(default=None, max_length=120)
    character_focus: Optional[List[str]] = None
    environment_id: Optional[uuid.UUID] = None
    clear_environment: bool = False
    visual_direction: Optional[str] = Field(default=None, max_length=2000)
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=600)
    production_notes: Optional[str] = Field(default=None, max_length=2000)


class SceneShotReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shot_ids: List[uuid.UUID] = Field(..., min_length=1)


class SceneShotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    story_id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    shot_number: int
    title: str
    description: Optional[str] = None
    shot_type: str
    camera_perspective: str
    character_focus: List[str] = Field(default_factory=list)
    environment_id: Optional[uuid.UUID] = None
    environment_name: Optional[str] = None
    environment_image_url: Optional[str] = None
    visual_direction: Optional[str] = None
    duration_seconds: int
    production_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 2. Scene Character Assignment Schemas (SceneCharacterAssignment)
# ---------------------------------------------------------------------------


class SceneCharacterAssignmentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    character_id: Optional[uuid.UUID] = None
    story_character_id: Optional[uuid.UUID] = None
    character_name: Optional[str] = Field(default=None, max_length=160)
    role_in_scene: str = Field(default="Lead", max_length=100)
    expression_id: Optional[uuid.UUID] = None
    pose_id: Optional[uuid.UUID] = None
    outfit_id: Optional[uuid.UUID] = None
    asset_id: Optional[uuid.UUID] = None
    layer_order: Optional[int] = Field(default=None, ge=1, le=100)
    position_x: int = Field(default=50, ge=0, le=100)
    position_y: int = Field(default=75, ge=0, le=100)
    scale_percent: int = Field(default=100, ge=20, le=300)
    notes: Optional[str] = Field(default="", max_length=1000)


class SceneCharacterAssignmentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    character_id: Optional[uuid.UUID] = None
    character_name: Optional[str] = Field(default=None, max_length=160)
    role_in_scene: Optional[str] = Field(default=None, max_length=100)
    expression_id: Optional[uuid.UUID] = None
    clear_expression: bool = False
    pose_id: Optional[uuid.UUID] = None
    clear_pose: bool = False
    outfit_id: Optional[uuid.UUID] = None
    clear_outfit: bool = False
    asset_id: Optional[uuid.UUID] = None
    clear_asset: bool = False
    layer_order: Optional[int] = Field(default=None, ge=1, le=100)
    position_x: Optional[int] = Field(default=None, ge=0, le=100)
    position_y: Optional[int] = Field(default=None, ge=0, le=100)
    scale_percent: Optional[int] = Field(default=None, ge=20, le=300)
    notes: Optional[str] = Field(default=None, max_length=1000)


class SceneCharacterAssignmentReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignment_ids: List[uuid.UUID] = Field(..., min_length=1)


class SceneCharacterAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    story_id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    character_id: Optional[uuid.UUID] = None
    story_character_id: Optional[uuid.UUID] = None
    character_name: str
    role_in_scene: str
    expression_id: Optional[uuid.UUID] = None
    expression_name: Optional[str] = None
    pose_id: Optional[uuid.UUID] = None
    pose_name: Optional[str] = None
    outfit_id: Optional[uuid.UUID] = None
    outfit_name: Optional[str] = None
    asset_id: Optional[uuid.UUID] = None
    image_url: Optional[str] = None
    reference_status: Literal["ok", "no_visual_asset", "missing_reference"] = "ok"
    layer_order: int
    position_x: int
    position_y: int
    scale_percent: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 3. Scene Asset Assignment Schemas (SceneAssetAssignment)
# ---------------------------------------------------------------------------


class SceneAssetAssignmentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layer_type: Literal[
        "background", "foreground", "prop", "overlay", "lighting_ref"
    ] = "background"
    label: str = Field(..., min_length=1, max_length=200)
    environment_asset_id: Optional[uuid.UUID] = None
    character_asset_id: Optional[uuid.UUID] = None
    layer_order: Optional[int] = Field(default=None, ge=1, le=100)
    position_x: int = Field(default=50, ge=0, le=100)
    position_y: int = Field(default=50, ge=0, le=100)
    scale_percent: int = Field(default=100, ge=10, le=300)
    notes: Optional[str] = Field(default="", max_length=1000)


class SceneAssetAssignmentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layer_type: Optional[
        Literal["background", "foreground", "prop", "overlay", "lighting_ref"]
    ] = None
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    environment_asset_id: Optional[uuid.UUID] = None
    character_asset_id: Optional[uuid.UUID] = None
    layer_order: Optional[int] = Field(default=None, ge=1, le=100)
    position_x: Optional[int] = Field(default=None, ge=0, le=100)
    position_y: Optional[int] = Field(default=None, ge=0, le=100)
    scale_percent: Optional[int] = Field(default=None, ge=10, le=300)
    notes: Optional[str] = Field(default=None, max_length=1000)


class SceneAssetAssignmentReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignment_ids: List[uuid.UUID] = Field(..., min_length=1)


class SceneAssetAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    story_id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    layer_type: str
    label: str
    environment_asset_id: Optional[uuid.UUID] = None
    character_asset_id: Optional[uuid.UUID] = None
    image_url: Optional[str] = None
    reference_status: Literal["ok", "missing_reference"] = "ok"
    layer_order: int
    position_x: int
    position_y: int
    scale_percent: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 4. Scene Environment Assignment & Full Scene Builder CRUD Schemas
# ---------------------------------------------------------------------------


class SceneEnvironmentAssignmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    environment_id: Optional[uuid.UUID] = None
    clear_environment: bool = False
    world_location_id: Optional[uuid.UUID] = None
    clear_world_location: bool = False
    variation_id: Optional[uuid.UUID] = None
    background_asset_id: Optional[uuid.UUID] = None


class SceneBuilderCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    scene_type: str = Field(default="Narrative", max_length=100)
    scene_heading: Optional[str] = Field(
        default="EXT. LOCATION - DAY", max_length=255
    )
    summary: Optional[str] = Field(default="", max_length=2000)
    description: Optional[str] = Field(default="", max_length=5000)
    action_description: Optional[str] = Field(default="", max_length=5000)
    location_id: Optional[str] = None
    location_name: Optional[str] = Field(default="", max_length=200)
    environment_id: Optional[uuid.UUID] = None
    world_location_id: Optional[uuid.UUID] = None
    time_of_day: str = Field(default="Day", max_length=80)
    weather: str = Field(default="Clear", max_length=80)
    mood: str = Field(default="Cinematic", max_length=120)
    duration_seconds: int = Field(default=30, ge=5, le=1800)
    camera_framing: str = Field(
        default="Wide establishing shot", max_length=120
    )
    transition_type: str = Field(default="Cut", max_length=80)
    production_notes: Optional[str] = Field(default="", max_length=3000)
    storyboard_notes: Optional[str] = Field(default="", max_length=3000)
    characters: List[str] = Field(default_factory=list)
    character_ids: List[uuid.UUID] = Field(default_factory=list)
    dialogue: List[DialogueEntryData] = Field(default_factory=list)
    narration: List[NarrationEntryData] = Field(default_factory=list)
    camera_directions: List[str] = Field(default_factory=list)
    audio_directions: List[str] = Field(default_factory=list)
    visual_directions: List[str] = Field(default_factory=list)
    emotional_directions: List[str] = Field(default_factory=list)
    seed_default_shots: bool = False


class SceneBuilderUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scene_number: Optional[int] = Field(default=None, ge=1)
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    scene_type: Optional[str] = Field(default=None, max_length=100)
    scene_heading: Optional[str] = Field(default=None, max_length=255)
    summary: Optional[str] = Field(default=None, max_length=2000)
    description: Optional[str] = Field(default=None, max_length=5000)
    action_description: Optional[str] = Field(default=None, max_length=5000)
    location_id: Optional[str] = None
    location_name: Optional[str] = Field(default=None, max_length=200)
    environment_id: Optional[uuid.UUID] = None
    clear_environment: bool = False
    world_location_id: Optional[uuid.UUID] = None
    clear_world_location: bool = False
    time_of_day: Optional[str] = Field(default=None, max_length=80)
    weather: Optional[str] = Field(default=None, max_length=80)
    mood: Optional[str] = Field(default=None, max_length=120)
    duration_seconds: Optional[int] = Field(default=None, ge=5, le=1800)
    camera_framing: Optional[str] = Field(default=None, max_length=120)
    transition_type: Optional[str] = Field(default=None, max_length=80)
    production_notes: Optional[str] = Field(default=None, max_length=3000)
    storyboard_notes: Optional[str] = Field(default=None, max_length=3000)
    characters: Optional[List[str]] = None
    dialogue: Optional[List[DialogueEntryData]] = None
    narration: Optional[List[NarrationEntryData]] = None
    camera_directions: Optional[List[str]] = None
    audio_directions: Optional[List[str]] = None
    visual_directions: Optional[List[str]] = None
    emotional_directions: Optional[List[str]] = None


class SceneEnvironmentPreview(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    art_style: str
    time_of_day: str
    weather: str
    camera_perspective: str
    image_url: Optional[str] = None
    color_palette: List[str] = Field(default_factory=list)


class SceneWorldLocationPreview(BaseModel):
    id: uuid.UUID
    world_id: uuid.UUID
    world_name: Optional[str] = None
    name: str
    location_type: str
    description: Optional[str] = None


class SceneDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    story_id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    scene_number: int
    title: str
    scene_type: str
    scene_heading: str
    summary: str
    description: str
    action_description: str
    location_id: Optional[str] = None
    location_name: str
    environment_id: Optional[uuid.UUID] = None
    environment: Optional[SceneEnvironmentPreview] = None
    world_location_id: Optional[uuid.UUID] = None
    world_location: Optional[SceneWorldLocationPreview] = None
    time_of_day: str
    weather: str
    mood: str
    duration_seconds: int
    camera_framing: str
    transition_type: str
    production_notes: str
    storyboard_notes: str
    thumbnail_url: Optional[str] = None
    characters: List[str] = Field(default_factory=list)
    dialogue: List[DialogueEntryData] = Field(default_factory=list)
    narration: List[NarrationEntryData] = Field(default_factory=list)
    camera_directions: List[str] = Field(default_factory=list)
    audio_directions: List[str] = Field(default_factory=list)
    visual_directions: List[str] = Field(default_factory=list)
    emotional_directions: List[str] = Field(default_factory=list)
    character_assignments: List[SceneCharacterAssignmentResponse] = Field(
        default_factory=list
    )
    asset_assignments: List[SceneAssetAssignmentResponse] = Field(
        default_factory=list
    )
    shots: List[SceneShotResponse] = Field(default_factory=list)
    missing_references: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 5. Storyboard Studio & Shot List Overview Schemas
# ---------------------------------------------------------------------------


class StoryboardCardResponse(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    project_id: uuid.UUID
    scene_number: int
    title: str
    scene_type: str
    scene_heading: str
    summary: str
    description: str
    duration_seconds: int
    time_of_day: str
    weather: str
    mood: str
    camera_framing: str
    transition_type: str
    location_name: str
    environment_id: Optional[uuid.UUID] = None
    environment_name: Optional[str] = None
    world_location_id: Optional[uuid.UUID] = None
    world_location_name: Optional[str] = None
    thumbnail_url: Optional[str] = None
    has_actual_asset: bool = False
    main_characters: List[str] = Field(default_factory=list)
    character_assignments: List[SceneCharacterAssignmentResponse] = Field(
        default_factory=list
    )
    shot_count: int = 0
    dialogue_count: int = 0
    narration_count: int = 0
    missing_references: List[str] = Field(default_factory=list)
    updated_at: datetime


class StoryboardOverviewResponse(BaseModel):
    project_id: uuid.UUID
    story_id: uuid.UUID
    story_title: str
    total_scenes: int
    total_shots: int
    total_duration_seconds: int
    cards: List[StoryboardCardResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 6. AI-Assisted Scene & Shot-List Generation Schemas
# ---------------------------------------------------------------------------

SceneAIGenerationAction = Literal[
    "convert_story_to_scenes",
    "suggest_scene_details",
    "suggest_environments",
    "suggest_characters",
    "generate_shot_list",
    "suggest_visual_direction",
    "rewrite_scene_tone",
]


class SceneAIGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: SceneAIGenerationAction = "suggest_scene_details"
    scene_id: Optional[uuid.UUID] = None
    story_section_text: Optional[str] = Field(default=None, max_length=8000)
    target_tone: Optional[str] = Field(default=None, max_length=120)
    desired_count: int = Field(default=4, ge=1, le=12)
    instructions: Optional[str] = Field(default=None, max_length=2000)
    apply_immediately: bool = Field(
        default=False,
        description="Defaults to False so generated suggestions are shown in a review interface before saving.",
    )


class ProposedShotItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shot_number: int = Field(default=1, ge=1)
    title: str
    description: str = ""
    shot_type: str = "wide"
    camera_perspective: str = "Wide establishing shot"
    character_focus: List[str] = Field(default_factory=list)
    visual_direction: str = ""
    duration_seconds: int = Field(default=5, ge=1, le=600)
    production_notes: str = ""


class ProposedSceneItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scene_number: int = Field(default=1, ge=1)
    title: str
    scene_type: str = "Narrative"
    scene_heading: str = "EXT. LOCATION - DAY"
    summary: str = ""
    description: str = ""
    action_description: str = ""
    location_name: str = ""
    suggested_environment_name: str = ""
    suggested_characters: List[str] = Field(default_factory=list)
    time_of_day: str = "Day"
    weather: str = "Clear"
    mood: str = "Cinematic"
    duration_seconds: int = Field(default=30, ge=5, le=1800)
    camera_framing: str = "Wide establishing shot"
    transition_type: str = "Cut"
    visual_directions: List[str] = Field(default_factory=list)
    camera_directions: List[str] = Field(default_factory=list)
    audio_directions: List[str] = Field(default_factory=list)
    production_notes: str = ""
    shots: List[ProposedShotItem] = Field(default_factory=list)


class SceneGenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    story_id: uuid.UUID
    scene_id: Optional[uuid.UUID] = None
    owner_id: uuid.UUID
    job_type: str
    status: str
    provider: Optional[str] = None
    model_name: Optional[str] = None
    prompt_summary: Optional[str] = None
    error_message: Optional[str] = None
    result_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class SceneAIGenerationProposalResponse(BaseModel):
    schema_version: str = "1.0"
    job: SceneGenerationJobResponse
    action: SceneAIGenerationAction
    summary_of_suggestions: str
    applied: bool = False
    scene_id: Optional[uuid.UUID] = None
    proposed_scenes: List[ProposedSceneItem] = Field(default_factory=list)
    proposed_shots: List[ProposedShotItem] = Field(default_factory=list)
    suggested_environments: List[str] = Field(default_factory=list)
    suggested_characters: List[str] = Field(default_factory=list)
    suggested_visual_directions: List[str] = Field(default_factory=list)
    suggested_transition: Optional[str] = None
    rewritten_description: Optional[str] = None


class SceneAIApplyProposalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: SceneAIGenerationAction
    scene_id: Optional[uuid.UUID] = None
    accepted_scenes: List[ProposedSceneItem] = Field(default_factory=list)
    accepted_shots: List[ProposedShotItem] = Field(default_factory=list)
    replace_existing_shots: bool = False
    accepted_title: Optional[str] = None
    accepted_summary: Optional[str] = None
    accepted_description: Optional[str] = None
    accepted_visual_directions: Optional[List[str]] = None
    accepted_transition_type: Optional[str] = None
    accepted_environment_name: Optional[str] = None
    accepted_characters: Optional[List[str]] = None


class SceneStorySyncResponse(BaseModel):
    project_id: uuid.UUID
    story_id: uuid.UUID
    scenes_synced: int
    characters_matched: int
    environments_matched: int
    missing_references_detected: List[str] = Field(default_factory=list)
    scenes: List[SceneDetailResponse] = Field(default_factory=list)
