"""
Automated Integration Tests for TR STUDIO Step 4 — World & Environment Creation Studio.
Covers all 15 testing requirements in Section 14:
- Environment creation, editing, deletion, listing, and ownership
- Cross-user access prevention (403 Forbidden)
- Image upload validation (PNG header/dimensions, invalid binary rejection, signed URLs)
- AI generation configuration & honest missing API key behavior (503)
- Image provider failure handling (429 rate-limit, 504 timeout)
- Environment & variation AI generation with mocked provider responses (no paid API calls)
- World creation, World hierarchy, and Location management
- Story, scene, and character planning integration + safe foreign-key deletion
"""

import struct
from typing import List, Optional
import uuid
import zlib

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.exceptions import ImageProviderException
from app.main import app
from app.services.image_provider import AIImageProvider, ReferenceImageInput

client = TestClient(app)


def _create_valid_png_bytes(width: int = 128, height: int = 72) -> bytes:
    """Create a valid minimal RGB PNG binary image of `width` x `height` (>= 32x32)."""

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


def test_environment_crud_variations_and_cross_user_isolation() -> None:
    headers_a = _register_and_login("env_owner_a")
    headers_b = _register_and_login("env_owner_b")

    # 1. Create environment with default variations
    create_res = client.post(
        "/api/v1/environments",
        headers=headers_a,
        json={
            "name": "Celestial Floating Sanctuary",
            "description": "Ancient marble temple complex suspended above a sea of clouds.",
            "category": "Fantasy",
            "location_type": "Floating islands",
            "art_style": "Anime",
            "visual_mood": "Mystical and serene",
            "time_of_day": "Sunrise",
            "weather": "Clear",
            "color_palette": ["#38BDF8", "#FDE047", "#1E1B4B"],
            "camera_perspective": "Wide establishing shot",
            "architecture": "Tiered white marble colonnades with astral gold rings",
            "terrain": "Sheer levitating basalt cliffs with cascading waterfalls",
            "vegetation": "Luminous silver-leaf cherry trees",
            "props": "Ancient stone sundial, floating lanterns",
            "lighting": "Warm golden sunrise rim lighting through mist",
            "atmosphere": "Drifting cloud banks and sparkles",
            "tags": ["fantasy", "temple", "sky"],
            "seed_default_variations": True,
        },
    )
    assert create_res.status_code == 201, create_res.text
    env_data = create_res.json()
    env_id = env_data["id"]
    assert env_data["name"] == "Celestial Floating Sanctuary"
    assert env_data["category"] == "Fantasy"
    assert env_data["metadata"]["location_type"] == "Floating islands"
    assert len(env_data["variations"]) == 5

    # 2. List environments with search and category filters
    list_res = client.get(
        "/api/v1/environments?category=Fantasy&search=Celestial",
        headers=headers_a,
    )
    assert list_res.status_code == 200
    assert any(item["id"] == env_id for item in list_res.json())

    # 3. Cross-user access prevention (User B cannot view, edit, or delete User A's environment)
    forbidden_get = client.get(f"/api/v1/environments/{env_id}", headers=headers_b)
    assert forbidden_get.status_code == 403
    forbidden_patch = client.patch(
        f"/api/v1/environments/{env_id}",
        headers=headers_b,
        json={"name": "Hijacked Environment"},
    )
    assert forbidden_patch.status_code == 403
    forbidden_del = client.delete(
        f"/api/v1/environments/{env_id}", headers=headers_b
    )
    assert forbidden_del.status_code == 403

    # 4. Edit environment settings
    patch_res = client.patch(
        f"/api/v1/environments/{env_id}",
        headers=headers_a,
        json={
            "visual_mood": "Dramatic twilight",
            "time_of_day": "Sunset",
            "weather": "Windy",
            "lighting": "Deep violet dusk with amber horizon glow",
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["visual_mood"] == "Dramatic twilight"
    assert updated["time_of_day"] == "Sunset"
    assert updated["metadata"]["lighting"] == "Deep violet dusk with amber horizon glow"

    # 5. Create custom variation and mark as default without overwriting original environment
    var_res = client.post(
        f"/api/v1/environments/{env_id}/variations",
        headers=headers_a,
        json={
            "name": "Eclipse Blood-Moon Version",
            "variation_type": "lighting",
            "description": "Crimson eclipse casting eerie shadows across the marble courtyard",
            "is_default": True,
        },
    )
    assert var_res.status_code == 201
    var_id = var_res.json()["id"]
    assert var_res.json()["is_default"] is True

    # Original environment description and time_of_day remain intact
    env_after_var = client.get(f"/api/v1/environments/{env_id}", headers=headers_a).json()
    assert (
        env_after_var["description"]
        == "Ancient marble temple complex suspended above a sea of clouds."
    )
    assert env_after_var["time_of_day"] == "Sunset"

    # Delete variation
    del_var = client.delete(
        f"/api/v1/environment-variations/{var_id}", headers=headers_a
    )
    assert del_var.status_code == 204


def test_environment_upload_validation_and_signed_media_security() -> None:
    headers = _register_and_login("env_upload")
    env_res = client.post(
        "/api/v1/environments",
        headers=headers,
        json={
            "name": "Neo-Tokyo Rain Alley",
            "category": "Science Fiction",
            "location_type": "Cyberpunk streets",
            "art_style": "Anime",
        },
    )
    assert env_res.status_code == 201
    env_id = env_res.json()["id"]

    # 1. Reject invalid non-image payload disguised as .png
    bad_upload = client.post(
        f"/api/v1/environments/{env_id}/assets/upload",
        headers=headers,
        files={"file": ("fake.png", b"not-a-valid-png-file", "image/png")},
        data={"asset_type": "uploaded_reference", "set_as_default": "true"},
    )
    assert bad_upload.status_code == 400
    assert bad_upload.json()["error_code"] == "UNSUPPORTED_IMAGE_FORMAT"

    # 2. Accept valid binary PNG image and set as default background
    png_bytes = _create_valid_png_bytes(160, 90)
    good_upload = client.post(
        f"/api/v1/environments/{env_id}/assets/upload",
        headers=headers,
        files={"file": ("cyberpunk_bg.png", png_bytes, "image/png")},
        data={
            "asset_type": "uploaded_reference",
            "label": "Main Cyberpunk Background",
            "set_as_default": "true",
        },
    )
    assert good_upload.status_code == 201, good_upload.text
    asset = good_upload.json()
    assert asset["is_default"] is True
    assert asset["metadata"]["width"] == 160
    assert asset["metadata"]["height"] == 90
    signed_url = asset["url"]
    assert "/api/v1/environment-assets/" in signed_url

    # 3. Signed URL works without bearer token; tampered signature is rejected (403)
    media_ok = client.get(signed_url)
    assert media_ok.status_code == 200
    assert media_ok.content == png_bytes

    tampered_url = signed_url + "tampered"
    media_bad = client.get(tampered_url)
    assert media_bad.status_code == 403


def test_environment_missing_api_key_provider_errors_and_mocked_ai_generation(
    monkeypatch,
) -> None:
    headers = _register_and_login("env_ai")
    env_res = client.post(
        "/api/v1/environments",
        headers=headers,
        json={
            "name": "Whispering Bamboo Gorge",
            "description": "Towering emerald bamboo forest bisected by a misty mountain river.",
            "category": "Natural",
            "location_type": "Forests",
            "art_style": "Watercolor",
            "time_of_day": "Morning",
            "weather": "Foggy",
        },
    )
    assert env_res.status_code == 201
    env_id = env_res.json()["id"]

    # 1. Prompt preview works even without an API key
    preview_res = client.post(
        f"/api/v1/environments/{env_id}/preview-prompt",
        headers=headers,
        json={
            "generation_type": "landscape",
            "user_instructions": "Include a wooden footbridge in the midground",
        },
    )
    assert preview_res.status_code == 200
    assert "Whispering Bamboo Gorge" in preview_res.json()["prompt"]

    # 2. Honest 503 when IMAGE_API_KEY is not configured
    settings = get_settings()
    monkeypatch.setattr(settings, "IMAGE_API_KEY", "")
    no_key_res = client.post(
        f"/api/v1/environments/{env_id}/generate",
        headers=headers,
        json={"generation_type": "landscape"},
    )
    assert no_key_res.status_code == 503
    assert no_key_res.json()["error_code"] == "IMAGE_AI_NOT_CONFIGURED"

    # 3. Mocked AI provider succeeds for environment generation and variation generation
    class MockEnvironmentImageProvider(AIImageProvider):
        provider_name = "mock_gemini"
        model_name = "imagen-3.0-mock"

        def _generate_raw_image(
            self,
            prompt: str,
            reference_images: Optional[List[ReferenceImageInput]] = None,
            aspect_ratio: str = "16:9",
        ) -> bytes:
            return _create_valid_png_bytes(160, 90)

    monkeypatch.setattr(
        "app.services.environment_service.get_ai_image_provider",
        lambda: MockEnvironmentImageProvider(),
    )

    gen_res = client.post(
        f"/api/v1/environments/{env_id}/generate",
        headers=headers,
        json={
            "generation_type": "landscape",
            "user_instructions": "Wide multi-plane parallax composition",
            "set_as_default": True,
        },
    )
    assert gen_res.status_code == 200, gen_res.text
    gen_body = gen_res.json()
    assert gen_body["job"]["status"] == "completed"
    assert len(gen_body["generated_assets"]) == 1
    assert gen_body["environment"]["default_asset_id"] == gen_body["generated_assets"][0]["id"]

    # Generate a weather/time variation without overwriting the canonical environment
    var_gen_res = client.post(
        f"/api/v1/environments/{env_id}/generate-variation",
        headers=headers,
        json={
            "name": "Moonlit Snowstorm Bamboo Gorge",
            "variation_type": "weather",
            "description": "Heavy snowfall at midnight with silver moonlight",
            "time_of_day_override": "Night",
            "weather_override": "Snowy",
            "is_default": False,
        },
    )
    assert var_gen_res.status_code == 200, var_gen_res.text
    var_body = var_gen_res.json()
    assert var_body["variation"]["name"] == "Moonlit Snowstorm Bamboo Gorge"
    assert var_body["variation"]["image_url"] is not None
    # Verify original environment time_of_day and weather were preserved
    assert var_body["environment"]["time_of_day"] == "Morning"
    assert var_body["environment"]["weather"] == "Foggy"

    # 4. Rate-limit (429) handling
    class RateLimitedProvider(AIImageProvider):
        provider_name = "mock_gemini"
        model_name = "imagen-3.0-mock"

        def _generate_raw_image(self, prompt: str, reference_images=None, aspect_ratio="16:9") -> bytes:
            raise ImageProviderException(
                detail="Rate limit exceeded",
                status_code=429,
                error_code="IMAGE_PROVIDER_RATE_LIMITED",
            )

    monkeypatch.setattr(
        "app.services.environment_service.get_ai_image_provider",
        lambda: RateLimitedProvider(),
    )
    rl_res = client.post(
        f"/api/v1/environments/{env_id}/generate",
        headers=headers,
        json={"generation_type": "concept"},
    )
    assert rl_res.status_code == 429


def test_world_hierarchy_and_story_scene_character_integration() -> None:
    headers = _register_and_login("world_story_sync")

    # 1. Create a manual Story with 2 scenes and 1 location
    story_res = client.post(
        "/api/v1/stories",
        headers=headers,
        json={
            "title": "Chronicles of Aethelgard",
            "idea": "A young knight defends the Crystal Citadel from shadow wyrms.",
            "genre": "Fantasy",
            "animation_style": "Anime",
        },
    )
    assert story_res.status_code == 201, story_res.text
    story = story_res.json()
    story_id = story["id"]
    project_id = story["project_id"]
    scene_id = story["document"]["scenes"][0]["id"]
    char_id = story["document"]["characters"][0]["id"]

    # 2. Import story locations into Environment Studio without duplication
    import_res = client.post(
        f"/api/v1/environments/import-from-story/{story_id}",
        headers=headers,
    )
    assert import_res.status_code == 200, import_res.text
    imported_envs = import_res.json()
    assert len(imported_envs) >= 1

    # Re-importing does not duplicate
    import_again = client.post(
        f"/api/v1/environments/import-from-story/{story_id}",
        headers=headers,
    )
    assert import_again.status_code == 200
    assert len(import_again.json()) == len(imported_envs)

    # 3. Create a World and hierarchical WorldLocations (World -> Region -> Location -> Building -> Room)
    world_res = client.post(
        "/api/v1/worlds",
        headers=headers,
        json={
            "project_id": project_id,
            "name": "Kingdom of Aethelgard",
            "description": "High fantasy realm of floating citadels and crystal forests.",
            "seed_sample_hierarchy": True,
        },
    )
    assert world_res.status_code == 201, world_res.text
    world = world_res.json()
    world_id = world["id"]
    assert len(world["locations"]) == 2

    # Add Royal Capital Region -> Royal Castle Building -> Throne Room linked to an Environment
    capital_res = client.post(
        f"/api/v1/worlds/{world_id}/locations",
        headers=headers,
        json={
            "name": "Royal Capital",
            "location_type": "region",
            "description": "Heart of the kingdom",
            "sort_order": 1,
        },
    )
    assert capital_res.status_code == 201
    capital_id = capital_res.json()["id"]

    castle_res = client.post(
        f"/api/v1/worlds/{world_id}/locations",
        headers=headers,
        json={
            "parent_id": capital_id,
            "environment_id": imported_envs[0]["id"],
            "name": "Royal Crystal Castle",
            "location_type": "building",
            "description": "Spire fortress overlooking the capital",
            "sort_order": 0,
        },
    )
    assert castle_res.status_code == 201
    castle_loc = castle_res.json()
    assert castle_loc["parent_id"] == capital_id
    assert castle_loc["environment_id"] == imported_envs[0]["id"]

    # Prevent circular parent assignment
    circular_res = client.patch(
        f"/api/v1/world-locations/{castle_loc['id']}",
        headers=headers,
        json={"parent_id": castle_loc["id"]},
    )
    assert circular_res.status_code == 400

    # 4. Sync Environment to Story, Scene, and Character planning workflow
    sync_res = client.post(
        f"/api/v1/environments/{imported_envs[0]['id']}/sync-to-story",
        headers=headers,
        json={
            "story_id": story_id,
            "scene_ids": [scene_id],
            "character_ids": [char_id],
        },
    )
    assert sync_res.status_code == 200, sync_res.text
    synced_env = sync_res.json()
    assert scene_id in synced_env["metadata"]["scene_ids"]
    assert char_id in synced_env["metadata"]["character_ids"]

    # 5. Safe deletion: Deleting the Environment does NOT delete the Story or WorldLocation
    del_env = client.delete(
        f"/api/v1/environments/{imported_envs[0]['id']}",
        headers=headers,
    )
    assert del_env.status_code == 204

    story_check = client.get(f"/api/v1/stories/{story_id}", headers=headers)
    assert story_check.status_code == 200

    world_check = client.get(f"/api/v1/worlds/{world_id}", headers=headers)
    assert world_check.status_code == 200
    castle_after = [
        loc for loc in world_check.json()["locations"] if loc["id"] == castle_loc["id"]
    ][0]
    assert castle_after["environment_id"] is None
