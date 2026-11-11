"""
Pure Python animation document evaluator for TR STUDIO Step 9.
Exact 1:1 mathematical equivalent of packages/animation-engine/src/evaluate.ts.
Evaluates keyframe tracks, bezier/cubic curves, Catmull-Rom motion paths, and camera matrices.
"""

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union


BEZIER_PRESETS = {
    "ease-in": (0.42, 0.0, 1.0, 1.0),
    "ease-out": (0.0, 0.0, 0.58, 1.0),
    "ease-in-out": (0.42, 0.0, 0.58, 1.0),
}

CAMERA_TARGET = "__camera__"
SAMPLES_PER_SEGMENT = 24


def ms_to_frame(ms: float, fps: int) -> int:
    return round((ms * fps) / 1000.0)


def frame_to_ms(frame: int, fps: int) -> int:
    return round((frame * 1000.0) / fps)


def cubic_bezier(x1: float, y1: float, x2: float, y2: float, x: float) -> float:
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0

    cx = 3.0 * x1
    bx = 3.0 * (x2 - x1) - cx
    ax = 1.0 - cx - bx

    cy = 3.0 * y1
    by = 3.0 * (y2 - y1) - cy
    ay = 1.0 - cy - by

    def sample_x(t: float) -> float:
        return ((ax * t + bx) * t + cx) * t

    def sample_y(t: float) -> float:
        return ((ay * t + by) * t + cy) * t

    def slope_x(t: float) -> float:
        return (3.0 * ax * t + 2.0 * bx) * t + cx

    # Newton-Raphson
    t = x
    for _ in range(8):
        err = sample_x(t) - x
        if abs(err) < 1e-7:
            return sample_y(t)
        d = slope_x(t)
        if abs(d) < 1e-6:
            break
        t -= err / d

    # Bisection fallback
    lo = 0.0
    hi = 1.0
    t = x
    for _ in range(40):
        v = sample_x(t)
        if abs(v - x) < 1e-7:
            break
        if v < x:
            lo = t
        else:
            hi = t
        t = (lo + hi) / 2.0
    return sample_y(t)


def apply_easing(
    mode: str,
    t: float,
    bezier: Optional[Dict[str, float]] = None,
) -> float:
    x = max(0.0, min(1.0, t))
    if mode == "hold":
        return 0.0
    if mode == "linear":
        return x
    if mode in BEZIER_PRESETS:
        bx1, by1, bx2, by2 = BEZIER_PRESETS[mode]
        return cubic_bezier(bx1, by1, bx2, by2, x)
    if mode == "cubic-bezier" and bezier:
        return cubic_bezier(
            bezier.get("x1", 0.0),
            bezier.get("y1", 0.0),
            bezier.get("x2", 1.0),
            bezier.get("y2", 1.0),
            x,
        )
    return x


def find_keyframe_index(keyframes: List[Dict[str, Any]], t: float) -> int:
    lo = 0
    hi = len(keyframes) - 1
    ans = -1
    while lo <= hi:
        mid = (lo + hi) >> 1
        if keyframes[mid].get("time_ms", 0) <= t:
            ans = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return ans


def evaluate_track(track: Dict[str, Any], t: float) -> Any:
    kfs = track.get("keyframes", [])
    if not kfs:
        return None
    i = find_keyframe_index(kfs, t)
    if i < 0:
        return kfs[0].get("value")
    a = kfs[i]
    if i == len(kfs) - 1:
        return a.get("value")
    b = kfs[i + 1]

    val_a = a.get("value")
    val_b = b.get("value")
    interp = a.get("interpolation", "linear")

    if isinstance(val_a, bool) or isinstance(val_b, bool) or interp == "hold":
        return val_a

    span = b.get("time_ms", 0) - a.get("time_ms", 0)
    if span <= 0:
        return val_b

    p = apply_easing(interp, (t - a.get("time_ms", 0)) / float(span), a.get("easing"))
    return float(val_a) + (float(val_b) - float(val_a)) * p


def catmull_rom(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    t2 = t * t
    t3 = t2 * t
    return 0.5 * (
        2.0 * p1
        + (-p0 + p2) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    )


@dataclass
class PathTable:
    xs: List[float]
    ys: List[float]
    cum: List[float]
    length: float


def build_path_table(path: Dict[str, Any]) -> PathTable:
    pts = path.get("points", [])
    if not pts:
        return PathTable(xs=[0.0], ys=[0.0], cum=[0.0], length=0.0)
    if len(pts) == 1:
        return PathTable(
            xs=[pts[0].get("x", 0.0)],
            ys=[pts[0].get("y", 0.0)],
            cum=[0.0],
            length=0.0,
        )

    mode = path.get("mode", "curve")
    segs = len(pts) - 1
    per_seg = SAMPLES_PER_SEGMENT if mode == "curve" else 1
    n = segs * per_seg + 1

    xs = [0.0] * n
    ys = [0.0] * n
    cum = [0.0] * n

    xs[0] = pts[0].get("x", 0.0)
    ys[0] = pts[0].get("y", 0.0)
    idx = 0

    for s in range(segs):
        p0 = pts[max(0, s - 1)]
        p1 = pts[s]
        p2 = pts[s + 1]
        p3 = pts[min(len(pts) - 1, s + 2)]

        for k in range(1, per_seg + 1):
            t = k / float(per_seg)
            idx += 1
            if mode == "curve":
                xs[idx] = catmull_rom(p0["x"], p1["x"], p2["x"], p3["x"], t)
                ys[idx] = catmull_rom(p0["y"], p1["y"], p2["y"], p3["y"], t)
            else:
                xs[idx] = p2["x"]
                ys[idx] = p2["y"]
            dist = math.hypot(xs[idx] - xs[idx - 1], ys[idx] - ys[idx - 1])
            cum[idx] = cum[idx - 1] + dist

    return PathTable(xs=xs, ys=ys, cum=cum, length=cum[-1])


@dataclass
class PathSample:
    x: float
    y: float
    angle: float


def sample_path_at_fraction(table: PathTable, u: float) -> PathSample:
    f = max(0.0, min(1.0, u))
    if table.length <= 1e-9:
        return PathSample(x=table.xs[0], y=table.ys[0], angle=0.0)

    target = f * table.length
    lo = 0
    hi = len(table.cum) - 1
    while lo < hi:
        mid = (lo + hi) >> 1
        if table.cum[mid] < target:
            lo = mid + 1
        else:
            hi = mid

    i = max(1, lo)
    seg_len = table.cum[i] - table.cum[i - 1]
    r = (target - table.cum[i - 1]) / seg_len if seg_len > 1e-9 else 0.0
    x = table.xs[i - 1] + (table.xs[i] - table.xs[i - 1]) * r
    y = table.ys[i - 1] + (table.ys[i] - table.ys[i - 1]) * r
    dx = table.xs[i] - table.xs[i - 1]
    dy = table.ys[i] - table.ys[i - 1]
    angle = math.degrees(math.atan2(dy, dx))
    return PathSample(x=x, y=y, angle=angle)


def evaluate_motion_path(path: Dict[str, Any], t: float) -> PathSample:
    table = build_path_table(path)
    dur = float(path.get("duration_ms", 1000))
    start_ms = float(path.get("start_ms", 0))
    raw = (t - start_ms) / dur if dur > 0 else 0.0
    eased = apply_easing(path.get("interpolation", "linear"), raw, path.get("easing"))
    return sample_path_at_fraction(table, eased)


def camera_matrix(
    cam_x: float,
    cam_y: float,
    zoom: float,
    rotation_deg: float,
    view_width: float,
    view_height: float,
) -> List[float]:
    r = math.radians(rotation_deg)
    cos_r = math.cos(r)
    sin_r = math.sin(r)
    a = zoom * cos_r
    b = -zoom * sin_r
    c = zoom * sin_r
    d = zoom * cos_r
    tx = (view_width / 2.0) - (a * cam_x + c * cam_y)
    ty = (view_height / 2.0) - (b * cam_x + d * cam_y)
    return [a, b, c, d, tx, ty]


def world_to_screen(m: List[float], x: float, y: float) -> Tuple[float, float]:
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


@dataclass
class EvaluatedObjectState:
    id: str
    name: str
    kind: str
    asset_id: Optional[str]
    x: float
    y: float
    scale_x: float
    scale_y: float
    rotation: float
    opacity: float
    visible: bool
    anchor_x: float
    anchor_y: float
    width: float
    height: float
    z_index: int = 0


@dataclass
class EvaluatedCameraState:
    x: float
    y: float
    zoom: float
    rotation: float


@dataclass
class EvaluatedFrame:
    time_ms: float
    width: int
    height: int
    camera: EvaluatedCameraState
    objects: Dict[str, EvaluatedObjectState]


def evaluate_animation_document(doc: Dict[str, Any], t_ms: float) -> EvaluatedFrame:
    doc_width = int(doc.get("width", 1920))
    doc_height = int(doc.get("height", 1080))

    cam_dict = doc.get("camera", {})
    cam = EvaluatedCameraState(
        x=float(cam_dict.get("x", doc_width / 2.0)),
        y=float(cam_dict.get("y", doc_height / 2.0)),
        zoom=float(cam_dict.get("zoom", 1.0)),
        rotation=float(cam_dict.get("rotation", 0.0)),
    )

    objects: Dict[str, EvaluatedObjectState] = {}
    doc_objects = doc.get("objects", [])

    for idx, obj in enumerate(doc_objects):
        obj_id = obj.get("id", f"obj_{idx}")
        base = obj.get("base", {})
        objects[obj_id] = EvaluatedObjectState(
            id=obj_id,
            name=obj.get("name", f"Object {idx+1}"),
            kind=obj.get("kind", "character"),
            asset_id=obj.get("asset_id"),
            x=float(base.get("x", doc_width / 2.0)),
            y=float(base.get("y", doc_height / 2.0)),
            scale_x=float(base.get("scale_x", 1.0)),
            scale_y=float(base.get("scale_y", 1.0)),
            rotation=float(base.get("rotation", 0.0)),
            opacity=float(base.get("opacity", 1.0)),
            visible=bool(base.get("visible", True)),
            anchor_x=float(base.get("anchor_x", 0.5)),
            anchor_y=float(base.get("anchor_y", 0.5)),
            width=float(base.get("width", 200)),
            height=float(base.get("height", 200)),
            z_index=idx,
        )

    # Evaluate tracks
    for tr in doc.get("tracks", []):
        if not tr.get("enabled", True):
            continue
        v = evaluate_track(tr, t_ms)
        if v is None:
            continue
        target_id = tr.get("target_id")
        prop = tr.get("property")

        if target_id == CAMERA_TARGET:
            if prop == "camera_x":
                cam.x = float(v)
            elif prop == "camera_y":
                cam.y = float(v)
            elif prop == "camera_zoom":
                cam.zoom = float(v)
            elif prop == "camera_rotation":
                cam.rotation = float(v)
            continue

        obj_state = objects.get(target_id)
        if not obj_state:
            continue

        if prop == "x":
            obj_state.x = float(v)
        elif prop == "y":
            obj_state.y = float(v)
        elif prop == "scale_x":
            obj_state.scale_x = float(v)
        elif prop == "scale_y":
            obj_state.scale_y = float(v)
        elif prop == "rotation":
            obj_state.rotation = float(v)
        elif prop == "opacity":
            obj_state.opacity = float(v)
        elif prop == "visible":
            obj_state.visible = bool(v)
        elif prop == "anchor_x":
            obj_state.anchor_x = float(v)
        elif prop == "anchor_y":
            obj_state.anchor_y = float(v)

    # Evaluate motion paths
    for p in doc.get("motion_paths", []):
        if not p.get("enabled", True):
            continue
        obj_id = p.get("object_id")
        obj_state = objects.get(obj_id)
        if not obj_state:
            continue
        sample = evaluate_motion_path(p, t_ms)
        obj_state.x = sample.x
        obj_state.y = sample.y
        if p.get("orient_to_path", False):
            obj_state.rotation = sample.angle + float(p.get("orientation_offset_deg", 0.0))

    return EvaluatedFrame(
        time_ms=t_ms,
        width=doc_width,
        height=doc_height,
        camera=cam,
        objects=objects,
    )
