"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  HelpCircle,
  Layers,
  Loader2,
  Maximize2,
  Move,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Sliders,
  Sparkles,
  Square,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { AnimationAIPanel } from "@/components/studio/animation-ai-panel";
import { AnimationPresetDialog } from "@/components/studio/animation-preset-dialog";
import {
  AnimationTimeline,
  type SelectedKeyframeRef,
} from "@/components/studio/animation-timeline";
import {
  CanvasSceneRenderer,
  PlaybackController,
  applyPreset,
  createEvaluatedState,
  evaluateDocument,
  evaluateObjectProperty,
  msToFrame,
  newId,
  snapToFrame,
  totalFrames,
  updateCameraBase,
  updateDocumentSettings,
  updateKeyframe,
  updateObjectBase,
  upsertKeyframe,
  addMotionPath,
  updateMotionPath,
  removeMotionPath,
  addClip,
  updateClip,
  moveClip,
  trimClip,
  splitClip,
  duplicateClip,
  deleteClip,
  deleteClips,
  retargetClip,
  addMarker,
  updateMarker,
  deleteMarker,
  createTrackGroup,
  updateTrackGroup,
  deleteTrackGroup,
  toggleGroupCollapse,
  setTrackLocked,
  setTrackMuted,
  setTrackColor,
  setTrackName,
  setTrackType,
  reorderTracks,
  moveKeyframeGroup,
  deleteKeyframes,
  TimelineHistory,
  type AnimObject,
  type AnimationDocument,
  type AnimatableProperty,
  type Keyframe,
  type TimelineClip,
  type TimelineMarker,
  type TrackGroup,
  type TrackType,
} from "@tr-studio/animation-engine";
import type { SceneDetailRecord } from "@tr-studio/shared-types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function AnimationStudio({
  projectId,
  initialSceneId,
}: {
  projectId: string;
  initialSceneId?: string;
}) {
  const [scenes, setScenes] = useState<SceneDetailRecord[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>(initialSceneId || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation document & versioning
  const [doc, setDoc] = useState<AnimationDocument | null>(null);
  const [docVersion, setDocVersion] = useState(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isDirty, setIsDirty] = useState(false);

  // Playback state
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Selection
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedKeyframe, setSelectedKeyframe] = useState<SelectedKeyframeRef | null>(null);
  const [selectedKeyframes, setSelectedKeyframes] = useState<SelectedKeyframeRef[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Undo / Redo History Stack
  const historyRef = useRef<TimelineHistory<AnimationDocument> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Resizable Timeline Height
  const [timelineHeight, setTimelineHeight] = useState(260);
  const [resizingTimeline, setResizingTimeline] = useState(false);

  // Modals / Panels & Conflict state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<"canvas" | "layers" | "inspector" | "timeline">("canvas");
  const [conflictError, setConflictError] = useState<{
    serverVersion: number;
    message: string;
  } | null>(null);

  // Touch gesture state for mobile canvas
  const touchStateRef = useRef<{
    lastX: number;
    lastY: number;
    lastDist: number | null;
  }>({ lastX: 0, lastY: 0, lastDist: null });

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CanvasSceneRenderer | null>(null);
  const playbackRef = useRef<PlaybackController | null>(null);
  const docRef = useRef<AnimationDocument | null>(null);
  docRef.current = doc;

  // Track save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // 1. Load scenes list & current scene animation
  // -------------------------------------------------------------------------
  const loadScenes = useCallback(async () => {
    try {
      const list = await api.sceneBuilder.listProjectScenes(projectId);
      setScenes(list);
      if (list.length > 0 && !selectedSceneId) {
        setSelectedSceneId(list[0].id);
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to load scenes for animation."));
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedSceneId]);

  useEffect(() => {
    void loadScenes();
  }, [loadScenes]);

  const loadSceneAnimation = useCallback(async (sceneId: string) => {
    if (!sceneId) return;
    setError(null);
    setSaveStatus("idle");
    setIsDirty(false);
    try {
      const res = await api.animation.getSceneAnimation(sceneId);
      const documentData = res.document as unknown as AnimationDocument;
      setDoc(documentData);
      setDocVersion(res.version_number);
      setCurrentTimeMs(0);
      setSelectedKeyframe(null);
      setSelectedKeyframes([]);
      setSelectedClipId(null);
      setConflictError(null);
      historyRef.current = new TimelineHistory(documentData, 50);
      setCanUndo(false);
      setCanRedo(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to load scene animation."));
    }
  }, []);

  useEffect(() => {
    if (selectedSceneId) {
      void loadSceneAnimation(selectedSceneId);
    }
  }, [selectedSceneId, loadSceneAnimation]);

  // -------------------------------------------------------------------------
  // 2. Setup Canvas Renderer and Playback Controller
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current || !doc) return;

    if (!rendererRef.current) {
      const r = new CanvasSceneRenderer({
        canvas: canvasRef.current,
        onImageLoaded: () => r.invalidate(),
      });
      rendererRef.current = r;
    }

    const renderer = rendererRef.current;
    renderer.setDocument(doc);
    renderer.setSelection(selectedObjectId);
    renderer.setPathOverlay(selectedObjectId);

    // Prepare asset URLs for renderer
    const currentScene = scenes.find((s) => s.id === selectedSceneId);
    const urls: Record<string, string | null> = {};
    if (currentScene) {
      if (currentScene.thumbnail_url || currentScene.environment?.image_url) {
        urls["obj_scene_environment"] =
          currentScene.thumbnail_url || currentScene.environment?.image_url || null;
      }
      for (const a of currentScene.asset_assignments) {
        if (a.image_url) urls[`obj_asset_${a.id}`] = a.image_url;
      }
      for (const c of currentScene.character_assignments) {
        if (c.image_url) urls[`obj_char_${c.id}`] = c.image_url;
      }
    }
    renderer.setAssetUrls(urls);

    // Initial evaluation
    const state = createEvaluatedState(doc);
    evaluateDocument(doc, currentTimeMs, state);
    renderer.setState(state);

    // Resize observer
    const container = canvasContainerRef.current;
    if (container) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          renderer.resize(width, height);
        }
      });
      ro.observe(container);
      return () => {
        ro.disconnect();
      };
    }
  }, [doc, selectedObjectId, scenes, selectedSceneId, currentTimeMs]);

  // Setup Playback Controller
  useEffect(() => {
    if (!doc) return;

    if (playbackRef.current) {
      playbackRef.current.dispose();
    }

    const pc = new PlaybackController({
      getDocument: () => docRef.current || doc,
      onFrame: (timeMs) => {
        setCurrentTimeMs(timeMs);
        if (rendererRef.current && docRef.current) {
          const state = createEvaluatedState(docRef.current);
          evaluateDocument(docRef.current, timeMs, state);
          rendererRef.current.setState(state);
        }
      },
      onStateChange: (st) => {
        setIsPlaying(st === "playing");
      },
    });

    playbackRef.current = pc;
    pc.attachVisibilityListener();

    return () => {
      pc.dispose();
      playbackRef.current = null;
    };
  }, [doc]);

  // -------------------------------------------------------------------------
  // 3. Document Save & Concurrency
  // -------------------------------------------------------------------------
  const persistDocument = useCallback(
    async (documentToSave: AnimationDocument) => {
      if (!selectedSceneId) return;
      setSaveStatus("saving");
      try {
        const res = await api.animation.saveSceneAnimation(selectedSceneId, {
          document: documentToSave as unknown as Record<string, unknown>,
          expected_version_number: docVersion,
        });
        setDocVersion(res.version_number);
        setSaveStatus("saved");
        setIsDirty(false);
        setConflictError(null);
      } catch (err: unknown) {
        setSaveStatus("error");
        const msg = errorMessage(err, "Failed to save animation document.");
        if (msg.includes("Concurrent edit conflict") || (err as { status?: number })?.status === 409) {
          setConflictError({
            serverVersion: docVersion + 1,
            message: msg,
          });
        } else {
          setError(msg);
        }
      }
    },
    [selectedSceneId, docVersion]
  );

  const applyDocMutation = useCallback(
    (mutator: (d: AnimationDocument) => AnimationDocument) => {
      if (!doc) return;
      const next = mutator(doc);
      setDoc(next);
      setIsDirty(true);
      setSaveStatus("idle");

      // Push into history stack
      if (historyRef.current) {
        historyRef.current.push(next);
        setCanUndo(historyRef.current.canUndo);
        setCanRedo(historyRef.current.canRedo);
      }

      // Update renderer state immediately
      if (rendererRef.current) {
        rendererRef.current.setDocument(next);
        const state = createEvaluatedState(next);
        evaluateDocument(next, currentTimeMs, state);
        rendererRef.current.setState(state);
      }

      // Debounce auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persistDocument(next);
      }, 1200);
    },
    [doc, currentTimeMs, persistDocument]
  );

  const handleUndo = useCallback(() => {
    if (!historyRef.current || !historyRef.current.canUndo) return;
    const prev = historyRef.current.undo();
    if (prev) {
      setDoc(prev);
      setIsDirty(true);
      setCanUndo(historyRef.current.canUndo);
      setCanRedo(historyRef.current.canRedo);
      if (rendererRef.current) {
        rendererRef.current.setDocument(prev);
        const state = createEvaluatedState(prev);
        evaluateDocument(prev, currentTimeMs, state);
        rendererRef.current.setState(state);
      }
    }
  }, [currentTimeMs]);

  const handleRedo = useCallback(() => {
    if (!historyRef.current || !historyRef.current.canRedo) return;
    const next = historyRef.current.redo();
    if (next) {
      setDoc(next);
      setIsDirty(true);
      setCanUndo(historyRef.current.canUndo);
      setCanRedo(historyRef.current.canRedo);
      if (rendererRef.current) {
        rendererRef.current.setDocument(next);
        const state = createEvaluatedState(next);
        evaluateDocument(next, currentTimeMs, state);
        rendererRef.current.setState(state);
      }
    }
  }, [currentTimeMs]);

  const handleForceOverwrite = async () => {
    if (!doc || !selectedSceneId) return;
    setSaveStatus("saving");
    setConflictError(null);
    try {
      const res = await api.animation.saveSceneAnimation(selectedSceneId, {
        document: doc as unknown as Record<string, unknown>,
        expected_version_number: null,
      });
      setDocVersion(res.version_number);
      setSaveStatus("saved");
      setIsDirty(false);
    } catch (err) {
      setSaveStatus("error");
      setError(errorMessage(err, "Failed to force overwrite animation."));
    }
  };

  const handleReloadServerVersion = async () => {
    setConflictError(null);
    if (selectedSceneId) {
      await loadSceneAnimation(selectedSceneId);
    }
  };

  // -------------------------------------------------------------------------
  // 4. Playback Controls
  // -------------------------------------------------------------------------
  const togglePlay = () => {
    if (!playbackRef.current) return;
    if (isPlaying) {
      playbackRef.current.pause();
    } else {
      playbackRef.current.play();
    }
  };

  const stopPlayback = () => {
    playbackRef.current?.stop();
    setCurrentTimeMs(0);
  };

  const seekTime = (ms: number) => {
    if (!doc) return;
    const clamped = Math.max(0, Math.min(doc.duration_ms, ms));
    setCurrentTimeMs(clamped);
    playbackRef.current?.seek(clamped);
    if (rendererRef.current) {
      const state = createEvaluatedState(doc);
      evaluateDocument(doc, clamped, state);
      rendererRef.current.setState(state);
    }
  };

  const stepFrame = (delta: number) => {
    playbackRef.current?.stepFrame(delta);
  };

  // -------------------------------------------------------------------------
  // 5. Canvas Mouse Interaction
  // -------------------------------------------------------------------------
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current || !doc) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Check hit test
    const hitId = rendererRef.current.hitTest(sx, sy);
    setSelectedObjectId(hitId);
    rendererRef.current.setSelection(hitId);
    rendererRef.current.setPathOverlay(hitId);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!rendererRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    rendererRef.current.zoomAt(zoomFactor, sx, sy);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStateRef.current = { lastX: t.clientX, lastY: t.clientY, lastDist: null };
      if (rendererRef.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const hitId = rendererRef.current.hitTest(t.clientX - rect.left, t.clientY - rect.top);
        setSelectedObjectId(hitId);
        rendererRef.current.setSelection(hitId);
        rendererRef.current.setPathOverlay(hitId);
      }
    } else if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStateRef.current = {
        lastX: (t1.clientX + t2.clientX) / 2,
        lastY: (t1.clientY + t2.clientY) / 2,
        lastDist: dist,
      };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current) return;
    if (e.touches.length === 1 && touchStateRef.current.lastDist === null) {
      const t = e.touches[0];
      const dx = t.clientX - touchStateRef.current.lastX;
      const dy = t.clientY - touchStateRef.current.lastY;
      touchStateRef.current.lastX = t.clientX;
      touchStateRef.current.lastY = t.clientY;
      rendererRef.current.panBy(dx, dy);
    } else if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const rect = e.currentTarget.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      if (touchStateRef.current.lastDist && touchStateRef.current.lastDist > 0) {
        const factor = dist / touchStateRef.current.lastDist;
        rendererRef.current.zoomAt(factor, midX, midY);
      }
      touchStateRef.current.lastDist = dist;
    }
  };

  const handleCanvasTouchEnd = () => {
    touchStateRef.current.lastDist = null;
  };

  // -------------------------------------------------------------------------
  // 6. Keyframing Actions
  // -------------------------------------------------------------------------
  const handleAddKeyframeAtPlayhead = (trackId: string) => {
    if (!doc) return;
    const tr = doc.tracks.find((t) => t.id === trackId);
    if (!tr) return;
    const currentVal = evaluateObjectProperty(doc, tr.target_id, tr.property, currentTimeMs);
    const val = currentVal !== undefined ? currentVal : 0;

    applyDocMutation((currentDoc) => {
      const res = upsertKeyframe(currentDoc, tr.target_id, tr.property, {
        time_ms: currentTimeMs,
        value: val,
        interpolation: "ease-in-out",
      });
      return res.ok ? res.doc : currentDoc;
    });
  };

  const handleAddPropertyKeyframe = (targetId: string, property: AnimatableProperty, value: number) => {
    if (!doc) return;
    applyDocMutation((currentDoc) => {
      const res = upsertKeyframe(currentDoc, targetId, property, {
        time_ms: currentTimeMs,
        value,
        interpolation: "ease-in-out",
      });
      return res.ok ? res.doc : currentDoc;
    });
  };

  const handleUpdateKeyframe = (trackId: string, kfId: string, patch: Partial<Keyframe>) => {
    if (!doc) return;
    applyDocMutation((currentDoc) => {
      const res = updateKeyframe(currentDoc, trackId, kfId, patch);
      return res.ok ? res.doc : currentDoc;
    });
  };

  const handleDeleteKeyframe = (trackId: string, kfId: string) => {
    if (!doc) return;
    applyDocMutation((currentDoc) => {
      const tr = currentDoc.tracks.find((t) => t.id === trackId);
      if (!tr) return currentDoc;
      return {
        ...currentDoc,
        tracks: currentDoc.tracks.map((t) =>
          t.id === trackId
            ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== kfId) }
            : t
        ),
      };
    });
    setSelectedKeyframe(null);
  };

  const handleDeleteKeyframes = (refs: SelectedKeyframeRef[]) => {
    if (!doc) return;
    applyDocMutation((currentDoc) => {
      const res = deleteKeyframes(currentDoc, refs);
      return res.ok ? res.doc : currentDoc;
    });
    setSelectedKeyframes([]);
    setSelectedKeyframe(null);
  };

  const handleMoveKeyframes = (refs: SelectedKeyframeRef[], deltaMs: number) => {
    if (!doc) return;
    applyDocMutation((currentDoc) => {
      const res = moveKeyframeGroup(currentDoc, refs, deltaMs);
      return res.ok ? res.doc : currentDoc;
    });
  };

  // Track operations
  const handleLockTrack = (trackId: string, locked: boolean) => {
    applyDocMutation((d) => {
      const res = setTrackLocked(d, trackId, locked);
      return res.ok ? res.doc : d;
    });
  };

  const handleMuteTrack = (trackId: string, muted: boolean) => {
    applyDocMutation((d) => {
      const res = setTrackMuted(d, trackId, muted);
      return res.ok ? res.doc : d;
    });
  };

  const handleSetTrackColor = (trackId: string, color: string | null) => {
    applyDocMutation((d) => {
      const res = setTrackColor(d, trackId, color);
      return res.ok ? res.doc : d;
    });
  };

  const handleReorderTracks = (orderedTrackIds: string[]) => {
    applyDocMutation((d) => {
      const res = reorderTracks(d, orderedTrackIds);
      return res.ok ? res.doc : d;
    });
  };

  // Clip operations
  const handleAddClip = (trackId: string, name: string, startMs: number, durationMs: number) => {
    applyDocMutation((d) => {
      const res = addClip(d, trackId, name, startMs, durationMs);
      return res.ok ? res.doc : d;
    });
  };

  const handleMoveClip = (clipId: string, newStartMs: number) => {
    applyDocMutation((d) => {
      const res = moveClip(d, clipId, newStartMs);
      return res.ok ? res.doc : d;
    });
  };

  const handleTrimClip = (clipId: string, newStartMs: number, newDurationMs: number, newSourceStartMs?: number) => {
    applyDocMutation((d) => {
      const res = trimClip(d, clipId, newStartMs, newDurationMs, newSourceStartMs);
      return res.ok ? res.doc : d;
    });
  };

  const handleSplitClip = (clipId: string, atMs: number) => {
    applyDocMutation((d) => {
      const res = splitClip(d, clipId, atMs);
      return res.ok ? res.doc : d;
    });
  };

  const handleDuplicateClip = (clipId: string) => {
    applyDocMutation((d) => {
      const res = duplicateClip(d, clipId);
      return res.ok ? res.doc : d;
    });
  };

  const handleDeleteClip = (clipId: string) => {
    applyDocMutation((d) => {
      const res = deleteClip(d, clipId);
      return res.ok ? res.doc : d;
    });
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  // Marker operations
  const handleAddMarker = (name: string, timeMs: number, color = "#6366f1") => {
    applyDocMutation((d) => {
      const res = addMarker(d, name, timeMs, color);
      return res.ok ? res.doc : d;
    });
  };

  const handleUpdateMarker = (markerId: string, patch: Partial<TimelineMarker>) => {
    applyDocMutation((d) => {
      const res = updateMarker(d, markerId, patch);
      return res.ok ? res.doc : d;
    });
  };

  const handleDeleteMarker = (markerId: string) => {
    applyDocMutation((d) => {
      const res = deleteMarker(d, markerId);
      return res.ok ? res.doc : d;
    });
  };

  // Group operations
  const handleCreateGroup = (name: string, trackIds: string[] = []) => {
    applyDocMutation((d) => {
      const res = createTrackGroup(d, name, trackIds);
      return res.ok ? res.doc : d;
    });
  };

  const handleToggleGroupCollapse = (groupId: string) => {
    applyDocMutation((d) => {
      const res = toggleGroupCollapse(d, groupId);
      return res.ok ? res.doc : d;
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    applyDocMutation((d) => {
      const res = deleteTrackGroup(d, groupId);
      return res.ok ? res.doc : d;
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Space play/pause
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Arrow frame stepping
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepFrame(e.shiftKey ? -5 : -1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepFrame(e.shiftKey ? 5 : 1);
        return;
      }

      // Delete keyframe / clip
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedKeyframes.length > 0) {
          e.preventDefault();
          handleDeleteKeyframes(selectedKeyframes);
        } else if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedClipId);
        }
        return;
      }

      // Help Modal
      if (e.key === "?") {
        setShowShortcutModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedKeyframes, selectedClipId, isPlaying, handleUndo, handleRedo]);

  // -------------------------------------------------------------------------
  // 7. Reset Animation from Scene
  // -------------------------------------------------------------------------
  const handleResetSceneAnimation = async () => {
    if (!selectedSceneId) return;
    if (!window.confirm("Reset this animation document to match the static scene layout? Custom animation tracks will be cleared.")) {
      return;
    }
    setSaveStatus("saving");
    try {
      const res = await api.animation.resetSceneAnimation(selectedSceneId);
      setDoc(res.document as unknown as AnimationDocument);
      setDocVersion(res.version_number);
      setSaveStatus("saved");
      setIsDirty(false);
      setCurrentTimeMs(0);
    } catch (err) {
      setError(errorMessage(err, "Failed to reset animation."));
      setSaveStatus("error");
    }
  };

  // Selected object state
  const selectedObject = doc?.objects.find((o) => o.id === selectedObjectId);
  const isCameraSelected = selectedObjectId === "camera";

  return (
    <SceneStudioFrame
      projectId={projectId}
      active="animation"
      title="2D Animation Studio"
      description="Animate characters, environments, props, and cameras with keyframes, interpolation, motion paths, and real-time playback."
      actions={
        <div className="flex items-center gap-2">
          {scenes.length > 0 && (
            <select
              aria-label="Select Scene to Animate"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
              value={selectedSceneId}
              onChange={(e) => setSelectedSceneId(e.target.value)}
            >
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  Scene {s.scene_number}: {s.title}
                </option>
              ))}
            </select>
          )}

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
            onClick={() => setShowShortcutModal(true)}
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAIPanel((v) => !v)}
            aria-expanded={showAIPanel}
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-400 mr-1" />
            AI Animation
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPresetDialog(true)}
            disabled={!doc}
          >
            <Wand2 className="h-3.5 w-3.5 mr-1 text-amber-400" />
            Presets
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleResetSceneAnimation()}
            disabled={!doc}
            title="Re-sync scene elements from Step 5"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>

          <Button
            size="sm"
            onClick={() => doc && void persistDocument(doc)}
            disabled={saveStatus === "saving" || !isDirty}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
            )}
            {saveStatus === "saving" ? "Saving..." : isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      }
    >
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* AI Animation Assist Panel */}
      {showAIPanel && selectedSceneId && (
        <AnimationAIPanel
          projectId={projectId}
          sceneId={selectedSceneId}
          selectedObjectId={selectedObjectId}
          onApplied={() => void loadSceneAnimation(selectedSceneId)}
          onClose={() => setShowAIPanel(false)}
        />
      )}

      {/* Preset Dialog */}
      {showPresetDialog && doc && (
        <AnimationPresetDialog
          targetId={selectedObjectId || "camera"}
          targetLabel={
            isCameraSelected
              ? "Camera"
              : selectedObject?.label || "Scene Elements"
          }
          currentTimeMs={currentTimeMs}
          maxDurationMs={doc.duration_ms}
          onApply={(presetId, opts) => {
            applyDocMutation((currentDoc) => {
              const res = applyPreset(
                currentDoc,
                presetId,
                selectedObjectId || "camera",
                opts
              );
              return res.ok ? res.doc : currentDoc;
            });
          }}
          onClose={() => setShowPresetDialog(false)}
        />
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400 mb-2" />
          <p className="text-sm">Loading 2D Animation Studio...</p>
        </div>
      ) : !doc ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center text-sm text-zinc-400">
          No scene animation available. Create scenes in the Scene Builder first.
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-[#08080c] overflow-hidden shadow-2xl">
          {/* Top Playback & Canvas Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-950/80">
            {/* Playback Transport Buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => stepFrame(-1)}
                title="Step backward one frame"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={togglePlay}
                className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white font-medium gap-1.5"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                <span>{isPlaying ? "Pause" : "Play"}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={stopPlayback}
                title="Stop & return to start"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => stepFrame(1)}
                title="Step forward one frame"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="h-4 w-px bg-zinc-800 mx-1" />

              {/* Loop toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextLoop = !loop;
                  setLoop(nextLoop);
                  applyDocMutation((d) => ({
                    ...d,
                    playback: { ...d.playback, loop: nextLoop },
                  }));
                }}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  loop
                    ? "bg-violet-600/30 text-violet-300 border border-violet-500/50"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Toggle playback loop"
              >
                LOOP
              </button>

              {/* Playback speed selector */}
              <select
                aria-label="Playback Speed"
                className="rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 px-1.5 py-1"
                value={playbackSpeed}
                onChange={(e) => {
                  const spd = Number(e.target.value) || 1.0;
                  setPlaybackSpeed(spd);
                  applyDocMutation((d) => ({
                    ...d,
                    playback: { ...d.playback, speed: spd },
                  }));
                }}
              >
                <option value={0.5}>0.5x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2.0}>2.0x</option>
              </select>

              {/* FPS Indicator */}
              <select
                aria-label="Frame Rate"
                className="rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 px-1.5 py-1 font-mono"
                value={doc.fps}
                onChange={(e) => {
                  const newFps = Number(e.target.value) as 12 | 24 | 25 | 30 | 60;
                  applyDocMutation((d) => updateDocumentSettings(d, { fps: newFps }).ok ? updateDocumentSettings(d, { fps: newFps }) as any : d);
                }}
              >
                <option value={12}>12 FPS</option>
                <option value={24}>24 FPS</option>
                <option value={25}>25 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>

            {/* Timecode & Frame Counter */}
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-300 bg-zinc-900/90 px-3 py-1 rounded-lg border border-zinc-800">
              <span className="text-violet-400 font-semibold">
                {(currentTimeMs / 1000).toFixed(2)}s
              </span>
              <span className="text-zinc-600">/</span>
              <span>{(doc.duration_ms / 1000).toFixed(1)}s</span>
              <span className="text-zinc-600">|</span>
              <span className="text-amber-400 font-semibold">
                F{msToFrame(currentTimeMs, doc.fps)}
              </span>
              <span className="text-zinc-600">/</span>
              <span>F{totalFrames(doc.duration_ms, doc.fps)}</span>
            </div>

            {/* Canvas Zoom Controls */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => rendererRef.current?.zoomAt(0.85, 400, 300)}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => rendererRef.current?.zoomAt(1.15, 400, 300)}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => rendererRef.current?.fitToView()}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                title="Fit to Canvas"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile / Tablet View Switcher */}
          <div className="flex lg:hidden items-center border-b border-zinc-800 bg-[#0c0c12] px-2 py-1.5 gap-1.5">
            {(["canvas", "layers", "inspector", "timeline"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileWorkspaceTab(tab)}
                className={cn(
                  "flex-1 py-2 text-xs font-medium rounded-lg capitalize transition-colors min-h-[44px]",
                  mobileWorkspaceTab === tab
                    ? "bg-violet-600/30 text-white border border-violet-500/40 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Middle 3-Column Studio Workspace */}
          <div
            className={cn(
              "h-[520px] min-h-0 bg-[#09090d]",
              mobileWorkspaceTab === "timeline"
                ? "hidden lg:grid lg:grid-cols-[240px_minmax(0,1fr)_280px]"
                : "grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_280px]"
            )}
          >
            {/* LEFT: Scene Objects & Layers List */}
            <aside
              aria-label="Scene objects and layers"
              className={cn(
                "border-r border-zinc-800/80 p-3 overflow-y-auto space-y-3",
                mobileWorkspaceTab === "layers" ? "block h-[520px]" : "hidden lg:block"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-violet-400" />
                  Objects ({doc.objects.length})
                </span>
              </div>

              {/* Camera selection button */}
              <button
                type="button"
                onClick={() => setSelectedObjectId(isCameraSelected ? null : "camera")}
                className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                  isCameraSelected
                    ? "border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500 font-semibold"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <Camera className="h-3.5 w-3.5 text-violet-400" />
                <span className="flex-1">2D Camera</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {doc.camera.zoom.toFixed(1)}x
                </span>
              </button>

              {/* Objects list */}
              <ul className="space-y-1">
                {[...doc.objects]
                  .sort((a, b) => b.layer_order - a.layer_order)
                  .map((obj) => {
                    const isSelected = selectedObjectId === obj.id;
                    return (
                      <li
                        key={obj.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? "border-violet-500 bg-violet-950/30 text-white ring-1 ring-violet-500"
                            : "border-zinc-800/70 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedObjectId(isSelected ? null : obj.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-semibold ${
                              obj.kind === "character"
                                ? "bg-amber-500/20 text-amber-300"
                                : obj.kind === "background"
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {obj.kind.slice(0, 4)}
                          </span>
                          <span className="truncate font-medium">{obj.label}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            applyDocMutation((d) =>
                              updateObjectBase(d, obj.id, { visible: !obj.base.visible }).ok
                                ? (updateObjectBase(d, obj.id, { visible: !obj.base.visible }) as any).doc
                                : d
                            );
                          }}
                          className="text-zinc-500 hover:text-white p-1"
                          title={obj.base.visible ? "Hide object" : "Show object"}
                        >
                          {obj.base.visible ? (
                            <Eye className="h-3 w-3 text-zinc-400" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-zinc-600" />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </aside>

            {/* CENTER: 2D Interactive Animation Canvas */}
            <section
              aria-label="2D Animation Canvas"
              ref={canvasContainerRef}
              className={cn(
                "relative min-w-0 w-full h-full flex items-center justify-center overflow-hidden bg-[#0a0a0e] select-none",
                mobileWorkspaceTab === "canvas" ? "flex h-[520px]" : "hidden lg:flex"
              )}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handleCanvasPointerDown}
                onWheel={handleCanvasWheel}
                onTouchStart={handleCanvasTouchStart}
                onTouchMove={handleCanvasTouchMove}
                onTouchEnd={handleCanvasTouchEnd}
                onTouchCancel={handleCanvasTouchEnd}
                className="w-full h-full cursor-crosshair touch-none"
              />

              {/* Floating Canvas Hint */}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-zinc-400 pointer-events-none">
                Scroll to Zoom • Drag or Touch to Pan
              </div>
            </section>

            {/* RIGHT: Properties & Keyframing Inspector */}
            <aside
              aria-label="Properties inspector"
              className={cn(
                "border-l border-zinc-800/80 p-3 overflow-y-auto space-y-4 text-xs",
                mobileWorkspaceTab === "inspector" ? "block h-[520px]" : "hidden lg:block"
              )}
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-violet-400" />
                  {isCameraSelected
                    ? "Camera Properties"
                    : selectedObject
                    ? `Object: ${selectedObject.label}`
                    : "Scene Settings"}
                </span>
              </div>

              {isCameraSelected ? (
                /* Camera Inspector */
                <div className="space-y-3">
                  <p className="text-[11px] text-zinc-400">
                    Keyframing the 2D Camera enables cinematic zooms, pans, and target tracking.
                  </p>

                  <div className="space-y-2">
                    <label className={labelClass}>Camera Zoom ({doc.camera.zoom.toFixed(2)}x)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.2}
                        max={3.0}
                        step={0.05}
                        value={doc.camera.zoom}
                        className="w-full accent-violet-500"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          applyDocMutation((d) => updateCameraBase(d, { zoom: val }).ok ? (updateCameraBase(d, { zoom: val }) as any).doc : d);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2"
                        onClick={() => handleAddPropertyKeyframe("camera", "camera_zoom", doc.camera.zoom)}
                        title="Key Zoom at playhead"
                      >
                        Key
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Camera Position X ({Math.round(doc.camera.x)})</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={doc.width}
                        value={doc.camera.x}
                        className="w-full accent-violet-500"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          applyDocMutation((d) => updateCameraBase(d, { x: val }).ok ? (updateCameraBase(d, { x: val }) as any).doc : d);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2"
                        onClick={() => handleAddPropertyKeyframe("camera", "camera_x", doc.camera.x)}
                        title="Key Camera X at playhead"
                      >
                        Key
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Camera Position Y ({Math.round(doc.camera.y)})</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={doc.height}
                        value={doc.camera.y}
                        className="w-full accent-violet-500"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          applyDocMutation((d) => updateCameraBase(d, { y: val }).ok ? (updateCameraBase(d, { y: val }) as any).doc : d);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2"
                        onClick={() => handleAddPropertyKeyframe("camera", "camera_y", doc.camera.y)}
                        title="Key Camera Y at playhead"
                      >
                        Key
                      </Button>
                    </div>
                  </div>
                </div>
              ) : selectedObject ? (
                /* Object Inspector */
                <div className="space-y-3">
                  {/* Position X */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={labelClass}>Position X ({Math.round(selectedObject.base.x)}px)</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1 text-violet-400 hover:text-white"
                        onClick={() => handleAddPropertyKeyframe(selectedObject.id, "x", selectedObject.base.x)}
                      >
                        + Key
                      </Button>
                    </div>
                    <input
                      type="range"
                      min={-doc.width * 0.5}
                      max={doc.width * 1.5}
                      value={selectedObject.base.x}
                      className="w-full accent-violet-500"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDocMutation((d) => updateObjectBase(d, selectedObject.id, { x: val }).ok ? (updateObjectBase(d, selectedObject.id, { x: val }) as any).doc : d);
                      }}
                    />
                  </div>

                  {/* Position Y */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={labelClass}>Position Y ({Math.round(selectedObject.base.y)}px)</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1 text-violet-400 hover:text-white"
                        onClick={() => handleAddPropertyKeyframe(selectedObject.id, "y", selectedObject.base.y)}
                      >
                        + Key
                      </Button>
                    </div>
                    <input
                      type="range"
                      min={-doc.height * 0.5}
                      max={doc.height * 1.5}
                      value={selectedObject.base.y}
                      className="w-full accent-violet-500"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDocMutation((d) => updateObjectBase(d, selectedObject.id, { y: val }).ok ? (updateObjectBase(d, selectedObject.id, { y: val }) as any).doc : d);
                      }}
                    />
                  </div>

                  {/* Scale X */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={labelClass}>Scale X ({selectedObject.base.scale_x.toFixed(2)})</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1 text-violet-400 hover:text-white"
                        onClick={() => handleAddPropertyKeyframe(selectedObject.id, "scale_x", selectedObject.base.scale_x)}
                      >
                        + Key
                      </Button>
                    </div>
                    <input
                      type="range"
                      min={-2.0}
                      max={3.0}
                      step={0.05}
                      value={selectedObject.base.scale_x}
                      className="w-full accent-violet-500"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDocMutation((d) => updateObjectBase(d, selectedObject.id, { scale_x: val }).ok ? (updateObjectBase(d, selectedObject.id, { scale_x: val }) as any).doc : d);
                      }}
                    />
                  </div>

                  {/* Rotation */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={labelClass}>Rotation ({Math.round(selectedObject.base.rotation)}°)</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1 text-violet-400 hover:text-white"
                        onClick={() => handleAddPropertyKeyframe(selectedObject.id, "rotation", selectedObject.base.rotation)}
                      >
                        + Key
                      </Button>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={selectedObject.base.rotation}
                      className="w-full accent-violet-500"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDocMutation((d) => updateObjectBase(d, selectedObject.id, { rotation: val }).ok ? (updateObjectBase(d, selectedObject.id, { rotation: val }) as any).doc : d);
                      }}
                    />
                  </div>

                  {/* Opacity */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className={labelClass}>Opacity ({Math.round(selectedObject.base.opacity * 100)}%)</label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1 text-violet-400 hover:text-white"
                        onClick={() => handleAddPropertyKeyframe(selectedObject.id, "opacity", selectedObject.base.opacity)}
                      >
                        + Key
                      </Button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.0}
                      step={0.05}
                      value={selectedObject.base.opacity}
                      className="w-full accent-violet-500"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDocMutation((d) => updateObjectBase(d, selectedObject.id, { opacity: val }).ok ? (updateObjectBase(d, selectedObject.id, { opacity: val }) as any).doc : d);
                      }}
                    />
                  </div>

                  {/* Motion Path trigger */}
                  <div className="pt-2 border-t border-zinc-800">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => {
                        applyDocMutation((d) => {
                          const existingPath = d.motion_paths.find((p) => p.object_id === selectedObject.id);
                          if (existingPath) {
                            return removeMotionPath(d, existingPath.id).ok ? (removeMotionPath(d, existingPath.id) as any).doc : d;
                          }
                          const res = addMotionPath(
                            d,
                            selectedObject.id,
                            { x: selectedObject.base.x, y: selectedObject.base.y },
                            { x: selectedObject.base.x + 300, y: selectedObject.base.y }
                          );
                          return res.ok ? res.doc : d;
                        });
                      }}
                    >
                      <Move className="h-3.5 w-3.5 mr-1 text-amber-400" />
                      {doc.motion_paths.some((p) => p.object_id === selectedObject.id)
                        ? "Remove Motion Path"
                        : "Add Motion Path"}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Scene Animation Settings */
                <div className="space-y-3">
                  <div>
                    <label className={labelClass} htmlFor="anim-duration">
                      Scene Duration (seconds)
                    </label>
                    <input
                      id="anim-duration"
                      type="number"
                      min={1}
                      max={600}
                      step={0.5}
                      className={fieldClass}
                      value={(doc.duration_ms / 1000).toFixed(1)}
                      onChange={(e) => {
                        const durMs = Math.round((Number(e.target.value) || 5) * 1000);
                        applyDocMutation((d) =>
                          updateDocumentSettings(d, { duration_ms: durMs }).ok
                            ? (updateDocumentSettings(d, { duration_ms: durMs }) as any).doc
                            : d
                        );
                      }}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Resolution</label>
                    <p className="text-zinc-400 font-mono text-[11px]">
                      {doc.width} x {doc.height} (16:9 1080p)
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>Animatable Layers</label>
                    <p className="text-zinc-400 text-[11px]">
                      {doc.objects.length} visual layer(s) configured. Select any object to animate properties or add a motion path.
                    </p>
                  </div>
                </div>
              )}
            </aside>
          </div>

          {/* Resizable Divider Splitter */}
          <div
            onPointerDown={(e) => {
              setResizingTimeline(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!resizingTimeline) return;
              const newHeight = Math.max(160, Math.min(600, window.innerHeight - e.clientY));
              setTimelineHeight(newHeight);
            }}
            onPointerUp={(e) => {
              if (resizingTimeline) {
                setResizingTimeline(false);
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              }
            }}
            className="hidden lg:flex h-1.5 bg-zinc-800 hover:bg-violet-600/80 cursor-row-resize transition-colors items-center justify-center group shrink-0"
            title="Drag to resize timeline height"
          >
            <div className="w-12 h-0.5 rounded-full bg-zinc-600 group-hover:bg-white" />
          </div>

          {/* BOTTOM: Keyframe Animation Timeline */}
          <div
            style={{ height: `${timelineHeight}px` }}
            className={cn(
              "min-h-0 shrink-0",
              mobileWorkspaceTab === "timeline" ? "block h-[520px]" : "hidden lg:block"
            )}
          >
            <AnimationTimeline
              doc={doc}
              currentTimeMs={currentTimeMs}
              selectedKeyframes={selectedKeyframes}
              selectedKeyframe={selectedKeyframe}
              selectedClipId={selectedClipId}
              onSeek={seekTime}
              onSelectKeyframes={(refs) => {
                setSelectedKeyframes(refs);
                setSelectedKeyframe(refs.length === 1 ? refs[0] : null);
              }}
              onSelectKeyframe={(ref) => {
                setSelectedKeyframe(ref);
                setSelectedKeyframes(ref ? [ref] : []);
              }}
              onSelectClip={setSelectedClipId}
              onAddKeyframeAtPlayhead={handleAddKeyframeAtPlayhead}
              onUpdateKeyframe={handleUpdateKeyframe}
              onDeleteKeyframes={handleDeleteKeyframes}
              onDeleteKeyframe={handleDeleteKeyframe}
              onMoveKeyframes={handleMoveKeyframes}
              onToggleTrack={(trackId) => {
                applyDocMutation((d) => ({
                  ...d,
                  tracks: d.tracks.map((t) =>
                    t.id === trackId ? { ...t, enabled: !t.enabled } : t
                  ),
                }));
              }}
              onLockTrack={handleLockTrack}
              onMuteTrack={handleMuteTrack}
              onSetTrackColor={handleSetTrackColor}
              onDeleteTrack={(trackId) => {
                applyDocMutation((d) => ({
                  ...d,
                  tracks: d.tracks.filter((t) => t.id !== trackId),
                }));
              }}
              onReorderTracks={handleReorderTracks}
              onAddClip={handleAddClip}
              onMoveClip={handleMoveClip}
              onTrimClip={handleTrimClip}
              onSplitClip={handleSplitClip}
              onDuplicateClip={handleDuplicateClip}
              onDeleteClip={handleDeleteClip}
              onAddMarker={handleAddMarker}
              onUpdateMarker={handleUpdateMarker}
              onDeleteMarker={handleDeleteMarker}
              onCreateGroup={handleCreateGroup}
              onToggleGroupCollapse={handleToggleGroupCollapse}
              onDeleteGroup={handleDeleteGroup}
            />
          </div>

          {/* Conflict Resolution Modal */}
          {conflictError && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-amber-600/60 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-semibold text-base text-white">Concurrent Edit Conflict</h3>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {conflictError.message}
                </p>
                <p className="text-xs text-zinc-400">
                  Another session or tab modified this scene animation document. Choose how you want to resolve the conflict:
                </p>
                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReloadServerVersion}
                    className="text-xs"
                  >
                    Reload Server Version
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleForceOverwrite}
                    className="text-xs bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    Overwrite Server
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts Cheatsheet Modal */}
          {showShortcutModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-violet-400" />
                    Timeline Keyboard Shortcuts
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowShortcutModal(false)}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Play / Pause</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">Space</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Step 1 Frame Back / Forward</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">← / →</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Step 5 Frames Back / Forward</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">Shift + ← / →</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Undo Action</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">Cmd + Z</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Redo Action</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">Cmd + Shift + Z</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Delete Keyframe / Clip</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">Delete / Backspace</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Multi-Select Keyframes</span>
                    <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-200">Shift + Click</kbd>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Trim Clip Edge</span>
                    <span className="text-zinc-300 font-medium">Drag left / right edge handle</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Move Keyframe Group</span>
                    <span className="text-zinc-300 font-medium">Select multiple & drag any KF</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowShortcutModal(false)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white"
                  >
                    Got It
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SceneStudioFrame>
  );
}
