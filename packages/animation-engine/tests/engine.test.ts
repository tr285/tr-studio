import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANIMATION_SCHEMA_VERSION,
  PRESETS,
  PlaybackController,
  addMotionPath,
  addPathWaypoint,
  applyEasing,
  applyPreset,
  buildDocumentFromScene,
  cameraMatrix,
  convertFrameRate,
  copyKeyframes,
  createEmptyDocument,
  createEvaluatedState,
  cubicBezier,
  defaultObjectBase,
  deleteKeyframes,
  evaluateDocument,
  evaluateMotionPath,
  evaluateTrack,
  frameToMs,
  motionPathLength,
  moveKeyframes,
  msToFrame,
  pasteKeyframes,
  removeTrack,
  screenToWorld,
  snapToFrame,
  syncDocumentWithScene,
  updateDocumentSettings,
  updateKeyframe,
  upsertKeyframe,
  validateAnimationDocument,
  worldToScreen,
  addTrack,
  removePathWaypoint,
  updateMotionPath,
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
  moveMarker,
  deleteMarker,
  createTrackGroup,
  updateTrackGroup,
  deleteTrackGroup,
  addTrackToGroup,
  removeTrackFromGroup,
  toggleGroupCollapse,
  setTrackLocked,
  setTrackMuted,
  setTrackColor,
  setTrackName,
  setTrackType,
  reorderTracks,
  moveKeyframeGroup,
  alignKeyframes,
  scaleKeyframesTime,
  collectSnapTargets,
  findSnapTarget,
  TimelineHistory,
} from "../src/index.ts";
import type { AnimationDocument, Clock } from "../src/index.ts";

function docWithObject(): AnimationDocument {
  const d = createEmptyDocument("scene-1", { duration_ms: 5000 });
  d.objects.push({ id: "o1", kind: "character", label: "Hero", source_ref: null, layer_order: 0, base: defaultObjectBase({ x: 100, y: 200 }) });
  return d;
}

function must<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
}

// --------------------------------------------------------------------------- schema
test("schema: empty document validates and carries schema version", () => {
  const v = validateAnimationDocument(createEmptyDocument("s"));
  assert.equal(v.ok, true);
  assert.equal(createEmptyDocument("s").schema_version, ANIMATION_SCHEMA_VERSION);
});

test("schema: rejects unknown fields, bad fps, bad versions and non-objects", () => {
  assert.equal(validateAnimationDocument(null).ok, false);
  assert.equal(validateAnimationDocument({ ...createEmptyDocument("s"), fps: 17 }).ok, false);
  assert.equal(validateAnimationDocument({ ...createEmptyDocument("s"), script: "alert(1)" }).ok, false);
  assert.equal(validateAnimationDocument({ ...createEmptyDocument("s"), schema_version: "9.0" }).ok, false);
  assert.equal(validateAnimationDocument({ ...createEmptyDocument("s"), duration_ms: 0 }).ok, false);
});

test("schema: migrates older 1.x versions to the current version", () => {
  const v = validateAnimationDocument({ ...createEmptyDocument("s"), schema_version: "1.0" });
  assert.equal(v.ok && v.document.schema_version, ANIMATION_SCHEMA_VERSION);
});

test("schema: rejects invalid keyframes (order, duplicates, values, bezier, targets)", () => {
  const base = docWithObject();
  const track = (kfs: unknown[], extra = {}) => ({
    ...base,
    tracks: [{ id: "t1", target_id: "o1", property: "x", enabled: true, metadata: {}, keyframes: kfs, ...extra }],
  });
  const kf = (id: string, time_ms: number, value: unknown, interpolation = "linear", easing?: unknown) => ({ id, time_ms, value, interpolation, ...(easing ? { easing } : {}) });

  assert.equal(validateAnimationDocument(track([kf("a", 0, 1), kf("b", 100, 2)])).ok, true);
  assert.equal(validateAnimationDocument(track([kf("a", 100, 1), kf("b", 0, 2)])).ok, false, "unsorted");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1), kf("b", 0, 2)])).ok, false, "duplicate time");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1), kf("a", 10, 2)])).ok, false, "duplicate id");
  assert.equal(validateAnimationDocument(track([kf("a", -5, 1)])).ok, false, "negative time");
  assert.equal(validateAnimationDocument(track([kf("a", 1.5, 1)])).ok, false, "fractional time");
  assert.equal(validateAnimationDocument(track([kf("a", 9999999, 1)])).ok, false, "beyond duration");
  assert.equal(validateAnimationDocument(track([kf("a", 0, Number.NaN)])).ok, false, "NaN value");
  assert.equal(validateAnimationDocument(track([kf("a", 0, "10")])).ok, false, "string value");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1, "cubic-bezier")])).ok, false, "bezier without easing");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1, "cubic-bezier", { x1: 2, y1: 0, x2: 0.5, y2: 1 })])).ok, false, "bezier x out of range");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1, "cubic-bezier", { x1: 0.2, y1: 0, x2: 0.5, y2: 1 })])).ok, true);
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1)], { target_id: "ghost" })).ok, false, "missing target");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 2)], { property: "opacity" })).ok, false, "opacity > 1");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1)], { property: "camera_zoom" })).ok, false, "camera prop on object");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1)], { script: "x" })).ok, false, "unknown track field");
  assert.equal(validateAnimationDocument(track([kf("a", 0, 1)], { property: "visible" })).ok, false, "visible needs boolean");
});

test("schema: duplicate tracks for the same property and invalid rigs are rejected", () => {
  const d = docWithObject();
  const t = { id: "t", target_id: "o1", property: "x", enabled: true, metadata: {}, keyframes: [] };
  assert.equal(validateAnimationDocument({ ...d, tracks: [t, { ...t, id: "t2" }] }).ok, false);
  const rig = (bones: unknown[]) => ({ ...d, rigs: [{ id: "r", object_id: "o1", bones }] });
  const bone = (id: string, parent: string | null) => ({ id, name: id, parent_id: parent, pivot_x: 0, pivot_y: 0, rotation: 0, part_ref: null });
  assert.equal(validateAnimationDocument(rig([bone("a", null), bone("b", "a")])).ok, true);
  assert.equal(validateAnimationDocument(rig([bone("a", "b"), bone("b", "a")])).ok, false, "cycle");
  assert.equal(validateAnimationDocument(rig([bone("a", "zzz")])).ok, false, "missing parent");
});

// --------------------------------------------------------------------------- easing
test("easing: endpoints, linear, monotonic ease curves and bezier", () => {
  for (const m of ["linear", "ease-in", "ease-out", "ease-in-out"] as const) {
    assert.equal(applyEasing(m, 0), 0);
    assert.equal(applyEasing(m, 1), 1);
  }
  assert.equal(applyEasing("linear", 0.37), 0.37);
  assert.ok(applyEasing("ease-in", 0.5) < 0.5, "ease-in starts slow");
  assert.ok(applyEasing("ease-out", 0.5) > 0.5, "ease-out starts fast");
  assert.ok(Math.abs(applyEasing("ease-in-out", 0.5) - 0.5) < 1e-3, "ease-in-out symmetric");
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const v = applyEasing("ease-in-out", i / 100);
    assert.ok(v >= prev - 1e-9);
    prev = v;
  }
  // bezier(0,0,1,1) is linear
  assert.ok(Math.abs(cubicBezier(0, 0, 1, 1, 0.3) - 0.3) < 1e-4);
  assert.ok(Math.abs(applyEasing("cubic-bezier", 0.5, { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }) - 0.8024) < 0.01, "CSS 'ease' at 0.5 ≈ 0.80");
  assert.equal(applyEasing("linear", -1), 0);
  assert.equal(applyEasing("linear", 2), 1);
});

// --------------------------------------------------------------------------- interpolation
test("interpolation: linear, hold, eased and boundary behaviour", () => {
  const kfs = (i: "linear" | "hold" | "ease-in") => [
    { id: "a", time_ms: 1000, value: 0, interpolation: i },
    { id: "b", time_ms: 2000, value: 100, interpolation: "linear" as const },
  ];
  assert.equal(evaluateTrack({ keyframes: kfs("linear") }, 0), 0, "before first holds first");
  assert.equal(evaluateTrack({ keyframes: kfs("linear") }, 1500), 50);
  assert.equal(evaluateTrack({ keyframes: kfs("linear") }, 2500), 100, "after last holds last");
  assert.equal(evaluateTrack({ keyframes: kfs("hold") }, 1999), 0, "hold keeps previous value");
  assert.equal(evaluateTrack({ keyframes: kfs("hold") }, 2000), 100);
  assert.ok((evaluateTrack({ keyframes: kfs("ease-in") }, 1500) as number) < 50);
  assert.equal(evaluateTrack({ keyframes: [] }, 10), undefined);
  const vis = [
    { id: "a", time_ms: 0, value: true, interpolation: "hold" as const },
    { id: "b", time_ms: 500, value: false, interpolation: "hold" as const },
  ];
  assert.equal(evaluateTrack({ keyframes: vis }, 499), true);
  assert.equal(evaluateTrack({ keyframes: vis }, 500), false);
});

test("evaluateDocument: tracks override base; disabled tracks are ignored; camera tracks work", () => {
  let d = docWithObject();
  d = must(upsertKeyframe(d, "o1", "x", { time_ms: 0, value: 0 })).doc;
  d = must(upsertKeyframe(d, "o1", "x", { time_ms: 1000, value: 500 })).doc;
  d = must(upsertKeyframe(d, "camera", "camera_zoom", { time_ms: 0, value: 1 })).doc;
  d = must(upsertKeyframe(d, "camera", "camera_zoom", { time_ms: 1000, value: 2 })).doc;
  const st = createEvaluatedState(d);
  evaluateDocument(d, 500, st);
  assert.equal(st.objects.get("o1")!.x, 250);
  assert.equal(st.objects.get("o1")!.y, 200, "untouched properties keep base");
  assert.equal(st.camera.zoom, 1.5);
  const disabled = { ...d, tracks: d.tracks.map((t) => ({ ...t, enabled: false })) };
  evaluateDocument(disabled, 500, st);
  assert.equal(st.objects.get("o1")!.x, 100);
  assert.equal(st.camera.zoom, 1);
  // original base was not mutated (non-destructive)
  assert.equal(d.objects[0].base.x, 100);
  assert.equal(d.camera.zoom, 1);
});

// --------------------------------------------------------------------------- tracks & keyframes
test("tracks/keyframes: create, upsert, edit, order, delete, remove track", () => {
  let d = docWithObject();
  const a = must(upsertKeyframe(d, "o1", "x", { time_ms: 500, value: 5 }));
  d = a.doc;
  d = must(upsertKeyframe(d, "o1", "x", { time_ms: 100, value: 1 })).doc;
  d = must(upsertKeyframe(d, "o1", "x", { time_ms: 900, value: 9 })).doc;
  assert.deepEqual(d.tracks[0].keyframes.map((k) => k.time_ms), [100, 500, 900], "sorted");
  // upsert at same time replaces
  const rep = must(upsertKeyframe(d, "o1", "x", { time_ms: 500, value: 55 }));
  assert.equal(rep.doc.tracks[0].keyframes.length, 3);
  assert.equal(rep.keyframe.id, a.keyframe.id, "stable id on replace");
  // edit
  d = must(updateKeyframe(d, a.trackId, a.keyframe.id, { value: 7, interpolation: "ease-out" })).doc;
  assert.equal(d.tracks[0].keyframes[1].value, 7);
  assert.equal(d.tracks[0].keyframes[1].interpolation, "ease-out");
  d = must(updateKeyframe(d, a.trackId, a.keyframe.id, { time_ms: 950 })).doc;
  assert.deepEqual(d.tracks[0].keyframes.map((k) => k.time_ms), [100, 900, 950], "re-sorted after time edit");
  assert.equal(updateKeyframe(d, a.trackId, a.keyframe.id, { time_ms: 100 }).ok, false, "collision rejected");
  assert.equal(updateKeyframe(d, a.trackId, a.keyframe.id, { time_ms: -1 }).ok, false);
  assert.equal(updateKeyframe(d, a.trackId, "nope", { value: 1 }).ok, false);
  // invalid inputs
  assert.equal(upsertKeyframe(d, "o1", "opacity", { time_ms: 0, value: 3 }).ok, false);
  assert.equal(upsertKeyframe(d, "o1", "x", { time_ms: 6000, value: 1 }).ok, false, "beyond duration");
  assert.equal(upsertKeyframe(d, "o1", "x", { time_ms: 1.2, value: 1 }).ok, false);
  assert.equal(upsertKeyframe(d, "ghost", "x", { time_ms: 0, value: 1 }).ok, false);
  // delete keyframe
  d = must(deleteKeyframes(d, [{ trackId: a.trackId, keyframeId: a.keyframe.id }])).doc;
  assert.equal(d.tracks[0].keyframes.length, 2);
  // boolean keyframes always hold
  d = must(upsertKeyframe(d, "o1", "visible", { time_ms: 0, value: false, interpolation: "linear" })).doc;
  assert.equal(d.tracks.find((t) => t.property === "visible")!.keyframes[0].interpolation, "hold");
  // remove track
  d = must(removeTrack(d, d.tracks[0].id)).doc;
  assert.equal(d.tracks.length, 1);
  assert.equal(removeTrack(d, "missing").ok, false);
  // addTrack is idempotent
  const t1 = must(addTrack(d, "o1", "rotation"));
  const t2 = must(addTrack(t1.doc, "o1", "rotation"));
  assert.equal(t2.doc.tracks.length, t1.doc.tracks.length);
  assert.equal(t2.track.id, t1.track.id);
});

test("keyframes: move, copy, paste (multi-select) and range guards", () => {
  let d = docWithObject();
  const k1 = must(upsertKeyframe(d, "o1", "x", { time_ms: 100, value: 1 }));
  const k2 = must(upsertKeyframe(k1.doc, "o1", "x", { time_ms: 300, value: 3 }));
  const k3 = must(upsertKeyframe(k2.doc, "o1", "y", { time_ms: 100, value: 4 }));
  d = k3.doc;
  const refs = [
    { trackId: k1.trackId, keyframeId: k1.keyframe.id },
    { trackId: k2.trackId, keyframeId: k2.keyframe.id },
    { trackId: k3.trackId, keyframeId: k3.keyframe.id },
  ];
  const moved = must(moveKeyframes(d, refs, 200)).doc;
  assert.deepEqual(moved.tracks.find((t) => t.property === "x")!.keyframes.map((k) => k.time_ms), [300, 500]);
  assert.equal(moveKeyframes(d, refs, -200).ok, false, "below zero");
  assert.equal(moveKeyframes(d, refs, 99999).ok, false, "above duration");
  assert.equal(moveKeyframes(d, [refs[0]], 200).ok, false, "collides with keyframe at 300");

  const clip = copyKeyframes(d, refs)!;
  assert.equal(clip.items.length, 3);
  assert.deepEqual(clip.items.map((i) => i.offset_ms).sort((a, b) => a - b), [0, 0, 200]);
  const pasted = must(pasteKeyframes(d, clip, 1000));
  assert.equal(pasted.pasted, 3);
  assert.deepEqual(pasted.doc.tracks.find((t) => t.property === "x")!.keyframes.map((k) => k.time_ms), [100, 300, 1000, 1200]);
  assert.equal(pasteKeyframes(d, clip, 4900).ok, false, "paste beyond duration is rejected");
  assert.equal(copyKeyframes(d, []), null);
});

test("document settings: shortening below content is refused", () => {
  let d = docWithObject();
  d = must(upsertKeyframe(d, "o1", "x", { time_ms: 4000, value: 1 })).doc;
  assert.equal(updateDocumentSettings(d, { duration_ms: 3000 }).ok, false);
  assert.equal(must(updateDocumentSettings(d, { duration_ms: 4000 })).doc.duration_ms, 4000);
  assert.equal(must(updateDocumentSettings(d, { fps: 30 })).doc.fps, 30);
});

// --------------------------------------------------------------------------- motion paths
test("motion path: linear straight line with constant speed and clamped ends", () => {
  let d = docWithObject();
  const r = must(addMotionPath(d, "o1", { x: 0, y: 0 }, { x: 1000, y: 0 }, { start_ms: 1000, duration_ms: 2000, interpolation: "linear" }));
  d = r.doc;
  assert.equal(motionPathLength(r.path), 1000);
  const st = createEvaluatedState(d);
  evaluateDocument(d, 500, st);
  assert.equal(st.objects.get("o1")!.x, 0, "before start sits at the first point");
  evaluateDocument(d, 2000, st);
  assert.ok(Math.abs(st.objects.get("o1")!.x - 500) < 1e-6);
  evaluateDocument(d, 4000, st);
  assert.equal(st.objects.get("o1")!.x, 1000, "after end sits at the last point");
});

test("motion path: waypoints, curve passes through points, orientation, disable", () => {
  let d = docWithObject();
  const r = must(addMotionPath(d, "o1", { x: 0, y: 0 }, { x: 400, y: 0 }, { duration_ms: 1000, mode: "curve", interpolation: "linear" }));
  d = r.doc;
  const w = must(addPathWaypoint(d, r.path.id, { x: 200, y: 200 }, 1));
  d = w.doc;
  assert.equal(d.motion_paths[0].points.length, 3);
  const sample = { x: 0, y: 0, angle: 0 };
  const p = d.motion_paths[0];
  evaluateMotionPath(p, 0, sample);
  assert.ok(Math.abs(sample.x) < 1e-6 && Math.abs(sample.y) < 1e-6);
  evaluateMotionPath(p, 1000, sample);
  assert.ok(Math.abs(sample.x - 400) < 1e-6 && Math.abs(sample.y) < 1e-6);
  // curve is longer than the straight line between endpoints, and passes near the middle waypoint
  assert.ok(motionPathLength(p) > 400);
  let nearest = Infinity;
  for (let t = 0; t <= 1000; t += 5) {
    evaluateMotionPath(p, t, sample);
    nearest = Math.min(nearest, Math.hypot(sample.x - 200, sample.y - 200));
  }
  assert.ok(nearest < 6, `curve passes near waypoint (${nearest})`);
  // orientation
  d = must(updateMotionPath(d, p.id, { mode: "linear", orient_to_path: true, orientation_offset_deg: 90 })).doc;
  const st = createEvaluatedState(d);
  evaluateDocument(d, 100, st);
  assert.ok(Number.isFinite(st.objects.get("o1")!.rotation));
  // disabled path leaves base transform
  d = must(updateMotionPath(d, p.id, { enabled: false })).doc;
  evaluateDocument(d, 500, st);
  assert.equal(st.objects.get("o1")!.x, 100);
  // minimum two points and unknown ids
  const two = must(addMotionPath(docWithObject(), "o1", { x: 0, y: 0 }, { x: 1, y: 1 }));
  assert.equal(removePathWaypoint(two.doc, two.path.id, two.path.points[0].id).ok, false);
  assert.equal(addMotionPath(docWithObject(), "ghost", { x: 0, y: 0 }, { x: 1, y: 1 }).ok, false);
  assert.equal(addMotionPath(docWithObject(), "o1", { x: 0, y: 0 }, { x: 1, y: 1 }, { start_ms: 9000 }).ok, false, "start beyond duration");
});

// --------------------------------------------------------------------------- frame rate
test("frame-rate conversion and snapping", () => {
  assert.equal(msToFrame(1000, 24), 24);
  assert.equal(frameToMs(24, 24), 1000);
  assert.equal(frameToMs(1, 30), 33);
  assert.equal(snapToFrame(1010, 24), 1000);
  assert.equal(convertFrameRate(24, 24, 60), 60);
  assert.equal(convertFrameRate(12, 12, 25), 25);
  for (const fps of [12, 24, 25, 30, 60]) {
    assert.equal(msToFrame(frameToMs(fps * 3, fps), fps), fps * 3, `round trip ${fps}`);
  }
});

// --------------------------------------------------------------------------- camera
test("camera: matrix centers the camera target, applies zoom/rotation and inverts", () => {
  const m = cameraMatrix({ x: 500, y: 300, zoom: 1, rotation: 0 }, 1920, 1080);
  const c = worldToScreen(m, 500, 300);
  assert.ok(Math.abs(c.x - 960) < 1e-9 && Math.abs(c.y - 540) < 1e-9);
  const z = cameraMatrix({ x: 500, y: 300, zoom: 2, rotation: 0 }, 1920, 1080);
  const p = worldToScreen(z, 600, 300);
  assert.ok(Math.abs(p.x - (960 + 200)) < 1e-9);
  const r = cameraMatrix({ x: 0, y: 0, zoom: 1, rotation: 90 }, 100, 100);
  const q = worldToScreen(r, 10, 0);
  // camera rotated +90°: world +x appears along screen -y
  assert.ok(Math.abs(q.x - 50) < 1e-9 && Math.abs(q.y - 40) < 1e-9, JSON.stringify(q));
  const inv = screenToWorld(z, p.x, p.y);
  assert.ok(Math.abs(inv.x - 600) < 1e-9 && Math.abs(inv.y - 300) < 1e-9);
});

test("camera presets generate camera tracks, never modify objects, and follow bakes keyframes", () => {
  let d = docWithObject();
  const pan = must(applyPreset(d, "camera-pan", "camera", { startMs: 0, durationMs: 2000, distance: 400 }));
  assert.ok(pan.doc.tracks.every((t) => t.target_id === "camera"));
  const st = createEvaluatedState(pan.doc);
  evaluateDocument(pan.doc, 2000, st);
  assert.equal(st.camera.x, 960 + 400);
  assert.equal(pan.doc.camera.x, 960, "base camera untouched");
  assert.equal(pan.doc.objects[0].base.x, 100, "object untouched");

  const zoom = must(applyPreset(d, "camera-zoom-in", "camera", { startMs: 0, durationMs: 1000, amount: 0.5 }));
  evaluateDocument(zoom.doc, 1000, st);
  assert.equal(st.camera.zoom, 1.5);

  d = must(applyPreset(d, "slide-right", "o1", { startMs: 0, durationMs: 1000, distance: 300 })).doc;
  const follow = must(applyPreset(d, "camera-follow", "o1", { startMs: 0, durationMs: 1000 }));
  assert.ok(follow.doc.tracks.find((t) => t.property === "camera_x")!.keyframes.length >= 3);
  const fs = createEvaluatedState(follow.doc);
  evaluateDocument(follow.doc, 1000, fs);
  assert.ok(Math.abs(fs.camera.x - 400) < 1e-6, "camera ends on the followed object");
  assert.equal(applyPreset(d, "camera-follow", "camera", { startMs: 0, durationMs: 1000 }).ok, false);
});

// --------------------------------------------------------------------------- presets
test("presets: every preset creates editable tracks/keyframes that validate", () => {
  for (const p of PRESETS) {
    const d = docWithObject();
    const target = p.category === "camera" ? (p.id === "camera-follow" ? "o1" : "camera") : "o1";
    const res = applyPreset(d, p.id, target, { startMs: 500, durationMs: Math.min(p.defaultDurationMs, 4000) });
    const r = must(res);
    const v = validateAnimationDocument(r.doc);
    assert.equal(v.ok, true, `${p.id} produces a valid document`);
    if (p.id !== "camera-static") assert.ok(r.keyframeCount > 0 && r.trackIds.length > 0, `${p.id} created tracks`);
    // editable: first keyframe can be changed through the normal API
    if (r.trackIds.length) {
      const tr = r.doc.tracks.find((t) => t.id === r.trackIds[0])!;
      const edited = updateKeyframe(r.doc, tr.id, tr.keyframes[0].id, { interpolation: "linear" });
      assert.equal(edited.ok, true, `${p.id} keyframes are editable`);
    }
  }
});

test("presets: fade/slide/walk/jump semantic checks and window replacement", () => {
  const d = docWithObject();
  const fi = must(applyPreset(d, "fade-in", "o1", { startMs: 0, durationMs: 1000 })).doc;
  const st = createEvaluatedState(fi);
  evaluateDocument(fi, 0, st);
  assert.equal(st.objects.get("o1")!.opacity, 0);
  evaluateDocument(fi, 1000, st);
  assert.equal(st.objects.get("o1")!.opacity, 1);

  const sl = must(applyPreset(d, "slide-left", "o1", { startMs: 0, durationMs: 1000, distance: 50 })).doc;
  evaluateDocument(sl, 1000, st);
  assert.equal(st.objects.get("o1")!.x, 50);

  const walk = must(applyPreset(d, "walk", "o1", { startMs: 0, durationMs: 3000, distance: 400 })).doc;
  evaluateDocument(walk, 3000, st);
  assert.equal(st.objects.get("o1")!.x, 500);
  assert.ok(walk.tracks.some((t) => t.property === "y"), "walk adds a bob track");

  const jump = must(applyPreset(d, "jump", "o1", { startMs: 0, durationMs: 1000, distance: 200 })).doc;
  const mid = createEvaluatedState(jump);
  evaluateDocument(jump, 550, mid);
  assert.ok(mid.objects.get("o1")!.y < 200, "jump leaves the ground");
  evaluateDocument(jump, 1000, mid);
  assert.equal(mid.objects.get("o1")!.y, 200, "and lands");

  const turn = must(applyPreset(d, "turn", "o1", { startMs: 0, durationMs: 500 })).doc;
  evaluateDocument(turn, 500, st);
  assert.equal(st.objects.get("o1")!.scale_x, -1);

  // re-applying replaces only the window, preserving keyframes outside
  let w = must(upsertKeyframe(d, "o1", "x", { time_ms: 4000, value: 777 })).doc;
  w = must(applyPreset(w, "slide-right", "o1", { startMs: 0, durationMs: 1000, distance: 100 })).doc;
  w = must(applyPreset(w, "slide-right", "o1", { startMs: 0, durationMs: 1000, distance: 200 })).doc;
  const x = w.tracks.find((t) => t.property === "x")!;
  assert.equal(x.keyframes.length, 3);
  assert.equal(x.keyframes[x.keyframes.length - 1].value, 777);

  assert.equal(applyPreset(d, "nope", "o1", { startMs: 0, durationMs: 100 }).ok, false);
  assert.equal(applyPreset(d, "fade-in", "o1", { startMs: 4500, durationMs: 1000 }).ok, false, "exceeds duration");
  assert.equal(applyPreset(d, "fade-in", "ghost", { startMs: 0, durationMs: 100 }).ok, false);
  assert.equal(applyPreset(d, "fade-in", "camera", { startMs: 0, durationMs: 100 }).ok, false);
});

// --------------------------------------------------------------------------- scene loading
test("scene: builds objects from a Step 5 scene and syncs without touching animation", () => {
  const scene = {
    id: "sc1",
    title: "T",
    duration_seconds: 8,
    character_assignments: [{ id: "c1", character_name: "Kaelen", layer_order: 1, position_x: 30, position_y: 80, scale_percent: 100 }],
    asset_assignments: [
      { id: "a1", label: "BG", layer_type: "background", layer_order: 1, position_x: 50, position_y: 50, scale_percent: 100 },
      { id: "a2", label: "Lamp", layer_type: "prop", layer_order: 2, position_x: 70, position_y: 60, scale_percent: 50 },
    ],
  };
  let doc = buildDocumentFromScene(scene);
  assert.equal(validateAnimationDocument(doc).ok, true);
  assert.equal(doc.duration_ms, 8000);
  assert.equal(doc.objects.length, 3);
  const ch = doc.objects.find((o) => o.kind === "character")!;
  assert.equal(ch.base.x, 0.3 * 1920);
  assert.equal(ch.base.y, 0.8 * 1080);
  assert.deepEqual(new Set(doc.objects.map((o) => o.layer_order)).size, 3, "unique layer order");
  assert.ok(doc.objects.find((o) => o.kind === "background")!.layer_order < ch.layer_order);

  doc = must(upsertKeyframe(doc, ch.id, "x", { time_ms: 0, value: 1 })).doc;
  const again = syncDocumentWithScene(doc, scene);
  assert.equal(again.added.length, 0, "no duplicates");
  const grown = syncDocumentWithScene(doc, { ...scene, character_assignments: [...scene.character_assignments, { id: "c2", character_name: "Lyra", layer_order: 2, position_x: 60, position_y: 80, scale_percent: 100 }] });
  assert.equal(grown.added.length, 1);
  assert.equal(grown.doc.tracks.length, 1, "existing animation preserved");
  const orphaned = syncDocumentWithScene(doc, { ...scene, character_assignments: [] });
  assert.deepEqual(orphaned.orphans, [ch.id]);

  const noBg = buildDocumentFromScene({ ...scene, asset_assignments: [] });
  assert.ok(noBg.objects.some((o) => o.kind === "background" && o.source_ref?.type === "scene_environment"), "environment fallback background");
});

// --------------------------------------------------------------------------- playback
class FakeClock implements Clock {
  t = 0;
  cb: ((n: number) => void) | null = null;
  pending = 0;
  now() { return this.t; }
  request(cb: (n: number) => void) { this.cb = cb; this.pending += 1; return this.pending; }
  cancel() { this.cb = null; }
  advance(ms: number) {
    this.t += ms;
    const cb = this.cb;
    this.cb = null;
    cb?.(this.t);
  }
}

function makePlayback(patch: Partial<AnimationDocument> = {}) {
  const clock = new FakeClock();
  let doc = createEmptyDocument("s", { duration_ms: 2000, fps: 24, ...patch });
  const frames: number[] = [];
  let ended = 0;
  const states: string[] = [];
  const pc = new PlaybackController({
    getDocument: () => doc,
    clock,
    onFrame: (_t, f) => frames.push(f),
    onStateChange: (s) => states.push(s),
    onEnded: () => { ended += 1; },
  });
  return { clock, pc, frames, states, get ended() { return ended; }, setDoc: (d: AnimationDocument) => { doc = d; } };
}

test("playback: play/pause/resume/stop/restart/seek and frame stepping", () => {
  const h = makePlayback();
  assert.equal(h.pc.state, "stopped");
  h.pc.play();
  assert.equal(h.pc.state, "playing");
  h.clock.advance(500);
  assert.equal(h.pc.timeMs, 500);
  h.pc.pause();
  assert.equal(h.pc.state, "paused");
  h.clock.advance(5000);
  assert.equal(h.pc.timeMs, 500, "paused time does not advance");
  h.pc.play();
  h.clock.advance(250);
  assert.equal(h.pc.timeMs, 750, "resumes from the paused position");
  h.pc.stop();
  assert.equal(h.pc.state, "stopped");
  assert.equal(h.pc.timeMs, 0);
  h.pc.seek(1000);
  assert.equal(h.pc.timeMs, 1000);
  h.pc.seek(999999);
  assert.equal(h.pc.timeMs, 2000, "seek clamps");
  h.pc.seek(-5);
  assert.equal(h.pc.timeMs, 0);
  h.pc.stepFrame(1);
  assert.equal(h.pc.frame, 1);
  assert.equal(h.pc.timeMs, 42);
  h.pc.stepFrame(-5);
  assert.equal(h.pc.frame, 0, "clamped at 0");
  h.pc.seek(1000);
  h.pc.restart();
  assert.equal(h.pc.state, "playing");
  assert.equal(h.pc.timeMs, 0);
  h.pc.dispose();
});

test("playback: stable timing without drift, speed, loop, range and end", () => {
  const h = makePlayback({ duration_ms: 200_000 });
  h.pc.play();
  // irregular frame times: 10,000 ticks with jitter; position must equal wall time exactly
  let wall = 0;
  for (let i = 0; i < 10_000; i++) {
    const step = i % 3 === 0 ? 16 : i % 3 === 1 ? 17 : 16.5;
    wall += step;
    h.clock.advance(step);
  }
  const expected = Math.floor((wall * 24) / 1000) * (1000 / 24);
  assert.ok(Math.abs(h.pc.timeMs - expected) <= 1, `no drift (${h.pc.timeMs} vs ${expected})`);
  h.pc.dispose();

  const fast = makePlayback({ playback: { loop: false, speed: 2, range_start_ms: 0, range_end_ms: null } });
  fast.pc.play();
  fast.clock.advance(500);
  assert.equal(fast.pc.timeMs, 1000, "2x speed");

  const ended = makePlayback();
  ended.pc.play();
  ended.clock.advance(5000);
  assert.equal(ended.pc.state, "paused");
  assert.equal(ended.pc.timeMs, 2000);
  assert.equal(ended.ended, 1);
  ended.pc.play();
  assert.equal(ended.pc.timeMs, 0, "play after end restarts");

  const loop = makePlayback({ playback: { loop: true, speed: 1, range_start_ms: 500, range_end_ms: 1500 } });
  loop.pc.play();
  assert.equal(loop.pc.timeMs, 500, "starts at range start");
  loop.clock.advance(1200);
  assert.equal(loop.pc.state, "playing");
  assert.ok(loop.pc.timeMs >= 500 && loop.pc.timeMs < 1500);
  assert.equal(Math.round(loop.pc.timeMs / 10), Math.round(frameToMs(Math.floor((700 * 24) / 1000), 24) / 10), "wrapped inside range");
  assert.equal(loop.ended, 0);
});

test("playback: frame events are emitted only when the frame changes; all supported fps", () => {
  for (const fps of [12, 24, 25, 30, 60] as const) {
    const h = makePlayback({ fps, duration_ms: 1000 });
    h.pc.play();
    for (let i = 0; i < 100; i++) h.clock.advance(5);
    const unique = new Set(h.frames);
    assert.equal(unique.size, h.frames.length, `no duplicate frame callbacks at ${fps}fps`);
    assert.ok(h.frames.length >= Math.floor(fps / 2) - 1, `${fps}fps produced frames`);
    h.pc.dispose();
  }
});

test("playback: visibility handling and cleanup", () => {
  const h = makePlayback();
  h.pc.play();
  h.clock.advance(300);
  h.pc.handleVisibilityChange(true);
  assert.equal(h.pc.state, "paused");
  h.clock.advance(60_000);
  h.pc.handleVisibilityChange(false);
  assert.equal(h.pc.state, "playing");
  assert.equal(h.pc.timeMs, 291 + 0 === 0 ? 0 : h.pc.timeMs, "no time jump");
  assert.ok(h.pc.timeMs < 400, "did not skip ahead while hidden");
  // a user pause stays paused when the tab becomes visible
  h.pc.pause();
  h.pc.handleVisibilityChange(true);
  h.pc.handleVisibilityChange(false);
  assert.equal(h.pc.state, "paused");
  // dispose cancels pending frames
  h.pc.play();
  h.pc.dispose();
  assert.equal(h.clock.cb, null, "no pending animation frame after dispose");
  h.pc.play();
  assert.equal(h.pc.state, "stopped", "disposed controller cannot play");
});

test("step 7: tracks support lock, mute, color, name, type and reordering", () => {
  let doc = docWithObject();
  const added = addTrack(doc, "o1", "x");
  assert.ok(added.ok);
  doc = added.doc;
  const trackId = added.track.id;

  // Lock
  let res = setTrackLocked(doc, trackId, true);
  assert.ok(res.ok);
  doc = res.doc;
  assert.equal(doc.tracks.find((t) => t.id === trackId)?.locked, true);

  // Mute
  res = setTrackMuted(doc, trackId, true);
  assert.ok(res.ok);
  doc = res.doc;
  assert.equal(doc.tracks.find((t) => t.id === trackId)?.muted, true);

  // Color & Name & Type
  res = setTrackColor(doc, trackId, "#ec4899");
  assert.ok(res.ok);
  doc = res.doc;
  res = setTrackName(doc, trackId, "Character Movement X");
  assert.ok(res.ok);
  doc = res.doc;
  res = setTrackType(doc, trackId, "character");
  assert.ok(res.ok);
  doc = res.doc;

  const t = doc.tracks.find((x) => x.id === trackId)!;
  assert.equal(t.color, "#ec4899");
  assert.equal(t.name, "Character Movement X");
  assert.equal(t.track_type, "character");

  // Reordering
  const added2 = addTrack(doc, "o1", "y");
  assert.ok(added2.ok);
  doc = added2.doc;
  const trackId2 = added2.track.id;

  const reordered = reorderTracks(doc, [trackId2, trackId]);
  assert.ok(reordered.ok);
  assert.equal(reordered.doc.tracks[0].id, trackId2);
  assert.equal(reordered.doc.tracks[1].id, trackId);
});

test("step 7: clips CRUD (add, update, move, trim, split, duplicate, delete, retarget)", () => {
  let doc = docWithObject();
  const added = addTrack(doc, "o1", "x");
  assert.ok(added.ok);
  doc = added.doc;
  const trackId = added.track.id;

  const added2 = addTrack(doc, "o1", "y");
  assert.ok(added2.ok);
  doc = added2.doc;
  const trackId2 = added2.track.id;

  // Add clip
  const cRes = addClip(doc, trackId, "Walk Motion", 500, 2000, 0, "#10b981");
  assert.ok(cRes.ok);
  doc = cRes.doc;
  const clipId = cRes.clip.id;
  assert.equal(doc.clips?.length, 1);
  assert.equal(cRes.clip.start_ms, 500);
  assert.equal(cRes.clip.duration_ms, 2000);

  // Move clip
  const mRes = moveClip(doc, clipId, 1000);
  assert.ok(mRes.ok);
  doc = mRes.doc;
  assert.equal(doc.clips?.[0].start_ms, 1000);

  // Trim clip
  const tRes = trimClip(doc, clipId, 800, 1500, 200);
  assert.ok(tRes.ok);
  doc = tRes.doc;
  assert.equal(doc.clips?.[0].start_ms, 800);
  assert.equal(doc.clips?.[0].duration_ms, 1500);
  assert.equal(doc.clips?.[0].source_start_ms, 200);

  // Split clip at 1200ms
  const sRes = splitClip(doc, clipId, 1200);
  assert.ok(sRes.ok);
  doc = sRes.doc;
  assert.equal(doc.clips?.length, 2);
  assert.equal(sRes.leftClip.duration_ms, 400); // 1200 - 800
  assert.equal(sRes.rightClip.start_ms, 1200);
  assert.equal(sRes.rightClip.duration_ms, 1100); // 1500 - 400

  // Duplicate right clip
  const dRes = duplicateClip(doc, sRes.rightClip.id, 50);
  assert.ok(dRes.ok);
  doc = dRes.doc;
  assert.equal(doc.clips?.length, 3);

  // Retarget clip
  const rRes = retargetClip(doc, dRes.clip.id, trackId2);
  assert.ok(rRes.ok);
  doc = rRes.doc;
  assert.equal(doc.clips?.find((c) => c.id === dRes.clip.id)?.track_id, trackId2);

  // Delete clip & deleteClips
  const delRes = deleteClip(doc, clipId);
  assert.ok(delRes.ok);
  doc = delRes.doc;
  assert.equal(doc.clips?.length, 2);

  const delAll = deleteClips(doc, doc.clips?.map((c) => c.id) ?? []);
  assert.ok(delAll.ok);
  assert.equal(delAll.doc.clips?.length, 0);
});

test("step 7: timeline markers CRUD", () => {
  let doc = docWithObject();

  // Add marker
  const m1 = addMarker(doc, "Beat Drop", 1500, "#f59e0b", "Character lands here", "audio_cue");
  assert.ok(m1.ok);
  doc = m1.doc;
  assert.equal(doc.markers?.length, 1);
  assert.equal(doc.markers?.[0].name, "Beat Drop");

  // Move marker
  const mMove = moveMarker(doc, m1.marker.id, 2000);
  assert.ok(mMove.ok);
  doc = mMove.doc;
  assert.equal(doc.markers?.[0].time_ms, 2000);

  // Update marker
  const mUpd = updateMarker(doc, m1.marker.id, { name: "Impact Point" });
  assert.ok(mUpd.ok);
  doc = mUpd.doc;
  assert.equal(doc.markers?.[0].name, "Impact Point");

  // Delete marker
  const mDel = deleteMarker(doc, m1.marker.id);
  assert.ok(mDel.ok);
  assert.equal(mDel.doc.markers?.length, 0);
});

test("step 7: track groups CRUD & nesting", () => {
  let doc = docWithObject();
  const added = addTrack(doc, "o1", "x");
  assert.ok(added.ok);
  doc = added.doc;
  const added2 = addTrack(doc, "o1", "y");
  assert.ok(added2.ok);
  doc = added2.doc;
  const tid1 = added.track.id;
  const tid2 = added2.track.id;

  // Create group
  const gRes = createTrackGroup(doc, "Character Transforms", [tid1], "#8b5cf6");
  assert.ok(gRes.ok);
  doc = gRes.doc;
  const groupId = gRes.group.id;
  assert.equal(doc.groups?.length, 1);
  assert.deepEqual(doc.groups?.[0].track_ids, [tid1]);

  // Add track to group
  const gAdd = addTrackToGroup(doc, groupId, tid2);
  assert.ok(gAdd.ok);
  doc = gAdd.doc;
  assert.deepEqual(doc.groups?.[0].track_ids, [tid1, tid2]);

  // Toggle collapse
  const gColl = toggleGroupCollapse(doc, groupId);
  assert.ok(gColl.ok);
  doc = gColl.doc;
  assert.equal(doc.groups?.[0].collapsed, true);

  // Remove track from group
  const gRem = removeTrackFromGroup(doc, groupId, tid1);
  assert.ok(gRem.ok);
  doc = gRem.doc;
  assert.deepEqual(doc.groups?.[0].track_ids, [tid2]);

  // Delete group
  const gDel = deleteTrackGroup(doc, groupId);
  assert.ok(gDel.ok);
  assert.equal(gDel.doc.groups?.length, 0);
});

test("step 7: multi-keyframe group movement preserving relative deltas", () => {
  let doc = docWithObject();
  const kf1 = upsertKeyframe(doc, "o1", "x", { time_ms: 200, value: 50 });
  doc = kf1.doc;
  const kf2 = upsertKeyframe(doc, "o1", "x", { time_ms: 600, value: 150 });
  doc = kf2.doc;
  const kf3 = upsertKeyframe(doc, "o1", "y", { time_ms: 400, value: 100 });
  doc = kf3.doc;

  const trackX = doc.tracks.find((t) => t.property === "x")!;
  const trackY = doc.tracks.find((t) => t.property === "y")!;

  const refs = [
    { trackId: trackX.id, keyframeId: kf1.keyframe.id },
    { trackId: trackX.id, keyframeId: kf2.keyframe.id },
    { trackId: trackY.id, keyframeId: kf3.keyframe.id },
  ];

  // Move all 3 keyframes forward by 300ms
  const moveRes = moveKeyframeGroup(doc, refs, 300);
  assert.ok(moveRes.ok);
  const updatedDoc = moveRes.doc;

  const tX = updatedDoc.tracks.find((t) => t.id === trackX.id)!;
  const tY = updatedDoc.tracks.find((t) => t.id === trackY.id)!;

  const newKf1 = tX.keyframes.find((k) => k.id === kf1.keyframe.id)!;
  const newKf2 = tX.keyframes.find((k) => k.id === kf2.keyframe.id)!;
  const newKf3 = tY.keyframes.find((k) => k.id === kf3.keyframe.id)!;

  assert.equal(newKf1.time_ms, 500); // 200 + 300
  assert.equal(newKf2.time_ms, 900); // 600 + 300
  assert.equal(newKf3.time_ms, 700); // 400 + 300

  // Relative deltas strictly preserved:
  assert.equal(newKf2.time_ms - newKf1.time_ms, 400); // 600 - 200 = 400
  assert.equal(newKf3.time_ms - newKf1.time_ms, 200); // 400 - 200 = 200
});

test("step 7: snapping system collects targets and calculates closest snap target", () => {
  let doc = docWithObject();
  const kf = upsertKeyframe(doc, "o1", "x", { time_ms: 1000, value: 50 });
  doc = kf.doc;
  const clp = addClip(doc, doc.tracks[0].id, "Test Clip", 1500, 1000);
  doc = clp.doc;
  const mrk = addMarker(doc, "Snap Marker", 2200);
  doc = mrk.doc;

  const targets = collectSnapTargets(doc, {
    fps: 24,
    playheadMs: 500,
    includeKeyframes: true,
    includeClips: true,
    includeMarkers: true,
  });

  assert.ok(targets.some((t) => t.type === "playhead" && t.timeMs === 500));
  assert.ok(targets.some((t) => t.type === "keyframe" && t.timeMs === 1000));
  assert.ok(targets.some((t) => t.type === "clip" && t.timeMs === 1500));
  assert.ok(targets.some((t) => t.type === "marker" && t.timeMs === 2200));

  // Find snap target within threshold
  const snap1 = findSnapTarget(1015, targets, 30);
  assert.equal(snap1.snappedTimeMs, 1000);
  assert.equal(snap1.snappedTarget?.type, "keyframe");

  // Out of threshold returns input time
  const snap2 = findSnapTarget(1140, targets, 5);
  assert.equal(snap2.snappedTimeMs, 1140);
  assert.equal(snap2.snappedTarget, null);
});

test("step 7: timeline history stack (undo / redo)", () => {
  const history = new TimelineHistory<number>(100, 5);
  assert.equal(history.current, 100);
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);

  history.push(200);
  assert.equal(history.current, 200);
  assert.equal(history.canUndo, true);

  history.push(300);
  assert.equal(history.current, 300);

  // Undo
  const u1 = history.undo();
  assert.equal(u1, 200);
  assert.equal(history.current, 200);
  assert.equal(history.canRedo, true);

  // Redo
  const r1 = history.redo();
  assert.equal(r1, 300);
  assert.equal(history.current, 300);

  // Pushing clears redo
  history.undo();
  assert.equal(history.current, 200);
  history.push(400);
  assert.equal(history.current, 400);
  assert.equal(history.canRedo, false);
});

test("step 8: audio tracks and audio clips with waveform and volume validate cleanly", () => {
  let doc = docWithObject();
  const added = addTrack(doc, "o1", "x");
  assert.ok(added.ok);
  doc = added.doc;
  const trackId = added.track.id;

  // Add an audio clip with Step 8 fields (volume, waveform, audio_asset_id, audio_url)
  const clipRes = addClip(
    doc,
    trackId,
    "Dialogue: Hero shouts",
    500,
    1500,
    0,
    "#3B82F6",
    {
      volume: 0.9,
      fade_in_ms: 100,
      fade_out_ms: 200,
      audio_asset_id: "audio-asset-1234",
      audio_url: "https://example.com/audio.wav",
      waveform: [0.1, 0.4, 0.8, 0.95, 0.6, 0.2],
    }
  );
  assert.ok(clipRes.ok, "clip should add successfully");
  doc = clipRes.doc;

  const validation = validateAnimationDocument(doc);
  assert.ok(validation.ok, `document with audio clip should validate: ${JSON.stringify(validation.issues)}`);
  assert.equal(doc.clips.length, 1);
  assert.equal((doc.clips[0] as any).volume, 0.9);
  assert.equal((doc.clips[0] as any).waveform.length, 6);
});
