/**
 * TR STUDIO — Frontend API Client
 * Communicates with the FastAPI backend (/api/v1) with automatic JWT Bearer headers.
 */

import type {
  AnimationAIAction,
  AnimationAIAssistPayload,
  AnimationAIAssistProposalRecord,
  AnimationAIApplyProposalPayload,
  AnimationApplyPresetPayload,
  AnimationGenerationJobRecord,
  AnimationPresetRecord,
  AnimationProposedTrackRecord,
  SceneAnimationRecord,
  SceneAnimationSavePayload,
  AIProviderStatusResponse,
  AuthTokenResponse,
  CharacterAssetRecord,
  CharacterCreatePayload,
  CharacterExpressionRecord,
  CharacterGenerationJobRecord,
  CharacterGenerationResult,
  CharacterOutfitRecord,
  CharacterPoseRecord,
  CharacterPromptPreviewPayload,
  CharacterPromptPreviewResponse,
  CharacterRecord,
  CharacterSummaryRecord,
  CharacterUpdatePayload,
  CreateProjectPayload,
  EnvironmentAssetRecord,
  EnvironmentCreatePayload,
  EnvironmentGenerationJobRecord,
  EnvironmentGenerationResult,
  EnvironmentPromptPreviewPayload,
  EnvironmentPromptPreviewResponse,
  EnvironmentRecord,
  EnvironmentSummaryRecord,
  EnvironmentUpdatePayload,
  EnvironmentVariationRecord,
  ImageProviderStatusResponse,
  ManualStoryCreatePayload,
  Project,
  RenderJobCreatePayload,
  RenderJobListResponse,
  RenderJobRecord,
  RenderOutputListResponse,
  RenderOutputRecord,
  SceneAIApplyProposalPayload,
  SceneAIGenerationPayload,
  SceneAIGenerationProposalRecord,
  SceneAssetAssignmentCreatePayload,
  SceneAssetAssignmentRecord,
  SceneAssetAssignmentUpdatePayload,
  SceneBuilderCreatePayload,
  SceneBuilderUpdatePayload,
  SceneCharacterAssignmentCreatePayload,
  SceneCharacterAssignmentRecord,
  SceneCharacterAssignmentUpdatePayload,
  SceneDetailRecord,
  SceneEnvironmentAssignmentPayload,
  SceneGenerationJobRecord,
  SceneShotCreatePayload,
  SceneShotRecord,
  SceneShotUpdatePayload,
  SceneStorySyncRecord,
  StoryboardOverviewRecord,
  StoryAIAssistProposalResponse,
  StoryAIAssistRequestPayload,
  StoryCharacterData,
  StoryGenerationRequestPayload,
  StoryResponse,
  StorySceneData,
  StoryUpdatePayload,
  StoryVersionItem,
  UpdateProjectPayload,
  User,
  WorldLocationRecord,
  WorldRecord,
} from "@tr-studio/shared-types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
const API_V1_URL =
  process.env.NEXT_PUBLIC_API_V1_URL?.replace(/\/$/, "") || `${API_BASE_URL}/api/v1`;

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const TOKEN_STORAGE_KEY = "tr_studio_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiClientError extends Error {
  status: number;
  errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  useRootUrl = false
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!headers.has("Content-Type") && options.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const base = useRootUrl ? API_BASE_URL : API_V1_URL;
  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}`;
    const errorCode =
      typeof data.error_code === "string" ? data.error_code : undefined;
    throw new ApiClientError(detail, response.status, errorCode);
  }

  return data as T;
}

export const api = {
  health: {
    checkRoot: () =>
      request<{
        status: string;
        service: string;
        version: string;
        database: string;
        timestamp: string;
      }>("/health", { method: "GET" }, true),
    checkV1: () =>
      request<{
        status: string;
        service: string;
        api_version: string;
        app_version: string;
        database: string;
        timestamp: string;
      }>("/health", { method: "GET" }),
  },

  auth: {
    register: (payload: { email: string; username: string; password: string }) =>
      request<AuthTokenResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    login: (payload: { email: string; password: string }) =>
      request<AuthTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    me: () => request<User>("/auth/me", { method: "GET" }),

    updateProfile: (payload: {
      username?: string;
      current_password?: string;
      new_password?: string;
    }) =>
      request<User>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },

  projects: {
    list: (params?: { status?: string; search?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.status && params.status !== "all") {
        searchParams.set("status", params.status);
      }
      if (params?.search?.trim()) {
        searchParams.set("search", params.search.trim());
      }
      const qs = searchParams.toString();
      return request<Project[]>(`/projects${qs ? `?${qs}` : ""}`, {
        method: "GET",
      });
    },

    get: (id: string) => request<Project>(`/projects/${id}`, { method: "GET" }),

    create: (payload: CreateProjectPayload) =>
      request<Project>("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (id: string, payload: UpdateProjectPayload) =>
      request<Project>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (id: string) =>
      request<void>(`/projects/${id}`, {
        method: "DELETE",
      }),
  },

  stories: {
    aiStatus: () =>
      request<AIProviderStatusResponse>("/stories/ai-status", {
        method: "GET",
      }),

    generate: (payload: StoryGenerationRequestPayload) =>
      request<StoryResponse>("/stories/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    createManual: (payload: ManualStoryCreatePayload) =>
      request<StoryResponse>("/stories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    getByProject: (projectId: string) =>
      request<StoryResponse>(`/stories/by-project/${projectId}`, {
        method: "GET",
      }),

    get: (storyId: string) =>
      request<StoryResponse>(`/stories/${storyId}`, {
        method: "GET",
      }),

    update: (storyId: string, payload: StoryUpdatePayload) =>
      request<StoryResponse>(`/stories/${storyId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (storyId: string) =>
      request<void>(`/stories/${storyId}`, {
        method: "DELETE",
      }),

    continueStory: (storyId: string, payload?: Partial<StoryAIAssistRequestPayload>) =>
      request<StoryAIAssistProposalResponse>(`/stories/${storyId}/continue`, {
        method: "POST",
        body: JSON.stringify({
          action: "continue_story",
          apply_immediately: false,
          ...payload,
        }),
      }),

    improveStory: (storyId: string, payload: StoryAIAssistRequestPayload) =>
      request<StoryAIAssistProposalResponse>(`/stories/${storyId}/improve`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    rewriteStory: (storyId: string, payload: StoryAIAssistRequestPayload) =>
      request<StoryAIAssistProposalResponse>(`/stories/${storyId}/rewrite`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    listCharacters: (storyId: string) =>
      request<StoryCharacterData[]>(`/stories/${storyId}/characters`, {
        method: "GET",
      }),

    listScenes: (storyId: string) =>
      request<StorySceneData[]>(`/stories/${storyId}/scenes`, {
        method: "GET",
      }),

    addScene: (storyId: string, payload: Partial<StorySceneData> & { title: string }) =>
      request<StorySceneData>(`/stories/${storyId}/scenes`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    reorderScenes: (storyId: string, sceneIds: string[]) =>
      request<StorySceneData[]>(`/stories/${storyId}/scenes/reorder`, {
        method: "POST",
        body: JSON.stringify({ scene_ids: sceneIds }),
      }),

    listVersions: (storyId: string) =>
      request<StoryVersionItem[]>(`/stories/${storyId}/versions`, {
        method: "GET",
      }),

    createVersion: (storyId: string, label?: string) =>
      request<StoryVersionItem>(`/stories/${storyId}/versions`, {
        method: "POST",
        body: JSON.stringify({ label }),
      }),

    restoreVersion: (storyId: string, versionId: string) =>
      request<StoryResponse>(
        `/stories/${storyId}/versions/${versionId}/restore`,
        {
          method: "POST",
        }
      ),
  },

  scenes: {
    update: (sceneId: string, payload: Partial<StorySceneData>) =>
      request<StorySceneData>(`/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (sceneId: string) =>
      request<void>(`/scenes/${sceneId}`, {
        method: "DELETE",
      }),

    duplicate: (sceneId: string) =>
      request<StorySceneData>(`/scenes/${sceneId}/duplicate`, {
        method: "POST",
      }),
  },

  sceneBuilder: {
    listProjectScenes: (projectId: string) =>
      request<SceneDetailRecord[]>(`/projects/${projectId}/scene-builder`, { method: "GET" }),
    createScene: (projectId: string, payload: SceneBuilderCreatePayload) =>
      request<SceneDetailRecord>(`/projects/${projectId}/scene-builder`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    reorderScenes: (projectId: string, sceneIds: string[]) =>
      request<SceneDetailRecord[]>(`/projects/${projectId}/scene-builder/reorder`, {
        method: "POST",
        body: JSON.stringify({ scene_ids: sceneIds }),
      }),
    syncWithStory: (projectId: string) =>
      request<SceneStorySyncRecord>(`/projects/${projectId}/scene-builder/sync`, {
        method: "POST",
      }),
    generateAIProposal: (projectId: string, payload: SceneAIGenerationPayload) =>
      request<SceneAIGenerationProposalRecord>(
        `/projects/${projectId}/scene-builder/ai-generate`,
        { method: "POST", body: JSON.stringify(payload) }
      ),
    applyAIProposal: (projectId: string, payload: SceneAIApplyProposalPayload) =>
      request<SceneDetailRecord[]>(`/projects/${projectId}/scene-builder/ai-apply`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getStoryboard: (projectId: string) =>
      request<StoryboardOverviewRecord>(`/projects/${projectId}/storyboard`, {
        method: "GET",
      }),
    listProjectShots: (projectId: string) =>
      request<SceneShotRecord[]>(`/projects/${projectId}/shots`, { method: "GET" }),
    listSceneJobs: (projectId: string) =>
      request<SceneGenerationJobRecord[]>(`/projects/${projectId}/scene-generation-jobs`, {
        method: "GET",
      }),
    getScene: (sceneId: string) =>
      request<SceneDetailRecord>(`/scene-builder/${sceneId}`, { method: "GET" }),
    updateScene: (sceneId: string, payload: SceneBuilderUpdatePayload) =>
      request<SceneDetailRecord>(`/scene-builder/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteScene: (sceneId: string) =>
      request<void>(`/scene-builder/${sceneId}`, { method: "DELETE" }),
    duplicateScene: (sceneId: string) =>
      request<SceneDetailRecord>(`/scene-builder/${sceneId}/duplicate`, { method: "POST" }),
    assignEnvironment: (sceneId: string, payload: SceneEnvironmentAssignmentPayload) =>
      request<SceneDetailRecord>(`/scene-builder/${sceneId}/environment`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    addCharacter: (sceneId: string, payload: SceneCharacterAssignmentCreatePayload) =>
      request<SceneCharacterAssignmentRecord>(`/scene-builder/${sceneId}/characters`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    reorderCharacters: (sceneId: string, assignmentIds: string[]) =>
      request<SceneCharacterAssignmentRecord[]>(
        `/scene-builder/${sceneId}/characters/reorder`,
        { method: "POST", body: JSON.stringify({ assignment_ids: assignmentIds }) }
      ),
    updateCharacterAssignment: (
      assignmentId: string,
      payload: SceneCharacterAssignmentUpdatePayload
    ) =>
      request<SceneCharacterAssignmentRecord>(
        `/scene-character-assignments/${assignmentId}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      ),
    deleteCharacterAssignment: (assignmentId: string) =>
      request<void>(`/scene-character-assignments/${assignmentId}`, { method: "DELETE" }),
    addAsset: (sceneId: string, payload: SceneAssetAssignmentCreatePayload) =>
      request<SceneAssetAssignmentRecord>(`/scene-builder/${sceneId}/assets`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    reorderAssets: (sceneId: string, assignmentIds: string[]) =>
      request<SceneAssetAssignmentRecord[]>(`/scene-builder/${sceneId}/assets/reorder`, {
        method: "POST",
        body: JSON.stringify({ assignment_ids: assignmentIds }),
      }),
    updateAssetAssignment: (assignmentId: string, payload: SceneAssetAssignmentUpdatePayload) =>
      request<SceneAssetAssignmentRecord>(`/scene-asset-assignments/${assignmentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteAssetAssignment: (assignmentId: string) =>
      request<void>(`/scene-asset-assignments/${assignmentId}`, { method: "DELETE" }),
    listSceneShots: (sceneId: string) =>
      request<SceneShotRecord[]>(`/scene-builder/${sceneId}/shots`, { method: "GET" }),
    createShot: (sceneId: string, payload: SceneShotCreatePayload) =>
      request<SceneShotRecord>(`/scene-builder/${sceneId}/shots`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    reorderShots: (sceneId: string, shotIds: string[]) =>
      request<SceneShotRecord[]>(`/scene-builder/${sceneId}/shots/reorder`, {
        method: "POST",
        body: JSON.stringify({ shot_ids: shotIds }),
      }),
    updateShot: (shotId: string, payload: SceneShotUpdatePayload) =>
      request<SceneShotRecord>(`/scene-shots/${shotId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deleteShot: (shotId: string) =>
      request<void>(`/scene-shots/${shotId}`, { method: "DELETE" }),
  },

  animation: {
    listPresets: () =>
      request<AnimationPresetRecord[]>("/animation/presets", { method: "GET" }),
    getSceneAnimation: (sceneId: string) =>
      request<SceneAnimationRecord>(`/scenes/${sceneId}/animation`, { method: "GET" }),
    saveSceneAnimation: (sceneId: string, payload: SceneAnimationSavePayload) =>
      request<SceneAnimationRecord>(`/scenes/${sceneId}/animation`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    resetSceneAnimation: (sceneId: string) =>
      request<SceneAnimationRecord>(`/scenes/${sceneId}/animation/reset`, { method: "POST" }),
    applyPreset: (sceneId: string, payload: AnimationApplyPresetPayload) =>
      request<SceneAnimationRecord>(`/scenes/${sceneId}/animation/apply-preset`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    generateAIProposal: (projectId: string, payload: AnimationAIAssistPayload) =>
      request<AnimationAIAssistProposalRecord>(
        `/projects/${projectId}/animation/ai-assist`,
        { method: "POST", body: JSON.stringify(payload) }
      ),
    applyAIProposal: (projectId: string, payload: AnimationAIApplyProposalPayload) =>
      request<SceneAnimationRecord>(`/projects/${projectId}/animation/ai-apply`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listJobs: (projectId: string) =>
      request<AnimationGenerationJobRecord[]>(`/projects/${projectId}/animation-jobs`, {
        method: "GET",
      }),
    getJob: (jobId: string) =>
      request<AnimationGenerationJobRecord>(`/animation-jobs/${jobId}`, {
        method: "GET",
      }),
  },

  characters: {
    aiStatus: () =>
      request<ImageProviderStatusResponse>("/characters/ai-status", {
        method: "GET",
      }),

    list: (params?: {
      project_id?: string;
      story_id?: string;
      role?: string;
      style?: string;
      search?: string;
    }) => {
      const sp = new URLSearchParams();
      if (params?.project_id) sp.set("project_id", params.project_id);
      if (params?.story_id) sp.set("story_id", params.story_id);
      if (params?.role && params.role !== "all") sp.set("role", params.role);
      if (params?.style && params.style !== "all") sp.set("style", params.style);
      if (params?.search?.trim()) sp.set("search", params.search.trim());
      const qs = sp.toString();
      return request<CharacterSummaryRecord[]>(
        `/characters${qs ? `?${qs}` : ""}`,
        { method: "GET" }
      );
    },

    get: (characterId: string) =>
      request<CharacterRecord>(`/characters/${characterId}`, {
        method: "GET",
      }),

    create: (payload: CharacterCreatePayload) =>
      request<CharacterRecord>("/characters", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (characterId: string, payload: CharacterUpdatePayload) =>
      request<CharacterRecord>(`/characters/${characterId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (characterId: string) =>
      request<void>(`/characters/${characterId}`, {
        method: "DELETE",
      }),

    createVariation: (
      characterId: string,
      payload: { name?: string; style?: string; variation_notes?: string }
    ) =>
      request<CharacterRecord>(`/characters/${characterId}/variations`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    previewPrompt: (
      characterId: string,
      payload: CharacterPromptPreviewPayload
    ) =>
      request<CharacterPromptPreviewResponse>(
        `/characters/${characterId}/preview-prompt`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    syncToStory: (
      characterId: string,
      payload: { story_id: string; scene_ids?: string[] }
    ) =>
      request<CharacterRecord>(`/characters/${characterId}/sync-to-story`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    importFromStory: (storyId: string) =>
      request<CharacterRecord[]>(`/characters/import-from-story/${storyId}`, {
        method: "POST",
      }),

    generateImage: (
      characterId: string,
      payload: {
        generation_type: "concept" | "portrait" | "full_body";
        custom_prompt?: string;
        style_override?: string;
        camera_framing?: string;
        background?: string;
        reference_asset_ids?: string[];
        user_instructions?: string;
        set_as_canonical_reference?: boolean;
      }
    ) =>
      request<CharacterGenerationResult>(`/characters/${characterId}/generate`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    generateSheet: (
      characterId: string,
      payload: {
        views: string[];
        sheet_mode: "separate_views" | "combined_sheet";
        custom_prompt?: string;
        style_override?: string;
        user_instructions?: string;
      }
    ) =>
      request<CharacterGenerationResult>(
        `/characters/${characterId}/generate-sheet`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    generateExpression: (
      characterId: string,
      payload: {
        expression_id?: string;
        expression_name: string;
        description?: string;
        custom_prompt?: string;
        user_instructions?: string;
      }
    ) =>
      request<CharacterGenerationResult>(
        `/characters/${characterId}/generate-expression`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    generatePose: (
      characterId: string,
      payload: {
        pose_id?: string;
        pose_name: string;
        category?: string;
        description?: string;
        custom_prompt?: string;
        user_instructions?: string;
      }
    ) =>
      request<CharacterGenerationResult>(
        `/characters/${characterId}/generate-pose`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    generateOutfit: (
      characterId: string,
      payload: {
        outfit_id?: string;
        outfit_name: string;
        description?: string;
        color_palette?: string[];
        accessories?: string[];
        is_default?: boolean;
        custom_prompt?: string;
        user_instructions?: string;
      }
    ) =>
      request<CharacterGenerationResult>(
        `/characters/${characterId}/generate-outfit`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    listJobs: (characterId: string) =>
      request<CharacterGenerationJobRecord[]>(
        `/characters/${characterId}/jobs`,
        { method: "GET" }
      ),

    getJob: (jobId: string) =>
      request<CharacterGenerationJobRecord>(
        `/character-generation-jobs/${jobId}`,
        { method: "GET" }
      ),

    listExpressions: (characterId: string) =>
      request<CharacterExpressionRecord[]>(
        `/characters/${characterId}/expressions`,
        { method: "GET" }
      ),

    createExpression: (
      characterId: string,
      payload: { name: string; description?: string; asset_id?: string }
    ) =>
      request<CharacterExpressionRecord>(
        `/characters/${characterId}/expressions`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    updateExpression: (
      expressionId: string,
      payload: { name?: string; description?: string; asset_id?: string }
    ) =>
      request<CharacterExpressionRecord>(
        `/character-expressions/${expressionId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      ),

    deleteExpression: (expressionId: string) =>
      request<void>(`/character-expressions/${expressionId}`, {
        method: "DELETE",
      }),

    listPoses: (characterId: string) =>
      request<CharacterPoseRecord[]>(`/characters/${characterId}/poses`, {
        method: "GET",
      }),

    createPose: (
      characterId: string,
      payload: {
        name: string;
        category: string;
        description?: string;
        asset_id?: string;
      }
    ) =>
      request<CharacterPoseRecord>(`/characters/${characterId}/poses`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    updatePose: (
      poseId: string,
      payload: {
        name?: string;
        category?: string;
        description?: string;
        asset_id?: string;
      }
    ) =>
      request<CharacterPoseRecord>(`/character-poses/${poseId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    deletePose: (poseId: string) =>
      request<void>(`/character-poses/${poseId}`, {
        method: "DELETE",
      }),

    listOutfits: (characterId: string) =>
      request<CharacterOutfitRecord[]>(`/characters/${characterId}/outfits`, {
        method: "GET",
      }),

    createOutfit: (
      characterId: string,
      payload: {
        name: string;
        description?: string;
        color_palette?: string[];
        accessories?: string[];
        asset_id?: string;
        is_default?: boolean;
      }
    ) =>
      request<CharacterOutfitRecord>(`/characters/${characterId}/outfits`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    updateOutfit: (
      outfitId: string,
      payload: {
        name?: string;
        description?: string;
        color_palette?: string[];
        accessories?: string[];
        asset_id?: string;
        is_default?: boolean;
      }
    ) =>
      request<CharacterOutfitRecord>(`/character-outfits/${outfitId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    deleteOutfit: (outfitId: string) =>
      request<void>(`/character-outfits/${outfitId}`, {
        method: "DELETE",
      }),

    listAssets: (characterId: string, assetType?: string) => {
      const qs = assetType ? `?asset_type=${encodeURIComponent(assetType)}` : "";
      return request<CharacterAssetRecord[]>(
        `/characters/${characterId}/assets${qs}`,
        { method: "GET" }
      );
    },

    uploadAsset: (
      characterId: string,
      file: File,
      options?: {
        asset_type?: string;
        label?: string;
        set_as_canonical_reference?: boolean;
      }
    ) => {
      const formData = new FormData();
      formData.append("file", file);
      if (options?.asset_type) formData.append("asset_type", options.asset_type);
      if (options?.label) formData.append("label", options.label);
      if (options?.set_as_canonical_reference) {
        formData.append("set_as_canonical_reference", "true");
      }
      return request<CharacterAssetRecord>(
        `/characters/${characterId}/assets/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
    },

    updateAsset: (
      assetId: string,
      payload: {
        asset_type?: string;
        label?: string;
        set_as_canonical_reference?: boolean;
      }
    ) =>
      request<CharacterAssetRecord>(`/character-assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    deleteAsset: (assetId: string) =>
      request<void>(`/character-assets/${assetId}`, {
        method: "DELETE",
      }),
  },

  environments: {
    getProviderStatus: () =>
      request<ImageProviderStatusResponse>("/environments/provider-status", {
        method: "GET",
      }),

    list: (params?: {
      project_id?: string;
      story_id?: string;
      category?: string;
      art_style?: string;
      search?: string;
      sort_by?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.project_id) searchParams.set("project_id", params.project_id);
      if (params?.story_id) searchParams.set("story_id", params.story_id);
      if (params?.category) searchParams.set("category", params.category);
      if (params?.art_style) searchParams.set("art_style", params.art_style);
      if (params?.search) searchParams.set("search", params.search);
      if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
      const qs = searchParams.toString();
      return request<EnvironmentSummaryRecord[]>(
        `/environments${qs ? `?${qs}` : ""}`,
        { method: "GET" }
      );
    },

    get: (environmentId: string) =>
      request<EnvironmentRecord>(`/environments/${environmentId}`, {
        method: "GET",
      }),

    create: (payload: EnvironmentCreatePayload) =>
      request<EnvironmentRecord>("/environments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (environmentId: string, payload: EnvironmentUpdatePayload) =>
      request<EnvironmentRecord>(`/environments/${environmentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (environmentId: string) =>
      request<void>(`/environments/${environmentId}`, {
        method: "DELETE",
      }),

    duplicate: (
      environmentId: string,
      params?: { name?: string; art_style?: string }
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.name) searchParams.set("name", params.name);
      if (params?.art_style) searchParams.set("art_style", params.art_style);
      const qs = searchParams.toString();
      return request<EnvironmentRecord>(
        `/environments/${environmentId}/duplicate${qs ? `?${qs}` : ""}`,
        { method: "POST" }
      );
    },

    previewPrompt: (
      environmentId: string,
      payload: EnvironmentPromptPreviewPayload
    ) =>
      request<EnvironmentPromptPreviewResponse>(
        `/environments/${environmentId}/preview-prompt`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    generateImage: (
      environmentId: string,
      payload: {
        generation_type:
          | "concept"
          | "landscape"
          | "interior"
          | "exterior"
          | "lighting_variation"
          | "weather_variation"
          | "camera_view"
          | "environment_detail";
        custom_prompt?: string;
        art_style_override?: string;
        time_of_day_override?: string;
        weather_override?: string;
        lighting_override?: string;
        camera_perspective_override?: string;
        detail_focus?: string;
        reference_asset_ids?: string[];
        user_instructions?: string;
        set_as_default?: boolean;
      }
    ) =>
      request<EnvironmentGenerationResult>(
        `/environments/${environmentId}/generate`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    generateVariation: (
      environmentId: string,
      payload: {
        variation_id?: string;
        name: string;
        variation_type?: string;
        description?: string;
        time_of_day_override?: string;
        weather_override?: string;
        lighting_override?: string;
        camera_perspective_override?: string;
        color_palette_override?: string[];
        custom_prompt?: string;
        user_instructions?: string;
        is_default?: boolean;
      }
    ) =>
      request<EnvironmentGenerationResult>(
        `/environments/${environmentId}/generate-variation`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    listVariations: (environmentId: string) =>
      request<EnvironmentVariationRecord[]>(
        `/environments/${environmentId}/variations`,
        { method: "GET" }
      ),

    createVariation: (
      environmentId: string,
      payload: {
        name: string;
        description?: string;
        variation_type?: string;
        asset_id?: string;
        is_default?: boolean;
      }
    ) =>
      request<EnvironmentVariationRecord>(
        `/environments/${environmentId}/variations`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    updateVariation: (
      variationId: string,
      payload: {
        name?: string;
        description?: string;
        variation_type?: string;
        asset_id?: string;
        is_default?: boolean;
      }
    ) =>
      request<EnvironmentVariationRecord>(
        `/environment-variations/${variationId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      ),

    deleteVariation: (variationId: string) =>
      request<void>(`/environment-variations/${variationId}`, {
        method: "DELETE",
      }),

    listAssets: (environmentId: string, assetType?: string) => {
      const qs = assetType ? `?asset_type=${encodeURIComponent(assetType)}` : "";
      return request<EnvironmentAssetRecord[]>(
        `/environments/${environmentId}/assets${qs}`,
        { method: "GET" }
      );
    },

    uploadAsset: (
      environmentId: string,
      file: File,
      options?: {
        asset_type?: string;
        label?: string;
        set_as_default?: boolean;
      }
    ) => {
      const formData = new FormData();
      formData.append("file", file);
      if (options?.asset_type) formData.append("asset_type", options.asset_type);
      if (options?.label) formData.append("label", options.label);
      if (options?.set_as_default) {
        formData.append("set_as_default", "true");
      }
      return request<EnvironmentAssetRecord>(
        `/environments/${environmentId}/assets/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
    },

    updateAsset: (
      assetId: string,
      payload: {
        asset_type?: string;
        label?: string;
        set_as_default?: boolean;
      }
    ) =>
      request<EnvironmentAssetRecord>(`/environment-assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    deleteAsset: (assetId: string) =>
      request<void>(`/environment-assets/${assetId}`, {
        method: "DELETE",
      }),

    listJobs: (environmentId: string) =>
      request<EnvironmentGenerationJobRecord[]>(
        `/environments/${environmentId}/jobs`,
        { method: "GET" }
      ),

    getJob: (jobId: string) =>
      request<EnvironmentGenerationJobRecord>(
        `/environment-generation-jobs/${jobId}`,
        { method: "GET" }
      ),

    syncToStory: (
      environmentId: string,
      payload: {
        story_id: string;
        scene_ids?: string[];
        character_ids?: string[];
      }
    ) =>
      request<EnvironmentRecord>(
        `/environments/${environmentId}/sync-to-story`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),

    importFromStory: (storyId: string) =>
      request<EnvironmentRecord[]>(
        `/environments/import-from-story/${storyId}`,
        { method: "POST" }
      ),
  },

  worlds: {
    list: (projectId?: string) => {
      const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      return request<WorldRecord[]>(`/worlds${qs}`, { method: "GET" });
    },

    get: (worldId: string) =>
      request<WorldRecord>(`/worlds/${worldId}`, { method: "GET" }),

    create: (payload: {
      project_id?: string;
      name: string;
      description?: string;
      lore_notes?: string;
      seed_sample_hierarchy?: boolean;
    }) =>
      request<WorldRecord>("/worlds", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (
      worldId: string,
      payload: {
        name?: string;
        description?: string;
        lore_notes?: string;
      }
    ) =>
      request<WorldRecord>(`/worlds/${worldId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (worldId: string) =>
      request<void>(`/worlds/${worldId}`, { method: "DELETE" }),

    createLocation: (
      worldId: string,
      payload: {
        parent_id?: string | null;
        environment_id?: string | null;
        name: string;
        location_type: string;
        description?: string;
        sort_order?: number;
      }
    ) =>
      request<WorldLocationRecord>(`/worlds/${worldId}/locations`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    updateLocation: (
      locationId: string,
      payload: {
        parent_id?: string | null;
        clear_parent?: boolean;
        environment_id?: string | null;
        clear_environment?: boolean;
        name?: string;
        location_type?: string;
        description?: string;
        sort_order?: number;
      }
    ) =>
      request<WorldLocationRecord>(`/world-locations/${locationId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    deleteLocation: (locationId: string) =>
      request<void>(`/world-locations/${locationId}`, { method: "DELETE" }),
  },

  render: {
    createJob: (projectId: string, payload: RenderJobCreatePayload) =>
      request<RenderJobRecord>(`/projects/${projectId}/render`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    listJobs: (projectId: string) =>
      request<RenderJobListResponse>(`/projects/${projectId}/render/jobs`),
    getJob: (jobId: string) =>
      request<RenderJobRecord>(`/render/jobs/${jobId}`),
    cancelJob: (jobId: string) =>
      request<RenderJobRecord>(`/render/jobs/${jobId}/cancel`, {
        method: "POST",
      }),
    retryJob: (jobId: string) =>
      request<RenderJobRecord>(`/render/jobs/${jobId}/retry`, {
        method: "POST",
      }),
    getJobOutput: (jobId: string) =>
      request<RenderOutputRecord>(`/render/jobs/${jobId}/output`),
  },

  exports: {
    list: (projectId: string) =>
      request<RenderOutputListResponse>(`/projects/${projectId}/exports`),
    get: (exportId: string) =>
      request<RenderOutputRecord>(`/exports/${exportId}`),
    delete: (exportId: string) =>
      request<void>(`/exports/${exportId}`, { method: "DELETE" }),
  },

  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return request<T>(endpoint, {
      method: "POST",
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  },
  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T = void>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
