"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Wand2,
} from "lucide-react";
import {
  CHARACTER_ROLES,
  CHARACTER_VISUAL_STYLES,
} from "@tr-studio/scene-schema";
import type {
  CharacterCreatePayload,
  CharacterRelationshipEntry,
  ImageProviderStatusResponse,
  Project,
  StoryResponse,
} from "@tr-studio/shared-types";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CreationMode = "manual" | "ai_assisted" | "upload_reference";

const CHARACTER_CATEGORIES = [
  "Hero / Protagonist",
  "Companion / Sidekick",
  "Mentor",
  "Rival / Antagonist",
  "Magical Creature",
  "Sci-Fi / Mecha",
  "Everyday Civilian",
  "Custom",
];

export function CharacterCreationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId") || "";
  const preselectedStoryId = searchParams.get("storyId") || "";

  const [mode, setMode] = useState<CreationMode>("manual");
  const [aiStatus, setAiStatus] = useState<ImageProviderStatusResponse | null>(
    null
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] =
    useState<string>(preselectedProjectId);
  const [selectedStory, setSelectedStory] = useState<StoryResponse | null>(
    null
  );

  // Basic Information
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<string>("Main character");
  const [ageDescription, setAgeDescription] = useState("");
  const [genderPresentation, setGenderPresentation] = useState("");
  const [species, setSpecies] = useState("Human");
  const [category, setCategory] = useState("Hero / Protagonist");
  const [personalityInput, setPersonalityInput] = useState(
    "Curious, Determined, Loyal"
  );
  const [backstory, setBackstory] = useState("");
  const [motivation, setMotivation] = useState("");
  const [strengthsInput, setStrengthsInput] = useState("");
  const [weaknessesInput, setWeaknessesInput] = useState("");
  const [specialAbilitiesInput, setSpecialAbilitiesInput] = useState("");
  const [relationships, setRelationships] = useState<
    CharacterRelationshipEntry[]
  >([]);

  // Appearance Attributes
  const [appearanceDescription, setAppearanceDescription] = useState("");
  const [faceShape, setFaceShape] = useState("");
  const [eyeShape, setEyeShape] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairStyle, setHairStyle] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [skinTone, setSkinTone] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [height, setHeight] = useState("");
  const [clothing, setClothing] = useState("");
  const [accessories, setAccessories] = useState("");
  const [shoes, setShoes] = useState("");
  const [distinguishingFeatures, setDistinguishingFeatures] = useState("");
  const [colorPaletteInput, setColorPaletteInput] = useState(
    "#6D28D9, #F59E0B, #1E293B"
  );
  const [customAttrPairs, setCustomAttrPairs] = useState<
    Array<{ key: string; value: string }>
  >([]);

  // Visual Style
  const [style, setStyle] = useState<string>("Anime");
  const [customStyleDescription, setCustomStyleDescription] = useState("");

  // Character Bible
  const [canonicalDescription, setCanonicalDescription] = useState("");
  const [identityNotes, setIdentityNotes] = useState("");

  // AI-Assisted or Upload Reference options
  const [initialGenerationType, setInitialGenerationType] = useState<
    "concept" | "portrait" | "full_body"
  >("concept");
  const [aiInstructions, setAiInstructions] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [seedDefaultPresets, setSeedDefaultPresets] = useState(true);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadInitial() {
      try {
        const [statusRes, projectsRes] = await Promise.all([
          api.characters.aiStatus().catch(() => null),
          api.projects.list().catch(() => []),
        ]);
        if (!mounted) return;
        if (statusRes) setAiStatus(statusRes);
        setProjects(projectsRes);
        if (!selectedProjectId && projectsRes.length > 0) {
          setSelectedProjectId(projectsRes[0].id);
        }
      } catch {
        // Ignore non-fatal preload error
      }
    }
    loadInitial();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    let mounted = true;
    async function loadProjectStory() {
      if (!selectedProjectId) {
        setSelectedStory(null);
        return;
      }
      try {
        const story = await api.stories.getByProject(selectedProjectId);
        if (mounted) setSelectedStory(story);
      } catch {
        if (mounted) setSelectedStory(null);
      }
    }
    loadProjectStory();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  const parseCsv = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleAddRelationship = () => {
    setRelationships((prev) => [
      ...prev,
      {
        id: `rel_${Date.now()}_${prev.length}`,
        target_character_name: "",
        relationship_type: "Ally",
        description: "",
      },
    ]);
  };

  const handleRemoveRelationship = (id: string) => {
    setRelationships((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddCustomAttr = () => {
    setCustomAttrPairs((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Character name is required.");
      return;
    }

    if (mode === "upload_reference" && !uploadFile) {
      setError(
        "Please select a reference image file (PNG, JPG, JPEG, or WebP) to upload."
      );
      return;
    }

    setIsSubmitting(true);
    setProgressValue(20);
    setStatusMessage("Saving structured character record and Character Bible...");

    try {
      const customAttributes: Record<string, string> = {};
      for (const pair of customAttrPairs) {
        if (pair.key.trim() && pair.value.trim()) {
          customAttributes[pair.key.trim()] = pair.value.trim();
        }
      }

      const palette = parseCsv(colorPaletteInput);
      const payload: CharacterCreatePayload = {
        project_id: selectedProjectId || undefined,
        story_id:
          preselectedStoryId || (selectedStory ? selectedStory.id : undefined),
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        role,
        species: species.trim() || "Human",
        age_description: ageDescription.trim() || undefined,
        gender_presentation: genderPresentation.trim() || undefined,
        category: category.trim() || "Hero / Protagonist",
        personality: parseCsv(personalityInput),
        backstory: backstory.trim() || undefined,
        motivation: motivation.trim() || undefined,
        strengths: parseCsv(strengthsInput),
        weaknesses: parseCsv(weaknessesInput),
        special_abilities: parseCsv(specialAbilitiesInput),
        relationships: relationships.filter((r) =>
          r.target_character_name.trim()
        ),
        appearance_description: appearanceDescription.trim() || undefined,
        appearance: {
          face_shape: faceShape.trim() || undefined,
          eye_shape: eyeShape.trim() || undefined,
          eye_color: eyeColor.trim() || undefined,
          hair_style: hairStyle.trim() || undefined,
          hair_color: hairColor.trim() || undefined,
          skin_tone: skinTone.trim() || undefined,
          body_type: bodyType.trim() || undefined,
          height: height.trim() || undefined,
          clothing: clothing.trim() || undefined,
          accessories: accessories.trim() || undefined,
          shoes: shoes.trim() || undefined,
          distinguishing_features: distinguishingFeatures.trim() || undefined,
          color_palette: palette,
          custom_attributes: customAttributes,
        },
        character_bible: {
          canonical_description:
            canonicalDescription.trim() ||
            appearanceDescription.trim() ||
            undefined,
          color_palette: palette,
          facial_features:
            [faceShape, eyeShape, eyeColor && `${eyeColor} eyes`]
              .filter(Boolean)
              .join(", ") || undefined,
          body_proportions:
            [bodyType, height].filter(Boolean).join(", ") || undefined,
          clothing_details:
            [clothing, shoes].filter(Boolean).join(", ") || undefined,
          accessories_details: accessories.trim() || undefined,
          style_description:
            style === "Custom"
              ? customStyleDescription.trim() || "Custom style"
              : style,
          identity_notes:
            identityNotes.trim() || distinguishingFeatures.trim() || undefined,
        },
        style,
        custom_style_description:
          style === "Custom" ? customStyleDescription.trim() : undefined,
        seed_default_presets: seedDefaultPresets,
      };

      const created = await api.characters.create(payload);
      setProgressValue(55);

      if (mode === "upload_reference" && uploadFile) {
        setStatusMessage("Uploading and validating reference image...");
        await api.characters.uploadAsset(created.id, uploadFile, {
          asset_type: "uploaded_reference",
          label: `${created.name} — Canonical Reference`,
          set_as_canonical_reference: true,
        });
        setProgressValue(85);
      } else if (mode === "ai_assisted") {
        setStatusMessage(
          `Generating initial AI ${initialGenerationType.replace("_", " ")} with ${
            aiStatus?.provider || "configured provider"
          }...`
        );
        try {
          await api.characters.generateImage(created.id, {
            generation_type: initialGenerationType,
            user_instructions: aiInstructions.trim() || undefined,
            set_as_canonical_reference: true,
          });
          setProgressValue(90);
        } catch (genErr) {
          // Character is already saved; redirect to character workspace with notice
          const msg =
            genErr instanceof ApiClientError
              ? genErr.message
              : "AI image generation could not complete.";
          router.push(
            `/characters/${created.id}?notice=${encodeURIComponent(
              `Character saved. AI generation notice: ${msg}`
            )}`
          );
          return;
        }
      }

      if (selectedStory) {
        setStatusMessage("Syncing character to linked story cast...");
        await api.characters
          .syncToStory(created.id, { story_id: selectedStory.id })
          .catch(() => null);
      }

      setProgressValue(100);
      setStatusMessage("Character created! Redirecting to Character Studio...");
      router.push(`/characters/${created.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create character.");
      }
      setIsSubmitting(false);
      setProgressValue(0);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/characters"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Character Library
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Create New Animated Character
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Design a reusable character with a persistent Character Consistency
            Bible, visual style, expressions, poses, and outfits.
          </p>
        </div>

        {aiStatus && (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                aiStatus.configured ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            <div className="text-xs">
              <p className="font-semibold text-zinc-200">
                Image AI:{" "}
                {aiStatus.configured
                  ? `${aiStatus.provider} (${aiStatus.model})`
                  : "Manual / Reference Upload Mode"}
              </p>
              <p className="text-[11px] text-zinc-400">
                {aiStatus.configured
                  ? "Ready for AI concept & sheet generation"
                  : "Configure IMAGE_API_KEY in backend/.env for AI image generation"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Creation Workflow Mode Selector */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all",
            mode === "manual"
              ? "border-violet-500/60 bg-violet-600/10 shadow-sm"
              : "border-zinc-800/90 bg-zinc-900/40 hover:border-zinc-700"
          )}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
              <UserCheck className="h-4 w-4" />
            </span>
            {mode === "manual" && (
              <Badge variant="default" className="text-[10px]">
                Selected
              </Badge>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              A. Manual Character Creation
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Define character profile, appearance attributes, and Character
              Bible first. Generate or upload art anytime.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode("ai_assisted")}
          className={cn(
            "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all",
            mode === "ai_assisted"
              ? "border-violet-500/60 bg-violet-600/10 shadow-sm"
              : "border-zinc-800/90 bg-zinc-900/40 hover:border-zinc-700"
          )}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
              <Sparkles className="h-4 w-4" />
            </span>
            {mode === "ai_assisted" && (
              <Badge variant="default" className="text-[10px]">
                Selected
              </Badge>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              B. AI-Assisted Generation
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Create the character and immediately synthesize a canonical AI
              concept, portrait, or full-body image.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode("upload_reference")}
          className={cn(
            "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all",
            mode === "upload_reference"
              ? "border-violet-500/60 bg-violet-600/10 shadow-sm"
              : "border-zinc-800/90 bg-zinc-900/40 hover:border-zinc-700"
          )}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
              <Upload className="h-4 w-4" />
            </span>
            {mode === "upload_reference" && (
              <Badge variant="default" className="text-[10px]">
                Selected
              </Badge>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              C. Upload Reference Image
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Upload your own artwork (PNG, JPG, JPEG, WebP) as the canonical
              reference image for this character.
            </p>
          </div>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Basic Information */}
        <section className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                1. Basic Character Information
              </h2>
              <p className="text-xs text-zinc-400">
                Core narrative identity, role, personality, and story links.
                Only the character name is required.
              </p>
            </div>
            <Badge variant="secondary">Step 1 of 4</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="char-name"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Character Name <span className="text-red-400">*</span>
              </label>
              <Input
                id="char-name"
                required
                placeholder="e.g., Ren Tsukino"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="char-nickname"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Nickname / Alias
              </label>
              <Input
                id="char-nickname"
                placeholder="e.g., The Starweaver"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="char-role"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Character Role
              </label>
              <select
                id="char-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {CHARACTER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor="char-age"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Age Description
              </label>
              <Input
                id="char-age"
                placeholder="e.g., 14 years old / Teenager"
                value={ageDescription}
                onChange={(e) => setAgeDescription(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="char-gender"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Gender Presentation (Optional)
              </label>
              <Input
                id="char-gender"
                placeholder="e.g., Boy, Girl, Non-binary"
                value={genderPresentation}
                onChange={(e) => setGenderPresentation(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="char-species"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Species
              </label>
              <Input
                id="char-species"
                placeholder="e.g., Human, Forest Spirit, Android"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="char-category"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Character Category
              </label>
              <select
                id="char-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                {CHARACTER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Assignment */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="char-project"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Project Workspace
              </label>
              <select
                id="char-project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              >
                <option value="">
                  Auto-assign default Character Library project
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="char-personality"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Personality Traits (comma-separated)
              </label>
              <Input
                id="char-personality"
                placeholder="e.g., Adventurous, Witty, Empathetic"
                value={personalityInput}
                onChange={(e) => setPersonalityInput(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="char-backstory"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Backstory
              </label>
              <textarea
                id="char-backstory"
                rows={3}
                placeholder="Where did this character come from? What shaped them?"
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="char-motivation"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Core Motivation / Goal
              </label>
              <textarea
                id="char-motivation"
                rows={3}
                placeholder="What drives this character throughout the story?"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="char-strengths"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Strengths (comma-separated)
              </label>
              <Input
                id="char-strengths"
                placeholder="e.g., Quick reflexes, Ancient lore"
                value={strengthsInput}
                onChange={(e) => setStrengthsInput(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="char-weaknesses"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Weaknesses (comma-separated)
              </label>
              <Input
                id="char-weaknesses"
                placeholder="e.g., Impulsive, Fear of deep water"
                value={weaknessesInput}
                onChange={(e) => setWeaknessesInput(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="char-abilities"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Special Abilities (comma-separated)
              </label>
              <Input
                id="char-abilities"
                placeholder="e.g., Astral ink projection, Wind step"
                value={specialAbilitiesInput}
                onChange={(e) => setSpecialAbilitiesInput(e.target.value)}
              />
            </div>
          </div>

          {/* Relationships */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                Character Relationships
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddRelationship}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Relationship
              </Button>
            </div>
            {relationships.map((rel, idx) => (
              <div
                key={rel.id}
                className="grid gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <Input
                    aria-label={`Relationship ${idx + 1} target character`}
                    placeholder="Target character name"
                    value={rel.target_character_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRelationships((prev) =>
                        prev.map((item) =>
                          item.id === rel.id
                            ? { ...item, target_character_name: val }
                            : item
                        )
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    aria-label={`Relationship ${idx + 1} type`}
                    placeholder="Type (e.g., Sister, Rival)"
                    value={rel.relationship_type}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRelationships((prev) =>
                        prev.map((item) =>
                          item.id === rel.id
                            ? { ...item, relationship_type: val }
                            : item
                        )
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    aria-label={`Relationship ${idx + 1} description`}
                    placeholder="Dynamic / notes"
                    value={rel.description || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRelationships((prev) =>
                        prev.map((item) =>
                          item.id === rel.id
                            ? { ...item, description: val }
                            : item
                        )
                      );
                    }}
                  />
                </div>
                <div className="flex items-center justify-end sm:col-span-1">
                  <button
                    type="button"
                    aria-label="Remove relationship"
                    onClick={() => handleRemoveRelationship(rel.id)}
                    className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Character Appearance */}
        <section className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                2. Character Appearance & Physical Design
              </h2>
              <p className="text-xs text-zinc-400">
                Configure structured physical traits or write a free-text
                appearance summary. Leave any optional fields blank.
              </p>
            </div>
            <Badge variant="secondary">Step 2 of 4</Badge>
          </div>

          <div>
            <label
              htmlFor="char-appearance-free"
              className="mb-1.5 block text-xs font-medium text-zinc-300"
            >
              Free-Text Appearance Summary
            </label>
            <textarea
              id="char-appearance-free"
              rows={2}
              placeholder="e.g., A teenage boy with tousled indigo hair, luminous amber eyes, wearing a weathered cobalt traveler cloak with brass astrolabe clasps..."
              value={appearanceDescription}
              onChange={(e) => setAppearanceDescription(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor="attr-face"
                className="mb-1 block text-xs text-zinc-400"
              >
                Face Shape
              </label>
              <Input
                id="attr-face"
                placeholder="Heart, Oval, Angular..."
                value={faceShape}
                onChange={(e) => setFaceShape(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-eye-shape"
                className="mb-1 block text-xs text-zinc-400"
              >
                Eye Shape
              </label>
              <Input
                id="attr-eye-shape"
                placeholder="Large expressive, Almond..."
                value={eyeShape}
                onChange={(e) => setEyeShape(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-eye-color"
                className="mb-1 block text-xs text-zinc-400"
              >
                Eye Color
              </label>
              <Input
                id="attr-eye-color"
                placeholder="Golden amber, Emerald..."
                value={eyeColor}
                onChange={(e) => setEyeColor(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-skin"
                className="mb-1 block text-xs text-zinc-400"
              >
                Skin Tone / Material Color
              </label>
              <Input
                id="attr-skin"
                placeholder="Warm olive, Porcelain, Brushed bronze..."
                value={skinTone}
                onChange={(e) => setSkinTone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor="attr-hair-style"
                className="mb-1 block text-xs text-zinc-400"
              >
                Hair Style
              </label>
              <Input
                id="attr-hair-style"
                placeholder="Windswept short, Twin braids..."
                value={hairStyle}
                onChange={(e) => setHairStyle(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-hair-color"
                className="mb-1 block text-xs text-zinc-400"
              >
                Hair Color
              </label>
              <Input
                id="attr-hair-color"
                placeholder="Midnight indigo with silver tips..."
                value={hairColor}
                onChange={(e) => setHairColor(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-body-type"
                className="mb-1 block text-xs text-zinc-400"
              >
                Body Type
              </label>
              <Input
                id="attr-body-type"
                placeholder="Slender agile, Athletic, Chibi..."
                value={bodyType}
                onChange={(e) => setBodyType(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-height"
                className="mb-1 block text-xs text-zinc-400"
              >
                Height / Proportions
              </label>
              <Input
                id="attr-height"
                placeholder="Medium height, 5 heads tall..."
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor="attr-clothing"
                className="mb-1 block text-xs text-zinc-400"
              >
                Signature Clothing
              </label>
              <Input
                id="attr-clothing"
                placeholder="Cobalt hooded cloak over tunic..."
                value={clothing}
                onChange={(e) => setClothing(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-accessories"
                className="mb-1 block text-xs text-zinc-400"
              >
                Accessories
              </label>
              <Input
                id="attr-accessories"
                placeholder="Brass astrolabe satchel, scarf..."
                value={accessories}
                onChange={(e) => setAccessories(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-shoes"
                className="mb-1 block text-xs text-zinc-400"
              >
                Shoes / Footwear
              </label>
              <Input
                id="attr-shoes"
                placeholder="Cuffed leather boots..."
                value={shoes}
                onChange={(e) => setShoes(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="attr-features"
                className="mb-1 block text-xs text-zinc-400"
              >
                Distinguishing Features
              </label>
              <Input
                id="attr-features"
                placeholder="Star-shaped birthmark on left cheek..."
                value={distinguishingFeatures}
                onChange={(e) => setDistinguishingFeatures(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="attr-palette"
                className="mb-1 block text-xs text-zinc-400"
              >
                Signature Color Palette (comma-separated hex or color names)
              </label>
              <Input
                id="attr-palette"
                placeholder="#6D28D9, #F59E0B, Midnight Blue"
                value={colorPaletteInput}
                onChange={(e) => setColorPaletteInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Custom Appearance Attributes
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddCustomAttr}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add Attribute
                </Button>
              </div>
              {customAttrPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    aria-label={`Custom attribute ${idx + 1} name`}
                    placeholder="Attribute (e.g., Aura Color)"
                    value={pair.key}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomAttrPairs((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, key: val } : p))
                      );
                    }}
                  />
                  <Input
                    aria-label={`Custom attribute ${idx + 1} value`}
                    placeholder="Value (e.g., Cyan Starlight)"
                    value={pair.value}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomAttrPairs((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, value: val } : p
                        )
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Visual Styles & Consistency Bible */}
        <section className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                3. Visual Style & Character Consistency Bible
              </h2>
              <p className="text-xs text-zinc-400">
                Attach a persistent visual style and Canonical Character Bible
                so future portraits, turnarounds, expressions, poses, and
                outfits stay visually aligned.
              </p>
            </div>
            <Badge variant="secondary">Step 3 of 4</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CHARACTER_VISUAL_STYLES.map((styleOption) => {
              const selected = style === styleOption;
              const isUnsupported =
                aiStatus?.unsupported_styles?.includes(styleOption) ?? false;
              return (
                <button
                  key={styleOption}
                  type="button"
                  onClick={() => setStyle(styleOption)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all",
                    selected
                      ? "border-violet-500 bg-violet-600/20 text-white"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Palette
                      className={cn(
                        "h-3.5 w-3.5",
                        selected ? "text-violet-400" : "text-zinc-500"
                      )}
                    />
                    {styleOption}
                  </span>
                  {isUnsupported ? (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                      Unsupported
                    </span>
                  ) : selected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {style === "Custom" && (
            <div>
              <label
                htmlFor="custom-style-desc"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Custom Visual Style Specification
              </label>
              <Input
                id="custom-style-desc"
                placeholder="e.g., Ghibli-inspired gouache background with crisp ink linework and cel-shaded highlights"
                value={customStyleDescription}
                onChange={(e) => setCustomStyleDescription(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="bible-canonical"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Canonical Character Bible Summary (Optional override)
              </label>
              <textarea
                id="bible-canonical"
                rows={2}
                placeholder="Leave blank to auto-synthesize from your appearance attributes above, or enter an exact canonical prompt anchor..."
                value={canonicalDescription}
                onChange={(e) => setCanonicalDescription(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="bible-notes"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Strict Visual Identity Anchor Notes
              </label>
              <textarea
                id="bible-notes"
                rows={2}
                placeholder="e.g., Always keep the brass astrolabe clipped to the left shoulder; eyes must remain golden amber in all expressions."
                value={identityNotes}
                onChange={(e) => setIdentityNotes(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Section 4: Mode-Specific Initial Asset & Presets */}
        <section className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                4. Initial Asset & Library Presets
              </h2>
              <p className="text-xs text-zinc-400">
                Configure default expression/pose/outfit slots and optional
                initial reference artwork.
              </p>
            </div>
            <Badge variant="secondary">Step 4 of 4</Badge>
          </div>

          {mode === "ai_assisted" && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-950/15 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-violet-200">
                  <Wand2 className="h-4 w-4 text-violet-400" />
                  AI-Assisted Initial Image Synthesis
                </span>
                <Badge variant="default">
                  {aiStatus?.configured
                    ? `Provider: ${aiStatus.provider}`
                    : "Requires IMAGE_API_KEY"}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="init-gen-type"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    Initial Generation Type
                  </label>
                  <select
                    id="init-gen-type"
                    value={initialGenerationType}
                    onChange={(e) =>
                      setInitialGenerationType(
                        e.target.value as "concept" | "portrait" | "full_body"
                      )
                    }
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                  >
                    <option value="concept">Character Concept Art</option>
                    <option value="portrait">Character Bust / Portrait</option>
                    <option value="full_body">
                      Full-Body Standing Reference
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="init-ai-instructions"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    Additional Lighting / Framing Instructions
                  </label>
                  <Input
                    id="init-ai-instructions"
                    placeholder="e.g., Soft rim lighting, clean neutral studio backdrop"
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {mode === "upload_reference" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-3">
              <label
                htmlFor="ref-file-upload"
                className="flex items-center gap-2 text-sm font-semibold text-emerald-200"
              >
                <ImagePlus className="h-4 w-4 text-emerald-400" />
                Upload Reference Image (PNG, JPG, JPEG, WebP)
              </label>
              <input
                id="ref-file-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) =>
                  setUploadFile(e.target.files?.[0] ? e.target.files[0] : null)
                }
                className="block w-full text-xs text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-500"
              />
              {uploadFile && (
                <p className="text-xs text-emerald-300">
                  Selected: {uploadFile.name} (
                  {(uploadFile.size / 1024).toFixed(1)} KB) — will be set as
                  Canonical Reference Image.
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={seedDefaultPresets}
              onChange={(e) => setSeedDefaultPresets(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600"
            />
            <span>
              Pre-populate the 12 standard Expression categories (Neutral,
              Happy, Sad, Angry, Surprised, etc.), 10 Pose categories, and
              default Signature Outfit slots for this character.
            </span>
          </label>
        </section>

        {/* Accessible Progress Feedback */}
        {isSubmitting && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-violet-500/40 bg-violet-950/20 p-4 space-y-2"
          >
            <div className="flex items-center justify-between text-xs font-medium text-violet-200">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                {statusMessage}
              </span>
              <span>{progressValue}%</span>
            </div>
            <progress
              aria-label="Character creation progress"
              max={100}
              value={progressValue}
              className="h-2 w-full overflow-hidden rounded-full"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="outline">
            <Link href="/characters">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 px-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Character...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {mode === "ai_assisted"
                  ? "Create & Generate Character"
                  : mode === "upload_reference"
                  ? "Create & Upload Reference"
                  : "Create Character in Studio"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
