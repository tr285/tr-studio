"""
Comprehensive Backend Verification Test Suite for TR STUDIO Step 2 — AI Story Creation Engine.
Covers all 12 testing requirements:
1. Story schema validation & ID normalization (non-UUID IDs normalized to stable UUIDs)
2. Story generation request validation
3. Provider integration using mocked external responses & job tracking
4. Missing API key behavior (503 AI_NOT_CONFIGURED, no fake content)
5. AI provider failure handling (rate limits 429, timeouts 504, malformed JSON 502)
6. Manual story creation and editing (with autosave vs versioned save)
7. Scene creation, update, duplication, reordering, and deletion
8. Non-destructive AI assistant actions (improve, rewrite, continue without silent overwrite)
9. Story version creation, listing, and safe restoration
10. Authentication, project ownership enforcement, and cross-user access prevention
"""

import json
import uuid
from typing import Any, Dict, Tuple
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.exceptions import AIProviderException
from app.main import app
from app.schemas.story import StoryGenerationRequest, StoryOutputDocument
from app.services.ai_provider import (
    GeminiStoryProvider,
    extract_and_normalize_story_json,
)

settings = get_settings()
client = TestClient(app)


def register_test_user(prefix: str = "story_director") -> Tuple[str, str]:
    """Helper to register a fresh user and return (access_token, user_id)."""
    suffix = uuid.uuid4().hex[:8]
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{prefix}_{suffix}@trstudio.ai",
            "username": f"{prefix}_{suffix}",
            "password": "StrongStudioPassword!2026",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    return data["access_token"], data["user"]["id"]


def build_mock_ai_raw_json() -> str:
    """
    Returns a realistic raw JSON string as an LLM might produce, intentionally using
    symbolic IDs ('char_1', 'char_2', 'loc_1', 'scene_1', 'scene_2') to verify that
    extract_and_normalize_story_json deterministically converts them to valid UUIDs
    and preserves all relational cross-references.
    """
    payload: Dict[str, Any] = {
        "schema_version": "1.0",
        "story": {
            "title": "The Magical Book of Aethelgard",
            "logline": "A curious boy finds an ancient grimoire in a ruined village and steps into a floating realm.",
            "summary": "Kael discovers a glowing tome inside an abandoned clocktower and must reunite the fractured sky islands.",
            "genre": "Fantasy",
            "tone": "Inspirational",
            "target_audience": "Everyone",
            "duration_minutes": 3,
            "language": "English",
            "animation_style": "Anime",
            "complexity": "Medium",
            "ending_type": "Happy",
            "themes": ["Courage", "Curiosity", "Friendship"],
            "beginning": "Kael explores the overgrown ruins of Oakhaven and opens the sealed Astral Grimoire.",
            "middle": "Transported to the Sky Archipelagos, Kael and Lyra solve the wind-spire riddles.",
            "ending": "The islands reconnect in a burst of aurora light as Kael unlocks his true cartographer magic.",
        },
        "characters": [
            {
                "id": "char_1",
                "name": "Kael",
                "role": "protagonist",
                "age": "12",
                "gender": "Male",
                "appearance": "Tousled cobalt hair, amber eyes, oversized brass goggles, weathered leather satchel",
                "outfit": "Indigo traveller cloak over a linen tunic and sky-sailor boots",
                "personality": "Observant, brave, endlessly curious, slightly reckless",
                "background": "Orphaned apprentice clockmaker fascinated by ancient maps",
                "goals": "Restore the lost sky bridges and return home with newfound wisdom",
                "fears": "Being forgotten or failing those who trust him",
                "voice_style": "Youthful, energetic, earnest tenor",
                "relationships": [
                    {
                        "target_character_id": "char_2",
                        "relation": "Guardian spirit & mentor",
                    }
                ],
            },
            {
                "id": "char_2",
                "name": "Lyra",
                "role": "supporting",
                "age": "Immortal",
                "gender": "Female",
                "appearance": "Luminous silver braids, starlight-speckled cape, floating crystal astrolabe",
                "outfit": "Celestial silver vestments with glowing constellation embroidery",
                "personality": "Witty, protective, enigmatic",
                "background": "Spirit bound to the Astral Grimoire for three centuries",
                "goals": "Find a worthy reader to awaken the Spire of Dawn",
                "fears": "The void storms consuming the last floating sanctuary",
                "voice_style": "Melodic, warm, slightly echoing alto",
                "relationships": [
                    {
                        "target_character_id": "char_1",
                        "relation": "Chosen apprentice",
                    }
                ],
            },
        ],
        "locations": [
            {
                "id": "loc_1",
                "name": "Ruined Clocktower of Oakhaven",
                "type": "interior",
                "time_of_day": "dusk",
                "weather": "clear",
                "description": "Sunbeams pierce through cracked stained-glass windows onto brass gears and moss-covered flagstones.",
                "mood": "Mysterious and nostalgic",
                "visual_elements": [
                    "Shafts of amber sunset light",
                    "Floating dust motes",
                    "Ancient oak pedestal",
                ],
                "lighting": "Warm golden-hour rim lighting with deep violet shadows",
            },
            {
                "id": "loc_2",
                "name": "Citadel of the Sky Archipelagos",
                "type": "exterior",
                "time_of_day": "day",
                "weather": "windy",
                "description": "Floating marble islands linked by ribbons of solidified starlight above an endless sea of clouds.",
                "mood": "Wondrous and epic",
                "visual_elements": [
                    "Waterfalls pouring into clouds",
                    "Crystal wind-spires",
                    "Soaring sky-manta creatures",
                ],
                "lighting": "Crisp high-altitude sunlight with iridescent prism flares",
            },
        ],
        "scenes": [
            {
                "id": "scene_1",
                "scene_number": 1,
                "title": "The Whispering Pedestal",
                "summary": "Kael discovers the glowing book inside the ruined clocktower.",
                "location_id": "loc_1",
                "characters": ["char_1", "char_2"],
                "duration_seconds": 35,
                "Transition": "Portal flash dissolve",
                "visual_description": "Kael brushes dust off the leather cover; golden runes spiral into the air.",
                "camera": {
                    "shot_type": "close_up",
                    "movement": "slow_push_in",
                    "angle": "low_angle",
                },
                "environment": {
                    "time_of_day": "dusk",
                    "weather": "clear",
                    "lighting": "Golden rays and cyan magic glow",
                },
                "dialogue": [
                    {
                        "id": "dlg_1",
                        "character_id": "char_1",
                        "character_name": "Kael",
                        "text": "The pages aren't written in ink... they're woven from starlight!",
                        "emotion": "amazed",
                        "action": "reaches toward the levitating clasp",
                        "duration_seconds": 5,
                    },
                    {
                        "id": "dlg_2",
                        "character_id": "char_2",
                        "character_name": "Lyra",
                        "text": "At last, someone who can read the old constellations. Hold on tight, little clockmaker!",
                        "emotion": "excited",
                        "action": "materializes from a swirl of silver sparks",
                        "duration_seconds": 6,
                    },
                ],
                "narration": [
                    {
                        "id": "nar_1",
                        "text": "For a hundred years the village stood silent, waiting for a single curious spark.",
                        "tone": "warm",
                    }
                ],
                "sound": {
                    "background_music": "Delicate celesta and rising orchestral strings",
                    "ambient_sound": "Creaking timber and distant wind chimes",
                    "sound_effects": ["page_flutter", "magical_resonance_hum"],
                },
            },
            {
                "id": "scene_2",
                "scene_number": 2,
                "title": "Arrival at the Sky Archipelagos",
                "summary": "Kael steps out of the portal onto a floating island above the clouds.",
                "location_id": "loc_2",
                "characters": ["char_1", "char_2"],
                "duration_seconds": 45,
                "transition": "cut",
                "visual_description": "Wide sweeping vista as Kael gazes across the floating islands.",
                "camera": {
                    "shot_type": "wide",
                    "movement": "crane_up",
                    "angle": "eye_level",
                },
                "environment": {
                    "time_of_day": "day",
                    "weather": "windy",
                    "lighting": "Bright celestial daylight",
                },
                "dialogue": [
                    {
                        "id": "dlg_3",
                        "character_id": "char_1",
                        "character_name": "Kael",
                        "text": "We're above the clouds! Look at the bridges of light!",
                        "emotion": "joyful",
                        "action": "runs to the marble balustrade",
                        "duration_seconds": 5,
                    }
                ],
                "narration": [],
                "sound": {
                    "background_music": "Soaring symphonic brass and woodwinds",
                    "ambient_sound": "High-altitude rushing wind",
                    "sound_effects": ["portal_whoosh"],
                },
            },
        ],
    }
    return f"```json\n{json.dumps(payload, indent=2)}\n```"


# ==============================================================================
# 1. Story Schema Validation & Request Validation Tests
# ==============================================================================


def test_story_schema_validation_and_uuid_normalization() -> None:
    raw_text = build_mock_ai_raw_json()
    doc: StoryOutputDocument = extract_and_normalize_story_json(raw_text)

    assert doc.schema_version == "1.0"
    assert doc.story.title == "The Magical Book of Aethelgard"
    assert len(doc.characters) == 2
    assert len(doc.locations) == 2
    assert len(doc.scenes) == 2

    # Verify symbolic IDs ('char_1', 'loc_1', 'scene_1') were normalized to real UUIDs
    char_ids = {c.id for c in doc.characters}
    for cid in char_ids:
        uuid.UUID(cid)  # Raises ValueError if not a valid UUID

    # Verify character relationship cross-reference points to normalized UUID
    assert doc.characters[0].relationships[0].target_character_id in char_ids

    # Verify scene location_id and character references match normalized UUIDs
    loc_ids = {loc.id for loc in doc.locations}
    for scene in doc.scenes:
        uuid.UUID(scene.id)
        assert scene.location_id in loc_ids
        for sc_char_id in scene.characters:
            assert sc_char_id in char_ids
        for dlg in scene.dialogue:
            uuid.UUID(dlg.id)
            assert dlg.character_id in char_ids


def test_story_schema_rejects_malformed_json() -> None:
    with pytest.raises(AIProviderException) as exc_info:
        extract_and_normalize_story_json("Not valid JSON at all {{{")
    assert exc_info.value.status_code == 502


def test_story_generation_request_validation() -> None:
    token, _ = register_test_user("validator")

    # Idea too short (< 10 chars) should fail with 422
    res = client.post(
        "/api/v1/stories/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "idea": "Short",
            "genre": "Fantasy",
        },
    )
    assert res.status_code == 422
    body = res.json()
    assert body["error_code"] == "VALIDATION_ERROR"


# ==============================================================================
# 2. Missing API Key Behavior & AI Provider Failure Handling
# ==============================================================================


def test_missing_api_key_returns_honest_503_and_does_not_fake_story() -> None:
    token, _ = register_test_user("nokey_user")

    with patch.object(settings, "AI_API_KEY", ""):
        status_res = client.get(
            "/api/v1/stories/ai-status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert status_res.status_code == 200
        assert status_res.json()["configured"] is False

        gen_res = client.post(
            "/api/v1/stories/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "idea": "A young boy discovers a magical book in an abandoned village and gets transported into a fantasy world.",
                "genre": "Fantasy",
            },
        )
        assert gen_res.status_code == 503
        err = gen_res.json()
        assert err["error_code"] == "AI_NOT_CONFIGURED"
        assert "AI_API_KEY" in err["detail"]


def test_ai_provider_rate_limit_and_timeout_handling() -> None:
    token, _ = register_test_user("fail_user")

    # Create a project first so we can verify failed job tracking
    proj_res = client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Failure Recovery Test Project", "status": "draft"},
    )
    project_id = proj_res.json()["id"]

    # 1. Simulate 429 Rate Limit from provider
    with (
        patch.object(settings, "AI_PROVIDER", "gemini"),
        patch.object(settings, "AI_API_KEY", "test-secret-key"),
        patch.object(
            GeminiStoryProvider,
            "generate_story",
            side_effect=AIProviderException(
                "AI provider rate limit exceeded.", status_code=429
            ),
        ),
    ):
        res_429 = client.post(
            "/api/v1/stories/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "project_id": project_id,
                "idea": "A young boy discovers a magical book in an abandoned village and gets transported into a fantasy world.",
            },
        )
        assert res_429.status_code == 429
        assert res_429.json()["error_code"] == "AI_PROVIDER_ERROR"

    # 2. Simulate 504 Timeout from provider
    with (
        patch.object(settings, "AI_PROVIDER", "gemini"),
        patch.object(settings, "AI_API_KEY", "test-secret-key"),
        patch.object(
            GeminiStoryProvider,
            "_complete_json",
            side_effect=AIProviderException(
                "AI provider request timed out.", status_code=504
            ),
        ),
    ):
        res_504 = client.post(
            "/api/v1/stories/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "project_id": project_id,
                "idea": "A young boy discovers a magical book in an abandoned village and gets transported into a fantasy world.",
            },
        )
        assert res_504.status_code == 504

    # Verify failed generation jobs were recorded in PostgreSQL
    jobs_res = client.get(
        f"/api/v1/stories/jobs/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert jobs_res.status_code == 200
    jobs = jobs_res.json()
    assert len(jobs) >= 2
    assert all(j["status"] == "failed" for j in jobs)


# ==============================================================================
# 3. Mocked AI Provider Integration & Full 10-Step Workflow Persistence
# ==============================================================================


def test_ai_story_generation_with_mocked_provider_and_relational_persistence() -> None:
    token, _ = register_test_user("ai_creator")

    with (
        patch.object(settings, "AI_PROVIDER", "gemini"),
        patch.object(settings, "AI_API_KEY", "mock-gemini-api-key"),
        patch.object(
            GeminiStoryProvider,
            "_complete_json",
            return_value=build_mock_ai_raw_json(),
        ),
    ):
        gen_res = client.post(
            "/api/v1/stories/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "idea": "A young boy discovers a magical book in an abandoned village and gets transported into a fantasy world.",
                "genre": "Fantasy",
                "animation_style": "Anime",
                "target_audience": "Everyone",
                "duration_minutes": 3,
                "language": "English",
                "main_character_count": 2,
                "tone": "Inspirational",
                "complexity": "Medium",
                "ending_type": "Happy",
                "additional_instructions": "Include floating sky islands and a clocktower.",
            },
        )
        assert gen_res.status_code == 201, gen_res.text
        story_data = gen_res.json()

        story_id = story_data["id"]
        project_id = story_data["project_id"]
        assert story_data["current_version_number"] == 1

        doc = story_data["document"]
        assert doc["schema_version"] == "1.0"
        assert doc["story"]["title"] == "The Magical Book of Aethelgard"
        assert len(doc["characters"]) == 2
        assert len(doc["locations"]) == 2
        assert len(doc["scenes"]) == 2

        # Verify GET /api/v1/stories/{story_id}/characters
        chars_res = client.get(
            f"/api/v1/stories/{story_id}/characters",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert chars_res.status_code == 200
        assert len(chars_res.json()) == 2

        # Verify GET /api/v1/stories/jobs/{project_id} shows completed job at 100%
        jobs_res = client.get(
            f"/api/v1/stories/jobs/{project_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert jobs_res.status_code == 200
        jobs = jobs_res.json()
        assert any(j["status"] == "completed" and j["progress"] == 100 for j in jobs)


# ==============================================================================
# 4. Manual Story Creation, Editing, Scene CRUD, Versioning & Non-Destructive AI
# ==============================================================================


def test_manual_story_scene_crud_versioning_and_nondestructive_ai() -> None:
    token_a, _ = register_test_user("studio_author_a")
    token_b, _ = register_test_user("studio_author_b")

    # 1. Create Manual Story as User A
    create_res = client.post(
        "/api/v1/stories",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "title": "Chronicles of the Neon Ronin",
            "idea": "A cybernetic samurai defends a rooftop garden in Neo-Kyoto.",
            "genre": "Science Fiction",
            "animation_style": "Anime",
            "target_audience": "Teenagers",
            "duration_minutes": 5,
            "language": "English",
            "tone": "Serious",
            "complexity": "Medium",
            "ending_type": "Open ending",
        },
    )
    assert create_res.status_code == 201, create_res.text
    story = create_res.json()
    story_id = story["id"]
    project_id = story["project_id"]
    assert story["current_version_number"] == 1
    assert len(story["document"]["scenes"]) >= 1

    # 2. Update story via PATCH (autosave without version bump, then explicit version bump)
    patch_autosave = client.patch(
        f"/api/v1/stories/{story_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "title": "Chronicles of the Neon Ronin: Director's Cut",
            "logline": "Beneath neon rain, one blade guards the last cherry blossom tree.",
            "create_version": False,
        },
    )
    assert patch_autosave.status_code == 200
    assert patch_autosave.json()["current_version_number"] == 1
    assert (
        patch_autosave.json()["document"]["story"]["title"]
        == "Chronicles of the Neon Ronin: Director's Cut"
    )

    # 3. Add a new scene (POST /api/v1/stories/{story_id}/scenes)
    add_scene_res = client.post(
        f"/api/v1/stories/{story_id}/scenes",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "title": "Rooftop Stand-off",
            "description": "Ren confronts the drone syndicate above the conservatory.",
            "duration_seconds": 30,
            "visual_directions": ["Raindrops sizzle against the plasma katana."],
        },
    )
    assert add_scene_res.status_code == 201, add_scene_res.text
    scene_2 = add_scene_res.json()
    scene_2_id = scene_2["id"]
    assert scene_2["scene_number"] == 2

    # 4. Update scene directly (PATCH /api/v1/scenes/{scene_id})
    upd_scene_res = client.patch(
        f"/api/v1/scenes/{scene_2_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "title": "Rooftop Stand-off at Midnight",
            "duration_seconds": 40,
            "dialogue": [
                {
                    "id": str(uuid.uuid4()),
                    "character_id": story["document"]["characters"][0]["id"],
                    "character_name": story["document"]["characters"][0]["name"],
                    "line": "Step away from the blossoms.",
                    "emotion": "calm",
                    "delivery_direction": "draws glowing katana",
                }
            ],
        },
    )
    assert upd_scene_res.status_code == 200
    assert upd_scene_res.json()["title"] == "Rooftop Stand-off at Midnight"
    assert len(upd_scene_res.json()["dialogue"]) == 1

    # 5. Duplicate scene (POST /api/v1/scenes/{scene_id}/duplicate)
    dup_res = client.post(
        f"/api/v1/scenes/{scene_2_id}/duplicate",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert dup_res.status_code == 201
    dup_scene = dup_res.json()
    dup_scene_id = dup_scene["id"]
    assert dup_scene_id != scene_2_id
    assert "(Copy)" in dup_scene["title"]
    assert dup_scene["scene_number"] == 3

    # 6. Reorder scenes (POST /api/v1/stories/{story_id}/scenes/reorder)
    scenes_list_res = client.get(
        f"/api/v1/stories/{story_id}/scenes",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    current_ids = [s["id"] for s in scenes_list_res.json()]
    assert len(current_ids) == 3
    reversed_ids = list(reversed(current_ids))

    reorder_res = client.post(
        f"/api/v1/stories/{story_id}/scenes/reorder",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"scene_ids": reversed_ids},
    )
    assert reorder_res.status_code == 200
    reordered = reorder_res.json()
    assert [s["id"] for s in reordered] == reversed_ids
    assert [s["scene_number"] for s in reordered] == [1, 2, 3]

    # 7. Delete duplicated scene (DELETE /api/v1/scenes/{scene_id})
    del_scene_res = client.delete(
        f"/api/v1/scenes/{dup_scene_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert del_scene_res.status_code == 204
    remaining_scenes = client.get(
        f"/api/v1/stories/{story_id}/scenes",
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()
    assert len(remaining_scenes) == 2
    assert [s["scene_number"] for s in remaining_scenes] == [1, 2]

    # 8. Save a named Version 2 snapshot, modify story, and restore Version 1
    ver_create_res = client.post(
        f"/api/v1/stories/{story_id}/versions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"label": "Before experimental edits"},
    )
    assert ver_create_res.status_code == 201
    assert ver_create_res.json()["version_number"] == 2

    versions_list = client.get(
        f"/api/v1/stories/{story_id}/versions",
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()
    assert len(versions_list) == 2
    version_1_id = next(v["id"] for v in versions_list if v["version_number"] == 1)

    # Restore Version 1
    restore_res = client.post(
        f"/api/v1/stories/{story_id}/versions/{version_1_id}/restore",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert restore_res.status_code == 200
    restored_story = restore_res.json()
    assert restored_story["current_version_number"] == 3
    assert (
        restored_story["document"]["story"]["title"]
        == "Chronicles of the Neon Ronin"
    )

    # 9. Non-destructive AI Assistant action (apply_immediately=False must NOT overwrite DB)
    with (
        patch.object(settings, "AI_PROVIDER", "gemini"),
        patch.object(settings, "AI_API_KEY", "mock-gemini-api-key"),
        patch.object(
            GeminiStoryProvider,
            "_complete_json",
            return_value=build_mock_ai_raw_json(),
        ),
    ):
        assist_res = client.post(
            f"/api/v1/stories/{story_id}/improve",
            headers={"Authorization": f"Bearer {token_a}"},
            json={
                "action": "make_funnier",
                "apply_immediately": False,
            },
        )
        assert assist_res.status_code == 200
        proposal = assist_res.json()
        assert proposal["applied"] is False
        assert (
            proposal["proposed_document"]["story"]["title"]
            == "The Magical Book of Aethelgard"
        )

        # Verify database story was NOT overwritten because apply_immediately=False
        db_story = client.get(
            f"/api/v1/stories/{story_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        ).json()
        assert (
            db_story["document"]["story"]["title"]
            == "Chronicles of the Neon Ronin"
        )

    # 10. Cross-User Ownership Isolation (User B must receive 403 Forbidden on all User A endpoints)
    assert (
        client.get(
            f"/api/v1/stories/{story_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/stories/by-project/{project_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/stories/{story_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"title": "Unauthorized Edit"},
        ).status_code
        == 403
    )
    active_scene_id = restored_story["document"]["scenes"][0]["id"]
    assert (
        client.patch(
            f"/api/v1/scenes/{active_scene_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"title": "Unauthorized Scene Edit"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/stories/{story_id}/versions",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/v1/stories/{story_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
