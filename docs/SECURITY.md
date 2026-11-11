# TR STUDIO — Security Policy & Hardening Specification

**Product:** TR STUDIO — *Imagine Anything. Create Everything.*  
**Status:** Step 10 Launch Hardened & Production Verified  
**Date:** November 2026

---

## 1. Security Architecture & Threat Model

TR STUDIO is designed with strict multi-tenant isolation, defensive middleware, and end-to-end media authorization:

```
[ User Browser / PWA ]
          │  HTTPS / WSS
          ▼
[ SecurityHeadersMiddleware ] (CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff)
          │
[ RequestBodySizeLimitMiddleware ] (Max 5MB JSON, Max 100MB Media Upload)
          │
[ InMemoryRateLimiterMiddleware ] (Sliding-window: 240 req/min general, 50 req/min auth)
          │
[ JWT Bearer Authentication Dependency ] (HS256 with Argon2id password hashing)
          │
[ Ownership Verification Layer ] (Strict user_id isolation on Projects, Scenes, Audio, Renders)
          │
[ Media Storage & FFmpeg Execution ] (HMAC-SHA256 Expiring Signed URLs & Process Sandboxing)
```

---

## 2. Authentication & Credential Storage

1. **Password Hashing:** Passwords are never stored in plaintext. Passwords use **Argon2id** (via `passlib.context.CryptContext`) with adaptive memory-hard parameters.
2. **Access Tokens:** Authenticated requests carry short-lived JWT bearer tokens signed using `HS256`.
3. **Secret Key Validation:** In `production` environment, TR STUDIO strictly verifies that `SECRET_KEY` is not default or shorter than 32 characters, immediately aborting startup if an insecure key is detected.

---

## 3. Authorization & Tenant Isolation

1. **Zero-Trust Ownership Checks:** Every operation accessing Projects, Stories, Scenes, Audio Assets, Voice Profiles, or Video Renders queries both `entity_id` and `owner_id == current_user.id`.
2. **Intruder Access Rejection:** Any cross-user attempt returns `HTTP 403 Forbidden` or `HTTP 404 Not Found`. Intruders cannot list, read, alter, or delete another user's project data or assets.
3. **Signed Media URLs:** Media assets (audio recordings, character portraits, environment artwork, and rendered MP4 video files) are served only through expiring URLs authenticated by **HMAC-SHA256 signatures**.

---

## 4. Middleware Defense In Depth

| Defense Layer | Policy / Limit | Behavior on Violation |
| :--- | :--- | :--- |
| **Content Security Policy (CSP)** | `default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: data:` | Browser enforces script/object execution boundaries |
| **Frame Sniffing Protection** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | Blocks clickjacking and MIME-type confusion attacks |
| **Request Body Limiter** | JSON: 5 MB / Uploads: 100 MB | Rejects oversized requests with `HTTP 413 Payload Too Large` |
| **Sliding Window Rate Limiter** | Auth: 50 req/min / General: 240 req/min | Rejects bursts with `HTTP 429 Too Many Requests` + `Retry-After: 60` |

---

## 5. Media Pipeline & Subprocess Security

1. **FFmpeg Execution:** Invoked with strict non-shell argument arrays (`shlex`-safe, `shell=False`) to prevent command injection.
2. **File Validation:** Incoming uploaded images and audio are validated with Pillow and FFprobe to confirm valid headers and dimensions before writing to disk.
3. **Temporary Isolation:** Rendered frames and audio intermediates are synthesized inside isolated process-scoped temporary directories (`tempfile.mkdtemp(prefix="tr_render_...")`) and cleaned up immediately upon job completion or cancellation.

---

## 6. Vulnerability Reporting

If you identify a security issue in TR STUDIO, please submit a confidential report to `security@trstudio.ai`. We appreciate responsible disclosure and address high-severity issues within 24 hours.
