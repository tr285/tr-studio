/**
 * Animation presets. A preset NEVER renders a hard-coded effect: it generates ordinary, editable
 * tracks and keyframes inside the document. Camera presets generate camera tracks.
 */
import type { AnimatableProperty, AnimationDocument, InterpolationMode } from "./schema.ts";
import { CAMERA_TARGET } from "./schema.ts";
import { createEvaluatedState, evaluateDocument, snapToFrame } from "./evaluate.ts";
import { upsertKeyframe, type EditResult } from "./edit.ts";

export type PresetCategory = "transition" | "motion" | "character" | "camera";

export interface PresetDefinition {
  id: string;
  label: string;
  category: PresetCategory;
  description: string;
  defaultDurationMs: number;
  /** Which tunable parameters apply. */
  params: ("distance" | "amount")[];
  defaultDistance?: number;
  defaultAmount?: number;
}

export const PRESETS: PresetDefinition[] = [
  { id: "fade-in", label: "Fade in", category: "transition", description: "Opacity 0 → current.", defaultDurationMs: 1000, params: [] },
  { id: "fade-out", label: "Fade out", category: "transition", description: "Opacity current → 0.", defaultDurationMs: 1000, params: [] },
  { id: "slide-left", label: "Slide left", category: "motion", description: "Move left by distance.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 300 },
  { id: "slide-right", label: "Slide right", category: "motion", description: "Move right by distance.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 300 },
  { id: "slide-up", label: "Slide up", category: "motion", description: "Move up by distance.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 200 },
  { id: "slide-down", label: "Slide down", category: "motion", description: "Move down by distance.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 200 },
  { id: "zoom-in", label: "Zoom in", category: "motion", description: "Scale up by amount (0.5 = +50%).", defaultDurationMs: 1000, params: ["amount"], defaultAmount: 0.5 },
  { id: "zoom-out", label: "Zoom out", category: "motion", description: "Scale down by amount.", defaultDurationMs: 1000, params: ["amount"], defaultAmount: 0.4 },
  { id: "rotate", label: "Rotate", category: "motion", description: "Rotate by amount degrees.", defaultDurationMs: 1000, params: ["amount"], defaultAmount: 360 },
  { id: "bounce", label: "Bounce", category: "motion", description: "Vertical bounces decaying.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 120 },
  { id: "shake", label: "Shake", category: "motion", description: "Rapid horizontal shake.", defaultDurationMs: 600, params: ["distance"], defaultDistance: 14 },
  { id: "pulse", label: "Pulse", category: "motion", description: "Scale pulses twice.", defaultDurationMs: 1000, params: ["amount"], defaultAmount: 0.12 },
  { id: "float", label: "Float", category: "motion", description: "Gentle vertical drift.", defaultDurationMs: 3000, params: ["distance"], defaultDistance: 20 },
  { id: "custom", label: "Custom (X position)", category: "motion", description: "Two editable X keyframes at start and end.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 100 },
  { id: "idle", label: "Idle (breathing)", category: "character", description: "Subtle vertical scale breathing.", defaultDurationMs: 2000, params: ["amount"], defaultAmount: 0.02 },
  { id: "walk", label: "Walk", category: "character", description: "Travel with bob and sway (transform-based).", defaultDurationMs: 3000, params: ["distance"], defaultDistance: 400 },
  { id: "run", label: "Run", category: "character", description: "Faster travel with bigger bob and forward lean.", defaultDurationMs: 2000, params: ["distance"], defaultDistance: 700 },
  { id: "jump", label: "Jump", category: "character", description: "Crouch, leap and land with squash and stretch.", defaultDurationMs: 900, params: ["distance"], defaultDistance: 220 },
  { id: "talk", label: "Talking gesture", category: "character", description: "Small head-bob and sway while speaking.", defaultDurationMs: 2000, params: ["amount"], defaultAmount: 2 },
  { id: "wave", label: "Wave", category: "character", description: "Whole-body rocking wave gesture.", defaultDurationMs: 1500, params: ["amount"], defaultAmount: 10 },
  { id: "turn", label: "Turn around", category: "character", description: "Flip horizontally via scale X.", defaultDurationMs: 500, params: [] },
  { id: "react-happy", label: "Reaction: happy", category: "character", description: "Cheerful hop.", defaultDurationMs: 900, params: ["distance"], defaultDistance: 40 },
  { id: "react-sad", label: "Reaction: sad", category: "character", description: "Slump and slow sway.", defaultDurationMs: 1500, params: ["distance"], defaultDistance: 18 },
  { id: "react-surprised", label: "Reaction: surprised", category: "character", description: "Pop scale and recoil.", defaultDurationMs: 700, params: ["amount"], defaultAmount: 0.15 },
  { id: "react-angry", label: "Reaction: angry", category: "character", description: "Tremble and swell.", defaultDurationMs: 1000, params: ["distance"], defaultDistance: 8 },
  { id: "camera-static", label: "Camera: static", category: "camera", description: "Clears camera tracks in the range.", defaultDurationMs: 1000, params: [] },
  { id: "camera-pan", label: "Camera: pan", category: "camera", description: "Pan horizontally by distance.", defaultDurationMs: 3000, params: ["distance"], defaultDistance: 400 },
  { id: "camera-zoom-in", label: "Camera: zoom in", category: "camera", description: "Zoom to 1 + amount.", defaultDurationMs: 3000, params: ["amount"], defaultAmount: 0.4 },
  { id: "camera-zoom-out", label: "Camera: zoom out", category: "camera", description: "Zoom to 1 − amount.", defaultDurationMs: 3000, params: ["amount"], defaultAmount: 0.3 },
  { id: "camera-follow", label: "Camera: follow target", category: "camera", description: "Bakes editable keyframes following the selected object.", defaultDurationMs: 3000, params: [] },
];

export function getPreset(id: string): PresetDefinition | undefined {
  return PRESETS.find((p) => p.id === id);
}

export interface PresetOptions {
  startMs: number;
  durationMs: number;
  distance?: number;
  amount?: number;
}

interface GenKf {
  property: AnimatableProperty;
  time_ms: number;
  value: number | boolean;
  interpolation: InterpolationMode;
}

/** Build keyframes for a preset. `base` holds the values at the preset start time. */
export function generatePresetKeyframes(
  presetId: string,
  base: { x: number; y: number; scale_x: number; scale_y: number; rotation: number; opacity: number },
  opts: PresetOptions,
  fps: number
): GenKf[] | null {
  const def = getPreset(presetId);
  if (!def) return null;
  const dist = opts.distance ?? def.defaultDistance ?? 0;
  const amt = opts.amount ?? def.defaultAmount ?? 0;
  const { startMs, durationMs } = opts;
  const out: GenKf[] = [];
  const at = (f: number) => snapToFrame(startMs + durationMs * f, fps);
  const k = (property: AnimatableProperty, f: number, value: number, interpolation: InterpolationMode = "ease-in-out") =>
    out.push({ property, time_ms: at(f), value, interpolation });
  const steps = (property: AnimatableProperty, n: number, fn: (i: number) => number, interp: InterpolationMode = "ease-in-out") => {
    for (let i = 0; i <= n; i++) k(property, i / n, fn(i), interp);
  };

  switch (presetId) {
    case "fade-in": k("opacity", 0, 0); k("opacity", 1, base.opacity, "linear"); break;
    case "fade-out": k("opacity", 0, base.opacity); k("opacity", 1, 0, "linear"); break;
    case "slide-left": k("x", 0, base.x); k("x", 1, base.x - dist, "linear"); break;
    case "slide-right": k("x", 0, base.x); k("x", 1, base.x + dist, "linear"); break;
    case "slide-up": k("y", 0, base.y); k("y", 1, base.y - dist, "linear"); break;
    case "slide-down": k("y", 0, base.y); k("y", 1, base.y + dist, "linear"); break;
    case "zoom-in":
      k("scale_x", 0, base.scale_x); k("scale_x", 1, base.scale_x * (1 + amt));
      k("scale_y", 0, base.scale_y); k("scale_y", 1, base.scale_y * (1 + amt));
      break;
    case "zoom-out":
      k("scale_x", 0, base.scale_x); k("scale_x", 1, base.scale_x * Math.max(0.05, 1 - amt));
      k("scale_y", 0, base.scale_y); k("scale_y", 1, base.scale_y * Math.max(0.05, 1 - amt));
      break;
    case "rotate": k("rotation", 0, base.rotation); k("rotation", 1, base.rotation + amt, "linear"); break;
    case "bounce":
      k("y", 0, base.y, "ease-out"); k("y", 0.25, base.y - dist, "ease-in"); k("y", 0.5, base.y, "ease-out");
      k("y", 0.7, base.y - dist * 0.4, "ease-in"); k("y", 0.85, base.y, "ease-out"); k("y", 0.93, base.y - dist * 0.12, "ease-in"); k("y", 1, base.y);
      break;
    case "shake": steps("x", 10, (i) => (i === 0 || i === 10 ? base.x : base.x + (i % 2 ? dist : -dist) * (1 - i / 12)), "linear"); break;
    case "pulse":
      steps("scale_x", 4, (i) => (i % 2 ? base.scale_x * (1 + amt) : base.scale_x));
      steps("scale_y", 4, (i) => (i % 2 ? base.scale_y * (1 + amt) : base.scale_y));
      break;
    case "float": steps("y", 4, (i) => base.y + (i === 1 ? -dist : i === 3 ? dist : 0)); break;
    case "custom": k("x", 0, base.x, "linear"); k("x", 1, base.x + dist, "linear"); break;
    case "idle":
      steps("scale_y", 4, (i) => (i % 2 ? base.scale_y * (1 + amt) : base.scale_y));
      break;
    case "walk": {
      k("x", 0, base.x, "linear"); k("x", 1, base.x + dist, "linear");
      const n = Math.max(2, Math.round(durationMs / 500) * 2);
      steps("y", n, (i) => (i % 2 ? base.y - 10 : base.y));
      steps("rotation", n, (i) => base.rotation + (i % 4 === 1 ? 2 : i % 4 === 3 ? -2 : 0));
      break;
    }
    case "run": {
      k("x", 0, base.x, "linear"); k("x", 1, base.x + dist, "linear");
      const n = Math.max(2, Math.round(durationMs / 250) * 2);
      steps("y", n, (i) => (i % 2 ? base.y - 22 : base.y));
      k("rotation", 0, base.rotation); k("rotation", 0.1, base.rotation + 8, "linear"); k("rotation", 0.9, base.rotation + 8, "linear"); k("rotation", 1, base.rotation);
      break;
    }
    case "jump":
      k("y", 0, base.y, "ease-out"); k("y", 0.2, base.y, "ease-out"); k("y", 0.55, base.y - dist, "ease-in"); k("y", 0.9, base.y, "ease-out"); k("y", 1, base.y);
      k("scale_y", 0, base.scale_y); k("scale_y", 0.2, base.scale_y * 0.85); k("scale_y", 0.35, base.scale_y * 1.1); k("scale_y", 0.9, base.scale_y * 0.9); k("scale_y", 1, base.scale_y);
      break;
    case "talk":
      steps("y", 8, (i) => (i % 2 ? base.y - 4 : base.y));
      steps("rotation", 8, (i) => base.rotation + (i % 4 === 1 ? amt : i % 4 === 3 ? -amt : 0));
      break;
    case "wave":
      steps("rotation", 6, (i) => base.rotation + (i % 2 ? (i % 4 === 1 ? amt : -amt) : 0));
      break;
    case "turn": k("scale_x", 0, base.scale_x); k("scale_x", 1, -base.scale_x); break;
    case "react-happy":
      k("y", 0, base.y, "ease-out"); k("y", 0.3, base.y - dist, "ease-in"); k("y", 0.6, base.y, "ease-out"); k("y", 0.8, base.y - dist * 0.5, "ease-in"); k("y", 1, base.y);
      break;
    case "react-sad":
      k("y", 0, base.y); k("y", 0.4, base.y + dist); k("y", 1, base.y + dist);
      steps("rotation", 4, (i) => base.rotation + (i % 2 ? (i === 1 ? -2 : 2) : 0));
      break;
    case "react-surprised":
      k("scale_x", 0, base.scale_x, "ease-out"); k("scale_x", 0.25, base.scale_x * (1 + amt), "ease-in-out"); k("scale_x", 1, base.scale_x);
      k("scale_y", 0, base.scale_y, "ease-out"); k("scale_y", 0.25, base.scale_y * (1 + amt), "ease-in-out"); k("scale_y", 1, base.scale_y);
      k("x", 0, base.x, "ease-out"); k("x", 0.25, base.x - 12, "ease-in-out"); k("x", 1, base.x);
      break;
    case "react-angry":
      steps("x", 12, (i) => (i === 0 || i === 12 ? base.x : base.x + (i % 2 ? dist : -dist)), "linear");
      k("scale_x", 0, base.scale_x); k("scale_x", 0.5, base.scale_x * 1.08); k("scale_x", 1, base.scale_x);
      k("scale_y", 0, base.scale_y); k("scale_y", 0.5, base.scale_y * 1.08); k("scale_y", 1, base.scale_y);
      break;
    default:
      return null;
  }
  return out;
}

export interface ApplyPresetResult {
  trackIds: string[];
  keyframeCount: number;
}

/**
 * Apply a preset to an object. Existing keyframes of the affected properties inside the preset's
 * time window are replaced; everything outside is preserved. Result is plain editable keyframes.
 */
export function applyPreset(
  doc: AnimationDocument,
  presetId: string,
  targetId: string,
  opts: PresetOptions
): EditResult<ApplyPresetResult> {
  const def = getPreset(presetId);
  if (!def) return { ok: false, error: `Unknown preset '${presetId}'` };
  if (!Number.isFinite(opts.startMs) || opts.startMs < 0) return { ok: false, error: "Invalid start time" };
  if (!Number.isFinite(opts.durationMs) || opts.durationMs < 1) return { ok: false, error: "Invalid duration" };
  if (opts.startMs + opts.durationMs > doc.duration_ms) return { ok: false, error: "Preset would extend beyond the animation duration" };
  const isCameraPreset = def.category === "camera";
  if (isCameraPreset && targetId !== CAMERA_TARGET && presetId !== "camera-follow") targetId = CAMERA_TARGET;
  if (!isCameraPreset && targetId === CAMERA_TARGET) return { ok: false, error: "Select an object to apply this preset" };
  if (!isCameraPreset && !doc.objects.some((o) => o.id === targetId)) return { ok: false, error: "Object not found" };

  const state = evaluateDocument(doc, opts.startMs, createEvaluatedState(doc));

  let generated: GenKf[] | null;
  let target = targetId;
  if (isCameraPreset) {
    target = CAMERA_TARGET;
    const cam = state.camera;
    const dist = opts.distance ?? def.defaultDistance ?? 0;
    const amt = opts.amount ?? def.defaultAmount ?? 0;
    const fps = doc.fps;
    const t0 = snapToFrame(opts.startMs, fps);
    const t1 = snapToFrame(opts.startMs + opts.durationMs, fps);
    generated = [];
    switch (presetId) {
      case "camera-static": generated = []; break;
      case "camera-pan":
        generated.push({ property: "camera_x", time_ms: t0, value: cam.x, interpolation: "ease-in-out" }, { property: "camera_x", time_ms: t1, value: cam.x + dist, interpolation: "linear" });
        break;
      case "camera-zoom-in":
        generated.push({ property: "camera_zoom", time_ms: t0, value: cam.zoom, interpolation: "ease-in-out" }, { property: "camera_zoom", time_ms: t1, value: cam.zoom * (1 + amt), interpolation: "linear" });
        break;
      case "camera-zoom-out":
        generated.push({ property: "camera_zoom", time_ms: t0, value: cam.zoom, interpolation: "ease-in-out" }, { property: "camera_zoom", time_ms: t1, value: Math.max(0.05, cam.zoom * (1 - amt)), interpolation: "linear" });
        break;
      case "camera-follow": {
        if (!doc.objects.some((o) => o.id === targetId)) return { ok: false, error: "Select an object for the camera to follow" };
        const scratch = createEvaluatedState(doc);
        const stepMs = Math.max(Math.round(1000 / fps), 100);
        for (let t = t0; ; t += stepMs) {
          const tt = Math.min(t, t1);
          evaluateDocument(doc, tt, scratch);
          const o = scratch.objects.get(targetId)!;
          generated.push({ property: "camera_x", time_ms: snapToFrame(tt, fps), value: o.x, interpolation: "linear" });
          generated.push({ property: "camera_y", time_ms: snapToFrame(tt, fps), value: o.y, interpolation: "linear" });
          if (tt >= t1) break;
        }
        break;
      }
    }
  } else {
    const s = state.objects.get(targetId)!;
    generated = generatePresetKeyframes(
      presetId,
      { x: s.x, y: s.y, scale_x: s.scale_x, scale_y: s.scale_y, rotation: s.rotation, opacity: s.opacity },
      opts,
      doc.fps
    );
  }
  if (!generated) return { ok: false, error: `Unknown preset '${presetId}'` };

  const t0 = snapToFrame(opts.startMs, doc.fps);
  const t1 = snapToFrame(opts.startMs + opts.durationMs, doc.fps);
  const props = new Set<AnimatableProperty>(generated.map((g) => g.property));
  if (presetId === "camera-static") (["camera_x", "camera_y", "camera_zoom", "camera_rotation"] as const).forEach((p) => props.add(p));

  // Remove in-window keyframes of affected properties (on the target) so the preset replaces them.
  let working: AnimationDocument = {
    ...doc,
    tracks: doc.tracks.map((tr) =>
      tr.target_id === target && props.has(tr.property)
        ? { ...tr, keyframes: tr.keyframes.filter((kf) => kf.time_ms < t0 || kf.time_ms > t1) }
        : tr
    ),
  };

  const trackIds = new Set<string>();
  let count = 0;
  for (const g of generated) {
    const res = upsertKeyframe(working, target, g.property, { time_ms: g.time_ms, value: g.value, interpolation: g.interpolation });
    if (!res.ok) return res;
    working = res.doc;
    trackIds.add(res.trackId);
    count += 1;
  }
  return { ok: true, doc: working, trackIds: [...trackIds], keyframeCount: count };
}
