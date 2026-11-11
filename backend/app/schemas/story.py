"""
Pydantic v2 Schemas for TR STUDIO Step 2 — AI Story Creation Engine.
Validates:
- Story generation requests & settings
- Versioned Story Output Structure (schema_version = "1.0")
- Characters, Character Relationships, Locations, Scenes, Dialogue, Narration
- AI Assistant action payloads & non-destructive preview responses
- Story Versions & Generation Jobs
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# 1. Story Output Structure (schema_version: "1.0")
# ---------------------------------------------------------------------------

class CharacterRelationshipData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_character_id: Optional[str] = None
    target_character_name: str = Field(..., min_length=1, max_length=150)
    relationship_type: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None


class StoryCharacterData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=1, max_length=150)
    role: str = Field(default="Protagonist", max_length=100)
    age_description: Optional[str] = Field(default="Young adult", max_length=100)
    personality: List[str] = Field(default_factory=list)
    appearance_description: Optional[str] = Field(default="")
    motivation: Optional[str] = Field(default="")
    backstory: Optional[str] = Field(default="")
    relationships: List[CharacterRelationshipData] = Field(default_factory=list)


class StoryLocationData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="")
    atmosphere: Optional[str] = Field(default="Atmospheric", max_length=150)
    time_of_day: Optional[str] = Field(default="Day", max_length=100)
    environment_requirements: Optional[str] = Field(default="")


class DialogueEntryData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    character_id: Optional[str] = None
    character_name: str = Field(..., min_length=1, max_length=150)
    line: str = Field(..., min_length=1)
    emotion: Optional[str] = Field(default="Neutral", max_length=100)
    delivery_direction: Optional[str] = Field(default="", max_length=200)


class NarrationEntryData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    narrator_voice: str = Field(default="Narrator (V.O.)", max_length=100)
    text: str = Field(..., min_length=1)
    emotion: Optional[str] = Field(default="Reflective", max_length=100)


class StorySceneData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scene_number: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=200)
    scene_heading: Optional[str] = Field(default="EXT. LOCATION - DAY", max_length=255)
    location_id: Optional[str] = None
    location_name: Optional[str] = Field(default="", max_length=200)
    description: Optional[str] = Field(default="")
    action_description: Optional[str] = Field(default="")
    duration_seconds: int = Field(default=30, ge=5, le=1800)
    characters: List[str] = Field(default_factory=list)
    dialogue: List[DialogueEntryData] = Field(default_factory=list)
    narration: List[NarrationEntryData] = Field(default_factory=list)
    camera_directions: List[str] = Field(default_factory=list)
    audio_directions: List[str] = Field(default_factory=list)
    visual_directions: List[str] = Field(default_factory=list)
    emotional_directions: List[str] = Field(default_factory=list)
    storyboard_notes: Optional[str] = Field(default="")


class StoryCoreMetadata(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    logline: Optional[str] = Field(default="")
    summary: Optional[str] = Field(default="")
    full_plot: Optional[str] = Field(default="")
    beginning: Optional[str] = Field(default="")
    middle: Optional[str] = Field(default="")
    ending: Optional[str] = Field(default="")
    genre: str = Field(default="Fantasy", max_length=100)
    animation_style: str = Field(default="Anime", max_length=100)
    tone: str = Field(default="Emotional", max_length=100)
    complexity: str = Field(default="Medium", max_length=50)
    ending_type: str = Field(default="AI decides", max_length=100)
    target_audience: str = Field(default="Everyone", max_length=100)
    duration_minutes: int = Field(default=5, ge=1, le=180)
    language: str = Field(default="English", max_length=80)
    themes: List[str] = Field(default_factory=list)
    world_description: Optional[str] = Field(default="")


class StoryOutputDocument(BaseModel):
    """
    Canonical versioned story structure required by Section 5:
    {
      "schema_version": "1.0",
      "story": { ... },
      "characters": [ ... ],
      "locations": [ ... ],
      "scenes": [ ... ]
    }
    """

    schema_version: str = Field(default="1.0")
    story: StoryCoreMetadata
    characters: List[StoryCharacterData] = Field(default_factory=list)
    locations: List[StoryLocationData] = Field(default_factory=list)
    scenes: List[StorySceneData] = Field(default_factory=list)

    @field_validator("schema_version")
    @classmethod
    def check_schema_version(cls, v: str) -> str:
        if not v:
            return "1.0"
        return v


# ---------------------------------------------------------------------------
# 2. Story Generation & Manual Creation Request Payloads
# ---------------------------------------------------------------------------

class StoryGenerationRequest(BaseModel):
    project_id: Optional[uuid.UUID] = Field(
        None,
        description="Existing project ID. If omitted, a new project is automatically created for the user.",
    )
    idea: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Required story premise or idea",
    )
    title: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional story title; AI will suggest one if omitted",
    )
    genre: str = Field(default="Fantasy", max_length=100)
    custom_genre: Optional[str] = Field(None, max_length=100)
    animation_style: str = Field(default="Anime", max_length=100)
    custom_animation_style: Optional[str] = Field(None, max_length=100)
    target_audience: str = Field(default="Everyone", max_length=100)
    duration_minutes: int = Field(default=5, ge=1, le=120)
    language: str = Field(default="English", max_length=80)
    custom_language: Optional[str] = Field(None, max_length=80)
    main_character_count: int = Field(default=2, ge=1, le=12)
    tone: str = Field(default="Emotional", max_length=100)
    complexity: str = Field(default="Medium", max_length=50)
    ending_type: str = Field(default="AI decides", max_length=100)
    additional_instructions: Optional[str] = Field(None, max_length=3000)

    @field_validator("idea")
    @classmethod
    def validate_idea(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 10:
            raise ValueError("Story idea must be at least 10 characters long.")
        return cleaned

    @property
    def resolved_genre(self) -> str:
        if self.genre.lower() == "custom" and self.custom_genre and self.custom_genre.strip():
            return self.custom_genre.strip()
        return self.genre

    @property
    def resolved_animation_style(self) -> str:
        if (
            self.animation_style.lower() == "custom"
            and self.custom_animation_style
            and self.custom_animation_style.strip()
        ):
            return self.custom_animation_style.strip()
        return self.animation_style

    @property
    def resolved_language(self) -> str:
        if (
            self.language.lower() in ("other", "other supported languages", "custom")
            and self.custom_language
            and self.custom_language.strip()
        ):
            return self.custom_language.strip()
        return self.language


class ManualStoryCreateRequest(BaseModel):
    project_id: Optional[uuid.UUID] = None
    idea: str = Field(..., min_length=3, max_length=5000)
    title: str = Field(..., min_length=1, max_length=255)
    logline: Optional[str] = None
    summary: Optional[str] = None
    genre: str = Field(default="Fantasy", max_length=100)
    animation_style: str = Field(default="Anime", max_length=100)
    target_audience: str = Field(default="Everyone", max_length=100)
    duration_minutes: int = Field(default=5, ge=1, le=120)
    language: str = Field(default="English", max_length=80)
    main_character_count: int = Field(default=2, ge=1, le=12)
    tone: str = Field(default="Emotional", max_length=100)
    complexity: str = Field(default="Medium", max_length=50)
    ending_type: str = Field(default="Happy", max_length=100)
    additional_instructions: Optional[str] = None
    document: Optional[StoryOutputDocument] = None


class StoryUpdateRequest(BaseModel):
    """
    Allows updating story metadata and/or the full structured document.
    Supports optional `create_version=True` so autosaves update in-place while
    explicit saves or milestones record a new StoryVersion snapshot.
    """

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    idea: Optional[str] = None
    logline: Optional[str] = None
    summary: Optional[str] = None
    full_plot: Optional[str] = None
    beginning: Optional[str] = None
    middle: Optional[str] = None
    ending_act: Optional[str] = None
    genre: Optional[str] = None
    animation_style: Optional[str] = None
    target_audience: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=180)
    language: Optional[str] = None
    tone: Optional[str] = None
    complexity: Optional[str] = None
    ending_type: Optional[str] = None
    themes: Optional[List[str]] = None
    world_description: Optional[str] = None
    characters: Optional[List[StoryCharacterData]] = None
    locations: Optional[List[StoryLocationData]] = None
    scenes: Optional[List[StorySceneData]] = None
    create_version: bool = Field(
        default=False,
        description="When True, creates a new StoryVersion snapshot in version history.",
    )
    version_label: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional custom label for the saved version.",
    )


# ---------------------------------------------------------------------------
# 3. Scene & Character Granular Payloads
# ---------------------------------------------------------------------------

class SceneCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    scene_heading: Optional[str] = Field(default="EXT. NEW LOCATION - DAY", max_length=255)
    location_id: Optional[str] = None
    location_name: Optional[str] = Field(default="", max_length=200)
    description: Optional[str] = Field(default="")
    action_description: Optional[str] = Field(default="")
    duration_seconds: int = Field(default=30, ge=5, le=1800)
    characters: List[str] = Field(default_factory=list)
    dialogue: List[DialogueEntryData] = Field(default_factory=list)
    narration: List[NarrationEntryData] = Field(default_factory=list)
    camera_directions: List[str] = Field(default_factory=list)
    audio_directions: List[str] = Field(default_factory=list)
    visual_directions: List[str] = Field(default_factory=list)
    emotional_directions: List[str] = Field(default_factory=list)
    storyboard_notes: Optional[str] = Field(default="")


class SceneUpdateRequest(BaseModel):
    scene_number: Optional[int] = Field(None, ge=1)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    scene_heading: Optional[str] = Field(None, max_length=255)
    location_id: Optional[str] = None
    location_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    action_description: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=5, le=1800)
    characters: Optional[List[str]] = None
    dialogue: Optional[List[DialogueEntryData]] = None
    narration: Optional[List[NarrationEntryData]] = None
    camera_directions: Optional[List[str]] = None
    audio_directions: Optional[List[str]] = None
    visual_directions: Optional[List[str]] = None
    emotional_directions: Optional[List[str]] = None
    storyboard_notes: Optional[str] = None


class SceneReorderRequest(BaseModel):
    scene_ids: List[str] = Field(..., min_length=1, description="Ordered list of scene UUIDs")


# ---------------------------------------------------------------------------
# 4. AI Assistant Action Payloads & Non-Destructive Proposal Responses
# ---------------------------------------------------------------------------

AIAssistantActionType = Literal[
    "improve_story",
    "make_funnier",
    "make_emotional",
    "add_suspense",
    "improve_ending",
    "unexpected_twist",
    "simplify_story",
    "expand_story",
    "rewrite_dialogue",
    "improve_character",
    "add_detailed_scenes",
    "translate_story",
    "continue_story",
    "summarize_story",
]


class StoryAIAssistRequest(BaseModel):
    action: AIAssistantActionType = Field(..., description="Contextual AI assistant action")
    target_language: Optional[str] = Field(None, max_length=80, description="Target language for translation")
    target_scene_id: Optional[str] = Field(None, description="Optional scene ID for scene/dialogue rewrites")
    target_character_id: Optional[str] = Field(None, description="Optional character ID for character enhancement")
    selected_text: Optional[str] = Field(None, description="Optional specific dialogue or text snippet to rewrite")
    instructions: Optional[str] = Field(None, max_length=2000, description="Additional user direction")
    apply_immediately: bool = Field(
        default=False,
        description=(
            "Defaults to False so original content is preserved until the user explicitly "
            "reviews and accepts the proposed replacement."
        ),
    )


class StoryAIAssistProposalResponse(BaseModel):
    story_id: uuid.UUID
    action: str
    summary_of_changes: str
    applied: bool
    original_document: StoryOutputDocument
    proposed_document: StoryOutputDocument
    rewritten_text: Optional[str] = None


# ---------------------------------------------------------------------------
# 5. API Response Schemas
# ---------------------------------------------------------------------------

class StoryVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    story_id: uuid.UUID
    version_number: int
    label: str
    source: str
    snapshot: Dict[str, Any]
    created_at: datetime


class StoryGenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    story_id: Optional[uuid.UUID]
    owner_id: uuid.UUID
    job_type: str
    status: str
    current_step: str
    progress: int
    provider: Optional[str]
    model_name: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime


class StoryResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    owner_id: uuid.UUID
    schema_version: str
    idea: str
    title: str
    logline: Optional[str]
    summary: Optional[str]
    full_plot: Optional[str]
    beginning: Optional[str]
    middle: Optional[str]
    ending_act: Optional[str]
    genre: str
    animation_style: str
    target_audience: str
    duration_minutes: int
    language: str
    main_character_count: int
    tone: str
    complexity: str
    ending_type: str
    additional_instructions: Optional[str]
    themes: List[str]
    world_description: Optional[str]
    current_version_number: int
    document: StoryOutputDocument
    created_at: datetime
    updated_at: datetime


class AIProviderStatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str
    message: str
