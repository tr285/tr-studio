/**
 * Playback controller. Time source is a monotonic clock (performance.now). Position is always
 * computed from an anchor (anchorWall, anchorMs) — never by summing per-frame deltas — so no timing
 * drift accumulates. The controller is independent from React; UI subscribes via callbacks.
 */
import type { AnimationDocument } from "./schema.ts";
import { frameToMs, msToFrame, totalFrames } from "./evaluate.ts";

export interface Clock {
  now(): number;
  request(cb: (now: number) => void): number;
  cancel(handle: number): void;
}

export function createBrowserClock(): Clock {
  return {
    now: () => performance.now(),
    request: (cb) => requestAnimationFrame(cb),
    cancel: (h) => cancelAnimationFrame(h),
  };
}

export type PlaybackState = "stopped" | "playing" | "paused";

export interface PlaybackOptions {
  getDocument: () => AnimationDocument;
  clock?: Clock;
  /** Called whenever the displayed frame changes. */
  onFrame?: (timeMs: number, frame: number) => void;
  onStateChange?: (state: PlaybackState) => void;
  onEnded?: () => void;
}

export class PlaybackController {
  private getDocument: () => AnimationDocument;
  private clock: Clock;
  private onFrame?: (timeMs: number, frame: number) => void;
  private onStateChange?: (s: PlaybackState) => void;
  private onEnded?: () => void;

  private _state: PlaybackState = "stopped";
  private _timeMs = 0;
  private lastFrame = -1;
  private anchorWall = 0;
  private anchorMs = 0;
  private handle: number | null = null;
  private resumeOnVisible = false;
  private disposed = false;
  private detachVisibility: (() => void) | null = null;

  constructor(opts: PlaybackOptions) {
    this.getDocument = opts.getDocument;
    this.clock = opts.clock ?? createBrowserClock();
    this.onFrame = opts.onFrame;
    this.onStateChange = opts.onStateChange;
    this.onEnded = opts.onEnded;
    this._timeMs = this.range().start;
  }

  get state(): PlaybackState {
    return this._state;
  }
  get timeMs(): number {
    return this._timeMs;
  }
  get frame(): number {
    return msToFrame(this._timeMs, this.getDocument().fps);
  }

  range(): { start: number; end: number } {
    const d = this.getDocument();
    const start = Math.min(d.playback.range_start_ms, d.duration_ms);
    const end = d.playback.range_end_ms ?? d.duration_ms;
    return { start, end: Math.max(start + 1, Math.min(end, d.duration_ms)) };
  }

  private setState(s: PlaybackState) {
    if (this._state === s) return;
    this._state = s;
    this.onStateChange?.(s);
  }

  private emit(force = false) {
    const fps = this.getDocument().fps;
    const frame = msToFrame(this._timeMs, fps);
    if (!force && frame === this.lastFrame) return;
    this.lastFrame = frame;
    this.onFrame?.(this._timeMs, frame);
  }

  play(): void {
    if (this.disposed || this._state === "playing") return;
    const { start, end } = this.range();
    if (this._timeMs >= end || this._timeMs < start) this._timeMs = start;
    this.anchorWall = this.clock.now();
    this.anchorMs = this._timeMs;
    this.setState("playing");
    this.schedule();
  }

  /** Alias for play(); resumes from the paused position. */
  resume(): void {
    this.play();
  }

  pause(): void {
    if (this._state !== "playing") return;
    this.cancel();
    this.setState("paused");
  }

  stop(): void {
    this.cancel();
    this._timeMs = this.range().start;
    this.setState("stopped");
    this.emit(true);
  }

  restart(): void {
    this.cancel();
    this._timeMs = this.range().start;
    this.lastFrame = -1;
    this.setState("stopped");
    this.play();
  }

  seek(ms: number): void {
    const d = this.getDocument();
    const t = Math.max(0, Math.min(d.duration_ms, ms));
    this._timeMs = t;
    if (this._state === "playing") {
      this.anchorWall = this.clock.now();
      this.anchorMs = t;
    }
    this.emit(true);
  }

  seekFrame(frame: number): void {
    const d = this.getDocument();
    const f = Math.max(0, Math.min(totalFrames(d.duration_ms, d.fps), Math.round(frame)));
    this.seek(frameToMs(f, d.fps));
  }

  /** Step by whole frames; pauses playback first. */
  stepFrame(delta: number): void {
    if (this._state === "playing") this.pause();
    const fps = this.getDocument().fps;
    this.seekFrame(msToFrame(this._timeMs, fps) + delta);
  }

  /** Call after the playback speed in the document changed during playback. */
  rebase(): void {
    if (this._state === "playing") {
      this.anchorWall = this.clock.now();
      this.anchorMs = this._timeMs;
    }
  }

  private schedule() {
    if (this.handle !== null) return;
    this.handle = this.clock.request((now) => {
      this.handle = null;
      this.tick(now);
    });
  }

  private cancel() {
    if (this.handle !== null) {
      this.clock.cancel(this.handle);
      this.handle = null;
    }
  }

  /** Advance to wall-clock `now`. Public so tests can drive it with a fake clock. */
  tick(now: number): void {
    if (this._state !== "playing" || this.disposed) return;
    const d = this.getDocument();
    const { start, end } = this.range();
    let t = this.anchorMs + (now - this.anchorWall) * d.playback.speed;
    if (t >= end) {
      if (d.playback.loop) {
        const span = end - start;
        t = start + ((t - start) % span);
        this.anchorWall = now;
        this.anchorMs = t;
      } else {
        this._timeMs = end;
        this.emit(true);
        this.setState("paused");
        this.onEnded?.();
        return;
      }
    }
    // Quantize to document frame boundaries for a faithful low-fps look.
    this._timeMs = frameToMs(Math.floor((t * d.fps) / 1000 + 1e-9), d.fps);
    this.emit();
    this.schedule();
  }

  /** Pause when the tab is hidden and resume afterwards, without skipping ahead. */
  handleVisibilityChange(hidden: boolean): void {
    if (hidden) {
      if (this._state === "playing") {
        this.resumeOnVisible = true;
        this.pause();
      }
    } else if (this.resumeOnVisible) {
      this.resumeOnVisible = false;
      this.play();
    }
  }

  attachVisibilityListener(doc: Document = document): void {
    this.detachVisibility?.();
    const fn = () => this.handleVisibilityChange(doc.visibilityState === "hidden");
    doc.addEventListener("visibilitychange", fn);
    this.detachVisibility = () => doc.removeEventListener("visibilitychange", fn);
  }

  /** Stop all timers/listeners. The controller cannot be used afterwards. */
  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.detachVisibility?.();
    this.detachVisibility = null;
    this._state = "stopped";
  }
}
