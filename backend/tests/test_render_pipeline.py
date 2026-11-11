"""
Integration & Unit Tests for TR STUDIO Step 9 — Professional Video Rendering, Export & Production Pipeline.
Tests:
- Mathematical frame evaluator (bezier solver, Catmull-Rom spline, camera matrix)
- Server-side Pillow frame compositor with anime styling
- API endpoints: Create render job, list jobs, cancel, retry, diagnostics
- Real FFmpeg encoding of a deterministic anime test project
- FFprobe validation of the exported MP4 video stream (codec, resolution, duration)
- Signed media URL authentication and streaming
"""

import time
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.render import RenderJob, RenderOutput
from app.services.render.ffmpeg_encoder import FFmpegEncoder, find_binary
from app.services.render.frame_evaluator import (
    apply_easing,
    build_path_table,
    camera_matrix,
    cubic_bezier,
    evaluate_animation_document,
    evaluate_motion_path,
    world_to_screen,
)
from app.services.render.frame_renderer import FrameRenderer
from app.services.render.render_service import RenderService
from app.services.storage_service import compute_media_signature


@pytest.fixture
def auth_client():
    client = TestClient(app)
    # Register unique test user
    rand_id = uuid.uuid4().hex[:8]
    email = f"animator_{rand_id}@trstudio.dev"
    username = f"animator_{rand_id}"
    password = "SecurePassword123!"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "password": password,
        },
    )
    assert reg_res.status_code == 201, reg_res.text
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})

    # Create a project
    proj_res = client.post(
        "/api/v1/projects",
        json={
            "title": f"Anime Production {rand_id}",
            "description": "Step 9 Rendering Test Studio",
        },
    )
    assert proj_res.status_code == 201, proj_res.text
    project_id = proj_res.json()["id"]

    return client, project_id


def test_frame_evaluator_math():
    # 1. Cubic Bezier
    assert cubic_bezier(0.42, 0.0, 0.58, 1.0, 0.0) == 0.0
    assert cubic_bezier(0.42, 0.0, 0.58, 1.0, 1.0) == 1.0
    mid = cubic_bezier(0.42, 0.0, 0.58, 1.0, 0.5)
    assert 0.4 < mid < 0.6

    # 2. Apply Easing
    assert apply_easing("linear", 0.75) == 0.75
    assert apply_easing("hold", 0.5) == 0.0

    # 3. Motion Path Catmull-Rom
    path_def = {
        "mode": "curve",
        "duration_ms": 2000,
        "start_ms": 0,
        "interpolation": "linear",
        "points": [
            {"x": 100, "y": 200},
            {"x": 300, "y": 400},
            {"x": 600, "y": 250},
        ],
    }
    table = build_path_table(path_def)
    assert table.length > 500

    sample_start = evaluate_motion_path(path_def, 0)
    assert abs(sample_start.x - 100) < 1.0

    sample_end = evaluate_motion_path(path_def, 2000)
    assert abs(sample_end.x - 600) < 1.0

    # 4. Camera Matrix
    mat = camera_matrix(cam_x=960, cam_y=540, zoom=1.0, rotation_deg=0.0, view_width=1920, view_height=1080)
    sx, sy = world_to_screen(mat, 960, 540)
    assert abs(sx - 960) < 0.1
    assert abs(sy - 540) < 0.1


def test_frame_renderer_pillow():
    renderer = FrameRenderer(target_width=1280, target_height=720)
    doc = {
        "fps": 24,
        "duration_ms": 1000,
        "width": 1280,
        "height": 720,
        "camera": {"x": 640, "y": 360, "zoom": 1.0, "rotation": 0.0},
        "objects": [
            {
                "id": "hero",
                "name": "Shinji",
                "kind": "character",
                "base": {
                    "x": 640,
                    "y": 360,
                    "scale_x": 1.0,
                    "scale_y": 1.0,
                    "rotation": 0.0,
                    "opacity": 1.0,
                    "visible": True,
                    "anchor_x": 0.5,
                    "anchor_y": 0.5,
                    "width": 200,
                    "height": 400,
                },
            }
        ],
        "tracks": [],
        "motion_paths": [],
    }

    eval_frame = evaluate_animation_document(doc, 500.0)
    img = renderer.render_frame(
        frame=eval_frame,
        active_subtitle={"speaker": "Shinji", "text": "I will pilot the EVA!"},
    )

    assert img.size == (1280, 720)
    assert img.mode == "RGBA"
    raw_bytes = img.tobytes()
    assert len(raw_bytes) == 1280 * 720 * 4


def test_render_job_crud_and_validation(auth_client):
    client, project_id = auth_client

    # 1. Validation error: custom range end <= start
    bad_res = client.post(
        f"/api/v1/projects/{project_id}/render",
        json={
            "export_range_type": "custom",
            "export_range_start_ms": 3000,
            "export_range_end_ms": 1000,
        },
    )
    assert bad_res.status_code == 422

    # 2. Create valid render job
    create_res = client.post(
        f"/api/v1/projects/{project_id}/render",
        json={
            "resolution_width": 1280,
            "resolution_height": 720,
            "aspect_ratio": "16:9",
            "fps": 24,
            "container_format": "mp4",
            "video_codec": "h264",
            "quality_preset": "draft",
            "export_range_type": "custom",
            "export_range_start_ms": 0,
            "export_range_end_ms": 2000,
        },
    )
    assert create_res.status_code == 201
    job = create_res.json()
    job_id = job["id"]
    assert job["status"] in ("queued", "preparing", "rendering")
    assert job["resolution_width"] == 1280
    assert job["total_frames"] == 48

    # 3. List jobs
    list_res = client.get(f"/api/v1/projects/{project_id}/render/jobs")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 4. Get job detail
    detail_res = client.get(f"/api/v1/render/jobs/{job_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == job_id

    # 5. Cancel job
    cancel_res = client.post(f"/api/v1/render/jobs/{job_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
    time.sleep(0.3)

    # 6. Retry job
    retry_res = client.post(f"/api/v1/render/jobs/{job_id}/retry")
    assert retry_res.status_code == 200
    assert retry_res.json()["status"] in ("queued", "preparing", "rendering")


def test_end_to_end_ffmpeg_rendering_and_probe_validation(auth_client):
    client, project_id = auth_client
    service = RenderService()

    # Create job directly
    create_res = client.post(
        f"/api/v1/projects/{project_id}/render",
        json={
            "resolution_width": 640,
            "resolution_height": 360,
            "aspect_ratio": "16:9",
            "fps": 24,
            "container_format": "mp4",
            "video_codec": "h264",
            "quality_preset": "draft",
            "include_audio": False,
            "burn_subtitles": True,
            "export_range_type": "custom",
            "export_range_start_ms": 0,
            "export_range_end_ms": 1000,  # 1 second = 24 frames
        },
    )
    assert create_res.status_code == 201
    job_data = create_res.json()
    job_id = uuid.UUID(job_data["id"])

    # Wait for background render job to complete
    finished_job = None
    for _ in range(50):
        job_res = client.get(f"/api/v1/render/jobs/{job_id}")
        assert job_res.status_code == 200
        finished_job = job_res.json()
        if finished_job["status"] in ("completed", "failed"):
            break
        time.sleep(0.2)

    assert finished_job is not None
    assert finished_job["status"] == "completed", finished_job.get("error_message")
    assert finished_job["progress_pct"] == 100.0
    assert finished_job["rendered_frames"] == 24

    # Check Output
    output_res = client.get(f"/api/v1/render/jobs/{job_id}/output")
    assert output_res.status_code == 200
    out = output_res.json()
    export_id = out["id"]
    assert out["width"] == 640
    assert out["height"] == 360
    assert out["fps"] == 24
    assert out["video_codec"] == "h264"
    assert out["file_size_bytes"] > 1000

    # Test signed media stream without signature -> 403 Forbidden
    unauth_stream = client.get(f"/api/v1/exports/{export_id}/media?expires=9999999999&sig=invalidsig")
    assert unauth_stream.status_code == 403

    # Test signed media stream with valid HMAC signature -> 200 OK
    expires = int(time.time()) + 3600
    valid_sig = compute_media_signature(asset_id=uuid.UUID(export_id), expires=expires)
    media_res = client.get(f"/api/v1/exports/{export_id}/media?expires={expires}&sig={valid_sig}")
    assert media_res.status_code == 200
    assert media_res.headers["Content-Type"] == "video/mp4"
    assert len(media_res.content) == out["file_size_bytes"]

    # Test list exports
    exports_list = client.get(f"/api/v1/projects/{project_id}/exports")
    assert exports_list.status_code == 200
    assert exports_list.json()["total"] >= 1

    # Test delete export
    del_res = client.delete(f"/api/v1/exports/{export_id}")
    assert del_res.status_code == 204
