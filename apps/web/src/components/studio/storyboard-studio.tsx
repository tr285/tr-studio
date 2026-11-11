"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Pencil,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
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
import type { StoryboardCardRecord, StoryboardOverviewRecord } from "@tr-studio/shared-types";

const PAGE_SIZE = 12;

export function StoryboardStudio({ projectId }: { projectId: string }) {
  const [overview, setOverview] = useState<StoryboardOverviewRecord | null>(null);
  const [cards, setCards] = useState<StoryboardCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState("");
  const [charFilter, setCharFilter] = useState("");
  const [page, setPage] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", summary: "", duration_seconds: 30 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.sceneBuilder.getStoryboard(projectId);
      setOverview(data);
      setCards(data.cards);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load storyboard."));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtersActive = Boolean(search.trim() || envFilter || charFilter);
  const environmentNames = useMemo(
    () => Array.from(new Set(cards.map((c) => c.environment_name).filter((n): n is string => Boolean(n)))).sort(),
    [cards]
  );
  const characterNames = useMemo(
    () => Array.from(new Set(cards.flatMap((c) => c.main_characters))).sort(),
    [cards]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (!q || `${c.title} ${c.summary} ${c.description} ${c.location_name}`.toLowerCase().includes(q)) &&
        (!envFilter || c.environment_name === envFilter) &&
        (!charFilter || c.main_characters.includes(charFilter))
    );
  }, [cards, search, envFilter, charFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const persistOrder = async (next: StoryboardCardRecord[], message: string) => {
    const previous = cards;
    setCards(next.map((c, i) => ({ ...c, scene_number: i + 1 })));
    setAnnounce(message);
    try {
      await api.sceneBuilder.reorderScenes(projectId, next.map((c) => c.id));
      setError(null);
    } catch (err) {
      setCards(previous);
      setAnnounce("Reorder failed; previous order restored.");
      setError(errorMessage(err, "Failed to save scene order."));
    }
  };

  const moveTo = (id: string, targetIndex: number) => {
    const from = cards.findIndex((c) => c.id === id);
    if (from < 0 || targetIndex < 0 || targetIndex >= cards.length || from === targetIndex) return;
    const next = [...cards];
    const [item] = next.splice(from, 1);
    next.splice(targetIndex, 0, item);
    void persistOrder(next, `Scene “${item.title}” moved to position ${targetIndex + 1} of ${cards.length}.`);
  };

  const onDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      moveTo(dragId, cards.findIndex((c) => c.id === targetId));
    }
    setDragId(null);
    setOverId(null);
  };

  const duplicate = async (id: string) => {
    setBusy(true);
    try {
      await api.sceneBuilder.duplicateScene(id);
      await load();
      setAnnounce("Scene duplicated.");
    } catch (err) {
      setError(errorMessage(err, "Failed to duplicate scene."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.sceneBuilder.deleteScene(id);
      await load();
      setAnnounce("Scene deleted.");
    } catch (err) {
      setError(errorMessage(err, "Failed to delete scene."));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c: StoryboardCardRecord) => {
    setEditId(c.id);
    setEditDraft({ title: c.title, summary: c.summary, duration_seconds: c.duration_seconds });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !editDraft.title.trim()) return;
    setBusy(true);
    try {
      await api.sceneBuilder.updateScene(editId, {
        title: editDraft.title.trim(),
        summary: editDraft.summary,
        duration_seconds: Math.min(3600, Math.max(1, editDraft.duration_seconds)),
      });
      setEditId(null);
      await load();
      setAnnounce("Scene updated.");
    } catch (err) {
      setError(errorMessage(err, "Failed to save scene."));
    } finally {
      setBusy(false);
    }
  };

  const renderCard = (c: StoryboardCardRecord) => {
    const index = cards.findIndex((x) => x.id === c.id);
    const isList = view === "list";
    const draggable = !filtersActive && !busy;
    return (
      <li
        key={c.id}
        draggable={draggable}
        onDragStart={() => setDragId(c.id)}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onDragOver={(e) => {
          if (dragId) {
            e.preventDefault();
            setOverId(c.id);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(c.id);
        }}
        className={`overflow-hidden rounded-xl border bg-zinc-950/60 ${overId === c.id && dragId !== c.id ? "border-violet-400" : "border-zinc-800"} ${dragId === c.id ? "opacity-50" : ""} ${isList ? "flex flex-col sm:flex-row" : ""}`}
      >
        <Link href={`/studio/${projectId}/scenes/${c.id}`} className={isList ? "sm:w-56 sm:shrink-0" : "block"} tabIndex={-1} aria-hidden="true">
          <AssetImage
            url={c.thumbnail_url}
            alt={`Scene ${c.scene_number} background`}
            placeholder={c.has_actual_asset ? "Image unavailable" : "No background asset"}
            className="aspect-video w-full"
          />
        </Link>
        <div className="min-w-0 flex-1 space-y-2 p-3">
          <div className="flex items-start gap-2">
            {draggable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-zinc-600" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <Link href={`/studio/${projectId}/scenes/${c.id}`} className="block truncate text-sm font-semibold text-white hover:text-violet-300">
                <span className="mr-1.5 rounded bg-violet-600/30 px-1.5 py-0.5 text-[11px] text-violet-200">#{c.scene_number}</span>
                {c.title}
              </Link>
              <p className="text-[11px] text-zinc-500">
                {formatDuration(c.duration_seconds)} · {c.environment_name ?? (c.location_name || "No environment")} · {c.shot_count} shot(s)
              </p>
            </div>
          </div>
          <p className="line-clamp-2 text-xs text-zinc-400">{c.summary || c.description || "No description."}</p>
          <p className="text-[11px] text-zinc-300">
            {c.main_characters.length > 0 ? c.main_characters.join(", ") : <span className="text-zinc-500">No characters</span>}
          </p>
          {c.missing_references.length > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-amber-300">
              <AlertTriangle className="h-3 w-3" /> {c.missing_references.length} missing reference(s)
            </p>
          )}

          {editId === c.id ? (
            <form onSubmit={saveEdit} className="space-y-2 rounded-lg border border-zinc-800 p-2">
              <div>
                <label className={labelClass} htmlFor={`qe-title-${c.id}`}>Title</label>
                <input id={`qe-title-${c.id}`} className={fieldClass} value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} required />
              </div>
              <div>
                <label className={labelClass} htmlFor={`qe-sum-${c.id}`}>Summary</label>
                <textarea id={`qe-sum-${c.id}`} rows={2} className={fieldClass} value={editDraft.summary} onChange={(e) => setEditDraft((d) => ({ ...d, summary: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`qe-dur-${c.id}`}>Duration (seconds)</label>
                <input id={`qe-dur-${c.id}`} type="number" min={1} max={3600} className={fieldClass} value={editDraft.duration_seconds} onChange={(e) => setEditDraft((d) => ({ ...d, duration_seconds: Number(e.target.value) || 1 }))} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>Save</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => moveTo(c.id, index - 1)} disabled={busy || filtersActive || index <= 0} aria-label={`Move ${c.title} earlier`}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => moveTo(c.id, index + 1)} disabled={busy || filtersActive || index >= cards.length - 1} aria-label={`Move ${c.title} later`}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => startEdit(c)} aria-label={`Quick edit ${c.title}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => void duplicate(c.id)} disabled={busy} aria-label={`Duplicate ${c.title}`}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <ConfirmDeleteButton iconOnly label={`Delete ${c.title}`} disabled={busy} onConfirm={() => void remove(c.id)} />
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <SceneStudioFrame
      projectId={projectId}
      active="storyboard"
      title="Storyboard Studio"
      description="Visual overview of every saved scene. Drag cards or use the arrow buttons to reorder; changes save immediately."
    >
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {overview && (
        <p className="text-xs text-zinc-400">
          {overview.story_title} · {overview.total_scenes} scene(s) · {overview.total_shots} shot(s) · {formatDuration(overview.total_duration_seconds)}
        </p>
      )}

      <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <div>
          <label className={labelClass} htmlFor="sb-search">Search scenes</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <input id="sb-search" className={`${fieldClass} pl-8`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Title, summary, location…" />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="sb-env">Environment</label>
          <select id="sb-env" className={fieldClass} value={envFilter} onChange={(e) => { setEnvFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {environmentNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="sb-char">Character</label>
          <select id="sb-char" className={fieldClass} value={charFilter} onChange={(e) => { setCharFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {characterNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex gap-1" role="group" aria-label="View mode">
          <Button size="sm" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")} aria-pressed={view === "grid"}>
            <LayoutGrid className="h-3.5 w-3.5" /> Grid
          </Button>
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")} aria-pressed={view === "list"}>
            <ListIcon className="h-3.5 w-3.5" /> List
          </Button>
        </div>
      </div>
      {filtersActive && (
        <p className="text-[11px] text-zinc-500">Reordering is disabled while filters are active.</p>
      )}

      {loading ? (
        <div role="status" className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-400" /> Loading storyboard…
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-400">
          No scenes to show. Create or import scenes in the{" "}
          <Link className="text-violet-400 underline" href={`/studio/${projectId}/scenes`}>Scene Builder</Link>.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-400">
          No scenes match the current filters.
        </div>
      ) : (
        <>
          <ul className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
            {visible.map(renderCard)}
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
