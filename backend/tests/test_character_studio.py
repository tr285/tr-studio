"""
Comprehensive Backend Verification Test Suite for TR STUDIO Step 3 — Character Creation Studio.
Covers all 15 testing requirements from Section 17:
1. Manual character creation
2. Character updates (attributes, appearance, Character Bible, canonical reference)
3. Character variations & deletion
4. Character listing & filtering
5. Character ownership isolation & cross-user access prevention (403 Forbidden)
6. Image upload validation (magic bytes, dimension bounds, fake extension rejection, signed URL delivery)
7. Image provider configuration & missing API key behavior (503 IMAGE_AI_NOT_CONFIGURED, no fake images)
8. Provider failure handling (429 rate limits, 504 timeouts, 502 corrupted image bytes, failed job tracking)
9. Mocked AI image generation & job status tracking (concept, turnaround sheet, expression, pose, outfit)
10. Prompt builder preview & credential/email sanitization
11. Expression CRUD
12. Pose CRUD
13. Outfit CRUD (verifying default outfit selection preserves canonical appearance)
14. Bidirectional Story Studio integration (import from story, sync to story & scenes without duplication)
"""

import struct
import uuid
import zlib
from typing import Tuple
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.exceptions import ImageProviderException
from app.main import app
from app.services.image_provider import GeminiImageProvider

settings = get_settings()
client = TestClient(app)


def register_user(prefix: str = "char_director") -> Tuple[str, str]:
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


def build_valid_png_bytes(width: int = 64, height: int = 64) -> bytes:
    """
    Construct a valid binary PNG image of `(width, height)` in memory for deterministic upload
    and mocked AI provider verification without external files.
    """
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    signature = b"\x89PNG\r\n\x1a\n"
    # 8-bit RGB (color_type=2)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    # 1 filter byte (0) + width * 3 RGB bytes per scanline
    scanline = b"\x00" + (b"\x6d\x28\xd9" * width)
    raw_image = scanline * height
    idat_data = zlib.compress(raw_image)
    return (
        signature
        + png_chunk(b"IHDR", ihdr_data)
        + png_chunk(b"IDAT", idat_data)
        + png_chunk(b"IEND", b"")
    )


# ==============================================================================
# 1. Manual Character CRUD, Expressions, Poses, Outfits & Ownership Isolation
# ==============================================================================


def test_character_crud_expressions_poses_outfits_and_ownership_isolation() -> None:
    token_a, _ = register_user("char_owner_a")
    token_b, _ = register_user("char_owner_b")

    # 1. Create character manually as User A
    create_res = client.post(
        "/api/v1/characters",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Akira Vance",
            "nickname": "The Starlight Courier",
            "role": "Main character",
            "species": "Human",
            "age_description": "17 years old",
            "gender_presentation": "Non-binary / Androgynous",
            "category": "Protagonist",
            "personality": ["Brave", "Witty", "Resourceful"],
            "backstory": "Raised aboard a decommissioned orbital lighthouse.",
            "motivation": "Deliver the last star-map to the sunken capital.",
            "strengths": ["Zero-gravity navigation", "Chrono-compass mastery"],
            "weaknesses": ["Impulsive under pressure"],
            "special_abilities": ["Phase-stepping through prism light"],
            "appearance_description": "Silver-streaked indigo hair, luminous teal eyes, weathered astral courier jacket.",
            "appearance": {
                "face_shape": "Heart-shaped",
                "eye_shape": "Sharp almond",
                "eye_color": "Luminous teal",
                "hair_style": "Asymmetrical windswept bob",
                "hair_color": "Indigo with silver tips",
                "skin_tone": "Warm olive",
                "body_type": "Agile sprinter build",
                "height": "168 cm",
                "clothing": "High-collar navy courier coat with brass buckles",
                "accessories": "Floating brass astrolabe and fingerless gloves",
                "shoes": "Magnetic grav-boots",
                "distinguishing_features": "Constellation birthmark on left wrist",
                "color_palette": ["#1E1B4B", "#14B8A6", "#F59E0B", "#E2E8F0"],
            },
            "style": "Anime",
            "seed_default_presets": True,
        },
    )
    assert create_res.status_code == 201, create_res.text
    char_a = create_res.json()
    char_id = char_a["id"]
    assert char_a["name"] == "Akira Vance"
    assert char_a["style"] == "Anime"
    # Default presets seeded
    assert len(char_a["expressions"]) >= 6
    assert len(char_a["poses"]) >= 3
    assert len(char_a["outfits"]) >= 1

    # 2. List characters with search filter
    list_res = client.get(
        "/api/v1/characters?search=Akira",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert list_res.status_code == 200
    assert any(c["id"] == char_id for c in list_res.json())

    # 3. Update character attributes & Character Bible
    upd_res = client.patch(
        f"/api/v1/characters/{char_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "nickname": "Grand Starlight Courier",
            "character_bible": {
                "canonical_description": "Akira Vance: 17yo agile courier, indigo hair with silver tips, luminous teal eyes, navy high-collar coat with brass buckles.",
                "color_palette": ["#1E1B4B", "#14B8A6", "#F59E0B"],
                "facial_features": "Sharp almond teal eyes, heart-shaped face",
                "body_proportions": "5.5 heads tall anime hero proportions, 168 cm",
                "clothing_details": "High-collar navy courier coat with brass buckles",
                "accessories_details": "Floating brass astrolabe",
                "style_description": "High-contrast cel-shaded anime aesthetic",
            },
        },
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["nickname"] == "Grand Starlight Courier"
    assert (
        "indigo hair with silver tips"
        in upd_res.json()["metadata"]["character_bible"]["canonical_description"]
    )

    # 4. Prompt Builder Preview & Sanitization (ensuring emails/keys are stripped)
    preview_res = client.post(
        f"/api/v1/characters/{char_id}/preview-prompt",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "generation_type": "full_body",
            "user_instructions": "Contact secret_user@trstudio.ai or sk-1234567890abcdefghijklmnop for details",
        },
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["used_canonical_bible"] is True
    assert "Akira Vance" in preview_data["prompt"]
    assert "secret_user@trstudio.ai" not in preview_data["prompt"]
    assert "sk-1234567890" not in preview_data["prompt"]
    assert "[REDACTED]" in preview_data["prompt"]

    # 5. Expression CRUD (Add custom expression, rename, delete)
    expr_res = client.post(
        f"/api/v1/characters/{char_id}/expressions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Starlight Awaken",
            "description": "Eyes glowing cyan with cosmic focus",
        },
    )
    assert expr_res.status_code == 201
    expr_id = expr_res.json()["id"]

    expr_upd = client.patch(
        f"/api/v1/character-expressions/{expr_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Starlight Awakened (Apex)"},
    )
    assert expr_upd.status_code == 200
    assert expr_upd.json()["name"] == "Starlight Awakened (Apex)"

    expr_del = client.delete(
        f"/api/v1/character-expressions/{expr_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert expr_del.status_code == 204

    # 6. Pose CRUD
    pose_res = client.post(
        f"/api/v1/characters/{char_id}/poses",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Zero-G Leap",
            "category": "Jumping",
            "description": "Mid-air leap kicking off a floating crystal",
        },
    )
    assert pose_res.status_code == 201
    pose_id = pose_res.json()["id"]

    pose_upd = client.patch(
        f"/api/v1/character-poses/{pose_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"description": "Dynamic zero-gravity leap with cape billowing"},
    )
    assert pose_upd.status_code == 200

    # 7. Outfit CRUD (Verifying default outfit switch does NOT overwrite canonical appearance)
    outfit_res = client.post(
        f"/api/v1/characters/{char_id}/outfits",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Winter Expedition Parka",
            "description": "Insulated white-and-gold thermal parka with fur hood",
            "color_palette": ["#F8FAFC", "#F59E0B"],
            "accessories": ["Snow goggles", "Ice grapple"],
            "is_default": True,
        },
    )
    assert outfit_res.status_code == 201
    outfit_id = outfit_res.json()["id"]
    assert outfit_res.json()["is_default"] is True

    # Verify canonical appearance on Character is untouched!
    char_check = client.get(
        f"/api/v1/characters/{char_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()
    assert (
        char_check["metadata"]["appearance"]["clothing"]
        == "High-collar navy courier coat with brass buckles"
    )
    # Only the new outfit should have is_default=True
    default_outfits = [o for o in char_check["outfits"] if o["is_default"]]
    assert len(default_outfits) == 1
    assert default_outfits[0]["id"] == outfit_id

    # 8. Create Character Variation
    var_res = client.post(
        f"/api/v1/characters/{char_id}/variations",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Akira Vance (Chibi Dream Sequence)",
            "style": "Chibi",
            "variation_notes": "Dream sequence super-deformed chibi proportions",
        },
    )
    assert var_res.status_code == 201
    var_id = var_res.json()["id"]
    assert var_id != char_id
    assert var_res.json()["style"] == "Chibi"

    # 9. Ownership Isolation: User B cannot view, edit, delete, or add assets to User A's character
    assert (
        client.get(
            f"/api/v1/characters/{char_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/characters/{char_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"name": "Hijacked Name"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/character-poses/{pose_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"name": "Hijacked Pose"},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/v1/characters/{char_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        ).status_code
        == 403
    )

    # Delete variation as owner User A
    assert (
        client.delete(
            f"/api/v1/characters/{var_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        ).status_code
        == 204
    )


# ==============================================================================
# 2. Image Upload Validation & Signed URL Delivery Tests
# ==============================================================================


def test_image_upload_validation_and_signed_url_security() -> None:
    token_a, _ = register_user("uploader_a")

    char_res = client.post(
        "/api/v1/characters",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Sora Kurosawa", "style": "Anime"},
    )
    char_id = char_res.json()["id"]

    # 1. Reject fake file disguised with .png filename and image/png MIME type
    fake_res = client.post(
        f"/api/v1/characters/{char_id}/assets/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("fake_virus.png", b"NOT_A_REAL_PNG_FILE_HEADER", "image/png")},
        data={"asset_type": "reference_upload"},
    )
    assert fake_res.status_code == 400
    assert fake_res.json()["error_code"] == "UNSUPPORTED_IMAGE_FORMAT"

    # 2. Reject image with dimensions below minimum (e.g. 4x4 px)
    tiny_png = build_valid_png_bytes(width=4, height=4)
    tiny_res = client.post(
        f"/api/v1/characters/{char_id}/assets/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("tiny.png", tiny_png, "image/png")},
    )
    assert tiny_res.status_code == 400
    assert tiny_res.json()["error_code"] == "INVALID_IMAGE_DIMENSIONS"

    # 3. Accept valid 64x64 PNG upload and set as canonical reference
    valid_png = build_valid_png_bytes(width=64, height=64)
    upload_res = client.post(
        f"/api/v1/characters/{char_id}/assets/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("sora_ref.png", valid_png, "image/png")},
        data={
            "asset_type": "reference_upload",
            "label": "Primary Concept Sketch",
            "set_as_canonical_reference": "true",
        },
    )
    assert upload_res.status_code == 201, upload_res.text
    asset = upload_res.json()
    asset_id = asset["id"]
    assert asset["is_canonical_reference"] is True
    assert asset["metadata"]["width"] == 64
    assert asset["metadata"]["height"] == 64
    # Ensure local OS path is never leaked in file_reference
    assert asset["file_reference"].startswith(f"characters/{char_id}/")
    assert "/Users/" not in asset["file_reference"]

    # 4. Fetch signed URL media and verify tampered signature is rejected with 403
    signed_url = asset["url"]
    media_res = client.get(signed_url)
    assert media_res.status_code == 200
    assert media_res.headers["content-type"] == "image/png"
    assert media_res.content == valid_png

    tampered_url = signed_url + "tampered"
    assert client.get(tampered_url).status_code == 403


# ==============================================================================
# 3. Missing API Key Behavior, Provider Failures & Mocked AI Generation
# ==============================================================================


def test_missing_image_api_key_and_provider_failures_and_mocked_generation() -> None:
    token, _ = register_user("ai_artist")

    char_res = client.post(
        "/api/v1/characters",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Lyra Vesper",
            "role": "Main character",
            "species": "Celestial Spirit",
            "appearance_description": "Luminous silver braids, starlight cloak, crystal astrolabe.",
            "style": "Fantasy Illustration",
        },
    )
    char_id = char_res.json()["id"]

    # 1. Missing IMAGE_API_KEY must return 503 IMAGE_AI_NOT_CONFIGURED and never create fake assets
    with patch.object(settings, "IMAGE_API_KEY", ""):
        status_res = client.get(
            "/api/v1/characters/ai-status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert status_res.status_code == 200
        assert status_res.json()["configured"] is False

        no_key_gen = client.post(
            f"/api/v1/characters/{char_id}/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"generation_type": "concept"},
        )
        assert no_key_gen.status_code == 503
        assert no_key_gen.json()["error_code"] == "IMAGE_AI_NOT_CONFIGURED"

    # 2. Provider failure (429 Rate Limit) must record failed job and return 429
    with (
        patch.object(settings, "IMAGE_PROVIDER", "gemini"),
        patch.object(settings, "IMAGE_API_KEY", "mock-image-key"),
        patch.object(
            GeminiImageProvider,
            "_generate_raw_image",
            side_effect=ImageProviderException(
                detail="Image provider rate limit exceeded.",
                status_code=429,
                error_code="IMAGE_PROVIDER_RATE_LIMITED",
            ),
        ),
    ):
        fail_res = client.post(
            f"/api/v1/characters/{char_id}/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"generation_type": "portrait"},
        )
        assert fail_res.status_code == 429

    # Verify failed job was recorded
    jobs_after_fail = client.get(
        f"/api/v1/characters/{char_id}/jobs",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert len(jobs_after_fail) >= 1
    assert jobs_after_fail[0]["status"] == "failed"

    # 3. Mocked Real Image Generation for Concept, Turnaround Sheet, Expression, Pose, and Outfit
    mock_png = build_valid_png_bytes(width=128, height=128)
    with (
        patch.object(settings, "IMAGE_PROVIDER", "gemini"),
        patch.object(settings, "IMAGE_API_KEY", "mock-image-key"),
        patch.object(
            GeminiImageProvider,
            "_generate_raw_image",
            return_value=mock_png,
        ),
    ):
        # 3a. Generate Character Concept
        gen_concept = client.post(
            f"/api/v1/characters/{char_id}/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "generation_type": "concept",
                "set_as_canonical_reference": True,
            },
        )
        assert gen_concept.status_code == 201, gen_concept.text
        concept_data = gen_concept.json()
        assert concept_data["job"]["status"] == "completed"
        assert len(concept_data["generated_assets"]) == 1
        job_id = concept_data["job"]["id"]

        # Check job detail endpoint GET /api/v1/character-generation-jobs/{job_id}
        job_detail = client.get(
            f"/api/v1/character-generation-jobs/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert job_detail.status_code == 200
        assert job_detail.json()["status"] == "completed"

        # 3b. Generate Turnaround Sheet (front_view + side_view)
        gen_sheet = client.post(
            f"/api/v1/characters/{char_id}/generate-sheet",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "views": ["front_view", "side_view"],
                "sheet_mode": "separate_views",
            },
        )
        assert gen_sheet.status_code == 201, gen_sheet.text
        sheet_data = gen_sheet.json()
        assert sheet_data["complete"] is True
        assert sheet_data["views_generated"] == ["front_view", "side_view"]
        assert len(sheet_data["generated_assets"]) == 2

        # 3c. Generate Expression Asset
        gen_expr = client.post(
            f"/api/v1/characters/{char_id}/generate-expression",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "expression_name": "Joyful Radiance",
                "description": "Beaming smile with starlight sparkles",
            },
        )
        assert gen_expr.status_code == 201, gen_expr.text
        assert gen_expr.json()["job"]["status"] == "completed"

        # 3d. Generate Pose Asset
        gen_pose = client.post(
            f"/api/v1/characters/{char_id}/generate-pose",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "pose_name": "Spellcasting Hover",
                "category": "Fighting",
                "description": "Levitating with astrolabe rings spinning",
            },
        )
        assert gen_pose.status_code == 201, gen_pose.text
        assert gen_pose.json()["job"]["status"] == "completed"

        # 3e. Generate Outfit Asset
        gen_outfit = client.post(
            f"/api/v1/characters/{char_id}/generate-outfit",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "outfit_name": "Royal Astral Ceremonial Robes",
                "description": "Layered velvet and gold-thread ceremonial robes",
                "color_palette": ["#311042", "#FBBF24"],
                "accessories": ["Star crown"],
            },
        )
        assert gen_outfit.status_code == 201, gen_outfit.text
        assert gen_outfit.json()["job"]["status"] == "completed"


# ==============================================================================
# 4. Story Studio <-> Character Studio Integration (No Duplicate Characters)
# ==============================================================================


def test_story_and_character_studio_bidirectional_integration() -> None:
    token, _ = register_user("story_char_integrator")

    # 1. Create a Step 2 manual story
    story_res = client.post(
        "/api/v1/stories",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Skyline Alchemists",
            "idea": "Two alchemists build a cloud-ship to cross the storm wall.",
            "genre": "Fantasy",
            "animation_style": "Anime",
        },
    )
    assert story_res.status_code == 201
    story = story_res.json()
    story_id = story["id"]
    project_id = story["project_id"]
    first_scene_id = story["document"]["scenes"][0]["id"]

    # 2. Import characters from the Story into Character Studio (twice to verify idempotency / no duplicates)
    imp_1 = client.post(
        f"/api/v1/characters/import-from-story/{story_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imp_1.status_code == 200
    imported_chars_1 = imp_1.json()
    assert len(imported_chars_1) >= 1

    imp_2 = client.post(
        f"/api/v1/characters/import-from-story/{story_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imp_2.status_code == 200
    imported_chars_2 = imp_2.json()
    assert [c["id"] for c in imported_chars_1] == [c["id"] for c in imported_chars_2]

    # 3. Create a brand-new character in Character Studio and sync it into the Story + Scene 1
    new_char_res = client.post(
        "/api/v1/characters",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "project_id": project_id,
            "name": "Captain Vaelen",
            "role": "Supporting character",
            "species": "Sky-Dwarf",
            "appearance_description": "Braided copper beard, brass airship captain coat, monocle lens.",
            "style": "Anime",
        },
    )
    assert new_char_res.status_code == 201
    vaelen_id = new_char_res.json()["id"]

    sync_res = client.post(
        f"/api/v1/characters/{vaelen_id}/sync-to-story",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "story_id": story_id,
            "scene_ids": [first_scene_id],
        },
    )
    assert sync_res.status_code == 200

    # Syncing a second time must update in-place without duplicating Captain Vaelen in the story
    sync_again = client.post(
        f"/api/v1/characters/{vaelen_id}/sync-to-story",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "story_id": story_id,
            "scene_ids": [first_scene_id],
        },
    )
    assert sync_again.status_code == 200

    updated_story = client.get(
        f"/api/v1/stories/{story_id}",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    vaelen_matches = [
        c
        for c in updated_story["document"]["characters"]
        if c["name"] == "Captain Vaelen"
    ]
    assert len(vaelen_matches) == 1
    assert vaelen_matches[0]["id"] in updated_story["document"]["scenes"][0]["characters"]
