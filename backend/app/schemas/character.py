"""
Pydantic v2 Schemas for TR STUDIO Step 3 — Professional AI Character Creation Studio.
Covers:
- Character creation, editing, variation, and Story integration
- Appearance attributes & Character Consistency Bible
- Visual styles & AI Image Provider capability status
- Prompt preview & AI generation requests (concept, portrait, full_body, sheet, expression, pose, outfit)
- CharacterAsset, CharacterExpression, CharacterPose, CharacterOutfit, and CharacterGenerationJob responses
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


CHARACTER_ROLES = [
    "Main character",
    "Supporting character",
    "Antagonist",
    "Background character",
]

CHARACTER_VISUAL_STYLES = [
    "2D Cartoon",
    "Anime",
    "Chibi",
    "3D Cartoon",
    "Realistic 3D",
    "Pixel Art",
    "Comic / Manga",
    "Storybook",
    "Watercolor",
    "Clay Animation",
    "Fantasy Illustration",
    "Custom",
]

DEFAULT_EXPRESSION_CATEGORIES = [
    "Neutral",
    "Happy",
    "Sad",
    "Angry",
    "Surprised",
    "Fearful",
    "Excited",
    "Confused",
    "Laughing",
    "Crying",
    "Embarrassed",
    "Determined",
]

DEFAULT_POSE_CATEGORIES = [
    "Standing",
    "Walking",
    "Running",
    "Sitting",
    "Jumping",
    "Dancing",
    "Fighting",
    "Waving",
    "Pointing",
    "Sleeping",
    "Custom",
]

DEFAULT_OUTFIT_PRESETS = [
    "Casual clothing",
    "School uniform",
    "Formal clothing",
    "Traditional clothing",
    "Fantasy costume",
    "Battle costume",
    "Winter clothing",
    "Custom clothing",
]

SUPPORTED_SHEET_VIEWS = [
    "front_view",
    "side_view",
    "back_view",
    "three_quarter_view",
    "full_body_view",
    "portrait",
    "expression_sheet",
    "outfit_sheet",
    "pose_sheet",
]


# ---------------------------------------------------------------------------
# 1. Appearance, Relationships & Character Bible Sub-Schemas
# ---------------------------------------------------------------------------


class CharacterAppearanceAttributes(BaseModel):
    face_shape: Optional[str] = Field(default="")
    eye_shape: Optional[str] = Field(default="")
    eye_color: Optional[str] = Field(default="")
    hair_style: Optional[str] = Field(default="")
    hair_color: Optional[str] = Field(default="")
    skin_tone: Optional[str] = Field(default="")
    body_type: Optional[str] = Field(default="")
    height: Optional[str] = Field(default="")
    clothing: Optional[str] = Field(default="")
    accessories: Optional[str] = Field(default="")
    shoes: Optional[str] = Field(default="")
    distinguishing_features: Optional[str] = Field(default="")
    color_palette: List[str] = Field(default_factory=list)
    custom_attributes: Dict[str, str] = Field(default_factory=dict)


class CharacterBibleData(BaseModel):
    canonical_description: Optional[str] = Field(default="")
    color_palette: List[str] = Field(default_factory=list)
    facial_features: Optional[str] = Field(default="")
    body_proportions: Optional[str] = Field(default="")
    clothing_details: Optional[str] = Field(default="")
    accessories_details: Optional[str] = Field(default="")
    style_description: Optional[str] = Field(default="")
    selected_reference_asset_ids: List[str] = Field(default_factory=list)
    identity_notes: Optional[str] = Field(default="")
    consistency_disclaimer: str = Field(
        default=(
            "Visual consistency across generated images uses the canonical Character Bible "
            "description and selected reference images when supported by the configured image provider."
        )
    )


class CharacterRelationshipEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_character_id: Optional[str] = None
    target_character_name: str = Field(..., min_length=1, max_length=150)
    relationship_type: str = Field(default="Ally", max_length=120)
    description: Optional[str] = Field(default="")


class CharacterExtendedMetadata(BaseModel):
    gender_presentation: Optional[str] = Field(default="")
    category: Optional[str] = Field(default="Original Character")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    special_abilities: List[str] = Field(default_factory=list)
    relationships: List[CharacterRelationshipEntry] = Field(default_factory=list)
    appearance: CharacterAppearanceAttributes = Field(
        default_factory=CharacterAppearanceAttributes
    )
    character_bible: CharacterBibleData = Field(default_factory=CharacterBibleData)
    custom_style_description: Optional[str] = Field(default="")
    story_character_id: Optional[str] = None
    parent_character_id: Optional[str] = None


# ---------------------------------------------------------------------------
# 2. Asset, Expression, Pose, Outfit & Job Schemas
# ---------------------------------------------------------------------------


class CharacterAssetResponse(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    owner_id: uuid.UUID
    asset_type: str
    file_reference: str
    url: str
    download_url: str
    prompt: Optional[str] = None
    provider: Optional[str] = None
    generation_status: str
    is_canonical_reference: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class CharacterAssetUpdateRequest(BaseModel):
    asset_type: Optional[str] = Field(None, max_length=80)
    label: Optional[str] = Field(None, max_length=200)
    set_as_canonical_reference: Optional[bool] = None


class CharacterExpressionCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default="", max_length=2000)
    asset_id: Optional[uuid.UUID] = None


class CharacterExpressionUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    asset_id: Optional[uuid.UUID] = None
    generation_status: Optional[str] = Field(None, max_length=50)


class CharacterExpressionResponse(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    name: str
    description: Optional[str] = None
    generation_status: str
    asset_id: Optional[uuid.UUID] = None
    reference_image_url: Optional[str] = None
    created_at: datetime


class CharacterPoseCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    category: str = Field(default="Standing", max_length=100)
    description: Optional[str] = Field(default="", max_length=2000)
    asset_id: Optional[uuid.UUID] = None


class CharacterPoseUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    asset_id: Optional[uuid.UUID] = None
    generation_status: Optional[str] = Field(None, max_length=50)


class CharacterPoseResponse(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    name: str
    category: str
    description: Optional[str] = None
    generation_status: str
    asset_id: Optional[uuid.UUID] = None
    reference_image_url: Optional[str] = None
    created_at: datetime


class CharacterOutfitCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = Field(default="", max_length=2000)
    color_palette: List[str] = Field(default_factory=list)
    accessories: List[str] = Field(default_factory=list)
    asset_id: Optional[uuid.UUID] = None
    is_default: bool = Field(default=False)


class CharacterOutfitUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    color_palette: Optional[List[str]] = None
    accessories: Optional[List[str]] = None
    asset_id: Optional[uuid.UUID] = None
    is_default: Optional[bool] = None
    generation_status: Optional[str] = Field(None, max_length=50)


class CharacterOutfitResponse(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    name: str
    description: Optional[str] = None
    color_palette: List[str] = Field(default_factory=list)
    accessories: List[str] = Field(default_factory=list)
    generation_status: str
    asset_id: Optional[uuid.UUID] = None
    reference_image_url: Optional[str] = None
    is_default: bool
    created_at: datetime


class CharacterGenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    character_id: uuid.UUID
    owner_id: uuid.UUID
    generation_type: str
    status: str
    provider: Optional[str] = None
    prompt: Optional[str] = None
    error_message: Optional[str] = None
    result_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 3. Character Creation, Update, Variation & Response Schemas
# ---------------------------------------------------------------------------


class CharacterCreateRequest(BaseModel):
    project_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Authorized project ID. If omitted, attaches to user's latest or newly created project.",
    )
    story_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=150)
    nickname: Optional[str] = Field(default=None, max_length=150)
    role: str = Field(default="Main character", max_length=100)
    species: str = Field(default="Human", max_length=100)
    age_description: Optional[str] = Field(default="Young adult", max_length=100)
    gender_presentation: Optional[str] = Field(default="", max_length=100)
    category: Optional[str] = Field(default="Protagonist", max_length=100)
    personality: List[str] = Field(default_factory=list)
    backstory: Optional[str] = Field(default="")
    motivation: Optional[str] = Field(default="")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    special_abilities: List[str] = Field(default_factory=list)
    relationships: List[CharacterRelationshipEntry] = Field(default_factory=list)
    appearance_description: Optional[str] = Field(default="")
    appearance: Optional[CharacterAppearanceAttributes] = None
    character_bible: Optional[CharacterBibleData] = None
    style: str = Field(default="Anime", max_length=100)
    custom_style_description: Optional[str] = Field(default="", max_length=500)
    story_character_id: Optional[str] = None
    seed_default_presets: bool = Field(
        default=True,
        description="When True, initializes starter expressions, poses, and default outfit slots.",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Character name cannot be empty.")
        return cleaned


class CharacterUpdateRequest(BaseModel):
    project_id: Optional[uuid.UUID] = None
    story_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    nickname: Optional[str] = Field(None, max_length=150)
    role: Optional[str] = Field(None, max_length=100)
    species: Optional[str] = Field(None, max_length=100)
    age_description: Optional[str] = Field(None, max_length=100)
    gender_presentation: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    personality: Optional[List[str]] = None
    backstory: Optional[str] = None
    motivation: Optional[str] = None
    strengths: Optional[List[str]] = None
    weaknesses: Optional[List[str]] = None
    special_abilities: Optional[List[str]] = None
    relationships: Optional[List[CharacterRelationshipEntry]] = None
    appearance_description: Optional[str] = None
    appearance: Optional[CharacterAppearanceAttributes] = None
    character_bible: Optional[CharacterBibleData] = None
    canonical_reference_asset_id: Optional[uuid.UUID] = None
    style: Optional[str] = Field(None, max_length=100)
    custom_style_description: Optional[str] = Field(None, max_length=500)


class CharacterVariationRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    style: Optional[str] = Field(None, max_length=100)
    variation_notes: Optional[str] = Field(default="", max_length=1000)


class CharacterStorySyncRequest(BaseModel):
    story_id: uuid.UUID
    scene_ids: List[str] = Field(
        default_factory=list,
        description="Optional list of scene UUIDs in the story to assign this character to.",
    )


class CharacterSummaryResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    story_id: Optional[uuid.UUID] = None
    name: str
    nickname: Optional[str] = None
    role: str
    species: str
    category: str
    age_description: Optional[str] = None
    personality: List[str] = Field(default_factory=list)
    appearance_description: Optional[str] = None
    style: str
    canonical_reference_asset_id: Optional[uuid.UUID] = None
    canonical_reference_url: Optional[str] = None
    asset_count: int = 0
    expression_count: int = 0
    pose_count: int = 0
    outfit_count: int = 0
    created_at: datetime
    updated_at: datetime


class CharacterResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    story_id: Optional[uuid.UUID] = None
    name: str
    nickname: Optional[str] = None
    role: str
    species: str
    age_description: Optional[str] = None
    personality: List[str] = Field(default_factory=list)
    backstory: Optional[str] = None
    motivation: Optional[str] = None
    appearance_description: Optional[str] = None
    canonical_reference_asset_id: Optional[uuid.UUID] = None
    canonical_reference_url: Optional[str] = None
    style: str
    metadata: CharacterExtendedMetadata
    assets: List[CharacterAssetResponse] = Field(default_factory=list)
    expressions: List[CharacterExpressionResponse] = Field(default_factory=list)
    poses: List[CharacterPoseResponse] = Field(default_factory=list)
    outfits: List[CharacterOutfitResponse] = Field(default_factory=list)
    generation_jobs: List[CharacterGenerationJobResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 4. Prompt Builder & AI Image Generation Request/Response Schemas
# ---------------------------------------------------------------------------


class CharacterPromptPreviewRequest(BaseModel):
    generation_type: Literal[
        "concept",
        "portrait",
        "full_body",
        "turnaround_sheet",
        "expression",
        "pose",
        "outfit",
    ] = "concept"
    style_override: Optional[str] = None
    camera_framing: Optional[str] = Field(default="full_body")
    background: Optional[str] = Field(default="clean neutral studio character sheet background")
    expression_name: Optional[str] = None
    pose_name: Optional[str] = None
    outfit_name: Optional[str] = None
    outfit_description: Optional[str] = None
    sheet_views: List[str] = Field(default_factory=list)
    user_instructions: Optional[str] = Field(default="", max_length=1500)


class CharacterPromptPreviewResponse(BaseModel):
    character_id: uuid.UUID
    generation_type: str
    style: str
    prompt: str
    used_canonical_bible: bool
    reference_asset_ids: List[str] = Field(default_factory=list)
    consistency_note: str


class CharacterGenerateImageRequest(BaseModel):
    generation_type: Literal["concept", "portrait", "full_body"] = "concept"
    custom_prompt: Optional[str] = Field(
        default=None,
        max_length=4000,
        description="Optional user-edited prompt. If omitted, CharacterPromptBuilder constructs it.",
    )
    style_override: Optional[str] = Field(default=None, max_length=100)
    camera_framing: Optional[str] = Field(default="medium portrait")
    background: Optional[str] = Field(default="clean studio neutral background")
    reference_asset_ids: List[str] = Field(default_factory=list)
    user_instructions: Optional[str] = Field(default="", max_length=1500)
    set_as_canonical_reference: bool = Field(default=False)


class CharacterGenerateSheetRequest(BaseModel):
    views: List[
        Literal[
            "front_view",
            "side_view",
            "back_view",
            "three_quarter_view",
            "full_body_view",
            "portrait",
            "expression_sheet",
            "outfit_sheet",
            "pose_sheet",
        ]
    ] = Field(
        default_factory=lambda: ["front_view", "side_view", "back_view", "three_quarter_view"],
        min_length=1,
    )
    sheet_mode: Literal["separate_views", "combined_sheet"] = Field(
        default="separate_views",
        description="Generate separate images per view or a combined turnaround sheet.",
    )
    custom_prompt: Optional[str] = Field(default=None, max_length=4000)
    style_override: Optional[str] = None
    user_instructions: Optional[str] = Field(default="", max_length=1500)


class CharacterGenerateExpressionRequest(BaseModel):
    expression_id: Optional[uuid.UUID] = None
    expression_name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default="", max_length=1500)
    custom_prompt: Optional[str] = Field(default=None, max_length=4000)
    user_instructions: Optional[str] = Field(default="", max_length=1000)


class CharacterGeneratePoseRequest(BaseModel):
    pose_id: Optional[uuid.UUID] = None
    pose_name: str = Field(..., min_length=1, max_length=120)
    category: str = Field(default="Standing", max_length=100)
    description: Optional[str] = Field(default="", max_length=1500)
    custom_prompt: Optional[str] = Field(default=None, max_length=4000)
    user_instructions: Optional[str] = Field(default="", max_length=1000)


class CharacterGenerateOutfitRequest(BaseModel):
    outfit_id: Optional[uuid.UUID] = None
    outfit_name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = Field(default="", max_length=1500)
    color_palette: List[str] = Field(default_factory=list)
    accessories: List[str] = Field(default_factory=list)
    is_default: bool = Field(default=False)
    custom_prompt: Optional[str] = Field(default=None, max_length=4000)
    user_instructions: Optional[str] = Field(default="", max_length=1000)


class CharacterGenerationResultResponse(BaseModel):
    job: CharacterGenerationJobResponse
    generated_assets: List[CharacterAssetResponse]
    views_requested: List[str] = Field(default_factory=list)
    views_generated: List[str] = Field(default_factory=list)
    complete: bool = True
    consistency_note: str
    character: CharacterResponse


class ImageProviderStatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str
    supported_styles: List[str]
    unsupported_styles: List[str]
    supports_reference_images: bool
    supports_combined_sheet: bool
    supports_separate_views: bool
    consistency_disclaimer: str
    message: str
