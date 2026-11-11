# TR STUDIO — Architecture Overview (Step 1 Foundation & Step 2 AI Story Creation Engine)

**TR STUDIO** ("Imagine Anything. Create Everything.") is a full-stack AI-powered animated story creation platform built as a modular monorepo.

## System Topology

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router (@tr-studio/web)                 │
│  Foundation: / | /login | /register | /dashboard | /projects | /settings  │
│  Story Studio: /studio/new | /studio/[projectId]                          │
│                /studio/[projectId]/story | /screenplay | /storyboard      │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ REST JSON + JWT Bearer
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (backend/app)                          │
│  /health | /api/v1/health | /api/v1/auth/* | /api/v1/projects/*           │
│  /api/v1/stories/* | /api/v1/scenes/*                                     │
│  Layered: Routers -> Services -> AIStoryProvider / Repositories -> ORM    │
└──────────────────┬───────────────────────────────────────┬────────────────┘
                   │                                       │
                   ▼                                       ▼
┌─────────────────────────────────────────┐ ┌───────────────────────────────┐
│ PostgreSQL (12 tables: users, projects, │ │   Redis (Prepared for Queue)  │
│ stories, story_versions, characters,    │ └───────────────────────────────┘
│ relationships, locations, scenes,       │
│ dialogue, narration, generation_jobs)   │
└─────────────────────────────────────────┘
```

## Security, AI Provider & Ownership Model

1. **Passwords**: Hashed with `bcrypt` (12 salt rounds) in `app/core/security.py`. Plain-text passwords are never stored or logged.
2. **Authentication**: Stateless signed `HS256` JWT access tokens with configurable expiration (`ACCESS_TOKEN_EXPIRE_MINUTES`).
3. **Strict Ownership Isolation**: Every project, story, scene, AI assistant action, and version operation in `ProjectService` and `StoryService` verifies `owner_id == current_user.id`. Cross-user access attempts are rejected with `403 Forbidden`.
4. **Modular AI Provider Architecture (`app/services/ai_provider.py`)**:
   - Abstract `AIStoryProvider` interface supporting `generate_story`, `continue_story`, `rewrite_story`, `improve_story`, `generate_dialogue`, `translate_story`, and `summarize_story`.
   - Concrete `GeminiStoryProvider` and `OpenAIStoryProvider` implementations kept strictly on the backend using `AI_PROVIDER`, `AI_API_KEY`, and `AI_MODEL`.
   - Deterministic UUID normalization (`extract_and_normalize_story_json`) ensures all characters, relationships, locations, scenes, dialogue lines, and narration blocks use stable UUIDs rather than fragile array indexes.
   - Non-destructive AI Assistant actions (`apply_immediately=False` by default) return a side-by-side proposal (`original_document` vs `proposed_document`) so user work is never silently overwritten.


---

## Step 3 — Professional AI Character Creation Studio Architecture

1. **Database Entities (`backend/app/models/character.py`)**:
   - `characters`: Stores owner-scoped and project-scoped animated characters (`owner_id`, `project_id`, `story_id`, `name`, `nickname`, `role`, `species`, `age_description`, `personality`, `backstory`, `motivation`, `appearance_description`, `canonical_reference_asset_id`, `style`, `metadata`).
   - `character_assets`: Stores generated and uploaded image assets (`asset_type`, `file_reference`, `prompt`, `provider`, `generation_status`, `is_canonical_reference`, `metadata`).
   - `character_expressions`: Stores facial expression presets and custom expressions (`name`, `description`, `generation_status`, `asset_id`, `reference_image_url`).
   - `character_poses`: Stores full-body action and staging poses (`name`, `category`, `description`, `generation_status`, `asset_id`, `reference_image_url`).
   - `character_outfits`: Stores multiple wardrobe variations (`name`, `description`, `color_palette`, `accessories`, `generation_status`, `asset_id`, `reference_image_url`, `is_default`) without overwriting the canonical character appearance description.
   - `character_generation_jobs`: Tracks all AI image generation jobs (`generation_type`, `status`, `provider`, `prompt`, `error_message`, `result_metadata`).

2. **Character Consistency Bible & Prompt Builder (`backend/app/services/character_prompt_builder.py`)**:
   - Synthesizes deterministic, sanitized prompts from the character's canonical Bible, physical attributes, color palette, style descriptor, and reference asset metadata while stripping emails, secret tokens, and control characters.

3. **Modular AI Image Provider (`backend/app/services/image_provider.py`)**:
   - `AIImageProvider` interface with `GeminiImageProvider` and `OpenAIImageProvider` implementations.
   - Supports both `separate_views` and `combined_sheet` modes for character turnaround sheets, returning explicit `views_requested`, `views_generated`, and `complete` status.

4. **Secure Binary Storage & Signed Media Delivery (`backend/app/services/storage_service.py`)**:
   - Validates magic bytes and image dimensions (`PNG`, `JPEG`, `WebP`) before persisting to `LocalSignedStorageBackend` or `S3CompatibleStorageBackend`.
   - Serves media exclusively via HMAC-SHA256 signed URLs (`/api/v1/character-assets/{asset_id}/media?expires=...&sig=...`) without exposing local filesystem paths.
