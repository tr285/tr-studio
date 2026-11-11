"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Download, Loader2, Plus, Sparkles, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { SceneAIPanel } from "@/components/studio/scene-ai-panel";
import {
  AssetImage,
  ConfirmDeleteButton,
  ErrorBanner,
  SceneStudioFrame,
  errorMessage,
  fieldClass,
  formatDuration,
  labelClass,
} from "@/components/studio/scene-studio-common";
import { SCENE_TYPE_PRESETS } from "@tr-studio/scene-schema";
import type { SceneDetailRecord } from "@tr-studio/shared-types";

const PAGE_SIZE = 12;

export function SceneListWorkspace({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<SceneDetailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [title, setTitle] = useState("");
  const [sceneType, setSceneType] = useState<string>("Narrative");
  const [customType, setCustomType] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setScenes(await api.sceneBuilder.listProjectScenes(projectId));
    } catch (err) {
      setError(errorMessage(err, "Failed to load scenes."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(scenes.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = useMemo(
    () => scenes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [scenes, safePage]
  );

  const createScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.sceneBuilder.createScene(projectId, {
        title: title.trim(),
        scene_type: sceneType === "Custom" ? customType.trim() || "Custom" : sceneType,
      });
      setTitle("");
      setScenes((prev) => [...prev, created]);
      setNotice(`Created scene “${created.title}”.`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create scene."));
    } finally {
      setCreating(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api.sceneBuilder.duplicateScene(id);
      await load();
      setNotice("Scene duplicated.");
    } catch (err) {
      setError(errorMessage(err, "Failed to duplicate scene."));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api.sceneBuilder.deleteScene(id);
      await load();
      setNotice("Scene deleted.");
    } catch (err) {
      setError(errorMessage(err, "Failed to delete scene."));
    } finally {
      setBusyId(null);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await api.sceneBuilder.syncWithStory(projectId);
      await load();
      setNotice(
        `Synced ${res.scenes_synced} scene(s) from the story · ${res.characters_matched} character and ${res.environments_matched} environment match(es)` +
          (res.missing_references_detected.length
            ? ` · ${res.missing_references_detected.length} missing reference(s) detected.`
            : ".")
      );
    } catch (err) {
      setError(errorMessage(err, "Story sync failed."));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SceneStudioFrame
      projectId={projectId}
      active="scenes"
      title="Scene Builder"
      description="Compose scenes from your story using Character Studio and Environment Studio assets. Static composition only."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => void sync()} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Sync from Story
          </Button>
          <Button size="sm" onClick={() => setShowAI((v) => !v)} aria-expanded={showAI}>
            <Sparkles className="h-3.5 w-3.5" />
            AI Scene Breakdown
          </Button>
        </>
      }
    >
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {notice}
        </div>
      )}

      {showAI && (
        <SceneAIPanel
          projectId={projectId}
          mode="scenes"
          onApplied={load}
          onClose={() => setShowAI(false)}
        />
      )}

      <form onSubmit={createScene} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <div>
          <label className={labelClass} htmlFor="new-scene-title">New scene title</label>
          <input id="new-scene-title" required className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Abandoned Library" />
        </div>
        <div>
          <label className={labelClass} htmlFor="new-scene-type">Scene type</label>
          <select id="new-scene-type" className={fieldClass} value={sceneType} onChange={(e) => setSceneType(e.target.value)}>
            {SCENE_TYPE_PRESETS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="new-scene-custom">Custom type</label>
          <input id="new-scene-custom" className={fieldClass} disabled={sceneType !== "Custom"} value={customType} onChange={(e) => setCustomType(e.target.value)} />
        </div>
        <Button type="submit" disabled={creating || !title.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add scene
        </Button>
      </form>

      {loading ? (
        <div role="status" className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-400" /> Loading scenes…
        </div>
      ) : scenes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-400">
          No scenes yet. Add one above, sync from your story, or use the AI scene breakdown.
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((scene) => (
              <li key={scene.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
                <Link href={`/studio/${projectId}/scenes/${scene.id}`} className="block">
                  <AssetImage
                    url={scene.thumbnail_url ?? scene.environment?.image_url}
                    alt={`Scene ${scene.scene_number} preview`}
                    placeholder="No background asset yet"
                    className="aspect-video w-full"
                  />
                </Link>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/studio/${projectId}/scenes/${scene.id}`} className="text-sm font-semibold text-white hover:text-violet-300">
                      {scene.scene_number}. {scene.title}
                    </Link>
                    <span className="shrink-0 text-xs text-zinc-500">{formatDuration(scene.duration_seconds)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-zinc-400">{scene.summary || scene.description || "No description."}</p>
                  <p className="text-[11px] text-zinc-500">
                    {scene.environment?.name ?? (scene.location_name || "No environment")} · {scene.character_assignments.length} character(s) · {scene.shots.length} shot(s)
                  </p>
                  {scene.missing_references.length > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> {scene.missing_references.length} missing reference(s)
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/studio/${projectId}/scenes/${scene.id}`}>Open</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void duplicate(scene.id)} disabled={busyId === scene.id} aria-label={`Duplicate ${scene.title}`}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmDeleteButton iconOnly label={`Delete ${scene.title}`} disabled={busyId === scene.id} onConfirm={() => void remove(scene.id)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
              <Button size="sm" variant="outline" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              Page {safePage} of {pageCount}
              <Button size="sm" variant="outline" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </SceneStudioFrame>
  );
}
