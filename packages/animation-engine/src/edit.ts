/**
 * Pure, immutable editing operations on an AnimationDocument. Every operation re-validates the
 * result, so the UI can never produce an invalid document. No DOM / React dependencies.
 */
import type {
  AnimatableProperty,
  AnimationDocument,
  AnimObject,
  BezierEasing,
  InterpolationMode,
  Keyframe,
  MotionPath,
  PathPoint,
  TimelineClip,
  TimelineMarker,
  Track,
  TrackGroup,
  TrackType,
} from "./schema.ts";
import {
  CAMERA_TARGET,
  isCameraProperty,
  newId,
  TRACK_TYPES,
  validateAnimationDocument,
  validateBezier,
  validateKeyframeValue,
} from "./schema.ts";

export type EditResult<T = object> = ({ ok: true; doc: AnimationDocument } & T) | { ok: false; error: string };

function finish<T extends object>(doc: AnimationDocument, extra: T): EditResult<T> {
  const v = validateAnimationDocument(doc);
  if (!v.ok) return { ok: false, error: `${v.issues[0].path}: ${v.issues[0].message}` };
  return { ok: true, doc: v.document, ...extra };
}

export function findTrack(doc: AnimationDocument, targetId: string, property: AnimatableProperty): Track | undefined {
  return doc.tracks.find((t) => t.target_id === targetId && t.property === property);
}

function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.time_ms - b.time_ms);
}

function replaceTrack(doc: AnimationDocument, track: Track): AnimationDocument {
  return { ...doc, tracks: doc.tracks.map((t) => (t.id === track.id ? track : t)) };
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------
export function addTrack(doc: AnimationDocument, targetId: string, property: AnimatableProperty, metadata: Track["metadata"] = {}): EditResult<{ track: Track }> {
  const existing = findTrack(doc, targetId, property);
  if (existing) return { ok: true, doc, track: existing };
  const track: Track = { id: newId("trk"), target_id: targetId, property, enabled: true, metadata, keyframes: [] };
  const res = finish({ ...doc, tracks: [...doc.tracks, track] }, { track });
  return res;
}

export function removeTrack(doc: AnimationDocument, trackId: string): EditResult {
  if (!doc.tracks.some((t) => t.id === trackId)) return { ok: false, error: "Track not found" };
  return finish({ ...doc, tracks: doc.tracks.filter((t) => t.id !== trackId) }, {});
}

export function setTrackEnabled(doc: AnimationDocument, trackId: string, enabled: boolean): EditResult {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) return { ok: false, error: "Track not found" };
  return finish(replaceTrack(doc, { ...t, enabled }), {});
}

export function setTrackLocked(doc: AnimationDocument, trackId: string, locked: boolean): EditResult {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) return { ok: false, error: "Track not found" };
  return finish(replaceTrack(doc, { ...t, locked }), {});
}

export function setTrackMuted(doc: AnimationDocument, trackId: string, muted: boolean): EditResult {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) return { ok: false, error: "Track not found" };
  return finish(replaceTrack(doc, { ...t, muted }), {});
}

export function setTrackColor(doc: AnimationDocument, trackId: string, color: string | null): EditResult {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) return { ok: false, error: "Track not found" };
  return finish(replaceTrack(doc, { ...t, color }), {});
}

export function setTrackName(doc: AnimationDocument, trackId: string, name: string): EditResult {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) return { ok: false, error: "Track not found" };
  return finish(replaceTrack(doc, { ...t, name }), {});
}

export function setTrackType(doc: AnimationDocument, trackId: string, trackType: TrackType): EditResult {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) return { ok: false, error: "Track not found" };
  if (!TRACK_TYPES.includes(trackType)) return { ok: false, error: "Invalid track type" };
  return finish(replaceTrack(doc, { ...t, track_type: trackType }), {});
}

export function reorderTracks(doc: AnimationDocument, orderedTrackIds: string[]): EditResult {
  const trackMap = new Map(doc.tracks.map((t) => [t.id, t]));
  if (orderedTrackIds.some((id) => !trackMap.has(id))) {
    return { ok: false, error: "One or more track IDs not found in document" };
  }
  const reordered: Track[] = [];
  for (let idx = 0; idx < orderedTrackIds.length; idx++) {
    const tid = orderedTrackIds[idx];
    const t = trackMap.get(tid)!;
    reordered.push({ ...t, order: idx });
    trackMap.delete(tid);
  }
  // append any remaining tracks
  for (const remaining of trackMap.values()) {
    reordered.push(remaining);
  }
  return finish({ ...doc, tracks: reordered }, {});
}

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------
export interface KeyframeInput {
  time_ms: number;
  value: number | boolean;
  interpolation?: InterpolationMode;
  easing?: BezierEasing | null;
}

export function checkKeyframeInput(doc: AnimationDocument, property: string, input: KeyframeInput): string | null {
  if (!Number.isInteger(input.time_ms) || input.time_ms < 0) return "Time must be a non-negative whole number of milliseconds";
  if (input.time_ms > doc.duration_ms) return "Time exceeds the animation duration";
  const msg = validateKeyframeValue(property, input.value);
  if (msg) return msg;
  if ((input.interpolation ?? "linear") === "cubic-bezier") {
    const b = validateBezier(input.easing);
    if (b) return b;
  }
  return null;
}

/** Create a keyframe, or replace the one at the same time. Creates the track when missing. */
export function upsertKeyframe(
  doc: AnimationDocument,
  targetId: string,
  property: AnimatableProperty,
  input: KeyframeInput
): EditResult<{ keyframe: Keyframe; trackId: string }> {
  const err = checkKeyframeInput(doc, property, input);
  if (err) return { ok: false, error: err };
  let working = doc;
  let track = findTrack(working, targetId, property);
  if (!track) {
    const added = addTrack(working, targetId, property);
    if (!added.ok) return added;
    working = added.doc;
    track = added.track;
  }
  const interpolation = typeof input.value === "boolean" ? "hold" : input.interpolation ?? "linear";
  const existing = track.keyframes.find((k) => k.time_ms === input.time_ms);
  const keyframe: Keyframe = {
    id: existing?.id ?? newId("kf"),
    time_ms: input.time_ms,
    value: input.value,
    interpolation,
    ...(interpolation === "cubic-bezier" ? { easing: input.easing ?? null } : {}),
  };
  const kfs = sortKeyframes([...track.keyframes.filter((k) => k.time_ms !== input.time_ms), keyframe]);
  const next = replaceTrack(working, { ...track, keyframes: kfs });
  return finish(next, { keyframe, trackId: track.id });
}

export function updateKeyframe(
  doc: AnimationDocument,
  trackId: string,
  keyframeId: string,
  patch: Partial<Pick<Keyframe, "time_ms" | "value" | "interpolation" | "easing">>
): EditResult {
  const track = doc.tracks.find((t) => t.id === trackId);
  const kf = track?.keyframes.find((k) => k.id === keyframeId);
  if (!track || !kf) return { ok: false, error: "Keyframe not found" };
  const merged: Keyframe = { ...kf, ...patch };
  if (merged.interpolation !== "cubic-bezier") delete merged.easing;
  const err = checkKeyframeInput(doc, track.property, merged);
  if (err) return { ok: false, error: err };
  if (patch.time_ms !== undefined && track.keyframes.some((k) => k.id !== keyframeId && k.time_ms === merged.time_ms)) {
    return { ok: false, error: "Another keyframe already exists at that time" };
  }
  if (typeof merged.value === "boolean") merged.interpolation = "hold";
  const kfs = sortKeyframes(track.keyframes.map((k) => (k.id === keyframeId ? merged : k)));
  return finish(replaceTrack(doc, { ...track, keyframes: kfs }), {});
}

export interface KeyframeRef {
  trackId: string;
  keyframeId: string;
}

export function deleteKeyframes(doc: AnimationDocument, refs: KeyframeRef[]): EditResult {
  const byTrack = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!byTrack.has(r.trackId)) byTrack.set(r.trackId, new Set());
    byTrack.get(r.trackId)!.add(r.keyframeId);
  }
  const tracks = doc.tracks.map((t) => {
    const ids = byTrack.get(t.id);
    return ids ? { ...t, keyframes: t.keyframes.filter((k) => !ids.has(k.id)) } : t;
  });
  return finish({ ...doc, tracks }, {});
}

/** Move keyframes by deltaMs (snapped values are the caller's responsibility). Rejects collisions/out-of-range. */
export function moveKeyframes(doc: AnimationDocument, refs: KeyframeRef[], deltaMs: number): EditResult {
  if (!Number.isInteger(deltaMs)) return { ok: false, error: "Delta must be a whole number of milliseconds" };
  const selected = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!selected.has(r.trackId)) selected.set(r.trackId, new Set());
    selected.get(r.trackId)!.add(r.keyframeId);
  }
  const tracks: Track[] = [];
  for (const t of doc.tracks) {
    const ids = selected.get(t.id);
    if (!ids) {
      tracks.push(t);
      continue;
    }
    const moved = t.keyframes.map((k) => (ids.has(k.id) ? { ...k, time_ms: k.time_ms + deltaMs } : k));
    if (moved.some((k) => k.time_ms < 0 || k.time_ms > doc.duration_ms)) return { ok: false, error: "Keyframes cannot move outside the animation range" };
    const times = new Set<number>();
    for (const k of moved) {
      if (times.has(k.time_ms)) return { ok: false, error: "Move would place two keyframes at the same time" };
      times.add(k.time_ms);
    }
    tracks.push({ ...t, keyframes: sortKeyframes(moved) });
  }
  return finish({ ...doc, tracks }, {});
}

export interface KeyframeClipboard {
  items: {
    target_id: string;
    property: AnimatableProperty;
    offset_ms: number;
    value: number | boolean;
    interpolation: InterpolationMode;
    easing?: BezierEasing | null;
  }[];
}

export function copyKeyframes(doc: AnimationDocument, refs: KeyframeRef[]): KeyframeClipboard | null {
  const items: KeyframeClipboard["items"] = [];
  let min = Infinity;
  const found: { t: Track; k: Keyframe }[] = [];
  for (const r of refs) {
    const t = doc.tracks.find((x) => x.id === r.trackId);
    const k = t?.keyframes.find((x) => x.id === r.keyframeId);
    if (t && k) {
      found.push({ t, k });
      min = Math.min(min, k.time_ms);
    }
  }
  if (found.length === 0) return null;
  for (const { t, k } of found) {
    items.push({ target_id: t.target_id, property: t.property, offset_ms: k.time_ms - min, value: k.value, interpolation: k.interpolation, easing: k.easing });
  }
  return { items };
}

/**
 * Paste clipboard keyframes at `atMs`. When `targetObjectId` is given, object-track items are
 * retargeted to that object (camera items always stay on the camera).
 */
export function pasteKeyframes(doc: AnimationDocument, clip: KeyframeClipboard, atMs: number, targetObjectId?: string): EditResult<{ pasted: number }> {
  let working = doc;
  let pasted = 0;
  for (const item of clip.items) {
    const target = item.target_id === CAMERA_TARGET || isCameraProperty(item.property) ? CAMERA_TARGET : targetObjectId ?? item.target_id;
    const res = upsertKeyframe(working, target, item.property, {
      time_ms: atMs + item.offset_ms,
      value: item.value,
      interpolation: item.interpolation,
      easing: item.easing,
    });
    if (!res.ok) return res;
    working = res.doc;
    pasted += 1;
  }
  return { ok: true, doc: working, pasted };
}

// ---------------------------------------------------------------------------
// Objects, camera, document settings
// ---------------------------------------------------------------------------
export function updateObjectBase(doc: AnimationDocument, objectId: string, patch: Partial<AnimObject["base"]>): EditResult {
  if (!doc.objects.some((o) => o.id === objectId)) return { ok: false, error: "Object not found" };
  return finish({ ...doc, objects: doc.objects.map((o) => (o.id === objectId ? { ...o, base: { ...o.base, ...patch } } : o)) }, {});
}

export function setObjectLabel(doc: AnimationDocument, objectId: string, label: string): EditResult {
  return finish({ ...doc, objects: doc.objects.map((o) => (o.id === objectId ? { ...o, label } : o)) }, {});
}

/** Move an object one step in z-order (-1 = backward, +1 = forward). */
export function moveObjectLayer(doc: AnimationDocument, objectId: string, dir: -1 | 1): EditResult {
  const sorted = [...doc.objects].sort((a, b) => a.layer_order - b.layer_order);
  const i = sorted.findIndex((o) => o.id === objectId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return { ok: false, error: "Cannot move layer further" };
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  const order = new Map(sorted.map((o, idx) => [o.id, idx]));
  return finish({ ...doc, objects: doc.objects.map((o) => ({ ...o, layer_order: order.get(o.id)! })) }, {});
}

export function updateCameraBase(doc: AnimationDocument, patch: Partial<AnimationDocument["camera"]>): EditResult {
  return finish({ ...doc, camera: { ...doc.camera, ...patch } }, {});
}

export function updateDocumentSettings(
  doc: AnimationDocument,
  patch: Partial<Pick<AnimationDocument, "fps" | "duration_ms" | "width" | "height">>
): EditResult {
  const next = { ...doc, ...patch };
  if (patch.duration_ms !== undefined && patch.duration_ms < doc.duration_ms) {
    // Refuse to silently drop animation data.
    const lastKf = Math.max(0, ...doc.tracks.flatMap((t) => t.keyframes.map((k) => k.time_ms)));
    const lastPath = Math.max(0, ...doc.motion_paths.map((p) => p.start_ms + p.duration_ms));
    if (Math.max(lastKf, lastPath) > patch.duration_ms) return { ok: false, error: "Duration is shorter than existing keyframes or motion paths" };
    if (doc.playback.range_end_ms !== null && doc.playback.range_end_ms > patch.duration_ms) {
      next.playback = { ...doc.playback, range_end_ms: null };
    }
  }
  return finish(next, {});
}

export function updatePlaybackSettings(doc: AnimationDocument, patch: Partial<AnimationDocument["playback"]>): EditResult {
  return finish({ ...doc, playback: { ...doc.playback, ...patch } }, {});
}

// ---------------------------------------------------------------------------
// Motion paths
// ---------------------------------------------------------------------------
export function addMotionPath(
  doc: AnimationDocument,
  objectId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  opts: { start_ms?: number; duration_ms?: number; mode?: MotionPath["mode"]; interpolation?: MotionPath["interpolation"] } = {}
): EditResult<{ path: MotionPath }> {
  const startMs = opts.start_ms ?? 0;
  const duration = Math.min(opts.duration_ms ?? 2000, Math.max(1, doc.duration_ms - startMs));
  const path: MotionPath = {
    id: newId("path"),
    object_id: objectId,
    enabled: true,
    start_ms: startMs,
    duration_ms: duration,
    mode: opts.mode ?? "linear",
    points: [
      { id: newId("pt"), x: start.x, y: start.y },
      { id: newId("pt"), x: end.x, y: end.y },
    ],
    interpolation: opts.interpolation ?? "ease-in-out",
    easing: null,
    orient_to_path: false,
    orientation_offset_deg: 0,
  };
  return finish({ ...doc, motion_paths: [...doc.motion_paths, path] }, { path });
}

export function updateMotionPath(doc: AnimationDocument, pathId: string, patch: Partial<Omit<MotionPath, "id">>): EditResult {
  if (!doc.motion_paths.some((p) => p.id === pathId)) return { ok: false, error: "Motion path not found" };
  return finish({ ...doc, motion_paths: doc.motion_paths.map((p) => (p.id === pathId ? { ...p, ...patch } : p)) }, {});
}

export function removeMotionPath(doc: AnimationDocument, pathId: string): EditResult {
  return finish({ ...doc, motion_paths: doc.motion_paths.filter((p) => p.id !== pathId) }, {});
}

export function addPathWaypoint(doc: AnimationDocument, pathId: string, point: { x: number; y: number }, index?: number): EditResult<{ point: PathPoint }> {
  const p = doc.motion_paths.find((x) => x.id === pathId);
  if (!p) return { ok: false, error: "Motion path not found" };
  const np: PathPoint = { id: newId("pt"), x: point.x, y: point.y };
  const at = index === undefined ? p.points.length - 1 : Math.max(0, Math.min(p.points.length, index));
  const points = [...p.points.slice(0, at), np, ...p.points.slice(at)];
  const res = updateMotionPath(doc, pathId, { points });
  return res.ok ? { ok: true, doc: res.doc, point: np } : res;
}

export function movePathWaypoint(doc: AnimationDocument, pathId: string, pointId: string, pos: { x: number; y: number }): EditResult {
  const p = doc.motion_paths.find((x) => x.id === pathId);
  if (!p) return { ok: false, error: "Motion path not found" };
  return updateMotionPath(doc, pathId, { points: p.points.map((pt) => (pt.id === pointId ? { ...pt, ...pos } : pt)) });
}

export function removePathWaypoint(doc: AnimationDocument, pathId: string, pointId: string): EditResult {
  const p = doc.motion_paths.find((x) => x.id === pathId);
  if (!p) return { ok: false, error: "Motion path not found" };
  if (p.points.length <= 2) return { ok: false, error: "A path needs at least two points" };
  return updateMotionPath(doc, pathId, { points: p.points.filter((pt) => pt.id !== pointId) });
}

// ---------------------------------------------------------------------------
// Timeline Clips (Step 7)
// ---------------------------------------------------------------------------
export function addClip(
  doc: AnimationDocument,
  trackId: string,
  name: string,
  startMs: number,
  durationMs: number,
  sourceStartMs = 0,
  color?: string | null,
  audioProps?: Partial<TimelineClip>
): EditResult<{ clip: TimelineClip }> {
  if (!doc.tracks.some((t) => t.id === trackId)) return { ok: false, error: "Track not found" };
  const clip: TimelineClip = {
    id: newId("clp"),
    track_id: trackId,
    name,
    start_ms: Math.max(0, Math.round(startMs)),
    duration_ms: Math.max(1, Math.round(durationMs)),
    source_start_ms: Math.max(0, Math.round(sourceStartMs)),
    color: color ?? null,
    ...(audioProps ?? {}),
  };
  const clips = [...(doc.clips ?? []), clip];
  return finish({ ...doc, clips }, { clip });
}

export function updateClip(
  doc: AnimationDocument,
  clipId: string,
  patch: Partial<Omit<TimelineClip, "id">>
): EditResult<{ clip: TimelineClip }> {
  const current = (doc.clips ?? []).find((c) => c.id === clipId);
  if (!current) return { ok: false, error: "Clip not found" };
  const updated: TimelineClip = { ...current, ...patch };
  const clips = (doc.clips ?? []).map((c) => (c.id === clipId ? updated : c));
  return finish({ ...doc, clips }, { clip: updated });
}

export function moveClip(
  doc: AnimationDocument,
  clipId: string,
  newStartMs: number
): EditResult<{ clip: TimelineClip }> {
  const current = (doc.clips ?? []).find((c) => c.id === clipId);
  if (!current) return { ok: false, error: "Clip not found" };
  const maxStart = Math.max(0, doc.duration_ms - current.duration_ms);
  const start_ms = Math.max(0, Math.min(maxStart, Math.round(newStartMs)));
  return updateClip(doc, clipId, { start_ms });
}

export function trimClip(
  doc: AnimationDocument,
  clipId: string,
  newStartMs: number,
  newDurationMs: number,
  newSourceStartMs?: number
): EditResult<{ clip: TimelineClip }> {
  const current = (doc.clips ?? []).find((c) => c.id === clipId);
  if (!current) return { ok: false, error: "Clip not found" };
  const start_ms = Math.max(0, Math.round(newStartMs));
  const duration_ms = Math.max(1, Math.min(doc.duration_ms - start_ms, Math.round(newDurationMs)));
  const source_start_ms = newSourceStartMs !== undefined ? Math.max(0, Math.round(newSourceStartMs)) : current.source_start_ms;
  return updateClip(doc, clipId, { start_ms, duration_ms, source_start_ms });
}

export function splitClip(
  doc: AnimationDocument,
  clipId: string,
  atMs: number
): EditResult<{ leftClip: TimelineClip; rightClip: TimelineClip }> {
  const current = (doc.clips ?? []).find((c) => c.id === clipId);
  if (!current) return { ok: false, error: "Clip not found" };
  const splitTime = Math.round(atMs);
  if (splitTime <= current.start_ms || splitTime >= current.start_ms + current.duration_ms) {
    return { ok: false, error: "Split point must be strictly inside the clip duration" };
  }
  const leftDuration = splitTime - current.start_ms;
  const rightDuration = current.duration_ms - leftDuration;
  const leftClip: TimelineClip = {
    ...current,
    duration_ms: leftDuration,
  };
  const rightClip: TimelineClip = {
    id: newId("clp"),
    track_id: current.track_id,
    name: `${current.name} (Split)`,
    start_ms: splitTime,
    duration_ms: rightDuration,
    source_start_ms: current.source_start_ms + leftDuration,
    color: current.color,
  };
  const clips = (doc.clips ?? []).map((c) => (c.id === clipId ? leftClip : c)).concat(rightClip);
  const res = finish({ ...doc, clips }, { leftClip, rightClip });
  return res;
}

export function duplicateClip(
  doc: AnimationDocument,
  clipId: string,
  offsetMs = 100
): EditResult<{ clip: TimelineClip }> {
  const current = (doc.clips ?? []).find((c) => c.id === clipId);
  if (!current) return { ok: false, error: "Clip not found" };
  const targetStart = Math.min(
    Math.max(0, doc.duration_ms - current.duration_ms),
    current.start_ms + offsetMs
  );
  const clip: TimelineClip = {
    id: newId("clp"),
    track_id: current.track_id,
    name: `${current.name} (Copy)`,
    start_ms: targetStart,
    duration_ms: current.duration_ms,
    source_start_ms: current.source_start_ms,
    color: current.color,
  };
  const clips = [...(doc.clips ?? []), clip];
  return finish({ ...doc, clips }, { clip });
}

export function deleteClip(doc: AnimationDocument, clipId: string): EditResult {
  if (!(doc.clips ?? []).some((c) => c.id === clipId)) return { ok: false, error: "Clip not found" };
  return finish({ ...doc, clips: (doc.clips ?? []).filter((c) => c.id !== clipId) }, {});
}

export function deleteClips(doc: AnimationDocument, clipIds: string[]): EditResult {
  const toDelete = new Set(clipIds);
  return finish({ ...doc, clips: (doc.clips ?? []).filter((c) => !toDelete.has(c.id)) }, {});
}

export function retargetClip(
  doc: AnimationDocument,
  clipId: string,
  newTrackId: string
): EditResult<{ clip: TimelineClip }> {
  const current = (doc.clips ?? []).find((c) => c.id === clipId);
  if (!current) return { ok: false, error: "Clip not found" };
  if (!doc.tracks.some((t) => t.id === newTrackId)) return { ok: false, error: "Target track not found" };
  return updateClip(doc, clipId, { track_id: newTrackId });
}

// ---------------------------------------------------------------------------
// Timeline Markers (Step 7)
// ---------------------------------------------------------------------------
export function addMarker(
  doc: AnimationDocument,
  name: string,
  timeMs: number,
  color = "#6366f1",
  description?: string | null,
  eventType?: string | null
): EditResult<{ marker: TimelineMarker }> {
  const time = Math.max(0, Math.min(doc.duration_ms, Math.round(timeMs)));
  const marker: TimelineMarker = {
    id: newId("mrk"),
    name: name.trim() || "Marker",
    time_ms: time,
    color,
    description: description ?? null,
    event_type: eventType ?? null,
  };
  const markers = [...(doc.markers ?? []), marker].sort((a, b) => a.time_ms - b.time_ms);
  return finish({ ...doc, markers }, { marker });
}

export function updateMarker(
  doc: AnimationDocument,
  markerId: string,
  patch: Partial<Omit<TimelineMarker, "id">>
): EditResult<{ marker: TimelineMarker }> {
  const current = (doc.markers ?? []).find((m) => m.id === markerId);
  if (!current) return { ok: false, error: "Marker not found" };
  const updated: TimelineMarker = {
    ...current,
    ...patch,
    ...(patch.time_ms !== undefined ? { time_ms: Math.max(0, Math.min(doc.duration_ms, Math.round(patch.time_ms))) } : {}),
  };
  const markers = (doc.markers ?? []).map((m) => (m.id === markerId ? updated : m)).sort((a, b) => a.time_ms - b.time_ms);
  return finish({ ...doc, markers }, { marker: updated });
}

export function moveMarker(
  doc: AnimationDocument,
  markerId: string,
  newTimeMs: number
): EditResult<{ marker: TimelineMarker }> {
  return updateMarker(doc, markerId, { time_ms: newTimeMs });
}

export function deleteMarker(doc: AnimationDocument, markerId: string): EditResult {
  if (!(doc.markers ?? []).some((m) => m.id === markerId)) return { ok: false, error: "Marker not found" };
  return finish({ ...doc, markers: (doc.markers ?? []).filter((m) => m.id !== markerId) }, {});
}

// ---------------------------------------------------------------------------
// Track Groups (Step 7)
// ---------------------------------------------------------------------------
export function createTrackGroup(
  doc: AnimationDocument,
  name: string,
  trackIds: string[] = [],
  color = "#3b82f6"
): EditResult<{ group: TrackGroup }> {
  const trackSet = new Set(doc.tracks.map((t) => t.id));
  for (const tid of trackIds) {
    if (!trackSet.has(tid)) return { ok: false, error: `Track '${tid}' not found in document` };
  }
  const group: TrackGroup = {
    id: newId("grp"),
    name: name.trim() || "Track Group",
    color,
    collapsed: false,
    track_ids: [...new Set(trackIds)],
  };
  const groups = [...(doc.groups ?? []), group];
  return finish({ ...doc, groups }, { group });
}

export function updateTrackGroup(
  doc: AnimationDocument,
  groupId: string,
  patch: Partial<Omit<TrackGroup, "id">>
): EditResult<{ group: TrackGroup }> {
  const current = (doc.groups ?? []).find((g) => g.id === groupId);
  if (!current) return { ok: false, error: "Group not found" };
  if (patch.track_ids) {
    const trackSet = new Set(doc.tracks.map((t) => t.id));
    for (const tid of patch.track_ids) {
      if (!trackSet.has(tid)) return { ok: false, error: `Track '${tid}' not found in document` };
    }
  }
  const updated: TrackGroup = { ...current, ...patch };
  const groups = (doc.groups ?? []).map((g) => (g.id === groupId ? updated : g));
  return finish({ ...doc, groups }, { group: updated });
}

export function deleteTrackGroup(doc: AnimationDocument, groupId: string): EditResult {
  if (!(doc.groups ?? []).some((g) => g.id === groupId)) return { ok: false, error: "Group not found" };
  return finish({ ...doc, groups: (doc.groups ?? []).filter((g) => g.id !== groupId) }, {});
}

export function addTrackToGroup(
  doc: AnimationDocument,
  groupId: string,
  trackId: string
): EditResult<{ group: TrackGroup }> {
  const group = (doc.groups ?? []).find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "Group not found" };
  if (!doc.tracks.some((t) => t.id === trackId)) return { ok: false, error: "Track not found" };
  if (group.track_ids.includes(trackId)) return { ok: true, doc, group };
  return updateTrackGroup(doc, groupId, { track_ids: [...group.track_ids, trackId] });
}

export function removeTrackFromGroup(
  doc: AnimationDocument,
  groupId: string,
  trackId: string
): EditResult<{ group: TrackGroup }> {
  const group = (doc.groups ?? []).find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "Group not found" };
  return updateTrackGroup(doc, groupId, { track_ids: group.track_ids.filter((id) => id !== trackId) });
}

export function toggleGroupCollapse(
  doc: AnimationDocument,
  groupId: string
): EditResult<{ group: TrackGroup }> {
  const group = (doc.groups ?? []).find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "Group not found" };
  return updateTrackGroup(doc, groupId, { collapsed: !group.collapsed });
}

// ---------------------------------------------------------------------------
// Multi-Keyframe Group Operations & Alignment (Step 7)
// ---------------------------------------------------------------------------
export function moveKeyframeGroup(
  doc: AnimationDocument,
  refs: KeyframeRef[],
  deltaMs: number
): EditResult {
  return moveKeyframes(doc, refs, deltaMs);
}

export function alignKeyframes(
  doc: AnimationDocument,
  refs: KeyframeRef[],
  targetTimeMs: number
): EditResult {
  const time = Math.max(0, Math.min(doc.duration_ms, Math.round(targetTimeMs)));
  const tracksSeen = new Set<string>();
  for (const r of refs) {
    if (tracksSeen.has(r.trackId)) {
      return { ok: false, error: "Cannot align multiple keyframes from the same track to the same timestamp" };
    }
    tracksSeen.add(r.trackId);
  }
  let working = doc;
  for (const r of refs) {
    const res = updateKeyframe(working, r.trackId, r.keyframeId, { time_ms: time });
    if (!res.ok) return res;
    working = res.doc;
  }
  return { ok: true, doc: working };
}

export function scaleKeyframesTime(
  doc: AnimationDocument,
  refs: KeyframeRef[],
  originTimeMs: number,
  scaleFactor: number
): EditResult {
  if (scaleFactor <= 0) return { ok: false, error: "Scale factor must be positive" };
  let working = doc;
  for (const r of refs) {
    const t = working.tracks.find((x) => x.id === r.trackId);
    const k = t?.keyframes.find((x) => x.id === r.keyframeId);
    if (!t || !k) return { ok: false, error: "Keyframe not found" };
    const scaledTime = Math.round(originTimeMs + (k.time_ms - originTimeMs) * scaleFactor);
    if (scaledTime < 0 || scaledTime > working.duration_ms) {
      return { ok: false, error: "Scaled keyframes would fall outside animation duration" };
    }
  }
  for (const r of refs) {
    const t = working.tracks.find((x) => x.id === r.trackId);
    const k = t?.keyframes.find((x) => x.id === r.keyframeId)!;
    const scaledTime = Math.round(originTimeMs + (k.time_ms - originTimeMs) * scaleFactor);
    const res = updateKeyframe(working, r.trackId, r.keyframeId, { time_ms: scaledTime });
    if (!res.ok) return res;
    working = res.doc;
  }
  return { ok: true, doc: working };
}

// ---------------------------------------------------------------------------
// Snapping System (Step 7)
// ---------------------------------------------------------------------------
export type SnapTargetType = "frame" | "keyframe" | "clip" | "marker" | "playhead";

export interface SnapTarget {
  timeMs: number;
  type: SnapTargetType;
  label?: string;
}

export interface CollectSnapOptions {
  fps: number;
  playheadMs?: number;
  includeKeyframes?: boolean;
  includeClips?: boolean;
  includeMarkers?: boolean;
  excludeKeyframeRefs?: KeyframeRef[];
}

export function collectSnapTargets(
  doc: AnimationDocument,
  options: CollectSnapOptions
): SnapTarget[] {
  const targets: SnapTarget[] = [];
  const added = new Set<string>();

  const add = (timeMs: number, type: SnapTargetType, label?: string) => {
    const key = `${timeMs}:${type}`;
    if (!added.has(key)) {
      added.add(key);
      targets.push({ timeMs, type, label });
    }
  };

  // 1. Frame boundaries
  const frameIntervalMs = 1000 / options.fps;
  for (let t = 0; t <= doc.duration_ms; t += frameIntervalMs) {
    add(Math.round(t), "frame", `Frame @ ${Math.round(t)}ms`);
  }

  // 2. Playhead
  if (options.playheadMs !== undefined) {
    add(Math.round(options.playheadMs), "playhead", "Playhead");
  }

  // 3. Markers
  if (options.includeMarkers !== false && doc.markers) {
    for (const m of doc.markers) {
      add(m.time_ms, "marker", m.name);
    }
  }

  // 4. Clips boundaries
  if (options.includeClips !== false && doc.clips) {
    for (const c of doc.clips) {
      add(c.start_ms, "clip", `${c.name} (Start)`);
      add(c.start_ms + c.duration_ms, "clip", `${c.name} (End)`);
    }
  }

  // 5. Keyframes
  if (options.includeKeyframes !== false) {
    const excluded = new Set(
      (options.excludeKeyframeRefs ?? []).map((r) => `${r.trackId}:${r.keyframeId}`)
    );
    for (const t of doc.tracks) {
      for (const k of t.keyframes) {
        if (!excluded.has(`${t.id}:${k.id}`)) {
          add(k.time_ms, "keyframe", `${t.property} @ ${k.time_ms}ms`);
        }
      }
    }
  }

  return targets;
}

export function findSnapTarget(
  timeMs: number,
  targets: SnapTarget[],
  thresholdMs = 50
): { snappedTimeMs: number; snappedTarget: SnapTarget | null } {
  let closest: SnapTarget | null = null;
  let minDiff = Infinity;
  const priority: Record<SnapTargetType, number> = {
    playhead: 5,
    marker: 4,
    keyframe: 3,
    clip: 2,
    frame: 1,
  };

  for (const target of targets) {
    const diff = Math.abs(target.timeMs - timeMs);
    if (diff <= thresholdMs) {
      if (
        diff < minDiff ||
        (diff === minDiff && closest && priority[target.type] > priority[closest.type])
      ) {
        minDiff = diff;
        closest = target;
      }
    }
  }

  return {
    snappedTimeMs: closest ? closest.timeMs : timeMs,
    snappedTarget: closest,
  };
}

// ---------------------------------------------------------------------------
// Timeline History (Undo / Redo Stack) (Step 7)
// ---------------------------------------------------------------------------
export class TimelineHistory<T> {
  private _past: T[] = [];
  private _present: T;
  private _future: T[] = [];
  private _maxDepth: number;

  constructor(initial: T, maxDepth = 50) {
    this._present = initial;
    this._maxDepth = maxDepth;
  }

  get current(): T {
    return this._present;
  }

  get canUndo(): boolean {
    return this._past.length > 0;
  }

  get canRedo(): boolean {
    return this._future.length > 0;
  }

  push(next: T): void {
    this._past.push(this._present);
    if (this._past.length > this._maxDepth) {
      this._past.shift();
    }
    this._present = next;
    this._future = [];
  }

  undo(): T | null {
    if (this._past.length === 0) return null;
    const previous = this._past.pop()!;
    this._future.unshift(this._present);
    this._present = previous;
    return this._present;
  }

  redo(): T | null {
    if (this._future.length === 0) return null;
    const next = this._future.shift()!;
    this._past.push(this._present);
    this._present = next;
    return this._present;
  }

  clear(resetState?: T): void {
    if (resetState !== undefined) {
      this._present = resetState;
    }
    this._past = [];
    this._future = [];
  }
}
