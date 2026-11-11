"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  CloudRain,
  Compass,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Palette,
  Plus,
  Sparkles,
  Sun,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  ANIMATION_STYLES,
  ENVIRONMENT_CAMERA_PERSPECTIVES,
  ENVIRONMENT_CATEGORIES,
  ENVIRONMENT_LOCATION_PRESETS,
  ENVIRONMENT_TIME_SETTINGS,
  ENVIRONMENT_WEATHER_SETTINGS,
} from "@tr-studio/scene-schema";
import type {
  CharacterSummaryRecord,
  EnvironmentCreatePayload,
  ImageProviderStatusResponse,
  Project,
  StoryResponse,
  WorldRecord,
} from "@tr-studio/shared-types";
import { api } from "@/lib/api";
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

type CreationMode = "manual" | "ai_assisted" | "reference_upload";

const QUICK_ENVIRONMENT_BLUEPRINTS = [
  {
    name: "Whispering Lumina Forest",
    category: "Fantasy",
    location_type: "Magical forests",
    art_style: "Anime",
    visual_mood: "Mystical, serene, bioluminescent wonder",
    time_of_day: "Night",
    weather: "Fog",
    camera_perspective: "Wide establishing shot",
    description:
      "An ancient bioluminescent forest where giant crystalline willow trees arch over a glowing silver stream and stone shrines.",
    architecture: "Moss-covered elven stone shrines and carved wooden bridges",
    terrain: "Winding mossy paths, stepping stones, and crystal-clear riverbanks",
    vegetation: "Giant glowing cyan willow trees, floating spore ferns, and starlight orchids",
    props: "Carved rune lanterns, ancient stone altar, wooden boat moored at the bank",
    lighting: "Soft cyan and violet bioluminescence with silver moonlight rays",
    atmosphere: "Gentle luminous mist drifting above the water surface",
    color_palette: ["#0B132B", "#1C2541", "#3A86FF", "#00F5D4", "#9B5DE5"],
    tags: ["fantasy", "forest", "bioluminescent", "magic"],
  },
  {
    name: "Neo-Shinjuku Skywalk Sector 7",
    category: "Science-Fiction",
    location_type: "Cyberpunk streets",
    art_style: "Anime",
    visual_mood: "High-energy neon nocturnal metropolis",
    time_of_day: "Midnight",
    weather: "Rain",
    camera_perspective: "Wide establishing shot",
    description:
      "Multi-level cyberpunk street intersection beneath elevated mag-lev rail tracks, glowing with holographic billboards and rain-slicked asphalt.",
    architecture: "Brutalist megastructures layered with glass skybridges and neon signage",
    terrain: "Wet reflective asphalt pavement, metal drainage grates, elevated walkways",
    vegetation: "Hanging rooftop hydroponic ivy pods",
    props: "Ramen stall with steam vents, vending machines, parked hover-couriers",
    lighting: "High-contrast magenta, electric cyan, and warm amber streetlamp reflections",
    atmosphere: "Fine neon-lit drizzle with steam rising from street vents",
    color_palette: ["#090A10", "#FF007F", "#00F0FF", "#FFB703", "#2B2D42"],
    tags: ["sci-fi", "cyberpunk", "city", "rain"],
  },
  {
    name: "Sakura Hill High School Rooftop",
    category: "Human",
    location_type: "Schools",
    art_style: "Anime",
    visual_mood: "Nostalgic golden-hour warmth",
    time_of_day: "Sunset",
    weather: "Wind",
    camera_perspective: "Medium shot",
    description:
      "A classic school rooftop overlooking a coastal town and distant mountains, framed by chain-link fencing and drifting cherry blossom petals.",
    architecture: "Concrete school rooftop with stairwell bulkhead and safety fence",
    terrain: "Weathered concrete rooftop tiles",
    vegetation: "Cherry blossom tree branches visible beyond the fence",
    props: "Wooden benches, vending machine by the door, water tank tower",
    lighting: "Warm golden-hour sunset casting long dramatic purple shadows",
    atmosphere: "Breezy spring evening with drifting pink sakura petals",
    color_palette: ["#FF758F", "#FF9E00", "#5A189A", "#F8EDEB", "#2EC4B6"],
    tags: ["school", "sunset", "slice-of-life", "rooftop"],
  },
];

export function EnvironmentCreationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStoryId = searchParams.get("storyId") || "";
  const preselectedProjectId = searchParams.get("projectId") || "";
  const preselectedWorldId = searchParams.get("worldId") || "";

  const [mode, setMode] = useState<CreationMode>("manual");
  const [providerStatus, setProviderStatus] =
    useState<ImageProviderStatusResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [characters, setCharacters] = useState<CharacterSummaryRecord[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryResponse | null>(null);

  // Core Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Natural");
  const [locationType, setLocationType] = useState<string>("Forests");
  const [customLocationType, setCustomLocationType] = useState<string>("");
  const [projectId, setProjectId] = useState<string>(preselectedProjectId);
  const [storyId, setStoryId] = useState<string>(preselectedStoryId);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [worldId, setWorldId] = useState<string>(preselectedWorldId);
  const [worldParentLocationId, setWorldParentLocationId] = useState<string>("");

  // Visual Details
  const [artStyle, setArtStyle] = useState<string>("Anime");
  const [customArtStyle, setCustomArtStyle] = useState<string>("");
  const [visualMood, setVisualMood] = useState<string>(
    "Atmospheric and cinematic"
  );
  const [timeOfDay, setTimeOfDay] = useState<string>("Afternoon");
  const [customTimeOfDay, setCustomTimeOfDay] = useState<string>("");
  const [weather, setWeather] = useState<string>("Clear");
  const [customWeather, setCustomWeather] = useState<string>("");
  const [cameraPerspective, setCameraPerspective] = useState<string>(
    "Wide establishing shot"
  );
  const [customCameraPerspective, setCustomCameraPerspective] =
    useState<string>("");

  const [architecture, setArchitecture] = useState<string>("");
  const [terrain, setTerrain] = useState<string>("");
  const [vegetation, setVegetation] = useState<string>("");
  const [propsText, setPropsText] = useState<string>("");
  const [lighting, setLighting] = useState<string>("");
  const [atmosphere, setAtmosphere] = useState<string>("");
  const [additionalInstructions, setAdditionalInstructions] =
    useState<string>("");

  const [colorPalette, setColorPalette] = useState<string[]>([
    "#1E293B",
    "#38BDF8",
    "#A855F7",
    "#F59E0B",
  ]);
  const [newColorHex, setNewColorHex] = useState<string>("#10B981");
  const [tagsInput, setTagsInput] = useState<string>("anime, background, wide");

  // AI / Upload options
  const [initialGenerationType, setInitialGenerationType] = useState<
    "concept" | "landscape" | "interior" | "exterior"
  >("concept");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      try {
        const [statusRes, projRes, worldRes, charRes] = await Promise.all([
          api.environments.getProviderStatus().catch(() => null),
          api.projects.list().catch(() => []),
          api.worlds.list().catch(() => []),
          api.characters.list().catch(() => []),
        ]);
        if (!active) return;
        if (statusRes) setProviderStatus(statusRes);
        setProjects(projRes);
        setWorlds(worldRes);
        setCharacters(charRes);

        if (!preselectedProjectId && projRes.length > 0) {
          setProjectId(projRes[0].id);
        }
        if (preselectedStoryId) {
          const st = await api.stories.get(preselectedStoryId).catch(() => null);
          if (active && st) {
            setSelectedStory(st);
            setProjectId(st.project_id);
          }
        }
      } catch {
        // non-blocking
      }
    }
    loadInitialData();
    return () => {
      active = false;
    };
  }, [preselectedProjectId, preselectedStoryId]);

  useEffect(() => {
    let active = true;
    async function loadStoryForProject() {
      if (!projectId) {
        setSelectedStory(null);
        return;
      }
      const st = await api.stories.getByProject(projectId).catch(() => null);
      if (active) {
        setSelectedStory(st);
        if (st) {
          setStoryId(st.id);
        }
      }
    }
    loadStoryForProject();
    return () => {
      active = false;
    };
  }, [projectId]);

  const locationOptions =
    ENVIRONMENT_LOCATION_PRESETS[category] || ["Custom"];

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    const presets = ENVIRONMENT_LOCATION_PRESETS[nextCategory] || ["Custom"];
    setLocationType(presets[0] || "Custom");
  };

  const applyBlueprint = (bp: (typeof QUICK_ENVIRONMENT_BLUEPRINTS)[number]) => {
    setName(bp.name);
    setCategory(bp.category);
    setLocationType(bp.location_type);
    setArtStyle(bp.art_style);
    setVisualMood(bp.visual_mood);
    setTimeOfDay(bp.time_of_day);
    setWeather(bp.weather);
    setCameraPerspective(bp.camera_perspective);
    setDescription(bp.description);
    setArchitecture(bp.architecture);
    setTerrain(bp.terrain);
    setVegetation(bp.vegetation);
    setPropsText(bp.props);
    setLighting(bp.lighting);
    setAtmosphere(bp.atmosphere);
    setColorPalette(bp.color_palette);
    setTagsInput(bp.tags.join(", "));
  };

  const addColorSwatch = () => {
    const clean = newColorHex.trim();
    if (!clean) return;
    if (!colorPalette.includes(clean)) {
      setColorPalette([...colorPalette, clean]);
    }
  };

  const removeColorSwatch = (hex: string) => {
    setColorPalette(colorPalette.filter((c) => c !== hex));
  };

  const toggleSceneId = (sceneId: string) => {
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId)
        ? prev.filter((id) => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  const toggleCharacterId = (charId: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(charId)
        ? prev.filter((id) => id !== charId)
        : [...prev, charId]
    );
  };

  const selectedWorldObj = worlds.find((w) => w.id === worldId) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please provide an environment name.");
      return;
    }

    if (mode === "reference_upload" && !referenceFile) {
      setError("Please select a reference image file (PNG, JPEG, or WEBP) to upload.");
      return;
    }

    setIsSubmitting(true);
    setProgressStep(25);
    setStatusMessage("Saving structured environment record in PostgreSQL...");

    try {
      const resolvedLocType =
        locationType === "Custom" && customLocationType.trim()
          ? customLocationType.trim()
          : locationType;

      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: EnvironmentCreatePayload = {
        project_id: projectId || undefined,
        story_id: storyId || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        location_type: resolvedLocType,
        art_style: artStyle,
        custom_art_style:
          artStyle === "Custom" ? customArtStyle.trim() || undefined : undefined,
        visual_mood: visualMood.trim() || undefined,
        time_of_day: timeOfDay,
        custom_time_of_day:
          timeOfDay === "Custom"
            ? customTimeOfDay.trim() || undefined
            : undefined,
        weather,
        custom_weather:
          weather === "Custom" ? customWeather.trim() || undefined : undefined,
        color_palette: colorPalette,
        camera_perspective: cameraPerspective,
        custom_camera_perspective:
          cameraPerspective === "Custom"
            ? customCameraPerspective.trim() || undefined
            : undefined,
        architecture: architecture.trim() || undefined,
        terrain: terrain.trim() || undefined,
        vegetation: vegetation.trim() || undefined,
        props: propsText.trim() || undefined,
        lighting: lighting.trim() || undefined,
        atmosphere: atmosphere.trim() || undefined,
        additional_instructions: additionalInstructions.trim() || undefined,
        tags: parsedTags,
        scene_ids: selectedSceneIds,
        character_ids: selectedCharacterIds,
        world_id: worldId || undefined,
        world_parent_location_id: worldParentLocationId || undefined,
        seed_default_variations: true,
      };

      const created = await api.environments.create(payload);

      if (mode === "reference_upload" && referenceFile) {
        setProgressStep(65);
        setStatusMessage("Validating and uploading reference environment artwork...");
        await api.environments.uploadAsset(created.id, referenceFile, {
          asset_type: "reference_upload",
          label: `${created.name} — Reference Artwork`,
          set_as_default: true,
        });
      } else if (mode === "ai_assisted") {
        setProgressStep(65);
        setStatusMessage(
          `Generating AI ${initialGenerationType} artwork via ${providerStatus?.provider || "AI Image Provider"}...`
        );
        try {
          await api.environments.generateImage(created.id, {
            generation_type: initialGenerationType,
            set_as_default: true,
          });
        } catch (genErr) {
          // Preserve created environment and surface the honest provider error in the workspace
          const msg =
            genErr instanceof Error
              ? genErr.message
              : "AI image generation failed.";
          router.push(
            `/environments/${created.id}/design?genError=${encodeURIComponent(msg)}`
          );
          return;
        }
      }

      if (storyId && (selectedSceneIds.length > 0 || selectedCharacterIds.length > 0)) {
        setProgressStep(85);
        setStatusMessage("Linking environment with Story scenes and characters...");
        await api.environments
          .syncToStory(created.id, {
            story_id: storyId,
            scene_ids: selectedSceneIds,
            character_ids: selectedCharacterIds,
          })
          .catch(() => null);
      }

      setProgressStep(100);
      setStatusMessage("Environment ready! Redirecting to studio workspace...");
      router.push(`/environments/${created.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create environment. Please verify your inputs."
      );
      setIsSubmitting(false);
      setProgressStep(0);
      setStatusMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Quick Blueprints Bar */}
      <Card className="border-zinc-800/90 bg-zinc-900/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                Quick-Fill Environment Concept Blueprints
              </CardTitle>
              <CardDescription className="text-xs">
                Pre-populate rich environment architecture, lighting, terrain, and palette settings with one click—every field remains 100% editable.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5">
          {QUICK_ENVIRONMENT_BLUEPRINTS.map((bp) => (
            <Button
              key={bp.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyBlueprint(bp)}
              className="gap-2 text-xs border-zinc-700/80 bg-zinc-900/80 hover:border-violet-500/50"
            >
              <Globe className="h-3.5 w-3.5 text-violet-400" />
              {bp.name}
              <Badge variant="secondary" className="text-[10px]">
                {bp.category}
              </Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Creation Workflow Mode Selector */}
      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
            mode === "manual"
              ? "border-violet-500 bg-violet-500/10 shadow-md shadow-violet-950/30"
              : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Compass className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">
              A. Manual Environment Design
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Configure complete architectural, terrain, lighting, and weather specifications first, then generate or upload visuals anytime.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode("ai_assisted")}
          className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
            mode === "ai_assisted"
              ? "border-violet-500 bg-violet-500/10 shadow-md shadow-violet-950/30"
              : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">
              B. AI-Assisted Concept Generation
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Save your environment specification and immediately synthesize an AI environment concept or wide landscape background.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode("reference_upload")}
          className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
            mode === "reference_upload"
              ? "border-violet-500 bg-violet-500/10 shadow-md shadow-violet-950/30"
              : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Upload className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">
              C. Upload Custom Background / Reference
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Upload your own concept painting, matte background, or location sketch (PNG, JPEG, WEBP) as the canonical environment image.
          </p>
        </button>
      </div>

      {/* Provider Banner when AI-Assisted is chosen */}
      {mode === "ai_assisted" && providerStatus && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-xs ${
            providerStatus.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {providerStatus.configured ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">
              {providerStatus.configured
                ? `AI Image Provider Ready (${providerStatus.provider} — ${providerStatus.model})`
                : "AI Image Provider Key Not Configured"}
            </p>
            <p className="text-zinc-300">{providerStatus.message}</p>
            {mode === "ai_assisted" && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="text-zinc-400">Initial Shot Type:</span>
                {(
                  [
                    { id: "concept", label: "Environment Concept" },
                    { id: "landscape", label: "Wide Landscape Background" },
                    { id: "interior", label: "Interior Background" },
                    { id: "exterior", label: "Exterior Background" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setInitialGenerationType(item.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      initialGenerationType === item.id
                        ? "border-violet-400 bg-violet-500/20 text-white"
                        : "border-zinc-700 bg-zinc-900/70 text-zinc-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Dropzone when Reference Upload is chosen */}
      {mode === "reference_upload" && (
        <Card className="border-violet-500/40 bg-zinc-900/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-violet-400" />
              Upload Environment Reference or Matte Painting
            </CardTitle>
            <CardDescription className="text-xs">
              Accepted formats: PNG, JPEG, WEBP (verified via binary magic-byte inspection, max 15 MB).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center hover:border-violet-500/60">
              <Upload className="mb-2 h-6 w-6 text-violet-400" />
              <span className="text-xs font-medium text-zinc-200">
                {referenceFile
                  ? `Selected: ${referenceFile.name} (${Math.round(referenceFile.size / 1024)} KB)`
                  : "Click to choose a PNG, JPEG, or WEBP background file"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setReferenceFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Basic Environment Details */}
      <Card className="border-zinc-800/90 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-violet-400" />
            1. Basic Environment Identity & Category
          </CardTitle>
          <CardDescription className="text-xs">
            Choose from Natural, Human, Fantasy, Science-Fiction, or Custom environment categories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="env-name"
                className="text-xs font-medium text-zinc-300"
              >
                Environment Name <span className="text-rose-400">*</span>
              </label>
              <Input
                id="env-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Emerald Sky Citadel, Whispering Bamboo Grove, Sector 9 Lab"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-tags"
                className="text-xs font-medium text-zinc-300"
              >
                Searchable Tags (comma-separated)
              </label>
              <Input
                id="env-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="fantasy, temple, mountain, exterior"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-300">
              Environment Category
            </span>
            <div className="flex flex-wrap gap-2">
              {ENVIRONMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                    category === cat
                      ? "border-violet-500 bg-violet-500/20 text-white"
                      : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="env-location-type"
                className="text-xs font-medium text-zinc-300"
              >
                Location Type Preset ({category})
              </label>
              <select
                id="env-location-type"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {locationType === "Custom" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="env-custom-location-type"
                  className="text-xs font-medium text-zinc-300"
                >
                  Custom Location Type
                </label>
                <Input
                  id="env-custom-location-type"
                  value={customLocationType}
                  onChange={(e) => setCustomLocationType(e.target.value)}
                  placeholder="e.g., Subterranean Clockwork Library"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="env-description"
              className="text-xs font-medium text-zinc-300"
            >
              Environment Description
            </label>
            <Textarea
              id="env-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the overall setting, scale, storytelling purpose, and visual focal points..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Visual Style, Architecture, Terrain, Props & Palette */}
      <Card className="border-zinc-800/90 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-400" />
            2. Visual Design, Architecture, Terrain & Color Palette
          </CardTitle>
          <CardDescription className="text-xs">
            Configure the art style, architectural structures, natural terrain, flora, set dressing props, and palette.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="env-art-style"
                className="text-xs font-medium text-zinc-300"
              >
                Art Style
              </label>
              <select
                id="env-art-style"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {ANIMATION_STYLES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-visual-mood"
                className="text-xs font-medium text-zinc-300"
              >
                Visual Mood
              </label>
              <Input
                id="env-visual-mood"
                value={visualMood}
                onChange={(e) => setVisualMood(e.target.value)}
                placeholder="e.g., Serene & ethereal, Ominous & tense, Cozy nostalgic"
              />
            </div>
          </div>

          {artStyle === "Custom" && (
            <div className="space-y-1.5">
              <label
                htmlFor="env-custom-style"
                className="text-xs font-medium text-zinc-300"
              >
                Custom Art Style Direction
              </label>
              <Input
                id="env-custom-style"
                value={customArtStyle}
                onChange={(e) => setCustomArtStyle(e.target.value)}
                placeholder="e.g., Watercolor ukiyo-e woodblock print with gold leaf accents"
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="env-architecture"
                className="text-xs font-medium text-zinc-300"
              >
                Architecture & Structures
              </label>
              <Input
                id="env-architecture"
                value={architecture}
                onChange={(e) => setArchitecture(e.target.value)}
                placeholder="e.g., Tiered pagoda roofs, gothic stone arches, glass domes"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-terrain"
                className="text-xs font-medium text-zinc-300"
              >
                Terrain & Ground Surface
              </label>
              <Input
                id="env-terrain"
                value={terrain}
                onChange={(e) => setTerrain(e.target.value)}
                placeholder="e.g., Basalt cliff ledges, cobblestone plaza, red sand dunes"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-vegetation"
                className="text-xs font-medium text-zinc-300"
              >
                Vegetation & Flora
              </label>
              <Input
                id="env-vegetation"
                value={vegetation}
                onChange={(e) => setVegetation(e.target.value)}
                placeholder="e.g., Ancient cherry blossoms, glowing fern canopy, pine trees"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-props"
                className="text-xs font-medium text-zinc-300"
              >
                Key Set Props & Objects
              </label>
              <Input
                id="env-props"
                value={propsText}
                onChange={(e) => setPropsText(e.target.value)}
                placeholder="e.g., Stone lanterns, holographic kiosks, wooden market carts"
              />
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-300">
              Color Palette Swatches
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {colorPalette.map((hex) => (
                <span
                  key={hex}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: hex }}
                  />
                  {hex}
                  <button
                    type="button"
                    onClick={() => removeColorSwatch(hex)}
                    className="text-zinc-500 hover:text-zinc-200"
                    aria-label={`Remove color ${hex}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-zinc-700 bg-zinc-950"
                  aria-label="Pick color swatch"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addColorSwatch}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Swatch
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Time of Day, Weather, Lighting & Camera Perspective */}
      <Card className="border-zinc-800/90 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-violet-400" />
            3. Time of Day, Weather, Lighting & Camera Perspective
          </CardTitle>
          <CardDescription className="text-xs">
            Control atmospheric conditions and camera framing for scene composition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="env-time"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5"
              >
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                Time of Day
              </label>
              <select
                id="env-time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {ENVIRONMENT_TIME_SETTINGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-weather"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5"
              >
                <CloudRain className="h-3.5 w-3.5 text-sky-400" />
                Weather Condition
              </label>
              <select
                id="env-weather"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {ENVIRONMENT_WEATHER_SETTINGS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-camera"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5"
              >
                <Camera className="h-3.5 w-3.5 text-violet-400" />
                Camera Perspective
              </label>
              <select
                id="env-camera"
                value={cameraPerspective}
                onChange={(e) => setCameraPerspective(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {ENVIRONMENT_CAMERA_PERSPECTIVES.map((cam) => (
                  <option key={cam} value={cam}>
                    {cam}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {timeOfDay === "Custom" && (
              <Input
                value={customTimeOfDay}
                onChange={(e) => setCustomTimeOfDay(e.target.value)}
                placeholder="Custom time (e.g., Solar Eclipse Twilight)"
              />
            )}
            {weather === "Custom" && (
              <Input
                value={customWeather}
                onChange={(e) => setCustomWeather(e.target.value)}
                placeholder="Custom weather (e.g., Floating Ember Ashfall)"
              />
            )}
            {cameraPerspective === "Custom" && (
              <Input
                value={customCameraPerspective}
                onChange={(e) => setCustomCameraPerspective(e.target.value)}
                placeholder="Custom camera (e.g., Dutch angle low worm's-eye)"
              />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="env-lighting"
                className="text-xs font-medium text-zinc-300"
              >
                Lighting Direction & Quality
              </label>
              <Input
                id="env-lighting"
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                placeholder="e.g., Volumetric god rays through canopy, warm lantern rim light"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-atmosphere"
                className="text-xs font-medium text-zinc-300"
              >
                Atmospheric Depth & Particles
              </label>
              <Input
                id="env-atmosphere"
                value={atmosphere}
                onChange={(e) => setAtmosphere(e.target.value)}
                placeholder="e.g., Layered mountain haze, drifting fireflies, soft bokeh"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="env-additional"
              className="text-xs font-medium text-zinc-300"
            >
              Additional Art Direction Instructions
            </label>
            <Input
              id="env-additional"
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="Optional instructions for composition, depth layers, or background staging..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: World Hierarchy, Story, Scene & Character Planning Association */}
      <Card className="border-zinc-800/90 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-violet-400" />
            4. World Hierarchy, Story, Scene & Character Staging Association
          </CardTitle>
          <CardDescription className="text-xs">
            Link this environment to a project, story scenes, world hierarchy node, and existing characters for scene staging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="env-project"
                className="text-xs font-medium text-zinc-300"
              >
                Project Workspace
              </label>
              <select
                id="env-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                <option value="">Auto-resolve Default Environment Library</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="env-world"
                className="text-xs font-medium text-zinc-300"
              >
                World Library Container (Optional)
              </label>
              <select
                id="env-world"
                value={worldId}
                onChange={(e) => {
                  setWorldId(e.target.value);
                  setWorldParentLocationId("");
                }}
                className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                <option value="">Not assigned to a World container</option>
                {worlds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedWorldObj && (
              <div className="space-y-1.5">
                <label
                  htmlFor="env-world-parent"
                  className="text-xs font-medium text-zinc-300"
                >
                  Parent World Location Node
                </label>
                <select
                  id="env-world-parent"
                  value={worldParentLocationId}
                  onChange={(e) => setWorldParentLocationId(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Top-Level World Node</option>
                  {selectedWorldObj.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.location_type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedStory && selectedStory.document.scenes.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-zinc-300">
                Assign Environment to Story Scenes ({selectedStory.title})
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedStory.document.scenes.map((sc) => {
                  const active = selectedSceneIds.includes(sc.id);
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => toggleSceneId(sc.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? "border-violet-500 bg-violet-500/20 text-white"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
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
              <span className="text-xs font-medium text-zinc-300">
                Stage Existing Characters in This Environment (Planning Workflow)
              </span>
              <div className="flex flex-wrap gap-2">
                {characters.map((ch) => {
                  const active = selectedCharacterIds.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleCharacterId(ch.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {ch.name} ({ch.role})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error & Progress Feedback */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4"
        >
          <div className="flex items-center justify-between text-xs text-violet-200">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              {statusMessage}
            </span>
            <span>{progressStep}%</span>
          </div>
          <progress
            max={100}
            value={progressStep}
            aria-label="Environment creation progress"
            className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-zinc-900 [&::-webkit-progress-value]:bg-violet-500"
          />
        </div>
      )}

      {/* Submit Controls */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/environments")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Environment...
            </>
          ) : mode === "ai_assisted" ? (
            <>
              <Wand2 className="h-4 w-4" />
              Create & Generate AI Environment
            </>
          ) : mode === "reference_upload" ? (
            <>
              <Upload className="h-4 w-4" />
              Create & Upload Environment Artwork
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Save & Open Environment Designer
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
