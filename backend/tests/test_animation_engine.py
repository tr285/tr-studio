"""
Integration Tests for TR STUDIO Step 6 — Professional 2D Animation Engine.
Covers:
1. Animation document retrieval and auto-initialization from Step 5 scene
2. Animation document persistence and schema validation
3. Concurrency protection (version_number collision detection)
4. Animation reset to match latest scene composition
5. Preset listing and preset application
6. Cross-user access prevention (403 Forbidden)
7. AI animation assist missing-key handling (503 AI_NOT_CONFIGURED)
8. AI animation assist timeout (504), rate limit (429), and malformed response (502) handling
9. Valid AI animation proposal (non-destructive review first, then apply)
"""

import uuid
from typing import Any, Dict, Tuple

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.exceptions import AIProviderException
from app.main import app
from app.services.ai_provider import AIStoryProvider

client = TestClient(app)


def _register_and_login(prefix: str) -> dict:
    uid = uuid.uuid4().hex[:8]
    email = f"{prefix}_{uid}@trstudio.dev"
    username = f"{prefix}_{uid}"
    password = "SecurePassword123!"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert reg.status_code == 201, reg.text
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_project_story_and_scene(headers: dict) -> Tuple[str, str, str]:
    proj_res = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "title": "Animation Studio Project",
            "description": "Step 6 2D Animation Engine test project",
            "genre": "Anime",
            "animation_style": "2D Animation",
        },
    )
    assert proj_res.status_code == 201, proj_res.text
    project_id = proj_res.json()["id"]

    story_res = client.post(
        "/api/v1/stories",
        headers=headers,
        json={
            "project_id": project_id,
            "title": "Starlight Odyssey",
            "idea": "An animated sci-fi adventure exploring ancient celestial ruins.",
            "logline": "Two adventurers activate an ancient stargate.",
            "summary": "Kaelen and Lyra unlock the celestial rings.",
            "genre": "Sci-Fi",
            "animation_style": "Anime",
            "target_audience": "Teens",
            "duration_minutes": 2,
            "language": "English",
            "main_character_count": 2,
            "tone": "Exciting",
            "complexity": "Medium",
            "ending_type": "Triumphant",
        },
    )
    assert story_res.status_code == 201, story_res.text
    story_id = story_res.json()["id"]

    # Create scene via Scene Builder
    scene_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
        json={
            "title": "Stargate Activation",
            "scene_type": "Action / Confrontation",
            "summary": "The ring spins rapidly as particles converge.",
            "duration_seconds": 6,
        },
    )
    assert scene_res.status_code == 201, scene_res.text
    scene_id = scene_res.json()["id"]

    return project_id, story_id, scene_id


def test_animation_document_get_or_create_and_persistence() -> None:
    headers = _register_and_login("anim_crud")
    project_id, story_id, scene_id = _create_project_story_and_scene(headers)

    # 1. GET animation -> should auto-initialize document from Step 5 scene
    get_res = client.get(f"/api/v1/scenes/{scene_id}/animation", headers=headers)
    assert get_res.status_code == 200, get_res.text
    anim_data = get_res.json()
    assert anim_data["scene_id"] == scene_id
    assert anim_data["story_id"] == story_id
    assert anim_data["project_id"] == project_id
    assert anim_data["version_number"] == 1
    assert anim_data["fps"] == 24
    assert anim_data["duration_ms"] == 6000  # 6s * 1000
    doc = anim_data["document"]
    assert doc["schema_version"] == "1.0"
    assert "camera" in doc
    assert "objects" in doc
    assert isinstance(doc["tracks"], list)

    # 2. Modify document and save
    doc["tracks"].append({
        "id": "trk_custom_x",
        "target_id": "obj_scene_environment",
        "property": "x",
        "enabled": True,
        "metadata": {},
        "keyframes": [
            {"id": "kf1", "time_ms": 0, "value": 960.0, "interpolation": "linear"},
            {"id": "kf2", "time_ms": 2000, "value": 1160.0, "interpolation": "ease-in-out"},
        ],
    })
    save_res = client.put(
        f"/api/v1/scenes/{scene_id}/animation",
        headers=headers,
        json={"document": doc, "expected_version_number": 1},
    )
    assert save_res.status_code == 200, save_res.text
    saved_data = save_res.json()
    assert saved_data["version_number"] == 2
    assert len(saved_data["document"]["tracks"]) == 1

    # 3. Concurrency check: saving with outdated expected_version_number -> 409 Conflict
    conflict_res = client.put(
        f"/api/v1/scenes/{scene_id}/animation",
        headers=headers,
        json={"document": doc, "expected_version_number": 1},  # Still passes 1 while db is 2
    )
    assert conflict_res.status_code == 409
    assert conflict_res.json()["error_code"] == "CONFLICT"

    # 4. Reset animation document -> clears tracks and increments version
    reset_res = client.post(f"/api/v1/scenes/{scene_id}/animation/reset", headers=headers)
    assert reset_res.status_code == 200
    reset_data = reset_res.json()
    assert reset_data["version_number"] == 3
    assert len(reset_data["document"]["tracks"]) == 0


def test_presets_listing_and_application() -> None:
    headers = _register_and_login("anim_preset")
    project_id, story_id, scene_id = _create_project_story_and_scene(headers)

    # 1. List presets
    presets_res = client.get("/api/v1/animation/presets")
    assert presets_res.status_code == 200, presets_res.text
    presets = presets_res.json()
    assert len(presets) >= 20
    preset_ids = {p["id"] for p in presets}
    assert "fade-in" in preset_ids
    assert "slide-right" in preset_ids
    assert "camera-pan" in preset_ids
    assert "walk" in preset_ids
    assert "jump" in preset_ids

    # 2. Apply slide-right preset
    apply_res = client.post(
        f"/api/v1/scenes/{scene_id}/animation/apply-preset",
        headers=headers,
        json={
            "preset_id": "slide-right",
            "target_id": "obj_scene_environment",
            "start_ms": 0,
            "duration_ms": 1500,
            "distance": 250.0,
        },
    )
    assert apply_res.status_code == 200, apply_res.text
    data = apply_res.json()
    doc = data["document"]
    tr = next((t for t in doc["tracks"] if t["target_id"] == "obj_scene_environment" and t["property"] == "x"), None)
    assert tr is not None
    assert len(tr["keyframes"]) >= 2

    # 3. Apply camera-pan preset
    cam_res = client.post(
        f"/api/v1/scenes/{scene_id}/animation/apply-preset",
        headers=headers,
        json={
            "preset_id": "camera-pan",
            "target_id": "camera",
            "start_ms": 500,
            "duration_ms": 2000,
            "distance": 350.0,
        },
    )
    assert cam_res.status_code == 200, cam_res.text
    cam_doc = cam_res.json()["document"]
    cam_tr = next((t for t in cam_doc["tracks"] if t["target_id"] == "camera" and t["property"] == "camera_x"), None)
    assert cam_tr is not None


def test_cross_user_access_prevention() -> None:
    headers_owner = _register_and_login("anim_owner")
    headers_intruder = _register_and_login("anim_intruder")

    project_id, _, scene_id = _create_project_story_and_scene(headers_owner)

    # Intruder tries to get scene animation
    get_res = client.get(f"/api/v1/scenes/{scene_id}/animation", headers=headers_intruder)
    assert get_res.status_code == 403

    # Intruder tries to save animation
    put_res = client.put(
        f"/api/v1/scenes/{scene_id}/animation",
        headers=headers_intruder,
        json={"document": {"schema_version": "1.0"}},
    )
    assert put_res.status_code == 403

    # Intruder tries to apply preset
    preset_res = client.post(
        f"/api/v1/scenes/{scene_id}/animation/apply-preset",
        headers=headers_intruder,
        json={
            "preset_id": "slide-left",
            "target_id": "hero",
            "start_ms": 0,
            "duration_ms": 1000,
        },
    )
    assert preset_res.status_code == 403

    # Intruder tries to trigger AI assist on owner's project
    ai_res = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-assist",
        headers=headers_intruder,
        json={"action": "suggest_animation_sequence", "scene_id": scene_id},
    )
    assert ai_res.status_code == 403


def test_ai_animation_assist_error_handling_and_proposal_review(monkeypatch) -> None:
    headers = _register_and_login("anim_ai")
    project_id, _, scene_id = _create_project_story_and_scene(headers)

    settings = get_settings()

    # 1. Missing API key -> 503 AI_NOT_CONFIGURED
    monkeypatch.setattr(settings, "AI_API_KEY", "")
    res_no_key = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-assist",
        headers=headers,
        json={"action": "suggest_animation_sequence", "scene_id": scene_id},
    )
    assert res_no_key.status_code == 503, res_no_key.text
    assert res_no_key.json()["error_code"] == "AI_NOT_CONFIGURED"

    monkeypatch.setattr(settings, "AI_API_KEY", "test-key-step6")

    # 2. Timeout -> 504 AI_TIMEOUT
    class TimeoutProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
            raise AIProviderException(
                detail="Simulated animation AI timeout",
                status_code=504,
                error_code="AI_TIMEOUT",
            )

    monkeypatch.setattr(
        "app.services.animation_service.get_ai_story_provider",
        lambda _cfg=None: TimeoutProvider(settings),
    )
    res_timeout = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-assist",
        headers=headers,
        json={"action": "suggest_character_movement", "scene_id": scene_id},
    )
    assert res_timeout.status_code == 504
    assert res_timeout.json()["error_code"] == "AI_TIMEOUT"

    # 3. Rate Limit -> 429 AI_RATE_LIMITED
    class RateLimitProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
            raise AIProviderException(
                detail="Simulated rate limit",
                status_code=429,
                error_code="AI_RATE_LIMITED",
            )

    monkeypatch.setattr(
        "app.services.animation_service.get_ai_story_provider",
        lambda _cfg=None: RateLimitProvider(settings),
    )
    res_rl = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-assist",
        headers=headers,
        json={"action": "suggest_character_movement", "scene_id": scene_id},
    )
    assert res_rl.status_code == 429
    assert res_rl.json()["error_code"] == "AI_RATE_LIMITED"

    # 4. Malformed JSON -> 502 AI_INVALID_JSON
    class MalformedProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> str:
            return "NOT VALID JSON AT ALL"

    monkeypatch.setattr(
        "app.services.animation_service.get_ai_story_provider",
        lambda _cfg=None: MalformedProvider(settings),
    )
    res_bad_json = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-assist",
        headers=headers,
        json={"action": "suggest_character_movement", "scene_id": scene_id},
    )
    assert res_bad_json.status_code == 502
    assert res_bad_json.json()["error_code"] == "AI_INVALID_JSON"

    # 5. Valid AI proposal with review-first workflow
    class ValidAnimationAIProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
            return {
                "summary_of_suggestions": "Dramatic approach towards stargate with camera push-in.",
                "suggested_preset_id": "walk",
                "explanation": "Builds tension as characters approach the active portal.",
                "proposed_tracks": [
                    {
                        "target_id": "obj_scene_environment",
                        "property": "x",
                        "keyframes": [
                            {"time_ms": 0, "value": 0.0, "interpolation": "ease-in-out"},
                            {"time_ms": 2500, "value": 300.0, "interpolation": "linear"},
                        ],
                    }
                ],
                "proposed_camera_tracks": [
                    {
                        "target_id": "camera",
                        "property": "camera_zoom",
                        "keyframes": [
                            {"time_ms": 0, "value": 1.0, "interpolation": "ease-in-out"},
                            {"time_ms": 3000, "value": 1.35, "interpolation": "linear"},
                        ],
                    }
                ],
            }

    monkeypatch.setattr(
        "app.services.animation_service.get_ai_story_provider",
        lambda _cfg=None: ValidAnimationAIProvider(settings),
    )

    prop_res = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-assist",
        headers=headers,
        json={"action": "suggest_animation_sequence", "scene_id": scene_id, "apply_immediately": False},
    )
    assert prop_res.status_code == 200, prop_res.text
    prop_data = prop_res.json()
    assert prop_data["applied"] is False
    assert len(prop_data["proposed_tracks"]) == 1
    assert len(prop_data["proposed_camera_tracks"]) == 1

    # Verify scene animation is still untouched (review first!)
    anim_check = client.get(f"/api/v1/scenes/{scene_id}/animation", headers=headers).json()
    assert len(anim_check["document"]["tracks"]) == 0

    # 6. Apply user-approved proposal
    apply_res = client.post(
        f"/api/v1/projects/{project_id}/animation/ai-apply",
        headers=headers,
        json={
            "action": "suggest_animation_sequence",
            "scene_id": scene_id,
            "accepted_tracks": prop_data["proposed_tracks"],
            "accepted_camera_tracks": prop_data["proposed_camera_tracks"],
            "overwrite_existing": False,
        },
    )
    assert apply_res.status_code == 200, apply_res.text
    updated_doc = apply_res.json()["document"]
    assert len(updated_doc["tracks"]) == 2  # 1 object track + 1 camera track

    # 7. List animation jobs
    jobs_res = client.get(f"/api/v1/projects/{project_id}/animation-jobs", headers=headers)
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) >= 1
    assert jobs[0]["status"] == "completed"


def test_step7_multitrack_timeline_clips_markers_groups_persistence() -> None:
    headers = _register_and_login("step7_timeline")
    _proj_id, _story_id, scene_id = _create_project_story_and_scene(headers)

    # 1. Fetch initial document -> carries clips, markers, groups
    get_res = client.get(f"/api/v1/scenes/{scene_id}/animation", headers=headers)
    assert get_res.status_code == 200
    doc = get_res.json()["document"]
    assert "clips" in doc
    assert "markers" in doc
    assert "groups" in doc

    # 2. Add Track with Step 7 attributes, clips, markers, groups
    doc["tracks"].append({
        "id": "trk_hero_motion",
        "target_id": "obj_scene_environment",
        "property": "x",
        "enabled": True,
        "name": "Hero Motion Track",
        "track_type": "character",
        "color": "#10b981",
        "locked": False,
        "muted": False,
        "order": 0,
        "metadata": {},
        "keyframes": [
            {"id": "kf_1", "time_ms": 0, "value": 100.0, "interpolation": "linear"},
            {"id": "kf_2", "time_ms": 1000, "value": 300.0, "interpolation": "ease-in-out"},
        ],
    })
    doc["clips"].append({
        "id": "clp_run_cycle",
        "track_id": "trk_hero_motion",
        "name": "Run Cycle 01",
        "start_ms": 0,
        "duration_ms": 2000,
        "source_start_ms": 0,
        "color": "#10b981",
    })
    doc["markers"].append({
        "id": "mrk_jump_peak",
        "name": "Jump Apex",
        "time_ms": 500,
        "color": "#f59e0b",
        "description": "Character reaches highest altitude",
        "event_type": "vfx_cue",
    })
    doc["groups"].append({
        "id": "grp_hero_rig",
        "name": "Hero Controls",
        "color": "#6366f1",
        "collapsed": False,
        "track_ids": ["trk_hero_motion"],
    })

    save_res = client.put(
        f"/api/v1/scenes/{scene_id}/animation",
        headers=headers,
        json={"document": doc, "expected_version_number": 1},
    )
    assert save_res.status_code == 200, save_res.text
    saved = save_res.json()
    assert saved["version_number"] == 2
    saved_doc = saved["document"]
    assert len(saved_doc["tracks"]) == 1
    assert saved_doc["tracks"][0]["name"] == "Hero Motion Track"
    assert saved_doc["tracks"][0]["track_type"] == "character"
    assert len(saved_doc["clips"]) == 1
    assert saved_doc["clips"][0]["name"] == "Run Cycle 01"
    assert len(saved_doc["markers"]) == 1
    assert saved_doc["markers"][0]["name"] == "Jump Apex"
    assert len(saved_doc["groups"]) == 1
    assert saved_doc["groups"][0]["name"] == "Hero Controls"

    # 3. Force overwrite with expected_version_number = None
    saved_doc["clips"][0]["name"] = "Run Cycle 01 (Overwritten)"
    overwrite_res = client.put(
        f"/api/v1/scenes/{scene_id}/animation",
        headers=headers,
        json={"document": saved_doc, "expected_version_number": None},
    )
    assert overwrite_res.status_code == 200, overwrite_res.text
    assert overwrite_res.json()["version_number"] == 3
    assert overwrite_res.json()["document"]["clips"][0]["name"] == "Run Cycle 01 (Overwritten)"
