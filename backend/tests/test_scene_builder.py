"""
Automated Integration Tests for TR STUDIO Step 5 — Professional Scene Builder & Storyboard Studio.
Covers all 14 testing requirements in Section 14:
1. Scene CRUD operations
2. Scene duplication
3. Scene ordering
4. Shot CRUD and ordering
5. Scene character assignment (without duplicating Character records)
6. Scene environment assignment (without duplicating Environment records)
7. Scene asset assignment
8. Story synchronization (Step 2 Story + Step 3 Character + Step 4 Environment -> Step 5 Scene)
9. Cross-user access prevention (403 Forbidden)
10. Invalid or missing asset/character/environment references detection (no crash)
11. AI provider missing-key handling (503 AI_NOT_CONFIGURED)
12. AI provider timeout (504) and rate-limit (429) handling
13. AI response validation (malformed JSON 502 + valid non-destructive proposal & apply)
14. Preservation of existing story content across Step 2 and Step 5 updates
"""

import struct
from typing import Any, Dict, Tuple
import uuid
import zlib

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.exceptions import AIProviderException
from app.main import app
from app.services.ai_provider import AIStoryProvider

client = TestClient(app)


def _create_valid_png_bytes(width: int = 128, height: int = 72) -> bytes:
    """Create a valid minimal RGB PNG binary image of `width` x `height`."""

    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_scanlines = b"".join(b"\x00" + (b"\x1e\x29\x3b" * width) for _ in range(height))
    idat = zlib.compress(raw_scanlines)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", idat)
        + _chunk(b"IEND", b"")
    )


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


def _create_project_and_story(headers: dict, title: str = "Chronicles of Aethelgard") -> Tuple[str, str]:
    proj_res = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "title": title,
            "description": "Step 5 Scene Builder test project",
            "genre": "Fantasy",
            "animation_style": "Anime",
        },
    )
    assert proj_res.status_code == 201, proj_res.text
    project_id = proj_res.json()["id"]

    story_res = client.post(
        "/api/v1/stories",
        headers=headers,
        json={
            "project_id": project_id,
            "title": title,
            "idea": "A young archivist discovers a starlight compass in a sunken observatory.",
            "logline": "An archivist must restore the celestial clock before the eclipse.",
            "summary": "Kaelen journeys to the Sunken Observatory with Lyra to awaken the Astral Compass.",
            "genre": "Fantasy",
            "animation_style": "Anime",
            "target_audience": "Teens",
            "duration_minutes": 3,
            "language": "English",
            "main_character_count": 2,
            "tone": "Mysterious",
            "complexity": "Medium",
            "ending_type": "Hopeful",
        },
    )
    assert story_res.status_code == 201, story_res.text
    story_id = story_res.json()["id"]
    return project_id, story_id


def test_scene_crud_duplication_ordering_and_storyboard_overview() -> None:
    headers = _register_and_login("scene_crud")
    project_id, story_id = _create_project_and_story(headers)

    # 1. List initial scenes (1 default scene from story initialization)
    list_res = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
    )
    assert list_res.status_code == 200, list_res.text
    initial_scenes = list_res.json()
    assert len(initial_scenes) == 1
    scene_1_id = initial_scenes[0]["id"]

    # 2. Create a second scene with default shots seeded
    create_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
        json={
            "title": "Scene 2: The Sunken Observatory",
            "scene_type": "Action",
            "scene_heading": "INT. SUNKEN OBSERVATORY - NIGHT",
            "summary": "Kaelen unlocks the bronze astrolabe as water rises.",
            "description": "Bioluminescent runes pulse across the flooded marble floor.",
            "action_description": "Kaelen rotates the inner ring while Lyra holds the lantern.",
            "location_name": "Sunken Observatory",
            "time_of_day": "Night",
            "weather": "Rain",
            "mood": "Suspenseful",
            "duration_seconds": 45,
            "camera_framing": "Wide establishing shot",
            "transition_type": "Cross dissolve",
            "production_notes": "Add water reflection shimmer on bronze rings.",
            "storyboard_notes": "Start with high-angle crane down.",
            "characters": ["Kaelen", "Lyra"],
            "camera_directions": ["HIGH ANGLE CRANE DOWN", "CLOSE UP ON ASTROLABE"],
            "audio_directions": ["Echoing water droplets", "Low cello drone"],
            "visual_directions": ["Cyan rune glow against dark slate"],
            "emotional_directions": ["Urgent determination"],
            "seed_default_shots": True,
        },
    )
    assert create_res.status_code == 201, create_res.text
    scene_2 = create_res.json()
    scene_2_id = scene_2["id"]
    assert scene_2["scene_number"] == 2
    assert scene_2["scene_type"] == "Action"
    assert scene_2["time_of_day"] == "Night"
    assert scene_2["weather"] == "Rain"
    assert scene_2["mood"] == "Suspenseful"
    assert scene_2["transition_type"] == "Cross dissolve"
    assert len(scene_2["shots"]) == 2
    assert scene_2["thumbnail_url"] is None  # Honest placeholder when no asset is attached

    # 3. Update Scene 2 metadata & dialogue
    patch_res = client.patch(
        f"/api/v1/scene-builder/{scene_2_id}",
        headers=headers,
        json={
            "title": "Scene 2: Awakening the Astrolabe",
            "mood": "Epic",
            "duration_seconds": 50,
            "dialogue": [
                {
                    "character_name": "Kaelen",
                    "line": "The constellations align with the third ring!",
                    "emotion": "Focused",
                    "delivery_direction": "Whispering over the rushing water",
                }
            ],
        },
    )
    assert patch_res.status_code == 200, patch_res.text
    updated_s2 = patch_res.json()
    assert updated_s2["title"] == "Scene 2: Awakening the Astrolabe"
    assert updated_s2["mood"] == "Epic"
    assert updated_s2["duration_seconds"] == 50
    assert len(updated_s2["dialogue"]) == 1
    assert updated_s2["dialogue"][0]["character_name"] == "Kaelen"

    # 4. Duplicate Scene 2 (should copy shots and renumber scenes)
    dup_res = client.post(
        f"/api/v1/scene-builder/{scene_2_id}/duplicate",
        headers=headers,
    )
    assert dup_res.status_code == 201, dup_res.text
    scene_3 = dup_res.json()
    scene_3_id = scene_3["id"]
    assert scene_3["scene_number"] == 3
    assert "(Copy)" in scene_3["title"]
    assert len(scene_3["shots"]) == 2

    # 5. Reorder scenes: [scene_2, scene_3, scene_1]
    reorder_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/reorder",
        headers=headers,
        json={"scene_ids": [scene_2_id, scene_3_id, scene_1_id]},
    )
    assert reorder_res.status_code == 200, reorder_res.text
    reordered = reorder_res.json()
    assert [s["id"] for s in reordered] == [scene_2_id, scene_3_id, scene_1_id]
    assert [s["scene_number"] for s in reordered] == [1, 2, 3]

    # 6. Check Storyboard Overview endpoint
    sb_res = client.get(
        f"/api/v1/projects/{project_id}/storyboard",
        headers=headers,
    )
    assert sb_res.status_code == 200, sb_res.text
    sb = sb_res.json()
    assert sb["total_scenes"] == 3
    assert sb["total_shots"] == 4
    assert sb["cards"][0]["id"] == scene_2_id
    assert sb["cards"][0]["has_actual_asset"] is False

    # 7. Delete duplicated scene_3 and verify remaining scenes renumber to [1, 2]
    del_res = client.delete(
        f"/api/v1/scene-builder/{scene_3_id}",
        headers=headers,
    )
    assert del_res.status_code == 204
    after_del = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
    ).json()
    assert len(after_del) == 2
    assert [s["scene_number"] for s in after_del] == [1, 2]


def test_shot_list_crud_and_reordering() -> None:
    headers = _register_and_login("shot_crud")
    project_id, _ = _create_project_and_story(headers)

    scenes = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
    ).json()
    scene_id = scenes[0]["id"]

    # Create 3 shots
    shot_a = client.post(
        f"/api/v1/scene-builder/{scene_id}/shots",
        headers=headers,
        json={
            "title": "Establishing Wide — Observatory Dome",
            "description": "Camera pans across the cracked glass dome.",
            "shot_type": "establishing",
            "camera_perspective": "Wide establishing shot",
            "character_focus": ["Kaelen"],
            "visual_direction": "Moonlight beams through mist",
            "duration_seconds": 6,
            "production_notes": "Use 3-layer parallax mist",
        },
    )
    assert shot_a.status_code == 201, shot_a.text
    shot_a_id = shot_a.json()["id"]
    assert shot_a.json()["shot_number"] == 1

    shot_b = client.post(
        f"/api/v1/scene-builder/{scene_id}/shots",
        headers=headers,
        json={
            "title": "Close-up — Kaelen's Eyes",
            "description": "Starlight reflects in Kaelen's pupils.",
            "shot_type": "close-up",
            "camera_perspective": "Close-up",
            "character_focus": ["Kaelen"],
            "visual_direction": "Shallow depth of field",
            "duration_seconds": 4,
            "production_notes": "",
        },
    )
    assert shot_b.status_code == 201, shot_b.text
    shot_b_id = shot_b.json()["id"]
    assert shot_b.json()["shot_number"] == 2

    # Update shot B
    upd_b = client.patch(
        f"/api/v1/scene-shots/{shot_b_id}",
        headers=headers,
        json={
            "title": "Extreme Close-up — Kaelen's Eyes",
            "shot_type": "extreme close-up",
            "duration_seconds": 5,
        },
    )
    assert upd_b.status_code == 200, upd_b.text
    assert upd_b.json()["shot_type"] == "extreme close-up"
    assert upd_b.json()["duration_seconds"] == 5

    # Reorder shots: [shot_b, shot_a]
    reord = client.post(
        f"/api/v1/scene-builder/{scene_id}/shots/reorder",
        headers=headers,
        json={"shot_ids": [shot_b_id, shot_a_id]},
    )
    assert reord.status_code == 200, reord.text
    reord_list = reord.json()
    assert [s["id"] for s in reord_list] == [shot_b_id, shot_a_id]
    assert [s["shot_number"] for s in reord_list] == [1, 2]

    # Project-wide shot list endpoint
    proj_shots = client.get(
        f"/api/v1/projects/{project_id}/shots",
        headers=headers,
    )
    assert proj_shots.status_code == 200
    assert len(proj_shots.json()) == 2

    # Delete shot_b and verify shot_a renumbers to 1
    del_res = client.delete(
        f"/api/v1/scene-shots/{shot_b_id}",
        headers=headers,
    )
    assert del_res.status_code == 204
    remaining = client.get(
        f"/api/v1/scene-builder/{scene_id}/shots",
        headers=headers,
    ).json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == shot_a_id
    assert remaining[0]["shot_number"] == 1


def test_character_environment_and_asset_assignments_without_duplication() -> None:
    headers = _register_and_login("scene_assign")
    project_id, _ = _create_project_and_story(headers)

    scenes = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
    ).json()
    scene_id = scenes[0]["id"]

    # 1. Create a Step 3 Character with a real uploaded PNG asset
    char_res = client.post(
        "/api/v1/characters",
        headers=headers,
        json={
            "name": "Kaelen Vance",
            "role": "Main character",
            "project_id": project_id,
            "art_style": "Anime",
            "seed_default_expressions_and_poses": True,
        },
    )
    assert char_res.status_code == 201, char_res.text
    char_data = char_res.json()
    char_id = char_data["id"]
    expr_id = char_data["expressions"][0]["id"]
    pose_id = char_data["poses"][0]["id"]

    png_bytes = _create_valid_png_bytes(128, 128)
    c_upload = client.post(
        f"/api/v1/characters/{char_id}/assets/upload",
        headers=headers,
        files={"file": ("kaelen.png", png_bytes, "image/png")},
        data={"asset_type": "portrait", "label": "Kaelen Portrait", "set_as_primary": "true"},
    )
    assert c_upload.status_code == 201, c_upload.text
    char_asset_id = c_upload.json()["id"]

    # 2. Create a Step 4 Environment with a real uploaded PNG asset
    env_res = client.post(
        "/api/v1/environments",
        headers=headers,
        json={
            "name": "Sunken Observatory Hall",
            "category": "Fantasy",
            "location_type": "Ancient temples",
            "project_id": project_id,
            "time_of_day": "Night",
            "weather": "Rain",
            "seed_default_variations": True,
        },
    )
    assert env_res.status_code == 201, env_res.text
    env_data = env_res.json()
    env_id = env_data["id"]

    e_upload = client.post(
        f"/api/v1/environments/{env_id}/assets/upload",
        headers=headers,
        files={"file": ("observatory.png", png_bytes, "image/png")},
        data={"asset_type": "background", "label": "Observatory Main BG", "set_as_primary": "true"},
    )
    assert e_upload.status_code == 201, e_upload.text
    env_asset_id = e_upload.json()["id"]

    # 3. Assign Environment to Scene
    env_assign = client.put(
        f"/api/v1/scene-builder/{scene_id}/environment",
        headers=headers,
        json={"environment_id": env_id, "background_asset_id": env_asset_id},
    )
    assert env_assign.status_code == 200, env_assign.text
    s_after_env = env_assign.json()
    assert s_after_env["environment_id"] == env_id
    assert s_after_env["environment"]["name"] == "Sunken Observatory Hall"
    assert s_after_env["thumbnail_url"] is not None

    # 4. Assign Character to Scene (referencing Kaelen, expression, pose, asset)
    ca_res = client.post(
        f"/api/v1/scene-builder/{scene_id}/characters",
        headers=headers,
        json={
            "character_id": char_id,
            "role_in_scene": "Protagonist",
            "expression_id": expr_id,
            "pose_id": pose_id,
            "asset_id": char_asset_id,
            "position_x": 38,
            "position_y": 78,
            "scale_percent": 110,
            "notes": "Standing by the astrolabe",
        },
    )
    assert ca_res.status_code == 201, ca_res.text
    ca_data = ca_res.json()
    ca_id = ca_data["id"]
    assert ca_data["character_id"] == char_id
    assert ca_data["character_name"] == "Kaelen Vance"
    assert ca_data["image_url"] is not None
    assert ca_data["reference_status"] == "ok"

    # Update character placement
    ca_upd = client.patch(
        f"/api/v1/scene-character-assignments/{ca_id}",
        headers=headers,
        json={"position_x": 52, "scale_percent": 120},
    )
    assert ca_upd.status_code == 200, ca_upd.text
    assert ca_upd.json()["position_x"] == 52
    assert ca_upd.json()["scale_percent"] == 120

    # 5. Assign foreground prop layer to Scene
    aa_res = client.post(
        f"/api/v1/scene-builder/{scene_id}/assets",
        headers=headers,
        json={
            "layer_type": "foreground",
            "label": "Astrolabe Foreground Ring",
            "environment_asset_id": env_asset_id,
            "position_x": 50,
            "position_y": 85,
            "scale_percent": 100,
        },
    )
    assert aa_res.status_code == 201, aa_res.text
    aa_id = aa_res.json()["id"]
    assert aa_res.json()["reference_status"] == "ok"

    # Verify Character and Environment records were NEVER duplicated
    all_chars = client.get("/api/v1/characters", headers=headers).json()
    assert len(all_chars) == 1
    all_envs = client.get("/api/v1/environments", headers=headers).json()
    assert len(all_envs) == 1

    # Clean up assignments
    assert client.delete(f"/api/v1/scene-character-assignments/{ca_id}", headers=headers).status_code == 204
    assert client.delete(f"/api/v1/scene-asset-assignments/{aa_id}", headers=headers).status_code == 204


def test_story_synchronization_missing_references_and_story_preservation() -> None:
    headers = _register_and_login("scene_sync")
    project_id, story_id = _create_project_and_story(headers)

    # Create Step 3 character matching the default story character name "Protagonist"
    char_res = client.post(
        "/api/v1/characters",
        headers=headers,
        json={
            "name": "Protagonist",
            "role": "Main character",
            "project_id": project_id,
            "art_style": "Anime",
        },
    )
    assert char_res.status_code == 201, char_res.text
    char_id = char_res.json()["id"]

    # Create Step 4 environment matching the default story location name "Opening Setting"
    env_res = client.post(
        "/api/v1/environments",
        headers=headers,
        json={
            "name": "Opening Setting",
            "category": "Natural",
            "location_type": "Mountains",
            "project_id": project_id,
        },
    )
    assert env_res.status_code == 201, env_res.text
    env_id = env_res.json()["id"]

    # Run Story <-> Scene Sync
    sync_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/sync",
        headers=headers,
    )
    assert sync_res.status_code == 200, sync_res.text
    sync_data = sync_res.json()
    assert sync_data["scenes_synced"] >= 1
    assert sync_data["characters_matched"] >= 1
    assert sync_data["environments_matched"] >= 1
    synced_scene = sync_data["scenes"][0]
    assert synced_scene["environment_id"] == env_id
    assert any(ca["character_id"] == char_id for ca in synced_scene["character_assignments"])

    # Verify missing reference detection when assigning a non-existent asset ID (never crashes!)
    fake_asset_id = str(uuid.uuid4())
    missing_layer = client.post(
        f"/api/v1/scene-builder/{synced_scene['id']}/assets",
        headers=headers,
        json={
            "layer_type": "prop",
            "label": "Deleted Lantern Asset",
            "environment_asset_id": fake_asset_id,
        },
    )
    assert missing_layer.status_code == 201, missing_layer.text
    assert missing_layer.json()["reference_status"] == "missing_reference"

    detail_with_missing = client.get(
        f"/api/v1/scene-builder/{synced_scene['id']}",
        headers=headers,
    ).json()
    assert len(detail_with_missing["missing_references"]) >= 1

    # Verify Step 2 story content is preserved after Step 5 updates
    story_check = client.get(f"/api/v1/stories/{story_id}", headers=headers).json()
    assert story_check["summary"] == "Kaelen journeys to the Sunken Observatory with Lyra to awaken the Astral Compass."
    assert len(story_check["document"]["scenes"][0]["dialogue"]) >= 1


def test_cross_user_access_prevention() -> None:
    headers_a = _register_and_login("scene_owner_a")
    headers_b = _register_and_login("scene_intruder_b")

    project_id, _ = _create_project_and_story(headers_a)
    scenes = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers_a,
    ).json()
    scene_id = scenes[0]["id"]

    shot = client.post(
        f"/api/v1/scene-builder/{scene_id}/shots",
        headers=headers_a,
        json={"title": "Owner Shot", "shot_type": "wide"},
    ).json()

    # User B cannot access User A's project scenes, storyboard, scene detail, or shots
    assert client.get(f"/api/v1/projects/{project_id}/scene-builder", headers=headers_b).status_code == 403
    assert client.get(f"/api/v1/projects/{project_id}/storyboard", headers=headers_b).status_code == 403
    assert client.get(f"/api/v1/scene-builder/{scene_id}", headers=headers_b).status_code == 403
    assert client.patch(
        f"/api/v1/scene-builder/{scene_id}",
        headers=headers_b,
        json={"title": "Hijacked Scene"},
    ).status_code == 403
    assert client.delete(f"/api/v1/scene-builder/{scene_id}", headers=headers_b).status_code == 403
    assert client.patch(
        f"/api/v1/scene-shots/{shot['id']}",
        headers=headers_b,
        json={"title": "Hijacked Shot"},
    ).status_code == 403
    assert client.delete(f"/api/v1/scene-shots/{shot['id']}", headers=headers_b).status_code == 403


def test_ai_scene_generation_errors_and_review_workflow(monkeypatch) -> None:
    headers = _register_and_login("scene_ai")
    project_id, _ = _create_project_and_story(headers)
    scenes = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
    ).json()
    scene_id = scenes[0]["id"]

    settings = get_settings()

    # 1. Missing API key -> 503 AI_NOT_CONFIGURED
    monkeypatch.setattr(settings, "AI_API_KEY", "")
    res_no_key = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/ai-generate",
        headers=headers,
        json={"action": "generate_shot_list", "scene_id": scene_id},
    )
    assert res_no_key.status_code == 503, res_no_key.text
    assert res_no_key.json()["error_code"] == "AI_NOT_CONFIGURED"

    # Configure dummy key and test mocked provider errors & valid responses
    monkeypatch.setattr(settings, "AI_API_KEY", "test-key-step5")

    # 2. Provider Timeout -> 504 AI_TIMEOUT
    class TimeoutProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
            raise AIProviderException(
                detail="Simulated AI timeout",
                status_code=504,
                error_code="AI_TIMEOUT",
            )

    monkeypatch.setattr(
        "app.services.scene_service.get_ai_story_provider",
        lambda _cfg=None: TimeoutProvider(settings),
    )
    res_timeout = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/ai-generate",
        headers=headers,
        json={"action": "generate_shot_list", "scene_id": scene_id},
    )
    assert res_timeout.status_code == 504
    assert res_timeout.json()["error_code"] == "AI_TIMEOUT"

    # 3. Provider Rate Limit -> 429 AI_RATE_LIMITED
    class RateLimitProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
            raise AIProviderException(
                detail="Simulated AI rate limit",
                status_code=429,
                error_code="AI_RATE_LIMITED",
            )

    monkeypatch.setattr(
        "app.services.scene_service.get_ai_story_provider",
        lambda _cfg=None: RateLimitProvider(settings),
    )
    res_rl = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/ai-generate",
        headers=headers,
        json={"action": "generate_shot_list", "scene_id": scene_id},
    )
    assert res_rl.status_code == 429
    assert res_rl.json()["error_code"] == "AI_RATE_LIMITED"

    # 4. Malformed AI JSON -> 502 AI_INVALID_JSON
    class MalformedProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> str:
            return "NOT VALID JSON AT ALL"

    monkeypatch.setattr(
        "app.services.scene_service.get_ai_story_provider",
        lambda _cfg=None: MalformedProvider(settings),
    )
    res_bad_json = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/ai-generate",
        headers=headers,
        json={"action": "generate_shot_list", "scene_id": scene_id},
    )
    assert res_bad_json.status_code == 502
    assert res_bad_json.json()["error_code"] == "AI_INVALID_JSON"

    # 5. Valid AI proposal (non-destructive review first, then apply)
    class ValidSceneAIProvider(AIStoryProvider):
        def _complete_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
            return {
                "summary_of_suggestions": "Generated 1 climax scene and 2 shots for Scene 1.",
                "proposed_scenes": [
                    {
                        "id": str(uuid.uuid4()),
                        "scene_number": 2,
                        "title": "The Eclipse Alignment",
                        "scene_type": "Climax",
                        "scene_heading": "EXT. ASTRAL SPIRE - NIGHT",
                        "summary": "The compass beam pierces the eclipse shadow.",
                        "description": "Silver light arcs from the spire into the clouds.",
                        "action_description": "Kaelen raises the compass.",
                        "location_name": "Astral Spire",
                        "suggested_environment_name": "Astral Spire",
                        "suggested_characters": ["Protagonist"],
                        "time_of_day": "Night",
                        "weather": "Clear",
                        "mood": "Triumphant",
                        "duration_seconds": 40,
                        "camera_framing": "Low angle",
                        "transition_type": "Fade out",
                        "visual_directions": ["Intense silver rim light"],
                        "camera_directions": ["ORBITING CRANE SHOT"],
                        "audio_directions": ["Orchestral crescendo"],
                        "production_notes": "Final act peak",
                        "shots": [],
                    }
                ],
                "proposed_shots": [
                    {
                        "id": str(uuid.uuid4()),
                        "shot_number": 1,
                        "title": "Wide — Observatory Entrance",
                        "description": "Protagonist steps through the archway.",
                        "shot_type": "establishing",
                        "camera_perspective": "Wide establishing shot",
                        "character_focus": ["Protagonist"],
                        "visual_direction": "Golden rim light",
                        "duration_seconds": 6,
                        "production_notes": "",
                    }
                ],
                "suggested_environments": ["Astral Spire"],
                "suggested_characters": ["Protagonist"],
                "suggested_visual_directions": ["Golden rim light"],
                "suggested_transition": "Cross dissolve",
                "rewritten_description": None,
            }

    monkeypatch.setattr(
        "app.services.scene_service.get_ai_story_provider",
        lambda _cfg=None: ValidSceneAIProvider(settings),
    )

    proposal_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/ai-generate",
        headers=headers,
        json={
            "action": "convert_story_to_scenes",
            "scene_id": scene_id,
            "apply_immediately": False,
        },
    )
    assert proposal_res.status_code == 200, proposal_res.text
    proposal = proposal_res.json()
    assert proposal["applied"] is False
    assert len(proposal["proposed_scenes"]) == 1
    assert len(proposal["proposed_shots"]) == 1
    assert proposal["job"]["status"] == "completed"

    # Confirm non-destructive default: scene count is still 1 before applying
    before_apply = client.get(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
    ).json()
    assert len(before_apply) == 1

    # Now apply the reviewed proposal
    apply_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder/ai-apply",
        headers=headers,
        json={
            "action": "convert_story_to_scenes",
            "scene_id": scene_id,
            "accepted_scenes": proposal["proposed_scenes"],
            "accepted_shots": proposal["proposed_shots"],
            "replace_existing_shots": False,
        },
    )
    assert apply_res.status_code == 200, apply_res.text
    after_apply = apply_res.json()
    assert len(after_apply) == 2
    assert len(after_apply[0]["shots"]) == 1
    assert after_apply[1]["title"] == "The Eclipse Alignment"
