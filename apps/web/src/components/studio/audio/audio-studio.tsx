"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Clapperboard,
  Film,
  Layers,
  Loader2,
  Mic,
  Music,
  Play,
  RotateCw,
  Sliders,
  Sparkles,
  Subtitles,
  Volume2,
} from "lucide-react";
import { SceneStudioFrame } from "@/components/studio/scene-studio-common";
import { Button } from "@/components/ui/button";
import { api, resolveMediaUrl } from "@/lib/api";
import { AudioPlayerBar } from "./audio-player-bar";
import { DialogueEditor } from "./dialogue-editor";
import { VoiceStudio } from "./voice-studio";
import { MusicSfxLibrary } from "./music-sfx-library";
import { SubtitleEditor } from "./subtitle-editor";
import type {
  AudioAssetRecord,
  Character,
  CharacterVoiceProfileRecord,
  DialogueLineRecord,
  NarrationLineRecord,
  Project,
  StorySceneData,
  SubtitleTrackRecord,
  VoiceOptionRecord,
} from "@tr-studio/shared-types";

export type AudioSubTab = "dialogue" | "voice" | "music" | "sound-effects" | "subtitles" | "assets";

interface AudioStudioProps {
  projectId: string;
  initialTab?: AudioSubTab;
}

export function AudioStudio({ projectId, initialTab = "dialogue" }: AudioStudioProps) {
  const [activeTab, setActiveTab] = useState<AudioSubTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded data
  const [scenes, setScenes] = useState<StorySceneData[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<CharacterVoiceProfileRecord[]>([]);
  const [availableVoices, setAvailableVoices] = useState<VoiceOptionRecord[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLineRecord[]>([]);
  const [narrationLines, setNarrationLines] = useState<NarrationLineRecord[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAssetRecord[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackRecord[]>([]);

  // Master audio playback bar
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [previewWaveform, setPreviewWaveform] = useState<number[] | null>(null);

  // Timeline sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load scenes
      const scRes = await api.get<{ scenes: StorySceneData[] } | StorySceneData[]>(
        `/projects/${projectId}/scene-builder`
      );
      const sceneList = Array.isArray(scRes) ? scRes : scRes.scenes || [];
      setScenes(sceneList);
      if (sceneList.length > 0 && !selectedSceneId) {
        setSelectedSceneId(sceneList[0].id);
      }

      // Load characters
      try {
        const charRes = await api.get<{ items: Character[] } | Character[]>(
          `/characters?project_id=${projectId}`
        );
        const charList = Array.isArray(charRes) ? charRes : charRes.items || [];
        setCharacters(charList);
      } catch (e) {
        console.warn("Failed to load characters", e);
      }

      // Load voice profiles
      try {
        const vpRes = await api.get<CharacterVoiceProfileRecord[]>(
          `/projects/${projectId}/audio/voice-profiles`
        );
        setVoiceProfiles(vpRes || []);
      } catch (e) {
        console.warn("Failed to load voice profiles", e);
      }

      // Load available voices
      try {
        const vRes = await api.get<VoiceOptionRecord[]>(
          `/projects/${projectId}/audio/voices`
        );
        setAvailableVoices(vRes || []);
      } catch (e) {
        console.warn("Failed to load available voices", e);
      }

      // Load audio assets
      try {
        const assetRes = await api.get<{ items: AudioAssetRecord[] }>(
          `/projects/${projectId}/audio/assets`
        );
        setAudioAssets(assetRes.items || []);
      } catch (e) {
        console.warn("Failed to load audio assets", e);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load Audio Studio data.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load scene-specific dialogue and subtitles when selected scene changes
  const loadSceneDialogue = useCallback(async () => {
    if (!selectedSceneId) return;
    try {
      const [dRes, nRes, sRes] = await Promise.all([
        api.get<DialogueLineRecord[]>(
          `/projects/${projectId}/audio/dialogue?scene_id=${selectedSceneId}`
        ),
        api.get<NarrationLineRecord[]>(
          `/projects/${projectId}/audio/narration?scene_id=${selectedSceneId}`
        ),
        api.get<SubtitleTrackRecord[]>(
          `/projects/${projectId}/audio/subtitles?scene_id=${selectedSceneId}`
        ),
      ]);
      setDialogueLines(dRes || []);
      setNarrationLines(nRes || []);
      setSubtitleTracks(sRes || []);
    } catch (e) {
      console.warn("Failed to load scene audio lines", e);
    }
  }, [projectId, selectedSceneId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadSceneDialogue();
  }, [loadSceneDialogue]);

  const handlePlayPreview = (url: string, title: string, waveform?: number[]) => {
    setPreviewUrl(url);
    setPreviewTitle(title);
    setPreviewWaveform(waveform || null);
  };

  const handleSyncToTimeline = async () => {
    if (!selectedSceneId) return;
    try {
      setIsSyncing(true);
      setSyncStatus(null);
      const res = await api.post<{ message: string; tracks_created: number; clips_created: number }>(
        `/projects/${projectId}/audio/timeline-sync`,
        {
          scene_id: selectedSceneId,
          include_dialogue: true,
          include_narration: true,
          auto_place_clips: true,
        }
      );
      setSyncStatus(res.message);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to synchronize audio to timeline.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SceneStudioFrame
      projectId={projectId}
      active="audio"
      title="Dialogue, Voice & Audio Studio"
      description="Professional multi-track voiceover synthesis, character voice profiling, music & foley sound effects library."
    >
      <div className="flex flex-col gap-6">
        {/* Top Control Bar: Scene Selector, Master Player, Timeline Sync */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm">
          {/* Scene Picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clapperboard className="h-3.5 w-3.5 text-violet-400" />
              Active Scene
            </label>
            <select
              value={selectedSceneId}
              onChange={(e) => setSelectedSceneId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {scenes.length === 0 ? (
                <option value="">No scenes available</option>
              ) : (
                scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    Scene {sc.scene_number}: {sc.title}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Master Audio Preview Bar */}
          <div className="lg:col-span-2 flex flex-col gap-1">
            <AudioPlayerBar
              url={previewUrl}
              title={previewTitle || "Audio Studio Master Preview"}
              waveform={previewWaveform}
            />
          </div>
        </div>

        {/* Global Action Bar with Sync to Timeline */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          {/* Subtabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "dialogue", label: "Dialogue & Speech", icon: <Mic className="h-3.5 w-3.5" /> },
              { id: "voice", label: "Voice Studio", icon: <Sliders className="h-3.5 w-3.5" /> },
              { id: "music", label: "Music & SFX", icon: <Music className="h-3.5 w-3.5" /> },
              { id: "subtitles", label: "Subtitles", icon: <Subtitles className="h-3.5 w-3.5" /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AudioSubTab)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Timeline Sync Button */}
          <div className="flex items-center gap-2">
            {syncStatus && (
              <span className="text-xs text-emerald-400 font-medium animate-pulse">
                {syncStatus}
              </span>
            )}
            <Button
              size="sm"
              onClick={handleSyncToTimeline}
              disabled={isSyncing || !selectedSceneId}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 shadow-sm"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Syncing to Timeline...
                </>
              ) : (
                <>
                  <Layers className="mr-1.5 h-3.5 w-3.5 text-violet-400" />
                  Sync with Animation Timeline
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-800/80 bg-red-950/40 p-4 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <div>
            {activeTab === "dialogue" && (
              <DialogueEditor
                projectId={projectId}
                sceneId={selectedSceneId}
                dialogueLines={dialogueLines}
                narrationLines={narrationLines}
                onRefresh={loadSceneDialogue}
                onPlayPreview={handlePlayPreview}
              />
            )}

            {activeTab === "voice" && (
              <VoiceStudio
                projectId={projectId}
                characters={characters}
                voiceProfiles={voiceProfiles}
                availableVoices={availableVoices}
                onRefresh={loadData}
                onPlayPreview={handlePlayPreview}
              />
            )}

            {activeTab === "music" && (
              <MusicSfxLibrary
                projectId={projectId}
                assets={audioAssets}
                onRefresh={loadData}
                onPlayPreview={handlePlayPreview}
                onAddToTimeline={() => handleSyncToTimeline()}
              />
            )}

            {activeTab === "subtitles" && (
              <SubtitleEditor
                projectId={projectId}
                sceneId={selectedSceneId}
                tracks={subtitleTracks}
                onRefresh={loadSceneDialogue}
              />
            )}
          </div>
        )}
      </div>
    </SceneStudioFrame>
  );
}
