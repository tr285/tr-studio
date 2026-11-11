"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileImage,
  FolderSync,
  ImagePlus,
  Layers,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shirt,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
  Wand2,
  X,
} from "lucide-react";
import {
  CHARACTER_ROLES,
  CHARACTER_VISUAL_STYLES,
  DEFAULT_EXPRESSION_CATEGORIES,
  DEFAULT_OUTFIT_PRESETS,
  DEFAULT_POSE_CATEGORIES,
  SUPPORTED_SHEET_VIEWS,
} from "@tr-studio/scene-schema";
import type {
  CharacterAssetRecord,
  CharacterPromptPreviewResponse,
  CharacterRecord,
  CharacterRelationshipEntry,
  CharacterSummaryRecord,
  ImageProviderStatusResponse,
  StoryResponse,
} from "@tr-studio/shared-types";
import { api, ApiClientError, resolveMediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CharacterWorkspaceTab =
  | "overview"
  | "design"
  | "expressions"
  | "poses"
  | "outfits"
  | "assets";

interface CharacterStudioWorkspaceProps {
  characterId: string;
  defaultTab?: CharacterWorkspaceTab;
}

const WORKSPACE_TABS: Array<{
  id: CharacterWorkspaceTab;
  label: string;
  hrefSuffix: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", hrefSuffix: "", icon: UserIcon },
  { id: "design", label: "Design & Sheet", hrefSuffix: "/design", icon: Palette },
  {
    id: "expressions",
    label: "Expressions",
    hrefSuffix: "/expressions",
    icon: Smile,
  },
  { id: "poses", label: "Poses", hrefSuffix: "/poses", icon: Layers },
  { id: "outfits", label: "Outfits", hrefSuffix: "/outfits", icon: Shirt },
  { id: "assets", label: "Assets & Jobs", hrefSuffix: "", icon: FileImage },
];

export function CharacterStudioWorkspace({
  characterId,
  defaultTab = "overview",
}: CharacterStudioWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialNotice = searchParams.get("notice");

  const [activeTab, setActiveTab] = useState<CharacterWorkspaceTab>(defaultTab);
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [libraryCharacters, setLibraryCharacters] = useState<
    CharacterSummaryRecord[]
  >([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryRoleFilter, setLibraryRoleFilter] = useState("all");
  const [aiStatus, setAiStatus] = useState<ImageProviderStatusResponse | null>(
    null
  );
  const [linkedStory, setLinkedStory] = useState<StoryResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(
    initialNotice
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Editable Profile & Appearance state synced with loaded character
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState("Main character");
  const [species, setSpecies] = useState("Human");
  const [ageDescription, setAgeDescription] = useState("");
  const [genderPresentation, setGenderPresentation] = useState("");
  const [category, setCategory] = useState("Hero / Protagonist");
  const [personalityInput, setPersonalityInput] = useState("");
  const [backstory, setBackstory] = useState("");
  const [motivation, setMotivation] = useState("");
  const [strengthsInput, setStrengthsInput] = useState("");
  const [weaknessesInput, setWeaknessesInput] = useState("");
  const [specialAbilitiesInput, setSpecialAbilitiesInput] = useState("");
  const [relationships, setRelationships] = useState<
    CharacterRelationshipEntry[]
  >([]);

  // Appearance fields
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
  const [colorPaletteInput, setColorPaletteInput] = useState("");

  // Visual Style & Bible
  const [style, setStyle] = useState("Anime");
  const [customStyleDescription, setCustomStyleDescription] = useState("");
  const [canonicalDescription, setCanonicalDescription] = useState("");
  const [identityNotes, setIdentityNotes] = useState("");
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);

  // Right Panel AI Generation & Live Prompt Preview state
  const [genType, setGenType] = useState<"concept" | "portrait" | "full_body">(
    "concept"
  );
  const [cameraFraming, setCameraFraming] = useState("");
  const [backgroundSetting, setBackgroundSetting] = useState(
    "clean studio neutral background"
  );
  const [userInstructions, setUserInstructions] = useState("");
  const [customPromptOverride, setCustomPromptOverride] = useState("");
  const [promptPreview, setPromptPreview] =
    useState<CharacterPromptPreviewResponse | null>(null);
  const [setGeneratedAsCanonical, setSetGeneratedAsCanonical] = useState(false);

  // Character Sheet / Turnaround state
  const [selectedSheetViews, setSelectedSheetViews] = useState<string[]>([
    "front_view",
    "side_view",
    "back_view",
    "three_quarter_view",
  ]);
  const [sheetMode, setSheetMode] = useState<
    "separate_views" | "combined_sheet"
  >("separate_views");
  const [lastSheetSummary, setLastSheetSummary] = useState<{
    views_requested: string[];
    views_generated: string[];
    complete: boolean;
    consistency_note: string;
  } | null>(null);

  // Sub-entity creation states
  const [newExprName, setNewExprName] = useState("");
  const [newExprDesc, setNewExprDesc] = useState("");
  const [editingExprId, setEditingExprId] = useState<string | null>(null);
  const [editingExprName, setEditingExprName] = useState("");
  const [editingExprDesc, setEditingExprDesc] = useState("");

  const [newPoseName, setNewPoseName] = useState("");
  const [newPoseCategory, setNewPoseCategory] = useState("Standing");
  const [newPoseDesc, setNewPoseDesc] = useState("");

  const [newOutfitName, setNewOutfitName] = useState("");
  const [newOutfitDesc, setNewOutfitDesc] = useState("");
  const [newOutfitPalette, setNewOutfitPalette] = useState("");
  const [newOutfitAccessories, setNewOutfitAccessories] = useState("");
  const [newOutfitDefault, setNewOutfitDefault] = useState(false);

  // Asset filter & comparison modal state
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("all");
  const [previewAsset, setPreviewAsset] = useState<CharacterAssetRecord | null>(
    null
  );
  const [compareAsset, setCompareAsset] = useState<CharacterAssetRecord | null>(
    null
  );

  // Native <dialog> refs for Asset Lightbox & Variation Creation
  const lightboxDialogRef = useRef<HTMLDialogElement | null>(null);
  const variationDialogRef = useRef<HTMLDialogElement | null>(null);
  const [variationName, setVariationName] = useState("");
  const [variationStyle, setVariationStyle] = useState("");
  const [variationNotes, setVariationNotes] = useState("");

  // Modern Web Guidance light-dismiss fallback for browsers without native closedBy support
  useEffect(() => {
    const dialogs = [lightboxDialogRef.current, variationDialogRef.current];
    const cleanups: Array<() => void> = [];

    for (const dialog of dialogs) {
      if (!dialog) continue;
      if (
        typeof HTMLDialogElement !== "undefined" &&
        !("closedBy" in HTMLDialogElement.prototype)
      ) {
        let pointerDownOutside = false;
        const onPointerDown = (e: PointerEvent) => {
          const r = dialog.getBoundingClientRect();
          pointerDownOutside =
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom;
        };
        const onPointerUp = (e: PointerEvent) => {
          const r = dialog.getBoundingClientRect();
          const outside =
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom;
          if (pointerDownOutside && outside) dialog.close();
          pointerDownOutside = false;
        };
        dialog.addEventListener("pointerdown", onPointerDown);
        dialog.addEventListener("pointerup", onPointerUp);
        cleanups.push(() => {
          dialog.removeEventListener("pointerdown", onPointerDown);
          dialog.removeEventListener("pointerup", onPointerUp);
        });
      }
    }
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const populateCharacterFields = useCallback((char: CharacterRecord) => {
    setCharacter(char);
    setName(char.name);
    setNickname(char.nickname || "");
    setRole(char.role || "Main character");
    setSpecies(char.species || "Human");
    setAgeDescription(char.age_description || "");
    setGenderPresentation(char.metadata?.gender_presentation || "");
    setCategory(char.metadata?.category || "Hero / Protagonist");
    setPersonalityInput((char.personality || []).join(", "));
    setBackstory(char.backstory || "");
    setMotivation(char.motivation || "");
    setStrengthsInput((char.metadata?.strengths || []).join(", "));
    setWeaknessesInput((char.metadata?.weaknesses || []).join(", "));
    setSpecialAbilitiesInput(
      (char.metadata?.special_abilities || []).join(", ")
    );
    setRelationships(char.metadata?.relationships || []);

    const app = char.metadata?.appearance || {
      color_palette: [],
      custom_attributes: {},
    };
    setAppearanceDescription(char.appearance_description || "");
    setFaceShape(app.face_shape || "");
    setEyeShape(app.eye_shape || "");
    setEyeColor(app.eye_color || "");
    setHairStyle(app.hair_style || "");
    setHairColor(app.hair_color || "");
    setSkinTone(app.skin_tone || "");
    setBodyType(app.body_type || "");
    setHeight(app.height || "");
    setClothing(app.clothing || "");
    setAccessories(app.accessories || "");
    setShoes(app.shoes || "");
    setDistinguishingFeatures(app.distinguishing_features || "");
    setColorPaletteInput((app.color_palette || []).join(", "));

    setStyle(char.style || "Anime");
    setCustomStyleDescription(char.metadata?.custom_style_description || "");

    const bible = char.metadata?.character_bible;
    setCanonicalDescription(bible?.canonical_description || "");
    setIdentityNotes(bible?.identity_notes || "");
    setSelectedRefIds(bible?.selected_reference_asset_ids || []);
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const [charRes, listRes, statusRes] = await Promise.all([
        api.characters.get(characterId),
        api.characters.list(),
        api.characters.aiStatus().catch(() => null),
      ]);
      populateCharacterFields(charRes);
      setLibraryCharacters(listRes);
      if (statusRes) setAiStatus(statusRes);

      if (charRes.story_id) {
        const story = await api.stories
          .get(charRes.story_id)
          .catch(() => null);
        setLinkedStory(story);
      } else if (charRes.project_id) {
        const story = await api.stories
          .getByProject(charRes.project_id)
          .catch(() => null);
        setLinkedStory(story);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Unable to load character workspace."
      );
    } finally {
      setIsLoading(false);
    }
  }, [characterId, populateCharacterFields]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const parseCsv = (val: string) =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSaveCharacter = async () => {
    if (!character) return;
    setIsSaving(true);
    setErrorBanner(null);
    try {
      const palette = parseCsv(colorPaletteInput);
      const updated = await api.characters.update(character.id, {
        name: name.trim() || character.name,
        nickname: nickname.trim() || undefined,
        role,
        species: species.trim() || "Human",
        age_description: ageDescription.trim() || undefined,
        gender_presentation: genderPresentation.trim() || undefined,
        category: category.trim() || undefined,
        personality: parseCsv(personalityInput),
        backstory: backstory.trim() || undefined,
        motivation: motivation.trim() || undefined,
        strengths: parseCsv(strengthsInput),
        weaknesses: parseCsv(weaknessesInput),
        special_abilities: parseCsv(specialAbilitiesInput),
        relationships,
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
          custom_attributes:
            character.metadata?.appearance?.custom_attributes || {},
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
          selected_reference_asset_ids: selectedRefIds,
          identity_notes: identityNotes.trim() || undefined,
        },
        style,
        custom_style_description:
          style === "Custom" ? customStyleDescription.trim() : undefined,
      });
      populateCharacterFields(updated);
      setStatusBanner("Character profile, appearance, and Bible saved.");
      const listRes = await api.characters.list().catch(() => null);
      if (listRes) setLibraryCharacters(listRes);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to save character changes."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewPrompt = async () => {
    if (!character) return;
    setErrorBanner(null);
    try {
      const res = await api.characters.previewPrompt(character.id, {
        generation_type: genType,
        style_override: style,
        camera_framing: cameraFraming.trim() || undefined,
        background: backgroundSetting.trim() || undefined,
        user_instructions: userInstructions.trim() || undefined,
      });
      setPromptPreview(res);
      setCustomPromptOverride(res.prompt);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to build character prompt preview."
      );
    }
  };

  const handleGenerateSingleImage = async () => {
    if (!character) return;
    setIsGenerating(true);
    setGenerationProgress(25);
    setErrorBanner(null);
    setStatusBanner(
      `Generating ${genType.replace("_", " ")} via ${
        aiStatus?.provider || "configured provider"
      }...`
    );
    try {
      const res = await api.characters.generateImage(character.id, {
        generation_type: genType,
        custom_prompt: customPromptOverride.trim() || undefined,
        style_override: style,
        camera_framing: cameraFraming.trim() || undefined,
        background: backgroundSetting.trim() || undefined,
        reference_asset_ids: selectedRefIds,
        user_instructions: userInstructions.trim() || undefined,
        set_as_canonical_reference: setGeneratedAsCanonical,
      });
      setGenerationProgress(100);
      populateCharacterFields(res.character);
      setStatusBanner(
        `Generated ${res.generated_assets.length} ${genType.replace(
          "_",
          " "
        )} asset(s). ${res.consistency_note}`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "AI image generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleGenerateTurnaroundSheet = async () => {
    if (!character) return;
    if (selectedSheetViews.length === 0) {
      setErrorBanner(
        "Select at least one view to generate a character turnaround sheet."
      );
      return;
    }
    setIsGenerating(true);
    setGenerationProgress(20);
    setErrorBanner(null);
    setStatusBanner(
      `Generating character turnaround (${selectedSheetViews.join(", ")}) in ${
        sheetMode === "separate_views"
          ? "Separate View Assets"
          : "Combined Sheet"
      } mode...`
    );
    try {
      const res = await api.characters.generateSheet(character.id, {
        views: selectedSheetViews,
        sheet_mode: sheetMode,
        style_override: style,
        user_instructions: userInstructions.trim() || undefined,
      });
      setGenerationProgress(100);
      populateCharacterFields(res.character);
      setLastSheetSummary({
        views_requested: res.views_requested,
        views_generated: res.views_generated,
        complete: res.complete,
        consistency_note: res.consistency_note,
      });
      setStatusBanner(
        res.complete
          ? `Turnaround sheet complete: ${res.views_generated.length}/${res.views_requested.length} views generated.`
          : `Partial sheet generated: ${res.views_generated.length}/${res.views_requested.length} views completed.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Character sheet generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleUploadReference = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType = "uploaded_reference",
    makeCanonical = false
  ) => {
    if (!character || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsGenerating(true);
    setGenerationProgress(40);
    setErrorBanner(null);
    setStatusBanner(`Uploading and validating ${file.name}...`);
    try {
      await api.characters.uploadAsset(character.id, file, {
        asset_type: assetType,
        label: file.name,
        set_as_canonical_reference: makeCanonical,
      });
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner(
        `Uploaded "${file.name}" (${
          makeCanonical
            ? "set as Canonical Reference"
            : "added to Asset Library"
        }).`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "File upload failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      e.target.value = "";
    }
  };

  const handleSetCanonicalAsset = async (assetId: string) => {
    if (!character) return;
    try {
      await api.characters.updateAsset(assetId, {
        set_as_canonical_reference: true,
      });
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner(
        "Updated Canonical Reference Image for Character Consistency Bible."
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Could not set canonical reference."
      );
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!character) return;
    try {
      await api.characters.deleteAsset(assetId);
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Asset deleted.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "Could not delete asset."
      );
    }
  };

  // Expressions handlers
  const handleAddExpression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character || !newExprName.trim()) return;
    try {
      await api.characters.createExpression(character.id, {
        name: newExprName.trim(),
        description: newExprDesc.trim() || undefined,
      });
      setNewExprName("");
      setNewExprDesc("");
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Added custom expression.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to add expression."
      );
    }
  };

  const handleSaveExpressionEdit = async (expressionId: string) => {
    if (!character || !editingExprName.trim()) return;
    try {
      await api.characters.updateExpression(expressionId, {
        name: editingExprName.trim(),
        description: editingExprDesc.trim() || undefined,
      });
      setEditingExprId(null);
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Expression updated.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to update expression."
      );
    }
  };

  const handleGenerateExpression = async (
    exprId: string,
    exprName: string,
    exprDesc?: string | null
  ) => {
    if (!character) return;
    setIsGenerating(true);
    setGenerationProgress(35);
    setErrorBanner(null);
    setStatusBanner(`Generating "${exprName}" expression portrait...`);
    try {
      const res = await api.characters.generateExpression(character.id, {
        expression_id: exprId,
        expression_name: exprName,
        description: exprDesc || undefined,
        user_instructions: userInstructions.trim() || undefined,
      });
      populateCharacterFields(res.character);
      setStatusBanner(`Generated "${exprName}" expression asset.`);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Expression generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleDeleteExpression = async (exprId: string) => {
    if (!character) return;
    try {
      await api.characters.deleteExpression(exprId);
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Expression removed.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to delete expression."
      );
    }
  };

  // Pose handlers
  const handleAddPose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character || !newPoseName.trim()) return;
    try {
      await api.characters.createPose(character.id, {
        name: newPoseName.trim(),
        category: newPoseCategory,
        description: newPoseDesc.trim() || undefined,
      });
      setNewPoseName("");
      setNewPoseDesc("");
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Added pose to library.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "Failed to add pose."
      );
    }
  };

  const handleGeneratePose = async (
    poseId: string,
    poseName: string,
    poseCategory: string,
    poseDesc?: string | null
  ) => {
    if (!character) return;
    setIsGenerating(true);
    setGenerationProgress(35);
    setErrorBanner(null);
    setStatusBanner(`Generating "${poseName}" full-body pose...`);
    try {
      const res = await api.characters.generatePose(character.id, {
        pose_id: poseId,
        pose_name: poseName,
        category: poseCategory,
        description: poseDesc || undefined,
        user_instructions: userInstructions.trim() || undefined,
      });
      populateCharacterFields(res.character);
      setStatusBanner(`Generated "${poseName}" pose asset.`);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "Pose generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleDeletePose = async (poseId: string) => {
    if (!character) return;
    try {
      await api.characters.deletePose(poseId);
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Pose removed.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "Failed to delete pose."
      );
    }
  };

  // Outfit handlers
  const handleAddOutfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character || !newOutfitName.trim()) return;
    try {
      await api.characters.createOutfit(character.id, {
        name: newOutfitName.trim(),
        description: newOutfitDesc.trim() || undefined,
        color_palette: parseCsv(newOutfitPalette),
        accessories: parseCsv(newOutfitAccessories),
        is_default: newOutfitDefault,
      });
      setNewOutfitName("");
      setNewOutfitDesc("");
      setNewOutfitPalette("");
      setNewOutfitAccessories("");
      setNewOutfitDefault(false);
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Added outfit variation.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "Failed to add outfit."
      );
    }
  };

  const handleSetDefaultOutfit = async (outfitId: string) => {
    if (!character) return;
    try {
      await api.characters.updateOutfit(outfitId, { is_default: true });
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner(
        "Updated active default outfit (canonical appearance description preserved)."
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to set default outfit."
      );
    }
  };

  const handleGenerateOutfit = async (
    outfitId: string,
    outfitName: string,
    outfitDesc?: string | null,
    palette?: string[],
    outfitAcc?: string[],
    isDef?: boolean
  ) => {
    if (!character) return;
    setIsGenerating(true);
    setGenerationProgress(35);
    setErrorBanner(null);
    setStatusBanner(`Generating "${outfitName}" outfit variation...`);
    try {
      const res = await api.characters.generateOutfit(character.id, {
        outfit_id: outfitId,
        outfit_name: outfitName,
        description: outfitDesc || undefined,
        color_palette: palette || [],
        accessories: outfitAcc || [],
        is_default: isDef || false,
        user_instructions: userInstructions.trim() || undefined,
      });
      populateCharacterFields(res.character);
      setStatusBanner(`Generated "${outfitName}" outfit asset.`);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Outfit generation failed."
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleDeleteOutfit = async (outfitId: string) => {
    if (!character) return;
    try {
      await api.characters.deleteOutfit(outfitId);
      const refreshed = await api.characters.get(character.id);
      populateCharacterFields(refreshed);
      setStatusBanner("Outfit deleted.");
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError ? err.message : "Failed to delete outfit."
      );
    }
  };

  // Sync character to story & scene cast
  const handleSyncToStory = async (sceneIds?: string[]) => {
    if (!character || !linkedStory) return;
    try {
      const updated = await api.characters.syncToStory(character.id, {
        story_id: linkedStory.id,
        scene_ids: sceneIds,
      });
      populateCharacterFields(updated);
      const refreshedStory = await api.stories.get(linkedStory.id);
      setLinkedStory(refreshedStory);
      setStatusBanner(
        `Synced "${character.name}" with story "${refreshedStory.title}" without duplication.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to sync character to story."
      );
    }
  };

  const handleCreateVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;
    try {
      const variation = await api.characters.createVariation(character.id, {
        name: variationName.trim() || `${character.name} (Variation)`,
        style: variationStyle || character.style,
        variation_notes: variationNotes.trim() || undefined,
      });
      variationDialogRef.current?.close();
      router.push(`/characters/${variation.id}`);
    } catch (err) {
      setErrorBanner(
        err instanceof ApiClientError
          ? err.message
          : "Failed to create character variation."
      );
    }
  };

  const filteredLibrary = libraryCharacters.filter((c) => {
    const matchesSearch =
      !librarySearch.trim() ||
      c.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (c.nickname &&
        c.nickname.toLowerCase().includes(librarySearch.toLowerCase()));
    const matchesRole =
      libraryRoleFilter === "all" || c.role === libraryRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredAssets = (character?.assets || []).filter(
    (a) => assetTypeFilter === "all" || a.asset_type === assetTypeFilter
  );

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-zinc-400"
      >
        <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
        <p className="text-sm">Loading Character Creation Studio...</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/15 p-8 text-center">
        <p className="text-base font-semibold text-red-200">
          {errorBanner || "Character not found."}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/characters">Return to Character Library</Link>
        </Button>
      </div>
    );
  }

  const canonicalUrl = resolveMediaUrl(character.canonical_reference_url);

  return (
    <div className="space-y-4">
      {/* Top Status / Error Notifications */}
      {statusBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/40 bg-violet-950/25 px-4 py-2.5 text-xs text-violet-200"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            {statusBanner}
          </span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setStatusBanner(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-950/25 px-4 py-2.5 text-xs text-red-200"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            {errorBanner}
          </span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorBanner(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Active Generation Progress Bar */}
      {isGenerating && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-violet-500/40 bg-violet-950/20 p-3 space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-violet-200">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
              {statusBanner || "Processing character asset..."}
            </span>
            <span>{generationProgress}%</span>
          </div>
          <progress
            aria-label="Character asset generation progress"
            max={100}
            value={generationProgress}
            className="h-1.5 w-full overflow-hidden rounded-full"
          />
        </div>
      )}

      {/* 3-Column Character Studio Workspace */}
      <div className="grid gap-5 xl:grid-cols-12">
        {/* LEFT PANEL: Character Library, Search, Categories & Create */}
        <aside className="space-y-4 rounded-2xl border border-zinc-800/90 bg-[#0b0b12] p-4 xl:col-span-3">
          <div className="flex items-center justify-between">
            <Link
              href="/characters"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-violet-300"
            >
              <Users className="h-3.5 w-3.5 text-violet-400" />
              Character Library ({libraryCharacters.length})
            </Link>
            <Button asChild size="sm" className="h-7 gap-1 px-2.5 text-xs">
              <Link href="/characters/new">
                <Plus className="h-3.5 w-3.5" />
                New
              </Link>
            </Button>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                aria-label="Search characters in library"
                placeholder="Search characters..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              aria-label="Filter characters by role"
              value={libraryRoleFilter}
              onChange={(e) => setLibraryRoleFilter(e.target.value)}
              className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-300"
            >
              <option value="all">All Roles</option>
              {CHARACTER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
            {filteredLibrary.map((item) => {
              const active = item.id === character.id;
              const thumb = resolveMediaUrl(item.canonical_reference_url);
              return (
                <Link
                  key={item.id}
                  href={`/characters/${item.id}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-2 transition-all",
                    active
                      ? "border-violet-500/50 bg-violet-600/15 text-white"
                      : "border-zinc-800/60 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-violet-300">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {item.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-400">
                      {item.role} · {item.style}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="border-t border-zinc-800/80 pt-3 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setVariationName(`${character.name} (Alt)`);
                setVariationStyle(character.style);
                setVariationNotes("");
                variationDialogRef.current?.showModal();
              }}
              className="w-full justify-center gap-1.5 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Create Character Variation
            </Button>

            {linkedStory && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSyncToStory()}
                className="w-full justify-center gap-1.5 text-xs text-violet-300 border-violet-500/30 hover:bg-violet-500/10"
              >
                <FolderSync className="h-3.5 w-3.5" />
                Sync to Story: {linkedStory.title.slice(0, 18)}
              </Button>
            )}
          </div>
        </aside>

        {/* CENTER PANEL: Character Preview, Tabs, and Sub-Studios */}
        <section className="space-y-5 xl:col-span-6">
          {/* Character Header & Canonical Reference Card */}
          <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-white">
                    {character.name}
                  </h1>
                  {character.nickname && (
                    <span className="text-xs text-zinc-400">
                      “{character.nickname}”
                    </span>
                  )}
                  <Badge variant="default">{character.role}</Badge>
                  <Badge variant="secondary">{character.style}</Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {character.species}
                  {character.age_description
                    ? ` · ${character.age_description}`
                    : ""}
                  {character.metadata?.category
                    ? ` · ${character.metadata.category}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-violet-500/50">
                  <Upload className="h-3.5 w-3.5 text-violet-400" />
                  Upload Reference
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      handleUploadReference(
                        e,
                        "uploaded_reference",
                        !character.canonical_reference_asset_id
                      )
                    }
                    className="sr-only"
                  />
                </label>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCharacter}
                  disabled={isSaving}
                  className="gap-1.5"
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

            {/* Canonical Preview + Variation Strip */}
            <div className="grid gap-4 sm:grid-cols-12">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:col-span-5">
                {canonicalUrl ? (
                  <>
                    <img
                      src={canonicalUrl}
                      alt={`${character.name} canonical reference`}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      Canonical Reference
                    </span>
                  </>
                ) : (
                  <div className="p-4 text-center space-y-2">
                    <ImagePlus className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="text-xs font-medium text-zinc-400">
                      No Canonical Reference Image Yet
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Upload a reference image or generate an AI Concept/Portrait
                      on the right panel.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between space-y-3 sm:col-span-7">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Canonical Appearance & Identity
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    {character.appearance_description ||
                      character.metadata?.character_bible
                        ?.canonical_description ||
                      "Configure appearance attributes below or in the Design tab to lock the character's visual identity."}
                  </p>
                  {character.personality.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {character.personality.map((trait) => (
                        <span
                          key={trait}
                          className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Asset Variations Strip */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      Generated & Uploaded Assets ({character.assets.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("assets")}
                      className="text-violet-400 hover:underline"
                    >
                      View all assets
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {character.assets.slice(0, 6).map((asset) => {
                      const imgUrl = resolveMediaUrl(asset.url);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setPreviewAsset(asset);
                            lightboxDialogRef.current?.showModal();
                          }}
                          className={cn(
                            "group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-zinc-950",
                            asset.is_canonical_reference
                              ? "border-amber-400"
                              : "border-zinc-800 hover:border-violet-500"
                          )}
                          title={`${asset.asset_type} (${asset.provider || "upload"})`}
                        >
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={asset.asset_type}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </button>
                      );
                    })}
                    {character.assets.length === 0 && (
                      <p className="text-[11px] text-zinc-500">
                        No image variations stored yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Single-Row Accessible Tab Bar (per Modern Web Guidance tabs rule) */}
            <div
              role="tablist"
              aria-label="Character Studio Sections"
              className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 pt-2 scrollbar-none"
            >
              {WORKSPACE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-xs font-semibold transition-colors",
                      isSelected
                        ? "text-white after:absolute after:inset-x-0 after:bottom-0 after:border-b-[3px] after:border-violet-500"
                        : "text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Dedicated Route Deep-Links Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span>Dedicated Studio Routes:</span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/characters/${character.id}`}
                  className="hover:text-violet-300"
                >
                  Overview
                </Link>
                <span>·</span>
                <Link
                  href={`/characters/${character.id}/design`}
                  className="hover:text-violet-300"
                >
                  /design
                </Link>
                <span>·</span>
                <Link
                  href={`/characters/${character.id}/expressions`}
                  className="hover:text-violet-300"
                >
                  /expressions
                </Link>
                <span>·</span>
                <Link
                  href={`/characters/${character.id}/poses`}
                  className="hover:text-violet-300"
                >
                  /poses
                </Link>
                <span>·</span>
                <Link
                  href={`/characters/${character.id}/outfits`}
                  className="hover:text-violet-300"
                >
                  /outfits
                </Link>
              </div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                Character Identity, Lore & Story Integration
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ov-name"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Character Name
                  </label>
                  <Input
                    id="ov-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ov-nickname"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Nickname
                  </label>
                  <Input
                    id="ov-nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label
                    htmlFor="ov-role"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Role
                  </label>
                  <select
                    id="ov-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100"
                  >
                    {CHARACTER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ov-species"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Species
                  </label>
                  <Input
                    id="ov-species"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ov-age"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Age Description
                  </label>
                  <Input
                    id="ov-age"
                    value={ageDescription}
                    onChange={(e) => setAgeDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ov-gender"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Gender Presentation
                  </label>
                  <Input
                    id="ov-gender"
                    value={genderPresentation}
                    onChange={(e) => setGenderPresentation(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ov-personality"
                  className="mb-1 block text-xs text-zinc-400"
                >
                  Personality Traits (comma-separated)
                </label>
                <Input
                  id="ov-personality"
                  value={personalityInput}
                  onChange={(e) => setPersonalityInput(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ov-backstory"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Backstory
                  </label>
                  <textarea
                    id="ov-backstory"
                    rows={3}
                    value={backstory}
                    onChange={(e) => setBackstory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ov-motivation"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Motivation
                  </label>
                  <textarea
                    id="ov-motivation"
                    rows={3}
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="ov-strengths"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Strengths
                  </label>
                  <Input
                    id="ov-strengths"
                    value={strengthsInput}
                    onChange={(e) => setStrengthsInput(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ov-weaknesses"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Weaknesses
                  </label>
                  <Input
                    id="ov-weaknesses"
                    value={weaknessesInput}
                    onChange={(e) => setWeaknessesInput(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ov-abilities"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Special Abilities
                  </label>
                  <Input
                    id="ov-abilities"
                    value={specialAbilitiesInput}
                    onChange={(e) => setSpecialAbilitiesInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Story Scene Assignment Integration */}
              {linkedStory && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-950/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-violet-200">
                        Story Cast & Scene Assignment: {linkedStory.title}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Assign {character.name} to story scenes or open the
                        Screenplay Studio.
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link href={`/studio/${linkedStory.project_id}`}>
                        Open Story Studio
                        <ExternalLink className="ml-1.5 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {linkedStory.document.scenes.map((scene) => {
                      const inScene =
                        (character.metadata?.story_character_id &&
                          scene.characters.includes(
                            character.metadata.story_character_id
                          )) ||
                        scene.characters.includes(character.id);
                      return (
                        <button
                          key={scene.id}
                          type="button"
                          onClick={() => handleSyncToStory([scene.id])}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                            inScene
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-violet-500"
                          )}
                        >
                          Scene {scene.scene_number}: {scene.title}{" "}
                          {inScene ? "✓" : "+ Assign"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DESIGN & CHARACTER SHEET / TURNAROUND GENERATOR */}
          {activeTab === "design" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                      Visual Character Designer
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Fine-tune physical features, proportions, signature
                      clothing, and color palette.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveCharacter}
                    disabled={isSaving}
                  >
                    Save Appearance
                  </Button>
                </div>

                <div>
                  <label
                    htmlFor="des-free"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Canonical Appearance Summary
                  </label>
                  <textarea
                    id="des-free"
                    rows={2}
                    value={appearanceDescription}
                    onChange={(e) => setAppearanceDescription(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-100"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="des-face"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Face Shape
                    </label>
                    <Input
                      id="des-face"
                      value={faceShape}
                      onChange={(e) => setFaceShape(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-eye-shape"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Eye Shape
                    </label>
                    <Input
                      id="des-eye-shape"
                      value={eyeShape}
                      onChange={(e) => setEyeShape(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-eye-color"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Eye Color
                    </label>
                    <Input
                      id="des-eye-color"
                      value={eyeColor}
                      onChange={(e) => setEyeColor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-hair-style"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Hair Style
                    </label>
                    <Input
                      id="des-hair-style"
                      value={hairStyle}
                      onChange={(e) => setHairStyle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-hair-color"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Hair Color
                    </label>
                    <Input
                      id="des-hair-color"
                      value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-skin"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Skin Tone / Material
                    </label>
                    <Input
                      id="des-skin"
                      value={skinTone}
                      onChange={(e) => setSkinTone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-body"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Body Type
                    </label>
                    <Input
                      id="des-body"
                      value={bodyType}
                      onChange={(e) => setBodyType(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-height"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Height / Proportions
                    </label>
                    <Input
                      id="des-height"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-clothing"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Signature Clothing
                    </label>
                    <Input
                      id="des-clothing"
                      value={clothing}
                      onChange={(e) => setClothing(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-acc"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Accessories
                    </label>
                    <Input
                      id="des-acc"
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-shoes"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Shoes / Footwear
                    </label>
                    <Input
                      id="des-shoes"
                      value={shoes}
                      onChange={(e) => setShoes(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="des-dist"
                      className="mb-1 block text-xs text-zinc-400"
                    >
                      Distinguishing Features
                    </label>
                    <Input
                      id="des-dist"
                      value={distinguishingFeatures}
                      onChange={(e) =>
                        setDistinguishingFeatures(e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="des-palette"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Color Palette (comma-separated)
                  </label>
                  <Input
                    id="des-palette"
                    value={colorPaletteInput}
                    onChange={(e) => setColorPaletteInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Character Sheet & Turnaround Generator */}
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                      Character Sheet & Turnaround Generator
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Generate orthographic views (Front, Side, Back, 3/4,
                      Full-Body, Portrait) as separate view assets or a combined
                      model sheet.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Turnaround sheet generation mode"
                      value={sheetMode}
                      onChange={(e) =>
                        setSheetMode(
                          e.target.value as "separate_views" | "combined_sheet"
                        )
                      }
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-200"
                    >
                      <option value="separate_views">
                        Separate View Assets (Recommended)
                      </option>
                      <option value="combined_sheet">
                        Combined Single Sheet Image
                      </option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGenerateTurnaroundSheet}
                      disabled={isGenerating}
                      className="gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate Sheet
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SUPPORTED_SHEET_VIEWS.map((view) => {
                    const checked = selectedSheetViews.includes(view.id);
                    return (
                      <label
                        key={view.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                          checked
                            ? "border-violet-500/60 bg-violet-600/15 text-white"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-400"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSheetViews((prev) => [
                                ...prev,
                                view.id,
                              ]);
                            } else {
                              setSelectedSheetViews((prev) =>
                                prev.filter((v) => v !== view.id)
                              );
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-zinc-700"
                        />
                        {view.label}
                      </label>
                    );
                  })}
                </div>

                {lastSheetSummary && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-zinc-200">
                      <span>
                        Turnaround Status:{" "}
                        {lastSheetSummary.complete
                          ? "Complete"
                          : "Partial Views Generated"}
                      </span>
                      <Badge
                        variant={
                          lastSheetSummary.complete ? "default" : "secondary"
                        }
                      >
                        {lastSheetSummary.views_generated.length}/
                        {lastSheetSummary.views_requested.length} Views
                      </Badge>
                    </div>
                    <p className="text-zinc-400">
                      Requested: {lastSheetSummary.views_requested.join(", ")} ·
                      Generated: {lastSheetSummary.views_generated.join(", ")}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {lastSheetSummary.consistency_note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EXPRESSION STUDIO */}
          {activeTab === "expressions" && (
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                    Expression Studio ({character.expressions.length})
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Manage facial expressions for dialogue scenes. Generate AI
                    expression portraits anchored to the Character Bible.
                  </p>
                </div>
              </div>

              {/* Add Custom Expression Form */}
              <form
                onSubmit={handleAddExpression}
                className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4">
                  <Input
                    aria-label="New expression name"
                    placeholder="Expression name (e.g., Smirking)"
                    value={newExprName}
                    onChange={(e) => setNewExprName(e.target.value)}
                    list="default-expression-presets"
                  />
                  <datalist id="default-expression-presets">
                    {DEFAULT_EXPRESSION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-6">
                  <Input
                    aria-label="New expression facial cue description"
                    placeholder="Facial micro-expression description..."
                    value={newExprDesc}
                    onChange={(e) => setNewExprDesc(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm" className="h-10 w-full gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </form>

              <div className="grid gap-3 sm:grid-cols-2">
                {character.expressions.map((expr) => {
                  const imgUrl = resolveMediaUrl(expr.reference_image_url);
                  const isEditing = editingExprId === expr.id;
                  return (
                    <div
                      key={expr.id}
                      className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                    >
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={expr.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Smile className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <Input
                              aria-label="Edit expression name"
                              value={editingExprName}
                              onChange={(e) =>
                                setEditingExprName(e.target.value)
                              }
                              className="h-7 text-xs"
                            />
                            <Input
                              aria-label="Edit expression description"
                              value={editingExprDesc}
                              onChange={(e) =>
                                setEditingExprDesc(e.target.value)
                              }
                              className="h-7 text-xs"
                            />
                            <div className="flex gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  handleSaveExpressionEdit(expr.id)
                                }
                                className="h-6 px-2 text-[11px]"
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingExprId(null)}
                                className="h-6 px-2 text-[11px]"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <p className="truncate text-xs font-semibold text-white">
                                {expr.name}
                              </p>
                              <Badge
                                variant={
                                  expr.generation_status === "completed"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {expr.generation_status}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-[11px] text-zinc-400">
                              {expr.description || "Standard expression preset"}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isGenerating}
                                onClick={() =>
                                  handleGenerateExpression(
                                    expr.id,
                                    expr.name,
                                    expr.description
                                  )
                                }
                                className="h-6 gap-1 px-2 text-[11px]"
                              >
                                <RefreshCw className="h-3 w-3" />
                                {imgUrl ? "Regenerate" : "Generate"}
                              </Button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExprId(expr.id);
                                  setEditingExprName(expr.name);
                                  setEditingExprDesc(expr.description || "");
                                }}
                                className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${expr.name} expression`}
                                onClick={() => handleDeleteExpression(expr.id)}
                                className="rounded p-1 text-zinc-500 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: POSE LIBRARY */}
          {activeTab === "poses" && (
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                  Pose Library ({character.poses.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Prepare reusable full-body action and staging poses for
                  storyboards and future 2D animation scenes.
                </p>
              </div>

              <form
                onSubmit={handleAddPose}
                className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-3">
                  <Input
                    aria-label="New pose name"
                    placeholder="Pose name"
                    value={newPoseName}
                    onChange={(e) => setNewPoseName(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <select
                    aria-label="New pose category"
                    value={newPoseCategory}
                    onChange={(e) => setNewPoseCategory(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-100"
                  >
                    {DEFAULT_POSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <Input
                    aria-label="New pose description"
                    placeholder="Action silhouette description..."
                    value={newPoseDesc}
                    onChange={(e) => setNewPoseDesc(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm" className="h-10 w-full gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add Pose
                  </Button>
                </div>
              </form>

              <div className="grid gap-3 sm:grid-cols-2">
                {character.poses.map((pose) => {
                  const imgUrl = resolveMediaUrl(pose.reference_image_url);
                  return (
                    <div
                      key={pose.id}
                      className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                    >
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={pose.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Layers className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-xs font-semibold text-white">
                            {pose.name}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {pose.category}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-[11px] text-zinc-400">
                          {pose.description || `${pose.category} pose`}
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isGenerating}
                            onClick={() =>
                              handleGeneratePose(
                                pose.id,
                                pose.name,
                                pose.category,
                                pose.description
                              )
                            }
                            className="h-6 gap-1 px-2 text-[11px]"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {imgUrl ? "Regenerate" : "Generate"}
                          </Button>
                          <button
                            type="button"
                            aria-label={`Delete ${pose.name} pose`}
                            onClick={() => handleDeletePose(pose.id)}
                            className="rounded p-1 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: OUTFIT STUDIO */}
          {activeTab === "outfits" && (
            <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                  Outfit Studio ({character.outfits.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Create multiple wardrobe variations while preserving facial
                  identity, hair, and body proportions. Setting a default outfit
                  never overwrites the character&apos;s canonical appearance
                  record.
                </p>
              </div>

              <form
                onSubmit={handleAddOutfit}
                className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Input
                      aria-label="Outfit name"
                      placeholder="Outfit name (e.g., School uniform, Winter clothing)"
                      value={newOutfitName}
                      onChange={(e) => setNewOutfitName(e.target.value)}
                      list="outfit-preset-options"
                    />
                    <datalist id="outfit-preset-options">
                      {DEFAULT_OUTFIT_PRESETS.map((preset) => (
                        <option key={preset} value={preset} />
                      ))}
                    </datalist>
                  </div>
                  <Input
                    aria-label="Outfit description"
                    placeholder="Garment materials, silhouette, footwear..."
                    value={newOutfitDesc}
                    onChange={(e) => setNewOutfitDesc(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Input
                      aria-label="Outfit color palette"
                      placeholder="Color palette (e.g., Navy, Gold, White)"
                      value={newOutfitPalette}
                      onChange={(e) => setNewOutfitPalette(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Input
                      aria-label="Outfit accessories"
                      placeholder="Accessories (e.g., Crest badge, Satchel)"
                      value={newOutfitAccessories}
                      onChange={(e) => setNewOutfitAccessories(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:col-span-3">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={newOutfitDefault}
                        onChange={(e) => setNewOutfitDefault(e.target.checked)}
                      />
                      Default
                    </label>
                    <Button type="submit" size="sm" className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Add Outfit
                    </Button>
                  </div>
                </div>
              </form>

              <div className="grid gap-3 sm:grid-cols-2">
                {character.outfits.map((outfit) => {
                  const imgUrl = resolveMediaUrl(outfit.reference_image_url);
                  return (
                    <div
                      key={outfit.id}
                      className={cn(
                        "flex gap-3 rounded-xl border p-3",
                        outfit.is_default
                          ? "border-violet-500/50 bg-violet-950/15"
                          : "border-zinc-800 bg-zinc-900/40"
                      )}
                    >
                      <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={outfit.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Shirt className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-semibold text-white">
                            {outfit.name}
                          </p>
                          {outfit.is_default && (
                            <Badge variant="default" className="text-[10px]">
                              Default Outfit
                            </Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[11px] text-zinc-400">
                          {outfit.description || "Custom wardrobe variation"}
                        </p>
                        {outfit.color_palette.length > 0 && (
                          <p className="truncate text-[10px] text-zinc-500">
                            Palette: {outfit.color_palette.join(", ")}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isGenerating}
                            onClick={() =>
                              handleGenerateOutfit(
                                outfit.id,
                                outfit.name,
                                outfit.description,
                                outfit.color_palette,
                                outfit.accessories,
                                outfit.is_default
                              )
                            }
                            className="h-6 gap-1 px-2 text-[11px]"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {imgUrl ? "Regenerate" : "Generate"}
                          </Button>
                          {!outfit.is_default && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultOutfit(outfit.id)}
                              className="rounded px-2 py-0.5 text-[11px] text-violet-300 hover:bg-violet-500/15"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Delete ${outfit.name} outfit`}
                            onClick={() => handleDeleteOutfit(outfit.id)}
                            className="rounded p-1 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: ASSET LIBRARY & GENERATION JOBS */}
          {activeTab === "assets" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
                      Character Asset Library ({filteredAssets.length})
                    </h2>
                    <p className="text-xs text-zinc-400">
                      All uploaded reference images, AI concepts, portraits,
                      full-body renders, turnaround views, expressions, poses,
                      and outfits.
                    </p>
                  </div>
                  <select
                    aria-label="Filter character assets by type"
                    value={assetTypeFilter}
                    onChange={(e) => setAssetTypeFilter(e.target.value)}
                    className="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-200"
                  >
                    <option value="all">All Asset Types</option>
                    <option value="uploaded_reference">
                      Uploaded References
                    </option>
                    <option value="concept">Concept Art</option>
                    <option value="portrait">Portraits</option>
                    <option value="full_body">Full-Body Views</option>
                    <option value="front_view">Front Views</option>
                    <option value="side_view">Side Views</option>
                    <option value="back_view">Back Views</option>
                    <option value="three_quarter_view">3/4 Views</option>
                    <option value="character_sheet">Combined Sheets</option>
                    <option value="expression">Expressions</option>
                    <option value="pose">Poses</option>
                    <option value="outfit">Outfits</option>
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {filteredAssets.map((asset) => {
                    const imgUrl = resolveMediaUrl(asset.url);
                    const dlUrl = resolveMediaUrl(asset.download_url);
                    return (
                      <div
                        key={asset.id}
                        className="flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
                      >
                        <div className="relative aspect-square bg-zinc-950">
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={asset.asset_type}
                              className="h-full w-full object-contain"
                            />
                          )}
                          {asset.is_canonical_reference && (
                            <span className="absolute left-2 top-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/40">
                              Canonical
                            </span>
                          )}
                        </div>
                        <div className="p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-zinc-200">
                              {asset.asset_type.replace(/_/g, " ")}
                            </span>
                            <span className="text-zinc-500">
                              {asset.provider || "upload"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewAsset(asset);
                                lightboxDialogRef.current?.showModal();
                              }}
                              className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-700"
                            >
                              <Eye className="h-3 w-3" />
                              Inspect
                            </button>
                            {!asset.is_canonical_reference && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetCanonicalAsset(asset.id)
                                }
                                className="rounded bg-violet-600/20 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-600/30"
                              >
                                Set Canonical
                              </button>
                            )}
                            {dlUrl && (
                              <a
                                href={dlUrl}
                                download
                                className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:text-white"
                              >
                                <Download className="h-3 w-3" />
                              </a>
                            )}
                            <button
                              type="button"
                              aria-label="Delete asset"
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="rounded p-1 text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Generation Job Audit Trail */}
              <div className="rounded-2xl border border-zinc-800/90 bg-[#0d0d14] p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  AI Generation Job History ({character.generation_jobs.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {character.generation_jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-200">
                          {job.generation_type.replace(/_/g, " ")} ·{" "}
                          {job.provider || "provider"}
                        </span>
                        <Badge
                          variant={
                            job.status === "completed" ? "default" : "secondary"
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                      {job.prompt && (
                        <p className="line-clamp-2 text-[11px] text-zinc-400">
                          Prompt: {job.prompt}
                        </p>
                      )}
                      {job.error_message && (
                        <p className="text-[11px] text-red-300">
                          Error: {job.error_message}
                        </p>
                      )}
                    </div>
                  ))}
                  {character.generation_jobs.length === 0 && (
                    <p className="text-xs text-zinc-500">
                      No AI generation jobs recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: Style Settings, Consistency Bible & AI Generation Controls */}
        <aside className="space-y-4 rounded-2xl border border-zinc-800/90 bg-[#0b0b12] p-4 xl:col-span-3">
          {/* Provider Status */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                AI Image Engine
              </span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  aiStatus?.configured ? "bg-emerald-400" : "bg-amber-400"
                )}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              {aiStatus?.configured
                ? `Active: ${aiStatus.provider} (${aiStatus.model})`
                : "Manual & Reference Upload mode active. Set IMAGE_API_KEY in backend/.env to enable AI image synthesis."}
            </p>
          </div>

          {/* Style Selector */}
          <div className="space-y-2">
            <label
              htmlFor="rp-style"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
            >
              Character Visual Style
            </label>
            <select
              id="rp-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100"
            >
              {CHARACTER_VISUAL_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {style === "Custom" && (
              <Input
                aria-label="Custom style description"
                placeholder="Describe custom visual style..."
                value={customStyleDescription}
                onChange={(e) => setCustomStyleDescription(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>

          {/* Character Consistency Bible */}
          <div className="space-y-2.5 border-t border-zinc-800/80 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Character Consistency Bible
            </p>
            <div>
              <label
                htmlFor="rp-bible-desc"
                className="mb-1 block text-[11px] text-zinc-400"
              >
                Canonical Visual Anchor
              </label>
              <textarea
                id="rp-bible-desc"
                rows={2}
                placeholder="Core identity lock used across all prompts..."
                value={canonicalDescription}
                onChange={(e) => setCanonicalDescription(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-xs text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="rp-bible-notes"
                className="mb-1 block text-[11px] text-zinc-400"
              >
                Invariant Identity Notes
              </label>
              <Input
                id="rp-bible-notes"
                placeholder="e.g., Always wears star pendant"
                value={identityNotes}
                onChange={(e) => setIdentityNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2 text-[10px] leading-relaxed text-zinc-400">
              {character.metadata?.character_bible?.consistency_disclaimer ||
                "AI image generation preserves character traits using the Canonical Character Bible and reference prompts, though minor visual variations may occur across generations."}
            </p>
          </div>

          {/* AI Generation Controls & Prompt Builder */}
          <div className="space-y-3 border-t border-zinc-800/80 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              AI Character Generation
            </p>

            <div>
              <label
                htmlFor="rp-gen-type"
                className="mb-1 block text-[11px] text-zinc-400"
              >
                Generation Target
              </label>
              <select
                id="rp-gen-type"
                value={genType}
                onChange={(e) =>
                  setGenType(
                    e.target.value as "concept" | "portrait" | "full_body"
                  )
                }
                className="h-9 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100"
              >
                <option value="concept">Generate Character Concept</option>
                <option value="portrait">Generate Character Portrait</option>
                <option value="full_body">Generate Full-Body Character</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rp-framing"
                className="mb-1 block text-[11px] text-zinc-400"
              >
                Camera Framing (Optional)
              </label>
              <Input
                id="rp-framing"
                placeholder="e.g., Medium close-up, Eye-level"
                value={cameraFraming}
                onChange={(e) => setCameraFraming(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="rp-bg"
                className="mb-1 block text-[11px] text-zinc-400"
              >
                Background Setting
              </label>
              <Input
                id="rp-bg"
                value={backgroundSetting}
                onChange={(e) => setBackgroundSetting(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="rp-instructions"
                className="mb-1 block text-[11px] text-zinc-400"
              >
                Additional Generation Instructions
              </label>
              <Input
                id="rp-instructions"
                placeholder="e.g., Soft golden hour rim lighting"
                value={userInstructions}
                onChange={(e) => setUserInstructions(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="rp-prompt-override"
                  className="text-[11px] font-medium text-zinc-300"
                >
                  Prompt Builder Preview / Override
                </label>
                <button
                  type="button"
                  onClick={handlePreviewPrompt}
                  className="text-[11px] font-medium text-violet-400 hover:underline"
                >
                  Build Prompt
                </button>
              </div>
              <textarea
                id="rp-prompt-override"
                rows={4}
                placeholder="Click 'Build Prompt' to inspect the structured prompt synthesized from your Character Bible, or customize it directly..."
                value={customPromptOverride}
                onChange={(e) => setCustomPromptOverride(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-[11px] text-zinc-200"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={setGeneratedAsCanonical}
                onChange={(e) => setSetGeneratedAsCanonical(e.target.checked)}
              />
              Set generated image as Canonical Reference
            </label>

            <Button
              type="button"
              onClick={handleGenerateSingleImage}
              disabled={isGenerating}
              className="w-full justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate{" "}
                  {genType === "concept"
                    ? "Concept"
                    : genType === "portrait"
                    ? "Portrait"
                    : "Full Body"}
                </>
              )}
            </Button>
          </div>
        </aside>
      </div>

      {/* Native Modal Dialog 1: Asset Inspection & Side-by-Side Comparison */}
      <dialog
        ref={lightboxDialogRef}
        closedby="any"
        aria-labelledby="asset-lightbox-title"
        className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-[#0d0d14] p-6 text-zinc-100 shadow-2xl"
      >
        {previewAsset && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2
                  id="asset-lightbox-title"
                  className="text-base font-bold text-white"
                >
                  {character.name} —{" "}
                  {previewAsset.asset_type.replace(/_/g, " ").toUpperCase()}
                </h2>
                <p className="text-xs text-zinc-400">
                  Provider: {previewAsset.provider || "Uploaded Reference"} ·
                  Status: {previewAsset.generation_status}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close asset preview"
                onClick={() => lightboxDialogRef.current?.close()}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-400">
                  Selected Asset
                </p>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  {resolveMediaUrl(previewAsset.url) && (
                    <img
                      src={resolveMediaUrl(previewAsset.url)!}
                      alt={previewAsset.asset_type}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">
                    Compare With Variation
                  </span>
                  <select
                    aria-label="Select variation to compare"
                    value={compareAsset?.id || ""}
                    onChange={(e) => {
                      const found = character.assets.find(
                        (a) => a.id === e.target.value
                      );
                      setCompareAsset(found || null);
                    }}
                    className="h-7 rounded border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-200"
                  >
                    <option value="">Canonical Reference</option>
                    {character.assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.asset_type} ({a.id.slice(0, 6)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  {compareAsset ? (
                    <img
                      src={resolveMediaUrl(compareAsset.url)!}
                      alt={compareAsset.asset_type}
                      className="h-full w-full object-contain"
                    />
                  ) : canonicalUrl ? (
                    <img
                      src={canonicalUrl}
                      alt="Canonical reference"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <p className="text-xs text-zinc-500">
                      No comparison image selected.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {previewAsset.prompt && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-200">
                  Prompt Used:{" "}
                </span>
                {previewAsset.prompt}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {!previewAsset.is_canonical_reference && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleSetCanonicalAsset(previewAsset.id);
                    lightboxDialogRef.current?.close();
                  }}
                >
                  Set as Canonical Reference
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => lightboxDialogRef.current?.close()}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </dialog>

      {/* Native Modal Dialog 2: Create Character Variation */}
      <dialog
        ref={variationDialogRef}
        closedby="any"
        aria-labelledby="variation-dialog-title"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0d0d14] p-6 text-zinc-100 shadow-2xl"
      >
        <form onSubmit={handleCreateVariation} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="variation-dialog-title"
              className="text-base font-bold text-white"
            >
              Create Character Variation
            </h2>
            <button
              type="button"
              aria-label="Close variation dialog"
              onClick={() => variationDialogRef.current?.close()}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            Clones {character.name}&apos;s appearance and Character Bible into a
            new character record so you can explore alternate eras, styles, or
            transformations.
          </p>
          <div>
            <label
              htmlFor="var-name"
              className="mb-1 block text-xs text-zinc-300"
            >
              Variation Name
            </label>
            <Input
              id="var-name"
              required
              value={variationName}
              onChange={(e) => setVariationName(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="var-style"
              className="mb-1 block text-xs text-zinc-300"
            >
              Visual Style
            </label>
            <select
              id="var-style"
              value={variationStyle}
              onChange={(e) => setVariationStyle(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100"
            >
              {CHARACTER_VISUAL_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="var-notes"
              className="mb-1 block text-xs text-zinc-300"
            >
              Variation Notes
            </label>
            <Input
              id="var-notes"
              placeholder="e.g., Timeskip 5 years later, Awakened form"
              value={variationNotes}
              onChange={(e) => setVariationNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => variationDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create Variation
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
