/**
 * TR STUDIO — Scene & Storyboard Schema Foundation
 * Defines structural types & constants for story creation, scenes, characters, and storyboards.
 */

export type AspectRatio = "16:9" | "9:16" | "1:1" | "2.39:1";

export interface Vector2D {
  x: number;
  y: number;
}

export interface SceneMetadata {
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  durationMs: number;
  aspectRatio: AspectRatio;
}

export const DEFAULT_SCENE_ASPECT_RATIO: AspectRatio = "16:9";
export const DEFAULT_SCENE_FPS = 24;

export const STORY_GENRES = [
  "Adventure",
  "Fantasy",
  "Comedy",
  "Horror",
  "Romance",
  "Action",
  "Mystery",
  "Thriller",
  "Science Fiction",
  "Drama",
  "Educational",
  "Superhero",
  "Slice of Life",
  "Mythology",
  "Custom",
] as const;

export const ANIMATION_STYLES = [
  "2D Cartoon",
  "Anime",
  "Chibi",
  "3D Cartoon",
  "Pixel Art",
  "Comic",
  "Storybook",
  "Custom",
] as const;

export const TARGET_AUDIENCES = [
  "Kids",
  "Teenagers",
  "Young Adults",
  "Adults",
  "Family",
  "Everyone",
] as const;

export const STORY_DURATIONS = [1, 3, 5, 10, 15, 20] as const;

export const STORY_LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Japanese",
  "Spanish",
  "Other supported languages",
] as const;

export const STORY_TONES = [
  "Funny",
  "Emotional",
  "Serious",
  "Inspirational",
  "Dark",
  "Mysterious",
  "Romantic",
  "Mixed",
] as const;

export const STORY_COMPLEXITIES = ["Simple", "Medium", "Detailed"] as const;

export const STORY_ENDINGS = [
  "Happy",
  "Sad",
  "Unexpected twist",
  "Open ending",
  "AI decides",
] as const;

export const CHARACTER_ROLES = [
  "Main character",
  "Supporting character",
  "Antagonist",
  "Background character",
] as const;

export const CHARACTER_VISUAL_STYLES = [
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
] as const;

export const DEFAULT_EXPRESSION_CATEGORIES = [
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
] as const;

export const DEFAULT_POSE_CATEGORIES = [
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
] as const;

export const DEFAULT_OUTFIT_PRESETS = [
  "Casual clothing",
  "School uniform",
  "Formal clothing",
  "Traditional clothing",
  "Fantasy costume",
  "Battle costume",
  "Winter clothing",
  "Custom clothing",
] as const;

export const SUPPORTED_SHEET_VIEWS = [
  { id: "front_view", label: "Front View" },
  { id: "side_view", label: "Side View" },
  { id: "back_view", label: "Back View" },
  { id: "three_quarter_view", label: "Three-Quarter (3/4) View" },
  { id: "full_body_view", label: "Full-Body View" },
  { id: "portrait", label: "Portrait" },
  { id: "expression_sheet", label: "Expression Sheet" },
  { id: "outfit_sheet", label: "Outfit Sheet" },
  { id: "pose_sheet", label: "Pose Sheet" },
] as const;

export const ENVIRONMENT_CATEGORIES = [
  "Natural",
  "Human / Urban",
  "Fantasy",
  "Science Fiction",
  "Custom",
] as const;

export const ENVIRONMENT_LOCATION_PRESETS: Record<string, readonly string[]> = {
  Natural: [
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
  Fantasy: [
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
};

export const ENVIRONMENT_TIME_SETTINGS = [
  "Sunrise",
  "Morning",
  "Afternoon",
  "Evening",
  "Sunset",
  "Night",
  "Custom",
] as const;

export const ENVIRONMENT_WEATHER_SETTINGS = [
  "Clear",
  "Cloudy",
  "Rainy",
  "Stormy",
  "Snowy",
  "Foggy",
  "Windy",
  "Custom",
] as const;

export const ENVIRONMENT_CAMERA_PERSPECTIVES = [
  "Wide establishing shot",
  "Medium shot",
  "Close-up environment detail",
  "Bird's-eye view",
  "Ground-level view",
  "Isometric view",
  "Custom",
] as const;

export const WORLD_LOCATION_TYPES = [
  { id: "region", label: "Region" },
  { id: "location", label: "Location" },
  { id: "building", label: "Building" },
  { id: "room", label: "Room" },
  { id: "natural_area", label: "Natural Area" },
] as const;

export const SCENE_TYPE_PRESETS = [
  "Establishing",
  "Narrative",
  "Dialogue",
  "Action / Confrontation",
  "Emotional Beat",
  "Montage",
  "Flashback",
  "Climax",
  "Resolution",
  "Custom",
] as const;

export const SCENE_TRANSITION_PRESETS = [
  "Cut",
  "Cross Dissolve",
  "Fade to Black",
  "Fade from Black",
  "Wipe",
  "Match Cut",
  "Smash Cut",
  "Whip Pan",
  "Iris Out",
  "Custom",
] as const;

export const SHOT_TYPE_PRESETS = [
  "establishing",
  "wide",
  "medium",
  "close-up",
  "extreme close-up",
  "over-the-shoulder",
  "point-of-view",
  "custom",
] as const;

export const SCENE_ASSET_LAYER_TYPES = [
  "background",
  "foreground",
  "prop",
  "overlay",
  "lighting_ref",
] as const;
