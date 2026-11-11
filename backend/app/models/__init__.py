"""SQLAlchemy ORM models for TR STUDIO."""

from app.models.user import User
from app.models.project import Project, ProjectStatus
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
from app.models.character import (
    Character,
    CharacterAsset,
    CharacterExpression,
    CharacterGenerationJob,
    CharacterOutfit,
    CharacterPose,
)
from app.models.environment import (
    Environment,
    EnvironmentAsset,
    EnvironmentGenerationJob,
    EnvironmentVariation,
    World,
    WorldLocation,
)
from app.models.scene import (
    SceneAssetAssignment,
    SceneCharacterAssignment,
    SceneGenerationJob,
    SceneShot,
)
from app.models.animation import (
    AnimationGenerationJob,
    SceneAnimation,
)
from app.models.audio import (
    AudioAsset,
    AudioGenerationJob,
    CharacterVoiceProfile,
    SubtitleEntry,
    SubtitleTrack,
)
from app.models.render import (
    RenderJob,
    RenderOutput,
)

__all__ = [
    "User",
    "Project",
    "ProjectStatus",
    "Story",
    "StoryVersion",
    "StoryCharacter",
    "CharacterRelationship",
    "StoryLocation",
    "StoryScene",
    "DialogueEntry",
    "NarrationEntry",
    "StoryGenerationJob",
    "Character",
    "CharacterAsset",
    "CharacterExpression",
    "CharacterPose",
    "CharacterOutfit",
    "CharacterGenerationJob",
    "Environment",
    "EnvironmentAsset",
    "EnvironmentVariation",
    "World",
    "WorldLocation",
    "EnvironmentGenerationJob",
    "SceneShot",
    "SceneCharacterAssignment",
    "SceneAssetAssignment",
    "SceneGenerationJob",
    "SceneAnimation",
    "AnimationGenerationJob",
    "CharacterVoiceProfile",
    "AudioAsset",
    "AudioGenerationJob",
    "SubtitleTrack",
    "SubtitleEntry",
    "RenderJob",
    "RenderOutput",
]
