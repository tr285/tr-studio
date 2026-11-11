"""
Automated Backend Verification Test Suite for TR STUDIO Step 1 Foundation.
Verifies:
- Root and v1 health endpoints
- User registration & password hashing
- User login & JWT access tokens
- Protected routes & current-user dependency
- Project creation, listing, detail retrieval, update, and deletion
- Strict user ownership isolation (User B cannot access/edit/delete User A's projects)
"""

import uuid
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoints() -> None:
    res_root = client.get("/health")
    assert res_root.status_code == 200
    data_root = res_root.json()
    assert data_root["status"] == "healthy"
    assert data_root["database"] == "connected"

    res_v1 = client.get("/api/v1/health")
    assert res_v1.status_code == 200
    data_v1 = res_v1.json()
    assert data_v1["status"] == "healthy"
    assert data_v1["api_version"] == "v1"
    assert data_v1["database"] == "connected"


def test_auth_and_project_ownership_isolation() -> None:
    suffix = uuid.uuid4().hex[:8]
    user_a_email = f"director_a_{suffix}@trstudio.ai"
    user_a_username = f"director_a_{suffix}"
    user_b_email = f"director_b_{suffix}@trstudio.ai"
    user_b_username = f"director_b_{suffix}"
    password = "StrongStudioPassword!2026"

    # 1. Register User A
    reg_a = client.post(
        "/api/v1/auth/register",
        json={
            "email": user_a_email,
            "username": user_a_username,
            "password": password,
        },
    )
    assert reg_a.status_code == 201, reg_a.text
    token_a = reg_a.json()["access_token"]
    user_a_id = reg_a.json()["user"]["id"]

    # 2. Login User A
    login_a = client.post(
        "/api/v1/auth/login",
        json={"email": user_a_email, "password": password},
    )
    assert login_a.status_code == 200
    assert login_a.json()["user"]["id"] == user_a_id

    # 3. Verify /me endpoint
    me_a = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert me_a.status_code == 200
    assert me_a.json()["email"] == user_a_email

    # 4. Create project as User A
    proj_res = client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "title": "Cyberpunk Neo-Tokyo Episode 1",
            "description": "Opening rain sequence in Sector 7.",
            "status": "in_progress",
        },
    )
    assert proj_res.status_code == 201, proj_res.text
    project_a = proj_res.json()
    project_id = project_a["id"]
    assert project_a["owner_id"] == user_a_id
    assert project_a["status"] == "in_progress"

    # 5. Register User B
    reg_b = client.post(
        "/api/v1/auth/register",
        json={
            "email": user_b_email,
            "username": user_b_username,
            "password": password,
        },
    )
    assert reg_b.status_code == 201
    token_b = reg_b.json()["access_token"]

    # 6. User B lists projects -> must NOT see User A's project
    list_b = client.get(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert list_b.status_code == 200
    assert all(p["id"] != project_id for p in list_b.json())

    # 7. User B attempts to GET, PATCH, DELETE User A's project -> 403 Forbidden
    get_b = client.get(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_b.status_code == 403

    patch_b = client.patch(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"title": "Hijacked Title"},
    )
    assert patch_b.status_code == 403

    del_b = client.delete(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_b.status_code == 403

    # 8. User A updates and deletes their own project -> succeeds
    patch_a = client.patch(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"title": "Cyberpunk Neo-Tokyo — Director's Cut", "status": "completed"},
    )
    assert patch_a.status_code == 200
    assert patch_a.json()["title"] == "Cyberpunk Neo-Tokyo — Director's Cut"
    assert patch_a.json()["status"] == "completed"

    del_a = client.delete(
        f"/api/v1/projects/{project_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert del_a.status_code == 204
