"use client";

import React, { useState } from "react";
import {
  Film,
  Sliders,
  Sparkles,
  Volume2,
  Subtitles,
  Clock,
  Play,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AspectRatio,
  ContainerFormat,
  ExportRangeType,
  QualityPreset,
  RenderJobCreatePayload,
  VideoCodec,
} from "@tr-studio/shared-types";

interface ExportSettingsFormProps {
  projectId: string;
  scenes?: { id: string; title: string; scene_number: number }[];
  isSubmitting: boolean;
  onSubmit: (payload: RenderJobCreatePayload) => Promise<void>;
}

export function ExportSettingsForm({
  projectId,
  scenes = [],
  isSubmitting,
  onSubmit,
}: ExportSettingsFormProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolutionPreset, setResolutionPreset] = useState<"1080p" | "720p" | "4k">("1080p");
  const [fps, setFps] = useState<number>(24);
  const [container, setContainer] = useState<ContainerFormat>("mp4");
  const [videoCodec, setVideoCodec] = useState<VideoCodec>("h264");
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("standard");
  const [exportRange, setExportRange] = useState<ExportRangeType>("full");
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [customStartMs, setCustomStartMs] = useState<number>(0);
  const [customEndMs, setCustomEndMs] = useState<number>(5000);
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true);

  // Compute width & height from aspect ratio and resolution preset
  const getDimensions = (): { width: number; height: number } => {
    switch (aspectRatio) {
      case "16:9":
        if (resolutionPreset === "4k") return { width: 3840, height: 2160 };
        if (resolutionPreset === "720p") return { width: 1280, height: 720 };
        return { width: 1920, height: 1080 };
      case "9:16":
        if (resolutionPreset === "4k") return { width: 2160, height: 3840 };
        if (resolutionPreset === "720p") return { width: 720, height: 1280 };
        return { width: 1080, height: 1920 };
      case "1:1":
        if (resolutionPreset === "4k") return { width: 2160, height: 2160 };
        if (resolutionPreset === "720p") return { width: 720, height: 720 };
        return { width: 1080, height: 1080 };
      case "4:3":
        if (resolutionPreset === "4k") return { width: 2880, height: 2160 };
        if (resolutionPreset === "720p") return { width: 960, height: 720 };
        return { width: 1440, height: 1080 };
      case "21:9":
        if (resolutionPreset === "4k") return { width: 5120, height: 2160 };
        if (resolutionPreset === "720p") return { width: 1680, height: 720 };
        return { width: 2560, height: 1080 };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dims = getDimensions();
    const payload: RenderJobCreatePayload = {
      resolution_width: dims.width,
      resolution_height: dims.height,
      aspect_ratio: aspectRatio,
      fps,
      container_format: container,
      video_codec: videoCodec,
      quality_preset: qualityPreset,
      export_range_type: exportRange,
      scene_id: exportRange === "scene" && selectedSceneId ? selectedSceneId : null,
      export_range_start_ms: exportRange === "custom" ? customStartMs : 0,
      export_range_end_ms: exportRange === "custom" ? customEndMs : null,
      include_audio: includeAudio,
      include_subtitles: burnSubtitles,
      burn_subtitles: burnSubtitles,
    };
    await onSubmit(payload);
  };

  const dims = getDimensions();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-violet-400" />
            Video Export Settings
          </h2>
          <p className="text-xs text-zinc-400">
            Configure resolution, frame rate, audio mixing, and anime subtitle options.
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950 px-3 py-1.5 border border-zinc-800 text-xs font-mono text-zinc-300">
          {dims.width} × {dims.height} ({aspectRatio}) • {fps} FPS
        </div>
      </div>

      {/* Aspect Ratio & Resolution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-2">Aspect Ratio</label>
          <div className="grid grid-cols-3 gap-2">
            {(["16:9", "9:16", "1:1", "4:3", "21:9"] as AspectRatio[]).map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => setAspectRatio(ar)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  aspectRatio === ar
                    ? "border-violet-500 bg-violet-600/20 text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {ar}
                <span className="block text-[10px] text-zinc-500 mt-0.5">
                  {ar === "16:9" && "Widescreen"}
                  {ar === "9:16" && "Vertical (Reels)"}
                  {ar === "1:1" && "Square"}
                  {ar === "4:3" && "Retro TV"}
                  {ar === "21:9" && "Cinematic"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-2">Resolution Quality</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "720p", label: "720p HD", note: "Fastest render" },
              { id: "1080p", label: "1080p Full HD", note: "Recommended" },
              { id: "4k", label: "4K UHD", note: "Maximum quality" },
            ].map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => setResolutionPreset(res.id as any)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  resolutionPreset === res.id
                    ? "border-violet-500 bg-violet-600/20 text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {res.label}
                <span className="block text-[10px] text-zinc-500 mt-0.5">{res.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Frame Rate & Codec */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Frame Rate (FPS)</label>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value={24}>24 FPS (Cinematic Anime Standard)</option>
            <option value={30}>30 FPS (Smooth Broadcast)</option>
            <option value={60}>60 FPS (Ultra Fluid)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Format & Container</label>
          <select
            value={container}
            onChange={(e) => {
              const val = e.target.value as ContainerFormat;
              setContainer(val);
              if (val === "webm") setVideoCodec("vp9");
              if (val === "mp4") setVideoCodec("h264");
            }}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="mp4">MP4 (.mp4 — Universally Playable)</option>
            <option value="webm">WebM (.webm — Modern Web Optimized)</option>
            <option value="mov">QuickTime MOV (.mov — Studio Master)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Quality Preset</label>
          <select
            value={qualityPreset}
            onChange={(e) => setQualityPreset(e.target.value as QualityPreset)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="draft">Draft (Fastest preview export)</option>
            <option value="standard">Standard (Balanced size & detail)</option>
            <option value="high">High Quality (Crisp anime lines)</option>
            <option value="production">Production Master (Lossless master)</option>
          </select>
        </div>
      </div>

      {/* Export Range */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
        <label className="block text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-violet-400" />
          Export Timeline Range
        </label>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input
              type="radio"
              name="exportRange"
              value="full"
              checked={exportRange === "full"}
              onChange={() => setExportRange("full")}
              className="accent-violet-500"
            />
            Full Story Timeline
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input
              type="radio"
              name="exportRange"
              value="scene"
              checked={exportRange === "scene"}
              onChange={() => setExportRange("scene")}
              className="accent-violet-500"
            />
            Single Scene
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input
              type="radio"
              name="exportRange"
              value="custom"
              checked={exportRange === "custom"}
              onChange={() => setExportRange("custom")}
              className="accent-violet-500"
            />
            Custom Range (ms)
          </label>
        </div>

        {exportRange === "scene" && (
          <div className="pt-2">
            <select
              value={selectedSceneId}
              onChange={(e) => setSelectedSceneId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"
            >
              <option value="">Select a scene to render...</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  Scene {s.scene_number}: {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {exportRange === "custom" && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="block text-[11px] text-zinc-400 mb-1">Start Time (ms)</span>
              <input
                type="number"
                min={0}
                step={100}
                value={customStartMs}
                onChange={(e) => setCustomStartMs(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
              />
            </div>
            <div>
              <span className="block text-[11px] text-zinc-400 mb-1">End Time (ms)</span>
              <input
                type="number"
                min={500}
                step={100}
                value={customEndMs}
                onChange={(e) => setCustomEndMs(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Audio & Subtitles Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 cursor-pointer hover:border-zinc-700 transition">
          <input
            type="checkbox"
            checked={includeAudio}
            onChange={(e) => setIncludeAudio(e.target.checked)}
            className="mt-0.5 accent-violet-500 h-4 w-4 rounded"
          />
          <div>
            <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              Include Master Audio Track
            </span>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Mixes voice dialogue, narration, background music, and sound effects with synchronized delays.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 cursor-pointer hover:border-zinc-700 transition">
          <input
            type="checkbox"
            checked={burnSubtitles}
            onChange={(e) => setBurnSubtitles(e.target.checked)}
            className="mt-0.5 accent-violet-500 h-4 w-4 rounded"
          />
          <div>
            <span className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
              <Subtitles className="h-3.5 w-3.5 text-amber-400" />
              Burn Anime Subtitles
            </span>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Renders stylized subtitles with character speaker labels directly onto video frames.
            </p>
          </div>
        </label>
      </div>

      {/* Action Button */}
      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs px-6 py-2.5 shadow-lg shadow-violet-600/20 inline-flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Starting Video Render...
            </>
          ) : (
            <>
              <Film className="h-4 w-4" />
              Start Video Render
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
