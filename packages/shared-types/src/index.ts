/**
 * TR STUDIO — Shared TypeScript Contracts (Step 1 & Step 2)
 * Shared across @tr-studio/web, @tr-studio/scene-schema, @tr-studio/editor-engine, and @tr-studio/animation-engine.
 */

export type ProjectStatus = "draft" | "in_progress" | "completed" | "archived";

export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectPayload {
  title: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface UpdateProjectPayload {
  title?: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface ApiErrorResponse {
  detail: string;
  error_code?: string;
  timestamp?: string;
}

// ============================================================================
// Step 2: AI Story Creation Engine Contracts (schema_version: "1.0")
// ============================================================================

export interface CharacterRelationshipData {
  id: string;
  target_character_id?: string | null;
  target_character_name: string;
  relationship_type: string;
  description?: string | null;
}

export interface StoryCharacterData {
  id: string;
  name: string;
  role: string;
  age_description?: string | null;
  personality: string[];
  appearance_description?: string | null;
  motivation?: string | null;
  backstory?: string | null;
  relationships: CharacterRelationshipData[];
}

export interface StoryLocationData {
  id: string;
  name: string;
  description?: string | null;
  atmosphere?: string | null;
  time_of_day?: string | null;
  environment_requirements?: string | null;
}

export interface DialogueEntryData {
  id: string;
  character_id?: string | null;
  character_name: string;
  line: string;
  emotion?: string | null;
  delivery_direction?: string | null;
}

export interface NarrationEntryData {
  id: string;
  narrator_voice: string;
  text: string;
  emotion?: string | null;
}

export interface StorySceneData {
  id: string;
  scene_number: number;
  title: string;
  scene_heading?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  description?: string | null;
  action_description?: string | null;
  duration_seconds: number;
  characters: string[];
  dialogue: DialogueEntryData[];
  narration: NarrationEntryData[];
  camera_directions: string[];
  audio_directions: string[];
  visual_directions: string[];
  emotional_directions: string[];
  storyboard_notes?: string | null;
}

export interface StoryCoreMetadata {
  title: string;
  logline?: string | null;
  summary?: string | null;
  full_plot?: string | null;
  beginning?: string | null;
  middle?: string | null;
  ending?: string | null;
  genre: string;
  animation_style: string;
  tone: string;
  complexity: string;
  ending_type: string;
  target_audience: string;
  duration_minutes: number;
  language: string;
  themes: string[];
  world_description?: string | null;
}

export interface StoryOutputDocument {
  schema_version: string;
  story: StoryCoreMetadata;
  characters: StoryCharacterData[];
  locations: StoryLocationData[];
  scenes: StorySceneData[];
}

export interface StoryResponse {
  id: string;
  project_id: string;
  owner_id: string;
  schema_version: string;
  idea: string;
  title: string;
  logline: string | null;
  summary: string | null;
  full_plot: string | null;
  beginning: string | null;
  middle: string | null;
  ending_act: string | null;
  genre: string;
  animation_style: string;
  target_audience: string;
  duration_minutes: number;
  language: string;
  main_character_count: number;
  tone: string;
  complexity: string;
  ending_type: string;
  additional_instructions: string | null;
  themes: string[];
  world_description: string | null;
  current_version_number: number;
  document: StoryOutputDocument;
  created_at: string;
  updated_at: string;
}

export interface StoryGenerationRequestPayload {
  project_id?: string;
  idea: string;
  title?: string;
  genre: string;
  custom_genre?: string;
  animation_style: string;
  custom_animation_style?: string;
  target_audience: string;
  duration_minutes: number;
  language: string;
  custom_language?: string;
  main_character_count: number;
  tone: string;
  complexity: string;
  ending_type: string;
  additional_instructions?: string;
}

export interface ManualStoryCreatePayload {
  project_id?: string;
  idea: string;
  title: string;
  logline?: string;
  summary?: string;
  genre?: string;
  animation_style?: string;
  target_audience?: string;
  duration_minutes?: number;
  language?: string;
  main_character_count?: number;
  tone?: string;
  complexity?: string;
  ending_type?: string;
  additional_instructions?: string;
  document?: StoryOutputDocument;
}

export interface StoryUpdatePayload {
  title?: string;
  idea?: string;
  logline?: string;
  summary?: string;
  full_plot?: string;
  beginning?: string;
  middle?: string;
  ending_act?: string;
  genre?: string;
  animation_style?: string;
  target_audience?: string;
  duration_minutes?: number;
  language?: string;
  tone?: string;
  complexity?: string;
  ending_type?: string;
  themes?: string[];
  world_description?: string;
  characters?: StoryCharacterData[];
  locations?: StoryLocationData[];
  scenes?: StorySceneData[];
  create_version?: boolean;
  version_label?: string;
}

export type AIAssistantActionType =
  | "improve_story"
  | "make_funnier"
  | "make_emotional"
  | "add_suspense"
  | "improve_ending"
  | "unexpected_twist"
  | "simplify_story"
  | "expand_story"
  | "rewrite_dialogue"
  | "improve_character"
  | "add_detailed_scenes"
  | "translate_story"
  | "continue_story"
  | "summarize_story";

export interface StoryAIAssistRequestPayload {
  action: AIAssistantActionType;
  target_language?: string;
  target_scene_id?: string;
  target_character_id?: string;
  selected_text?: string;
  instructions?: string;
  apply_immediately?: boolean;
}

export interface StoryAIAssistProposalResponse {
  story_id: string;
  action: string;
  summary_of_changes: string;
  applied: boolean;
  original_document: StoryOutputDocument;
  proposed_document: StoryOutputDocument;
  rewritten_text?: string | null;
}

export interface StoryVersionItem {
  id: string;
  story_id: string;
  version_number: number;
  label: string;
  source: string;
  snapshot: StoryOutputDocument;
  created_at: string;
}

export interface AIProviderStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  message: string;
}

// ============================================================================
// Step 3: Character Creation Studio Shared Types
// ============================================================================

export interface CharacterAppearanceAttributes {
  face_shape?: string;
  eye_shape?: string;
  eye_color?: string;
  hair_style?: string;
  hair_color?: string;
  skin_tone?: string;
  body_type?: string;
  height?: string;
  clothing?: string;
  accessories?: string;
  shoes?: string;
  distinguishing_features?: string;
  color_palette: string[];
  custom_attributes: Record<string, string>;
}

export interface CharacterBibleData {
  canonical_description?: string;
  color_palette: string[];
  facial_features?: string;
  body_proportions?: string;
  clothing_details?: string;
  accessories_details?: string;
  style_description?: string;
  selected_reference_asset_ids: string[];
  identity_notes?: string;
  consistency_disclaimer: string;
}

export interface CharacterRelationshipEntry {
  id: string;
  target_character_id?: string | null;
  target_character_name: string;
  relationship_type: string;
  description?: string;
}

export interface CharacterExtendedMetadata {
  gender_presentation?: string;
  category?: string;
  strengths: string[];
  weaknesses: string[];
  special_abilities: string[];
  relationships: CharacterRelationshipEntry[];
  appearance: CharacterAppearanceAttributes;
  character_bible: CharacterBibleData;
  custom_style_description?: string;
  story_character_id?: string | null;
  parent_character_id?: string | null;
}

export interface CharacterAssetRecord {
  id: string;
  character_id: string;
  owner_id: string;
  asset_type: string;
  file_reference: string;
  url: string;
  download_url: string;
  prompt?: string | null;
  provider?: string | null;
  generation_status: string;
  is_canonical_reference: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CharacterExpressionRecord {
  id: string;
  character_id: string;
  name: string;
  description?: string | null;
  generation_status: string;
  asset_id?: string | null;
  reference_image_url?: string | null;
  created_at: string;
}

export interface CharacterPoseRecord {
  id: string;
  character_id: string;
  name: string;
  category: string;
  description?: string | null;
  generation_status: string;
  asset_id?: string | null;
  reference_image_url?: string | null;
  created_at: string;
}

export interface CharacterOutfitRecord {
  id: string;
  character_id: string;
  name: string;
  description?: string | null;
  color_palette: string[];
  accessories: string[];
  generation_status: string;
  asset_id?: string | null;
  reference_image_url?: string | null;
  is_default: boolean;
  created_at: string;
}

export interface CharacterGenerationJobRecord {
  id: string;
  character_id: string;
  owner_id: string;
  generation_type: string;
  status: string;
  provider?: string | null;
  prompt?: string | null;
  error_message?: string | null;
  result_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CharacterSummaryRecord {
  id: string;
  owner_id: string;
  project_id: string;
  story_id?: string | null;
  name: string;
  nickname?: string | null;
  role: string;
  species: string;
  category: string;
  age_description?: string | null;
  personality: string[];
  appearance_description?: string | null;
  style: string;
  canonical_reference_asset_id?: string | null;
  canonical_reference_url?: string | null;
  asset_count: number;
  expression_count: number;
  pose_count: number;
  outfit_count: number;
  created_at: string;
  updated_at: string;
}

export interface CharacterRecord {
  id: string;
  owner_id: string;
  project_id: string;
  story_id?: string | null;
  name: string;
  nickname?: string | null;
  role: string;
  species: string;
  age_description?: string | null;
  personality: string[];
  backstory?: string | null;
  motivation?: string | null;
  appearance_description?: string | null;
  canonical_reference_asset_id?: string | null;
  canonical_reference_url?: string | null;
  style: string;
  metadata: CharacterExtendedMetadata;
  assets: CharacterAssetRecord[];
  expressions: CharacterExpressionRecord[];
  poses: CharacterPoseRecord[];
  outfits: CharacterOutfitRecord[];
  generation_jobs: CharacterGenerationJobRecord[];
  created_at: string;
  updated_at: string;
}

export type Character = CharacterRecord;

export interface CharacterCreatePayload {
  project_id?: string;
  story_id?: string;
  name: string;
  nickname?: string;
  role?: string;
  species?: string;
  age_description?: string;
  gender_presentation?: string;
  category?: string;
  personality?: string[];
  backstory?: string;
  motivation?: string;
  strengths?: string[];
  weaknesses?: string[];
  special_abilities?: string[];
  relationships?: CharacterRelationshipEntry[];
  appearance_description?: string;
  appearance?: Partial<CharacterAppearanceAttributes>;
  character_bible?: Partial<CharacterBibleData>;
  style?: string;
  custom_style_description?: string;
  story_character_id?: string;
  seed_default_presets?: boolean;
}

export interface CharacterUpdatePayload {
  project_id?: string;
  story_id?: string;
  name?: string;
  nickname?: string;
  role?: string;
  species?: string;
  age_description?: string;
  gender_presentation?: string;
  category?: string;
  personality?: string[];
  backstory?: string;
  motivation?: string;
  strengths?: string[];
  weaknesses?: string[];
  special_abilities?: string[];
  relationships?: CharacterRelationshipEntry[];
  appearance_description?: string;
  appearance?: Partial<CharacterAppearanceAttributes>;
  character_bible?: Partial<CharacterBibleData>;
  canonical_reference_asset_id?: string | null;
  style?: string;
  custom_style_description?: string;
}

export interface CharacterPromptPreviewPayload {
  generation_type:
    | "concept"
    | "portrait"
    | "full_body"
    | "turnaround_sheet"
    | "expression"
    | "pose"
    | "outfit";
  style_override?: string;
  camera_framing?: string;
  background?: string;
  expression_name?: string;
  pose_name?: string;
  outfit_name?: string;
  outfit_description?: string;
  sheet_views?: string[];
  user_instructions?: string;
}

export interface CharacterPromptPreviewResponse {
  character_id: string;
  generation_type: string;
  style: string;
  prompt: string;
  used_canonical_bible: boolean;
  reference_asset_ids: string[];
  consistency_note: string;
}

export interface CharacterGenerationResult {
  job: CharacterGenerationJobRecord;
  generated_assets: CharacterAssetRecord[];
  views_requested: string[];
  views_generated: string[];
  complete: boolean;
  consistency_note: string;
  character: CharacterRecord;
}

export interface ImageProviderStatusResponse {
  configured: boolean;
  provider: string;
  model: string;
  supported_styles: string[];
  unsupported_styles: string[];
  supports_reference_images: boolean;
  supports_combined_sheet: boolean;
  supports_separate_views: boolean;
  consistency_disclaimer: string;
  message: string;
}

// ============================================================================
// Step 4: World & Environment Creation Studio Shared Types
// ============================================================================

export interface EnvironmentVisualDetails {
  location_type?: string | null;
  architecture?: string | null;
  terrain?: string | null;
  vegetation?: string | null;
  props?: string | null;
  lighting?: string | null;
  atmosphere?: string | null;
  custom_art_style?: string | null;
  custom_time_of_day?: string | null;
  custom_weather?: string | null;
  custom_camera_perspective?: string | null;
  additional_instructions?: string | null;
  tags: string[];
  scene_ids: string[];
  character_ids: string[];
  story_location_id?: string | null;
  parent_environment_id?: string | null;
  selected_reference_asset_ids: string[];
}

export interface EnvironmentAssetRecord {
  id: string;
  environment_id: string;
  owner_id: string;
  asset_type: string;
  file_reference: string;
  url: string;
  download_url: string;
  prompt?: string | null;
  provider?: string | null;
  generation_status: string;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EnvironmentVariationRecord {
  id: string;
  environment_id: string;
  name: string;
  description?: string | null;
  variation_type: string;
  asset_id?: string | null;
  image_url?: string | null;
  is_default: boolean;
  created_at: string;
}

export interface EnvironmentGenerationJobRecord {
  id: string;
  environment_id: string;
  owner_id: string;
  generation_type: string;
  status: string;
  provider?: string | null;
  prompt?: string | null;
  error_message?: string | null;
  result_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentSummaryRecord {
  id: string;
  owner_id: string;
  project_id: string;
  story_id?: string | null;
  name: string;
  description?: string | null;
  category: string;
  location_type: string;
  art_style: string;
  visual_mood?: string | null;
  time_of_day: string;
  weather: string;
  color_palette: string[];
  camera_perspective: string;
  tags: string[];
  default_asset_id?: string | null;
  default_image_url?: string | null;
  asset_count: number;
  variation_count: number;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentRecord {
  id: string;
  owner_id: string;
  project_id: string;
  story_id?: string | null;
  name: string;
  description?: string | null;
  category: string;
  art_style: string;
  visual_mood?: string | null;
  time_of_day: string;
  weather: string;
  color_palette: string[];
  camera_perspective: string;
  default_asset_id?: string | null;
  default_image_url?: string | null;
  metadata: EnvironmentVisualDetails;
  assets: EnvironmentAssetRecord[];
  variations: EnvironmentVariationRecord[];
  generation_jobs: EnvironmentGenerationJobRecord[];
  created_at: string;
  updated_at: string;
}

export interface EnvironmentCreatePayload {
  project_id?: string;
  story_id?: string;
  name: string;
  description?: string;
  category?: string;
  location_type?: string;
  art_style?: string;
  custom_art_style?: string;
  visual_mood?: string;
  time_of_day?: string;
  custom_time_of_day?: string;
  weather?: string;
  custom_weather?: string;
  color_palette?: string[];
  camera_perspective?: string;
  custom_camera_perspective?: string;
  architecture?: string;
  terrain?: string;
  vegetation?: string;
  props?: string;
  lighting?: string;
  atmosphere?: string;
  additional_instructions?: string;
  tags?: string[];
  scene_ids?: string[];
  character_ids?: string[];
  story_location_id?: string;
  world_id?: string;
  world_parent_location_id?: string;
  seed_default_variations?: boolean;
}

export interface EnvironmentUpdatePayload {
  project_id?: string;
  story_id?: string;
  name?: string;
  description?: string;
  category?: string;
  location_type?: string;
  art_style?: string;
  custom_art_style?: string;
  visual_mood?: string;
  time_of_day?: string;
  custom_time_of_day?: string;
  weather?: string;
  custom_weather?: string;
  color_palette?: string[];
  camera_perspective?: string;
  custom_camera_perspective?: string;
  architecture?: string;
  terrain?: string;
  vegetation?: string;
  props?: string;
  lighting?: string;
  atmosphere?: string;
  additional_instructions?: string;
  tags?: string[];
  scene_ids?: string[];
  character_ids?: string[];
  story_location_id?: string;
  default_asset_id?: string | null;
}

export type EnvironmentGenerationType =
  | "concept"
  | "landscape"
  | "interior"
  | "exterior"
  | "variation"
  | "lighting_variation"
  | "weather_variation"
  | "camera_view"
  | "environment_detail";

export interface EnvironmentPromptPreviewPayload {
  generation_type: EnvironmentGenerationType;
  art_style_override?: string;
  time_of_day_override?: string;
  weather_override?: string;
  lighting_override?: string;
  camera_perspective_override?: string;
  variation_name?: string;
  variation_description?: string;
  detail_focus?: string;
  user_instructions?: string;
}

export interface EnvironmentPromptPreviewResponse {
  environment_id: string;
  generation_type: string;
  art_style: string;
  prompt: string;
  reference_asset_ids: string[];
}

export interface EnvironmentGenerationResult {
  job: EnvironmentGenerationJobRecord;
  generated_assets: EnvironmentAssetRecord[];
  variation?: EnvironmentVariationRecord | null;
  environment: EnvironmentRecord;
}

export interface WorldLocationRecord {
  id: string;
  world_id: string;
  parent_id?: string | null;
  environment_id?: string | null;
  environment_name?: string | null;
  environment_image_url?: string | null;
  name: string;
  location_type: string;
  description?: string | null;
  sort_order: number;
  created_at: string;
}

export interface WorldRecord {
  id: string;
  owner_id: string;
  project_id: string;
  name: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  locations: WorldLocationRecord[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Step 5: Professional Scene Builder & Storyboard Studio Types
// ---------------------------------------------------------------------------

export type ShotTypeLiteral =
  | "establishing"
  | "wide"
  | "medium"
  | "close-up"
  | "extreme close-up"
  | "over-the-shoulder"
  | "point-of-view"
  | "custom";

export interface SceneShotRecord {
  id: string;
  scene_id: string;
  story_id: string;
  project_id: string;
  owner_id: string;
  shot_number: number;
  title: string;
  description?: string | null;
  shot_type: string;
  camera_perspective: string;
  character_focus: string[];
  environment_id?: string | null;
  environment_name?: string | null;
  environment_image_url?: string | null;
  visual_direction?: string | null;
  duration_seconds: number;
  production_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneShotCreatePayload {
  title: string;
  description?: string;
  shot_type?: string;
  camera_perspective?: string;
  character_focus?: string[];
  environment_id?: string | null;
  visual_direction?: string;
  duration_seconds?: number;
  production_notes?: string;
}

export interface SceneShotUpdatePayload {
  shot_number?: number;
  title?: string;
  description?: string;
  shot_type?: string;
  camera_perspective?: string;
  character_focus?: string[];
  environment_id?: string | null;
  clear_environment?: boolean;
  visual_direction?: string;
  duration_seconds?: number;
  production_notes?: string;
}

export interface SceneCharacterAssignmentRecord {
  id: string;
  scene_id: string;
  story_id: string;
  project_id: string;
  owner_id: string;
  character_id?: string | null;
  story_character_id?: string | null;
  character_name: string;
  role_in_scene: string;
  expression_id?: string | null;
  expression_name?: string | null;
  pose_id?: string | null;
  pose_name?: string | null;
  outfit_id?: string | null;
  outfit_name?: string | null;
  asset_id?: string | null;
  image_url?: string | null;
  reference_status: "ok" | "no_visual_asset" | "missing_reference";
  layer_order: number;
  position_x: number;
  position_y: number;
  scale_percent: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneCharacterAssignmentCreatePayload {
  character_id?: string | null;
  story_character_id?: string | null;
  character_name?: string;
  role_in_scene?: string;
  expression_id?: string | null;
  pose_id?: string | null;
  outfit_id?: string | null;
  asset_id?: string | null;
  layer_order?: number;
  position_x?: number;
  position_y?: number;
  scale_percent?: number;
  notes?: string;
}

export interface SceneCharacterAssignmentUpdatePayload {
  character_id?: string | null;
  character_name?: string;
  role_in_scene?: string;
  expression_id?: string | null;
  clear_expression?: boolean;
  pose_id?: string | null;
  clear_pose?: boolean;
  outfit_id?: string | null;
  clear_outfit?: boolean;
  asset_id?: string | null;
  clear_asset?: boolean;
  layer_order?: number;
  position_x?: number;
  position_y?: number;
  scale_percent?: number;
  notes?: string;
}

export type SceneAssetLayerType =
  | "background"
  | "foreground"
  | "prop"
  | "overlay"
  | "lighting_ref";

export interface SceneAssetAssignmentRecord {
  id: string;
  scene_id: string;
  story_id: string;
  project_id: string;
  owner_id: string;
  layer_type: SceneAssetLayerType | string;
  label: string;
  environment_asset_id?: string | null;
  character_asset_id?: string | null;
  image_url?: string | null;
  reference_status: "ok" | "missing_reference";
  layer_order: number;
  position_x: number;
  position_y: number;
  scale_percent: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneAssetAssignmentCreatePayload {
  layer_type: SceneAssetLayerType;
  label: string;
  environment_asset_id?: string | null;
  character_asset_id?: string | null;
  layer_order?: number;
  position_x?: number;
  position_y?: number;
  scale_percent?: number;
  notes?: string;
}

export interface SceneAssetAssignmentUpdatePayload {
  layer_type?: SceneAssetLayerType;
  label?: string;
  environment_asset_id?: string | null;
  character_asset_id?: string | null;
  layer_order?: number;
  position_x?: number;
  position_y?: number;
  scale_percent?: number;
  notes?: string;
}

export interface SceneEnvironmentAssignmentPayload {
  environment_id?: string | null;
  clear_environment?: boolean;
  world_location_id?: string | null;
  clear_world_location?: boolean;
  variation_id?: string | null;
  background_asset_id?: string | null;
}

export interface SceneEnvironmentPreview {
  id: string;
  name: string;
  category: string;
  art_style: string;
  time_of_day: string;
  weather: string;
  camera_perspective: string;
  image_url?: string | null;
  color_palette: string[];
}

export interface SceneWorldLocationPreview {
  id: string;
  world_id: string;
  world_name?: string | null;
  name: string;
  location_type: string;
  description?: string | null;
}

export interface SceneDetailRecord {
  id: string;
  story_id: string;
  project_id: string;
  owner_id: string;
  scene_number: number;
  title: string;
  scene_type: string;
  scene_heading: string;
  summary: string;
  description: string;
  action_description: string;
  location_id?: string | null;
  location_name: string;
  environment_id?: string | null;
  environment?: SceneEnvironmentPreview | null;
  world_location_id?: string | null;
  world_location?: SceneWorldLocationPreview | null;
  time_of_day: string;
  weather: string;
  mood: string;
  duration_seconds: number;
  camera_framing: string;
  transition_type: string;
  production_notes: string;
  storyboard_notes: string;
  thumbnail_url?: string | null;
  characters: string[];
  dialogue: DialogueEntryData[];
  narration: NarrationEntryData[];
  camera_directions: string[];
  audio_directions: string[];
  visual_directions: string[];
  emotional_directions: string[];
  character_assignments: SceneCharacterAssignmentRecord[];
  asset_assignments: SceneAssetAssignmentRecord[];
  shots: SceneShotRecord[];
  missing_references: string[];
  created_at: string;
  updated_at: string;
}

export interface SceneBuilderCreatePayload {
  title: string;
  scene_type?: string;
  scene_heading?: string;
  summary?: string;
  description?: string;
  action_description?: string;
  location_id?: string | null;
  location_name?: string;
  environment_id?: string | null;
  world_location_id?: string | null;
  time_of_day?: string;
  weather?: string;
  mood?: string;
  duration_seconds?: number;
  camera_framing?: string;
  transition_type?: string;
  production_notes?: string;
  storyboard_notes?: string;
  characters?: string[];
  character_ids?: string[];
  dialogue?: DialogueEntryData[];
  narration?: NarrationEntryData[];
  camera_directions?: string[];
  audio_directions?: string[];
  visual_directions?: string[];
  emotional_directions?: string[];
  seed_default_shots?: boolean;
}

export interface SceneBuilderUpdatePayload {
  scene_number?: number;
  title?: string;
  scene_type?: string;
  scene_heading?: string;
  summary?: string;
  description?: string;
  action_description?: string;
  location_id?: string | null;
  location_name?: string;
  environment_id?: string | null;
  clear_environment?: boolean;
  world_location_id?: string | null;
  clear_world_location?: boolean;
  time_of_day?: string;
  weather?: string;
  mood?: string;
  duration_seconds?: number;
  camera_framing?: string;
  transition_type?: string;
  production_notes?: string;
  storyboard_notes?: string;
  characters?: string[];
  dialogue?: DialogueEntryData[];
  narration?: NarrationEntryData[];
  camera_directions?: string[];
  audio_directions?: string[];
  visual_directions?: string[];
  emotional_directions?: string[];
}

export interface StoryboardCardRecord {
  id: string;
  story_id: string;
  project_id: string;
  scene_number: number;
  title: string;
  scene_type: string;
  scene_heading: string;
  summary: string;
  description: string;
  duration_seconds: number;
  time_of_day: string;
  weather: string;
  mood: string;
  camera_framing: string;
  transition_type: string;
  location_name: string;
  environment_id?: string | null;
  environment_name?: string | null;
  world_location_id?: string | null;
  world_location_name?: string | null;
  thumbnail_url?: string | null;
  has_actual_asset: boolean;
  main_characters: string[];
  character_assignments: SceneCharacterAssignmentRecord[];
  shot_count: number;
  dialogue_count: number;
  narration_count: number;
  missing_references: string[];
  updated_at: string;
}

export interface StoryboardOverviewRecord {
  project_id: string;
  story_id: string;
  story_title: string;
  total_scenes: number;
  total_shots: number;
  total_duration_seconds: number;
  cards: StoryboardCardRecord[];
}

export type SceneAIGenerationAction =
  | "convert_story_to_scenes"
  | "suggest_scene_details"
  | "suggest_environments"
  | "suggest_characters"
  | "generate_shot_list"
  | "suggest_visual_direction"
  | "rewrite_scene_tone";

export interface SceneAIGenerationPayload {
  action: SceneAIGenerationAction;
  scene_id?: string | null;
  story_section_text?: string;
  target_tone?: string;
  desired_count?: number;
  instructions?: string;
  apply_immediately?: boolean;
}

export interface ProposedShotItem {
  id: string;
  shot_number: number;
  title: string;
  description: string;
  shot_type: string;
  camera_perspective: string;
  character_focus: string[];
  visual_direction: string;
  duration_seconds: number;
  production_notes: string;
}

export interface ProposedSceneItem {
  id: string;
  scene_number: number;
  title: string;
  scene_type: string;
  scene_heading: string;
  summary: string;
  description: string;
  action_description: string;
  location_name: string;
  suggested_environment_name: string;
  suggested_characters: string[];
  time_of_day: string;
  weather: string;
  mood: string;
  duration_seconds: number;
  camera_framing: string;
  transition_type: string;
  visual_directions: string[];
  camera_directions: string[];
  audio_directions: string[];
  production_notes: string;
  shots: ProposedShotItem[];
}

export interface SceneGenerationJobRecord {
  id: string;
  project_id: string;
  story_id: string;
  scene_id?: string | null;
  owner_id: string;
  job_type: string;
  status: string;
  provider?: string | null;
  model_name?: string | null;
  prompt_summary?: string | null;
  error_message?: string | null;
  result_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SceneAIGenerationProposalRecord {
  schema_version: string;
  job: SceneGenerationJobRecord;
  action: SceneAIGenerationAction;
  summary_of_suggestions: string;
  applied: boolean;
  scene_id?: string | null;
  proposed_scenes: ProposedSceneItem[];
  proposed_shots: ProposedShotItem[];
  suggested_environments: string[];
  suggested_characters: string[];
  suggested_visual_directions: string[];
  suggested_transition?: string | null;
  rewritten_description?: string | null;
}

export interface SceneAIApplyProposalPayload {
  action: SceneAIGenerationAction;
  scene_id?: string | null;
  accepted_scenes?: ProposedSceneItem[];
  accepted_shots?: ProposedShotItem[];
  replace_existing_shots?: boolean;
  accepted_title?: string;
  accepted_summary?: string;
  accepted_description?: string;
  accepted_visual_directions?: string[];
  accepted_transition_type?: string;
  accepted_environment_name?: string;
  accepted_characters?: string[];
}

export interface SceneStorySyncRecord {
  project_id: string;
  story_id: string;
  scenes_synced: number;
  characters_matched: number;
  environments_matched: number;
  missing_references_detected: string[];
  scenes: SceneDetailRecord[];
}

// ---------------------------------------------------------------------------
// Step 6: 2D Animation Engine Types
// ---------------------------------------------------------------------------

export interface AnimationPresetRecord {
  id: string;
  label: string;
  category: string;
  description: string;
  default_duration_ms: number;
  params: string[];
  default_distance?: number | null;
  default_amount?: number | null;
}

export interface SceneAnimationRecord {
  id: string;
  scene_id: string;
  story_id: string;
  project_id: string;
  owner_id: string;
  schema_version: string;
  version_number: int_number;
  fps: number;
  duration_ms: number;
  width: number;
  height: number;
  document: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

type int_number = number;

// Step 7: Professional Multi-Track Timeline Editor Types
export type TrackType =
  | "character"
  | "prop"
  | "background"
  | "camera"
  | "property"
  | "group"
  | "dialogue"
  | "narration"
  | "music"
  | "sound_effect"
  | "ambience"
  | "audio";

export interface TimelineClipRecord {
  id: string;
  track_id: string;
  name: string;
  start_ms: number;
  duration_ms: number;
  source_start_ms: number;
  color?: string | null;
  target_id?: string | null;
  volume?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
  audio_asset_id?: string | null;
  audio_url?: string | null;
  waveform?: number[] | null;
}

export interface TimelineMarkerRecord {
  id: string;
  name: string;
  time_ms: number;
  color: string;
  description?: string | null;
  event_type?: string | null;
}

export interface TrackGroupRecord {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  track_ids: string[];
}

export interface SceneAnimationSavePayload {
  document: Record<string, unknown>;
  expected_version_number?: number | null;
}

export interface AnimationApplyPresetPayload {
  preset_id: string;
  target_id: string;
  start_ms: number;
  duration_ms: number;
  distance?: number | null;
  amount?: number | null;
}

export type AnimationAIAction =
  | "suggest_character_movement"
  | "suggest_animation_sequence"
  | "suggest_camera_movement"
  | "convert_action_to_keyframes";

export interface AnimationAIAssistPayload {
  action: AnimationAIAction;
  scene_id: string;
  object_id?: string | null;
  target_tone?: string | null;
  instructions?: string | null;
  apply_immediately?: boolean;
}

export interface AnimationProposedTrackRecord {
  id: string;
  target_id: string;
  property: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  keyframes: Record<string, unknown>[];
}

export interface AnimationGenerationJobRecord {
  id: string;
  project_id: string;
  story_id: string;
  scene_id?: string | null;
  owner_id: string;
  job_type: string;
  status: string;
  provider?: string | null;
  model_name?: string | null;
  prompt_summary?: string | null;
  error_message?: string | null;
  result_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AnimationAIAssistProposalRecord {
  schema_version: string;
  job: AnimationGenerationJobRecord;
  action: AnimationAIAction;
  summary_of_suggestions: string;
  applied: boolean;
  scene_id: string;
  target_object_id?: string | null;
  suggested_preset_id?: string | null;
  proposed_tracks: AnimationProposedTrackRecord[];
  proposed_camera_tracks: AnimationProposedTrackRecord[];
  explanation?: string | null;
}

export interface AnimationAIApplyProposalPayload {
  action: AnimationAIAction;
  scene_id: string;
  accepted_tracks: AnimationProposedTrackRecord[];
  accepted_camera_tracks: AnimationProposedTrackRecord[];
  overwrite_existing?: boolean;
}

// ===========================================================================
// Step 8: Professional Dialogue, Voice & Audio Studio Types
// ===========================================================================

export interface VoiceOptionRecord {
  voice_id: string;
  provider: string;
  name: string;
  gender?: string | null;
  accent?: string | null;
  age?: string | null;
  description?: string | null;
  preview_url?: string | null;
  sample_text?: string | null;
  traits: string[];
}

export interface CharacterVoiceProfileRecord {
  id: string;
  project_id: string;
  owner_id: string;
  character_id: string;
  character_name?: string | null;
  provider: string;
  voice_id: string;
  voice_name: string;
  voice_style?: string | null;
  speaking_rate: number;
  pitch: number;
  stability?: number | null;
  similarity_boost?: number | null;
  accent?: string | null;
  age_category?: string | null;
  gender?: string | null;
  sample_url?: string | null;
  custom_pronunciations: Record<string, string>;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type AudioCategoryType = "music" | "sound_effect" | "dialogue" | "narration" | "ambience";

export interface AudioAssetRecord {
  id: string;
  project_id: string;
  owner_id: string;
  category: AudioCategoryType;
  sub_category?: string | null;
  title: string;
  description?: string | null;
  file_path: string;
  audio_url: string;
  file_size_bytes: number;
  mime_type: string;
  duration_ms: number;
  sample_rate: number;
  channels: number;
  bitrate_kbps?: number | null;
  waveform_data?: number[] | null;
  source_type: string;
  licensing_notes?: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AudioAssetListResponse {
  items: AudioAssetRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface DialogueLineRecord {
  id: string;
  scene_id: string;
  character_id?: string | null;
  character_name?: string | null;
  line_text: string;
  emotion?: string | null;
  delivery_style?: string | null;
  line_order: number;
  shot_id?: string | null;
  speaking_speed: number;
  pause_duration_ms: number;
  pronunciation_notes?: string | null;
  audio_status: string;
  audio_asset_id?: string | null;
  audio_url?: string | null;
  start_ms?: number | null;
  duration_ms?: number | null;
  created_at: string;
  updated_at: string;
}

export interface NarrationLineRecord {
  id: string;
  scene_id: string;
  narration_text: string;
  narrator_style?: string | null;
  line_order: number;
  audio_status: string;
  audio_asset_id?: string | null;
  audio_url?: string | null;
  start_ms?: number | null;
  duration_ms?: number | null;
  language: string;
  voice_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubtitleEntryRecord {
  id: string;
  track_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker_name?: string | null;
  scene_id?: string | null;
  dialogue_id?: string | null;
  narration_id?: string | null;
  entry_order: number;
  styling_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubtitleTrackRecord {
  id: string;
  project_id: string;
  owner_id: string;
  language: string;
  name: string;
  is_default: boolean;
  scene_id?: string | null;
  story_id?: string | null;
  entries: SubtitleEntryRecord[];
  created_at: string;
  updated_at: string;
}

export interface SubtitleExportRecord {
  track_id: string;
  language: string;
  format: "srt" | "vtt";
  content: string;
  filename: string;
}

export interface TimelineAudioSyncRecord {
  scene_id: string;
  tracks_created: number;
  clips_created: number;
  message: string;
}

// ============================================================================
// Step 9: Professional Video Rendering, Export & Production Pipeline Contracts
// ============================================================================

export type ContainerFormat = "mp4" | "webm" | "mov";
export type VideoCodec = "h264" | "h265" | "vp9" | "prores";
export type AudioCodec = "aac" | "opus" | "mp3";
export type QualityPreset = "draft" | "standard" | "high" | "production";
export type ExportRangeType = "full" | "scene" | "custom";
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9";
export type RenderJobStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "encoding"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";

export interface RenderJobRecord {
  id: string;
  project_id: string;
  owner_id: string;
  scene_id?: string | null;
  status: RenderJobStatus;
  progress_pct: number;
  current_stage: string;
  total_frames: number;
  rendered_frames: number;
  fps: number;
  resolution_width: number;
  resolution_height: number;
  aspect_ratio: AspectRatio;
  container_format: ContainerFormat;
  video_codec: VideoCodec;
  audio_codec: AudioCodec;
  quality_preset: QualityPreset;
  bitrate_kbps?: number | null;
  include_audio: boolean;
  include_subtitles: boolean;
  burn_subtitles: boolean;
  subtitle_track_id?: string | null;
  export_range_type: ExportRangeType;
  export_range_start_ms: number;
  export_range_end_ms?: number | null;
  duration_ms: number;
  output_file_path?: string | null;
  output_file_size_bytes?: number | null;
  error_message?: string | null;
  render_logs: string[];
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderOutputRecord {
  id: string;
  job_id: string;
  project_id: string;
  owner_id: string;
  scene_id?: string | null;
  title: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  duration_ms: number;
  width: number;
  height: number;
  fps: number;
  aspect_ratio: AspectRatio;
  video_codec: string;
  audio_codec?: string | null;
  has_audio: boolean;
  has_subtitles: boolean;
  metadata_json: Record<string, unknown>;
  media_url?: string | null;
  download_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderJobCreatePayload {
  scene_id?: string | null;
  export_range_type?: ExportRangeType;
  export_range_start_ms?: number;
  export_range_end_ms?: number | null;
  resolution_width?: number;
  resolution_height?: number;
  aspect_ratio?: AspectRatio;
  fps?: number;
  container_format?: ContainerFormat;
  video_codec?: VideoCodec;
  audio_codec?: AudioCodec;
  quality_preset?: QualityPreset;
  bitrate_kbps?: number | null;
  include_audio?: boolean;
  include_subtitles?: boolean;
  burn_subtitles?: boolean;
  subtitle_track_id?: string | null;
}

export interface RenderJobListResponse {
  jobs: RenderJobRecord[];
  total: number;
}

export interface RenderOutputListResponse {
  outputs: RenderOutputRecord[];
  total: number;
}


