# TR STUDIO — API Integration & Deployment Architecture Guide

> **Tagline:** Imagine Anything. Create Everything.  
> **Architecture:** Next.js (Web Frontend) + FastAPI (Python Backend) + PostgreSQL + Redis + FFmpeg

---

## 1. Overview & Architecture Separation

TR STUDIO is structured as a professional creative animation platform consisting of two primary runtime services:

1. **Frontend (`apps/web`)**: Next.js 15 App Router web client providing the Linearity-inspired Creative Studio Workspace, Landing Page, Dashboard, Character Studio, Environment Studio, Scene Builder, Storyboard, 2D Animation Timeline, and Audio Studio.
2. **Backend (`backend`)**: FastAPI server powering JWT authentication, PostgreSQL relational persistence, Google Gemini AI story generation, character asset management, and the hardware-accelerated FFmpeg rendering pipeline.

```
┌─────────────────────────────────┐
│     Next.js 15 Web Frontend    │  (Hosted on Vercel, Cloud Run, or Node.js)
│     (apps/web - Port 3000)      │
└────────────────┬────────────────┘
                 │ HTTP REST + Bearer JWT
                 ▼
┌─────────────────────────────────┐
│       FastAPI Python Backend    │  (Hosted on Cloud Run, Railway, Render, or VPS)
│       (backend - Port 8000)     │
└────────┬───────┬───────┬────────┘
         │       │       │
         ▼       ▼       ▼
    PostgreSQL Redis   FFmpeg Encoder & Storage
```

---

## 2. Environment Variables Matrix

### A. Frontend Environment Variables (`apps/web`)
*Prefix: `NEXT_PUBLIC_` (Publicly exposed to the browser)*

| Variable Name | Required | Default (Local) | Purpose |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes (in Prod)** | `http://localhost:8000` | Base URL of the FastAPI backend. |
| `NEXT_PUBLIC_API_V1_URL` | Optional | `${NEXT_PUBLIC_API_URL}/api/v1` | URL of API v1 prefix. |
| `NEXT_PUBLIC_APP_NAME` | Optional | `"TR STUDIO"` | Application display name. |

> **SECURITY WARNING:**  
> **NEVER** expose backend secrets (such as `AI_API_KEY`, `SECRET_KEY`, or `DATABASE_URL`) to frontend environment variables or any variable prefixed with `NEXT_PUBLIC_`.

---

### B. Backend Environment Variables (`backend`)
*Server-side only — strictly kept in backend `.env` or container runtime secrets*

| Variable Name | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `SECRET_KEY` | **Yes** | *None* | 64-character secret for signing JWT access tokens (`openssl rand -hex 32`). |
| `DATABASE_URL` | **Yes** | *None* | PostgreSQL connection string (`postgresql+psycopg://user:pass@host:5432/db`). |
| `CORS_ORIGINS` | **Yes** | `http://localhost:3000` | Comma-separated list of allowed frontend origins (e.g. `https://trstudio.vercel.app`). |
| `ENVIRONMENT` | Optional | `development` | Environment mode (`development`, `staging`, `production`). |
| `DEBUG` | Optional | `true` | Enables verbose debug logging when true. |
| `BACKEND_HOST` | Optional | `0.0.0.0` | Host IP address for Uvicorn. |
| `BACKEND_PORT` | Optional | `8000` | Port for Uvicorn. |
| `REDIS_URL` | Optional | `redis://localhost:6379/0` | Redis connection for queues and background rendering jobs. |
| `AI_PROVIDER` | Optional | `gemini` | AI story generation provider (`gemini`, `openai`, `openai_compatible`). |
| `AI_API_KEY` | Optional | *Empty* | Google AI Studio Gemini API key. If empty, studio runs in honest manual mode. |
| `AI_MODEL` | Optional | `gemini-2.0-flash` | Gemini model name (Gemini 2.0 Flash is primary free-tier model). |
| `AI_TIMEOUT_SECONDS` | Optional | `90` | HTTP request timeout for AI completions. |
| `AI_MAX_OUTPUT_TOKENS` | Optional | `8192` | Maximum output token ceiling for story completions. |
| `AI_MAX_RETRIES` | Optional | `3` | Maximum retry attempts for transient 429 / 503 errors. |
| `AI_RETRY_DELAY_SECONDS`| Optional | `2.0` | Base exponential backoff delay with jitter. |
| `STORAGE_BACKEND` | Optional | `local` | Asset storage backend (`local` or `s3`). |
| `STORAGE_LOCAL_DIR` | Optional | `./storage` | Filesystem directory for character assets and rendered MP4 files. |

---

## 3. Local Development Setup

### 1. Configure Backend Environment
Copy the example configuration to your local `.env`:
```bash
cp .env.example .env
```
Ensure `SECRET_KEY` is at least 16 characters (or generate a random 32-byte hex key):
```bash
openssl rand -hex 32
```

### 2. Start PostgreSQL & Redis
Using Docker Compose:
```bash
docker compose up -d postgres redis
```

### 3. Start FastAPI Backend
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Verify the backend is live at `http://localhost:8000/health`.

### 4. Start Next.js Frontend
In a separate terminal:
```bash
npm run dev:web
```
Open `http://localhost:3000` in your browser.

---

## 4. Production Deployment & The Vercel HTTP 503 Diagnostic

### Root Cause Analysis of Vercel HTTP 503 Errors
If deploying TR STUDIO to Vercel causes `HTTP 503 Service Unavailable`, this is caused by:

1. **Attempting to run Python/FastAPI inside Vercel Serverless**:  
   Vercel serverless functions have strict execution timeouts (10s on Hobby, 60s on Pro), lack FFmpeg binaries, cannot run persistent background workers, and have ephemeral file storage. The full TR STUDIO backend cannot run inside a Vercel serverless function.
2. **Missing `NEXT_PUBLIC_API_URL`**:  
   If the frontend is deployed to Vercel without setting `NEXT_PUBLIC_API_URL`, the frontend defaults to `http://localhost:8000`. In production, client browsers and Next.js SSR attempt to connect to `localhost:8000`, which fails immediately with connection refused / 503.
3. **CORS Misconfiguration**:  
   If the deployed FastAPI backend's `CORS_ORIGINS` does not include your Vercel deployment URL (e.g. `https://tr-studio.vercel.app`), browser security blocks all requests.

---

### Correct Production Deployment Architecture

#### Step 1: Deploy Backend (FastAPI + FFmpeg + Uvicorn)
Deploy the backend to a container platform with persistent compute and FFmpeg support:
- **Recommended platforms**: Google Cloud Run, Railway, Render, Fly.io, or an AWS EC2/ECS container.
- Docker image: Use `infrastructure/docker/Dockerfile.backend`.
- Configure the container environment variables:
  ```env
  ENVIRONMENT=production
  DEBUG=false
  SECRET_KEY=<your-generated-64-char-hex-secret>
  DATABASE_URL=postgresql+psycopg://user:pass@host:5432/trstudio_db
  REDIS_URL=redis://default:pass@host:6379/0
  CORS_ORIGINS=https://your-frontend.vercel.app,https://yourdomain.com
  AI_PROVIDER=gemini
  AI_API_KEY=<your-google-ai-studio-key>
  AI_MODEL=gemini-2.0-flash
  STORAGE_BACKEND=s3 # or persistent volume
  ```

#### Step 2: Deploy Frontend (Next.js) to Vercel
Deploy `apps/web` to Vercel:
- **Framework Preset**: Next.js
- **Root Directory**: `apps/web` (or root with workspace build)
- **Build Command**: `npm run build:web`
- **Output Directory**: `.next`
- **Environment Variables**:
  ```env
  NEXT_PUBLIC_API_URL=https://api.yourdomain.com
  NEXT_PUBLIC_API_V1_URL=https://api.yourdomain.com/api/v1
  NEXT_PUBLIC_APP_NAME="TR STUDIO"
  ```

---

## 5. Verification Checklist

1. **Backend Health Check**:
   ```bash
   curl -s https://api.yourdomain.com/health | jq .
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "TR STUDIO",
     "version": "1.0.0",
     "database": "connected",
     "ffmpeg": "available"
   }
   ```

2. **Frontend Authentication Check**:
   - Visit `https://your-frontend.vercel.app/login`
   - Register or log in to a studio director account
   - Check developer tools Network tab: requests should hit `https://api.yourdomain.com/api/v1/auth/login` and receive HTTP 200 with JWT Bearer token.

3. **Gemini AI Story Check**:
   - Check AI Status: `GET https://api.yourdomain.com/api/v1/stories/ai-status`
   - When `AI_API_KEY` is configured: returns `configured: true`, model: `gemini-2.0-flash`.
   - When `AI_API_KEY` is unset: returns `configured: false`, allowing honest manual story creation.
