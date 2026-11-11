"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mic,
  Play,
  RotateCw,
  Sliders,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, resolveMediaUrl } from "@/lib/api";
import type {
  Character,
  CharacterVoiceProfileRecord,
  VoiceOptionRecord,
} from "@tr-studio/shared-types";

interface VoiceStudioProps {
  projectId: string;
  characters: Character[];
  voiceProfiles: CharacterVoiceProfileRecord[];
  availableVoices: VoiceOptionRecord[];
  onRefresh: () => void;
  onPlayPreview: (url: string, title: string) => void;
}

export function VoiceStudio({
  projectId,
  characters,
  voiceProfiles,
  availableVoices,
  onRefresh,
  onPlayPreview,
}: VoiceStudioProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    characters[0]?.id || null
  );
  const [savingCharId, setSavingCharId] = useState<string | null>(null);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile map by character ID
  const profileMap = new Map<string, CharacterVoiceProfileRecord>();
  voiceProfiles.forEach((p) => profileMap.set(p.character_id, p));

  const activeChar = characters.find((c) => c.id === selectedCharacterId);
  const activeProfile = activeChar ? profileMap.get(activeChar.id) : undefined;

  // Form states for the selected character
  const [voiceId, setVoiceId] = useState<string>(
    activeProfile?.voice_id || availableVoices[0]?.voice_id || "tr-hero-male-1"
  );
  const [speed, setSpeed] = useState<number>(activeProfile?.speaking_rate ?? 1.0);
  const [pitch, setPitch] = useState<number>(activeProfile?.pitch ?? 0.0);
  const [stylePreset, setStylePreset] = useState<string>(activeProfile?.voice_style || "natural");
  const [testText, setTestText] = useState<string>(
    "Hello! I am ready to lend my voice to this grand animated tale."
  );

  // Sync state when active character changes
  React.useEffect(() => {
    if (activeChar) {
      const prof = profileMap.get(activeChar.id);
      setVoiceId(prof?.voice_id || availableVoices[0]?.voice_id || "tr-hero-male-1");
      setSpeed(prof?.speaking_rate ?? 1.0);
      setPitch(prof?.pitch ?? 0.0);
      setStylePreset(prof?.voice_style || "natural");
    }
  }, [selectedCharacterId, voiceProfiles]);

  const handleSaveProfile = async () => {
    if (!activeChar) return;
    try {
      setSavingCharId(activeChar.id);
      setError(null);
      setSuccessMsg(null);

      const chosenVoice = availableVoices.find((v) => v.voice_id === voiceId);

      await api.post(`/projects/${projectId}/audio/voice-profiles`, {
        character_id: activeChar.id,
        provider: chosenVoice?.provider || "mock",
        voice_id: voiceId,
        voice_name: chosenVoice?.name || voiceId,
        voice_style: stylePreset,
        speaking_rate: speed,
        pitch: pitch,
      });

      setSuccessMsg(`Voice profile saved for ${activeChar.name}!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save voice profile.");
    } finally {
      setSavingCharId(null);
    }
  };

  const handleTestPreview = async (testVoice: VoiceOptionRecord) => {
    try {
      setTestingVoiceId(testVoice.voice_id);
      setError(null);
      // If voice has preview_url, play directly
      if (testVoice.preview_url) {
        onPlayPreview(testVoice.preview_url, testVoice.name);
        return;
      }
      // Otherwise synthesize sample text
      if (activeChar) {
        // Synthesize via mock provider
        onPlayPreview(
          "",
          `${testVoice.name}: "${testVoice.sample_text || testText}"`
        );
      }
    } catch (err: any) {
      setError(err?.message || "Preview failed.");
    } finally {
      setTestingVoiceId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-violet-400" />
            Character Voice Studio
          </h3>
          <p className="text-xs text-zinc-400">
            Map each character to a consistent AI voice archetype, adjust speaking pace and pitch.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} className="border-zinc-700 text-zinc-300">
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-800/80 bg-emerald-950/40 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main split: Left list of characters, Right configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Character List */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
            Story Characters ({characters.length})
          </h4>

          {characters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 p-4 text-center text-xs text-zinc-500">
              No characters in this project.
            </div>
          ) : (
            characters.map((char) => {
              const isSelected = char.id === selectedCharacterId;
              const prof = profileMap.get(char.id);

              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setSelectedCharacterId(char.id)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-violet-500 bg-violet-950/30 shadow-sm"
                      : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-100">{char.name}</span>
                    <span className="text-[11px] text-zinc-400 capitalize">{char.role || "Character"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    {prof ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <Check className="h-3 w-3" />
                        {prof.voice_name || prof.voice_id}
                      </span>
                    ) : (
                      <span className="text-zinc-500 italic">No voice assigned</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Configuration Panel */}
        <div className="md:col-span-2 flex flex-col gap-5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          {activeChar ? (
            <>
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-zinc-100">
                    Voice Settings for {activeChar.name}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Role: <span className="text-zinc-300 capitalize">{activeChar.role || "Protagonist"}</span>
                    {" • "}
                    Style: <span className="text-zinc-300 capitalize">{activeChar.style || "Anime"}</span>
                  </p>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={savingCharId === activeChar.id}
                  className="bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
                >
                  {savingCharId === activeChar.id ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Voice Profile"
                  )}
                </Button>
              </div>

              {/* Voice Selector Grid */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Select Voice Archetype
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {availableVoices.map((voice) => {
                    const isPicked = voice.voice_id === voiceId;
                    return (
                      <div
                        key={voice.voice_id}
                        onClick={() => setVoiceId(voice.voice_id)}
                        className={`flex flex-col justify-between gap-2 rounded-lg border p-3 cursor-pointer transition-all ${
                          isPicked
                            ? "border-violet-500 bg-violet-950/40"
                            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/60"
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-xs text-zinc-100">{voice.name}</span>
                            <span className="text-[10px] uppercase tracking-wider rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                              {voice.provider}
                            </span>
                          </div>
                          {voice.description && (
                            <p className="text-[11px] text-zinc-400 leading-tight">
                              {voice.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {voice.traits?.map((trait, i) => (
                              <span
                                key={i}
                                className="text-[9px] rounded bg-zinc-800/80 px-1.5 py-0.2 text-zinc-400"
                              >
                                {trait}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                          <span className="text-[10px] text-zinc-500">
                            {voice.gender || "neutral"} • {voice.accent || "Standard"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestPreview(voice);
                            }}
                            className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300"
                          >
                            <Play className="h-3 w-3" />
                            Sample
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sliders: Speed & Pitch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Speaking Rate</span>
                    <span className="font-mono text-zinc-300">{speed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="h-1.5 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>0.5x (Slow)</span>
                    <span>1.0x (Normal)</span>
                    <span>1.8x (Fast)</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Pitch Offset</span>
                    <span className="font-mono text-zinc-300">{pitch > 0 ? `+${pitch}` : pitch}</span>
                  </div>
                  <input
                    type="range"
                    min={-6}
                    max={6}
                    step={0.5}
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="h-1.5 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>-6 (Deeper)</span>
                    <span>0 (Default)</span>
                    <span>+6 (Higher)</span>
                  </div>
                </div>
              </div>

              {/* Test Sandbox */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
                <label className="text-xs font-semibold text-zinc-400">Test Dialogue Sample</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
                    placeholder="Enter test line..."
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const v = availableVoices.find((x) => x.voice_id === voiceId);
                      if (v) handleTestPreview(v);
                    }}
                    className="border-zinc-700 text-zinc-300"
                  >
                    <Volume2 className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500">
              Select a character on the left to configure their voice profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
