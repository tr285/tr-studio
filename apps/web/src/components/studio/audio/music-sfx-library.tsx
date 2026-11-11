"use client";

import React, { useRef, useState } from "react";
import {
  AlertCircle,
  Clock,
  Filter,
  HardDrive,
  Loader2,
  Music,
  Play,
  Plus,
  Radio,
  Search,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, resolveMediaUrl } from "@/lib/api";
import type { AudioAssetRecord, AudioCategoryType } from "@tr-studio/shared-types";

interface MusicSfxLibraryProps {
  projectId: string;
  assets: AudioAssetRecord[];
  onRefresh: () => void;
  onPlayPreview: (url: string, title: string) => void;
  onAddToTimeline?: (asset: AudioAssetRecord) => void;
}

export function MusicSfxLibrary({
  projectId,
  assets,
  onRefresh,
  onPlayPreview,
  onAddToTimeline,
}: MusicSfxLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload modal / form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<AudioCategoryType>("music");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubCategory, setUploadSubCategory] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      setUploadError("Please select an audio file to upload.");
      return;
    }
    const file = files[0];
    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      formData.append("title", uploadTitle || file.name.replace(/\.[^/.]+$/, ""));
      if (uploadSubCategory) formData.append("sub_category", uploadSubCategory);
      if (uploadDesc) formData.append("description", uploadDesc);

      await api.post(`/projects/${projectId}/audio/assets/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowUploadForm(false);
      setUploadTitle("");
      setUploadDesc("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onRefresh();
    } catch (err: any) {
      setUploadError(err?.message || "Audio file upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm("Are you sure you want to delete this audio asset?")) return;
    try {
      setDeletingId(assetId);
      await api.delete(`/audio-assets/${assetId}`);
      onRefresh();
    } catch (err: any) {
      alert(err?.message || "Failed to delete audio asset.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    if (selectedCategory !== "all" && asset.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        asset.title.toLowerCase().includes(q) ||
        (asset.description && asset.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Music className="h-4 w-4 text-violet-400" />
            Music & Sound Effects Library
          </h3>
          <p className="text-xs text-zinc-400">
            Import, preview, and organize background musical scores, foley effects, and environmental ambience.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import Audio File
        </Button>
      </div>

      {/* Upload Form Modal / Drawer */}
      {showUploadForm && (
        <form
          onSubmit={handleFileUpload}
          className="flex flex-col gap-4 rounded-lg border border-violet-800/60 bg-zinc-950 p-5 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Upload className="h-4 w-4 text-violet-400" />
              Upload Audio Track (WAV, MP3, OGG, AAC)
            </h4>
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 rounded bg-red-950/40 border border-red-800 p-2 text-xs text-red-300">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-300">Audio File *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.aac,.flac"
                required
                className="w-full text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-violet-500 cursor-pointer"
              />
              <span className="text-[10px] text-zinc-500">Max size: 25 MB. Magic bytes validated.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-300">Category *</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as AudioCategoryType)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
              >
                <option value="music">Music / Soundtrack</option>
                <option value="sound_effect">Sound Effect (SFX)</option>
                <option value="ambience">Ambience / Environmental</option>
                <option value="dialogue">Character Dialogue</option>
                <option value="narration">Narration Voiceover</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-300">Title</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Battle in the Astral Citadel"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-zinc-300">Sub-Category</label>
              <input
                type="text"
                value={uploadSubCategory}
                onChange={(e) => setUploadSubCategory(e.target.value)}
                placeholder="e.g. Action, Tension, Foley, Footsteps"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUploadForm(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isUploading}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Uploading & Analyzing Waveform...
                </>
              ) : (
                "Save & Upload"
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {["all", "music", "sound_effect", "ambience", "dialogue"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                selectedCategory === cat
                  ? "bg-violet-600 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {cat === "all" ? "All Tracks" : cat.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audio titles..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
            No audio assets found in this category. Click "Import Audio File" above to upload music or SFX.
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const isDeleting = deletingId === asset.id;
            const durationSec = Math.round(asset.duration_ms / 100) / 10;
            const peaks = asset.waveform_data || Array(32).fill(0.2);

            return (
              <div
                key={asset.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm text-zinc-100">{asset.title}</span>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span className="capitalize rounded bg-zinc-800 px-1.5 py-0.2 text-zinc-300">
                        {asset.category.replace("_", " ")}
                      </span>
                      {asset.sub_category && <span>• {asset.sub_category}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(asset.id)}
                    disabled={isDeleting}
                    className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                    title="Delete track"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Mini Waveform Visualization */}
                <div className="flex h-7 items-center gap-[2px] rounded bg-zinc-950 px-2 py-1 overflow-hidden">
                  {peaks.slice(0, 36).map((p, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-violet-500/70"
                      style={{ height: `${Math.max(15, p * 100)}%` }}
                    />
                  ))}
                </div>

                {/* Details & Actions */}
                <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono text-zinc-300">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      {durationSec}s
                    </span>
                    <span>•</span>
                    <span className="font-mono">{asset.sample_rate / 1000}kHz</span>
                    <span>•</span>
                    <span>{asset.channels === 1 ? "Mono" : "Stereo"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPlayPreview(resolveMediaUrl(asset.audio_url), asset.title)}
                      className="border-zinc-700 text-zinc-200 hover:bg-zinc-800 h-7 text-xs px-2.5"
                    >
                      <Play className="h-3 w-3 mr-1 text-emerald-400" />
                      Play
                    </Button>
                    {onAddToTimeline && (
                      <Button
                        size="sm"
                        onClick={() => onAddToTimeline(asset)}
                        className="bg-violet-600 hover:bg-violet-500 text-white h-7 text-xs px-2.5"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Timeline
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
