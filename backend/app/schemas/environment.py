"""
Pydantic v2 Schemas for TR STUDIO Step 4 — World & Environment Creation Studio.
Covers:
- Environment creation, editing, listing, and detailed retrieval
- Visual details (architecture, terrain, vegetation, props, lighting, atmosphere, tags)
- Time of day, weather, camera perspective, and art style configuration
- Environment prompt preview and AI generation requests/results
- Environment variations (time, weather, lighting, season, camera, palette, custom)
- Environment assets and generation job audit history
- World & WorldLocation hierarchical organization (World -> Region -> Location -> Building -> Room / Natural Area)
- Story, Scene, and Character planning integration
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field

ENVIRONMENT_CATEGORIES = [
    "Natural",
    "Human / Urban",
    "Fantasy",
    "Science Fiction",
    "Custom",
]

ENVIRONMENT_LOCATION_PRESETS: Dict[str, List[str]] = {
    "Natural": [
        "Forests",
        "Mountains",
        "Rivers",
        "Waterfalls",
        "Beaches",
        "Deserts",
        "Islands",
        "Lakes",
        "Jungles",
        "Snow landscapes",
    ],
    "Human / Urban": [
        "Villages",
        "Cities",
        "Streets",
        "Houses",
        "Apartments",
        "Schools",
        "Colleges",
        "Hospitals",
        "Offices",
        "Restaurants",
        "Shops",
        "Parks",
        "Railway stations",
        "Airports",
    ],
    "Fantasy": [
        "Magical kingdoms",
        "Castles",
        "Ancient temples",
        "Dragon caves",
        "Floating islands",
        "Magical forests",
        "Underwater kingdoms",
        "Fantasy villages",
    ],
    "Science Fiction": [
        "Space stations",
        "Alien planets",
        "Futuristic cities",
        "Laboratories",
        "Cyberpunk streets",
        "Spaceships",
        "Robot factories",
    ],
}

ENVIRONMENT_TIME_SETTINGS = [
    "Sunrise",
    "Morning",
    "Afternoon",
    "Evening",
    "Sunset",
    "Night",
    "Custom",
]

ENVIRONMENT_WEATHER_SETTINGS = [
    "Clear",
    "Cloudy",
    "Rainy",
    "Stormy",
    "Snowy",
    "Foggy",
    "Windy",
    "Custom",
]

ENVIRONMENT_CAMERA_PERSPECTIVES = [
    "Wide establishing shot",
    "Medium shot",
    "Close-up environment detail",
    "Bird's-eye view",
    "Ground-level view",
    "Isometric view",
    "Custom",
]

WORLD_LOCATION_TYPES = [
    "world",
    "region",
    "location",
    "building",
    "room",
    "natural_area",
]


class EnvironmentVisualDetails(BaseModel):
    model_config = ConfigDict(extra="ignore")

    location_type: Optional[str] = Field(default="Forests", max_length=160)
    architecture: Optional[str] = Field(default=None, max_length=1000)
    terrain: Optional[str] = Field(default=None, max_length=1000)
    vegetation: Optional[str] = Field(default=None, max_length=1000)
    props: Optional[str] = Field(default=None, max_length=1000)
    lighting: Optional[str] = Field(default=None, max_length=600)
    atmosphere: Optional[str] = Field(default=None, max_length=600)
    custom_time_of_day: Optional[str] = Field(default=None, max_length=200)
    custom_weather: Optional[str] = Field(default=None, max_length=200)
    custom_camera_perspective: Optional[str] = Field(default=None, max_length=200)
    custom_art_style: Optional[str] = Field(default=None, max_length=300)
    additional_instructions: Optional[str] = Field(default=None, max_length=2000)
    tags: List[str] = Field(default_factory=list)
    scene_ids: List[str] = Field(default_factory=list)
    character_ids: List[str] = Field(default_factory=list)
    story_location_id: Optional[str] = None
    world_id: Optional[str] = None
    world_location_id: Optional[str] = None


class EnvironmentAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    environment_id: uuid.UUID
    owner_id: uuid.UUID
    asset_type: str
    file_reference: str
    url: str
    download_url: str
    prompt: Optional[str] = None
    provider: Optional[str] = None
    generation_status: str
    is_default: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class EnvironmentAssetUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_type: Optional[str] = Field(default=None, max_length=80)
    label: Optional[str] = Field(default=None, max_length=200)
    set_as_default: Optional[bool] = None


class EnvironmentVariationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1000)
    variation_type: str = Field(default="time_of_day", max_length=80)
    asset_id: Optional[uuid.UUID] = None
    is_default: bool = False


class EnvironmentVariationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1000)
    variation_type: Optional[str] = Field(default=None, max_length=80)
    asset_id: Optional[uuid.UUID] = None
    is_default: Optional[bool] = None


class EnvironmentVariationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    environment_id: uuid.UUID
    name: str
    description: Optional[str] = None
    variation_type: str
    asset_id: Optional[uuid.UUID] = None
    image_url: Optional[str] = None
    is_default: bool
    created_at: datetime


class EnvironmentGenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    environment_id: uuid.UUID
    owner_id: uuid.UUID
    generation_type: str
    status: str
    provider: Optional[str] = None
    prompt: Optional[str] = None
    error_message: Optional[str] = None
    result_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class EnvironmentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: Optional[uuid.UUID] = None
    story_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=4000)
    category: str = Field(default="Natural", max_length=100)
    location_type: Optional[str] = Field(default="Forests", max_length=160)
    art_style: str = Field(default="Anime", max_length=100)
    custom_art_style: Optional[str] = Field(default=None, max_length=300)
    visual_mood: Optional[str] = Field(default="Atmospheric and cinematic", max_length=150)
    time_of_day: str = Field(default="Afternoon", max_length=80)
    custom_time_of_day: Optional[str] = Field(default=None, max_length=200)
    weather: str = Field(default="Clear", max_length=80)
    custom_weather: Optional[str] = Field(default=None, max_length=200)
    color_palette: List[str] = Field(default_factory=list)
    camera_perspective: str = Field(default="Wide establishing shot", max_length=120)
    custom_camera_perspective: Optional[str] = Field(default=None, max_length=200)
    architecture: Optional[str] = Field(default=None, max_length=1000)
    terrain: Optional[str] = Field(default=None, max_length=1000)
    vegetation: Optional[str] = Field(default=None, max_length=1000)
    props: Optional[str] = Field(default=None, max_length=1000)
    lighting: Optional[str] = Field(default=None, max_length=600)
    atmosphere: Optional[str] = Field(default=None, max_length=600)
    additional_instructions: Optional[str] = Field(default=None, max_length=2000)
    tags: List[str] = Field(default_factory=list)
    scene_ids: List[str] = Field(default_factory=list)
    character_ids: List[str] = Field(default_factory=list)
    story_location_id: Optional[str] = None
    world_id: Optional[uuid.UUID] = None
    world_parent_location_id: Optional[uuid.UUID] = None
    seed_default_variations: bool = True


class EnvironmentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: Optional[uuid.UUID] = None
    story_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=4000)
    category: Optional[str] = Field(default=None, max_length=100)
    location_type: Optional[str] = Field(default=None, max_length=160)
    art_style: Optional[str] = Field(default=None, max_length=100)
    custom_art_style: Optional[str] = Field(default=None, max_length=300)
    visual_mood: Optional[str] = Field(default=None, max_length=150)
    time_of_day: Optional[str] = Field(default=None, max_length=80)
    custom_time_of_day: Optional[str] = Field(default=None, max_length=200)
    weather: Optional[str] = Field(default=None, max_length=80)
    custom_weather: Optional[str] = Field(default=None, max_length=200)
    color_palette: Optional[List[str]] = None
    camera_perspective: Optional[str] = Field(default=None, max_length=120)
    custom_camera_perspective: Optional[str] = Field(default=None, max_length=200)
    architecture: Optional[str] = Field(default=None, max_length=1000)
    terrain: Optional[str] = Field(default=None, max_length=1000)
    vegetation: Optional[str] = Field(default=None, max_length=1000)
    props: Optional[str] = Field(default=None, max_length=1000)
    lighting: Optional[str] = Field(default=None, max_length=600)
    atmosphere: Optional[str] = Field(default=None, max_length=600)
    additional_instructions: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[List[str]] = None
    scene_ids: Optional[List[str]] = None
    character_ids: Optional[List[str]] = None
    story_location_id: Optional[str] = None
    default_asset_id: Optional[uuid.UUID] = None


class EnvironmentSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    story_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    category: str
    location_type: str
    art_style: str
    visual_mood: Optional[str] = None
    time_of_day: str
    weather: str
    color_palette: List[str] = Field(default_factory=list)
    camera_perspective: str
    tags: List[str] = Field(default_factory=list)
    default_asset_id: Optional[uuid.UUID] = None
    default_image_url: Optional[str] = None
    asset_count: int = 0
    variation_count: int = 0
    created_at: datetime
    updated_at: datetime


class EnvironmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    story_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    category: str
    art_style: str
    visual_mood: Optional[str] = None
    time_of_day: str
    weather: str
    color_palette: List[str] = Field(default_factory=list)
    camera_perspective: str
    default_asset_id: Optional[uuid.UUID] = None
    default_image_url: Optional[str] = None
    metadata: EnvironmentVisualDetails
    assets: List[EnvironmentAssetResponse] = Field(default_factory=list)
    variations: List[EnvironmentVariationResponse] = Field(default_factory=list)
    generation_jobs: List[EnvironmentGenerationJobResponse] = Field(
        default_factory=list
    )
    created_at: datetime
    updated_at: datetime


EnvironmentGenerationTypeLiteral = Literal[
    "concept",
    "landscape",
    "interior",
    "exterior",
    "variation",
    "lighting_variation",
    "weather_variation",
    "camera_view",
    "environment_detail",
]


class EnvironmentPromptPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generation_type: EnvironmentGenerationTypeLiteral = "concept"
    art_style_override: Optional[str] = Field(default=None, max_length=100)
    time_of_day_override: Optional[str] = Field(default=None, max_length=80)
    weather_override: Optional[str] = Field(default=None, max_length=80)
    lighting_override: Optional[str] = Field(default=None, max_length=300)
    camera_perspective_override: Optional[str] = Field(default=None, max_length=120)
    variation_name: Optional[str] = Field(default=None, max_length=160)
    variation_description: Optional[str] = Field(default=None, max_length=1000)
    detail_focus: Optional[str] = Field(default=None, max_length=300)
    user_instructions: Optional[str] = Field(default=None, max_length=1500)


class EnvironmentPromptPreviewResponse(BaseModel):
    environment_id: uuid.UUID
    generation_type: str
    art_style: str
    prompt: str
    reference_asset_ids: List[str] = Field(default_factory=list)


class EnvironmentGenerateImageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generation_type: Literal[
        "concept",
        "landscape",
        "interior",
        "exterior",
        "lighting_variation",
        "weather_variation",
        "camera_view",
        "environment_detail",
    ] = "concept"
    custom_prompt: Optional[str] = Field(default=None, max_length=4000)
    art_style_override: Optional[str] = Field(default=None, max_length=100)
    time_of_day_override: Optional[str] = Field(default=None, max_length=80)
    weather_override: Optional[str] = Field(default=None, max_length=80)
    lighting_override: Optional[str] = Field(default=None, max_length=300)
    camera_perspective_override: Optional[str] = Field(default=None, max_length=120)
    detail_focus: Optional[str] = Field(default=None, max_length=300)
    reference_asset_ids: List[uuid.UUID] = Field(default_factory=list)
    user_instructions: Optional[str] = Field(default=None, max_length=1500)
    set_as_default: bool = False


class EnvironmentGenerateVariationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    variation_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=160)
    variation_type: str = Field(default="time_of_day", max_length=80)
    description: Optional[str] = Field(default=None, max_length=1000)
    time_of_day_override: Optional[str] = Field(default=None, max_length=80)
    weather_override: Optional[str] = Field(default=None, max_length=80)
    lighting_override: Optional[str] = Field(default=None, max_length=300)
    camera_perspective_override: Optional[str] = Field(default=None, max_length=120)
    color_palette_override: Optional[List[str]] = None
    custom_prompt: Optional[str] = Field(default=None, max_length=4000)
    user_instructions: Optional[str] = Field(default=None, max_length=1500)
    is_default: bool = False


class EnvironmentGenerationResultResponse(BaseModel):
    job: EnvironmentGenerationJobResponse
    generated_assets: List[EnvironmentAssetResponse] = Field(default_factory=list)
    variation: Optional[EnvironmentVariationResponse] = None
    environment: EnvironmentResponse


class EnvironmentStorySyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    story_id: uuid.UUID
    scene_ids: List[str] = Field(default_factory=list)
    character_ids: List[str] = Field(default_factory=list)


# ============================================================================
# World & WorldLocation Schemas
# ============================================================================


class WorldLocationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parent_id: Optional[uuid.UUID] = None
    environment_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=180)
    location_type: str = Field(default="location", max_length=80)
    description: Optional[str] = Field(default=None, max_length=1500)
    sort_order: int = 0


class WorldLocationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parent_id: Optional[uuid.UUID] = None
    clear_parent: bool = False
    environment_id: Optional[uuid.UUID] = None
    clear_environment: bool = False
    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    location_type: Optional[str] = Field(default=None, max_length=80)
    description: Optional[str] = Field(default=None, max_length=1500)
    sort_order: Optional[int] = None


class WorldLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    world_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    environment_id: Optional[uuid.UUID] = None
    environment_name: Optional[str] = None
    environment_image_url: Optional[str] = None
    name: str
    location_type: str
    description: Optional[str] = None
    sort_order: int
    created_at: datetime


class WorldCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=2500)
    lore_notes: Optional[str] = Field(default=None, max_length=2500)
    seed_sample_hierarchy: bool = False


class WorldUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    description: Optional[str] = Field(default=None, max_length=2500)
    lore_notes: Optional[str] = Field(default=None, max_length=2500)


class WorldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    locations: List[WorldLocationResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
