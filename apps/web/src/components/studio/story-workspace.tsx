"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  Copy,
  Film,
  Globe,
  History,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  Music,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import type {
  AIAssistantActionType,
  CharacterSummaryRecord,
  DialogueEntryData,
  EnvironmentSummaryRecord,
  NarrationEntryData,
  StoryAIAssistProposalResponse,
  StoryCharacterData,
  StoryLocationData,
  StoryOutputDocument,
  StoryResponse,
  StorySceneData,
  StoryVersionItem,
} from "@tr-studio/shared-types";
import { STORY_LANGUAGES } from "@tr-studio/scene-schema";
import { api, ApiClientError, resolveMediaUrl } from "@/lib/api";
import { formatRelativeDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type StudioViewSection =
  | "all"
  | "story"
  | "characters"
  | "locations"
  | "scenes"
  | "screenplay"
  | "storyboard"
  | "versions";

const AI_ASSISTANT_ACTIONS: {
  action: AIAssistantActionType;
  label: string;
  description: string;
}[] = [
  {
    action: "improve_story",
    label: "Improve This Story",
    description: "Elevate pacing, dialogue sharpness, and visual staging",
  },
  {
    action: "make_funnier",
    label: "Make It Funnier",
    description: "Infuse witty banter and comedic visual timing",
  },
  {
    action: "make_emotional",
    label: "Make It More Emotional",
    description: "Deepen emotional stakes and poignant character beats",
  },
  {
    action: "add_suspense",
    label: "Add Suspense",
    description: "Heighten mystery, tension, and cliffhanger beats",
  },
  {
    action: "improve_ending",
    label: "Improve the Ending",
    description: "Strengthen Act III climax and resolution",
  },
  {
    action: "unexpected_twist",
    label: "Create Unexpected Twist",
    description: "Introduce a foreshadowed narrative plot twist",
  },
  {
    action: "simplify_story",
    label: "Simplify the Story",
    description: "Streamline subplots and clarify character goals",
  },
  {
    action: "expand_story",
    label: "Expand the Story",
    description: "Enrich world lore, character arcs, and scene depth",
  },
  {
    action: "rewrite_dialogue",
    label: "Rewrite Dialogue",
    description: "Polish character voices and emotional delivery",
  },
  {
    action: "improve_character",
    label: "Improve Character Personality",
    description: "Distinct voice quirks, motivations, and relationships",
  },
  {
    action: "add_detailed_scenes",
    label: "Add More Detailed Scenes",
    description: "Expand camera framing, audio cues, and action beats",
  },
  {
    action: "continue_story",
    label: "Continue Story (+Scenes)",
    description: "Generate the next narrative scene continuation",
  },
  {
    action: "generate_screenplay",
    label: "Generate Screenplay",
    description: "Full scene beats, sluglines, and spoken character dialogue",
  },
  {
    action: "generate_scene_breakdown",
    label: "Generate Scene Breakdown",
    description: "Structured scene-by-scene progression with camera staging",
  },
  {
    action: "generate_dialogue",
    label: "Generate Dialogue",
    description: "Expressive character dialogue and delivery directions",
  },
  {
    action: "generate_narration",
    label: "Generate Narration",
    description: "Atmospheric voiceover lines for visual storytelling",
  },
  {
    action: "regenerate_story",
    label: "Regenerate Entire Story",
    description: "Fresh take on 3-act arcs, characters, and scenes",
  },
  {
    action: "expand_idea",
    label: "Expand Story Idea",
    description: "Enrich premise, world lore, and narrative depth",
  },
  {
    action: "generate_title",
    label: "Generate Story Title",
    description: "Create an evocative, cinematic title for your production",
  },
  {
    action: "alternative_endings",
    label: "Alternative Endings",
    description: "Explore unexpected climaxes and memorable resolutions",
  },
];

function makeUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface StoryWorkspaceProps {
  projectId: string;
  initialStory: StoryResponse;
  defaultSection?: StudioViewSection;
}

export function StoryWorkspace({
  projectId,
  initialStory,
  defaultSection = "all",
}: StoryWorkspaceProps) {
  const [storyMeta, setStoryMeta] = useState<StoryResponse>(initialStory);
  const [doc, setDoc] = useState<StoryOutputDocument>(initialStory.document);
  const [activeTab, setActiveTab] = useState<StudioViewSection>(
    defaultSection === "all" ? "story" : defaultSection
  );

  // Autosave & manual save state
  const [saveState, setSaveState] = useState<
    "saved" | "unsaved" | "saving" | "error"
  >("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);

  // Version history state
  const [versions, setVersions] = useState<StoryVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionLabelInput, setVersionLabelInput] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);

  // Character Studio integration state
  const [studioCharacters, setStudioCharacters] = useState<
    CharacterSummaryRecord[]
  >([]);
  const [selectedImportCharId, setSelectedImportCharId] = useState<string>("");
  const [syncingCharacters, setSyncingCharacters] = useState(false);
  const [characterSyncNotice, setCharacterSyncNotice] = useState<string | null>(
    null
  );

  const fetchStudioCharacters = useCallback(async () => {
    try {
      const list = await api.characters.list();
      setStudioCharacters(list);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void fetchStudioCharacters();
  }, [fetchStudioCharacters]);

  const handleSyncCastToCharacterStudio = async () => {
    setSyncingCharacters(true);
    setCharacterSyncNotice(null);
    try {
      const synced = await api.characters.importFromStory(storyMeta.id);
      await fetchStudioCharacters();
      setCharacterSyncNotice(
        `Synced ${synced.length} story character(s) into Character Studio without duplication.`
      );
    } catch (err) {
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to sync story characters to Character Studio."
      );
    } finally {
      setSyncingCharacters(false);
    }
  };

  const handleImportFromCharacterStudio = async () => {
    if (!selectedImportCharId) return;
    setSyncingCharacters(true);
    setCharacterSyncNotice(null);
    try {
      await api.characters.syncToStory(selectedImportCharId, {
        story_id: storyMeta.id,
      });
      const refreshedStory = await api.stories.get(storyMeta.id);
      setStoryMeta(refreshedStory);
      setDoc(refreshedStory.document);
      await fetchStudioCharacters();
      setSelectedImportCharId("");
      setCharacterSyncNotice(
        "Imported character from Character Studio into this story."
      );
    } catch (err) {
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to import character from Character Studio."
      );
    } finally {
      setSyncingCharacters(false);
    }
  };

  // Step 4: World & Environment Studio bidirectional integration
  const [studioEnvironments, setStudioEnvironments] = useState<
    EnvironmentSummaryRecord[]
  >([]);
  const [selectedImportEnvId, setSelectedImportEnvId] = useState<string>("");
  const [syncingEnvironments, setSyncingEnvironments] = useState(false);
  const [environmentSyncNotice, setEnvironmentSyncNotice] = useState<
    string | null
  >(null);

  const fetchStudioEnvironments = useCallback(async () => {
    try {
      const list = await api.environments.list();
      setStudioEnvironments(list);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void fetchStudioEnvironments();
  }, [fetchStudioEnvironments]);

  const handleSyncLocationsToEnvironmentStudio = async () => {
    setSyncingEnvironments(true);
    setEnvironmentSyncNotice(null);
    try {
      const synced = await api.environments.importFromStory(storyMeta.id);
      await fetchStudioEnvironments();
      setEnvironmentSyncNotice(
        `Synced ${synced.length} story location(s) into World & Environment Studio without duplication.`
      );
    } catch (err) {
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to sync story locations to Environment Studio."
      );
    } finally {
      setSyncingEnvironments(false);
    }
  };

  const handleImportFromEnvironmentStudio = async () => {
    if (!selectedImportEnvId) return;
    setSyncingEnvironments(true);
    setEnvironmentSyncNotice(null);
    try {
      await api.environments.syncToStory(selectedImportEnvId, {
        story_id: storyMeta.id,
      });
      const refreshedStory = await api.stories.get(storyMeta.id);
      setStoryMeta(refreshedStory);
      setDoc(refreshedStory.document);
      await fetchStudioEnvironments();
      setSelectedImportEnvId("");
      setEnvironmentSyncNotice(
        "Imported environment from Environment Studio into this story."
      );
    } catch (err) {
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to import environment from Environment Studio."
      );
    } finally {
      setSyncingEnvironments(false);
    }
  };

  // AI Assistant state & non-destructive proposal modal
  const [aiRunningAction, setAiRunningAction] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [translateLang, setTranslateLang] = useState("Japanese");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [proposal, setProposal] =
    useState<StoryAIAssistProposalResponse | null>(null);
  const proposalDialogRef = useRef<HTMLDialogElement>(null);
  const proposalTitleId = useId();

  // Load version history
  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const list = await api.stories.listVersions(storyMeta.id);
      setVersions(list);
    } catch {
      // Ignore
    } finally {
      setLoadingVersions(false);
    }
  }, [storyMeta.id]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  // Warn before unloading browser tab if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Perform save to backend
  const persistStory = useCallback(
    async (
      nextDoc: StoryOutputDocument,
      createVersion = false,
      versionLabel?: string
    ) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const updated = await api.stories.update(storyMeta.id, {
          title: nextDoc.story.title,
          logline: nextDoc.story.logline || "",
          summary: nextDoc.story.summary || "",
          full_plot: nextDoc.story.full_plot || "",
          beginning: nextDoc.story.beginning || "",
          middle: nextDoc.story.middle || "",
          ending_act: nextDoc.story.ending || "",
          genre: nextDoc.story.genre,
          animation_style: nextDoc.story.animation_style,
          target_audience: nextDoc.story.target_audience,
          duration_minutes: nextDoc.story.duration_minutes,
          language: nextDoc.story.language,
          tone: nextDoc.story.tone,
          complexity: nextDoc.story.complexity,
          ending_type: nextDoc.story.ending_type,
          themes: nextDoc.story.themes,
          world_description: nextDoc.story.world_description || "",
          characters: nextDoc.characters,
          locations: nextDoc.locations,
          scenes: nextDoc.scenes,
          create_version: createVersion,
          version_label: versionLabel,
        });
        setStoryMeta(updated);
        setDoc(updated.document);
        setIsDirty(false);
        setSaveState("saved");
        if (createVersion) {
          void fetchVersions();
        }
      } catch (err) {
        setSaveState("error");
        setSaveError(
          err instanceof ApiClientError
            ? err.message
            : "Autosave failed. Your changes are still preserved in the editor."
        );
      }
    },
    [storyMeta.id, fetchVersions]
  );

  // Trigger debounced autosave (1.8s after user edits)
  const updateDoc = useCallback(
    (updater: (prev: StoryOutputDocument) => StoryOutputDocument) => {
      setDoc((prev) => {
        const next = updater(prev);
        setIsDirty(true);
        setSaveState("unsaved");
        if (autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current);
        }
        autosaveTimerRef.current = window.setTimeout(() => {
          void persistStory(next, false);
        }, 1800);
        return next;
      });
    },
    [persistStory]
  );

  // Open/close native <dialog> for AI proposal review
  useEffect(() => {
    const dialog = proposalDialogRef.current;
    if (!dialog) return;
    if (proposal && !dialog.open) {
      dialog.showModal();
    } else if (!proposal && dialog.open) {
      dialog.close();
    }
  }, [proposal]);

  const handleRunAIAssist = async (
    action: AIAssistantActionType,
    extra?: { targetSceneId?: string; targetCharacterId?: string }
  ) => {
    setAiRunningAction(action);
    setAiError(null);
    try {
      const res = await api.stories.improveStory(storyMeta.id, {
        action,
        target_language:
          action === "translate_story" ? translateLang : undefined,
        target_scene_id: extra?.targetSceneId,
        target_character_id: extra?.targetCharacterId,
        instructions: aiCustomPrompt.trim() || undefined,
        apply_immediately: false,
      });
      setProposal(res);
    } catch (err) {
      setAiError(
        err instanceof ApiClientError
          ? err.message
          : "AI assistant action failed."
      );
    } finally {
      setAiRunningAction(null);
    }
  };

  const handleAcceptProposal = async () => {
    if (!proposal) return;
    const acceptedDoc = proposal.proposed_document;
    const actionName = proposal.action;
    setProposal(null);
    await persistStory(
      acceptedDoc,
      true,
      `Accepted AI Proposal: ${actionName.replace(/_/g, " ")}`
    );
  };

  // Scene helpers
  const handleAddScene = () => {
    updateDoc((prev) => {
      const nextNum = prev.scenes.length + 1;
      const defaultLoc = prev.locations[0];
      const newScene: StorySceneData = {
        id: makeUuid(),
        scene_number: nextNum,
        title: `Scene ${nextNum}: New Beat`,
        scene_heading: `EXT. ${
          defaultLoc ? defaultLoc.name.toUpperCase() : "LOCATION"
        } - DAY`,
        location_id: defaultLoc?.id || null,
        location_name: defaultLoc?.name || "Primary Setting",
        description: "Describe what happens in this scene.",
        action_description: "Staging and character actions.",
        duration_seconds: 30,
        characters: prev.characters.slice(0, 2).map((c) => c.name),
        dialogue: [],
        narration: [],
        camera_directions: ["WIDE SHOT"],
        audio_directions: ["Ambient background tone"],
        visual_directions: [],
        emotional_directions: [prev.story.tone],
        storyboard_notes: "",
      };
      return {
        ...prev,
        scenes: [...prev.scenes, newScene],
      };
    });
  };

  const handleDuplicateScene = async (sceneId: string) => {
    try {
      await api.scenes.duplicate(sceneId);
      const refreshed = await api.stories.get(storyMeta.id);
      setStoryMeta(refreshed);
      setDoc(refreshed.document);
    } catch {
      // Fallback local duplicate
      updateDoc((prev) => {
        const idx = prev.scenes.findIndex((s) => s.id === sceneId);
        if (idx === -1) return prev;
        const orig = prev.scenes[idx];
        const copy: StorySceneData = {
          ...orig,
          id: makeUuid(),
          title: `${orig.title} (Copy)`,
          dialogue: orig.dialogue.map((d) => ({ ...d, id: makeUuid() })),
          narration: orig.narration.map((n) => ({ ...n, id: makeUuid() })),
        };
        const nextScenes = [...prev.scenes];
        nextScenes.splice(idx + 1, 0, copy);
        return {
          ...prev,
          scenes: nextScenes.map((s, i) => ({ ...s, scene_number: i + 1 })),
        };
      });
    }
  };

  const handleDeleteScene = (sceneId: string, sceneTitle: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${sceneTitle}"? You can restore saved versions at any time.`)
    ) {
      return;
    }
    updateDoc((prev) => ({
      ...prev,
      scenes: prev.scenes
        .filter((s) => s.id !== sceneId)
        .map((s, idx) => ({ ...s, scene_number: idx + 1 })),
    }));
  };

  const handleMoveScene = (index: number, direction: -1 | 1) => {
    updateDoc((prev) => {
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= prev.scenes.length) return prev;
      const nextScenes = [...prev.scenes];
      const [moved] = nextScenes.splice(index, 1);
      nextScenes.splice(targetIdx, 0, moved);
      return {
        ...prev,
        scenes: nextScenes.map((s, i) => ({ ...s, scene_number: i + 1 })),
      };
    });
  };

  // Character & Location helpers
  const handleAddCharacter = () => {
    updateDoc((prev) => {
      const newChar: StoryCharacterData = {
        id: makeUuid(),
        name: `New Character ${prev.characters.length + 1}`,
        role: "Supporting",
        age_description: "Young adult",
        personality: ["Curious", "Loyal"],
        appearance_description: "Describe hair, outfit, silhouette, and palette.",
        motivation: "Core objective in the story.",
        backstory: "Character background.",
        relationships: [],
      };
      return {
        ...prev,
        characters: [...prev.characters, newChar],
      };
    });
  };

  const handleDeleteCharacter = (charId: string) => {
    updateDoc((prev) => ({
      ...prev,
      characters: prev.characters.filter((c) => c.id !== charId),
    }));
  };

  const handleAddLocation = () => {
    updateDoc((prev) => {
      const newLoc: StoryLocationData = {
        id: makeUuid(),
        name: `Location ${prev.locations.length + 1}`,
        description: "Architectural and environmental details.",
        atmosphere: "Mysterious",
        time_of_day: "Evening",
        environment_requirements: "Lighting and parallax layers.",
      };
      return {
        ...prev,
        locations: [...prev.locations, newLoc],
      };
    });
  };

  const handleDeleteLocation = (locId: string) => {
    updateDoc((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l.id !== locId),
    }));
  };

  // Save explicit named version
  const handleCreateNamedVersion = async () => {
    setSavingVersion(true);
    try {
      await persistStory(
        doc,
        true,
        versionLabelInput.trim() || `Checkpoint v${storyMeta.current_version_number + 1}`
      );
      setVersionLabelInput("");
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestoreVersion = async (v: StoryVersionItem) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Restore Version #${v.version_number} ("${v.label}")? A new version snapshot will be recorded so no history is lost.`
      )
    ) {
      return;
    }
    try {
      const restored = await api.stories.restoreVersion(storyMeta.id, v.id);
      setStoryMeta(restored);
      setDoc(restored.document);
      setIsDirty(false);
      setSaveState("saved");
      void fetchVersions();
    } catch (err) {
      setSaveError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to restore version."
      );
    }
  };

  const totalDurationSeconds = doc.scenes.reduce(
    (acc, s) => acc + (Number(s.duration_seconds) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Workspace Control Bar */}
      <div className="sticky top-16 z-20 flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800/90 bg-[#0b0b12]/95 p-4 shadow-xl backdrop-blur-md lg:flex-row lg:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{doc.story.genre}</Badge>
            <Badge variant="secondary">{doc.story.animation_style}</Badge>
            <Badge variant="outline">
              {doc.scenes.length} Scenes • ~{Math.ceil(totalDurationSeconds / 60)}m (
              {totalDurationSeconds}s)
            </Badge>
            <Badge variant="outline">v{storyMeta.current_version_number}</Badge>
          </div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            {doc.story.title}
          </h1>
        </div>

        {/* Save Status & Quick Route Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-xs"
          >
            {saveState === "saving" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <span className="text-zinc-300">Autosaving...</span>
              </>
            )}
            {saveState === "saved" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">All changes saved</span>
              </>
            )}
            {saveState === "unsaved" && (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-amber-300">Unsaved edits...</span>
              </>
            )}
            {saveState === "error" && (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-300">Save error</span>
              </>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void persistStory(
                doc,
                true,
                `Saved Checkpoint (${new Date().toLocaleTimeString()})`
              )
            }
            disabled={saveState === "saving"}
          >
            <Save className="h-3.5 w-3.5" />
            Save Version
          </Button>

          {/* Sub-route links required by Section 2 */}
          <div className="hidden items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1 xl:flex">
            <Link
              href={`/studio/${projectId}`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Full Studio
            </Link>
            <Link
              href={`/studio/${projectId}/story`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Story Bible
            </Link>
            <Link
              href={`/studio/${projectId}/screenplay`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Screenplay
            </Link>
            <Link
              href={`/studio/${projectId}/storyboard`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Storyboard
            </Link>
            <Link
              href={`/studio/${projectId}/scenes`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Scenes
            </Link>
            <Link
              href={`/studio/${projectId}/shot-list`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Shot List
            </Link>
            <Link
              href={`/studio/${projectId}/animation`}
              className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Animation
            </Link>
          </div>
        </div>
      </div>

      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-200"
        >
          {saveError}
        </div>
      )}

      {/* Workspace Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Story Studio Editor Sections"
        className="flex overflow-x-auto border-b border-zinc-800/90 bg-zinc-950/60 px-2 pt-2"
      >
        {[
          { id: "story", label: "A. Story Overview", icon: BookOpen },
          {
            id: "characters",
            label: `B. Characters (${doc.characters.length})`,
            icon: Users,
          },
          {
            id: "locations",
            label: `C. World & Locations (${doc.locations.length})`,
            icon: MapPin,
          },
          {
            id: "scenes",
            label: `D. Scene Breakdown (${doc.scenes.length})`,
            icon: Layers,
          },
          { id: "screenplay", label: "E. Screenplay Editor", icon: Film },
          { id: "storyboard", label: "F. Storyboard Deck", icon: Clapperboard },
          {
            id: "versions",
            label: `G. Versions (${versions.length})`,
            icon: History,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id as StudioViewSection)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-xs font-medium transition-colors ${
                selected
                  ? "text-violet-300 after:absolute after:inset-x-0 after:bottom-0 after:border-b-2 after:border-violet-500"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Editor Column (8 cols on large screens) */}
        <div className="space-y-6 lg:col-span-8">
          {/* SECTION A: STORY OVERVIEW */}
          {activeTab === "story" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-story"
              className="space-y-6"
            >
              <Card className="border-zinc-800/90 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    Story Overview & Metadata
                  </CardTitle>
                  <CardDescription>
                    Edit your title, logline, summary, themes, and 3-act plot
                    architecture. Changes autosave automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-story-title">Story Title</Label>
                      <Input
                        id="edit-story-title"
                        value={doc.story.title}
                        onChange={(e) =>
                          updateDoc((prev) => ({
                            ...prev,
                            story: { ...prev.story, title: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-story-themes">
                        Themes (comma-separated)
                      </Label>
                      <Input
                        id="edit-story-themes"
                        value={doc.story.themes.join(", ")}
                        onChange={(e) =>
                          updateDoc((prev) => ({
                            ...prev,
                            story: {
                              ...prev.story,
                              themes: e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-genre">Genre</Label>
                      <Input
                        id="edit-genre"
                        value={doc.story.genre}
                        onChange={(e) =>
                          updateDoc((prev) => ({
                            ...prev,
                            story: { ...prev.story, genre: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-tone">Tone</Label>
                      <Input
                        id="edit-tone"
                        value={doc.story.tone}
                        onChange={(e) =>
                          updateDoc((prev) => ({
                            ...prev,
                            story: { ...prev.story, tone: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-audience">Audience</Label>
                      <Input
                        id="edit-audience"
                        value={doc.story.target_audience}
                        onChange={(e) =>
                          updateDoc((prev) => ({
                            ...prev,
                            story: {
                              ...prev.story,
                              target_audience: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-duration">Duration (min)</Label>
                      <Input
                        id="edit-duration"
                        type="number"
                        min={1}
                        max={180}
                        value={doc.story.duration_minutes}
                        onChange={(e) =>
                          updateDoc((prev) => ({
                            ...prev,
                            story: {
                              ...prev.story,
                              duration_minutes: Number(e.target.value) || 1,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-logline">Logline</Label>
                    <Input
                      id="edit-logline"
                      value={doc.story.logline || ""}
                      onChange={(e) =>
                        updateDoc((prev) => ({
                          ...prev,
                          story: { ...prev.story, logline: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-summary">Story Summary</Label>
                    <Textarea
                      id="edit-summary"
                      rows={3}
                      value={doc.story.summary || ""}
                      onChange={(e) =>
                        updateDoc((prev) => ({
                          ...prev,
                          story: { ...prev.story, summary: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-full-plot">Full Plot Synopsis</Label>
                    <Textarea
                      id="edit-full-plot"
                      rows={4}
                      value={doc.story.full_plot || ""}
                      onChange={(e) =>
                        updateDoc((prev) => ({
                          ...prev,
                          story: { ...prev.story, full_plot: e.target.value },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 3-Act Narrative Structure */}
              <Card className="border-zinc-800/90 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    Three-Act Story Structure
                  </CardTitle>
                  <CardDescription>
                    Beginning (Act I), Middle (Act II), and Ending (Act III)
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-act-1">Beginning (Act I)</Label>
                    <Textarea
                      id="edit-act-1"
                      rows={5}
                      value={doc.story.beginning || ""}
                      onChange={(e) =>
                        updateDoc((prev) => ({
                          ...prev,
                          story: { ...prev.story, beginning: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-act-2">Middle (Act II)</Label>
                    <Textarea
                      id="edit-act-2"
                      rows={5}
                      value={doc.story.middle || ""}
                      onChange={(e) =>
                        updateDoc((prev) => ({
                          ...prev,
                          story: { ...prev.story, middle: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-act-3">Ending (Act III)</Label>
                    <Textarea
                      id="edit-act-3"
                      rows={5}
                      value={doc.story.ending || ""}
                      onChange={(e) =>
                        updateDoc((prev) => ({
                          ...prev,
                          story: { ...prev.story, ending: e.target.value },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* SECTION B: CHARACTER OVERVIEW */}
          {activeTab === "characters" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-characters"
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Character Bible & Relationships
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Define roles, visual appearances, personalities, motivations,
                    and sync with the AI Character Creation Studio
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={syncingCharacters}
                    onClick={handleSyncCastToCharacterStudio}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    {syncingCharacters
                      ? "Syncing..."
                      : "Sync Cast to Character Studio"}
                  </Button>
                  <Button type="button" size="sm" onClick={handleAddCharacter}>
                    <Plus className="h-4 w-4" />
                    Add Character
                  </Button>
                </div>
              </div>

              {/* Character Studio Integration Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-950/15 p-3.5">
                <div className="flex flex-1 items-center gap-2">
                  <select
                    aria-label="Import character from Character Studio library"
                    value={selectedImportCharId}
                    onChange={(e) => setSelectedImportCharId(e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200"
                  >
                    <option value="">
                      Import an existing character from Character Studio...
                    </option>
                    {studioCharacters.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name} ({sc.role} · {sc.style})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedImportCharId || syncingCharacters}
                    onClick={handleImportFromCharacterStudio}
                  >
                    Import into Story
                  </Button>
                </div>
                <Button asChild size="sm" variant="ghost" className="text-xs text-violet-300">
                  <Link href={`/characters/new?projectId=${projectId}&storyId=${storyMeta.id}`}>
                    + New Studio Character
                  </Link>
                </Button>
              </div>

              {characterSyncNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2 text-xs text-emerald-200"
                >
                  {characterSyncNotice}
                </div>
              )}

              {doc.characters.map((char, idx) => {
                const matchedStudioChar = studioCharacters.find(
                  (sc) =>
                    sc.id === char.id ||
                    sc.name.toLowerCase() === char.name.toLowerCase()
                );
                return (
                <Card
                  key={char.id}
                  className="border-zinc-800/90 bg-zinc-900/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Badge variant="default">{char.role}</Badge>
                        <CardTitle className="text-base">{char.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {matchedStudioChar && (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-violet-300 border-violet-500/30"
                          >
                            <Link href={`/characters/${matchedStudioChar.id}`}>
                              Open in Character Studio
                            </Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCharacter(char.id)}
                          aria-label={`Delete character ${char.name}`}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`char-name-${char.id}`}>Name</Label>
                        <Input
                          id={`char-name-${char.id}`}
                          value={char.name}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.characters];
                              next[idx] = { ...char, name: e.target.value };
                              return { ...prev, characters: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`char-role-${char.id}`}>Role</Label>
                        <Input
                          id={`char-role-${char.id}`}
                          value={char.role}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.characters];
                              next[idx] = { ...char, role: e.target.value };
                              return { ...prev, characters: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`char-age-${char.id}`}>Age / Stage</Label>
                        <Input
                          id={`char-age-${char.id}`}
                          value={char.age_description || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.characters];
                              next[idx] = {
                                ...char,
                                age_description: e.target.value,
                              };
                              return { ...prev, characters: next };
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`char-traits-${char.id}`}>
                        Personality Traits (comma-separated)
                      </Label>
                      <Input
                        id={`char-traits-${char.id}`}
                        value={char.personality.join(", ")}
                        onChange={(e) =>
                          updateDoc((prev) => {
                            const next = [...prev.characters];
                            next[idx] = {
                              ...char,
                              personality: e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            };
                            return { ...prev, characters: next };
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`char-app-${char.id}`}>
                          Appearance Description
                        </Label>
                        <Textarea
                          id={`char-app-${char.id}`}
                          rows={3}
                          value={char.appearance_description || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.characters];
                              next[idx] = {
                                ...char,
                                appearance_description: e.target.value,
                              };
                              return { ...prev, characters: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`char-mot-${char.id}`}>
                          Motivation & Backstory
                        </Label>
                        <Textarea
                          id={`char-mot-${char.id}`}
                          rows={3}
                          value={char.motivation || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.characters];
                              next[idx] = {
                                ...char,
                                motivation: e.target.value,
                              };
                              return { ...prev, characters: next };
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Character Relationships */}
                    <div className="space-y-2 border-t border-zinc-800/80 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300">
                          Relationships ({char.relationships.length})
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDoc((prev) => {
                              const next = [...prev.characters];
                              next[idx] = {
                                ...char,
                                relationships: [
                                  ...char.relationships,
                                  {
                                    id: makeUuid(),
                                    target_character_name: "Companion",
                                    relationship_type: "Ally",
                                    description: "Trusted friend",
                                  },
                                ],
                              };
                              return { ...prev, characters: next };
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Relationship
                        </Button>
                      </div>

                      {char.relationships.map((rel, rIdx) => (
                        <div
                          key={rel.id}
                          className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5 sm:grid-cols-12"
                        >
                          <Input
                            aria-label="Target character name"
                            placeholder="Character name"
                            value={rel.target_character_name}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.characters];
                                const rels = [...char.relationships];
                                rels[rIdx] = {
                                  ...rel,
                                  target_character_name: e.target.value,
                                };
                                next[idx] = { ...char, relationships: rels };
                                return { ...prev, characters: next };
                              })
                            }
                            className="h-9 min-h-9 text-xs sm:col-span-4"
                          />
                          <Input
                            aria-label="Relationship type"
                            placeholder="Type (e.g. Rival, Mentor)"
                            value={rel.relationship_type}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.characters];
                                const rels = [...char.relationships];
                                rels[rIdx] = {
                                  ...rel,
                                  relationship_type: e.target.value,
                                };
                                next[idx] = { ...char, relationships: rels };
                                return { ...prev, characters: next };
                              })
                            }
                            className="h-9 min-h-9 text-xs sm:col-span-3"
                          />
                          <Input
                            aria-label="Relationship description"
                            placeholder="Dynamic description"
                            value={rel.description || ""}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.characters];
                                const rels = [...char.relationships];
                                rels[rIdx] = {
                                  ...rel,
                                  description: e.target.value,
                                };
                                next[idx] = { ...char, relationships: rels };
                                return { ...prev, characters: next };
                              })
                            }
                            className="h-9 min-h-9 text-xs sm:col-span-4"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Remove relationship"
                            onClick={() =>
                              updateDoc((prev) => {
                                const next = [...prev.characters];
                                next[idx] = {
                                  ...char,
                                  relationships: char.relationships.filter(
                                    (r) => r.id !== rel.id
                                  ),
                                };
                                return { ...prev, characters: next };
                              })
                            }
                            className="sm:col-span-1 text-zinc-400 hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {/* SECTION C: WORLD & LOCATIONS */}
          {activeTab === "locations" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-locations"
              className="space-y-4"
            >
              {/* Step 4 World & Environment Studio Integration Banner */}
              <Card className="border-violet-500/30 bg-violet-950/15">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-violet-400" />
                      <h3 className="text-sm font-semibold text-white">
                        World &amp; Environment Studio Integration
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Sync story locations to the visual Environment Studio, or import existing environments with lighting, weather, and background plates.
                    </p>
                    {environmentSyncNotice && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="text-xs font-medium text-emerald-300"
                      >
                        {environmentSyncNotice}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={syncingEnvironments}
                      onClick={handleSyncLocationsToEnvironmentStudio}
                      className="gap-1.5 text-xs"
                    >
                      {syncingEnvironments ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                      )}
                      Sync Locations to Environment Studio
                    </Button>

                    {studioEnvironments.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label="Import environment from Environment Library"
                          value={selectedImportEnvId}
                          onChange={(e) =>
                            setSelectedImportEnvId(e.target.value)
                          }
                          className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                        >
                          <option value="">
                            Import from Environment Library...
                          </option>
                          {studioEnvironments.map((env) => (
                            <option key={env.id} value={env.id}>
                              {env.name} ({env.category} • {env.time_of_day})
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!selectedImportEnvId || syncingEnvironments}
                          onClick={handleImportFromEnvironmentStudio}
                          className="text-xs"
                        >
                          Import
                        </Button>
                      </div>
                    )}

                    <Button asChild size="sm" className="gap-1.5 text-xs">
                      <Link
                        href={`/environments/new?storyId=${storyMeta.id}&projectId=${storyMeta.project_id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New in Environment Studio
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-zinc-800/90 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    World Lore & Environment Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    aria-label="World description"
                    rows={3}
                    value={doc.story.world_description || ""}
                    onChange={(e) =>
                      updateDoc((prev) => ({
                        ...prev,
                        story: {
                          ...prev.story,
                          world_description: e.target.value,
                        },
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-2">
                <h2 className="text-lg font-semibold text-white">
                  Story Locations ({doc.locations.length})
                </h2>
                <Button type="button" size="sm" onClick={handleAddLocation}>
                  <Plus className="h-4 w-4" />
                  Add Location
                </Button>
              </div>

              {doc.locations.map((loc, idx) => {
                const matchedEnv = studioEnvironments.find(
                  (e) =>
                    e.id === loc.id ||
                    e.name.trim().toLowerCase() ===
                      loc.name.trim().toLowerCase()
                );
                return (
                <Card
                  key={loc.id}
                  className="border-zinc-800/90 bg-zinc-900/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {matchedEnv?.default_image_url && (
                          <img
                            src={resolveMediaUrl(matchedEnv.default_image_url)}
                            alt={loc.name}
                            className="h-10 w-16 rounded-lg border border-zinc-800 object-cover"
                          />
                        )}
                        <div>
                          <CardTitle className="text-base">{loc.name}</CardTitle>
                          {matchedEnv && (
                            <span className="text-[11px] text-violet-300">
                              Linked Environment ({matchedEnv.category} •{" "}
                              {matchedEnv.time_of_day} • {matchedEnv.weather})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {matchedEnv && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Link href={`/environments/${matchedEnv.id}/design`}>
                              <Globe className="h-3.5 w-3.5 text-violet-400" />
                              Open Environment Designer
                            </Link>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete location ${loc.name}`}
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`loc-name-${loc.id}`}>
                          Location Name
                        </Label>
                        <Input
                          id={`loc-name-${loc.id}`}
                          value={loc.name}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.locations];
                              next[idx] = { ...loc, name: e.target.value };
                              return { ...prev, locations: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`loc-atm-${loc.id}`}>Atmosphere</Label>
                        <Input
                          id={`loc-atm-${loc.id}`}
                          value={loc.atmosphere || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.locations];
                              next[idx] = {
                                ...loc,
                                atmosphere: e.target.value,
                              };
                              return { ...prev, locations: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`loc-tod-${loc.id}`}>Time of Day</Label>
                        <Input
                          id={`loc-tod-${loc.id}`}
                          value={loc.time_of_day || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.locations];
                              next[idx] = {
                                ...loc,
                                time_of_day: e.target.value,
                              };
                              return { ...prev, locations: next };
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`loc-desc-${loc.id}`}>
                          Visual Description
                        </Label>
                        <Textarea
                          id={`loc-desc-${loc.id}`}
                          rows={2}
                          value={loc.description || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.locations];
                              next[idx] = {
                                ...loc,
                                description: e.target.value,
                              };
                              return { ...prev, locations: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`loc-env-${loc.id}`}>
                          Environment Requirements
                        </Label>
                        <Textarea
                          id={`loc-env-${loc.id}`}
                          rows={2}
                          value={loc.environment_requirements || ""}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.locations];
                              next[idx] = {
                                ...loc,
                                environment_requirements: e.target.value,
                              };
                              return { ...prev, locations: next };
                            })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {/* SECTION D: SCENE BREAKDOWN */}
          {activeTab === "scenes" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-scenes"
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Scene-by-Scene Breakdown
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Add, reorder, duplicate, or delete scenes. All scene numbers
                    re-index automatically.
                  </p>
                </div>
                <Button type="button" size="sm" onClick={handleAddScene}>
                  <Plus className="h-4 w-4" />
                  Add Scene
                </Button>
              </div>

              {doc.scenes.map((scene, sIdx) => {
                const sceneEnv = studioEnvironments.find(
                  (e) =>
                    e.id === scene.location_id ||
                    (scene.location_name &&
                      e.name.trim().toLowerCase() ===
                        scene.location_name.trim().toLowerCase())
                );
                return (
                <Card
                  key={scene.id}
                  className="border-zinc-800/90 bg-zinc-900/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Badge variant="default">
                          Scene {scene.scene_number}
                        </Badge>
                        <span className="text-xs font-mono text-zinc-400">
                          {scene.duration_seconds}s
                        </span>
                        {sceneEnv && (
                          <Link
                            href={`/environments/${sceneEnv.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300 hover:bg-violet-500/20"
                          >
                            {sceneEnv.default_image_url && (
                              <img
                                src={resolveMediaUrl(
                                  sceneEnv.default_image_url
                                )}
                                alt={sceneEnv.name}
                                className="h-4 w-6 rounded object-cover"
                              />
                            )}
                            <Globe className="h-3 w-3" />
                            Env: {sceneEnv.name} ({sceneEnv.time_of_day})
                          </Link>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={sIdx === 0}
                          onClick={() => handleMoveScene(sIdx, -1)}
                          aria-label={`Move scene ${scene.scene_number} up`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={sIdx === doc.scenes.length - 1}
                          onClick={() => handleMoveScene(sIdx, 1)}
                          aria-label={`Move scene ${scene.scene_number} down`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDuplicateScene(scene.id)}
                          aria-label={`Duplicate scene ${scene.scene_number}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDeleteScene(scene.id, scene.title)
                          }
                          aria-label={`Delete scene ${scene.scene_number}`}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-title-${scene.id}`}>
                          Scene Title
                        </Label>
                        <Input
                          id={`sc-title-${scene.id}`}
                          value={scene.title}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = { ...scene, title: e.target.value };
                              return { ...prev, scenes: next };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-loc-${scene.id}`}>
                          Location / Environment
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`sc-loc-${scene.id}`}
                            value={scene.location_name || ""}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.scenes];
                                next[sIdx] = {
                                  ...scene,
                                  location_name: e.target.value,
                                };
                                return { ...prev, scenes: next };
                              })
                            }
                          />
                          {studioEnvironments.length > 0 && (
                            <select
                              aria-label="Select saved environment for scene"
                              value=""
                              onChange={(e) => {
                                const chosen = studioEnvironments.find(
                                  (env) => env.id === e.target.value
                                );
                                if (!chosen) return;
                                updateDoc((prev) => {
                                  const next = [...prev.scenes];
                                  next[sIdx] = {
                                    ...scene,
                                    location_id: chosen.id,
                                    location_name: chosen.name,
                                  };
                                  return { ...prev, scenes: next };
                                });
                              }}
                              className="h-10 max-w-[140px] rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
                            >
                              <option value="">Pick Env...</option>
                              {studioEnvironments.map((env) => (
                                <option key={env.id} value={env.id}>
                                  {env.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-dur-${scene.id}`}>
                          Duration (seconds)
                        </Label>
                        <Input
                          id={`sc-dur-${scene.id}`}
                          type="number"
                          min={5}
                          max={1800}
                          value={scene.duration_seconds}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = {
                                ...scene,
                                duration_seconds: Number(e.target.value) || 30,
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`sc-chars-${scene.id}`}>
                        Characters in Scene (comma-separated)
                      </Label>
                      <Input
                        id={`sc-chars-${scene.id}`}
                        value={scene.characters.join(", ")}
                        onChange={(e) =>
                          updateDoc((prev) => {
                            const next = [...prev.scenes];
                            next[sIdx] = {
                              ...scene,
                              characters: e.target.value
                                .split(",")
                                .map((c) => c.trim())
                                .filter(Boolean),
                            };
                            return { ...prev, scenes: next };
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`sc-desc-${scene.id}`}>
                        Scene Summary Description
                      </Label>
                      <Textarea
                        id={`sc-desc-${scene.id}`}
                        rows={2}
                        value={scene.description || ""}
                        onChange={(e) =>
                          updateDoc((prev) => {
                            const next = [...prev.scenes];
                            next[sIdx] = {
                              ...scene,
                              description: e.target.value,
                            };
                            return { ...prev, scenes: next };
                          })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {/* SECTION E: SCREENPLAY EDITOR */}
          {activeTab === "screenplay" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-screenplay"
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Screenplay & Dialogue Editor
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Edit sluglines, action beats, character dialogue, voiceover
                    narration, camera directions, and sound cues.
                  </p>
                </div>
                <Button type="button" size="sm" onClick={handleAddScene}>
                  <Plus className="h-4 w-4" />
                  New Scene
                </Button>
              </div>

              {doc.scenes.map((scene, sIdx) => (
                <Card
                  key={scene.id}
                  className="border-zinc-800/90 bg-[#0d0d14]"
                >
                  <CardHeader className="border-b border-zinc-800/80 bg-zinc-950/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">
                          SCENE {scene.scene_number}
                        </Badge>
                        <Input
                          aria-label={`Scene ${scene.scene_number} heading`}
                          value={
                            scene.scene_heading ||
                            `EXT. ${(scene.location_name || "LOCATION").toUpperCase()} - DAY`
                          }
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = {
                                ...scene,
                                scene_heading: e.target.value,
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                          className="h-9 min-h-9 w-72 font-mono text-xs uppercase tracking-wider text-violet-300"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(aiRunningAction)}
                        onClick={() =>
                          void handleRunAIAssist("rewrite_dialogue", {
                            targetSceneId: scene.id,
                          })
                        }
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Polish Scene
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 pt-5">
                    {/* Action Description */}
                    <div className="space-y-1.5">
                      <Label htmlFor={`sp-action-${scene.id}`}>
                        Action & Staging Description
                      </Label>
                      <Textarea
                        id={`sp-action-${scene.id}`}
                        rows={3}
                        value={
                          scene.action_description || scene.description || ""
                        }
                        onChange={(e) =>
                          updateDoc((prev) => {
                            const next = [...prev.scenes];
                            next[sIdx] = {
                              ...scene,
                              action_description: e.target.value,
                            };
                            return { ...prev, scenes: next };
                          })
                        }
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Narration (V.O.) Entries */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
                          <Mic className="h-3.5 w-3.5" />
                          Narration / Voiceover ({scene.narration.length})
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              const newNarration: NarrationEntryData = {
                                id: makeUuid(),
                                narrator_voice: "Narrator (V.O.)",
                                text: "Enter narration line...",
                                emotion: "Reflective",
                              };
                              next[sIdx] = {
                                ...scene,
                                narration: [...scene.narration, newNarration],
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Narration
                        </Button>
                      </div>

                      {scene.narration.map((nar, nIdx) => (
                        <div
                          key={nar.id}
                          className="grid gap-2 rounded-xl border border-purple-500/20 bg-purple-950/10 p-3 sm:grid-cols-12"
                        >
                          <Input
                            aria-label="Narrator voice"
                            value={nar.narrator_voice}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.scenes];
                                const list = [...scene.narration];
                                list[nIdx] = {
                                  ...nar,
                                  narrator_voice: e.target.value,
                                };
                                next[sIdx] = { ...scene, narration: list };
                                return { ...prev, scenes: next };
                              })
                            }
                            className="h-9 min-h-9 text-xs font-semibold sm:col-span-3"
                          />
                          <Input
                            aria-label="Narration emotion"
                            placeholder="Tone/Emotion"
                            value={nar.emotion || ""}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.scenes];
                                const list = [...scene.narration];
                                list[nIdx] = {
                                  ...nar,
                                  emotion: e.target.value,
                                };
                                next[sIdx] = { ...scene, narration: list };
                                return { ...prev, scenes: next };
                              })
                            }
                            className="h-9 min-h-9 text-xs sm:col-span-2"
                          />
                          <Input
                            aria-label="Narration text"
                            value={nar.text}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.scenes];
                                const list = [...scene.narration];
                                list[nIdx] = { ...nar, text: e.target.value };
                                next[sIdx] = { ...scene, narration: list };
                                return { ...prev, scenes: next };
                              })
                            }
                            className="h-9 min-h-9 text-xs sm:col-span-6"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Delete narration entry"
                            onClick={() =>
                              updateDoc((prev) => {
                                const next = [...prev.scenes];
                                next[sIdx] = {
                                  ...scene,
                                  narration: scene.narration.filter(
                                    (n) => n.id !== nar.id
                                  ),
                                };
                                return { ...prev, scenes: next };
                              })
                            }
                            className="sm:col-span-1 text-zinc-400 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Character Dialogue Entries */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Character Dialogue ({scene.dialogue.length})
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              const defaultChar =
                                scene.characters[0] ||
                                prev.characters[0]?.name ||
                                "PROTAGONIST";
                              const newLine: DialogueEntryData = {
                                id: makeUuid(),
                                character_name: defaultChar,
                                line: "New dialogue line...",
                                emotion: "Determined",
                                delivery_direction: "Speaking softly",
                              };
                              next[sIdx] = {
                                ...scene,
                                dialogue: [...scene.dialogue, newLine],
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Dialogue Line
                        </Button>
                      </div>

                      {scene.dialogue.map((dlg, dIdx) => (
                        <div
                          key={dlg.id}
                          className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"
                        >
                          <div className="grid gap-2 sm:grid-cols-12">
                            <Input
                              aria-label="Speaker character name"
                              placeholder="Character"
                              value={dlg.character_name}
                              onChange={(e) =>
                                updateDoc((prev) => {
                                  const next = [...prev.scenes];
                                  const list = [...scene.dialogue];
                                  list[dIdx] = {
                                    ...dlg,
                                    character_name: e.target.value,
                                  };
                                  next[sIdx] = { ...scene, dialogue: list };
                                  return { ...prev, scenes: next };
                                })
                              }
                              className="h-9 min-h-9 font-mono text-xs font-bold uppercase text-violet-300 sm:col-span-4"
                            />
                            <Input
                              aria-label="Dialogue emotion"
                              placeholder="Emotion (e.g. Joyful)"
                              value={dlg.emotion || ""}
                              onChange={(e) =>
                                updateDoc((prev) => {
                                  const next = [...prev.scenes];
                                  const list = [...scene.dialogue];
                                  list[dIdx] = {
                                    ...dlg,
                                    emotion: e.target.value,
                                  };
                                  next[sIdx] = { ...scene, dialogue: list };
                                  return { ...prev, scenes: next };
                                })
                              }
                              className="h-9 min-h-9 text-xs sm:col-span-3"
                            />
                            <Input
                              aria-label="Delivery direction"
                              placeholder="Parenthetical direction"
                              value={dlg.delivery_direction || ""}
                              onChange={(e) =>
                                updateDoc((prev) => {
                                  const next = [...prev.scenes];
                                  const list = [...scene.dialogue];
                                  list[dIdx] = {
                                    ...dlg,
                                    delivery_direction: e.target.value,
                                  };
                                  next[sIdx] = { ...scene, dialogue: list };
                                  return { ...prev, scenes: next };
                                })
                              }
                              className="h-9 min-h-9 text-xs italic text-zinc-400 sm:col-span-4"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label="Delete dialogue line"
                              onClick={() =>
                                updateDoc((prev) => {
                                  const next = [...prev.scenes];
                                  next[sIdx] = {
                                    ...scene,
                                    dialogue: scene.dialogue.filter(
                                      (d) => d.id !== dlg.id
                                    ),
                                  };
                                  return { ...prev, scenes: next };
                                })
                              }
                              className="sm:col-span-1 text-zinc-400 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Textarea
                            aria-label={`Dialogue line spoken by ${dlg.character_name}`}
                            rows={2}
                            value={dlg.line}
                            onChange={(e) =>
                              updateDoc((prev) => {
                                const next = [...prev.scenes];
                                const list = [...scene.dialogue];
                                list[dIdx] = { ...dlg, line: e.target.value };
                                next[sIdx] = { ...scene, dialogue: list };
                                return { ...prev, scenes: next };
                              })
                            }
                            className="font-mono text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Camera, Emotional, and Audio Directions */}
                    <div className="grid gap-4 border-t border-zinc-800/80 pt-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`cam-dir-${scene.id}`}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Camera className="h-3.5 w-3.5 text-violet-400" />
                          Camera Directions (one per line)
                        </Label>
                        <Textarea
                          id={`cam-dir-${scene.id}`}
                          rows={3}
                          value={scene.camera_directions.join("\n")}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = {
                                ...scene,
                                camera_directions: e.target.value
                                  .split("\n")
                                  .filter((l) => l.trim().length > 0),
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`aud-dir-${scene.id}`}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Music className="h-3.5 w-3.5 text-purple-400" />
                          Audio & Music Cues (one per line)
                        </Label>
                        <Textarea
                          id={`aud-dir-${scene.id}`}
                          rows={3}
                          value={scene.audio_directions.join("\n")}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = {
                                ...scene,
                                audio_directions: e.target.value
                                  .split("\n")
                                  .filter((l) => l.trim().length > 0),
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`emo-dir-${scene.id}`}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                          Emotional & Visual Cues
                        </Label>
                        <Textarea
                          id={`emo-dir-${scene.id}`}
                          rows={3}
                          value={scene.emotional_directions.join("\n")}
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = {
                                ...scene,
                                emotional_directions: e.target.value
                                  .split("\n")
                                  .filter((l) => l.trim().length > 0),
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* SECTION F: STRUCTURED STORYBOARD DECK */}
          {activeTab === "storyboard" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-storyboard"
              className="space-y-4"
            >
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Structured Storyboard & Shot Deck
                </h2>
                <p className="text-xs text-zinc-400">
                  Visual shot cards linking camera framing, visual directions,
                  audio cues, and storyboard composition notes for each scene.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {doc.scenes.map((scene, sIdx) => (
                  <Card
                    key={scene.id}
                    className="border-zinc-800/90 bg-zinc-900/50"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="default">
                          PANEL {scene.scene_number}
                        </Badge>
                        <span className="text-xs text-zinc-400">
                          {scene.duration_seconds}s • {scene.location_name}
                        </span>
                      </div>
                      <CardTitle className="mt-2 text-sm">
                        {scene.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/90 p-3">
                        <p className="font-semibold text-violet-300">
                          Camera & Framing:
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {scene.camera_directions.join(" • ") ||
                            "Standard framing"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`sb-notes-${scene.id}`}>
                          Storyboard Artist Notes & Visual Directions
                        </Label>
                        <Textarea
                          id={`sb-notes-${scene.id}`}
                          rows={3}
                          placeholder="Key pose, lighting contrast, background parallax notes..."
                          value={
                            scene.storyboard_notes ||
                            scene.visual_directions.join("\n")
                          }
                          onChange={(e) =>
                            updateDoc((prev) => {
                              const next = [...prev.scenes];
                              next[sIdx] = {
                                ...scene,
                                storyboard_notes: e.target.value,
                              };
                              return { ...prev, scenes: next };
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* SECTION G: STORY VERSION HISTORY */}
          {activeTab === "versions" && (
            <div
              role="tabpanel"
              aria-labelledby="tab-versions"
              className="space-y-4"
            >
              <Card className="border-zinc-800/90 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="text-base">
                    Save Named Story Checkpoint
                  </CardTitle>
                  <CardDescription>
                    Create a permanent version snapshot before major structural
                    edits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    aria-label="Version checkpoint label"
                    placeholder="e.g., Before Act III Twist Rewrite"
                    value={versionLabelInput}
                    onChange={(e) => setVersionLabelInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={savingVersion}
                    onClick={() => void handleCreateNamedVersion()}
                  >
                    {savingVersion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Version Snapshot
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {loadingVersions ? (
                  <div className="h-24 animate-pulse rounded-xl bg-zinc-900" />
                ) : versions.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    No saved versions yet.
                  </p>
                ) : (
                  versions.map((v) => (
                    <Card
                      key={v.id}
                      className="border-zinc-800/90 bg-zinc-900/40"
                    >
                      <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">
                              v{v.version_number}
                            </Badge>
                            <span className="text-sm font-semibold text-white">
                              {v.label}
                            </span>
                            <Badge variant="secondary">{v.source}</Badge>
                          </div>
                          <p className="text-xs text-zinc-400">
                            Saved {formatRelativeDate(v.created_at)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRestoreVersion(v)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore This Version
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Contextual AI Assistant Panel (4 cols on large screens) */}
        <aside className="space-y-6 lg:col-span-4">
          <Card className="sticky top-36 border-violet-500/30 bg-gradient-to-b from-violet-950/25 via-zinc-900/80 to-zinc-950">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-violet-400" />
                <CardTitle className="text-base">
                  Contextual AI Story Assistant
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Every AI action generates a non-destructive preview first. Your
                original story is never overwritten until you review and accept.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {aiError && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
                >
                  {aiError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="ai-custom-notes" className="text-xs">
                  Optional Direction for AI Assistant
                </Label>
                <Input
                  id="ai-custom-notes"
                  placeholder="e.g., Focus on Arin's courage in Scene 2..."
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  className="h-9 min-h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {AI_ASSISTANT_ACTIONS.map((item) => {
                  const busy = aiRunningAction === item.action;
                  return (
                    <button
                      key={item.action}
                      type="button"
                      disabled={Boolean(aiRunningAction)}
                      onClick={() => void handleRunAIAssist(item.action)}
                      className="flex items-start justify-between gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/70 p-3 text-left transition-all hover:border-violet-500/50 hover:bg-zinc-900 disabled:opacity-50"
                    >
                      <div>
                        <p className="text-xs font-semibold text-zinc-100">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {item.description}
                        </p>
                      </div>
                      {busy ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-400" />
                      ) : (
                        <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Translation Action */}
              <div className="space-y-2 border-t border-zinc-800/80 pt-3">
                <Label
                  htmlFor="ai-translate-select"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Globe className="h-3.5 w-3.5 text-violet-400" />
                  Translate Entire Story & Screenplay
                </Label>
                <div className="flex gap-2">
                  <select
                    id="ai-translate-select"
                    value={translateLang}
                    onChange={(e) => setTranslateLang(e.target.value)}
                    className="flex h-9 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100"
                  >
                    {STORY_LANGUAGES.filter(
                      (l) => l !== "Other supported languages"
                    ).map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={Boolean(aiRunningAction)}
                    onClick={() => void handleRunAIAssist("translate_story")}
                  >
                    {aiRunningAction === "translate_story" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Translate"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Non-Destructive AI Proposal Comparison Modal */}
      <dialog
        ref={proposalDialogRef}
        aria-labelledby={proposalTitleId}
        className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-zinc-100 shadow-2xl open:flex open:flex-col"
      >
        {proposal && (
          <>
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div>
                <h2 id={proposalTitleId} className="text-base font-bold text-white">
                  Review Proposed AI Changes ({proposal.action.replace(/_/g, " ")})
                </h2>
                <p className="text-xs text-zinc-400">
                  {proposal.summary_of_changes} — Your original story is
                  preserved until you click Accept.
                </p>
              </div>
              <button
                type="button"
                aria-label="Discard proposal"
                onClick={() => setProposal(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-6 sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <Badge variant="secondary">Current Original</Badge>
                <h3 className="text-sm font-semibold text-white">
                  {proposal.original_document.story.title}
                </h3>
                <p className="text-xs text-zinc-300">
                  {proposal.original_document.story.summary}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Scenes: {proposal.original_document.scenes.length}
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-violet-500/40 bg-violet-950/20 p-4">
                <Badge variant="default">Proposed AI Replacement</Badge>
                <h3 className="text-sm font-semibold text-white">
                  {proposal.proposed_document.story.title}
                </h3>
                <p className="text-xs text-zinc-200">
                  {proposal.proposed_document.story.summary}
                </p>
                <p className="text-[11px] text-violet-300">
                  Scenes: {proposal.proposed_document.scenes.length}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProposal(null)}
              >
                Keep Original
              </Button>
              <Button type="button" onClick={() => void handleAcceptProposal()}>
                <Check className="h-4 w-4" />
                Accept & Save Version
              </Button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
