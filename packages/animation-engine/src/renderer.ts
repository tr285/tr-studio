/**
 * Canvas 2D renderer for animation documents. Pure DOM/Canvas — no React, no AI provider.
 *
 * Renders the *camera frame* (document width x height) into a canvas using an editor view
 * transform (zoom/pan) so users can inspect it. Redraws only when invalidated, coalesced into one
 * requestAnimationFrame. Missing or failed assets show an honest labeled placeholder.
 */
import type { AnimationDocument, AnimObject } from "./schema.ts";
import type { EvaluatedState, ObjectState } from "./evaluate.ts";
import { cameraMatrix, samplePathAtFraction, type PathSample } from "./evaluate.ts";

type ImageStatus = "loading" | "ready" | "error";
interface CachedImage {
  img: HTMLImageElement;
  status: ImageStatus;
}

export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export type HandleKind = "scale" | "rotate" | null;

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  onImageLoaded?: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

type Mat = [number, number, number, number, number, number];

function mul(m: Mat, n: Mat): Mat {
  // m * n (apply n first, then m) for canvas matrices [a,b,c,d,e,f]
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

function objectMatrix(s: ObjectState): Mat {
  const r = (s.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos * s.scale_x, sin * s.scale_x, -sin * s.scale_y, cos * s.scale_y, s.x, s.y];
}

export class CanvasSceneRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private images = new Map<string, CachedImage>();
  private doc: AnimationDocument | null = null;
  private state: EvaluatedState | null = null;
  private urls = new Map<string, string>();
  private view: ViewTransform = { zoom: 1, panX: 0, panY: 0 };
  private fitted = true;
  private selectedId: string | null = null;
  private pathOverlayId: string | null = null;
  private showCameraFrame = true;
  private raf: number | null = null;
  private disposed = false;
  private onImageLoaded?: () => void;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private scratch: PathSample = { x: 0, y: 0, angle: 0 };

  constructor(opts: RendererOptions) {
    this.canvas = opts.canvas;
    const ctx = opts.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available");
    this.ctx = ctx;
    this.onImageLoaded = opts.onImageLoaded;
  }

  // ---- configuration ------------------------------------------------------
  setDocument(doc: AnimationDocument): void {
    this.doc = doc;
    this.invalidate();
  }

  /** Map objectId → image URL. Missing entries render a placeholder. */
  setAssetUrls(urls: Record<string, string | null | undefined>): void {
    this.urls.clear();
    for (const [id, url] of Object.entries(urls)) if (url) this.urls.set(id, url);
    for (const url of this.urls.values()) this.ensureImage(url);
    this.invalidate();
  }

  setState(state: EvaluatedState): void {
    this.state = state;
    this.invalidate();
  }

  setSelection(objectId: string | null): void {
    this.selectedId = objectId;
    this.invalidate();
  }

  setPathOverlay(objectId: string | null): void {
    this.pathOverlayId = objectId;
    this.invalidate();
  }

  setShowCameraFrame(show: boolean): void {
    this.showCameraFrame = show;
    this.invalidate();
  }

  // ---- sizing / view ------------------------------------------------------
  resize(cssWidth: number, cssHeight: number, dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    if (this.fitted) this.fitToView();
    this.invalidate();
  }

  fitToView(): void {
    if (!this.doc) return;
    const pad = 24;
    const zoom = Math.min((this.cssWidth - pad * 2) / this.doc.width, (this.cssHeight - pad * 2) / this.doc.height);
    this.view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.view.panX = (this.cssWidth - this.doc.width * this.view.zoom) / 2;
    this.view.panY = (this.cssHeight - this.doc.height * this.view.zoom) / 2;
    this.fitted = true;
    this.invalidate();
  }

  getView(): ViewTransform {
    return { ...this.view };
  }

  /** Zoom around a screen (CSS pixel) point. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.view.zoom * factor));
    const k = next / this.view.zoom;
    this.view.panX = sx - (sx - this.view.panX) * k;
    this.view.panY = sy - (sy - this.view.panY) * k;
    this.view.zoom = next;
    this.fitted = false;
    this.invalidate();
  }

  setZoom(zoom: number): void {
    this.zoomAt(zoom / this.view.zoom, this.cssWidth / 2, this.cssHeight / 2);
  }

  panBy(dx: number, dy: number): void {
    this.view.panX += dx;
    this.view.panY += dy;
    this.fitted = false;
    this.invalidate();
  }

  // ---- coordinate helpers -------------------------------------------------
  private stageMatrix(): Mat {
    return [this.view.zoom, 0, 0, this.view.zoom, this.view.panX, this.view.panY];
  }

  private fullMatrix(): Mat {
    if (!this.doc || !this.state) return this.stageMatrix();
    const cam = cameraMatrix(this.state.camera, this.doc.width, this.doc.height) as Mat;
    return mul(this.stageMatrix(), cam);
  }

  /** Convert a screen (CSS px) point to document world coordinates (camera applied). */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const inv = invert(this.fullMatrix());
    return { x: inv[0] * sx + inv[2] * sy + inv[4], y: inv[1] * sx + inv[3] * sy + inv[5] };
  }

  // ---- hit testing --------------------------------------------------------
  hitTest(sx: number, sy: number): string | null {
    if (!this.doc || !this.state) return null;
    const ordered = [...this.doc.objects].sort((a, b) => b.layer_order - a.layer_order);
    const full = this.fullMatrix();
    for (const o of ordered) {
      const s = this.state.objects.get(o.id);
      if (!s || !s.visible || s.opacity <= 0.001) continue;
      const inv = invert(mul(full, objectMatrix(s)));
      const lx = inv[0] * sx + inv[2] * sy + inv[4];
      const ly = inv[1] * sx + inv[3] * sy + inv[5];
      const left = -s.anchor_x * s.width;
      const top = -s.anchor_y * s.height;
      if (lx >= left && lx <= left + s.width && ly >= top && ly <= top + s.height) return o.id;
    }
    return null;
  }

  /** Detect scale (bottom-right) and rotate (above top-center) handles of the selected object. */
  hitTestHandle(sx: number, sy: number): HandleKind {
    if (!this.selectedId || !this.state) return null;
    const s = this.state.objects.get(this.selectedId);
    if (!s) return null;
    const full = mul(this.fullMatrix(), objectMatrix(s));
    const corner = this.apply(full, (1 - s.anchor_x) * s.width, (1 - s.anchor_y) * s.height);
    const rot = this.apply(full, (0.5 - s.anchor_x) * s.width, -s.anchor_y * s.height - 28 / Math.max(0.1, this.view.zoom));
    if (Math.hypot(sx - corner.x, sy - corner.y) <= 9) return "scale";
    if (Math.hypot(sx - rot.x, sy - rot.y) <= 9) return "rotate";
    return null;
  }

  private apply(m: Mat, x: number, y: number) {
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
  }

  /** Screen position of an object's origin (for rotate / scale math in the UI). */
  objectScreenPosition(objectId: string): { x: number; y: number } | null {
    const s = this.state?.objects.get(objectId);
    if (!s) return null;
    return this.apply(this.fullMatrix(), s.x, s.y);
  }

  // ---- images -------------------------------------------------------------
  private ensureImage(url: string): CachedImage {
    let c = this.images.get(url);
    if (c) return c;
    const img = new Image();
    img.decoding = "async";
    c = { img, status: "loading" };
    this.images.set(url, c);
    const entry = c;
    img.onload = () => {
      entry.status = "ready";
      if (!this.disposed) {
        this.invalidate();
        this.onImageLoaded?.();
      }
    };
    img.onerror = () => {
      entry.status = "error";
      if (!this.disposed) this.invalidate();
    };
    img.src = url;
    return c;
  }

  /** Reports per-object asset status for the UI (ready | loading | error | missing). */
  assetStatus(objectId: string): ImageStatus | "missing" {
    const url = this.urls.get(objectId);
    if (!url) return "missing";
    return this.images.get(url)?.status ?? "loading";
  }

  // ---- drawing ------------------------------------------------------------
  invalidate(): void {
    if (this.disposed || this.raf !== null) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.draw();
    });
  }

  private draw(): void {
    if (this.disposed) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    const doc = this.doc;
    const state = this.state;
    if (!doc || !state) return;

    const stage = this.stageMatrix();
    // Stage (camera frame) background + clip
    ctx.save();
    ctx.setTransform(this.dpr * stage[0], 0, 0, this.dpr * stage[3], this.dpr * stage[4], this.dpr * stage[5]);
    ctx.fillStyle = "#15151c";
    ctx.fillRect(0, 0, doc.width, doc.height);
    ctx.beginPath();
    ctx.rect(0, 0, doc.width, doc.height);
    ctx.clip();

    const cam = cameraMatrix(state.camera, doc.width, doc.height) as Mat;
    const world = mul(stage, cam);
    const ordered = [...doc.objects].sort((a, b) => a.layer_order - b.layer_order);
    for (const o of ordered) {
      const s = state.objects.get(o.id);
      if (!s || !s.visible || s.opacity <= 0) continue;
      this.drawObject(ctx, o, s, mul(world, objectMatrix(s)));
    }
    ctx.restore();

    // Stage border
    if (this.showCameraFrame) {
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.strokeStyle = "rgba(139,92,246,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(stage[4] + 0.5, stage[5] + 0.5, doc.width * stage[0], doc.height * stage[3]);
      ctx.restore();
    }

    this.drawPathOverlay(ctx, doc, world);
    this.drawSelection(ctx, world, state);
  }

  private drawObject(ctx: CanvasRenderingContext2D, o: AnimObject, s: ObjectState, m: Mat): void {
    ctx.save();
    ctx.setTransform(this.dpr * m[0], this.dpr * m[1], this.dpr * m[2], this.dpr * m[3], this.dpr * m[4], this.dpr * m[5]);
    ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity));
    const left = -s.anchor_x * s.width;
    const top = -s.anchor_y * s.height;
    const url = this.urls.get(o.id);
    const cached = url ? this.ensureImage(url) : null;
    if (cached && cached.status === "ready" && cached.img.naturalWidth > 0) {
      const iw = cached.img.naturalWidth;
      const ih = cached.img.naturalHeight;
      const cover = o.kind === "background";
      const k = cover ? Math.max(s.width / iw, s.height / ih) : Math.min(s.width / iw, s.height / ih);
      const dw = iw * k;
      const dh = ih * k;
      if (cover) {
        ctx.beginPath();
        ctx.rect(left, top, s.width, s.height);
        ctx.clip();
      }
      // Characters keep their feet on the anchor line; other kinds are centered in their box.
      const dx = left + (s.width - dw) / 2;
      const dy = o.kind === "character" ? top + (s.height - dh) : top + (s.height - dh) / 2;
      ctx.drawImage(cached.img, dx, dy, dw, dh);
    } else {
      this.drawPlaceholder(ctx, o, left, top, s.width, s.height, cached ? (cached.status === "loading" ? "Loading asset…" : "Asset failed to load") : "No visual asset");
    }
    ctx.restore();
  }

  private drawPlaceholder(ctx: CanvasRenderingContext2D, o: AnimObject, x: number, y: number, w: number, h: number, note: string): void {
    ctx.fillStyle = "rgba(24,24,32,0.85)";
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(161,161,170,0.7)";
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#d4d4d8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.max(14, Math.min(40, h / 8));
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.fillText(o.label.slice(0, 40), x + w / 2, y + h / 2 - size * 0.6, w - 12);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = `${size * 0.7}px system-ui, sans-serif`;
    ctx.fillText(note, x + w / 2, y + h / 2 + size * 0.7, w - 12);
  }

  private drawPathOverlay(ctx: CanvasRenderingContext2D, doc: AnimationDocument, world: Mat): void {
    if (!this.pathOverlayId) return;
    const paths = doc.motion_paths.filter((p) => p.object_id === this.pathOverlayId);
    if (paths.length === 0) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const p of paths) {
      ctx.strokeStyle = p.enabled ? "rgba(250,204,21,0.9)" : "rgba(161,161,170,0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      const N = 80;
      for (let i = 0; i <= N; i++) {
        samplePathAtFraction(p, i / N, this.scratch);
        const sp = this.apply(world, this.scratch.x, this.scratch.y);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      p.points.forEach((pt, i) => {
        const sp = this.apply(world, pt.x, pt.y);
        ctx.fillStyle = i === 0 ? "#22c55e" : i === p.points.length - 1 ? "#ef4444" : "#facc15";
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  /** Hit test path waypoints of the overlaid object. Returns pathId/pointId. */
  hitTestWaypoint(sx: number, sy: number): { pathId: string; pointId: string } | null {
    if (!this.doc || !this.state || !this.pathOverlayId) return null;
    const world = this.fullMatrix();
    for (const p of this.doc.motion_paths) {
      if (p.object_id !== this.pathOverlayId) continue;
      for (const pt of p.points) {
        const sp = this.apply(world, pt.x, pt.y);
        if (Math.hypot(sx - sp.x, sy - sp.y) <= 8) return { pathId: p.id, pointId: pt.id };
      }
    }
    return null;
  }

  private drawSelection(ctx: CanvasRenderingContext2D, world: Mat, state: EvaluatedState): void {
    if (!this.selectedId) return;
    const s = state.objects.get(this.selectedId);
    if (!s) return;
    const m = mul(world, objectMatrix(s));
    const l = -s.anchor_x * s.width;
    const t = -s.anchor_y * s.height;
    const pts = [this.apply(m, l, t), this.apply(m, l + s.width, t), this.apply(m, l + s.width, t + s.height), this.apply(m, l, t + s.height)];
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    const corner = pts[2];
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(corner.x - 5, corner.y - 5, 10, 10);
    const rot = this.apply(m, l + s.width / 2, t - 28 / Math.max(0.1, this.view.zoom));
    const topMid = this.apply(m, l + s.width / 2, t);
    ctx.beginPath();
    ctx.moveTo(topMid.x, topMid.y);
    ctx.lineTo(rot.x, rot.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rot.x, rot.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Release GPU/CPU resources and pending frames. */
  dispose(): void {
    this.disposed = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    for (const c of this.images.values()) {
      c.img.onload = null;
      c.img.onerror = null;
    }
    this.images.clear();
  }
}
