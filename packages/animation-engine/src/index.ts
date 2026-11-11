/**
 * TR STUDIO — 2D Animation Engine (Step 6).
 *
 * Renderer-independent core: schema, interpolation, motion paths, camera, presets, editing
 * operations and playback. The Canvas 2D renderer is the only DOM-dependent module.
 */

// Legacy Step 1 contracts (kept for backwards compatibility)
export type EasingFunction = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "cubic-bezier";

export interface TimelineKeyframe<T = number> {
  id: string;
  timeMs: number;
  value: T;
  easing: EasingFunction;
}

export interface TimelineTrack {
  id: string;
  label: string;
  targetEntityId: string;
  property: string;
  muted: boolean;
  locked: boolean;
}

export * from "./schema.ts";
export * from "./evaluate.ts";
export * from "./edit.ts";
export * from "./presets.ts";
export * from "./scene.ts";
export * from "./playback.ts";
export * from "./renderer.ts";
