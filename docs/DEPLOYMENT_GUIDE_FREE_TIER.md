# TR STUDIO — ₹0 Production Deployment Guide (Vercel + Render + Neon)

> **Estimated Monthly Cost:** ₹0 / month ($0.00 USD)  
> **Credit Card Required:** No  
> **Platforms:** Vercel (Frontend), Render (Backend + FFmpeg), Neon (PostgreSQL)  

---

## Architecture Overview

```
[ User Browser ]
       │ HTTPS
       ▼
[ Vercel: apps/web ]  ────────►  [ Render: FastAPI Backend + FFmpeg ]
  (Next.js 15 App Router)        (Docker: python:3.13-slim)
                                           │
                                           ▼
                                 [ Neon Serverless PostgreSQL ]
                                 (Free Tier, 0.5 GB Permanent DB)
```

---

## Step 1: Create a Free PostgreSQL Database on Neon (3 minutes)

1. Go to **[https://neon.tech](https://neon.tech)** and sign up for a free account (Sign in with GitHub/Google — **No credit card required**).
2. Click **Create Project**:
   - **Project Name:** `tr-studio-db`
   - **Postgres Version:** `16` (or `17`)
   - **Region:** Choose the region closest to your target audience (e.g. `US East (N. Virginia)` or `EU (Frankfurt)`).
3. Once created, copy the connection details from the Dashboard:
   - Select the **Connection string** tab.
   - Choose **PostgreSQL** or **SQLAlchemy**.
   - Your connection string will look like:
     ```
     postgresql://neondb_owner:npg_xyz...@ep-cool-frost-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
4. **Important for TR STUDIO:** Change the prefix from `postgresql://` to `postgresql+psycopg://`:
   ```
   postgresql+psycopg://neondb_owner:npg_xyz...@ep-cool-frost-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this string handy for Step 2; never commit it to Git).*

---

## Step 2: Deploy the Backend to Render (5 minutes)

1. Go to **[https://render.com](https://render.com)** and sign up / log in with your GitHub account.
2. Click **New +** > **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository: `tr285/tr-studio`.
4. Fill in the service settings:
   - **Name:** `tr-studio-api`
   - **Region:** Match your Neon region if possible (e.g. `Oregon` or `Frankfurt`).
   - **Language / Runtime:** **Docker**
   - **Dockerfile Path:** `infrastructure/docker/Dockerfile.backend`
   - **Docker Context:** `.` (root directory)
   - **Instance Type:** **Free** (0.1 CPU, 512 MB RAM)
5. Scroll down to **Environment Variables** and add the following:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `ENVIRONMENT` | `production` | Enforces production mode |
   | `DEBUG` | `false` | Disables debug stack traces |
   | `SECRET_KEY` | *(Click "Generate" or paste a 64-char hex)* | Used to sign JWT access tokens |
   | `DATABASE_URL` | *(Paste your Neon URI from Step 1)* | `postgresql+psycopg://...` |
   | `CORS_ORIGINS` | `https://tr-studio.vercel.app,http://localhost:3000` | Update with your Vercel URL |
   | `AI_PROVIDER` | `gemini` | Gemini story engine |
   | `AI_MODEL` | `gemini-2.0-flash` | Free standard model |
   | `AI_API_KEY` | *(Optional: Your Google AI Studio key)* | Free from https://aistudio.google.com |
   | `STORAGE_BACKEND`| `local` | Uses container storage |
   | `STORAGE_LOCAL_DIR` | `/storage` | Directory inside container |

6. Click **Create Web Service**.
7. Render will build the Docker container (installing Python, FFmpeg, dependencies) and execute `alembic upgrade head`.
8. Once the build finishes, copy your Render service URL (e.g. `https://tr-studio-api.onrender.com`).
9. Verify health check by visiting:
   ```
   https://tr-studio-api.onrender.com/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "TR STUDIO",
     "database": "connected",
     "ffmpeg": "available"
   }
   ```

---

## Step 3: Deploy the Frontend to Vercel (3 minutes)

1. Go to **[https://vercel.com](https://vercel.com)** and log in with GitHub.
2. Click **Add New...** > **Project**.
3. Import `tr285/tr-studio`.
4. Configure the project:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./` (Leave as repository root — `vercel.json` automatically configures `apps/web`)
   - **Build Command:** `npm run build:web`
   - **Output Directory:** `apps/web/.next`
5. Expand **Environment Variables** and add:

   | Key | Value |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://tr-studio-api.onrender.com` (Your Render URL from Step 2) |
   | `NEXT_PUBLIC_API_V1_URL` | `https://tr-studio-api.onrender.com/api/v1` |
   | `NEXT_PUBLIC_APP_NAME` | `TR STUDIO` |

6. Click **Deploy**.
7. Once deployed, Vercel will assign your live domain (e.g. `https://tr-studio.vercel.app`).

---

## Step 4: Final CORS Sync (1 minute)

1. Go back to your **Render Dashboard** > `tr-studio-api` > **Environment**.
2. Update `CORS_ORIGINS` to include your exact Vercel production URL:
   ```env
   CORS_ORIGINS=https://tr-studio.vercel.app,https://your-custom-domain.com
   ```
3. Render will automatically redeploy the backend with the updated CORS allowlist.

---

## Step 5: Verification & Smoke Test

1. Open your live Vercel site: `https://tr-studio.vercel.app`.
2. Click **Get Started** or **Sign In**.
3. Register a new Director account at `/register`.
4. Create a new animation project from the dashboard.
5. Create a story, customize scenes, and trigger an export.
6. Check Developer Tools > Network tab: all requests should return `HTTP 200` to `tr-studio-api.onrender.com`.

---

## Free-Tier Expectations & Tips

- **Render Cold Start (15 min inactivity):** Render free services sleep after 15 minutes of inactivity. When someone visits the site after a period of dormancy, the first API request may take **50–80 seconds** to wake the container. The frontend shows a friendly notice while it wakes up.
- **Neon Instant Wake:** Neon databases sleep when idle and wake in **under 1 second**, so database queries do not suffer from cold starts.
- **FFmpeg 512 MB RAM Limit:** Standard 720p 24fps animations render smoothly within 300–400 MB RAM. Avoid attempting 4K or high-bitrate long exports on the free tier.
