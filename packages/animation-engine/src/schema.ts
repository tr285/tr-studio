/**
 * TR STUDIO — Animation document schema (versioned, strictly validated, UI/renderer independent).
 *
 * The document is pure JSON data. It never contains executable content; every field is validated
 * by `validateAnimationDocument` before it is used or persisted. The same document drives the
 * editor preview, the canvas renderer and the future video renderer.
 *
 * Scene data (assets, characters, environments) is NOT duplicated: objects only hold a
 * `source_ref` pointing at the Step 5 scene record plus the base transform used for animation.
 */

export const ANIMATION_SCHEMA_VERSION = "1.0";
export const ALLOWED_FPS = [12, 24, 25, 30, 60] as const;
export type FrameRate = (typeof ALLOWED_FPS)[number];

export const MAX_DURATION_MS = 600_000;
export const MAX_OBJECTS = 200;
export const MAX_TRACKS = 2000;
export const MAX_KEYFRAMES_PER_TRACK = 5000;
export const MAX_PATH_POINTS = 200;
export const CAMERA_TARGET = "camera";

export const OBJECT_PROPERTIES = [
  "x",
  "y",
  "scale_x",
  "scale_y",
  "rotation",
  "opacity",
  "visible",
  "anchor_x",
  "anchor_y",
] as const;
export const CAMERA_PROPERTIES = ["camera_x", "camera_y", "camera_zoom", "camera_rotation"] as const;
export type ObjectProperty = (typeof OBJECT_PROPERTIES)[number];
export type CameraProperty = (typeof CAMERA_PROPERTIES)[number];
export type AnimatableProperty = ObjectProperty | CameraProperty;

export const INTERPOLATION_MODES = [
  "hold",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "cubic-bezier",
] as const;
export type InterpolationMode = (typeof INTERPOLATION_MODES)[number];

export const OBJECT_KINDS = ["background", "character", "prop", "foreground", "overlay"] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const TRACK_TYPES = [
  "character",
  "prop",
  "background",
  "camera",
  "property",
  "group",
  "dialogue",
  "narration",
  "music",
  "sound_effect",
  "ambience",
  "audio",
] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

export interface TimelineClip {
  id: string;
  track_id: string;
  name: string;
  start_ms: number;
  duration_ms: number;
  source_start_ms: number;
  color?: string | null;
  target_id?: string | null;
  volume?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
  audio_asset_id?: string | null;
  audio_url?: string | null;
  waveform?: number[] | null;
}

export interface TimelineMarker {
  id: string;
  name: string;
  time_ms: number;
  color: string;
  description?: string | null;
  event_type?: string | null;
}

export interface TrackGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  track_ids: string[];
}

export const SOURCE_REF_TYPES = ["scene_asset", "scene_character", "scene_environment"] as const;
export type SourceRefType = (typeof SOURCE_REF_TYPES)[number];

export interface BezierEasing {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe {
  id: string;
  time_ms: number;
  value: number | boolean;
  interpolation: InterpolationMode;
  /** Required when interpolation === "cubic-bezier". x1/x2 must be within [0, 1]. */
  easing?: BezierEasing | null;
}

export interface Track {
  id: string;
  /** Object id, or "camera". */
  target_id: string;
  property: AnimatableProperty;
  enabled: boolean;
  metadata: Record<string, string | number | boolean>;
  keyframes: Keyframe[];
  name?: string | null;
  track_type?: TrackType | null;
  color?: string | null;
  locked?: boolean;
  muted?: boolean;
  order?: number;
}

export interface ObjectBase {
  x: number;
  y: number;
  scale_x: number;
  scale_y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  anchor_x: number;
  anchor_y: number;
  /** Optional logical size in canvas pixels (used for placeholders and sizing). */
  width: number;
  height: number;
}

export interface SourceRef {
  type: SourceRefType;
  id: string;
}

export interface AnimObject {
  id: string;
  kind: ObjectKind;
  label: string;
  source_ref: SourceRef | null;
  layer_order: number;
  base: ObjectBase;
}

export interface PathPoint {
  id: string;
  x: number;
  y: number;
}

export interface MotionPath {
  id: string;
  object_id: string;
  enabled: boolean;
  start_ms: number;
  duration_ms: number;
  mode: "linear" | "curve";
  points: PathPoint[];
  interpolation: Exclude<InterpolationMode, "hold">;
  easing?: BezierEasing | null;
  orient_to_path: boolean;
  orientation_offset_deg: number;
}

export interface Bone {
  id: string;
  name: string;
  parent_id: string | null;
  pivot_x: number;
  pivot_y: number;
  rotation: number;
  /** Optional separated body-part asset reference; rigs require such assets to exist. */
  part_ref: SourceRef | null;
}

export interface Rig {
  id: string;
  object_id: string;
  bones: Bone[];
}

export interface CameraBase {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface PlaybackSettings {
  loop: boolean;
  speed: number;
  range_start_ms: number;
  /** null = full duration */
  range_end_ms: number | null;
}

export interface AnimationDocument {
  schema_version: string;
  scene_id: string;
  fps: FrameRate;
  width: number;
  height: number;
  duration_ms: number;
  playback: PlaybackSettings;
  camera: CameraBase;
  objects: AnimObject[];
  tracks: Track[];
  motion_paths: MotionPath[];
  rigs: Rig[];
  clips?: TimelineClip[];
  markers?: TimelineMarker[];
  groups?: TrackGroup[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; document: AnimationDocument; issues: [] }
  | { ok: false; document: null; issues: ValidationIssue[] };

let idCounter = 0;
/** Collision-resistant id generator for client-created entities. */
export function newId(prefix = "id"): string {
  idCounter += 1;
  const rand =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${idCounter}`;
  return `${prefix}_${rand}`;
}

export function defaultObjectBase(partial: Partial<ObjectBase> = {}): ObjectBase {
  return {
    x: 0,
    y: 0,
    scale_x: 1,
    scale_y: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    anchor_x: 0.5,
    anchor_y: 0.5,
    width: 256,
    height: 256,
    ...partial,
  };
}

export function createEmptyDocument(sceneId: string, overrides: Partial<AnimationDocument> = {}): AnimationDocument {
  return {
    schema_version: ANIMATION_SCHEMA_VERSION,
    scene_id: sceneId,
    fps: 24,
    width: 1920,
    height: 1080,
    duration_ms: 5000,
    playback: { loop: false, speed: 1, range_start_ms: 0, range_end_ms: null },
    camera: { x: 960, y: 540, zoom: 1, rotation: 0 },
    objects: [],
    tracks: [],
    motion_paths: [],
    rigs: [],
    ...overrides,
  };
}

export function isCameraProperty(p: string): p is CameraProperty {
  return (CAMERA_PROPERTIES as readonly string[]).includes(p);
}
export function isObjectProperty(p: string): p is ObjectProperty {
  return (OBJECT_PROPERTIES as readonly string[]).includes(p);
}

/** Allowed value range per property (inclusive). Booleans handled separately. */
export const PROPERTY_RANGES: Record<Exclude<AnimatableProperty, "visible">, [number, number]> = {
  x: [-100_000, 100_000],
  y: [-100_000, 100_000],
  scale_x: [-100, 100],
  scale_y: [-100, 100],
  rotation: [-36_000, 36_000],
  opacity: [0, 1],
  anchor_x: [-10, 10],
  anchor_y: [-10, 10],
  camera_x: [-100_000, 100_000],
  camera_y: [-100_000, 100_000],
  camera_zoom: [0.05, 50],
  camera_rotation: [-36_000, 36_000],
};

export function validateKeyframeValue(property: string, value: unknown): string | null {
  if (property === "visible") {
    return typeof value === "boolean" ? null : "visible keyframes must be boolean";
  }
  if (!isObjectProperty(property) && !isCameraProperty(property)) return `unknown property '${property}'`;
  if (typeof value !== "number" || !Number.isFinite(value)) return "value must be a finite number";
  const [min, max] = PROPERTY_RANGES[property as Exclude<AnimatableProperty, "visible">];
  if (value < min || value > max) return `value must be between ${min} and ${max}`;
  return null;
}

export function validateBezier(e: unknown): string | null {
  if (!e || typeof e !== "object") return "cubic-bezier requires easing control points";
  const b = e as Record<string, unknown>;
  for (const k of ["x1", "y1", "x2", "y2"]) {
    if (typeof b[k] !== "number" || !Number.isFinite(b[k] as number)) return `easing.${k} must be a finite number`;
  }
  const { x1, x2, y1, y2 } = b as unknown as BezierEasing;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return "easing x control points must be within [0, 1]";
  if (y1 < -5 || y1 > 5 || y2 < -5 || y2 > 5) return "easing y control points must be within [-5, 5]";
  return null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function rejectExtra(o: Obj, allowed: string[], path: string, issues: ValidationIssue[]) {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) issues.push({ path: `${path}.${k}`, message: "unknown field" });
  }
}

/**
 * Migrate older documents to the current schema. Currently only 1.x exists; the function is the
 * single extension point for future migrations (each step must be pure and idempotent).
 */
export function migrateAnimationDocument(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const version = typeof raw.schema_version === "string" ? raw.schema_version : "1.0";
  const major = version.split(".")[0];
  if (major === "1") {
    const d: Obj = { ...raw, schema_version: ANIMATION_SCHEMA_VERSION };
    if (d.clips === undefined) d.clips = [];
    if (d.markers === undefined) d.markers = [];
    if (d.groups === undefined) d.groups = [];
    return d;
  }
  return raw; // unsupported majors are rejected by validation
}

export function validateTrackShape(t: unknown, path: string, issues: ValidationIssue[], objectIds: Set<string>) {
  if (!isObj(t)) {
    issues.push({ path, message: "track must be an object" });
    return;
  }
  rejectExtra(
    t,
    ["id", "target_id", "property", "enabled", "metadata", "keyframes", "name", "track_type", "color", "locked", "muted", "order"],
    path,
    issues
  );
  if (!isStr(t.id)) issues.push({ path: `${path}.id`, message: "id required" });
  if (!isStr(t.target_id)) issues.push({ path: `${path}.target_id`, message: "target_id required" });
  if (t.name !== undefined && t.name !== null && typeof t.name !== "string") {
    issues.push({ path: `${path}.name`, message: "name must be a string or null" });
  }
  if (t.track_type !== undefined && t.track_type !== null && !TRACK_TYPES.includes(t.track_type as TrackType)) {
    issues.push({ path: `${path}.track_type`, message: "invalid track_type" });
  }
  if (t.color !== undefined && t.color !== null && typeof t.color !== "string") {
    issues.push({ path: `${path}.color`, message: "color must be a string or null" });
  }
  if (t.locked !== undefined && typeof t.locked !== "boolean") {
    issues.push({ path: `${path}.locked`, message: "locked must be boolean" });
  }
  if (t.muted !== undefined && typeof t.muted !== "boolean") {
    issues.push({ path: `${path}.muted`, message: "muted must be boolean" });
  }
  if (t.order !== undefined && (!isNum(t.order) || !Number.isInteger(t.order))) {
    issues.push({ path: `${path}.order`, message: "order must be an integer" });
  }
  const property = t.property;
  if (typeof property !== "string" || (!isObjectProperty(property) && !isCameraProperty(property))) {
    issues.push({ path: `${path}.property`, message: "unknown property" });
  } else if (isStr(t.target_id)) {
    if (t.target_id === CAMERA_TARGET && !isCameraProperty(property)) {
      issues.push({ path: `${path}.property`, message: "camera track requires a camera_* property" });
    }
    if (t.target_id !== CAMERA_TARGET) {
      if (!isObjectProperty(property)) issues.push({ path: `${path}.property`, message: "object track cannot use camera_* property" });
      if (!objectIds.has(t.target_id)) issues.push({ path: `${path}.target_id`, message: "target object does not exist" });
    }
  }
  if (typeof t.enabled !== "boolean") issues.push({ path: `${path}.enabled`, message: "enabled must be boolean" });
  if (!isObj(t.metadata)) issues.push({ path: `${path}.metadata`, message: "metadata must be an object" });
  else {
    for (const [k, v] of Object.entries(t.metadata)) {
      if (!["string", "number", "boolean"].includes(typeof v)) {
        issues.push({ path: `${path}.metadata.${k}`, message: "metadata values must be primitives" });
      }
    }
  }
  if (!Array.isArray(t.keyframes)) {
    issues.push({ path: `${path}.keyframes`, message: "keyframes must be an array" });
    return;
  }
  if (t.keyframes.length > MAX_KEYFRAMES_PER_TRACK) {
    issues.push({ path: `${path}.keyframes`, message: "too many keyframes" });
    return;
  }
  const seenIds = new Set<string>();
  const seenTimes = new Set<number>();
  let prev = -1;
  t.keyframes.forEach((k, i) => {
    const kp = `${path}.keyframes[${i}]`;
    if (!isObj(k)) {
      issues.push({ path: kp, message: "keyframe must be an object" });
      return;
    }
    rejectExtra(k, ["id", "time_ms", "value", "interpolation", "easing"], kp, issues);
    if (!isStr(k.id)) issues.push({ path: `${kp}.id`, message: "id required" });
    else if (seenIds.has(k.id)) issues.push({ path: `${kp}.id`, message: "duplicate keyframe id" });
    else seenIds.add(k.id);
    if (!isNum(k.time_ms) || !Number.isInteger(k.time_ms) || k.time_ms < 0) {
      issues.push({ path: `${kp}.time_ms`, message: "time_ms must be a non-negative integer" });
    } else {
      if (seenTimes.has(k.time_ms)) issues.push({ path: `${kp}.time_ms`, message: "duplicate keyframe time" });
      if (k.time_ms < prev) issues.push({ path: `${kp}.time_ms`, message: "keyframes must be sorted by time" });
      seenTimes.add(k.time_ms);
      prev = k.time_ms;
    }
    if (typeof property === "string") {
      const msg = validateKeyframeValue(property, k.value);
      if (msg) issues.push({ path: `${kp}.value`, message: msg });
    }
    if (!INTERPOLATION_MODES.includes(k.interpolation as InterpolationMode)) {
      issues.push({ path: `${kp}.interpolation`, message: "invalid interpolation" });
    } else if (k.interpolation === "cubic-bezier") {
      const msg = validateBezier(k.easing);
      if (msg) issues.push({ path: `${kp}.easing`, message: msg });
    }
  });
}

/** Strictly validate an unknown value. Never throws. Returns a normalized document when ok. */
export function validateAnimationDocument(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const raw = migrateAnimationDocument(input);
  if (!isObj(raw)) return { ok: false, document: null, issues: [{ path: "$", message: "document must be an object" }] };
  const d = raw;
  rejectExtra(
    d,
    [
      "schema_version",
      "scene_id",
      "fps",
      "width",
      "height",
      "duration_ms",
      "playback",
      "camera",
      "objects",
      "tracks",
      "motion_paths",
      "rigs",
      "clips",
      "markers",
      "groups",
    ],
    "$",
    issues
  );

  if (typeof d.schema_version !== "string" || d.schema_version.split(".")[0] !== "1") {
    issues.push({ path: "$.schema_version", message: `unsupported schema version (expected ${ANIMATION_SCHEMA_VERSION})` });
  }
  if (!isStr(d.scene_id)) issues.push({ path: "$.scene_id", message: "scene_id required" });
  if (!(ALLOWED_FPS as readonly number[]).includes(d.fps as number)) issues.push({ path: "$.fps", message: `fps must be one of ${ALLOWED_FPS.join(", ")}` });
  for (const k of ["width", "height"] as const) {
    if (!isNum(d[k]) || !Number.isInteger(d[k]) || (d[k] as number) < 16 || (d[k] as number) > 8192) issues.push({ path: `$.${k}`, message: "must be an integer between 16 and 8192" });
  }
  if (!isNum(d.duration_ms) || !Number.isInteger(d.duration_ms) || d.duration_ms < 1 || d.duration_ms > MAX_DURATION_MS) {
    issues.push({ path: "$.duration_ms", message: `duration_ms must be an integer between 1 and ${MAX_DURATION_MS}` });
  }

  const pb = d.playback;
  if (!isObj(pb)) issues.push({ path: "$.playback", message: "playback required" });
  else {
    rejectExtra(pb, ["loop", "speed", "range_start_ms", "range_end_ms"], "$.playback", issues);
    if (typeof pb.loop !== "boolean") issues.push({ path: "$.playback.loop", message: "loop must be boolean" });
    if (!isNum(pb.speed) || pb.speed < 0.1 || pb.speed > 8) issues.push({ path: "$.playback.speed", message: "speed must be between 0.1 and 8" });
    if (!isNum(pb.range_start_ms) || pb.range_start_ms < 0) issues.push({ path: "$.playback.range_start_ms", message: "invalid range start" });
    if (pb.range_end_ms !== null && !isNum(pb.range_end_ms)) issues.push({ path: "$.playback.range_end_ms", message: "invalid range end" });
    else if (isNum(pb.range_end_ms) && isNum(pb.range_start_ms) && pb.range_end_ms <= pb.range_start_ms) issues.push({ path: "$.playback.range_end_ms", message: "range end must be after range start" });
    else if (isNum(pb.range_end_ms) && isNum(d.duration_ms) && pb.range_end_ms > d.duration_ms) issues.push({ path: "$.playback.range_end_ms", message: "range end exceeds duration" });
  }

  const cam = d.camera;
  if (!isObj(cam)) issues.push({ path: "$.camera", message: "camera required" });
  else {
    rejectExtra(cam, ["x", "y", "zoom", "rotation"], "$.camera", issues);
    for (const k of ["x", "y", "zoom", "rotation"]) if (!isNum(cam[k])) issues.push({ path: `$.camera.${k}`, message: "must be a finite number" });
    if (isNum(cam.zoom) && (cam.zoom < 0.05 || cam.zoom > 50)) issues.push({ path: "$.camera.zoom", message: "zoom out of range" });
  }

  const objectIds = new Set<string>();
  if (!Array.isArray(d.objects)) issues.push({ path: "$.objects", message: "objects must be an array" });
  else if (d.objects.length > MAX_OBJECTS) issues.push({ path: "$.objects", message: "too many objects" });
  else {
    d.objects.forEach((o, i) => {
      const p = `$.objects[${i}]`;
      if (!isObj(o)) return issues.push({ path: p, message: "object must be an object" });
      rejectExtra(o, ["id", "kind", "label", "source_ref", "layer_order", "base"], p, issues);
      if (!isStr(o.id)) issues.push({ path: `${p}.id`, message: "id required" });
      else if (o.id === CAMERA_TARGET || objectIds.has(o.id)) issues.push({ path: `${p}.id`, message: "duplicate or reserved object id" });
      else objectIds.add(o.id);
      if (!OBJECT_KINDS.includes(o.kind as ObjectKind)) issues.push({ path: `${p}.kind`, message: "invalid kind" });
      if (typeof o.label !== "string" || o.label.length > 200) issues.push({ path: `${p}.label`, message: "label must be a string" });
      if (o.source_ref !== null) {
        if (!isObj(o.source_ref)) issues.push({ path: `${p}.source_ref`, message: "invalid source_ref" });
        else {
          rejectExtra(o.source_ref, ["type", "id"], `${p}.source_ref`, issues);
          if (!SOURCE_REF_TYPES.includes(o.source_ref.type as SourceRefType) || !isStr(o.source_ref.id)) issues.push({ path: `${p}.source_ref`, message: "invalid source_ref" });
        }
      }
      if (!isNum(o.layer_order) || !Number.isInteger(o.layer_order)) issues.push({ path: `${p}.layer_order`, message: "layer_order must be an integer" });
      if (!isObj(o.base)) return issues.push({ path: `${p}.base`, message: "base required" });
      rejectExtra(o.base, ["x", "y", "scale_x", "scale_y", "rotation", "opacity", "visible", "anchor_x", "anchor_y", "width", "height"], `${p}.base`, issues);
      for (const prop of OBJECT_PROPERTIES) {
        const msg = validateKeyframeValue(prop, o.base[prop]);
        if (msg) issues.push({ path: `${p}.base.${prop}`, message: msg });
      }
      for (const k of ["width", "height"]) if (!isNum(o.base[k]) || (o.base[k] as number) <= 0 || (o.base[k] as number) > 20000) issues.push({ path: `${p}.base.${k}`, message: "must be a positive number" });
    });
  }

  if (!Array.isArray(d.tracks)) issues.push({ path: "$.tracks", message: "tracks must be an array" });
  else if (d.tracks.length > MAX_TRACKS) issues.push({ path: "$.tracks", message: "too many tracks" });
  else {
    const ids = new Set<string>();
    const targets = new Set<string>();
    d.tracks.forEach((t, i) => {
      validateTrackShape(t, `$.tracks[${i}]`, issues, objectIds);
      if (isObj(t) && isStr(t.id)) {
        if (ids.has(t.id)) issues.push({ path: `$.tracks[${i}].id`, message: "duplicate track id" });
        ids.add(t.id);
        const key = `${t.target_id}:${t.property}`;
        if (targets.has(key)) issues.push({ path: `$.tracks[${i}]`, message: "duplicate track for the same target and property" });
        targets.add(key);
        if (Array.isArray(t.keyframes) && isNum(d.duration_ms)) {
          for (const k of t.keyframes) if (isObj(k) && isNum(k.time_ms) && k.time_ms > (d.duration_ms as number)) {
            issues.push({ path: `$.tracks[${i}].keyframes`, message: "keyframe time exceeds document duration" });
            break;
          }
        }
      }
    });
  }

  if (!Array.isArray(d.motion_paths)) issues.push({ path: "$.motion_paths", message: "motion_paths must be an array" });
  else {
    const ids = new Set<string>();
    d.motion_paths.forEach((m, i) => {
      const p = `$.motion_paths[${i}]`;
      if (!isObj(m)) return issues.push({ path: p, message: "motion path must be an object" });
      rejectExtra(m, ["id", "object_id", "enabled", "start_ms", "duration_ms", "mode", "points", "interpolation", "easing", "orient_to_path", "orientation_offset_deg"], p, issues);
      if (!isStr(m.id) || ids.has(m.id as string)) issues.push({ path: `${p}.id`, message: "id required and unique" });
      else ids.add(m.id);
      if (!isStr(m.object_id) || !objectIds.has(m.object_id)) issues.push({ path: `${p}.object_id`, message: "target object does not exist" });
      if (typeof m.enabled !== "boolean") issues.push({ path: `${p}.enabled`, message: "enabled must be boolean" });
      if (!isNum(m.start_ms) || m.start_ms < 0) issues.push({ path: `${p}.start_ms`, message: "invalid start" });
      if (!isNum(m.duration_ms) || m.duration_ms < 1) issues.push({ path: `${p}.duration_ms`, message: "invalid duration" });
      else if (isNum(m.start_ms) && isNum(d.duration_ms) && m.start_ms + m.duration_ms > d.duration_ms) issues.push({ path: `${p}.duration_ms`, message: "path exceeds document duration" });
      if (m.mode !== "linear" && m.mode !== "curve") issues.push({ path: `${p}.mode`, message: "mode must be linear or curve" });
      if (!INTERPOLATION_MODES.includes(m.interpolation as InterpolationMode) || m.interpolation === "hold") issues.push({ path: `${p}.interpolation`, message: "invalid interpolation" });
      else if (m.interpolation === "cubic-bezier") {
        const msg = validateBezier(m.easing);
        if (msg) issues.push({ path: `${p}.easing`, message: msg });
      }
      if (typeof m.orient_to_path !== "boolean") issues.push({ path: `${p}.orient_to_path`, message: "must be boolean" });
      if (!isNum(m.orientation_offset_deg)) issues.push({ path: `${p}.orientation_offset_deg`, message: "must be a number" });
      if (!Array.isArray(m.points) || m.points.length < 2 || m.points.length > MAX_PATH_POINTS) issues.push({ path: `${p}.points`, message: `needs 2-${MAX_PATH_POINTS} points` });
      else {
        const pids = new Set<string>();
        m.points.forEach((pt, j) => {
          if (!isObj(pt) || !isStr(pt.id) || !isNum(pt.x) || !isNum(pt.y) || Math.abs(pt.x as number) > 100000 || Math.abs(pt.y as number) > 100000) issues.push({ path: `${p}.points[${j}]`, message: "invalid point" });
          else {
            rejectExtra(pt, ["id", "x", "y"], `${p}.points[${j}]`, issues);
            if (pids.has(pt.id as string)) issues.push({ path: `${p}.points[${j}].id`, message: "duplicate point id" });
            pids.add(pt.id as string);
          }
        });
      }
    });
  }

  if (!Array.isArray(d.rigs)) issues.push({ path: "$.rigs", message: "rigs must be an array" });
  else {
    d.rigs.forEach((r, i) => {
      const p = `$.rigs[${i}]`;
      if (!isObj(r)) return issues.push({ path: p, message: "rig must be an object" });
      rejectExtra(r, ["id", "object_id", "bones"], p, issues);
      if (!isStr(r.id)) issues.push({ path: `${p}.id`, message: "id required" });
      if (!isStr(r.object_id) || !objectIds.has(r.object_id)) issues.push({ path: `${p}.object_id`, message: "target object does not exist" });
      if (!Array.isArray(r.bones) || r.bones.length === 0 || r.bones.length > 100) return issues.push({ path: `${p}.bones`, message: "needs 1-100 bones" });
      const boneIds = new Set<string>();
      r.bones.forEach((b) => { if (isObj(b) && isStr(b.id)) boneIds.add(b.id); });
      r.bones.forEach((b, j) => {
        const bp = `${p}.bones[${j}]`;
        if (!isObj(b)) return issues.push({ path: bp, message: "bone must be an object" });
        rejectExtra(b, ["id", "name", "parent_id", "pivot_x", "pivot_y", "rotation", "part_ref"], bp, issues);
        if (!isStr(b.id) || !isStr(b.name)) issues.push({ path: bp, message: "id and name required" });
        if (b.parent_id !== null && (!isStr(b.parent_id) || !boneIds.has(b.parent_id) || b.parent_id === b.id)) issues.push({ path: `${bp}.parent_id`, message: "parent bone must exist" });
        for (const k of ["pivot_x", "pivot_y", "rotation"]) if (!isNum(b[k])) issues.push({ path: `${bp}.${k}`, message: "must be a finite number" });
      });
      // cycle detection
      const parent = new Map<string, string | null>();
      r.bones.forEach((b) => { if (isObj(b) && isStr(b.id)) parent.set(b.id, (b.parent_id as string | null) ?? null); });
      for (const id of parent.keys()) {
        let cur: string | null | undefined = id;
        let steps = 0;
        while (cur && steps <= parent.size) { cur = parent.get(cur) ?? null; steps += 1; }
        if (steps > parent.size) { issues.push({ path: `${p}.bones`, message: "bone hierarchy contains a cycle" }); break; }
      }
    });
  }

  const trackIds = new Set<string>();
  if (Array.isArray(d.tracks)) {
    d.tracks.forEach((t) => {
      if (isObj(t) && isStr(t.id)) trackIds.add(t.id as string);
    });
  }

  if (d.clips !== undefined) {
    if (!Array.isArray(d.clips)) issues.push({ path: "$.clips", message: "clips must be an array" });
    else {
      const clipIds = new Set<string>();
      d.clips.forEach((c, i) => {
        const p = `$.clips[${i}]`;
        if (!isObj(c)) return issues.push({ path: p, message: "clip must be an object" });
        rejectExtra(
          c,
          [
            "id",
            "track_id",
            "name",
            "start_ms",
            "duration_ms",
            "source_start_ms",
            "color",
            "target_id",
            "volume",
            "fade_in_ms",
            "fade_out_ms",
            "audio_asset_id",
            "audio_url",
            "waveform",
          ],
          p,
          issues
        );
        if (!isStr(c.id) || clipIds.has(c.id as string)) issues.push({ path: `${p}.id`, message: "id required and unique" });
        else clipIds.add(c.id as string);
        if (!isStr(c.track_id) || !trackIds.has(c.track_id as string)) issues.push({ path: `${p}.track_id`, message: "track_id must match an existing track" });
        if (typeof c.name !== "string") issues.push({ path: `${p}.name`, message: "name must be a string" });
        if (!isNum(c.start_ms) || !Number.isInteger(c.start_ms) || (c.start_ms as number) < 0) issues.push({ path: `${p}.start_ms`, message: "start_ms must be non-negative integer" });
        if (!isNum(c.duration_ms) || !Number.isInteger(c.duration_ms) || (c.duration_ms as number) < 1) issues.push({ path: `${p}.duration_ms`, message: "duration_ms must be integer >= 1" });
        else if (isNum(c.start_ms) && isNum(d.duration_ms) && (c.start_ms as number) + (c.duration_ms as number) > (d.duration_ms as number)) {
          issues.push({ path: `${p}.duration_ms`, message: "clip extends beyond document duration" });
        }
        if (!isNum(c.source_start_ms) || !Number.isInteger(c.source_start_ms) || (c.source_start_ms as number) < 0) {
          issues.push({ path: `${p}.source_start_ms`, message: "source_start_ms must be non-negative integer" });
        }
        if (c.color !== undefined && c.color !== null && typeof c.color !== "string") {
          issues.push({ path: `${p}.color`, message: "color must be string or null" });
        }
      });
    }
  }

  if (d.markers !== undefined) {
    if (!Array.isArray(d.markers)) issues.push({ path: "$.markers", message: "markers must be an array" });
    else {
      const markerIds = new Set<string>();
      d.markers.forEach((m, i) => {
        const p = `$.markers[${i}]`;
        if (!isObj(m)) return issues.push({ path: p, message: "marker must be an object" });
        rejectExtra(m, ["id", "name", "time_ms", "color", "description", "event_type"], p, issues);
        if (!isStr(m.id) || markerIds.has(m.id as string)) issues.push({ path: `${p}.id`, message: "id required and unique" });
        else markerIds.add(m.id as string);
        if (!isStr(m.name)) issues.push({ path: `${p}.name`, message: "name required" });
        if (!isNum(m.time_ms) || !Number.isInteger(m.time_ms) || (m.time_ms as number) < 0) issues.push({ path: `${p}.time_ms`, message: "time_ms must be non-negative integer" });
        else if (isNum(d.duration_ms) && (m.time_ms as number) > (d.duration_ms as number)) issues.push({ path: `${p}.time_ms`, message: "marker time exceeds document duration" });
        if (typeof m.color !== "string") issues.push({ path: `${p}.color`, message: "color must be a string" });
        if (m.description !== undefined && m.description !== null && typeof m.description !== "string") issues.push({ path: `${p}.description`, message: "description must be string or null" });
        if (m.event_type !== undefined && m.event_type !== null && typeof m.event_type !== "string") issues.push({ path: `${p}.event_type`, message: "event_type must be string or null" });
      });
    }
  }

  if (d.groups !== undefined) {
    if (!Array.isArray(d.groups)) issues.push({ path: "$.groups", message: "groups must be an array" });
    else {
      const groupIds = new Set<string>();
      d.groups.forEach((g, i) => {
        const p = `$.groups[${i}]`;
        if (!isObj(g)) return issues.push({ path: p, message: "group must be an object" });
        rejectExtra(g, ["id", "name", "color", "collapsed", "track_ids"], p, issues);
        if (!isStr(g.id) || groupIds.has(g.id as string)) issues.push({ path: `${p}.id`, message: "id required and unique" });
        else groupIds.add(g.id as string);
        if (!isStr(g.name)) issues.push({ path: `${p}.name`, message: "name required" });
        if (typeof g.color !== "string") issues.push({ path: `${p}.color`, message: "color must be a string" });
        if (typeof g.collapsed !== "boolean") issues.push({ path: `${p}.collapsed`, message: "collapsed must be boolean" });
        if (!Array.isArray(g.track_ids)) issues.push({ path: `${p}.track_ids`, message: "track_ids must be an array" });
        else {
          for (const tid of g.track_ids) {
            if (typeof tid !== "string" || !trackIds.has(tid)) {
              issues.push({ path: `${p}.track_ids`, message: `referenced track '${tid}' does not exist` });
              break;
            }
          }
        }
      });
    }
  }

  if (issues.length > 0) return { ok: false, document: null, issues };
  return { ok: true, document: d as unknown as AnimationDocument, issues: [] };
}
