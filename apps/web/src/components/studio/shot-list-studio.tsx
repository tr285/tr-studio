"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { SceneAIPanel } from "@/components/studio/scene-ai-panel";
import {
  ConfirmDeleteButton,
  ErrorBanner,
  SceneStudioFrame,
  errorMessage,
  fieldClass,
  formatDuration,
  labelClass,
} from "@/components/studio/scene-studio-common";
import { SHOT_TYPE_PRESETS } from "@tr-studio/scene-schema";
import type {
  EnvironmentSummaryRecord,
  SceneDetailRecord,
  SceneShotRecord,
} from "@tr-studio/shared-types";

interface ShotDraft {
  title: string;
  description: string;
  shot_type: string;
  camera_perspective: string;
  character_focus: string[];
  environment_id: string;
  visual_direction: string;
  duration_seconds: number;
  production_notes: string;
}

const EMPTY_DRAFT: ShotDraft = {
  title: "",
  description: "",
  shot_type: "medium",
  camera_perspective: "Eye level",
  character_focus: [],
  environment_id: "",
  visual_direction: "",
  duration_seconds: 5,
  production_notes: "",
};

function toDraft(s: SceneShotRecord): ShotDraft {
  return {
    title: s.title,
    description: s.description ?? "",
    shot_type: s.shot_type,
    camera_perspective: s.camera_perspective,
    character_focus: s.character_focus,
    environment_id: s.environment_id ?? "",
    visual_direction: s.visual_direction ?? "",
    duration_seconds: s.duration_seconds,
    production_notes: s.production_notes ?? "",
  };
}

function ShotForm({
  idPrefix,
  draft,
  setDraft,
  scene,
  environments,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
}: {
  idPrefix: string;
  draft: ShotDraft;
  setDraft: React.Dispatch<React.SetStateAction<ShotDraft>>;
  scene: SceneDetailRecord;
  environments: EnvironmentSummaryRecord[];
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  busy: boolean;
}) {
  const names = Array.from(new Set([...scene.character_assignments.map((c) => c.character_name), ...draft.character_focus]));
  const set = <K extends keyof ShotDraft>(k: K, v: ShotDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-3 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <label className={labelClass} htmlFor={`${idPrefix}-title`}>Shot title</label>
        <input id={`${idPrefix}-title`} required className={fieldClass} value={draft.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass} htmlFor={`${idPrefix}-desc`}>Description</label>
        <textarea id={`${idPrefix}-desc`} rows={2} className={fieldClass} value={draft.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-type`}>Shot type</label>
        <select id={`${idPrefix}-type`} className={fieldClass} value={draft.shot_type} onChange={(e) => set("shot_type", e.target.value)}>
          {SHOT_TYPE_PRESETS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-cam`}>Camera perspective</label>
        <input id={`${idPrefix}-cam`} className={fieldClass} value={draft.camera_perspective} onChange={(e) => set("camera_perspective", e.target.value)} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-env`}>Environment reference</label>
        <select id={`${idPrefix}-env`} className={fieldClass} value={draft.environment_id} onChange={(e) => set("environment_id", e.target.value)}>
          <option value="">— Scene default —</option>
          {environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-dur`}>Estimated duration (s)</label>
        <input id={`${idPrefix}-dur`} type="number" min={1} max={600} className={fieldClass} value={draft.duration_seconds} onChange={(e) => set("duration_seconds", Math.min(600, Math.max(1, Number(e.target.value) || 1)))} />
      </div>
      <fieldset className="md:col-span-2">
        <legend className={labelClass}>Character focus</legend>
        {names.length === 0 ? (
          <p className="text-[11px] text-zinc-500">Assign characters to the scene to choose focus.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {names.map((n) => (
              <label key={n} className="flex items-center gap-1.5 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={draft.character_focus.includes(n)}
                  onChange={(e) =>
                    set("character_focus", e.target.checked ? [...draft.character_focus, n] : draft.character_focus.filter((x) => x !== n))
                  }
                />
                {n}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="md:col-span-2">
        <label className={labelClass} htmlFor={`${idPrefix}-vis`}>Visual direction</label>
        <textarea id={`${idPrefix}-vis`} rows={2} className={fieldClass} value={draft.visual_direction} onChange={(e) => set("visual_direction", e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass} htmlFor={`${idPrefix}-notes`}>Production notes</label>
        <textarea id={`${idPrefix}-notes`} rows={2} className={fieldClass} value={draft.production_notes} onChange={(e) => set("production_notes", e.target.value)} />
      </div>
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={busy || !draft.title.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </form>
  );
}

export function ShotListStudio({ projectId }: { projectId: string }) {
  const [scenes, setScenes] = useState<SceneDetailRecord[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentSummaryRecord[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ShotDraft>(EMPTY_DRAFT);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ShotDraft>(EMPTY_DRAFT);
  const [showAI, setShowAI] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, envs] = await Promise.all([
        api.sceneBuilder.listProjectScenes(projectId),
        api.environments.list({ project_id: projectId }).catch(() => [] as EnvironmentSummaryRecord[]),
      ]);
      setScenes(list);
      setEnvironments(envs);
      setSceneId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? ""));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load shot list."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scene = useMemo(() => scenes.find((s) => s.id === sceneId) ?? null, [scenes, sceneId]);
  const shots = useMemo(
    () => [...(scene?.shots ?? [])].sort((a, b) => a.shot_number - b.shot_number),
    [scene]
  );
  const totalSeconds = shots.reduce((n, s) => n + s.duration_seconds, 0);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (err) {
      setError(errorMessage(err, "Action failed."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const payload = (d: ShotDraft) => ({
    title: d.title.trim(),
    description: d.description,
    shot_type: d.shot_type,
    camera_perspective: d.camera_perspective,
    character_focus: d.character_focus,
    visual_direction: d.visual_direction,
    duration_seconds: d.duration_seconds,
    production_notes: d.production_notes,
  });

  const addShot = async () => {
    if (!scene) return;
    const ok = await run(() =>
      api.sceneBuilder.createShot(scene.id, { ...payload(draft), environment_id: draft.environment_id || null })
    );
    if (ok) setDraft(EMPTY_DRAFT);
  };

  const saveShot = async () => {
    if (!editId) return;
    const ok = await run(() =>
      api.sceneBuilder.updateShot(editId, {
        ...payload(editDraft),
        ...(editDraft.environment_id ? { environment_id: editDraft.environment_id } : { clear_environment: true }),
      })
    );
    if (ok) setEditId(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    if (!scene) return;
    const ids = shots.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run(() => api.sceneBuilder.reorderShots(scene.id, ids));
  };

  return (
    <SceneStudioFrame
      projectId={projectId}
      active="shot-list"
      title="Shot List"
      description="Plan individual shots inside each scene. These are production-planning records, not animated camera moves."
      actions={
        <Button size="sm" onClick={() => setShowAI((v) => !v)} disabled={!scene} aria-expanded={showAI}>
          <Sparkles className="h-3.5 w-3.5" /> AI Shot List
        </Button>
      }
    >
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div role="status" className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-400" /> Loading shot list…
        </div>
      ) : scenes.length === 0 || !scene ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-400">
          Create scenes in the Scene Builder before planning shots.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <label className={labelClass} htmlFor="shot-scene">Scene</label>
              <select id="shot-scene" className={fieldClass} value={sceneId} onChange={(e) => { setSceneId(e.target.value); setEditId(null); setShowAI(false); }}>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>{s.scene_number}. {s.title} ({s.shots.length} shots)</option>
                ))}
              </select>
            </div>
            <p className="pb-2 text-xs text-zinc-400">{shots.length} shot(s) · {formatDuration(totalSeconds)} planned · scene length {formatDuration(scene.duration_seconds)}</p>
          </div>

          {showAI && (
            <SceneAIPanel projectId={projectId} mode="shots" sceneId={scene.id} onApplied={load} onClose={() => setShowAI(false)} />
          )}

          {shots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">
              No shots planned for this scene yet.
            </div>
          ) : (
            <ol className="space-y-3">
              {shots.map((s, i) => (
                <li key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  {editId === s.id ? (
                    <ShotForm idPrefix={`edit-${s.id}`} draft={editDraft} setDraft={setEditDraft} scene={scene} environments={environments} onSubmit={() => void saveShot()} onCancel={() => setEditId(null)} submitLabel="Save shot" busy={busy} />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-white">
                          <span className="mr-2 rounded bg-violet-600/30 px-1.5 py-0.5 text-[11px] text-violet-200">Shot {s.shot_number}</span>
                          {s.title}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {s.shot_type} · {s.camera_perspective} · {s.duration_seconds}s
                          {s.environment_name && ` · ${s.environment_name}`}
                          {s.character_focus.length > 0 && ` · Focus: ${s.character_focus.join(", ")}`}
                        </p>
                        {s.description && <p className="text-xs text-zinc-300">{s.description}</p>}
                        {s.visual_direction && <p className="text-xs text-zinc-400">Visual: {s.visual_direction}</p>}
                        {s.production_notes && <p className="text-xs text-zinc-500">Notes: {s.production_notes}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="outline" disabled={busy || i === 0} onClick={() => move(s.id, -1)} aria-label={`Move shot ${s.shot_number} up`}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy || i === shots.length - 1} onClick={() => move(s.id, 1)} aria-label={`Move shot ${s.shot_number} down`}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditId(s.id); setEditDraft(toDraft(s)); }} aria-label={`Edit shot ${s.shot_number}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ConfirmDeleteButton iconOnly label={`Delete shot ${s.shot_number}`} disabled={busy} onConfirm={() => void run(() => api.sceneBuilder.deleteShot(s.id))} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          <section aria-label="Add shot" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Add shot</h2>
            <ShotForm idPrefix="new-shot" draft={draft} setDraft={setDraft} scene={scene} environments={environments} onSubmit={() => void addShot()} submitLabel="Add shot" busy={busy} />
          </section>
        </>
      )}
    </SceneStudioFrame>
  );
}
