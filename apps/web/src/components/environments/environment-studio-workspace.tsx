"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CloudRain,
  Columns,
  Copy,
  Download,
  Eye,
  FolderTree,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
  Users,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  ANIMATION_STYLES,
  ENVIRONMENT_CAMERA_PERSPECTIVES,
  ENVIRONMENT_CATEGORIES,
  ENVIRONMENT_LOCATION_PRESETS,
  ENVIRONMENT_TIME_SETTINGS,
  ENVIRONMENT_WEATHER_SETTINGS,
  WORLD_LOCATION_TYPES,
} from "@tr-studio/scene-schema";
import type {
  CharacterSummaryRecord,
  EnvironmentAssetRecord,
  EnvironmentGenerationType,
  EnvironmentRecord,
  EnvironmentSummaryRecord,
  EnvironmentVariationRecord,
  ImageProviderStatusResponse,
  StoryResponse,
  WorldLocationRecord,
  WorldRecord,
} from "@tr-studio/shared-types";
import { api, resolveMediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type EnvironmentStudioTab =
  | "overview"
  | "design"
  | "variations"
  | "assets"
  | "worlds";

const VARIATION_PRESETS = [
  {
    name: "Morning",
    variation_type: "time_of_day",
    time_of_day_override: "Morning",
    description: "Crisp early morning sunrise light and gentle mist.",
  },
  {
    name: "Sunset",
    variation_type: "time_of_day",
    time_of_day_override: "Sunset",
    description: "Dramatic golden-hour sunset with long warm shadows.",
  },
  {
    name: "Night",
    variation_type: "time_of_day",
    time_of_day_override: "Night",
    description: "Nocturnal moonlight and warm interior or street lights.",
  },
  {
    name: "Rain",
    variation_type: "weather",
    weather_override: "Rain",
    description: "Overcast rainy atmosphere with wet reflective ground surfaces.",
  },
  {
    name: "Snow",
    variation_type: "weather",
    weather_override: "Snow",
    description: "Winter snowfall blanketing roofs, trees, and ground.",
  },
  {
    name: "Destroyed version",
    variation_type: "condition",
    description: "Weathered, battle-damaged, crumbling ruins version of this location.",
  },
  {
    name: "Decorated version",
    variation_type: "condition",
    description: "Festive celebration banners, glowing lanterns, and floral decorations.",
  },
  {
    name: "Crowded version",
    variation_type: "crowd",
    description: "Bustling lively atmosphere filled with market activity and ambient life.",
  },
  {
    name: "Empty version",
    variation_type: "crowd",
    description: "Quiet, deserted, still background plate ready for character animation.",
  },
];

export function EnvironmentStudioWorkspace({
  environmentId,
  defaultTab = "overview",
}: {
  environmentId: string;
  defaultTab?: EnvironmentStudioTab;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGenError = searchParams.get("genError");

  const [activeTab, setActiveTab] = useState<EnvironmentStudioTab>(defaultTab);
  const [environment, setEnvironment] = useState<EnvironmentRecord | null>(null);
  const [libraryItems, setLibraryItems] = useState<EnvironmentSummaryRecord[]>(
    []
  );
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [characters, setCharacters] = useState<CharacterSummaryRecord[]>([]);
  const [linkedStory, setLinkedStory] = useState<StoryResponse | null>(null);
  const [providerStatus, setProviderStatus] =
    useState<ImageProviderStatusResponse | null>(null);

  // Left sidebar filter state
  const [libSearch, setLibSearch] = useState("");
  const [libCategory, setLibCategory] = useState("ALL");

  // Center Preview Canvas state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [fitToScreen, setFitToScreen] = useState<boolean>(true);
  const [compareAssetId, setCompareAssetId] = useState<string | null>(null);

  // Editable Environment State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Natural");
  const [locationType, setLocationType] = useState("Forests");
  const [artStyle, setArtStyle] = useState("Anime");
  const [visualMood, setVisualMood] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("Afternoon");
  const [weather, setWeather] = useState("Clear");
  const [cameraPerspective, setCameraPerspective] = useState(
    "Wide establishing shot"
  );
  const [architecture, setArchitecture] = useState("");
  const [terrain, setTerrain] = useState("");
  const [vegetation, setVegetation] = useState("");
  const [propsText, setPropsText] = useState("");
  const [lighting, setLighting] = useState("");
  const [atmosphere, setAtmosphere] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [newColorHex, setNewColorHex] = useState("#38BDF8");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>(
    []
  );

  // Right Panel Prompt & Generation State
  const [generationType, setGenerationType] =
    useState<EnvironmentGenerationType>("concept");
  const [detailFocus, setDetailFocus] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [promptPreview, setPromptPreview] = useState("");
  const [customPromptOverride, setCustomPromptOverride] = useState("");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  // New Variation Form State
  const [newVarName, setNewVarName] = useState("");
  const [newVarType, setNewVarType] = useState("time_of_day");
  const [newVarDesc, setNewVarDesc] = useState("");

  // World Management State
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldDesc, setNewWorldDesc] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<string>("city_or_village");
  const [newNodeParentId, setNewNodeParentId] = useState<string>("");
  const [linkCurrentEnvToNode, setLinkCurrentEnvToNode] = useState(true);

  // Asset Filter State
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("ALL");

  // Status, Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string | null>(
    null
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(
    initialGenError
  );

  // Native <dialog> refs for Compare/Inspect Modal and Delete Modal
  const inspectDialogRef = useRef<HTMLDialogElement | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null);
  const pointerDownTargetRef = useRef<EventTarget | null>(null);
  const [inspectedAsset, setInspectedAsset] =
    useState<EnvironmentAssetRecord | null>(null);

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const TABS: Array<{ id: EnvironmentStudioTab; label: string; href: string }> =
    [
      {
        id: "overview",
        label: "Overview",
        href: `/environments/${environmentId}`,
      },
      {
        id: "design",
        label: "Visual Designer",
        href: `/environments/${environmentId}/design`,
      },
      {
        id: "variations",
        label: "Variations",
        href: `/environments/${environmentId}/variations`,
      },
      {
        id: "assets",
        label: "Asset Gallery",
        href: `/environments/${environmentId}/assets`,
      },
      {
        id: "worlds",
        label: "World Hierarchy",
        href: `/environments/${environmentId}?tab=worlds`,
      },
    ];

  const hydrateFromRecord = useCallback((rec: EnvironmentRecord) => {
    setEnvironment(rec);
    setName(rec.name);
    setDescription(rec.description || "");
    setCategory(rec.category || "Natural");
    setLocationType(rec.metadata?.location_type || "Forests");
    setArtStyle(rec.art_style || "Anime");
    setVisualMood(rec.visual_mood || "");
    setTimeOfDay(rec.time_of_day || "Afternoon");
    setWeather(rec.weather || "Clear");
    setCameraPerspective(rec.camera_perspective || "Wide establishing shot");
    setArchitecture(rec.metadata?.architecture || "");
    setTerrain(rec.metadata?.terrain || "");
    setVegetation(rec.metadata?.vegetation || "");
    setPropsText(rec.metadata?.props || "");
    setLighting(rec.metadata?.lighting || "");
    setAtmosphere(rec.metadata?.atmosphere || "");
    setAdditionalInstructions(rec.metadata?.additional_instructions || "");
    setColorPalette(rec.color_palette || []);
    setTagsInput((rec.metadata?.tags || []).join(", "));
    setSelectedSceneIds(rec.metadata?.scene_ids || []);
    setSelectedCharacterIds(rec.metadata?.character_ids || []);

    if (rec.default_asset_id) {
      setSelectedAssetId(rec.default_asset_id);
    } else if (rec.assets.length > 0) {
      setSelectedAssetId(rec.assets[0].id);
    } else {
      setSelectedAssetId(null);
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [envRec, libRes, statusRes, worldRes, charRes] = await Promise.all([
        api.environments.get(environmentId),
        api.environments.list(),
        api.environments.getProviderStatus().catch(() => null),
        api.worlds.list().catch(() => []),
        api.characters.list().catch(() => []),
      ]);
      hydrateFromRecord(envRec);
      setLibraryItems(libRes);
      if (statusRes) setProviderStatus(statusRes);
      setWorlds(worldRes);
      if (worldRes.length > 0 && !selectedWorldId) {
        setSelectedWorldId(worldRes[0].id);
      }
      setCharacters(charRes);

      if (envRec.story_id) {
        const st = await api.stories.get(envRec.story_id).catch(() => null);
        setLinkedStory(st);
      } else if (envRec.project_id) {
        const st = await api.stories
          .getByProject(envRec.project_id)
          .catch(() => null);
        setLinkedStory(st);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : "Could not load environment workspace."
      );
    } finally {
      setIsLoading(false);
    }
  }, [environmentId, hydrateFromRecord, selectedWorldId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Live Prompt Preview update
  const refreshPromptPreview = useCallback(async () => {
    if (!environmentId) return;
    try {
      const res = await api.environments.previewPrompt(environmentId, {
        generation_type: generationType,
        art_style_override: artStyle,
        time_of_day_override: timeOfDay,
        weather_override: weather,
        lighting_override: lighting || undefined,
        camera_perspective_override: cameraPerspective,
        detail_focus: detailFocus || undefined,
        user_instructions: userInstructions || undefined,
      });
      setPromptPreview(res.prompt);
      if (!useCustomPrompt) {
        setCustomPromptOverride(res.prompt);
      }
    } catch {
      // ignore preview errors while typing
    }
  }, [
    environmentId,
    generationType,
    artStyle,
    timeOfDay,
    weather,
    lighting,
    cameraPerspective,
    detailFocus,
    userInstructions,
    useCustomPrompt,
  ]);

  useEffect(() => {
    if (!isLoading && environment) {
      refreshPromptPreview();
    }
  }, [isLoading, environment, refreshPromptPreview]);

  const handleSaveEnvironment = async () => {
    if (!environment) return;
    setIsSaving(true);
    setErrorBanner(null);
    setStatusAnnouncement("Saving environment changes...");
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await api.environments.update(environment.id, {
        name: name.trim() || environment.name,
        description,
        category,
        location_type: locationType,
        art_style: artStyle,
        visual_mood: visualMood,
        time_of_day: timeOfDay,
        weather,
        camera_perspective: cameraPerspective,
        architecture,
        terrain,
        vegetation,
        props: propsText,
        lighting,
        atmosphere,
        additional_instructions: additionalInstructions,
        color_palette: colorPalette,
        tags,
        scene_ids: selectedSceneIds,
        character_ids: selectedCharacterIds,
      });
      hydrateFromRecord(updated);
      const refreshedLib = await api.environments.list();
      setLibraryItems(refreshedLib);
      setStatusAnnouncement("Environment saved successfully.");
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to save environment."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateEnvironmentVisual = async (
    overrideType?:
      | "concept"
      | "landscape"
      | "interior"
      | "exterior"
      | "lighting_variation"
      | "weather_variation"
      | "camera_view"
      | "environment_detail"
  ) => {
    if (!environment) return;
    const targetType =
      overrideType ||
      (generationType === "variation" ? "concept" : generationType);

    setIsGenerating(true);
    setGenerationProgress(30);
    setErrorBanner(null);
    setStatusAnnouncement(
      `Generating ${targetType.replace(/_/g, " ")} with AI Image Provider...`
    );

    try {
      // Save latest properties first so prompt builder reflects edits
      await api.environments.update(environment.id, {
        name: name.trim() || environment.name,
        description,
        category,
        location_type: locationType,
        art_style: artStyle,
        visual_mood: visualMood,
        time_of_day: timeOfDay,
        weather,
        camera_perspective: cameraPerspective,
        architecture,
        terrain,
        vegetation,
        props: propsText,
        lighting,
        atmosphere,
        additional_instructions: additionalInstructions,
        color_palette: colorPalette,
      });

      setGenerationProgress(65);
      const res = await api.environments.generateImage(environment.id, {
        generation_type: targetType,
        custom_prompt: useCustomPrompt ? customPromptOverride : undefined,
        art_style_override: artStyle,
        time_of_day_override: timeOfDay,
        weather_override: weather,
        lighting_override: lighting || undefined,
        camera_perspective_override: cameraPerspective,
        detail_focus: detailFocus || undefined,
        user_instructions: userInstructions || undefined,
        set_as_default: !environment.default_asset_id,
      });

      setGenerationProgress(100);
      hydrateFromRecord(res.environment);
      if (res.generated_assets.length > 0) {
        setSelectedAssetId(res.generated_assets[0].id);
      }
      const refreshedLib = await api.environments.list();
      setLibraryItems(refreshedLib);
      setStatusAnnouncement(
        `Generated ${res.generated_assets.length} environment visual asset.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : "AI environment generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleGenerateVariation = async (preset: {
    id?: string;
    name: string;
    variation_type: string;
    description?: string | null;
    time_of_day_override?: string;
    weather_override?: string;
  }) => {
    if (!environment) return;
    setIsGenerating(true);
    setGenerationProgress(35);
    setErrorBanner(null);
    setStatusAnnouncement(
      `Generating non-destructive "${preset.name}" variation...`
    );

    try {
      const res = await api.environments.generateVariation(environment.id, {
        variation_id: preset.id,
        name: preset.name,
        variation_type: preset.variation_type,
        description: preset.description || undefined,
        time_of_day_override: preset.time_of_day_override,
        weather_override: preset.weather_override,
        user_instructions: userInstructions || undefined,
      });
      setGenerationProgress(100);
      hydrateFromRecord(res.environment);
      if (res.generated_assets.length > 0) {
        setSelectedAssetId(res.generated_assets[0].id);
      }
      setStatusAnnouncement(
        `Variation "${preset.name}" generated without overwriting canonical environment.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Variation generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleAddCustomVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!environment || !newVarName.trim()) return;
    setErrorBanner(null);
    try {
      await api.environments.createVariation(environment.id, {
        name: newVarName.trim(),
        variation_type: newVarType,
        description: newVarDesc.trim() || undefined,
      });
      const updated = await api.environments.get(environment.id);
      hydrateFromRecord(updated);
      setNewVarName("");
      setNewVarDesc("");
      setStatusAnnouncement("Added environment variation slot.");
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Could not add variation."
      );
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!environment) return;
    try {
      await api.environments.deleteVariation(variationId);
      const updated = await api.environments.get(environment.id);
      hydrateFromRecord(updated);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Could not delete variation."
      );
    }
  };

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !environment) return;
    setErrorBanner(null);
    setStatusAnnouncement(`Uploading ${file.name}...`);
    try {
      const uploaded = await api.environments.uploadAsset(
        environment.id,
        file,
        {
          asset_type: "reference_upload",
          label: `${environment.name} — ${file.name}`,
          set_as_default: !environment.default_asset_id,
        }
      );
      const updated = await api.environments.get(environment.id);
      hydrateFromRecord(updated);
      setSelectedAssetId(uploaded.id);
      setStatusAnnouncement(`Uploaded ${file.name} successfully.`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Image upload failed."
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleSetDefaultAsset = async (assetId: string) => {
    if (!environment) return;
    try {
      await api.environments.updateAsset(assetId, { set_as_default: true });
      const updated = await api.environments.get(environment.id);
      hydrateFromRecord(updated);
      setSelectedAssetId(assetId);
      setStatusAnnouncement("Updated default environment image.");
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to set default image."
      );
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!environment) return;
    try {
      await api.environments.deleteAsset(assetId);
      const updated = await api.environments.get(environment.id);
      hydrateFromRecord(updated);
      setStatusAnnouncement("Deleted environment asset.");
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to delete asset."
      );
    }
  };

  const handleDuplicateEnvironment = async () => {
    if (!environment) return;
    try {
      const copyEnv = await api.environments.duplicate(environment.id, {
        name: `${environment.name} (Copy)`,
      });
      router.push(`/environments/${copyEnv.id}`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to duplicate environment."
      );
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!environment) return;
    try {
      await api.environments.delete(environment.id);
      deleteDialogRef.current?.close();
      router.push("/environments");
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to delete environment."
      );
    }
  };

  const handleSyncToStory = async () => {
    if (!environment || !linkedStory) return;
    setIsSaving(true);
    setErrorBanner(null);
    try {
      const synced = await api.environments.syncToStory(environment.id, {
        story_id: linkedStory.id,
        scene_ids: selectedSceneIds,
        character_ids: selectedCharacterIds,
      });
      hydrateFromRecord(synced);
      const refreshedStory = await api.stories.get(linkedStory.id);
      setLinkedStory(refreshedStory);
      setStatusAnnouncement(
        `Synced "${environment.name}" with Story "${linkedStory.title}".`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to sync with Story."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorldName.trim() || !environment) return;
    try {
      const created = await api.worlds.create({
        project_id: environment.project_id,
        name: newWorldName.trim(),
        description: newWorldDesc.trim() || undefined,
        seed_sample_hierarchy: true,
      });
      const updatedWorlds = await api.worlds.list();
      setWorlds(updatedWorlds);
      setSelectedWorldId(created.id);
      setNewWorldName("");
      setNewWorldDesc("");
      setStatusAnnouncement(`Created World "${created.name}".`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to create World."
      );
    }
  };

  const handleCreateWorldLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorldId || !newNodeName.trim() || !environment) return;
    try {
      await api.worlds.createLocation(selectedWorldId, {
        parent_id: newNodeParentId || null,
        environment_id: linkCurrentEnvToNode ? environment.id : null,
        name: newNodeName.trim(),
        location_type: newNodeType,
        description: environment.description || undefined,
      });
      const updatedWorlds = await api.worlds.list();
      setWorlds(updatedWorlds);
      setNewNodeName("");
      setStatusAnnouncement("Added location node to World hierarchy.");
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to add World location."
      );
    }
  };

  // Keyboard roving tabindex for ARIA tablist
  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  // Dialog backdrop light-dismiss helper
  const handleDialogPointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    pointerDownTargetRef.current = e.target;
  };

  const handleDialogPointerUp = (
    e: React.PointerEvent<HTMLDialogElement>,
    dialogEl: HTMLDialogElement | null
  ) => {
    if (
      dialogEl &&
      pointerDownTargetRef.current === dialogEl &&
      e.target === dialogEl
    ) {
      dialogEl.close();
    }
    pointerDownTargetRef.current = null;
  };

  const filteredLibrary = libraryItems.filter((item) => {
    const matchesCategory =
      libCategory === "ALL" || item.category === libCategory;
    const q = libSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.location_type.toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const activeAsset: EnvironmentAssetRecord | null =
    environment?.assets.find((a) => a.id === selectedAssetId) ||
    environment?.assets[0] ||
    null;

  const compareAsset: EnvironmentAssetRecord | null =
    environment?.assets.find((a) => a.id === compareAssetId) || null;

  const filteredAssets =
    environment?.assets.filter(
      (a) => assetTypeFilter === "ALL" || a.asset_type === assetTypeFilter
    ) || [];

  const activeWorld = worlds.find((w) => w.id === selectedWorldId) || worlds[0];

  const renderWorldTree = (
    locations: WorldLocationRecord[],
    parentId: string | null = null
  ): React.ReactNode => {
    const children = locations.filter(
      (loc) => (loc.parent_id || null) === parentId
    );
    if (children.length === 0) return null;
    return (
      <ul className="space-y-1.5 pl-4 border-l border-zinc-800/80">
        {children.map((node) => {
          const subChildren = locations.filter((l) => l.parent_id === node.id);
          return (
            <li key={node.id} className="text-xs">
              <details open className="group rounded-xl bg-zinc-950/50 p-2">
                <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium text-zinc-200">
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {node.location_type.replace(/_/g, " ")}
                    </Badge>
                    <span>{node.name}</span>
                    {node.environment_id && (
                      <Link
                        href={`/environments/${node.environment_id}`}
                        className="text-[11px] text-violet-400 underline hover:text-violet-300"
                      >
                        Open Environment ({node.environment_name || "Linked"})
                      </Link>
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {subChildren.length} sub-locations
                  </span>
                </summary>
                {node.description && (
                  <p className="mt-1 pl-2 text-[11px] text-zinc-400">
                    {node.description}
                  </p>
                )}
                {renderWorldTree(locations, node.id)}
              </details>
            </li>
          );
        })}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!environment) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/40 p-8 text-center">
        <p className="text-sm text-zinc-300">Environment not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/environments">Back to Environment Library</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live Status & Error Announcements */}
      {statusAnnouncement && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-violet-400" />
            {statusAnnouncement}
          </span>
          <button
            type="button"
            onClick={() => setStatusAnnouncement(null)}
            className="text-zinc-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorBanner && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            {errorBanner}
          </span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-rose-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Column Studio Workspace Grid */}
      <div className="grid gap-5 xl:grid-cols-12">
        {/* LEFT PANEL: Environment Library, Categories, Search & Saved Environments */}
        <aside className="space-y-4 xl:col-span-3">
          <Card className="border-zinc-800/90 bg-zinc-900/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4 text-violet-400" />
                  Environment Library
                </CardTitle>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Link href="/environments/new">
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </Link>
                </Button>
              </div>
              <div className="relative pt-2">
                <Search className="pointer-events-none absolute left-3 top-4.5 h-3.5 w-3.5 text-zinc-500" />
                <Input
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Search saved environments..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1 pt-2">
                {["ALL", ...ENVIRONMENT_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setLibCategory(cat)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      libCategory === cat
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {filteredLibrary.map((item) => {
                const isCurrent = item.id === environment.id;
                return (
                  <Link
                    key={item.id}
                    href={`/environments/${item.id}`}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                      isCurrent
                        ? "border-violet-500 bg-violet-500/15"
                        : "border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700"
                    }`}
                  >
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                      {item.default_image_url ? (
                        <img
                          src={resolveMediaUrl(item.default_image_url)}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Globe className="h-5 w-5 text-zinc-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-zinc-100">
                        {item.name}
                      </p>
                      <p className="truncate text-[10px] text-zinc-400">
                        {item.category} • {item.location_type}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span>{item.time_of_day}</span>
                        <span>•</span>
                        <span>{item.weather}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* World Hierarchy Quick Summary Card */}
          <Card className="border-zinc-800/90 bg-zinc-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5 text-violet-400" />
                World Containers ({worlds.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {worlds.length === 0 ? (
                <p className="text-zinc-500">
                  No World hierarchy created yet. Open the World Hierarchy tab to organize kingdoms, cities, and rooms.
                </p>
              ) : (
                worlds.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setSelectedWorldId(w.id);
                      setActiveTab("worlds");
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left hover:border-violet-500/40"
                  >
                    <span className="font-medium text-zinc-200">{w.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {w.locations.length} nodes
                    </Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </aside>

        {/* CENTER PANEL: Large Environment Preview, Zoom/Fit Controls, Variations Strip & Studio Tabs */}
        <section className="space-y-4 xl:col-span-6">
          {/* Route Navigation Bar + Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={`/environments/${environment.id}`}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Overview
              </Link>
              <Link
                href={`/environments/${environment.id}/design`}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                /design
              </Link>
              <Link
                href={`/environments/${environment.id}/variations`}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                /variations
              </Link>
              <Link
                href={`/environments/${environment.id}/assets`}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                /assets
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDuplicateEnvironment}
                className="h-8 gap-1.5 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => deleteDialogRef.current?.showModal()}
                className="h-8 gap-1.5 text-xs text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEnvironment}
                disabled={isSaving}
                className="h-8 gap-1.5 text-xs"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

          {/* Large Environment Preview Canvas with Zoom & Fit-to-Screen Controls */}
          <Card className="overflow-hidden border-zinc-800/90 bg-zinc-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-violet-600/20 text-violet-300 border-violet-500/30">
                  {environment.category}
                </Badge>
                <span className="text-xs font-semibold text-white">
                  {environment.name}
                </span>
                <span className="text-xs text-zinc-400">
                  ({environment.time_of_day} • {environment.weather} •{" "}
                  {environment.camera_perspective})
                </span>
              </div>

              {/* Zoom, Fit-to-Screen & Compare Toolbar */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setFitToScreen(false);
                    setZoomScale((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
                  }}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-[44px] text-center text-[11px] text-zinc-300">
                  {fitToScreen ? "Fit" : `${Math.round(zoomScale * 100)}%`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setFitToScreen(false);
                    setZoomScale((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
                  }}
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setFitToScreen((f) => !f);
                    setZoomScale(1);
                  }}
                  title="Toggle Fit to Screen"
                >
                  {fitToScreen ? (
                    <Maximize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5" />
                  )}
                </Button>

                {activeAsset && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setInspectedAsset(activeAsset);
                        inspectDialogRef.current?.showModal();
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Inspect
                    </Button>
                    <a
                      href={resolveMediaUrl(activeAsset.download_url)}
                      download
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 hover:bg-zinc-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </>
                )}

                <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/15 px-2.5 text-xs font-medium text-violet-200 hover:bg-violet-500/25">
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleUploadAsset}
                  />
                </label>
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="relative flex min-h-[340px] items-center justify-center overflow-auto bg-[#050508] p-4">
              {activeAsset ? (
                <div
                  className={`grid gap-4 w-full ${
                    compareAsset ? "grid-cols-2" : "grid-cols-1"
                  } items-center justify-items-center`}
                >
                  <div className="space-y-1.5 text-center">
                    <img
                      src={resolveMediaUrl(activeAsset.url)}
                      alt={environment.name}
                      style={
                        fitToScreen
                          ? { maxHeight: "380px", width: "auto" }
                          : {
                              transform: `scale(${zoomScale})`,
                              transformOrigin: "center center",
                            }
                      }
                      className="rounded-xl border border-zinc-800 object-contain shadow-2xl transition-transform"
                    />
                    <p className="text-[11px] text-zinc-400">
                      Primary View:{" "}
                      {String(
                        activeAsset.metadata?.label || activeAsset.asset_type
                      )}
                    </p>
                  </div>

                  {compareAsset && (
                    <div className="space-y-1.5 text-center">
                      <img
                        src={resolveMediaUrl(compareAsset.url)}
                        alt="Comparison Variation"
                        style={{ maxHeight: "380px", width: "auto" }}
                        className="rounded-xl border border-violet-500/40 object-contain shadow-2xl"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-[11px] text-violet-300">
                          Comparison:{" "}
                          {String(
                            compareAsset.metadata?.label ||
                              compareAsset.asset_type
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCompareAssetId(null)}
                          className="text-[10px] text-zinc-400 underline hover:text-white"
                        >
                          Close Split View
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Globe className="mb-3 h-12 w-12 text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-300">
                    No visual artwork generated or uploaded yet
                  </p>
                  <p className="mt-1 max-w-md text-xs text-zinc-500">
                    Use the AI Generation Controls on the right to synthesize an environment concept, wide landscape, interior, or exterior—or upload your own artwork.
                  </p>
                </div>
              )}
            </div>

            {/* Thumbnail Strip of Assets & Variations */}
            {environment.assets.length > 0 && (
              <div className="flex items-center gap-2.5 overflow-x-auto border-t border-zinc-800/80 bg-zinc-950/80 px-4 py-2.5">
                {environment.assets.map((asset) => {
                  const isSelected = activeAsset?.id === asset.id;
                  return (
                    <div
                      key={asset.id}
                      className={`group relative shrink-0 rounded-lg border p-1 transition-all ${
                        isSelected
                          ? "border-violet-500 bg-violet-500/15"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className="block h-14 w-24 overflow-hidden rounded"
                      >
                        <img
                          src={resolveMediaUrl(asset.url)}
                          alt={asset.asset_type}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <div className="mt-1 flex items-center justify-between gap-1 px-0.5 text-[10px]">
                        <span className="truncate max-w-[60px] text-zinc-300">
                          {asset.asset_type}
                        </span>
                        {!isSelected && (
                          <button
                            type="button"
                            onClick={() => setCompareAssetId(asset.id)}
                            className="text-violet-400 hover:underline"
                            title="Compare side-by-side"
                          >
                            Compare
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Single-Row Accessible ARIA Tablist */}
          <div
            role="tablist"
            aria-label="Environment Studio Workspace Views"
            aria-orientation="horizontal"
            className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-1.5"
          >
            {TABS.map((t, idx) => {
              const selected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  id={`env-tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`env-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(t.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    selected
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB PANEL 1: OVERVIEW & ARCHITECTURAL DETAILS */}
          <div
            id="env-panel-overview"
            role="tabpanel"
            aria-labelledby="env-tab-overview"
            hidden={activeTab !== "overview"}
            className="space-y-4"
          >
            <Card className="border-zinc-800/90 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm">
                  Environment Specifications & Architectural Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Edit the canonical environment attributes, architecture, terrain, flora, and set dressing props.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Environment Name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Category & Location Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={category}
                        onChange={(e) => {
                          const nextCat = e.target.value;
                          setCategory(nextCat);
                          const presets =
                            ENVIRONMENT_LOCATION_PRESETS[nextCat] || ["Custom"];
                          setLocationType(presets[0] || "Custom");
                        }}
                        className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                      >
                        {ENVIRONMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={locationType}
                        onChange={(e) => setLocationType(e.target.value)}
                        className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                      >
                        {(
                          ENVIRONMENT_LOCATION_PRESETS[category] || ["Custom"]
                        ).map((lt) => (
                          <option key={lt} value={lt}>
                            {lt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">
                    Canonical Environment Description
                  </label>
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Architecture & Structures
                    </label>
                    <Input
                      value={architecture}
                      onChange={(e) => setArchitecture(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Terrain & Ground
                    </label>
                    <Input
                      value={terrain}
                      onChange={(e) => setTerrain(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Vegetation & Flora
                    </label>
                    <Input
                      value={vegetation}
                      onChange={(e) => setVegetation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Set Props & Objects
                    </label>
                    <Input
                      value={propsText}
                      onChange={(e) => setPropsText(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">
                    Tags (comma-separated)
                  </label>
                  <Input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Story, Scene & Character Planning Workflow */}
            <Card className="border-zinc-800/90 bg-zinc-900/40">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-violet-400" />
                      Story, Scene & Character Staging Integration
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Assign this environment to scenes and stage existing characters in this environment.
                    </CardDescription>
                  </div>
                  {linkedStory && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSyncToStory}
                      disabled={isSaving}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync to Story ({linkedStory.title})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {linkedStory && linkedStory.document.scenes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-300">
                      Linked Story Scenes:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {linkedStory.document.scenes.map((sc) => {
                        const active = selectedSceneIds.includes(sc.id);
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() =>
                              setSelectedSceneIds((prev) =>
                                prev.includes(sc.id)
                                  ? prev.filter((id) => id !== sc.id)
                                  : [...prev, sc.id]
                              )
                            }
                            className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                              active
                                ? "border-violet-500 bg-violet-500/20 text-white"
                                : "border-zinc-800 bg-zinc-950 text-zinc-400"
                            }`}
                          >
                            Scene {sc.scene_number}: {sc.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {characters.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-300">
                      Characters Staged in This Environment:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {characters.map((ch) => {
                        const active = selectedCharacterIds.includes(ch.id);
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() =>
                              setSelectedCharacterIds((prev) =>
                                prev.includes(ch.id)
                                  ? prev.filter((id) => id !== ch.id)
                                  : [...prev, ch.id]
                              )
                            }
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                              active
                                ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                                : "border-zinc-800 bg-zinc-950 text-zinc-400"
                            }`}
                          >
                            <span>{ch.name}</span>
                            <span className="text-[10px] opacity-75">
                              ({ch.role})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TAB PANEL 2: VISUAL DESIGNER */}
          <div
            id="env-panel-design"
            role="tabpanel"
            aria-labelledby="env-tab-design"
            hidden={activeTab !== "design"}
            className="space-y-4"
          >
            <Card className="border-zinc-800/90 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-violet-400" />
                  AI Environment Visual Designer Suite
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate specialized shots for this environment—Concepts, Wide Landscapes, Interiors, Exteriors, Lighting/Weather Variations, Camera Views, and Close-Up Detail Plates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4">
                  {(
                    [
                      {
                        type: "concept",
                        label: "Concept Art",
                        desc: "Master establishing concept",
                      },
                      {
                        type: "landscape",
                        label: "Landscape Plate",
                        desc: "Panoramic vista background",
                      },
                      {
                        type: "interior",
                        label: "Interior View",
                        desc: "Room & architectural interior",
                      },
                      {
                        type: "exterior",
                        label: "Exterior View",
                        desc: "Facade & outdoor surroundings",
                      },
                      {
                        type: "lighting_variation",
                        label: "Lighting Study",
                        desc: "Cinematic light & shadow pass",
                      },
                      {
                        type: "weather_variation",
                        label: "Weather Pass",
                        desc: "Atmospheric weather render",
                      },
                      {
                        type: "camera_view",
                        label: "Camera Angle",
                        desc: "Framed for current camera shot",
                      },
                      {
                        type: "environment_detail",
                        label: "Detail Close-Up",
                        desc: "Props, textures & focal detail",
                      },
                    ] as const
                  ).map((shot) => (
                    <button
                      key={shot.type}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => {
                        setGenerationType(shot.type);
                        handleGenerateEnvironmentVisual(shot.type);
                      }}
                      className="flex flex-col items-start rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-left transition-all hover:border-violet-500/50 hover:bg-violet-500/10 disabled:opacity-50"
                    >
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        {shot.label}
                      </span>
                      <span className="mt-1 text-[11px] text-zinc-400">
                        {shot.desc}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Lighting Direction
                    </label>
                    <Input
                      value={lighting}
                      onChange={(e) => setLighting(e.target.value)}
                      placeholder="e.g., Dramatic golden rim light, bioluminescent glow"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Atmosphere & Depth Haze
                    </label>
                    <Input
                      value={atmosphere}
                      onChange={(e) => setAtmosphere(e.target.value)}
                      placeholder="e.g., Volumetric morning fog, floating dust motes"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TAB PANEL 3: ENVIRONMENT VARIATIONS */}
          <div
            id="env-panel-variations"
            role="tabpanel"
            aria-labelledby="env-tab-variations"
            hidden={activeTab !== "variations"}
            className="space-y-4"
          >
            <Card className="border-zinc-800/90 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  Non-Destructive Environment Variations
                </CardTitle>
                <CardDescription className="text-xs">
                  Create and generate Morning, Sunset, Night, Rain, Snow, Destroyed, Decorated, Crowded, or Empty versions of this location without overwriting the original environment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quick Preset Variation Buttons */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-zinc-300">
                    One-Click Standard Variations:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {VARIATION_PRESETS.map((vp) => (
                      <Button
                        key={vp.name}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isGenerating}
                        onClick={() => handleGenerateVariation(vp)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Wand2 className="h-3 w-3 text-violet-400" />
                        {vp.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Saved Variations Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {environment.variations.map((v: EnvironmentVariationRecord) => (
                    <div
                      key={v.id}
                      className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
                    >
                      <div className="space-y-2">
                        <div className="h-32 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                          {v.image_url ? (
                            <img
                              src={resolveMediaUrl(v.image_url)}
                              alt={v.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-zinc-500">
                              No image generated yet
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">
                            {v.name}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {v.variation_type}
                          </Badge>
                        </div>
                        {v.description && (
                          <p className="text-[11px] text-zinc-400">
                            {v.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isGenerating}
                          onClick={() =>
                            handleGenerateVariation({
                              id: v.id,
                              name: v.name,
                              variation_type: v.variation_type,
                              description: v.description,
                            })
                          }
                          className="h-7 text-xs gap-1"
                        >
                          <Sparkles className="h-3 w-3 text-violet-400" />
                          {v.asset_id ? "Regenerate" : "Generate"}
                        </Button>
                        <div className="flex items-center gap-1">
                          {v.asset_id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setCompareAssetId(v.asset_id!)}
                              className="h-7 px-2 text-xs"
                            >
                              <Columns className="h-3 w-3" />
                              Compare
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteVariation(v.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400"
                            aria-label={`Delete variation ${v.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Variation Slot */}
                <form
                  onSubmit={handleAddCustomVariation}
                  className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 md:grid-cols-4"
                >
                  <Input
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    placeholder="Variation name (e.g., Festival Night)"
                    className="h-9 text-xs"
                  />
                  <select
                    value={newVarType}
                    onChange={(e) => setNewVarType(e.target.value)}
                    className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                  >
                    <option value="time_of_day">Time of Day</option>
                    <option value="weather">Weather</option>
                    <option value="condition">Condition (Destroyed/Decorated)</option>
                    <option value="crowd">Crowd State (Crowded/Empty)</option>
                    <option value="camera">Camera Framing</option>
                  </select>
                  <Input
                    value={newVarDesc}
                    onChange={(e) => setNewVarDesc(e.target.value)}
                    placeholder="Description..."
                    className="h-9 text-xs"
                  />
                  <Button type="submit" size="sm" variant="outline" className="h-9 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Add Variation Slot
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* TAB PANEL 4: ASSET GALLERY */}
          <div
            id="env-panel-assets"
            role="tabpanel"
            aria-labelledby="env-tab-assets"
            hidden={activeTab !== "assets"}
            className="space-y-4"
          >
            <Card className="border-zinc-800/90 bg-zinc-900/40">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-violet-400" />
                      Environment Asset Gallery ({environment.assets.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manage all generated and uploaded environment plates, inspect prompt metadata, or set default image.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={assetTypeFilter}
                      onChange={(e) => setAssetTypeFilter(e.target.value)}
                      className="h-8 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-200"
                    >
                      <option value="ALL">All Asset Types</option>
                      <option value="concept">Concept</option>
                      <option value="landscape">Landscape</option>
                      <option value="interior">Interior</option>
                      <option value="exterior">Exterior</option>
                      <option value="variation">Variation</option>
                      <option value="reference_upload">Uploaded Reference</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAssets.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500">
                    No assets match the selected filter.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {filteredAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70"
                      >
                        <div className="relative h-40 w-full bg-zinc-900">
                          <img
                            src={resolveMediaUrl(asset.url)}
                            alt={asset.asset_type}
                            className="h-full w-full object-cover"
                          />
                          {asset.is_default && (
                            <Badge className="absolute left-2 top-2 bg-emerald-600 text-white text-[10px]">
                              Default Image
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-100 truncate">
                              {String(
                                asset.metadata?.label || asset.asset_type
                              )}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {asset.asset_type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {!asset.is_default && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetDefaultAsset(asset.id)}
                                className="h-7 px-2 text-[11px]"
                              >
                                <Star className="h-3 w-3 text-amber-400" />
                                Set Default
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInspectedAsset(asset);
                                inspectDialogRef.current?.showModal();
                              }}
                              className="h-7 px-2 text-[11px]"
                            >
                              <Eye className="h-3 w-3" />
                              Details
                            </Button>
                            <a
                              href={resolveMediaUrl(asset.download_url)}
                              download
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-200 hover:bg-zinc-800"
                            >
                              <Download className="h-3 w-3" />
                              Save
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="ml-auto p-1 text-zinc-500 hover:text-rose-400"
                              aria-label="Delete asset"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TAB PANEL 5: WORLD HIERARCHY MANAGER */}
          <div
            id="env-panel-worlds"
            role="tabpanel"
            aria-labelledby="env-tab-worlds"
            hidden={activeTab !== "worlds"}
            className="space-y-4"
          >
            <Card className="border-zinc-800/90 bg-zinc-900/40">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-violet-400" />
                  Hierarchical World Library (World → Kingdom/Country → City/Village → Building → Room)
                </CardTitle>
                <CardDescription className="text-xs">
                  Organize multiple story locations and environments inside reusable hierarchical worlds.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Create New World Container */}
                <form
                  onSubmit={handleCreateWorld}
                  className="grid gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 md:grid-cols-3"
                >
                  <Input
                    value={newWorldName}
                    onChange={(e) => setNewWorldName(e.target.value)}
                    placeholder="New World Name (e.g., Aethelgard Realm)"
                    className="h-9 text-xs"
                  />
                  <Input
                    value={newWorldDesc}
                    onChange={(e) => setNewWorldDesc(e.target.value)}
                    placeholder="World lore description..."
                    className="h-9 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-9 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Create World Container
                  </Button>
                </form>

                {activeWorld && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={activeWorld.id}
                        onChange={(e) => setSelectedWorldId(e.target.value)}
                        className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-white"
                      >
                        {worlds.map((w) => (
                          <option key={w.id} value={w.id}>
                            World: {w.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-zinc-400">
                        {activeWorld.description}
                      </span>
                    </div>

                    {/* Add Location Node to Active World */}
                    <form
                      onSubmit={handleCreateWorldLocation}
                      className="grid gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 md:grid-cols-4"
                    >
                      <Input
                        value={newNodeName}
                        onChange={(e) => setNewNodeName(e.target.value)}
                        placeholder="Location node name..."
                        className="h-9 text-xs"
                      />
                      <select
                        value={newNodeType}
                        onChange={(e) => setNewNodeType(e.target.value)}
                        className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                      >
                        {WORLD_LOCATION_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newNodeParentId}
                        onChange={(e) => setNewNodeParentId(e.target.value)}
                        className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                      >
                        <option value="">Top-Level in World</option>
                        {activeWorld.locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            Inside: {loc.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="outline" className="h-9 text-xs">
                        <Plus className="h-3.5 w-3.5" />
                        Add Node
                      </Button>
                      <label className="md:col-span-4 flex items-center gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={linkCurrentEnvToNode}
                          onChange={(e) =>
                            setLinkCurrentEnvToNode(e.target.checked)
                          }
                        />
                        Link current environment ({environment.name}) to this new World node
                      </label>
                    </form>

                    {/* Hierarchical Disclosure Tree */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                      {activeWorld.locations.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          No locations added to this World yet.
                        </p>
                      ) : (
                        renderWorldTree(activeWorld.locations, null)
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* RIGHT PANEL: Environment Properties, Lighting, Weather, Time, Camera, Prompt Builder & AI Generation Controls */}
        <aside className="space-y-4 xl:col-span-3">
          {/* Quick Properties Inspector */}
          <Card className="border-zinc-800/90 bg-zinc-900/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="h-4 w-4 text-violet-400" />
                Environment Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Art Style</label>
                <select
                  value={artStyle}
                  onChange={(e) => setArtStyle(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                >
                  {ANIMATION_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300 flex items-center gap-1">
                    <Sun className="h-3 w-3 text-amber-400" />
                    Time of Day
                  </label>
                  <select
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="flex h-9 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                  >
                    {ENVIRONMENT_TIME_SETTINGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-zinc-300 flex items-center gap-1">
                    <CloudRain className="h-3 w-3 text-sky-400" />
                    Weather
                  </label>
                  <select
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    className="flex h-9 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-100"
                  >
                    {ENVIRONMENT_WEATHER_SETTINGS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300 flex items-center gap-1">
                  <Camera className="h-3 w-3 text-violet-400" />
                  Camera Perspective
                </label>
                <select
                  value={cameraPerspective}
                  onChange={(e) => setCameraPerspective(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                >
                  {ENVIRONMENT_CAMERA_PERSPECTIVES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">Visual Mood</label>
                <Input
                  value={visualMood}
                  onChange={(e) => setVisualMood(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Color Palette Swatches */}
              <div className="space-y-1.5 pt-1">
                <span className="font-medium text-zinc-300">Color Palette</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {colorPalette.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        setColorPalette(colorPalette.filter((c) => c !== hex))
                      }
                      className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300"
                      title="Click to remove swatch"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: hex }}
                      />
                      {hex}
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="h-6 w-7 cursor-pointer rounded border border-zinc-700 bg-zinc-950"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        if (!colorPalette.includes(newColorHex)) {
                          setColorPalette([...colorPalette, newColorHex]);
                        }
                      }}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Generation Controls & Live Environment Prompt Builder */}
          <Card className="border-zinc-800/90 bg-zinc-900/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                AI Environment Generator
              </CardTitle>
              <CardDescription className="text-[11px]">
                {providerStatus?.configured
                  ? `Provider: ${providerStatus.provider} (${providerStatus.model})`
                  : "Provider API key not configured — returns honest 503 if invoked."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-zinc-300">
                  Generation Mode
                </label>
                <select
                  value={generationType}
                  onChange={(e) =>
                    setGenerationType(
                      e.target.value as EnvironmentGenerationType
                    )
                  }
                  className="flex h-9 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                >
                  <option value="concept">Environment Concept</option>
                  <option value="landscape">Wide Landscape Background</option>
                  <option value="interior">Interior Background</option>
                  <option value="exterior">Exterior Background</option>
                  <option value="lighting_variation">Lighting Variation</option>
                  <option value="weather_variation">Weather Variation</option>
                  <option value="camera_view">Camera View Framing</option>
                  <option value="environment_detail">
                    Environment Detail Close-Up
                  </option>
                </select>
              </div>

              {generationType === "environment_detail" && (
                <div className="space-y-1">
                  <label className="font-medium text-zinc-300">
                    Detail Focus Object / Area
                  </label>
                  <Input
                    value={detailFocus}
                    onChange={(e) => setDetailFocus(e.target.value)}
                    placeholder="e.g., Ancient rune altar, holographic ramen counter"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-zinc-300">
                  Extra Shot Instructions
                </label>
                <Input
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  placeholder="Optional framing or lighting notes..."
                  className="h-8 text-xs"
                />
              </div>

              {/* Structured Prompt Preview & Override */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-300">
                    Environment Prompt Builder
                  </span>
                  <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={useCustomPrompt}
                      onChange={(e) => setUseCustomPrompt(e.target.checked)}
                    />
                    Override
                  </label>
                </div>
                <Textarea
                  rows={5}
                  value={useCustomPrompt ? customPromptOverride : promptPreview}
                  onChange={(e) => {
                    setUseCustomPrompt(true);
                    setCustomPromptOverride(e.target.value);
                  }}
                  className="font-mono text-[11px] leading-relaxed"
                />
              </div>

              {isGenerating && (
                <div className="space-y-1.5">
                  <progress
                    max={100}
                    value={generationProgress}
                    aria-label="AI environment image generation progress"
                    className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-zinc-900 [&::-webkit-progress-value]:bg-violet-500"
                  />
                  <p className="text-[11px] text-violet-300">
                    Synthesizing artwork...
                  </p>
                </div>
              )}

              <Button
                type="button"
                disabled={isGenerating}
                onClick={() => handleGenerateEnvironmentVisual()}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate Environment Art
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Native <dialog> 1: Asset Inspection Modal */}
      <dialog
        ref={inspectDialogRef}
        closedby="any"
        aria-labelledby="inspect-asset-dialog-title"
        onPointerDown={handleDialogPointerDown}
        onPointerUp={(e) => handleDialogPointerUp(e, inspectDialogRef.current)}
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/75"
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2
              id="inspect-asset-dialog-title"
              className="text-base font-semibold text-white"
            >
              Environment Asset Details
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inspectDialogRef.current?.close()}
            >
              Close
            </Button>
          </div>
          {inspectedAsset && (
            <div className="space-y-4 text-xs">
              <div className="max-h-80 overflow-hidden rounded-xl border border-zinc-800 bg-black flex justify-center">
                <img
                  src={resolveMediaUrl(inspectedAsset.url)}
                  alt={inspectedAsset.asset_type}
                  className="max-h-80 object-contain"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                <div>
                  <span className="text-zinc-500">Asset Type:</span>{" "}
                  <span className="font-medium text-white">
                    {inspectedAsset.asset_type}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Provider:</span>{" "}
                  <span className="font-medium text-white">
                    {inspectedAsset.provider || "upload"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Dimensions:</span>{" "}
                  <span className="font-medium text-white">
                    {String(inspectedAsset.metadata?.width || "—")} ×{" "}
                    {String(inspectedAsset.metadata?.height || "—")} px
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Status:</span>{" "}
                  <span className="font-medium text-emerald-400">
                    {inspectedAsset.generation_status}
                  </span>
                </div>
              </div>
              {inspectedAsset.prompt && (
                <div className="space-y-1">
                  <span className="font-medium text-zinc-400">
                    Prompt Used:
                  </span>
                  <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-[11px] text-zinc-300">
                    {inspectedAsset.prompt}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </dialog>

      {/* Native <dialog> 2: Delete Confirmation Modal */}
      <dialog
        ref={deleteDialogRef}
        closedby="any"
        aria-labelledby="delete-env-dialog-title"
        onPointerDown={handleDialogPointerDown}
        onPointerUp={(e) => handleDialogPointerUp(e, deleteDialogRef.current)}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/75"
      >
        <div className="space-y-4 p-6">
          <h2
            id="delete-env-dialog-title"
            className="text-base font-semibold text-white"
          >
            Delete Environment &ldquo;{environment.name}&rdquo;?
          </h2>
          <p className="text-xs text-zinc-400">
            This will permanently delete this environment, its variations, and its stored background assets. Any linked World location nodes will remain intact.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => deleteDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteEnvironment}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
