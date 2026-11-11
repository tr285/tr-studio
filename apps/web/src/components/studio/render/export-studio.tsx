"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Clock,
  Film,
  HardDrive,
  History,
  Layers,
  Loader2,
  PlusCircle,
  Video,
} from "lucide-react";
import { CompletedExportCard } from "@/components/studio/render/completed-export-card";
import { ExportSettingsForm } from "@/components/studio/render/export-settings-form";
import { RenderProgressMonitor } from "@/components/studio/render/render-progress-monitor";
import { errorMessage } from "@/components/studio/scene-studio-common";
import { api } from "@/lib/api";
import type {
  RenderJobCreatePayload,
  RenderJobRecord,
  RenderOutputRecord,
} from "@tr-studio/shared-types";

interface ExportStudioProps {
  projectId: string;
}

export function ExportStudio({ projectId }: ExportStudioProps) {
  const [activeTab, setActiveTab] = useState<"export" | "jobs" | "history">("export");
  const [scenes, setScenes] = useState<{ id: string; title: string; scene_number: number }[]>([]);
  const [jobs, setJobs] = useState<RenderJobRecord[]>([]);
  const [outputs, setOutputs] = useState<RenderOutputRecord[]>([]);
  const [activeJob, setActiveJob] = useState<RenderJobRecord | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load project scenes, existing jobs, and completed outputs
  const loadStudioData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load scenes
      const scenesRes = await api.sceneBuilder.listProjectScenes(projectId).catch(() => []);
      if (Array.isArray(scenesRes)) {
        setScenes(
          scenesRes.map((s) => ({
            id: s.id,
            title: s.title,
            scene_number: s.scene_number,
          }))
        );
      }

      // Load jobs
      const jobsRes = await api.render.listJobs(projectId).catch(() => ({ jobs: [], total: 0 }));
      setJobs(jobsRes.jobs || []);

      // If any active job, set it as active
      const inProgress = (jobsRes.jobs || []).find((j) =>
        ["queued", "preparing", "rendering", "encoding", "validating"].includes(j.status)
      );
      if (inProgress) {
        setActiveJob(inProgress);
      }

      // Load exports
      const outputsRes = await api.exports.list(projectId).catch(() => ({ outputs: [], total: 0 }));
      setOutputs(outputsRes.outputs || []);
    } catch (err) {
      setError(errorMessage(err, "Failed to load video export studio data."));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  // Polling active render job
  useEffect(() => {
    if (!activeJob) return;
    const isTerminal = ["completed", "failed", "cancelled"].includes(activeJob.status);
    if (isTerminal) return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.render.getJob(activeJob.id);
        setActiveJob(updated);

        // Update in jobs list
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));

        if (updated.status === "completed") {
          // Refresh outputs
          const outputsRes = await api.exports.list(projectId).catch(() => ({ outputs: [], total: 0 }));
          setOutputs(outputsRes.outputs || []);
        }
      } catch {
        // Silently ignore transient polling network errors
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJob, projectId]);

  const handleStartRender = async (payload: RenderJobCreatePayload) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newJob = await api.render.createJob(projectId, payload);
      setActiveJob(newJob);
      setJobs((prev) => [newJob, ...prev]);
      setActiveTab("jobs");
    } catch (err) {
      setError(errorMessage(err, "Failed to start render pipeline."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const updated = await api.render.cancelJob(jobId);
      setActiveJob((curr) => (curr?.id === jobId ? updated : curr));
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    } catch (err) {
      setError(errorMessage(err, "Failed to cancel render job."));
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const updated = await api.render.retryJob(jobId);
      setActiveJob(updated);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    } catch (err) {
      setError(errorMessage(err, "Failed to retry render job."));
    }
  };

  const handleDeleteOutput = async (outputId: string) => {
    try {
      await api.exports.delete(outputId);
      setOutputs((prev) => prev.filter((o) => o.id !== outputId));
    } catch (err) {
      setError(errorMessage(err, "Failed to delete export."));
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400 border border-violet-500/20">
              Step 9 Pipeline
            </span>
            <span className="text-xs text-zinc-500">FFmpeg 9.0 • Pillow Frame Compositor</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Video className="h-6 w-6 text-violet-500" />
            Video Rendering & Export Studio
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Convert synchronized 2D animations, character assets, environments, audio mixing, and dialogue subtitles into finished MP4/WebM videos.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
              activeTab === "export"
                ? "bg-violet-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New Export
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("jobs")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
              activeTab === "jobs"
                ? "bg-violet-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Render Queue ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
              activeTab === "history"
                ? "bg-violet-600 text-white shadow"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Export History ({outputs.length})
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Job Floating / Prominent Progress Monitor */}
      {activeJob && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-ping" />
            Active Rendering Monitor
          </div>
          <RenderProgressMonitor
            job={activeJob}
            onCancel={handleCancelJob}
            onRetry={handleRetryJob}
          />
        </div>
      )}

      {/* Tab 1: New Export Form */}
      {activeTab === "export" && (
        <ExportSettingsForm
          projectId={projectId}
          scenes={scenes}
          isSubmitting={isSubmitting}
          onSubmit={handleStartRender}
        />
      )}

      {/* Tab 2: Render Queue / Jobs History */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Recent Render Pipeline Jobs</h2>
            <span className="text-xs text-zinc-500">{jobs.length} total jobs recorded</span>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
              No render jobs initiated yet. Click "New Export" to render a video.
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <RenderProgressMonitor
                  key={job.id}
                  job={job}
                  onCancel={handleCancelJob}
                  onRetry={handleRetryJob}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Completed Exports Gallery */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Finished Project Videos</h2>
            <span className="text-xs text-zinc-500">{outputs.length} videos ready</span>
          </div>

          {outputs.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
              No exported videos available yet. Render your first video from the "New Export" tab.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {outputs.map((out) => (
                <CompletedExportCard
                  key={out.id}
                  output={out}
                  onDelete={handleDeleteOutput}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
