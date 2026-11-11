/**
 * Easing, interpolation, motion-path and camera maths. Pure functions, no DOM, no React.
 */
import type {
  AnimationDocument,
  AnimatableProperty,
  BezierEasing,
  CameraBase,
  InterpolationMode,
  Keyframe,
  MotionPath,
  ObjectBase,
  Track,
} from "./schema.ts";
import { CAMERA_TARGET } from "./schema.ts";

// ---------------------------------------------------------------------------
// Frame-rate conversion
// ---------------------------------------------------------------------------
export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms * fps) / 1000);
}
export function frameToMs(frame: number, fps: number): number {
  return Math.round((frame * 1000) / fps);
}
/** Snap a millisecond timestamp to the nearest frame boundary. */
export function snapToFrame(ms: number, fps: number): number {
  return frameToMs(msToFrame(ms, fps), fps);
}
export function convertFrameRate(frame: number, fromFps: number, toFps: number): number {
  return Math.round((frame * toFps) / fromFps);
}
export function totalFrames(durationMs: number, fps: number): number {
  return Math.max(1, Math.round((durationMs * fps) / 1000));
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
export const BEZIER_PRESETS: Record<"ease-in" | "ease-out" | "ease-in-out", BezierEasing> = {
  "ease-in": { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

/** Evaluate a CSS-style cubic-bezier easing curve y(x). Robust Newton + bisection solver. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-7) return sampleY(t);
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i++) {
    const v = sampleX(t);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/** Map normalized time 0..1 to eased progress for the given interpolation mode. */
export function applyEasing(mode: InterpolationMode, t: number, bezier?: BezierEasing | null): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  switch (mode) {
    case "hold":
      return 0;
    case "linear":
      return x;
    case "ease-in":
    case "ease-out":
    case "ease-in-out": {
      const b = BEZIER_PRESETS[mode];
      return cubicBezier(b.x1, b.y1, b.x2, b.y2, x);
    }
    case "cubic-bezier":
      return bezier ? cubicBezier(bezier.x1, bezier.y1, bezier.x2, bezier.y2, x) : x;
    default:
      return x;
  }
}

// ---------------------------------------------------------------------------
// Track evaluation
// ---------------------------------------------------------------------------
/** Index of the last keyframe with time <= t, or -1. Binary search over sorted keyframes. */
export function findKeyframeIndex(keyframes: readonly Keyframe[], t: number): number {
  let lo = 0;
  let hi = keyframes.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid].time_ms <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Evaluate a track at time t. Returns undefined when the track has no keyframes. */
export function evaluateTrack(track: Pick<Track, "keyframes">, t: number): number | boolean | undefined {
  const kfs = track.keyframes;
  if (kfs.length === 0) return undefined;
  const i = findKeyframeIndex(kfs, t);
  if (i < 0) return kfs[0].value;
  const a = kfs[i];
  if (i === kfs.length - 1) return a.value;
  const b = kfs[i + 1];
  if (typeof a.value === "boolean" || typeof b.value === "boolean" || a.interpolation === "hold") return a.value;
  const span = b.time_ms - a.time_ms;
  if (span <= 0) return b.value;
  const p = applyEasing(a.interpolation, (t - a.time_ms) / span, a.easing);
  return (a.value as number) + ((b.value as number) - (a.value as number)) * p;
}

// ---------------------------------------------------------------------------
// Motion paths
// ---------------------------------------------------------------------------
interface PathTable {
  xs: Float64Array;
  ys: Float64Array;
  cum: Float64Array;
  length: number;
}
const pathTableCache = new WeakMap<object, PathTable>();
const SAMPLES_PER_SEGMENT = 24;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function buildPathTable(path: Pick<MotionPath, "points" | "mode">): PathTable {
  const pts = path.points;
  const segs = pts.length - 1;
  const perSeg = path.mode === "curve" ? SAMPLES_PER_SEGMENT : 1;
  const n = segs * perSeg + 1;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const cum = new Float64Array(n);
  let idx = 0;
  xs[0] = pts[0].x;
  ys[0] = pts[0].y;
  for (let s = 0; s < segs; s++) {
    const p0 = pts[Math.max(0, s - 1)];
    const p1 = pts[s];
    const p2 = pts[s + 1];
    const p3 = pts[Math.min(pts.length - 1, s + 2)];
    for (let k = 1; k <= perSeg; k++) {
      const t = k / perSeg;
      idx += 1;
      if (path.mode === "curve") {
        xs[idx] = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
        ys[idx] = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
      } else {
        xs[idx] = p2.x;
        ys[idx] = p2.y;
      }
      cum[idx] = cum[idx - 1] + Math.hypot(xs[idx] - xs[idx - 1], ys[idx] - ys[idx - 1]);
    }
  }
  return { xs, ys, cum, length: cum[n - 1] };
}

function getPathTable(path: MotionPath): PathTable {
  let t = pathTableCache.get(path);
  if (!t) {
    t = buildPathTable(path);
    pathTableCache.set(path, t);
  }
  return t;
}

export function motionPathLength(path: Pick<MotionPath, "points" | "mode">): number {
  return buildPathTable(path).length;
}

export interface PathSample {
  x: number;
  y: number;
  /** Heading in degrees (0 = +x axis, clockwise-positive in canvas space). */
  angle: number;
}

/** Position at arc-length fraction u in [0,1] (constant speed along the path). */
export function samplePathAtFraction(path: MotionPath, u: number, out: PathSample): PathSample {
  const tbl = getPathTable(path);
  const f = u < 0 ? 0 : u > 1 ? 1 : u;
  const target = f * tbl.length;
  const cum = tbl.cum;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const segLen = cum[i] - cum[i - 1];
  const r = segLen > 1e-9 ? (target - cum[i - 1]) / segLen : 0;
  out.x = tbl.xs[i - 1] + (tbl.xs[i] - tbl.xs[i - 1]) * r;
  out.y = tbl.ys[i - 1] + (tbl.ys[i] - tbl.ys[i - 1]) * r;
  out.angle = (Math.atan2(tbl.ys[i] - tbl.ys[i - 1], tbl.xs[i] - tbl.xs[i - 1]) * 180) / Math.PI;
  return out;
}

/** Sample a path at document time t (holds start point before, end point after). */
export function evaluateMotionPath(path: MotionPath, t: number, out: PathSample): PathSample {
  const raw = (t - path.start_ms) / path.duration_ms;
  const eased = applyEasing(path.interpolation, raw, path.easing);
  return samplePathAtFraction(path, eased, out);
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
/** Canvas 2D matrix [a,b,c,d,e,f] mapping world space to screen space for a camera. */
export function cameraMatrix(
  cam: CameraBase,
  viewWidth: number,
  viewHeight: number,
  out: number[] = [1, 0, 0, 1, 0, 0]
): number[] {
  const r = (cam.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const a = cam.zoom * cos;
  const b = -cam.zoom * sin;
  const c = cam.zoom * sin;
  const d = cam.zoom * cos;
  out[0] = a;
  out[1] = b;
  out[2] = c;
  out[3] = d;
  out[4] = viewWidth / 2 - (a * cam.x + c * cam.y);
  out[5] = viewHeight / 2 - (b * cam.x + d * cam.y);
  return out;
}

export function worldToScreen(m: readonly number[], x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

export function screenToWorld(m: readonly number[], x: number, y: number): { x: number; y: number } {
  const det = m[0] * m[3] - m[1] * m[2];
  const dx = x - m[4];
  const dy = y - m[5];
  return { x: (m[3] * dx - m[2] * dy) / det, y: (-m[1] * dx + m[0] * dy) / det };
}

// ---------------------------------------------------------------------------
// Document evaluation
// ---------------------------------------------------------------------------
export interface ObjectState extends ObjectBase {
  id: string;
}
export interface EvaluatedState {
  time_ms: number;
  objects: Map<string, ObjectState>;
  camera: CameraBase;
}

export function createEvaluatedState(doc: AnimationDocument): EvaluatedState {
  const objects = new Map<string, ObjectState>();
  for (const o of doc.objects) objects.set(o.id, { id: o.id, ...o.base });
  return { time_ms: 0, objects, camera: { ...doc.camera } };
}

const scratchSample: PathSample = { x: 0, y: 0, angle: 0 };

/**
 * Evaluate the whole document at time t into `state` (reused to avoid allocations during playback).
 * Order of precedence: base value < property tracks < motion path (x/y, and rotation when oriented).
 */
export function evaluateDocument(doc: AnimationDocument, t: number, state: EvaluatedState): EvaluatedState {
  // Re-sync object set if the document's objects changed since state creation.
  if (state.objects.size !== doc.objects.length) {
    state.objects.clear();
    for (const o of doc.objects) state.objects.set(o.id, { id: o.id, ...o.base });
  }
  state.time_ms = t;
  for (const o of doc.objects) {
    let s = state.objects.get(o.id);
    if (!s) {
      s = { id: o.id, ...o.base };
      state.objects.set(o.id, s);
    } else {
      const b = o.base;
      s.x = b.x; s.y = b.y; s.scale_x = b.scale_x; s.scale_y = b.scale_y; s.rotation = b.rotation;
      s.opacity = b.opacity; s.visible = b.visible; s.anchor_x = b.anchor_x; s.anchor_y = b.anchor_y;
      s.width = b.width; s.height = b.height;
    }
  }
  state.camera.x = doc.camera.x;
  state.camera.y = doc.camera.y;
  state.camera.zoom = doc.camera.zoom;
  state.camera.rotation = doc.camera.rotation;

  for (const tr of doc.tracks) {
    if (!tr.enabled || tr.keyframes.length === 0) continue;
    const v = evaluateTrack(tr, t);
    if (v === undefined) continue;
    if (tr.target_id === CAMERA_TARGET) {
      switch (tr.property) {
        case "camera_x": state.camera.x = v as number; break;
        case "camera_y": state.camera.y = v as number; break;
        case "camera_zoom": state.camera.zoom = v as number; break;
        case "camera_rotation": state.camera.rotation = v as number; break;
      }
      continue;
    }
    const s = state.objects.get(tr.target_id);
    if (!s) continue;
    switch (tr.property) {
      case "x": s.x = v as number; break;
      case "y": s.y = v as number; break;
      case "scale_x": s.scale_x = v as number; break;
      case "scale_y": s.scale_y = v as number; break;
      case "rotation": s.rotation = v as number; break;
      case "opacity": s.opacity = v as number; break;
      case "visible": s.visible = v as boolean; break;
      case "anchor_x": s.anchor_x = v as number; break;
      case "anchor_y": s.anchor_y = v as number; break;
    }
  }

  for (const p of doc.motion_paths) {
    if (!p.enabled) continue;
    const s = state.objects.get(p.object_id);
    if (!s) continue;
    evaluateMotionPath(p, t, scratchSample);
    s.x = scratchSample.x;
    s.y = scratchSample.y;
    if (p.orient_to_path) s.rotation = scratchSample.angle + p.orientation_offset_deg;
  }
  return state;
}

/** Evaluate a single object property at time t (including paths). Used by presets to find start values. */
export function evaluateObjectProperty(doc: AnimationDocument, objectId: string, property: AnimatableProperty, t: number): number | boolean | undefined {
  const st = evaluateDocument(doc, t, createEvaluatedState(doc));
  if (objectId === CAMERA_TARGET) {
    const map: Record<string, number> = { camera_x: st.camera.x, camera_y: st.camera.y, camera_zoom: st.camera.zoom, camera_rotation: st.camera.rotation };
    return map[property];
  }
  const s = st.objects.get(objectId);
  return s ? (s as unknown as Record<string, number | boolean>)[property] : undefined;
}
