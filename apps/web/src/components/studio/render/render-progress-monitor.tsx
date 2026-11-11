"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Loader2,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RenderJobRecord } from "@tr-studio/shared-types";

interface RenderProgressMonitorProps {
  job: RenderJobRecord;
  onCancel?: (jobId: string) => Promise<void>;
  onRetry?: (jobId: string) => Promise<void>;
}

export function RenderProgressMonitor({
  job,
  onCancel,
  onRetry,
}: RenderProgressMonitorProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const isTerminal = ["completed", "failed", "cancelled"].includes(job.status);

  const getStatusBadge = () => {
    switch (job.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 border border-red-500/20">
            <AlertTriangle className="h-3.5 w-3.5" />
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-400 border border-zinc-500/20">
            <Ban className="h-3.5 w-3.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-400 border border-violet-500/20">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        );
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsActing(true);
    try {
      await onCancel(job.id);
    } finally {
      setIsActing(false);
    }
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsActing(true);
    try {
      await onRetry(job.id);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-violet-400">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">
                Render Job: {job.resolution_width}×{job.resolution_height} ({job.aspect_ratio})
              </span>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {job.video_codec.toUpperCase()} • {job.fps} FPS • {job.quality_preset} preset
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isTerminal && onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isActing}
              onClick={handleCancel}
              className="border-zinc-700 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <Ban className="h-3.5 w-3.5 mr-1 text-red-400" />
              Cancel
            </Button>
          )}

          {isTerminal && onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isActing}
              onClick={handleRetry}
              className="border-zinc-700 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1 text-violet-400" />
              Retry Render
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-300 font-medium">{job.current_stage}</span>
          <span className="text-zinc-400 font-mono">{job.progress_pct.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-950 border border-zinc-800">
          <div
            className={`h-full transition-all duration-300 ${
              job.status === "failed"
                ? "bg-red-500"
                : job.status === "completed"
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-violet-600 to-indigo-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, job.progress_pct))}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs">
        <div>
          <span className="block text-[11px] text-zinc-500">Rendered Frames</span>
          <span className="font-mono text-zinc-200">
            {job.rendered_frames} / {job.total_frames}
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-zinc-500">Duration</span>
          <span className="font-mono text-zinc-200">
            {(job.duration_ms / 1000).toFixed(1)}s
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-zinc-500">Subtitles</span>
          <span className="text-zinc-200">
            {job.burn_subtitles ? "Burned-in" : "None"}
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-zinc-500">Audio Mix</span>
          <span className="text-zinc-200">
            {job.include_audio ? "Included (Master)" : "Muted"}
          </span>
        </div>
      </div>

      {/* Error Message if Failed */}
      {job.error_message && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          <div className="font-semibold flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            Rendering Error
          </div>
          <p className="font-mono text-[11px] break-all">{job.error_message}</p>
        </div>
      )}

      {/* Diagnostic Logs Accordion */}
      {job.render_logs && job.render_logs.length > 0 && (
        <div className="border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Terminal className="h-3.5 w-3.5 text-zinc-500" />
              Pipeline Execution Logs ({job.render_logs.length})
            </span>
            {showLogs ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showLogs && (
            <div className="mt-2.5 max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300 space-y-1">
              {job.render_logs.map((log, idx) => (
                <div key={idx} className="border-b border-zinc-900 pb-1 last:border-0 last:pb-0">
                  <span className="text-zinc-600 mr-2">[{idx + 1}]</span>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
