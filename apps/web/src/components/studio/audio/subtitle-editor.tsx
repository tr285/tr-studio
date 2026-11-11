"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { SubtitleTrackRecord } from "@tr-studio/shared-types";

interface SubtitleEditorProps {
  projectId: string;
  sceneId: string;
  tracks: SubtitleTrackRecord[];
  onRefresh: () => void;
}

export function SubtitleEditor({
  projectId,
  sceneId,
  tracks,
  onRefresh,
}: SubtitleEditorProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    tracks[0]?.id || null
  );
  const [isPopulating, setIsPopulating] = useState(false);
  const [isExporting, setIsExporting] = useState<"srt" | "vtt" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewTrack, setShowNewTrack] = useState(false);
  const [newTrackLang, setNewTrackLang] = useState("en");
  const [newTrackName, setNewTrackName] = useState("English (Main)");

  const activeTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const res = await api.post<{ id: string }>(`/projects/${projectId}/audio/subtitles`, {
        language: newTrackLang,
        name: newTrackName,
        scene_id: sceneId,
        is_default: tracks.length === 0,
      });
      setShowNewTrack(false);
      onRefresh();
      setSelectedTrackId(res.id);
    } catch (err: any) {
      setError(err?.message || "Failed to create subtitle track.");
    }
  };

  const handlePopulateFromScene = async () => {
    if (!activeTrack) return;
    try {
      setIsPopulating(true);
      setError(null);
      await api.post(
        `/projects/${projectId}/audio/subtitles/${activeTrack.id}/populate?scene_id=${sceneId}`
      );
      onRefresh();
    } catch (err: any) {
      setError(err?.message || "Failed to populate subtitles from scene.");
    } finally {
      setIsPopulating(false);
    }
  };

  const handleExport = async (format: "srt" | "vtt") => {
    if (!activeTrack) return;
    try {
      setIsExporting(format);
      setError(null);
      const res = await api.get<{ content: string; filename: string }>(
        `/projects/${projectId}/audio/subtitles/${activeTrack.id}/export?format=${format}`
      );

      // Trigger browser file download
      const blob = new Blob([res.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setIsExporting(null);
    }
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    const remMs = ms % 1000;
    return `${m}:${rem < 10 ? "0" : ""}${rem}.${Math.floor(remMs / 100)}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-400" />
            Subtitles & Closed Captions
          </h3>
          <p className="text-xs text-zinc-400">
            Generate, edit, and export synchronized subtitles (.SRT &amp; WebVTT) for dialog and narration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTrack && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePopulateFromScene}
                disabled={isPopulating}
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                {isPopulating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                )}
                Populate from Scene
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport("srt")}
                disabled={isExporting === "srt"}
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export .SRT
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExport("vtt")}
                disabled={isExporting === "vtt"}
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export .VTT
              </Button>
            </>
          )}

          <Button
            size="sm"
            onClick={() => setShowNewTrack(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Track
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* New Track Form */}
      {showNewTrack && (
        <form
          onSubmit={handleCreateTrack}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-violet-800/60 bg-zinc-950 p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-300">Language Code</label>
            <input
              type="text"
              value={newTrackLang}
              onChange={(e) => setNewTrackLang(e.target.value)}
              placeholder="en, ja, fr, es"
              required
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 w-24"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-zinc-300">Track Label</label>
            <input
              type="text"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              placeholder="e.g. English (SDH) or Japanese Subtitles"
              required
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNewTrack(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-500 text-white">
              Create Track
            </Button>
          </div>
        </form>
      )}

      {/* Track Selector Tabs */}
      {tracks.length > 0 && (
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTrackId(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                (activeTrack?.id === t.id)
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.name} ({t.language.toUpperCase()})
            </button>
          ))}
        </div>
      )}

      {/* Subtitle Entries Table */}
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span>Entries ({activeTrack?.entries?.length || 0})</span>
          <span>Timecode Range</span>
        </div>

        {!activeTrack || !activeTrack.entries || activeTrack.entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
            No subtitles yet. Click "Populate from Scene" above to auto-generate from scene dialogues and narration!
          </div>
        ) : (
          activeTrack.entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-4 rounded border border-zinc-800/60 bg-zinc-950/60 p-3 hover:border-zinc-700"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-zinc-500 w-6 pt-0.5">#{idx + 1}</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-violet-300">
                    {entry.speaker_name || "Speaker"}
                  </span>
                  <p className="text-sm text-zinc-100 font-serif leading-relaxed">
                    {entry.text}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 shrink-0 pt-0.5">
                <Clock className="h-3 w-3 text-zinc-500" />
                <span>{formatMs(entry.start_ms)}</span>
                <span>→</span>
                <span>{formatMs(entry.end_ms)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
