"""
Integration Tests for TR STUDIO Step 8 — Professional Dialogue, Voice & Audio Studio.
"""

import io
import struct
import uuid
import wave
from typing import Tuple

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

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


def _create_test_wav_bytes(duration_s: float = 1.0, sample_rate: int = 24000) -> bytes:
    """Generate minimal valid PCM WAV bytes."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        n_samples = int(duration_s * sample_rate)
        samples = [int(10000 * (i % 2)) for i in range(n_samples)]
        raw = struct.pack(f"<{n_samples}h", *samples)
        wf.writeframes(raw)
    return buf.getvalue()


def _setup_project_with_scene(headers: dict) -> Tuple[str, str, str, str]:
    """Sets up a project, character, story, and scene with dialogue and narration."""
    # 1. Project
    p_res = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"title": "Audio Studio Test Project", "genre": "Anime", "animation_style": "2D Animation"},
    )
    assert p_res.status_code == 201
    project_id = p_res.json()["id"]

    # 2. Character
    c_res = client.post(
        "/api/v1/characters",
        headers=headers,
        json={
            "project_id": project_id,
            "name": "Kaito Ren",
            "role": "protagonist",
            "archetype": "hero",
            "age": "17",
            "gender": "male",
        },
    )
    assert c_res.status_code == 201
    character_id = c_res.json()["id"]

    # 3. Story
    s_res = client.post(
        "/api/v1/stories",
        headers=headers,
        json={
            "project_id": project_id,
            "title": "Audio Adventure",
            "idea": "An epic journey through enchanted skies and mysterious floating ruins.",
            "logline": "A story testing professional audio workflows.",
            "summary": "Full audio test synopsis.",
            "genre": "Fantasy",
            "animation_style": "Anime",
            "target_audience": "Teens",
            "duration_minutes": 2,
        },
    )
    assert s_res.status_code == 201, s_res.text
    story_id = s_res.json()["id"]

    # 4. Scene via Scene Builder
    sc_res = client.post(
        f"/api/v1/projects/{project_id}/scene-builder",
        headers=headers,
        json={
            "title": "Scene 1: The Call to Adventure",
            "scene_type": "Action / Confrontation",
            "summary": "The ancient ruins begin to glow.",
            "duration_seconds": 10,
        },
    )
    assert sc_res.status_code == 201, sc_res.text
    scene_id = sc_res.json()["id"]

    # 5. Populate dialogue and narration on scene
    upd_res = client.patch(
        f"/api/v1/scenes/{scene_id}",
        headers=headers,
        json={
            "dialogue": [
                {
                    "character_id": character_id,
                    "character_name": "Kaito Ren",
                    "line": "We cannot back down now! The ancient seal is about to break!",
                    "emotion": "determined",
                }
            ],
            "narration": [
                {
                    "text": "A deep rumble echoes from beneath the cracked earth.",
                    "style": "dramatic",
                }
            ],
        },
    )
    assert upd_res.status_code == 200, upd_res.text

    return project_id, character_id, story_id, scene_id


def test_list_available_voices():
    headers = _register_and_login("voice_user")
    p_res = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"title": "Voice Test Proj", "genre": "Anime", "animation_style": "2D"},
    )
    project_id = p_res.json()["id"]

    res = client.get(f"/api/v1/projects/{project_id}/audio/voices", headers=headers)
    assert res.status_code == 200
    voices = res.json()
    assert len(voices) >= 8
    voice_ids = [v["voice_id"] for v in voices]
    assert "tr-hero-male-1" in voice_ids
    assert "tr-heroine-female-1" in voice_ids


def test_character_voice_profile_crud():
    headers = _register_and_login("vp_user")
    project_id, character_id, _, _ = _setup_project_with_scene(headers)

    # 1. Create profile
    create_res = client.post(
        f"/api/v1/projects/{project_id}/audio/voice-profiles",
        headers=headers,
        json={
            "character_id": character_id,
            "provider": "mock",
            "voice_id": "tr-hero-male-1",
            "voice_name": "Ren (Shonen Protagonist)",
            "voice_style": "heroic",
            "speaking_rate": 1.1,
            "pitch": 1.5,
            "notes": "Main protagonist voice.",
        },
    )
    assert create_res.status_code == 201, create_res.text
    profile = create_res.json()
    profile_id = profile["id"]
    assert profile["character_name"] == "Kaito Ren"
    assert profile["speaking_rate"] == 1.1

    # 2. List profiles
    list_res = client.get(f"/api/v1/projects/{project_id}/audio/voice-profiles", headers=headers)
    assert list_res.status_code == 200
    profiles = list_res.json()
    assert len(profiles) == 1
    assert profiles[0]["id"] == profile_id

    # 3. Update profile
    up_res = client.put(
        f"/api/v1/projects/{project_id}/audio/voice-profiles/{profile_id}",
        headers=headers,
        json={"speaking_rate": 1.25, "pitch": -0.5},
    )
    assert up_res.status_code == 200
    updated = up_res.json()
    assert updated["speaking_rate"] == 1.25
    assert updated["pitch"] == -0.5

    # 4. Delete profile
    del_res = client.delete(f"/api/v1/projects/{project_id}/audio/voice-profiles/{profile_id}", headers=headers)
    assert del_res.status_code == 204

    # 5. Verify deletion
    list_after = client.get(f"/api/v1/projects/{project_id}/audio/voice-profiles", headers=headers)
    assert len(list_after.json()) == 0


def test_audio_asset_upload_and_streaming():
    headers = _register_and_login("audio_asset_user")
    project_id, _, _, _ = _setup_project_with_scene(headers)

    wav_bytes = _create_test_wav_bytes(duration_s=1.5, sample_rate=24000)

    # 1. Upload valid WAV
    files = {"file": ("battle_theme.wav", wav_bytes, "audio/wav")}
    data = {
        "category": "music",
        "sub_category": "battle",
        "title": "Epic Battle Theme",
        "description": "Orchestral combat theme",
    }
    upload_res = client.post(
        f"/api/v1/projects/{project_id}/audio/assets/upload",
        headers=headers,
        files=files,
        data=data,
    )
    assert upload_res.status_code == 201, upload_res.text
    asset = upload_res.json()
    asset_id = asset["id"]
    assert asset["duration_ms"] >= 1400
    assert asset["mime_type"] == "audio/wav"
    assert len(asset["waveform_data"]) == 64
    assert asset["audio_url"] != ""

    # 2. Reject corrupt/spoofed file
    bad_files = {"file": ("fake.wav", b"NOT_A_REAL_AUDIO_FILE_DATA_HERE", "audio/wav")}
    bad_res = client.post(
        f"/api/v1/projects/{project_id}/audio/assets/upload",
        headers=headers,
        files=bad_files,
        data=data,
    )
    assert bad_res.status_code == 400

    # 3. Stream audio media via signed URL
    media_res = client.get(asset["audio_url"])
    assert media_res.status_code == 200
    assert media_res.content == wav_bytes
    assert media_res.headers["Content-Type"] == "audio/wav"


def test_dialogue_speech_generation_and_updates():
    headers = _register_and_login("diag_user")
    project_id, character_id, _, scene_id = _setup_project_with_scene(headers)

    # Assign voice profile to character
    client.post(
        f"/api/v1/projects/{project_id}/audio/voice-profiles",
        headers=headers,
        json={
            "character_id": character_id,
            "provider": "mock",
            "voice_id": "tr-hero-male-1",
            "voice_name": "Ren (Shonen Protagonist)",
            "speaking_rate": 1.0,
        },
    )

    # List dialogue lines
    d_list = client.get(f"/api/v1/projects/{project_id}/audio/dialogue?scene_id={scene_id}", headers=headers)
    assert d_list.status_code == 200
    lines = d_list.json()
    assert len(lines) == 1
    line_id = lines[0]["id"]
    assert lines[0]["audio_status"] == "pending"

    # Update dialogue line properties
    patch_res = client.patch(
        f"/api/v1/projects/{project_id}/audio/dialogue/{line_id}",
        headers=headers,
        json={"speaking_speed": 1.15, "pause_duration_ms": 250, "emotion": "intense"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["speaking_speed"] == 1.15
    assert patch_res.json()["pause_duration_ms"] == 250

    # Generate speech for dialogue line
    gen_res = client.post(
        f"/api/v1/projects/{project_id}/audio/dialogue/{line_id}/generate",
        headers=headers,
        json={"speaking_speed": 1.15},
    )
    assert gen_res.status_code == 200, gen_res.text
    gen_data = gen_res.json()
    assert gen_data["audio_status"] == "ready"
    assert gen_data["audio_asset_id"] is not None
    assert gen_data["duration_ms"] > 0
    assert gen_data["audio_url"] is not None

    # Stream the generated speech
    stream_res = client.get(gen_data["audio_url"])
    assert stream_res.status_code == 200
    assert stream_res.content.startswith(b"RIFF")


def test_honest_error_reporting_for_unconfigured_provider():
    headers = _register_and_login("unconfigured_user")
    project_id, _, _, scene_id = _setup_project_with_scene(headers)

    d_list = client.get(f"/api/v1/projects/{project_id}/audio/dialogue?scene_id={scene_id}", headers=headers)
    line_id = d_list.json()[0]["id"]

    # Request elevenlabs without API key configured
    res = client.post(
        f"/api/v1/projects/{project_id}/audio/dialogue/{line_id}/generate",
        headers=headers,
        json={"provider": "elevenlabs"},
    )
    assert res.status_code == 503
    assert res.json()["error_code"] == "VOICE_AI_NOT_CONFIGURED"


def test_narration_generation_and_batch():
    headers = _register_and_login("narr_user")
    project_id, _, _, scene_id = _setup_project_with_scene(headers)

    n_list = client.get(f"/api/v1/projects/{project_id}/audio/narration?scene_id={scene_id}", headers=headers)
    assert n_list.status_code == 200
    n_lines = n_list.json()
    assert len(n_lines) == 1
    narr_id = n_lines[0]["id"]

    # Generate narration speech
    gen_res = client.post(
        f"/api/v1/projects/{project_id}/audio/narration/{narr_id}/generate",
        headers=headers,
        json={"voice_id": "tr-narrator-cinematic-1"},
    )
    assert gen_res.status_code == 200
    narr_data = gen_res.json()
    assert narr_data["audio_status"] == "ready"
    assert narr_data["duration_ms"] > 0

    # Batch generation test
    batch_res = client.post(
        f"/api/v1/projects/{project_id}/audio/generate-batch",
        headers=headers,
        json={"scene_id": scene_id, "force_regenerate": True},
    )
    assert batch_res.status_code == 200
    batch_data = batch_res.json()
    assert batch_data["total_requested"] == 2
    assert batch_data["completed"] == 2
    assert batch_data["failed"] == 0


def test_subtitles_management_and_export():
    headers = _register_and_login("sub_user")
    project_id, _, _, scene_id = _setup_project_with_scene(headers)

    # 1. Create track
    track_res = client.post(
        f"/api/v1/projects/{project_id}/audio/subtitles",
        headers=headers,
        json={"language": "en", "name": "English Full", "scene_id": scene_id},
    )
    assert track_res.status_code == 201
    track = track_res.json()
    track_id = track["id"]

    # 2. Populate subtitles from scene
    pop_res = client.post(
        f"/api/v1/projects/{project_id}/audio/subtitles/{track_id}/populate?scene_id={scene_id}",
        headers=headers,
    )
    assert pop_res.status_code == 200
    populated = pop_res.json()
    assert len(populated["entries"]) == 2

    # 3. Export SRT
    srt_res = client.get(
        f"/api/v1/projects/{project_id}/audio/subtitles/{track_id}/export?format=srt",
        headers=headers,
    )
    assert srt_res.status_code == 200
    srt = srt_res.json()
    assert srt["format"] == "srt"
    assert "-->" in srt["content"]
    assert "ancient seal" in srt["content"]

    # 4. Export WebVTT
    vtt_res = client.get(
        f"/api/v1/projects/{project_id}/audio/subtitles/{track_id}/export?format=vtt",
        headers=headers,
    )
    assert vtt_res.status_code == 200
    vtt = vtt_res.json()
    assert vtt["format"] == "vtt"
    assert "WEBVTT" in vtt["content"]


def test_timeline_audio_synchronization():
    headers = _register_and_login("sync_user")
    project_id, _, _, scene_id = _setup_project_with_scene(headers)

    # First initialize an animation document for this scene
    anim_res = client.get(f"/api/v1/scenes/{scene_id}/animation", headers=headers)
    assert anim_res.status_code == 200

    # Sync audio to timeline
    sync_res = client.post(
        f"/api/v1/projects/{project_id}/audio/timeline-sync",
        headers=headers,
        json={"scene_id": scene_id, "include_dialogue": True, "include_narration": True},
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["tracks_created"] >= 2
    assert sync_data["clips_created"] >= 2

    # Check updated animation document
    anim_after = client.get(f"/api/v1/scenes/{scene_id}/animation", headers=headers)
    assert anim_after.status_code == 200
    doc = anim_after.json()["document"]
    track_ids = [t["id"] for t in doc["tracks"]]
    assert "track-audio-dialogue" in track_ids
    assert "track-audio-narration" in track_ids
    assert len(doc["clips"]) >= 2
