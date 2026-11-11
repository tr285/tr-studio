"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

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
import {
  SCENE_ASSET_LAYER_TYPES,
  SCENE_TRANSITION_PRESETS,
  SCENE_TYPE_PRESETS,
} from "@tr-studio/scene-schema";
import type {
  CharacterRecord,
  CharacterSummaryRecord,
  EnvironmentRecord,
  EnvironmentSummaryRecord,
  SceneAssetAssignmentRecord,
  SceneBuilderUpdatePayload,
  SceneCharacterAssignmentRecord,
  SceneDetailRecord,
  StoryboardCardRecord,
  WorldRecord,
} from "@tr-studio/shared-types";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type LeftTab = "environment" | "characters" | "props";
type Selected = { kind: "char" | "asset"; id: string } | null;

const AUTOSAVE_MS = 800;

function SceneComposer({ projectId, sceneId }: { projectId: string; sceneId: string }) {
  const [scene, setScene] = useState<SceneDetailRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<StoryboardCardRecord[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentSummaryRecord[]>([]);
  const [characters, setCharacters] = useState<CharacterSummaryRecord[]>([]);
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [envDetail, setEnvDetail] = useState<EnvironmentRecord | null>(null);
  const [charDetails, setCharDetails] = useState<Record<string, CharacterRecord>>({});
  const [leftTab, setLeftTab] = useState<LeftTab>("environment");
  const [selected, setSelected] = useState<Selected>(null);
  const [showAI, setShowAI] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [draft, setDraft] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [propLayer, setPropLayer] = useState<string>("prop");

  // Autosave bookkeeping (refs avoid duplicate / racing requests)
  const pendingRef = useRef<SceneBuilderUpdatePayload>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const layerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const layerPending = useRef<Record<string, { kind: "char" | "asset"; patch: Record<string, number> }>>({});
  const outstanding = useRef(0);

  const syncDraft = useCallback((s: SceneDetailRecord) => {
    setDraft({
      title: s.title,
      scene_type: s.scene_type,
      summary: s.summary,
      description: s.description,
      action_description: s.action_description,
      location_name: s.location_name,
      time_of_day: s.time_of_day,
      weather: s.weather,
      mood: s.mood,
      duration_seconds: s.duration_seconds,
      camera_framing: s.camera_framing,
      transition_type: s.transition_type,
      production_notes: s.production_notes,
      visual_directions: s.visual_directions.join("\n"),
    });
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await api.sceneBuilder.getScene(sceneId);
    setScene(fresh);
    return fresh;
  }, [sceneId]);

  const loadCards = useCallback(async () => {
    try {
      setCards((await api.sceneBuilder.getStoryboard(projectId)).cards);
    } catch {
      /* non-critical navigation strip */
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.sceneBuilder.getScene(sceneId);
        if (cancelled) return;
        setScene(s);
        syncDraft(s);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load scene."));
      }
      const [envs, chars, wrlds] = await Promise.allSettled([
        api.environments.list({ project_id: projectId }),
        api.characters.list({ project_id: projectId }),
        api.worlds.list(projectId),
      ]);
      if (cancelled) return;
      if (envs.status === "fulfilled") setEnvironments(envs.value);
      if (chars.status === "fulfilled") setCharacters(chars.value);
      if (wrlds.status === "fulfilled") setWorlds(wrlds.value);
      void loadCards();
    })();
    return () => {
      cancelled = true;
    };
  }, [sceneId, projectId, syncDraft, loadCards]);

  // Load selected environment's assets for background/prop pickers
  const envId = scene?.environment_id ?? null;
  useEffect(() => {
    if (!envId) {
      setEnvDetail(null);
      return;
    }
    let cancelled = false;
    api.environments
      .get(envId)
      .then((e) => !cancelled && setEnvDetail(e))
      .catch(() => !cancelled && setEnvDetail(null));
    return () => {
      cancelled = true;
    };
  }, [envId]);

  // Lazy-load selected character options (expressions, poses, outfits)
  const selectedChar =
    selected?.kind === "char"
      ? scene?.character_assignments.find((c) => c.id === selected.id) ?? null
      : null;
  const selectedCharId = selectedChar?.character_id ?? null;
  useEffect(() => {
    if (!selectedCharId || charDetails[selectedCharId]) return;
    api.characters
      .get(selectedCharId)
      .then((c) => setCharDetails((prev) => ({ ...prev, [selectedCharId]: c })))
      .catch(() => undefined);
  }, [selectedCharId, charDetails]);

  const beginSave = () => {
    outstanding.current += 1;
    setStatus("saving");
  };
  const endSave = (ok: boolean) => {
    outstanding.current = Math.max(0, outstanding.current - 1);
    if (!ok) setStatus("error");
    else if (outstanding.current === 0 && Object.keys(pendingRef.current).length === 0) setStatus("saved");
  };

  const flush = useCallback(async () => {
    if (inFlightRef.current) return;
    const patch = pendingRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingRef.current = {};
    inFlightRef.current = true;
    beginSave();
    try {
      const updated = await api.sceneBuilder.updateScene(sceneId, patch);
      setScene((prev) => (prev ? { ...updated, character_assignments: prev.character_assignments, asset_assignments: prev.asset_assignments } : updated));
      setError(null);
      endSave(true);
    } catch (err) {
      // Keep unsaved work: merge failed patch beneath any newer edits.
      pendingRef.current = { ...patch, ...pendingRef.current };
      setError(errorMessage(err, "Autosave failed. Your changes are kept locally — retry."));
      endSave(false);
    } finally {
      inFlightRef.current = false;
      if (Object.keys(pendingRef.current).length > 0 && outstanding.current === 0) {
        // newer edits arrived during the request; schedule them (not on error loop)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), AUTOSAVE_MS);
      }
    }
  }, [sceneId]);

  const queuePatch = useCallback(
    (patch: SceneBuilderUpdatePayload) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setStatus("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush]
  );

  const retrySave = () => {
    setError(null);
    void flush();
  };

  const setField = (key: string, value: string | number) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "visual_directions") {
      queuePatch({
        visual_directions: String(value)
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      });
    } else {
      queuePatch({ [key]: value } as SceneBuilderUpdatePayload);
    }
  };

  // Warn before leaving with unsaved work; flush on unmount
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingRef.current).length > 0 || outstanding.current > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    },
    [flush]
  );

  // Layer (character / asset) position edits — optimistic + debounced per layer
  const updateLayer = (kind: "char" | "asset", id: string, patch: Record<string, number>) => {
    setScene((prev) =>
      prev
        ? {
            ...prev,
            character_assignments:
              kind === "char"
                ? prev.character_assignments.map((c) => (c.id === id ? { ...c, ...patch } : c))
                : prev.character_assignments,
            asset_assignments:
              kind === "asset"
                ? prev.asset_assignments.map((a) => (a.id === id ? { ...a, ...patch } : a))
                : prev.asset_assignments,
          }
        : prev
    );
    const key = `${kind}:${id}`;
    layerPending.current[key] = { kind, patch: { ...(layerPending.current[key]?.patch ?? {}), ...patch } };
    setStatus("saving");
    clearTimeout(layerTimers.current[key]);
    layerTimers.current[key] = setTimeout(async () => {
      const job = layerPending.current[key];
      delete layerPending.current[key];
      if (!job) return;
      beginSave();
      try {
        if (job.kind === "char") await api.sceneBuilder.updateCharacterAssignment(id, job.patch);
        else await api.sceneBuilder.updateAssetAssignment(id, job.patch);
        endSave(true);
      } catch (err) {
        setError(errorMessage(err, "Failed to save layer."));
        endSave(false);
      }
    }, 500);
  };

  const structural = async (fn: () => Promise<unknown>, okMessage?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      const fresh = await refresh();
      void loadCards();
      if (okMessage) setStatus("saved");
      return fresh;
    } catch (err) {
      setError(errorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  const moveLayer = async (kind: "char" | "asset", id: string, dir: -1 | 1) => {
    if (!scene) return;
    const list = kind === "char" ? scene.character_assignments : scene.asset_assignments;
    const ids = [...list].sort((a, b) => a.layer_order - b.layer_order).map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await structural(() =>
      kind === "char" ? api.sceneBuilder.reorderCharacters(scene.id, ids) : api.sceneBuilder.reorderAssets(scene.id, ids)
    );
  };

  const moveScene = async (dir: -1 | 1) => {
    const ids = cards.map((c) => c.id);
    const i = ids.indexOf(sceneId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await structural(() => api.sceneBuilder.reorderScenes(projectId, ids));
  };

  const duplicateScene = async () => {
    setBusy(true);
    try {
      const copy = await api.sceneBuilder.duplicateScene(sceneId);
      window.location.href = `/studio/${projectId}/scenes/${copy.id}`;
    } catch (err) {
      setError(errorMessage(err, "Failed to duplicate scene."));
      setBusy(false);
    }
  };

  const deleteScene = async () => {
    setBusy(true);
    try {
      pendingRef.current = {};
      await api.sceneBuilder.deleteScene(sceneId);
      window.location.href = `/studio/${projectId}/scenes`;
    } catch (err) {
      setError(errorMessage(err, "Failed to delete scene."));
      setBusy(false);
    }
  };

  const sortedChars = useMemo(
    () => [...(scene?.character_assignments ?? [])].sort((a, b) => a.layer_order - b.layer_order),
    [scene]
  );
  const sortedAssets = useMemo(
    () => [...(scene?.asset_assignments ?? [])].sort((a, b) => a.layer_order - b.layer_order),
    [scene]
  );

  if (loadError) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={loadError} />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/studio/${projectId}/scenes`}>
            <ArrowLeft className="h-4 w-4" /> Back to scenes
          </Link>
        </Button>
      </div>
    );
  }
  if (!scene) {
    return (
      <div role="status" className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-400" /> Loading scene…
      </div>
    );
  }

  const backgroundLayer = sortedAssets.find((a) => a.layer_type === "background" && a.image_url);
  const backgroundUrl = backgroundLayer?.image_url ?? scene.thumbnail_url ?? scene.environment?.image_url ?? null;
  const selectedAsset =
    selected?.kind === "asset" ? sortedAssets.find((a) => a.id === selected.id) ?? null : null;
  const cardIndex = cards.findIndex((c) => c.id === sceneId);

  const statusLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : status === "error" ? "Save failed" : "No changes";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/studio/${projectId}/scenes`}>
              <ArrowLeft className="h-3.5 w-3.5" /> All scenes
            </Link>
          </Button>
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              status === "error"
                ? "border-red-500/40 text-red-300"
                : status === "saving"
                  ? "border-amber-500/40 text-amber-300"
                  : "border-zinc-700 text-zinc-400"
            }`}
          >
            {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === "saved" && <Check className="h-3 w-3 text-emerald-400" />}
            {status === "error" && <AlertTriangle className="h-3 w-3" />}
            {statusLabel}
          </span>
          {status === "error" && (
            <Button size="sm" variant="outline" onClick={retrySave}>
              Retry save
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setShowAI((v) => !v)} aria-expanded={showAI}>
            <Sparkles className="h-3.5 w-3.5" /> AI Assist
          </Button>
          <Button size="sm" variant="outline" onClick={() => void duplicateScene()} disabled={busy}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
          <ConfirmDeleteButton label="Delete scene" disabled={busy} onConfirm={() => void deleteScene()} />
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {showAI && (
        <SceneAIPanel
          projectId={projectId}
          mode="scene-assist"
          sceneId={scene.id}
          onApplied={async () => {
            const fresh = await refresh();
            syncDraft(fresh);
            void loadCards();
          }}
          onClose={() => setShowAI(false)}
        />
      )}

      {scene.missing_references.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Missing references
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {scene.missing_references.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT: asset selection */}
        <aside aria-label="Scene assets" className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 lg:row-span-1">
          <div role="tablist" aria-label="Asset sources" className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {(["environment", "characters", "props"] as LeftTab[]).map((t) => (
              <button
                key={t}
                role="tab"
                id={`left-tab-${t}`}
                aria-selected={leftTab === t}
                aria-controls={`left-panel-${t}`}
                type="button"
                onClick={() => setLeftTab(t)}
                className={`flex-1 rounded px-2 py-1.5 text-xs capitalize ${leftTab === t ? "bg-violet-600 text-white" : "text-zinc-300 hover:bg-zinc-800"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {leftTab === "environment" && (
            <div role="tabpanel" id="left-panel-environment" aria-labelledby="left-tab-environment" className="space-y-3">
              <div>
                <label className={labelClass} htmlFor="scene-env">Primary environment</label>
                <select
                  id="scene-env"
                  className={fieldClass}
                  disabled={busy}
                  value={scene.environment_id ?? ""}
                  onChange={(e) =>
                    void structural(() =>
                      api.sceneBuilder.assignEnvironment(scene.id, e.target.value ? { environment_id: e.target.value } : { clear_environment: true })
                    )
                  }
                >
                  <option value="">— None —</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
                {environments.length === 0 && (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    No environments yet. <Link className="text-violet-400 underline" href={`/environments/new?projectId=${projectId}`}>Create one</Link>.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="scene-world-loc">World location</label>
                <select
                  id="scene-world-loc"
                  className={fieldClass}
                  disabled={busy}
                  value={scene.world_location_id ?? ""}
                  onChange={(e) =>
                    void structural(() =>
                      api.sceneBuilder.assignEnvironment(scene.id, e.target.value ? { world_location_id: e.target.value } : { clear_world_location: true })
                    )
                  }
                >
                  <option value="">— None —</option>
                  {worlds.map((w) => (
                    <optgroup key={w.id} label={w.name}>
                      {w.locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {envDetail && (
                <div>
                  <p className={labelClass}>Background assets</p>
                  {envDetail.assets.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">This environment has no generated or uploaded images.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {envDetail.assets.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void structural(() =>
                              api.sceneBuilder.assignEnvironment(scene.id, { environment_id: envDetail.id, background_asset_id: a.id })
                            )
                          }
                          className={`overflow-hidden rounded-lg border ${backgroundLayer?.environment_asset_id === a.id ? "border-violet-500" : "border-zinc-800"} hover:border-violet-400`}
                          aria-label={`Use ${a.asset_type} asset as background`}
                        >
                          <AssetImage url={a.url} alt={`${envDetail.name} ${a.asset_type}`} className="aspect-video w-full" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {leftTab === "characters" && (
            <div role="tabpanel" id="left-panel-characters" aria-labelledby="left-tab-characters" className="space-y-2">
              {characters.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  No characters yet. <Link className="text-violet-400 underline" href={`/characters/new?projectId=${projectId}`}>Create one</Link>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {characters.map((c) => {
                    const assigned = scene.character_assignments.some((a) => a.character_id === c.id);
                    return (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 p-2">
                        <AssetImage url={c.canonical_reference_url} alt={c.name} placeholder="No image" className="h-12 w-12 shrink-0 rounded" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">{c.name}</p>
                          <p className="truncate text-[11px] text-zinc-500">{c.role}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || assigned}
                          onClick={() => void structural(() => api.sceneBuilder.addCharacter(scene.id, { character_id: c.id }))}
                          aria-label={assigned ? `${c.name} already in scene` : `Add ${c.name} to scene`}
                        >
                          {assigned ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {leftTab === "props" && (
            <div role="tabpanel" id="left-panel-props" aria-labelledby="left-tab-props" className="space-y-2">
              <label className={labelClass} htmlFor="prop-layer">Add as layer type</label>
              <select id="prop-layer" className={fieldClass} value={propLayer} onChange={(e) => setPropLayer(e.target.value)}>
                {SCENE_ASSET_LAYER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {!envDetail || envDetail.assets.length === 0 ? (
                <p className="text-[11px] text-zinc-500">Select an environment with images to add its assets as layers.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {envDetail.assets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={busy}
                      className="overflow-hidden rounded-lg border border-zinc-800 hover:border-violet-400"
                      aria-label={`Add ${a.asset_type} asset as ${propLayer} layer`}
                      onClick={() =>
                        void structural(() =>
                          api.sceneBuilder.addAsset(scene.id, {
                            layer_type: propLayer as SceneAssetAssignmentRecord["layer_type"] as "prop",
                            label: `${envDetail.name} ${a.asset_type}`,
                            environment_asset_id: a.id,
                          })
                        )
                      }
                    >
                      <AssetImage url={a.url} alt={`${envDetail.name} ${a.asset_type}`} className="aspect-video w-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER: static composition canvas + layers */}
        <section aria-label="Scene composition preview" className="min-w-0 space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {backgroundUrl ? (
              <AssetImage url={backgroundUrl} alt="Scene background" className="absolute inset-0 h-full w-full" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                No background asset — choose an environment image on the left.
              </div>
            )}
            {sortedAssets
              .filter((a) => a.layer_type !== "background")
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected({ kind: "asset", id: a.id })}
                  aria-label={`Select layer ${a.label}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 ${selected?.id === a.id ? "ring-2 ring-violet-400" : ""}`}
                  style={{ left: `${a.position_x}%`, top: `${a.position_y}%`, width: `${a.scale_percent * 0.3}%`, zIndex: a.layer_type === "foreground" || a.layer_type === "overlay" ? 40 + a.layer_order : 10 + a.layer_order }}
                >
                  <AssetImage url={a.image_url} alt={a.label} placeholder={a.reference_status === "missing_reference" ? "Missing asset" : "No image"} className="aspect-square w-full rounded" />
                </button>
              ))}
            {sortedChars.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected({ kind: "char", id: c.id })}
                aria-label={`Select character ${c.character_name}`}
                className={`absolute -translate-x-1/2 -translate-y-full ${selected?.id === c.id ? "ring-2 ring-violet-400" : ""}`}
                style={{ left: `${c.position_x}%`, top: `${c.position_y}%`, height: `${c.scale_percent * 0.6}%`, zIndex: 20 + c.layer_order }}
              >
                {c.image_url ? (
                  <AssetImage url={c.image_url} alt={c.character_name} className="h-full w-auto rounded object-contain" />
                ) : (
                  <span className="flex h-full min-h-10 min-w-16 flex-col items-center justify-center rounded border border-dashed border-zinc-500 bg-zinc-950/70 px-2 text-[10px] text-zinc-300">
                    {c.character_name}
                    <span className="text-zinc-500">{c.reference_status === "missing_reference" ? "missing asset" : "no image"}</span>
                  </span>
                )}
              </button>
            ))}
            <span className="absolute bottom-1 right-2 z-50 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
              Static composition preview
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <LayerList
              title="Characters in scene"
              items={sortedChars.map((c) => ({ id: c.id, label: c.character_name, sub: c.reference_status, warn: c.reference_status !== "ok" }))}
              selectedId={selected?.kind === "char" ? selected.id : null}
              onSelect={(id) => setSelected({ kind: "char", id })}
              onMove={(id, d) => void moveLayer("char", id, d)}
              onRemove={(id) => {
                if (selected?.id === id) setSelected(null);
                void structural(() => api.sceneBuilder.deleteCharacterAssignment(id));
              }}
              empty="No characters assigned."
              disabled={busy}
            />
            <LayerList
              title="Visual layers"
              items={sortedAssets.map((a) => ({ id: a.id, label: a.label, sub: a.layer_type, warn: a.reference_status !== "ok" }))}
              selectedId={selected?.kind === "asset" ? selected.id : null}
              onSelect={(id) => setSelected({ kind: "asset", id })}
              onMove={(id, d) => void moveLayer("asset", id, d)}
              onRemove={(id) => {
                if (selected?.id === id) setSelected(null);
                void structural(() => api.sceneBuilder.deleteAssetAssignment(id));
              }}
              empty="No background / prop layers."
              disabled={busy}
            />
          </div>
        </section>

        {/* RIGHT: properties */}
        <aside aria-label="Scene properties" className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 lg:col-span-2 xl:col-span-1">
          {selectedChar && (
            <CharacterInspector
              assignment={selectedChar}
              detail={selectedChar.character_id ? charDetails[selectedChar.character_id] : undefined}
              disabled={busy}
              onLayer={(patch) => updateLayer("char", selectedChar.id, patch)}
              onChoice={(patch) => void structural(() => api.sceneBuilder.updateCharacterAssignment(selectedChar.id, patch))}
            />
          )}
          {selectedAsset && (
            <PositionControls
              title={`Layer: ${selectedAsset.label}`}
              x={selectedAsset.position_x}
              y={selectedAsset.position_y}
              scale={selectedAsset.scale_percent}
              onChange={(patch) => updateLayer("asset", selectedAsset.id, patch)}
            />
          )}

          <h2 className="text-sm font-semibold text-white">Scene properties</h2>
          <TextField label="Title" id="p-title" value={draft.title} onChange={(v) => setField("title", v)} />
          <div>
            <label className={labelClass} htmlFor="p-type">Scene type</label>
            <input id="p-type" list="scene-type-presets" className={fieldClass} value={String(draft.scene_type ?? "")} onChange={(e) => setField("scene_type", e.target.value)} />
            <datalist id="scene-type-presets">
              {SCENE_TYPE_PRESETS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <TextArea label="Summary" id="p-summary" rows={2} value={draft.summary} onChange={(v) => setField("summary", v)} />
          <TextArea label="Description" id="p-desc" rows={3} value={draft.description} onChange={(v) => setField("description", v)} />
          <TextArea label="Action description" id="p-action" rows={3} value={draft.action_description} onChange={(v) => setField("action_description", v)} />
          <TextField label="Location name" id="p-loc" value={draft.location_name} onChange={(v) => setField("location_name", v)} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Time of day" id="p-tod" value={draft.time_of_day} onChange={(v) => setField("time_of_day", v)} />
            <TextField label="Weather" id="p-weather" value={draft.weather} onChange={(v) => setField("weather", v)} />
            <TextField label="Mood" id="p-mood" value={draft.mood} onChange={(v) => setField("mood", v)} />
            <div>
              <label className={labelClass} htmlFor="p-dur">Duration (s)</label>
              <input id="p-dur" type="number" min={1} max={3600} className={fieldClass} value={draft.duration_seconds ?? 0}
                onChange={(e) => {
                  const n = Math.min(3600, Math.max(1, Number(e.target.value) || 1));
                  setField("duration_seconds", n);
                }} />
            </div>
          </div>
          <TextField label="Camera framing / perspective" id="p-cam" value={draft.camera_framing} onChange={(v) => setField("camera_framing", v)} />
          <div>
            <label className={labelClass} htmlFor="p-trans">Transition</label>
            <input id="p-trans" list="scene-transition-presets" className={fieldClass} value={String(draft.transition_type ?? "")} onChange={(e) => setField("transition_type", e.target.value)} />
            <datalist id="scene-transition-presets">
              {SCENE_TRANSITION_PRESETS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <TextArea label="Visual direction (one per line)" id="p-vis" rows={3} value={draft.visual_directions} onChange={(v) => setField("visual_directions", v)} />
          <TextArea label="Production notes" id="p-notes" rows={3} value={draft.production_notes} onChange={(v) => setField("production_notes", v)} />
          <p className="text-[11px] text-zinc-500">
            {scene.dialogue.length} dialogue line(s) · {scene.narration.length} narration line(s) — edit these in the{" "}
            <Link className="text-violet-400 underline" href={`/studio/${projectId}/screenplay`}>screenplay</Link>.
            Shots are managed in the <Link className="text-violet-400 underline" href={`/studio/${projectId}/shot-list`}>shot list</Link> ({scene.shots.length}).
          </p>
        </aside>
      </div>

      {/* BOTTOM: sequence navigation */}
      <nav aria-label="Scene sequence" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-300">
            Scene sequence {cardIndex >= 0 && `(${cardIndex + 1} of ${cards.length})`}
          </p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={busy || cardIndex <= 0} onClick={() => void moveScene(-1)} aria-label="Move scene earlier">
              <ChevronLeft className="h-3.5 w-3.5" /> Move earlier
            </Button>
            <Button size="sm" variant="outline" disabled={busy || cardIndex < 0 || cardIndex >= cards.length - 1} onClick={() => void moveScene(1)} aria-label="Move scene later">
              Move later <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {cards.map((c) => (
            <li key={c.id} className="w-36 shrink-0">
              <Link
                href={`/studio/${projectId}/scenes/${c.id}`}
                aria-current={c.id === sceneId ? "page" : undefined}
                className={`block overflow-hidden rounded-lg border ${c.id === sceneId ? "border-violet-500" : "border-zinc-800 hover:border-zinc-600"}`}
              >
                <AssetImage url={c.thumbnail_url} alt={`Scene ${c.scene_number}`} placeholder="No asset" className="aspect-video w-full" />
                <span className="block truncate px-2 py-1 text-[11px] text-zinc-300">
                  {c.scene_number}. {c.title}
                </span>
                <span className="block px-2 pb-1 text-[10px] text-zinc-500">{formatDuration(c.duration_seconds)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function TextField({ label, id, value, onChange }: { label: string; id: string; value: string | number | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      <input id={id} className={fieldClass} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextArea({ label, id, rows, value, onChange }: { label: string; id: string; rows: number; value: string | number | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} className={fieldClass} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LayerList({
  title,
  items,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  empty,
  disabled,
}: {
  title: string;
  items: { id: string; label: string; sub: string; warn: boolean }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  empty: string;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <h3 className="mb-2 text-xs font-semibold text-zinc-300">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-zinc-500">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={it.id} className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${selectedId === it.id ? "border-violet-500" : "border-zinc-800"}`}>
              <button type="button" onClick={() => onSelect(it.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs text-white">{it.label}</span>
                <span className={`block truncate text-[10px] ${it.warn ? "text-amber-300" : "text-zinc-500"}`}>{it.sub.replace(/_/g, " ")}</span>
              </button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled || i === 0} onClick={() => onMove(it.id, -1)} aria-label={`Move ${it.label} back`}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled || i === items.length - 1} onClick={() => onMove(it.id, 1)} aria-label={`Move ${it.label} forward`}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onRemove(it.id)} aria-label={`Remove ${it.label}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PositionControls({
  title,
  x,
  y,
  scale,
  onChange,
}: {
  title: string;
  x: number;
  y: number;
  scale: number;
  onChange: (patch: Record<string, number>) => void;
}) {
  const row = (label: string, key: string, value: number, min: number, max: number) => (
    <div>
      <label className={labelClass} htmlFor={`pos-${key}`}>
        {label}: {Math.round(value)}
      </label>
      <input id={`pos-${key}`} type="range" min={min} max={max} value={value} className="w-full accent-violet-500"
        onChange={(e) => onChange({ [key]: Number(e.target.value) })} />
    </div>
  );
  return (
    <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-950/10 p-3">
      <h3 className="text-xs font-semibold text-violet-200">{title}</h3>
      {row("Horizontal %", "position_x", x, 0, 100)}
      {row("Vertical %", "position_y", y, 0, 100)}
      {row("Scale %", "scale_percent", scale, 10, 300)}
    </div>
  );
}

function CharacterInspector({
  assignment,
  detail,
  disabled,
  onLayer,
  onChoice,
}: {
  assignment: SceneCharacterAssignmentRecord;
  detail?: CharacterRecord;
  disabled: boolean;
  onLayer: (patch: Record<string, number>) => void;
  onChoice: (patch: { expression_id?: string | null; clear_expression?: boolean; pose_id?: string | null; clear_pose?: boolean; outfit_id?: string | null; clear_outfit?: boolean }) => void;
}) {
  return (
    <div className="space-y-2">
      <PositionControls
        title={`Character: ${assignment.character_name}`}
        x={assignment.position_x}
        y={assignment.position_y}
        scale={assignment.scale_percent}
        onChange={onLayer}
      />
      {detail ? (
        <div className="grid gap-2">
          <ChoiceSelect label="Expression" id="c-expr" value={assignment.expression_id} options={detail.expressions} disabled={disabled}
            onChange={(v) => onChoice(v ? { expression_id: v } : { clear_expression: true })} />
          <ChoiceSelect label="Pose" id="c-pose" value={assignment.pose_id} options={detail.poses} disabled={disabled}
            onChange={(v) => onChoice(v ? { pose_id: v } : { clear_pose: true })} />
          <ChoiceSelect label="Outfit" id="c-outfit" value={assignment.outfit_id} options={detail.outfits} disabled={disabled}
            onChange={(v) => onChoice(v ? { outfit_id: v } : { clear_outfit: true })} />
        </div>
      ) : assignment.character_id ? (
        <p className="text-[11px] text-zinc-500">Loading character options…</p>
      ) : (
        <p className="text-[11px] text-amber-300">
          This story character is not linked to a Character Studio record, so expressions, poses and outfits are unavailable.
        </p>
      )}
    </div>
  );
}

function ChoiceSelect({
  label,
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  id: string;
  value?: string | null;
  options: { id: string; name: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      <select id={id} className={fieldClass} disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Default —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

export function SceneComposerPage({ projectId, sceneId }: { projectId: string; sceneId: string }) {
  return (
    <SceneStudioFrame
      projectId={projectId}
      active="scenes"
      title="Scene Composition"
      description="Static visual composition of a scene. Animation, rigging and playback arrive in later milestones."
    >
      <SceneComposer projectId={projectId} sceneId={sceneId} />
    </SceneStudioFrame>
  );
}
