"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
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
import type { DialogueLineRecord, NarrationLineRecord } from "@tr-studio/shared-types";

interface DialogueEditorProps {
  projectId: string;
  sceneId: string;
  dialogueLines: DialogueLineRecord[];
  narrationLines: NarrationLineRecord[];
  onRefresh: () => void;
  onPlayPreview: (url: string, title: string) => void;
}

export function DialogueEditor({
  projectId,
  sceneId,
  dialogueLines,
  narrationLines,
  onRefresh,
  onPlayPreview,
}: DialogueEditorProps) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable local state for speeds / emotions
  const [editedSpeeds, setEditedSpeeds] = useState<Record<string, number>>({});
  const [editedPauses, setEditedPauses] = useState<Record<string, number>>({});

  const handleGenerateDialogueSpeech = async (lineId: string) => {
    try {
      setGeneratingId(lineId);
      setError(null);
      const speed = editedSpeeds[lineId];
      await api.post(`/projects/${projectId}/audio/dialogue/${lineId}/generate`, {
        speaking_speed: speed,
      });
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Speech generation failed.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateNarrationSpeech = async (narrId: string) => {
    try {
      setGeneratingId(narrId);
      setError(null);
      await api.post(`/projects/${projectId}/audio/narration/${narrId}/generate`, {});
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Narration speech generation failed.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleBatchGenerate = async () => {
    try {
      setBatchGenerating(true);
      setError(null);
      await api.post(`/projects/${projectId}/audio/generate-batch`, {
        scene_id: sceneId,
        force_regenerate: false,
      });
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Batch generation failed.");
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleSaveTiming = async (lineId: string) => {
    try {
      setSavingId(lineId);
      const speed = editedSpeeds[lineId];
      const pause = editedPauses[lineId];
      await api.patch(`/projects/${projectId}/audio/dialogue/${lineId}`, {
        speaking_speed: speed,
        pause_duration_ms: pause,
      });
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Failed to save timing.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Mic className="h-4 w-4 text-violet-400" />
            Dialogue & Narration Audio Lines
          </h3>
          <p className="text-xs text-zinc-400">
            Assign character voices, calibrate speaking rates, adjust pauses, and synthesize AI dialogue audio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleBatchGenerate}
            disabled={batchGenerating}
            className="bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
          >
            {batchGenerating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating Scene Audio...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                Batch Generate All Speech
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onRefresh} className="border-zinc-700 text-zinc-300">
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dialogue Lines List */}
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Character Dialogue ({dialogueLines.length})
        </h4>

        {dialogueLines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-500">
            No dialogue lines found in this scene. Create dialogue lines in the Screenplay or Scene Builder!
          </div>
        ) : (
          dialogueLines.map((line) => {
            const speed = editedSpeeds[line.id] ?? line.speaking_speed ?? 1.0;
            const pause = editedPauses[line.id] ?? line.pause_duration_ms ?? 0;
            const isReady = line.audio_status === "ready" && line.audio_url;
            const isGenerating = generatingId === line.id;
            const isSaving = savingId === line.id;

            return (
              <div
                key={line.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-violet-950/80 px-2 py-0.5 text-xs font-medium text-violet-300 border border-violet-800/50">
                      {line.character_name || "Character"}
                    </span>
                    {line.emotion && (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 italic">
                        ({line.emotion})
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-500">Line #{line.line_order}</span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isReady ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/70 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-800/50">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready ({Math.round((line.duration_ms || 0) / 100) / 10}s)
                      </span>
                    ) : line.audio_status === "failed" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-950/70 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-800/50">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Line text */}
                <p className="text-sm text-zinc-100 font-serif leading-relaxed px-1">
                  "{line.line_text}"
                </p>

                {/* Audio controls & timing sliders */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/60 pt-3 text-xs">
                  <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">Speed:</span>
                      <input
                        type="range"
                        min={0.5}
                        max={1.75}
                        step={0.05}
                        value={speed}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditedSpeeds((prev) => ({ ...prev, [line.id]: val }));
                        }}
                        className="w-20 h-1 cursor-pointer appearance-none rounded bg-zinc-800 accent-violet-500"
                      />
                      <span className="font-mono text-zinc-300 w-8">{speed.toFixed(2)}x</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">Pause:</span>
                      <input
                        type="number"
                        min={0}
                        max={3000}
                        step={50}
                        value={pause}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setEditedPauses((prev) => ({ ...prev, [line.id]: val }));
                        }}
                        className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200"
                      />
                      <span className="text-zinc-500">ms</span>
                    </div>

                    {(editedSpeeds[line.id] !== undefined || editedPauses[line.id] !== undefined) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveTiming(line.id)}
                        disabled={isSaving}
                        className="text-xs text-violet-400 hover:text-violet-300 h-6 px-2"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isReady && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onPlayPreview(
                            resolveMediaUrl(line.audio_url!),
                            `${line.character_name || "Character"}: "${line.line_text.slice(0, 30)}..."`
                          )
                        }
                        className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                      >
                        <Play className="h-3 w-3 mr-1 text-emerald-400" />
                        Play
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleGenerateDialogueSpeech(line.id)}
                      disabled={isGenerating}
                      className="bg-violet-600/90 hover:bg-violet-600 text-white"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3 mr-1" />
                          {isReady ? "Regenerate" : "Generate Voice"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Narration Lines List */}
      <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Voiceover Narration ({narrationLines.length})
        </h4>

        {narrationLines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-500">
            No narration lines in this scene.
          </div>
        ) : (
          narrationLines.map((narr) => {
            const isReady = narr.audio_status === "ready" && narr.audio_url;
            const isGenerating = generatingId === narr.id;

            return (
              <div
                key={narr.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-300 border border-amber-800/50">
                      Narrator (Voiceover)
                    </span>
                    <span className="text-[11px] text-zinc-500">Line #{narr.line_order}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isReady ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/70 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-800/50">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready ({Math.round((narr.duration_ms || 0) / 100) / 10}s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-zinc-200 italic font-serif leading-relaxed px-1">
                  "{narr.narration_text}"
                </p>

                <div className="flex items-center justify-end gap-2 border-t border-zinc-800/60 pt-3">
                  {isReady && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onPlayPreview(
                          resolveMediaUrl(narr.audio_url!),
                          `Narrator: "${narr.narration_text.slice(0, 30)}..."`
                        )
                      }
                      className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    >
                      <Play className="h-3 w-3 mr-1 text-emerald-400" />
                      Play
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleGenerateNarrationSpeech(narr.id)}
                    disabled={isGenerating}
                    className="bg-amber-600/90 hover:bg-amber-600 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3 mr-1" />
                        {isReady ? "Regenerate" : "Generate Narration"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
