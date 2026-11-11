"""
Pydantic Schemas for TR STUDIO Step 6 — Professional 2D Animation Engine.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field


class AnimationPresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    category: str
    description: str
    default_duration_ms: int
    params: List[str]
    default_distance: Optional[float] = None
    default_amount: Optional[float] = None


class SceneAnimationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    story_id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    schema_version: str
    version_number: int
    fps: int
    duration_ms: int
    width: int
    height: int
    document: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class SceneAnimationSaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document: Dict[str, Any] = Field(..., description="Full AnimationDocument JSON")
    expected_version_number: Optional[int] = Field(
        None,
        description="Optional expected version number for optimistic concurrency conflict prevention",
    )


class AnimationApplyPresetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preset_id: str = Field(..., min_length=1, max_length=100)
    target_id: str = Field(..., min_length=1, max_length=100)
    start_ms: int = Field(0, ge=0)
    duration_ms: int = Field(..., ge=50, le=600_000)
    distance: Optional[float] = None
    amount: Optional[float] = None


AnimationAIActionLiteral = Literal[
    "suggest_character_movement",
    "suggest_animation_sequence",
    "suggest_camera_movement",
    "convert_action_to_keyframes",
]


class AnimationAIAssistRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: AnimationAIActionLiteral
    scene_id: uuid.UUID
    object_id: Optional[str] = None
    target_tone: Optional[str] = None
    instructions: Optional[str] = None
    apply_immediately: bool = False


class AnimationProposedTrack(BaseModel):
    id: str
    target_id: str
    property: str
    enabled: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)
    keyframes: List[Dict[str, Any]] = Field(default_factory=list)


class AnimationGenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    story_id: uuid.UUID
    scene_id: Optional[uuid.UUID]
    owner_id: uuid.UUID
    job_type: str
    status: str
    provider: Optional[str]
    model_name: Optional[str]
    prompt_summary: Optional[str]
    error_message: Optional[str]
    result_metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AnimationAIAssistProposalResponse(BaseModel):
    schema_version: str = "1.0"
    job: AnimationGenerationJobResponse
    action: AnimationAIActionLiteral
    summary_of_suggestions: str
    applied: bool = False
    scene_id: uuid.UUID
    target_object_id: Optional[str] = None
    suggested_preset_id: Optional[str] = None
    proposed_tracks: List[AnimationProposedTrack] = Field(default_factory=list)
    proposed_camera_tracks: List[AnimationProposedTrack] = Field(default_factory=list)
    explanation: Optional[str] = None


class AnimationAIApplyProposalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: AnimationAIActionLiteral
    scene_id: uuid.UUID
    accepted_tracks: List[AnimationProposedTrack] = Field(default_factory=list)
    accepted_camera_tracks: List[AnimationProposedTrack] = Field(default_factory=list)
    overwrite_existing: bool = False
