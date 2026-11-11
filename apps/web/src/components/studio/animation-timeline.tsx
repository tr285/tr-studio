"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Scissors,
  Copy,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Folder,
  FolderOpen,
  Flag,
  Magnet,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  Clock,
  Palette,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  AnimationDocument,
  InterpolationMode,
  Keyframe,
  TimelineClip,
  TimelineMarker,
  Track,
  TrackGroup,
  TrackType,
  SnapTarget,
} from "@tr-studio/animation-engine";
import {
  INTERPOLATION_MODES,
  msToFrame,
  collectSnapTargets,
  findSnapTarget,
} from "@tr-studio/animation-engine";

export interface SelectedKeyframeRef {
  trackId: string;
  keyframeId: string;
}

export interface AnimationTimelineProps {
  doc: AnimationDocument;
  currentTimeMs: number;
  selectedKeyframes?: SelectedKeyframeRef[];
  selectedKeyframe?: SelectedKeyframeRef | null;
  selectedClipId?: string | null;
  onSeek: (ms: number) => void;
  onSelectKeyframes?: (refs: SelectedKeyframeRef[]) => void;
  onSelectKeyframe?: (ref: SelectedKeyframeRef | null) => void;
  onSelectClip?: (clipId: string | null) => void;
  onAddKeyframeAtPlayhead: (trackId: string) => void;
  onUpdateKeyframe: (trackId: string, kfId: string, patch: Partial<Keyframe>) => void;
  onDeleteKeyframes?: (refs: SelectedKeyframeRef[]) => void;
  onDeleteKeyframe?: (trackId: string, kfId: string) => void;
  onMoveKeyframes?: (refs: SelectedKeyframeRef[], deltaMs: number) => void;
  // Track operations
  onToggleTrack: (trackId: string) => void;
  onLockTrack?: (trackId: string, locked: boolean) => void;
  onMuteTrack?: (trackId: string, muted: boolean) => void;
  onSetTrackColor?: (trackId: string, color: string | null) => void;
  onDeleteTrack: (trackId: string) => void;
  onReorderTracks?: (orderedTrackIds: string[]) => void;
  // Clip operations
  onAddClip?: (trackId: string, name: string, startMs: number, durationMs: number) => void;
  onMoveClip?: (clipId: string, newStartMs: number) => void;
  onTrimClip?: (clipId: string, newStartMs: number, newDurationMs: number, newSourceStartMs?: number) => void;
  onSplitClip?: (clipId: string, atMs: number) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  // Marker operations
  onAddMarker?: (name: string, timeMs: number, color?: string) => void;
  onUpdateMarker?: (markerId: string, patch: Partial<TimelineMarker>) => void;
  onDeleteMarker?: (markerId: string) => void;
  // Group operations
  onCreateGroup?: (name: string, trackIds?: string[]) => void;
  onToggleGroupCollapse?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

const TRACK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  character: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  prop: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  background: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30" },
  camera: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  property: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30" },
  group: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/30" },
};

function formatTimecode(ms: number, fps: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frame = msToFrame(ms % 1000, fps);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frame).padStart(2, "0")}`;
}

export function AnimationTimeline({
  doc,
  currentTimeMs,
  selectedKeyframes: selectedKfsProp,
  selectedKeyframe: selectedKfSingleProp,
  selectedClipId: selectedClipIdProp,
  onSeek,
  onSelectKeyframes,
  onSelectKeyframe,
  onSelectClip,
  onAddKeyframeAtPlayhead,
  onUpdateKeyframe,
  onDeleteKeyframes,
  onDeleteKeyframe,
  onMoveKeyframes,
  onToggleTrack,
  onLockTrack,
  onMuteTrack,
  onSetTrackColor,
  onDeleteTrack,
  onReorderTracks,
  onAddClip,
  onMoveClip,
  onTrimClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker,
  onCreateGroup,
  onToggleGroupCollapse,
  onDeleteGroup,
}: AnimationTimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // Normalise selection
  const selectedKeyframes: SelectedKeyframeRef[] = useMemo(() => {
    if (selectedKfsProp) return selectedKfsProp;
    if (selectedKfSingleProp) return [selectedKfSingleProp];
    return [];
  }, [selectedKfsProp, selectedKfSingleProp]);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(selectedClipIdProp ?? null);

  useEffect(() => {
    if (selectedClipIdProp !== undefined) setSelectedClipId(selectedClipIdProp);
  }, [selectedClipIdProp]);

  // Zoom & Snapping State
  const [zoom, setZoom] = useState<number>(1); // 1 = 100% fits container, up to 5x
  const [snappingEnabled, setSnappingEnabled] = useState<boolean>(true);
  const [snapIndicator, setSnapIndicator] = useState<{ timeMs: number; label: string } | null>(null);

  // Modals & Popovers
  const [showMarkerDialog, setShowMarkerDialog] = useState(false);
  const [markerNameInput, setMarkerNameInput] = useState("");
  const [markerColorInput, setMarkerColorInput] = useState("#6366f1");

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");

  const [showAddClipDialog, setShowAddClipDialog] = useState(false);
  const [clipTrackSelect, setClipTrackSelect] = useState("");
  const [clipNameInput, setClipNameInput] = useState("Animation Clip");
  const [clipDurationInput, setClipDurationInput] = useState(1500);

  // Dragging states
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [draggingKeyframeGroup, setDraggingKeyframeGroup] = useState<{
    initialTimeMs: number;
    initialMouseX: number;
    origKeyframes: { trackId: string; keyframeId: string; origMs: number }[];
  } | null>(null);
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    mode: "move" | "trim-start" | "trim-end";
    initialMouseX: number;
    origStartMs: number;
    origDurationMs: number;
    origSourceStartMs: number;
  } | null>(null);

  const durationMs = doc.duration_ms || 5000;
  const fps = doc.fps || 24;

  // Zoomed width
  const contentWidthPercent = zoom * 100;
  const playheadPercent = Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100));

  // Time ruler ticks calculation based on zoom
  const stepMs = zoom >= 3 ? 250 : zoom >= 1.5 ? 500 : 1000;
  const tickCount = Math.floor(durationMs / stepMs);
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const ms = i * stepMs;
      if (ms <= durationMs) ticks.push(ms);
    }
    return ticks;
  }, [durationMs, stepMs, tickCount]);

  // Candidate snap targets collection
  const snapTargets = useMemo(() => {
    if (!snappingEnabled) return [];
    return collectSnapTargets(doc, {
      fps,
      playheadMs: currentTimeMs,
      includeKeyframes: true,
      includeClips: true,
      includeMarkers: true,
      excludeKeyframeRefs: selectedKeyframes,
    });
  }, [doc, fps, currentTimeMs, snappingEnabled, selectedKeyframes]);

  // Pointer to ms conversion taking zoom and container scroll into account
  const calculateMsFromPointer = useCallback(
    (clientX: number, rulerElement: HTMLElement) => {
      const rect = rulerElement.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      let rawMs = Math.round(ratio * durationMs);

      if (snappingEnabled && snapTargets.length > 0) {
        const thresholdMs = Math.max(20, Math.round(50 / zoom));
        const snapped = findSnapTarget(rawMs, snapTargets, thresholdMs);
        if (snapped.snappedTarget) {
          setSnapIndicator({ timeMs: snapped.snappedTimeMs, label: snapped.snappedTarget.label || "Snap" });
          return snapped.snappedTimeMs;
        }
      }
      setSnapIndicator(null);
      // Fallback: snap to frame boundary
      const frame = msToFrame(rawMs, fps);
      return Math.round((frame * 1000) / fps);
    },
    [durationMs, fps, snappingEnabled, snapTargets, zoom]
  );

  // Ruler scrub handlers
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (!rulerRef.current) return;
    const ms = calculateMsFromPointer(e.clientX, rulerRef.current);
    onSeek(ms);
    setDraggingPlayhead(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (!draggingPlayhead || !rulerRef.current) return;
    const ms = calculateMsFromPointer(e.clientX, rulerRef.current);
    onSeek(ms);
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    if (draggingPlayhead) {
      setDraggingPlayhead(false);
      setSnapIndicator(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Primary active keyframe for header quick inspector
  const primaryActiveKf = useMemo(() => {
    if (selectedKeyframes.length === 0) return null;
    const first = selectedKeyframes[0];
    const tr = doc.tracks.find((t) => t.id === first.trackId);
    const kf = tr?.keyframes.find((k) => k.id === first.keyframeId);
    return tr && kf ? { track: tr, keyframe: kf } : null;
  }, [selectedKeyframes, doc.tracks]);

  // Selected clip data
  const activeClip = useMemo(() => {
    if (!selectedClipId || !doc.clips) return null;
    return doc.clips.find((c) => c.id === selectedClipId) || null;
  }, [selectedClipId, doc.clips]);

  // Select keyframe helper (supports single or multi)
  const handleKeyframeClick = (e: React.MouseEvent, trackId: string, kfId: string, kfMs: number) => {
    e.stopPropagation();
    onSeek(kfMs);
    setSelectedClipId(null);
    onSelectClip?.(null);

    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const exists = selectedKeyframes.some((r) => r.trackId === trackId && r.keyframeId === kfId);
      const next = exists
        ? selectedKeyframes.filter((r) => !(r.trackId === trackId && r.keyframeId === kfId))
        : [...selectedKeyframes, { trackId, keyframeId: kfId }];
      onSelectKeyframes?.(next);
      if (next.length === 1) onSelectKeyframe?.(next[0]);
      else if (next.length === 0) onSelectKeyframe?.(null);
    } else {
      const next = [{ trackId, keyframeId: kfId }];
      onSelectKeyframes?.(next);
      onSelectKeyframe?.({ trackId, keyframeId: kfId });
    }
  };

  // Group keyframe drag start
  const handleKeyframePointerDown = (
    e: React.PointerEvent,
    trackId: string,
    keyframeId: string,
    kfMs: number
  ) => {
    e.stopPropagation();
    const isSelected = selectedKeyframes.some((r) => r.trackId === trackId && r.keyframeId === keyframeId);
    const activeRefs = isSelected ? selectedKeyframes : [{ trackId, keyframeId }];
    if (!isSelected) {
      onSelectKeyframes?.(activeRefs);
      onSelectKeyframe?.({ trackId, keyframeId });
    }

    const origKeyframes: { trackId: string; keyframeId: string; origMs: number }[] = [];
    for (const ref of activeRefs) {
      const t = doc.tracks.find((x) => x.id === ref.trackId);
      const k = t?.keyframes.find((x) => x.id === ref.keyframeId);
      if (t && k) origKeyframes.push({ trackId: ref.trackId, keyframeId: ref.keyframeId, origMs: k.time_ms });
    }

    setDraggingKeyframeGroup({
      initialTimeMs: kfMs,
      initialMouseX: e.clientX,
      origKeyframes,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleKeyframePointerMove = (e: React.PointerEvent) => {
    if (!draggingKeyframeGroup || !rulerRef.current) return;
    const rulerRect = rulerRef.current.getBoundingClientRect();
    const pixelWidth = rulerRect.width;
    const deltaPx = e.clientX - draggingKeyframeGroup.initialMouseX;
    const deltaMsRaw = Math.round((deltaPx / pixelWidth) * durationMs);

    let targetTime = draggingKeyframeGroup.initialTimeMs + deltaMsRaw;

    if (snappingEnabled && snapTargets.length > 0) {
      const thresholdMs = Math.max(20, Math.round(50 / zoom));
      const snapped = findSnapTarget(targetTime, snapTargets, thresholdMs);
      if (snapped.snappedTarget) {
        targetTime = snapped.snappedTimeMs;
        setSnapIndicator({ timeMs: snapped.snappedTimeMs, label: snapped.snappedTarget.label || "Snap" });
      } else {
        setSnapIndicator(null);
      }
    }

    const effectiveDelta = targetTime - draggingKeyframeGroup.initialTimeMs;
    // Apply temporary drag update via onMoveKeyframes or individual updates
    if (onMoveKeyframes) {
      onMoveKeyframes(
        draggingKeyframeGroup.origKeyframes.map((k) => ({ trackId: k.trackId, keyframeId: k.keyframeId })),
        effectiveDelta
      );
    }
  };

  const handleKeyframePointerUp = (e: React.PointerEvent) => {
    if (draggingKeyframeGroup) {
      setDraggingKeyframeGroup(null);
      setSnapIndicator(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Clip drag start (move or trim)
  const handleClipPointerDown = (
    e: React.PointerEvent,
    clip: TimelineClip,
    mode: "move" | "trim-start" | "trim-end"
  ) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    onSelectClip?.(clip.id);
    onSelectKeyframes?.([]);
    onSelectKeyframe?.(null);

    setDraggingClip({
      clipId: clip.id,
      mode,
      initialMouseX: e.clientX,
      origStartMs: clip.start_ms,
      origDurationMs: clip.duration_ms,
      origSourceStartMs: clip.source_start_ms,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleClipPointerMove = (e: React.PointerEvent) => {
    if (!draggingClip || !rulerRef.current) return;
    const rulerRect = rulerRef.current.getBoundingClientRect();
    const pixelWidth = rulerRect.width;
    const deltaPx = e.clientX - draggingClip.initialMouseX;
    const deltaMs = Math.round((deltaPx / pixelWidth) * durationMs);

    if (draggingClip.mode === "move") {
      let nextStart = Math.max(0, Math.min(durationMs - draggingClip.origDurationMs, draggingClip.origStartMs + deltaMs));
      if (snappingEnabled && snapTargets.length > 0) {
        const thresholdMs = Math.max(20, Math.round(50 / zoom));
        const snapped = findSnapTarget(nextStart, snapTargets, thresholdMs);
        if (snapped.snappedTarget) {
          nextStart = snapped.snappedTimeMs;
          setSnapIndicator({ timeMs: snapped.snappedTimeMs, label: snapped.snappedTarget.label || "Snap" });
        } else {
          setSnapIndicator(null);
        }
      }
      onMoveClip?.(draggingClip.clipId, nextStart);
    } else if (draggingClip.mode === "trim-start") {
      let nextStart = Math.max(0, Math.min(draggingClip.origStartMs + draggingClip.origDurationMs - 100, draggingClip.origStartMs + deltaMs));
      const deltaStart = nextStart - draggingClip.origStartMs;
      const nextDuration = draggingClip.origDurationMs - deltaStart;
      const nextSourceStart = Math.max(0, draggingClip.origSourceStartMs + deltaStart);
      onTrimClip?.(draggingClip.clipId, nextStart, nextDuration, nextSourceStart);
    } else if (draggingClip.mode === "trim-end") {
      let nextDuration = Math.max(100, Math.min(durationMs - draggingClip.origStartMs, draggingClip.origDurationMs + deltaMs));
      onTrimClip?.(draggingClip.clipId, draggingClip.origStartMs, nextDuration, draggingClip.origSourceStartMs);
    }
  };

  const handleClipPointerUp = (e: React.PointerEvent) => {
    if (draggingClip) {
      setDraggingClip(null);
      setSnapIndicator(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Delete selection handler (either selected keyframes or selected clip)
  const handleDeleteSelection = () => {
    if (selectedKeyframes.length > 0) {
      if (onDeleteKeyframes) {
        onDeleteKeyframes(selectedKeyframes);
      } else if (onDeleteKeyframe) {
        selectedKeyframes.forEach((r) => onDeleteKeyframe(r.trackId, r.keyframeId));
      }
      onSelectKeyframes?.([]);
      onSelectKeyframe?.(null);
    } else if (selectedClipId && onDeleteClip) {
      onDeleteClip(selectedClipId);
      setSelectedClipId(null);
      onSelectClip?.(null);
    }
  };

  // Group tracks by group membership
  const groupedTracks = useMemo(() => {
    const groups = doc.groups || [];
    const groupedIds = new Set(groups.flatMap((g) => g.track_ids));
    const standaloneTracks = doc.tracks.filter((t) => !groupedIds.has(t.id));
    return { groups, standaloneTracks };
  }, [doc.groups, doc.tracks]);

  return (
    <div className="flex flex-col h-full bg-[#09090d] border-t border-zinc-800 text-xs text-zinc-300 select-none">
      {/* 1. TOP TOOLBAR & QUICK ACTIONS */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-950/80 gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-white tracking-wider text-[11px] uppercase flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-violet-400" />
            Timeline ({doc.tracks.length} Tracks)
          </span>

          <span className="text-[11px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-500" />
            {formatTimecode(currentTimeMs, fps)}
            <span className="text-zinc-500 text-[10px]">({currentTimeMs}ms)</span>
          </span>

          {/* Snapping Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSnappingEnabled(!snappingEnabled)}
            className={`h-7 px-2 text-[11px] gap-1 border ${
              snappingEnabled
                ? "bg-violet-950/60 text-violet-300 border-violet-800"
                : "text-zinc-500 border-zinc-800 hover:text-zinc-300"
            }`}
            title={snappingEnabled ? "Snapping enabled (click to disable)" : "Snapping disabled (click to enable)"}
          >
            <Magnet className="h-3.5 w-3.5" />
            <span>Snap</span>
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              className="p-1 text-zinc-400 hover:text-white"
              title="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-zinc-400 w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))))}
              className="p-1 text-zinc-400 hover:text-white"
              title="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
            {zoom !== 1 && (
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1 text-zinc-500 hover:text-violet-300"
                title="Reset zoom"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Middle action buttons: Markers, Clips, Groups */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setMarkerNameInput(`Marker @ ${currentTimeMs}ms`);
              setShowMarkerDialog(true);
            }}
            className="h-7 px-2 text-[11px] text-zinc-300 hover:text-white border border-zinc-800 hover:bg-zinc-800/80 gap-1"
            title="Add marker at playhead"
          >
            <Flag className="h-3 w-3 text-amber-400" />
            <span>Add Marker</span>
          </Button>

          {doc.tracks.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setClipTrackSelect(doc.tracks[0]?.id || "");
                setShowAddClipDialog(true);
              }}
              className="h-7 px-2 text-[11px] text-zinc-300 hover:text-white border border-zinc-800 hover:bg-zinc-800/80 gap-1"
              title="Create new animation clip"
            >
              <Plus className="h-3 w-3 text-emerald-400" />
              <span>New Clip</span>
            </Button>
          )}

          {activeClip && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
              <span className="text-[10px] text-emerald-400 font-semibold truncate max-w-[100px]">
                {activeClip.name}
              </span>
              {onSplitClip && (
                <button
                  type="button"
                  onClick={() => onSplitClip(activeClip.id, currentTimeMs)}
                  className="p-1 text-zinc-400 hover:text-emerald-300"
                  title="Split clip at playhead"
                >
                  <Scissors className="h-3 w-3" />
                </button>
              )}
              {onDuplicateClip && (
                <button
                  type="button"
                  onClick={() => onDuplicateClip(activeClip.id)}
                  className="p-1 text-zinc-400 hover:text-emerald-300"
                  title="Duplicate clip"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
              {onDeleteClip && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteClip(activeClip.id);
                    setSelectedClipId(null);
                  }}
                  className="p-1 text-zinc-400 hover:text-red-400"
                  title="Delete clip"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {onCreateGroup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setGroupNameInput("New Group");
                setShowGroupDialog(true);
              }}
              className="h-7 px-2 text-[11px] text-zinc-300 hover:text-white border border-zinc-800 hover:bg-zinc-800/80 gap-1"
              title="Create new track group"
            >
              <Folder className="h-3 w-3 text-indigo-400" />
              <span>Group</span>
            </Button>
          )}
        </div>

        {/* Right side: Keyframe inspector when selected */}
        {primaryActiveKf ? (
          <div className="flex items-center gap-2 shrink-0 bg-violet-950/40 border border-violet-800/60 px-2 py-0.5 rounded">
            <span className="text-[11px] text-violet-300 font-mono">
              KF: {primaryActiveKf.keyframe.time_ms}ms ({primaryActiveKf.track.property})
            </span>
            <input
              type="number"
              step={0.1}
              className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-white"
              value={Number(primaryActiveKf.keyframe.value) || 0}
              onChange={(e) =>
                onUpdateKeyframe(
                  primaryActiveKf.track.id,
                  primaryActiveKf.keyframe.id,
                  { value: Number(e.target.value) || 0 }
                )
              }
              title="Keyframe Value"
            />
            <select
              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-white"
              value={primaryActiveKf.keyframe.interpolation}
              onChange={(e) =>
                onUpdateKeyframe(
                  primaryActiveKf.track.id,
                  primaryActiveKf.keyframe.id,
                  { interpolation: e.target.value as InterpolationMode }
                )
              }
            >
              {INTERPOLATION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
              onClick={handleDeleteSelection}
              title="Delete Keyframe"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : selectedClipId && activeClip ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-emerald-400 font-medium">
              Clip: {activeClip.name} ({activeClip.duration_ms}ms)
            </span>
          </div>
        ) : null}
      </div>

      {/* 2. MAIN TIMELINE GRID (LEFT TRACK HEADERS + RIGHT LANES) */}
      <div className="flex flex-1 min-h-0 overflow-y-auto">
        {/* LEFT: Track Headers Hierarchy Column */}
        <div className="w-64 shrink-0 border-r border-zinc-800 bg-[#07070a] flex flex-col">
          {/* Header spacer aligned with ruler */}
          <div className="h-8 border-b border-zinc-800/80 px-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 font-semibold bg-zinc-950/70">
            <span>Track / Hierarchy</span>
            <span>Controls</span>
          </div>

          {/* Track groups and rows */}
          <div className="flex-1 overflow-y-auto">
            {doc.tracks.length === 0 ? (
              <div className="p-4 text-xs text-zinc-500 italic text-center">
                No tracks yet. Apply an animation preset or click (+) to add tracks.
              </div>
            ) : (
              <>
                {/* Groups */}
                {groupedTracks.groups.map((grp) => (
                  <div key={grp.id} className="border-b border-zinc-800/60">
                    <div className="h-8 px-2 flex items-center justify-between bg-zinc-900/60 hover:bg-zinc-900 border-l-2 border-indigo-500">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {onToggleGroupCollapse && (
                          <button
                            type="button"
                            onClick={() => onToggleGroupCollapse(grp.id)}
                            className="text-zinc-400 hover:text-white"
                          >
                            {grp.collapsed ? (
                              <ChevronRight className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <Folder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="font-semibold text-xs text-zinc-200 truncate">
                          {grp.name}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          ({grp.track_ids.length})
                        </span>
                      </div>
                      {onDeleteGroup && (
                        <button
                          type="button"
                          onClick={() => onDeleteGroup(grp.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 rounded"
                          title="Delete Group"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {!grp.collapsed &&
                      grp.track_ids.map((tid) => {
                        const tr = doc.tracks.find((t) => t.id === tid);
                        if (!tr) return null;
                        return renderTrackHeaderRow(tr, true);
                      })}
                  </div>
                ))}

                {/* Standalone Tracks */}
                {groupedTracks.standaloneTracks.map((tr) => renderTrackHeaderRow(tr, false))}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Timeline Ruler, Markers & Content Lanes */}
        <div
          ref={timelineContentRef}
          className="flex-1 min-w-0 flex flex-col relative overflow-x-auto overflow-y-hidden bg-[#0a0a0f]"
        >
          <div
            className="flex flex-col relative min-h-full"
            style={{ width: `${Math.max(100, contentWidthPercent)}%` }}
          >
            {/* MARKER LANE */}
            <div className="h-5 border-b border-zinc-800/80 bg-zinc-950/60 relative">
              {(doc.markers || []).map((m) => {
                const pct = (m.time_ms / durationMs) * 100;
                return (
                  <div
                    key={m.id}
                    onClick={() => onSeek(m.time_ms)}
                    className="absolute top-0 bottom-0 flex items-center -ml-2 cursor-pointer z-30 group"
                    style={{ left: `${pct}%` }}
                    title={`${m.name} @ ${m.time_ms}ms`}
                  >
                    <Flag
                      className="h-3.5 w-3.5 drop-shadow transition-transform group-hover:scale-125"
                      style={{ color: m.color || "#f59e0b" }}
                    />
                    <span
                      className="text-[9px] px-1 rounded ml-0.5 font-medium whitespace-nowrap bg-zinc-900/90 border border-zinc-700/60 text-zinc-200"
                    >
                      {m.name}
                    </span>
                    {onDeleteMarker && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMarker(m.id);
                        }}
                        className="hidden group-hover:inline-block ml-1 text-zinc-400 hover:text-red-400"
                        title="Delete marker"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* TIME RULER */}
            <div
              ref={rulerRef}
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              className="h-8 border-b border-zinc-800/80 bg-zinc-950 relative cursor-pointer select-none"
            >
              {rulerTicks.map((ms) => {
                const pct = (ms / durationMs) * 100;
                return (
                  <div
                    key={ms}
                    className="absolute top-0 bottom-0 flex flex-col items-start border-l border-zinc-800"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="text-[9px] text-zinc-500 font-mono pl-1 select-none pointer-events-none">
                      {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}
                    </span>
                  </div>
                );
              })}

              {/* Playhead Head on ruler */}
              <div
                className="absolute top-0 bottom-0 w-3 -ml-1.5 flex flex-col items-center pointer-events-none z-40"
                style={{ left: `${playheadPercent}%` }}
              >
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-violet-500 shadow-md" />
              </div>
            </div>

            {/* SNAPPING INDICATOR LINE */}
            {snapIndicator && (
              <div
                className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none z-50 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                style={{ left: `${(snapIndicator.timeMs / durationMs) * 100}%` }}
              >
                <div className="absolute top-8 left-1 text-[9px] bg-amber-500 text-black px-1 rounded font-bold whitespace-nowrap">
                  {snapIndicator.label} ({snapIndicator.timeMs}ms)
                </div>
              </div>
            )}

            {/* PLAYHEAD VERTICAL LINE PASSING THROUGH ALL LANES */}
            <div
              className="absolute top-0 bottom-0 w-px bg-violet-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(139,92,246,0.8)]"
              style={{ left: `${playheadPercent}%` }}
            />

            {/* TRACK CONTENT LANES (CLIPS & KEYFRAMES) */}
            <div className="flex-1 relative">
              {/* Grouped tracks rows */}
              {groupedTracks.groups.map((grp) => {
                if (grp.collapsed) {
                  return (
                    <div
                      key={grp.id}
                      className="h-8 border-b border-zinc-800/40 relative bg-indigo-950/10 flex items-center px-3"
                    >
                      <span className="text-[10px] text-indigo-400 italic font-mono">
                        Group collapsed ({grp.track_ids.length} tracks hidden)
                      </span>
                    </div>
                  );
                }
                return grp.track_ids.map((tid) => {
                  const tr = doc.tracks.find((t) => t.id === tid);
                  if (!tr) return null;
                  return renderTrackLane(tr);
                });
              })}

              {/* Standalone track rows */}
              {groupedTracks.standaloneTracks.map((tr) => renderTrackLane(tr))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODALS (Marker, Group, Clip) */}
      {showMarkerDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 w-80 shadow-2xl space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Flag className="h-4 w-4 text-amber-400" />
              Add Timeline Marker
            </h3>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Marker Name</label>
              <input
                type="text"
                value={markerNameInput}
                onChange={(e) => setMarkerNameInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                placeholder="e.g., Beat Drop, Transition"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Color</label>
              <div className="flex gap-2">
                {["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4"].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setMarkerColorInput(col)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      markerColorInput === col ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowMarkerDialog(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (onAddMarker) onAddMarker(markerNameInput, currentTimeMs, markerColorInput);
                  setShowMarkerDialog(false);
                }}
                className="text-xs bg-violet-600 hover:bg-violet-500 text-white"
              >
                Create Marker
              </Button>
            </div>
          </div>
        </div>
      )}

      {showGroupDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 w-80 shadow-2xl space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Folder className="h-4 w-4 text-indigo-400" />
              Create Track Group
            </h3>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Group Name</label>
              <input
                type="text"
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                placeholder="e.g., Character Rig, Camera Movement"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGroupDialog(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (onCreateGroup) onCreateGroup(groupNameInput);
                  setShowGroupDialog(false);
                }}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Create Group
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddClipDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 w-84 shadow-2xl space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-emerald-400" />
              Create Animation Clip
            </h3>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Target Track</label>
              <select
                value={clipTrackSelect}
                onChange={(e) => setClipTrackSelect(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
              >
                {doc.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.target_id}.{t.property} ({t.name || t.track_type || "track"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Clip Name</label>
              <input
                type="text"
                value={clipNameInput}
                onChange={(e) => setClipNameInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Duration (ms)</label>
              <input
                type="number"
                step={100}
                value={clipDurationInput}
                onChange={(e) => setClipDurationInput(Number(e.target.value) || 1000)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddClipDialog(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (onAddClip && clipTrackSelect) {
                    onAddClip(clipTrackSelect, clipNameInput, currentTimeMs, clipDurationInput);
                  }
                  setShowAddClipDialog(false);
                }}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Add Clip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper render for single track header row
  function renderTrackHeaderRow(tr: Track, indented = false) {
    const typeBadge = TRACK_TYPE_COLORS[tr.track_type || "property"] || TRACK_TYPE_COLORS.property;
    return (
      <div
        key={tr.id}
        className={`h-8 px-2 flex items-center justify-between border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors ${
          indented ? "pl-6 bg-zinc-950/40" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Visibility button */}
          <button
            type="button"
            onClick={() => onToggleTrack(tr.id)}
            className="text-zinc-500 hover:text-zinc-300"
            title={tr.enabled ? "Hide track" : "Show track"}
          >
            {tr.enabled ? <Eye className="h-3 w-3 text-violet-400" /> : <EyeOff className="h-3 w-3 text-zinc-600" />}
          </button>

          {/* Lock button */}
          {onLockTrack && (
            <button
              type="button"
              onClick={() => onLockTrack(tr.id, !tr.locked)}
              className="text-zinc-500 hover:text-zinc-300"
              title={tr.locked ? "Unlock track" : "Lock track"}
            >
              {tr.locked ? <Lock className="h-3 w-3 text-amber-400" /> : <Unlock className="h-3 w-3 text-zinc-600" />}
            </button>
          )}

          {/* Mute button */}
          {onMuteTrack && (
            <button
              type="button"
              onClick={() => onMuteTrack(tr.id, !tr.muted)}
              className="text-zinc-500 hover:text-zinc-300"
              title={tr.muted ? "Unmute track" : "Mute track"}
            >
              {tr.muted ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3 text-zinc-600" />}
            </button>
          )}

          {/* Type Badge */}
          <span
            className={`text-[9px] px-1 py-0.2 rounded border font-mono uppercase ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}
          >
            {tr.track_type ? tr.track_type.slice(0, 4) : "prop"}
          </span>

          {/* Label */}
          <span
            className={`truncate text-xs font-medium ${tr.enabled ? "text-zinc-200" : "text-zinc-500"}`}
            title={`${tr.name || tr.target_id} • ${tr.property}`}
          >
            {tr.name ? tr.name : tr.target_id === "camera" ? "Camera" : tr.target_id.replace("obj_", "")}
            <span className="text-violet-400 font-mono ml-1 font-normal">.{tr.property}</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Color pill */}
          {onSetTrackColor && (
            <span
              className="w-2.5 h-2.5 rounded-full border border-zinc-700"
              style={{ backgroundColor: tr.color || "#8b5cf6" }}
              title="Track Color"
            />
          )}

          {/* Add Keyframe button */}
          <button
            type="button"
            onClick={() => onAddKeyframeAtPlayhead(tr.id)}
            disabled={tr.locked}
            className={`p-1 rounded ${
              tr.locked ? "text-zinc-700 cursor-not-allowed" : "text-zinc-400 hover:text-violet-300 hover:bg-zinc-800"
            }`}
            title="Insert keyframe at playhead"
          >
            <Plus className="h-3 w-3" />
          </button>

          {/* Remove track */}
          <button
            type="button"
            onClick={() => onDeleteTrack(tr.id)}
            disabled={tr.locked}
            className={`p-1 rounded ${
              tr.locked ? "text-zinc-700 cursor-not-allowed" : "text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
            }`}
            title="Remove track"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // Helper render for single track lane (clips and keyframes)
  function renderTrackLane(tr: Track) {
    const trackClips = (doc.clips || []).filter((c) => c.track_id === tr.id);

    return (
      <div key={tr.id} className="h-8 border-b border-zinc-800/40 relative bg-zinc-950/20 group">
        {/* Horizontal center wire */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-800/40" />

        {/* 1. CLIPS ON THIS TRACK */}
        {trackClips.map((clip) => {
          const startPct = (clip.start_ms / durationMs) * 100;
          const widthPct = (clip.duration_ms / durationMs) * 100;
          const isSelected = selectedClipId === clip.id;

          return (
            <div
              key={clip.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedClipId(clip.id);
                onSelectClip?.(clip.id);
                onSelectKeyframes?.([]);
                onSelectKeyframe?.(null);
              }}
              onPointerDown={(e) => {
                if (!tr.locked) handleClipPointerDown(e, clip, "move");
              }}
              onPointerMove={handleClipPointerMove}
              onPointerUp={handleClipPointerUp}
              className={`absolute top-1 bottom-1 rounded px-2 flex items-center justify-between text-[10px] font-medium cursor-grab active:cursor-grabbing z-10 transition-colors ${
                isSelected
                  ? "bg-emerald-600/50 border-2 border-emerald-400 text-white shadow-lg"
                  : "bg-emerald-800/30 border border-emerald-700/60 text-emerald-200 hover:bg-emerald-700/40"
              } ${tr.locked ? "pointer-events-none opacity-60" : ""}`}
              style={{
                left: `${startPct}%`,
                width: `${widthPct}%`,
                backgroundColor: clip.color ? `${clip.color}33` : undefined,
                borderColor: clip.color ? clip.color : undefined,
              }}
            >
              {/* Left Trim Handle */}
              <div
                onPointerDown={(e) => {
                  if (!tr.locked) handleClipPointerDown(e, clip, "trim-start");
                }}
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/40 rounded-l"
                title="Trim clip start"
              />

              <span className="truncate select-none pointer-events-none pl-1 z-10">
                {clip.name}
              </span>

              {/* Waveform visualization for audio clips */}
              {clip.waveform && clip.waveform.length > 0 && (
                <div className="absolute inset-y-1 inset-x-2 flex items-center gap-[1px] opacity-35 pointer-events-none overflow-hidden">
                  {clip.waveform.map((peak, idx) => (
                    <div
                      key={idx}
                      className="flex-1 rounded-[1px] bg-white min-w-[1px]"
                      style={{ height: `${Math.max(15, peak * 100)}%` }}
                    />
                  ))}
                </div>
              )}

              {/* Right Trim Handle */}
              <div
                onPointerDown={(e) => {
                  if (!tr.locked) handleClipPointerDown(e, clip, "trim-end");
                }}
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/40 rounded-r"
                title="Trim clip end"
              />
            </div>
          );
        })}

        {/* 2. KEYFRAMES ON THIS TRACK */}
        {tr.keyframes.map((kf) => {
          const kfPct = (kf.time_ms / durationMs) * 100;
          const isSelected = selectedKeyframes.some(
            (r) => r.trackId === tr.id && r.keyframeId === kf.id
          );

          return (
            <button
              key={kf.id}
              type="button"
              onClick={(e) => handleKeyframeClick(e, tr.id, kf.id, kf.time_ms)}
              onPointerDown={(e) => {
                if (!tr.locked) handleKeyframePointerDown(e, tr.id, kf.id, kf.time_ms);
              }}
              onPointerMove={handleKeyframePointerMove}
              onPointerUp={handleKeyframePointerUp}
              disabled={tr.locked}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 transition-transform z-20 ${
                isSelected
                  ? "bg-violet-400 ring-2 ring-white scale-125 shadow-[0_0_8px_rgba(139,92,246,0.9)]"
                  : "bg-amber-400 hover:scale-125 hover:bg-amber-300"
              } ${tr.locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ left: `${kfPct}%` }}
              title={`${tr.property}: ${kf.value} (${kf.time_ms}ms, ${kf.interpolation})`}
            />
          );
        })}
      </div>
    );
  }
}
