/**
 * Build / sync an AnimationDocument from a Step 5 scene. The engine only needs a minimal,
 * structural view of the scene so it stays decoupled from the web app's shared types.
 */
import type { AnimationDocument, AnimObject, ObjectKind } from "./schema.ts";
import { createEmptyDocument, defaultObjectBase, newId } from "./schema.ts";

export interface SceneLayerLike {
  id: string;
  layer_order: number;
  position_x: number; // percent 0..100
  position_y: number; // percent 0..100
  scale_percent: number;
}
export interface SceneCharacterLike extends SceneLayerLike {
  character_name: string;
}
export interface SceneAssetLike extends SceneLayerLike {
  label: string;
  layer_type: string;
}
export interface SceneLike {
  id: string;
  title: string;
  duration_seconds: number;
  character_assignments: SceneCharacterLike[];
  asset_assignments: SceneAssetLike[];
}

const KIND_BY_LAYER: Record<string, ObjectKind> = {
  background: "background",
  foreground: "foreground",
  prop: "prop",
  overlay: "overlay",
  lighting_ref: "overlay",
};

export const SCENE_ENV_OBJECT_ID = "obj_scene_environment";

function characterObject(c: SceneCharacterLike, width: number, height: number, order: number): AnimObject {
  const h = Math.max(40, height * 0.6 * (c.scale_percent / 100));
  return {
    id: `obj_char_${c.id}`,
    kind: "character",
    label: c.character_name,
    source_ref: { type: "scene_character", id: c.id },
    layer_order: order,
    // Characters stand on their (x, y) point: anchor at bottom-center, matching the scene composer.
    base: defaultObjectBase({ x: (c.position_x / 100) * width, y: (c.position_y / 100) * height, anchor_x: 0.5, anchor_y: 1, width: h * 0.6, height: h }),
  };
}

function assetObject(a: SceneAssetLike, width: number, height: number, order: number): AnimObject {
  const kind = KIND_BY_LAYER[a.layer_type] ?? "prop";
  const full = kind === "background";
  const w = full ? width : width * 0.3 * (a.scale_percent / 100);
  const h = full ? height : w;
  return {
    id: `obj_asset_${a.id}`,
    kind,
    label: a.label,
    source_ref: { type: "scene_asset", id: a.id },
    layer_order: order,
    base: defaultObjectBase({ x: full ? width / 2 : (a.position_x / 100) * width, y: full ? height / 2 : (a.position_y / 100) * height, width: w, height: h }),
  };
}

/** Create a fresh document for a scene (no animation yet). Objects mirror the scene composition. */
export function buildDocumentFromScene(scene: SceneLike, opts: { width?: number; height?: number; fps?: AnimationDocument["fps"] } = {}): AnimationDocument {
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const doc = createEmptyDocument(scene.id, {
    width,
    height,
    fps: opts.fps ?? 24,
    duration_ms: Math.min(600_000, Math.max(1000, Math.round(scene.duration_seconds * 1000))),
    camera: { x: width / 2, y: height / 2, zoom: 1, rotation: 0 },
  });
  return syncDocumentWithScene(doc, scene).doc;
}

/**
 * Add objects for scene layers that have none yet. Existing objects (and their animation) are never
 * modified. Returns ids of objects whose scene source no longer exists (orphans).
 */
export function syncDocumentWithScene(doc: AnimationDocument, scene: SceneLike): { doc: AnimationDocument; added: string[]; orphans: string[] } {
  const known = new Set(doc.objects.map((o) => `${o.source_ref?.type}:${o.source_ref?.id}`));
  const added: AnimObject[] = [];
  let order = doc.objects.reduce((m, o) => Math.max(m, o.layer_order), -1) + 1;

  const assets = [...scene.asset_assignments].sort((a, b) => a.layer_order - b.layer_order);
  const bg = assets.filter((a) => a.layer_type === "background");
  const behind = assets.filter((a) => a.layer_type !== "background" && a.layer_type !== "foreground" && a.layer_type !== "overlay");
  const front = assets.filter((a) => a.layer_type === "foreground" || a.layer_type === "overlay");
  const chars = [...scene.character_assignments].sort((a, b) => a.layer_order - b.layer_order);

  const push = (key: string, make: (o: number) => AnimObject) => {
    if (known.has(key)) return;
    added.push(make(order++));
    known.add(key);
  };
  bg.forEach((a) => push(`scene_asset:${a.id}`, (o) => assetObject(a, doc.width, doc.height, o)));
  behind.forEach((a) => push(`scene_asset:${a.id}`, (o) => assetObject(a, doc.width, doc.height, o)));
  chars.forEach((c) => push(`scene_character:${c.id}`, (o) => characterObject(c, doc.width, doc.height, o)));
  front.forEach((a) => push(`scene_asset:${a.id}`, (o) => assetObject(a, doc.width, doc.height, o)));

  // Environment fallback background when the scene has no explicit background layer
  const hasBackground = [...doc.objects, ...added].some((o) => o.kind === "background");
  if (!hasBackground && !known.has(`scene_environment:${scene.id}`)) {
    added.push({
      id: SCENE_ENV_OBJECT_ID,
      kind: "background",
      label: "Scene environment",
      source_ref: { type: "scene_environment", id: scene.id },
      layer_order: -1,
      base: defaultObjectBase({ x: doc.width / 2, y: doc.height / 2, width: doc.width, height: doc.height }),
    });
  }

  const live = new Set<string>([
    ...scene.asset_assignments.map((a) => `scene_asset:${a.id}`),
    ...scene.character_assignments.map((c) => `scene_character:${c.id}`),
    `scene_environment:${scene.id}`,
  ]);
  const orphans = doc.objects.filter((o) => o.source_ref && !live.has(`${o.source_ref.type}:${o.source_ref.id}`)).map((o) => o.id);
  if (added.length === 0) return { doc, added: [], orphans };
  // Normalize layer order to be dense & unique
  const all = [...doc.objects, ...added].sort((a, b) => a.layer_order - b.layer_order).map((o, i) => ({ ...o, layer_order: i }));
  return { doc: { ...doc, objects: all }, added: added.map((o) => o.id), orphans };
}

export function newObjectId(): string {
  return newId("obj");
}
