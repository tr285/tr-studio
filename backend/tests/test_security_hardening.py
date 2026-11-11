"""
Automated Verification Suite for Step 10 Security Hardening, Rate Limiting,
Request Body Limits, and Multi-Entity Cross-User Authorization Isolation.
"""

import uuid
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_security_headers_enforced() -> None:
    """Verifies that SecurityHeadersMiddleware injects required headers on all responses."""
    response = client.get("/health")
    assert response.status_code == 200
    headers = response.headers

    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert "default-src 'self'" in headers.get("content-security-policy", "")
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "camera=()" in headers.get("permissions-policy", "")


def test_request_body_size_limiter() -> None:
    """Verifies that payloads exceeding MAX_JSON_BODY_SIZE (5 MB) are rejected with HTTP 413."""
    oversized_data = {"data": "X" * (6 * 1024 * 1024)}  # 6 MB
    response = client.post(
        "/api/v1/auth/login",
        json=oversized_data,
    )
    assert response.status_code == 413
    assert "PAYLOAD_TOO_LARGE" in response.text or "too large" in response.text.lower()


def test_rate_limiter_auth_endpoints() -> None:
    """Verifies that burst requests exceeding the sliding window threshold receive HTTP 429."""
    client_ip = f"198.51.100.{uuid.uuid4().int % 200 + 1}"
    custom_client = TestClient(app, base_url="http://testserver", headers={"X-Forwarded-For": client_ip})

    # Auth endpoint limit is 50 requests per minute
    hit_rate_limit = False
    for _ in range(65):
        res = custom_client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@trstudio.ai", "password": "wrongpassword123"},
        )
        if res.status_code == 429:
            hit_rate_limit = True
            assert "Retry-After" in res.headers
            break

    assert hit_rate_limit, "Rate limiter should have triggered 429 on auth endpoint"


def test_cross_user_authorization_isolation() -> None:
    """
    Verifies that User B cannot access, read, update, or trigger operations
    on User A's Projects, Scenes, Story Documents, Audio Assets, or Render Jobs.
    """
    suffix = uuid.uuid4().hex[:8]
    user_a_email = f"director_a_{suffix}@trstudio.ai"
    user_b_email = f"intruder_b_{suffix}@trstudio.ai"
    password = "SecurePassword!2026"

    # Register User A
    res_a = client.post(
        "/api/v1/auth/register",
        json={"email": user_a_email, "username": f"user_a_{suffix}", "password": password},
    )
    assert res_a.status_code == 201
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register User B
    res_b = client.post(
        "/api/v1/auth/register",
        json={"email": user_b_email, "username": f"user_b_{suffix}", "password": password},
    )
    assert res_b.status_code == 201
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. User A creates a project
    proj_res = client.post(
        "/api/v1/projects",
        headers=headers_a,
        json={"title": f"Project User A {suffix}", "description": "Confidential production"},
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. User B tries to read User A's project -> 404 / 403
    intruder_proj_get = client.get(f"/api/v1/projects/{project_id}", headers=headers_b)
    assert intruder_proj_get.status_code in (403, 404)

    # 3. User B tries to update User A's project -> 404 / 403
    intruder_proj_put = client.put(
        f"/api/v1/projects/{project_id}",
        headers=headers_b,
        json={"title": "Hacked Project"},
    )
    assert intruder_proj_put.status_code in (403, 404)

    # 4. User B tries to delete User A's project -> 404 / 403
    intruder_proj_del = client.delete(f"/api/v1/projects/{project_id}", headers=headers_b)
    assert intruder_proj_del.status_code in (403, 404)

    # 5. User B tries to list scenes for User A's project -> 403 / 404
    intruder_scenes = client.get(f"/api/v1/projects/{project_id}/scenes", headers=headers_b)
    assert intruder_scenes.status_code in (403, 404)

    # 6. User B tries to list audio assets for User A's project -> 403 / 404
    intruder_audio = client.get(f"/api/v1/projects/{project_id}/audio/assets", headers=headers_b)
    assert intruder_audio.status_code in (403, 404)

    # 7. User B tries to create render job for User A's project -> 403 / 404
    intruder_render = client.post(
        f"/api/v1/projects/{project_id}/render",
        headers=headers_b,
        json={"resolution": "720p", "fps": 24, "quality": "draft"},
    )
    assert intruder_render.status_code in (403, 404)

    # 8. User B tries to access render jobs list for User A's project -> 403 / 404
    intruder_jobs = client.get(f"/api/v1/projects/{project_id}/render/jobs", headers=headers_b)
    assert intruder_jobs.status_code in (403, 404)
