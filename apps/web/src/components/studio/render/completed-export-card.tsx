"use client";

import React, { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Film,
  HardDrive,
  Play,
  Trash2,
  Video,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/api";
import type { RenderOutputRecord } from "@tr-studio/shared-types";

interface CompletedExportCardProps {
  output: RenderOutputRecord;
  onDelete?: (outputId: string) => Promise<void>;
}

export function CompletedExportCard({ output, onDelete }: CompletedExportCardProps) {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const mediaUrl = resolveMediaUrl(output.media_url);
  const downloadUrl = resolveMediaUrl(output.download_url);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleCopyLink = () => {
    if (!mediaUrl) return;
    navigator.clipboard.writeText(mediaUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Are you sure you want to delete "${output.title}"?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(output.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur transition hover:border-zinc-700">
      {/* Video Player Preview */}
      <div className="relative aspect-video w-full bg-black">
        {mediaUrl ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={mediaUrl}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            <Video className="h-10 w-10" />
          </div>
        )}
      </div>

      {/* Details & Actions */}
      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">
              {output.title}
            </h3>
            <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 border border-violet-500/20 whitespace-nowrap">
              {output.aspect_ratio}
            </span>
          </div>

          {/* Technical Specs Pill Tags */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-zinc-300">
              {output.width}×{output.height}
            </span>
            <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-zinc-300">
              {output.fps} FPS
            </span>
            <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-zinc-300 uppercase">
              {output.video_codec}
            </span>
            {output.audio_codec && (
              <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-zinc-300 uppercase">
                {output.audio_codec}
              </span>
            )}
            <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-zinc-400">
              {(output.duration_ms / 1000).toFixed(1)}s
            </span>
            <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-zinc-400">
              {formatFileSize(output.file_size_bytes)}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-violet-500 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Share Link
                </>
              )}
            </Button>
          </div>

          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={handleDelete}
              className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 px-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
