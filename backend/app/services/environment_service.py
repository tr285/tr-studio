"""
Service Layer for TR STUDIO Step 4 — World & Environment Creation Studio.
Implements:
- Environment CRUD, ownership enforcement, and default variation seeding
- Prompt preview via `EnvironmentPromptBuilder`
- Real AI environment & variation image generation via Step 3's modular `AIImageProvider`
- Reference & background image upload with binary header/dimension validation
- World & WorldLocation hierarchical organization (World -> Region -> Location -> Building -> Room / Natural Area)
- Bidirectional Story Studio, Scene location, and Character planning integration
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import (
    AppException,
    ForbiddenException,
    ImageAIConfigurationException,
    ImageProviderException,
    NotFoundException,
)
from app.models.environment import (
    Environment,
    EnvironmentAsset,
    EnvironmentGenerationJob,
    EnvironmentVariation,
    World,
    WorldLocation,
)
from app.models.project import Project
from app.models.story import Story
from app.models.user import User
from app.repositories.environment_repository import EnvironmentRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.story_repository import StoryRepository
from app.schemas.environment import (
    EnvironmentAssetResponse,
    EnvironmentAssetUpdateRequest,
    EnvironmentCreateRequest,
    EnvironmentGenerateImageRequest,
    EnvironmentGenerateVariationRequest,
    EnvironmentGenerationJobResponse,
    EnvironmentGenerationResultResponse,
    EnvironmentPromptPreviewRequest,
    EnvironmentPromptPreviewResponse,
    EnvironmentResponse,
    EnvironmentStorySyncRequest,
    EnvironmentSummaryResponse,
    EnvironmentUpdateRequest,
    EnvironmentVariationCreateRequest,
    EnvironmentVariationResponse,
    EnvironmentVariationUpdateRequest,
    EnvironmentVisualDetails,
    WorldCreateRequest,
    WorldLocationCreateRequest,
    WorldLocationResponse,
    WorldLocationUpdateRequest,
    WorldResponse,
    WorldUpdateRequest,
)
from app.services.environment_prompt_builder import EnvironmentPromptBuilder
from app.services.image_provider import (
    ReferenceImageInput,
    get_ai_image_provider,
)
from app.services.storage_service import (
    get_storage_backend,
    validate_and_inspect_image_bytes,
    verify_media_signature,
)

DEFAULT_ENVIRONMENT_VARIATION_PRESETS = [
    ("Morning Version", "time_of_day", "Crisp golden morning sunlight with soft mist"),
    ("Sunset Version", "time_of_day", "Warm amber-violet sunset with long dramatic shadows"),
    ("Night Version", "time_of_day", "Moonlit nocturnal atmosphere with glowing practical lights"),
    ("Rainy Version", "weather", "Wet reflective surfaces, rainfall streaks, and overcast sky"),
    ("Winter Version", "season", "Frost and snow accumulation with cool atmospheric haze"),
]


class EnvironmentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = EnvironmentRepository(db)
        self.project_repo = ProjectRepository(db)
        self.story_repo = StoryRepository(db)
        self.storage = get_storage_backend()

    # ------------------------------------------------------------------
    # Ownership & Project Helpers
    # ------------------------------------------------------------------

    def _resolve_or_create_project(
        self,
        user: User,
        project_id: Optional[uuid.UUID] = None,
        story_id: Optional[uuid.UUID] = None,
    ) -> Tuple[Project, Optional[Story]]:
        linked_story: Optional[Story] = None
        if story_id:
            linked_story = self.story_repo.get_by_id(story_id)
            if not linked_story:
                raise NotFoundException("Story not found.")
            if linked_story.owner_id != user.id:
                raise ForbiddenException("You do not have access to this story.")
            project_id = linked_story.project_id

        if project_id:
            project = self.project_repo.get_by_id(project_id)
            if not project:
                raise NotFoundException("Project not found.")
            if project.owner_id != user.id:
                raise ForbiddenException("You do not have access to this project.")
            if not linked_story:
                linked_story = self.story_repo.get_by_project_id(project.id)
            return project, linked_story

        existing = self.project_repo.list_by_owner(user.id)
        if existing:
            proj = existing[0]
            linked_story = self.story_repo.get_by_project_id(proj.id)
            return proj, linked_story

        created_proj = self.project_repo.create(
            owner_id=user.id,
            title="TR STUDIO World & Environment Library",
            description="Default project workspace for environments and worlds.",
            status="in_progress",
        )
        return created_proj, None

    def _get_owned_environment(
        self, user: User, environment_id: uuid.UUID
    ) -> Environment:
        env = self.repo.get_by_id_with_relations(environment_id)
        if not env:
            raise NotFoundException("Environment not found.")
        if env.owner_id != user.id:
            raise ForbiddenException("You do not have access to this environment.")
        return env

    def _get_owned_world(self, user: User, world_id: uuid.UUID) -> World:
        world = self.repo.get_world_by_id(world_id)
        if not world:
            raise NotFoundException("World not found.")
        if world.owner_id != user.id:
            raise ForbiddenException("You do not have access to this world.")
        return world

    # ------------------------------------------------------------------
    # Serialization Helpers
    # ------------------------------------------------------------------

    def _serialize_asset(
        self, asset: EnvironmentAsset, default_asset_id: Optional[uuid.UUID]
    ) -> EnvironmentAssetResponse:
        return EnvironmentAssetResponse(
            id=asset.id,
            environment_id=asset.environment_id,
            owner_id=asset.owner_id,
            asset_type=asset.asset_type,
            file_reference=asset.file_reference,
            url=self.storage.build_signed_environment_media_url(
                asset.id, download=False
            ),
            download_url=self.storage.build_signed_environment_media_url(
                asset.id, download=True
            ),
            prompt=asset.prompt,
            provider=asset.provider,
            generation_status=asset.generation_status,
            is_default=(default_asset_id == asset.id),
            metadata=asset.asset_metadata or {},
            created_at=asset.created_at,
        )

    def _serialize_variation(
        self, variation: EnvironmentVariation
    ) -> EnvironmentVariationResponse:
        img_url: Optional[str] = None
        if variation.asset_id:
            img_url = self.storage.build_signed_environment_media_url(
                variation.asset_id, download=False
            )
        return EnvironmentVariationResponse(
            id=variation.id,
            environment_id=variation.environment_id,
            name=variation.name,
            description=variation.description,
            variation_type=variation.variation_type,
            asset_id=variation.asset_id,
            image_url=img_url,
            is_default=variation.is_default,
            created_at=variation.created_at,
        )

    def _serialize_job(
        self, job: EnvironmentGenerationJob
    ) -> EnvironmentGenerationJobResponse:
        return EnvironmentGenerationJobResponse(
            id=job.id,
            environment_id=job.environment_id,
            owner_id=job.owner_id,
            generation_type=job.generation_type,
            status=job.status,
            provider=job.provider,
            prompt=job.prompt,
            error_message=job.error_message,
            result_metadata=job.result_metadata or {},
            created_at=job.created_at,
            updated_at=job.updated_at,
        )

    def serialize_environment(self, env: Environment) -> EnvironmentResponse:
        meta_raw = env.environment_metadata or {}
        visual_details = EnvironmentVisualDetails(
            location_type=meta_raw.get("location_type") or "Forests",
            architecture=meta_raw.get("architecture"),
            terrain=meta_raw.get("terrain"),
            vegetation=meta_raw.get("vegetation"),
            props=meta_raw.get("props"),
            lighting=meta_raw.get("lighting"),
            atmosphere=meta_raw.get("atmosphere"),
            custom_time_of_day=meta_raw.get("custom_time_of_day"),
            custom_weather=meta_raw.get("custom_weather"),
            custom_camera_perspective=meta_raw.get("custom_camera_perspective"),
            custom_art_style=meta_raw.get("custom_art_style"),
            additional_instructions=meta_raw.get("additional_instructions"),
            tags=list(meta_raw.get("tags") or []),
            scene_ids=list(meta_raw.get("scene_ids") or []),
            character_ids=list(meta_raw.get("character_ids") or []),
            story_location_id=meta_raw.get("story_location_id"),
            world_id=meta_raw.get("world_id"),
            world_location_id=meta_raw.get("world_location_id"),
        )
        default_url: Optional[str] = None
        if env.default_asset_id:
            default_url = self.storage.build_signed_environment_media_url(
                env.default_asset_id, download=False
            )
        elif env.assets:
            default_url = self.storage.build_signed_environment_media_url(
                env.assets[0].id, download=False
            )

        return EnvironmentResponse(
            id=env.id,
            owner_id=env.owner_id,
            project_id=env.project_id,
            story_id=env.story_id,
            name=env.name,
            description=env.description,
            category=env.category,
            art_style=env.art_style,
            visual_mood=env.visual_mood,
            time_of_day=env.time_of_day,
            weather=env.weather,
            color_palette=list(env.color_palette or []),
            camera_perspective=env.camera_perspective,
            default_asset_id=env.default_asset_id,
            default_image_url=default_url,
            metadata=visual_details,
            assets=[
                self._serialize_asset(a, env.default_asset_id)
                for a in (env.assets or [])
            ],
            variations=[
                self._serialize_variation(v) for v in (env.variations or [])
            ],
            generation_jobs=[
                self._serialize_job(j) for j in (env.generation_jobs or [])
            ],
            created_at=env.created_at,
            updated_at=env.updated_at,
        )

    def serialize_environment_summary(
        self, env: Environment
    ) -> EnvironmentSummaryResponse:
        meta_raw = env.environment_metadata or {}
        default_url: Optional[str] = None
        if env.default_asset_id:
            default_url = self.storage.build_signed_environment_media_url(
                env.default_asset_id, download=False
            )
        elif env.assets:
            default_url = self.storage.build_signed_environment_media_url(
                env.assets[0].id, download=False
            )

        return EnvironmentSummaryResponse(
            id=env.id,
            owner_id=env.owner_id,
            project_id=env.project_id,
            story_id=env.story_id,
            name=env.name,
            description=env.description,
            category=env.category,
            location_type=meta_raw.get("location_type") or "Forests",
            art_style=env.art_style,
            visual_mood=env.visual_mood,
            time_of_day=env.time_of_day,
            weather=env.weather,
            color_palette=list(env.color_palette or []),
            camera_perspective=env.camera_perspective,
            tags=list(meta_raw.get("tags") or []),
            default_asset_id=env.default_asset_id,
            default_image_url=default_url,
            asset_count=len(env.assets or []),
            variation_count=len(env.variations or []),
            created_at=env.created_at,
            updated_at=env.updated_at,
        )

    def serialize_world_location(
        self, loc: WorldLocation
    ) -> WorldLocationResponse:
        env_name: Optional[str] = None
        env_img: Optional[str] = None
        if loc.environment:
            env_name = loc.environment.name
            if loc.environment.default_asset_id:
                env_img = self.storage.build_signed_environment_media_url(
                    loc.environment.default_asset_id, download=False
                )
        return WorldLocationResponse(
            id=loc.id,
            world_id=loc.world_id,
            parent_id=loc.parent_id,
            environment_id=loc.environment_id,
            environment_name=env_name,
            environment_image_url=env_img,
            name=loc.name,
            location_type=loc.location_type,
            description=loc.description,
            sort_order=loc.sort_order,
            created_at=loc.created_at,
        )

    def serialize_world(self, world: World) -> WorldResponse:
        return WorldResponse(
            id=world.id,
            owner_id=world.owner_id,
            project_id=world.project_id,
            name=world.name,
            description=world.description,
            metadata=world.world_metadata or {},
            locations=[
                self.serialize_world_location(loc)
                for loc in (world.locations or [])
            ],
            created_at=world.created_at,
            updated_at=world.updated_at,
        )

    # ------------------------------------------------------------------
    # Environment CRUD
    # ------------------------------------------------------------------

    def create_environment(
        self, user: User, payload: EnvironmentCreateRequest
    ) -> EnvironmentResponse:
        project, linked_story = self._resolve_or_create_project(
            user=user,
            project_id=payload.project_id,
            story_id=payload.story_id,
        )

        meta: Dict[str, Any] = {
            "location_type": payload.location_type or "Forests",
            "architecture": payload.architecture,
            "terrain": payload.terrain,
            "vegetation": payload.vegetation,
            "props": payload.props,
            "lighting": payload.lighting,
            "atmosphere": payload.atmosphere,
            "custom_time_of_day": payload.custom_time_of_day,
            "custom_weather": payload.custom_weather,
            "custom_camera_perspective": payload.custom_camera_perspective,
            "custom_art_style": payload.custom_art_style,
            "additional_instructions": payload.additional_instructions,
            "tags": list(payload.tags or []),
            "scene_ids": list(payload.scene_ids or []),
            "character_ids": list(payload.character_ids or []),
            "story_location_id": payload.story_location_id,
            "world_id": str(payload.world_id) if payload.world_id else None,
            "world_location_id": None,
        }

        env = Environment(
            owner_id=user.id,
            project_id=project.id,
            story_id=linked_story.id if linked_story else payload.story_id,
            name=payload.name.strip(),
            description=payload.description,
            category=payload.category or "Natural",
            art_style=payload.art_style or "Anime",
            visual_mood=payload.visual_mood,
            time_of_day=payload.time_of_day or "Afternoon",
            weather=payload.weather or "Clear",
            color_palette=list(payload.color_palette or []),
            camera_perspective=payload.camera_perspective
            or "Wide establishing shot",
            environment_metadata=meta,
        )
        created = self.repo.create(env)

        if payload.seed_default_variations:
            for idx, (v_name, v_type, v_desc) in enumerate(
                DEFAULT_ENVIRONMENT_VARIATION_PRESETS
            ):
                var = EnvironmentVariation(
                    environment_id=created.id,
                    name=v_name,
                    variation_type=v_type,
                    description=v_desc,
                    is_default=(idx == 0),
                )
                self.db.add(var)
            self.db.commit()

        if payload.world_id:
            world = self._get_owned_world(user, payload.world_id)
            loc = WorldLocation(
                world_id=world.id,
                parent_id=payload.world_parent_location_id,
                environment_id=created.id,
                name=created.name,
                location_type="location",
                description=created.description,
                sort_order=len(world.locations or []),
            )
            created_loc = self.repo.create_world_location(loc)
            updated_meta = dict(created.environment_metadata or {})
            updated_meta["world_location_id"] = str(created_loc.id)
            created.environment_metadata = updated_meta
            self.repo.save(created)

        refreshed = self.repo.get_by_id_with_relations(created.id) or created
        return self.serialize_environment(refreshed)

    def list_environments(
        self,
        user: User,
        project_id: Optional[uuid.UUID] = None,
        story_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        art_style: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[EnvironmentSummaryResponse]:
        items = self.repo.list_by_owner(
            owner_id=user.id,
            project_id=project_id,
            story_id=story_id,
            category=category,
            art_style=art_style,
            search=search,
        )
        return [self.serialize_environment_summary(e) for e in items]

    def get_environment(
        self, user: User, environment_id: uuid.UUID
    ) -> EnvironmentResponse:
        env = self._get_owned_environment(user, environment_id)
        return self.serialize_environment(env)

    def update_environment(
        self,
        user: User,
        environment_id: uuid.UUID,
        payload: EnvironmentUpdateRequest,
    ) -> EnvironmentResponse:
        env = self._get_owned_environment(user, environment_id)
        data = payload.model_dump(exclude_unset=True)

        if "project_id" in data and data["project_id"]:
            proj, _ = self._resolve_or_create_project(
                user=user, project_id=data["project_id"]
            )
            env.project_id = proj.id
        if "story_id" in data:
            if data["story_id"]:
                _, story = self._resolve_or_create_project(
                    user=user, story_id=data["story_id"]
                )
                env.story_id = story.id if story else None
            else:
                env.story_id = None

        for scalar_field in (
            "name",
            "description",
            "category",
            "art_style",
            "visual_mood",
            "time_of_day",
            "weather",
            "color_palette",
            "camera_perspective",
            "default_asset_id",
        ):
            if scalar_field in data:
                setattr(env, scalar_field, data[scalar_field])

        meta = dict(env.environment_metadata or {})
        for meta_field in (
            "location_type",
            "architecture",
            "terrain",
            "vegetation",
            "props",
            "lighting",
            "atmosphere",
            "custom_time_of_day",
            "custom_weather",
            "custom_camera_perspective",
            "custom_art_style",
            "additional_instructions",
            "tags",
            "scene_ids",
            "character_ids",
            "story_location_id",
        ):
            if meta_field in data:
                meta[meta_field] = data[meta_field]

        env.environment_metadata = meta
        env.updated_at = datetime.now(timezone.utc)
        saved = self.repo.save(env)
        return self.serialize_environment(saved)

    def delete_environment(
        self, user: User, environment_id: uuid.UUID
    ) -> None:
        env = self._get_owned_environment(user, environment_id)
        for asset in env.assets or []:
            self.storage.delete_asset(asset.file_reference)
        self.repo.delete(env)

    # ------------------------------------------------------------------
    # Prompt Preview & AI Generation
    # ------------------------------------------------------------------

    def preview_prompt(
        self,
        user: User,
        environment_id: uuid.UUID,
        payload: EnvironmentPromptPreviewRequest,
    ) -> EnvironmentPromptPreviewResponse:
        env = self._get_owned_environment(user, environment_id)
        story_ctx: Optional[str] = None
        if env.story_id:
            story = self.story_repo.get_by_id(env.story_id)
            if story and story.world_description:
                story_ctx = f"{story.title}: {story.world_description}"

        prompt = EnvironmentPromptBuilder.build_prompt(
            environment=env,
            generation_type=payload.generation_type,
            art_style_override=payload.art_style_override,
            time_of_day_override=payload.time_of_day_override,
            weather_override=payload.weather_override,
            lighting_override=payload.lighting_override,
            camera_perspective_override=payload.camera_perspective_override,
            variation_name=payload.variation_name,
            variation_description=payload.variation_description,
            detail_focus=payload.detail_focus,
            story_context=story_ctx,
            user_instructions=payload.user_instructions,
        )
        ref_ids = (
            [str(env.default_asset_id)] if env.default_asset_id else []
        )
        return EnvironmentPromptPreviewResponse(
            environment_id=env.id,
            generation_type=payload.generation_type,
            art_style=payload.art_style_override or env.art_style,
            prompt=prompt,
            reference_asset_ids=ref_ids,
        )

    def _collect_reference_images(
        self,
        env: Environment,
        requested_ids: Optional[List[uuid.UUID]] = None,
    ) -> List[ReferenceImageInput]:
        refs: List[ReferenceImageInput] = []
        target_ids = list(requested_ids or [])
        if not target_ids and env.default_asset_id:
            target_ids = [env.default_asset_id]

        for aid in target_ids:
            asset = self.repo.get_asset_by_id(aid)
            if not asset or asset.environment_id != env.id:
                continue
            try:
                raw = self.storage.read_asset_bytes(asset.file_reference)
                mime = (asset.asset_metadata or {}).get("mime_type", "image/png")
                refs.append(
                    ReferenceImageInput(
                        asset_id=str(asset.id),
                        mime_type=mime,
                        image_bytes=raw,
                    )
                )
            except Exception:
                continue
        return refs

    def generate_environment_image(
        self,
        user: User,
        environment_id: uuid.UUID,
        payload: EnvironmentGenerateImageRequest,
    ) -> EnvironmentGenerationResultResponse:
        env = self._get_owned_environment(user, environment_id)
        active_style = payload.art_style_override or env.art_style or "Anime"

        story_ctx: Optional[str] = None
        if env.story_id:
            story = self.story_repo.get_by_id(env.story_id)
            if story and story.world_description:
                story_ctx = f"{story.title}: {story.world_description}"

        prompt = (
            payload.custom_prompt.strip()
            if payload.custom_prompt and payload.custom_prompt.strip()
            else EnvironmentPromptBuilder.build_prompt(
                environment=env,
                generation_type=payload.generation_type,
                art_style_override=active_style,
                time_of_day_override=payload.time_of_day_override,
                weather_override=payload.weather_override,
                lighting_override=payload.lighting_override,
                camera_perspective_override=payload.camera_perspective_override,
                detail_focus=payload.detail_focus,
                story_context=story_ctx,
                user_instructions=payload.user_instructions,
            )
        )

        job = EnvironmentGenerationJob(
            environment_id=env.id,
            owner_id=user.id,
            generation_type=payload.generation_type,
            status="running",
            prompt=prompt,
            result_metadata={"art_style": active_style},
        )
        job = self.repo.create_job(job)

        try:
            provider = get_ai_image_provider()
            job.provider = f"{provider.provider_name}/{provider.model_name}"
            refs = self._collect_reference_images(
                env, payload.reference_asset_ids
            )

            gen_type = payload.generation_type
            if gen_type == "concept":
                artifact = provider.generate_environment_concept(
                    prompt=prompt, style=active_style, reference_images=refs
                )
            elif gen_type == "landscape":
                artifact = provider.generate_landscape_background(
                    prompt=prompt, style=active_style, reference_images=refs
                )
            elif gen_type == "interior":
                artifact = provider.generate_interior_background(
                    prompt=prompt, style=active_style, reference_images=refs
                )
            elif gen_type == "exterior":
                artifact = provider.generate_exterior_background(
                    prompt=prompt, style=active_style, reference_images=refs
                )
            elif gen_type == "lighting_variation":
                artifact = provider.generate_lighting_variation(
                    prompt=prompt,
                    lighting_name=payload.lighting_override
                    or payload.time_of_day_override
                    or env.time_of_day,
                    style=active_style,
                    reference_images=refs,
                )
            elif gen_type == "weather_variation":
                artifact = provider.generate_weather_variation(
                    prompt=prompt,
                    weather_name=payload.weather_override or env.weather,
                    style=active_style,
                    reference_images=refs,
                )
            elif gen_type == "camera_view":
                artifact = provider.generate_camera_view(
                    prompt=prompt,
                    camera_perspective=payload.camera_perspective_override
                    or env.camera_perspective,
                    style=active_style,
                    reference_images=refs,
                )
            else:
                artifact = provider.generate_environment_detail(
                    prompt=prompt,
                    detail_focus=payload.detail_focus or "Environment Detail",
                    style=active_style,
                    reference_images=refs,
                )

            asset_id = uuid.uuid4()
            file_ref = self.storage.save_environment_asset_bytes(
                environment_id=env.id,
                asset_id=asset_id,
                extension=artifact.image_info.extension,
                data=artifact.image_bytes,
            )
            asset = EnvironmentAsset(
                id=asset_id,
                environment_id=env.id,
                owner_id=user.id,
                asset_type=payload.generation_type,
                file_reference=file_ref,
                prompt=prompt,
                provider=f"{artifact.provider}/{artifact.model}",
                generation_status="completed",
                asset_metadata={
                    "mime_type": artifact.image_info.mime_type,
                    "width": artifact.image_info.width,
                    "height": artifact.image_info.height,
                    "size_bytes": artifact.image_info.size_bytes,
                    "sha256": artifact.image_info.sha256,
                    "label": f"{env.name} — {payload.generation_type}",
                    "time_of_day": payload.time_of_day_override
                    or env.time_of_day,
                    "weather": payload.weather_override or env.weather,
                    "camera_perspective": payload.camera_perspective_override
                    or env.camera_perspective,
                },
            )
            asset = self.repo.create_asset(asset)

            if payload.set_as_default or not env.default_asset_id:
                env.default_asset_id = asset.id
                self.repo.save(env)

            job.status = "completed"
            job.result_metadata = {
                "asset_id": str(asset.id),
                "width": artifact.image_info.width,
                "height": artifact.image_info.height,
                "mime_type": artifact.image_info.mime_type,
            }
            job = self.repo.save_job(job)

            refreshed = self.repo.get_by_id_with_relations(env.id) or env
            return EnvironmentGenerationResultResponse(
                job=self._serialize_job(job),
                generated_assets=[
                    self._serialize_asset(asset, refreshed.default_asset_id)
                ],
                variation=None,
                environment=self.serialize_environment(refreshed),
            )
        except (ImageAIConfigurationException, ImageProviderException, AppException) as exc:
            job.status = "failed"
            job.error_message = exc.detail
            self.repo.save_job(job)
            raise

    def generate_environment_variation(
        self,
        user: User,
        environment_id: uuid.UUID,
        payload: EnvironmentGenerateVariationRequest,
    ) -> EnvironmentGenerationResultResponse:
        env = self._get_owned_environment(user, environment_id)
        active_style = env.art_style or "Anime"

        prompt = (
            payload.custom_prompt.strip()
            if payload.custom_prompt and payload.custom_prompt.strip()
            else EnvironmentPromptBuilder.build_prompt(
                environment=env,
                generation_type="variation",
                time_of_day_override=payload.time_of_day_override,
                weather_override=payload.weather_override,
                lighting_override=payload.lighting_override,
                camera_perspective_override=payload.camera_perspective_override,
                color_palette_override=payload.color_palette_override,
                variation_name=payload.name,
                variation_description=payload.description,
                user_instructions=payload.user_instructions,
            )
        )

        job = EnvironmentGenerationJob(
            environment_id=env.id,
            owner_id=user.id,
            generation_type=f"variation:{payload.variation_type}",
            status="running",
            prompt=prompt,
            result_metadata={
                "variation_name": payload.name,
                "variation_type": payload.variation_type,
            },
        )
        job = self.repo.create_job(job)

        try:
            provider = get_ai_image_provider()
            job.provider = f"{provider.provider_name}/{provider.model_name}"
            refs = self._collect_reference_images(env)
            artifact = provider.generate_environment_variation(
                prompt=prompt,
                variation_name=payload.name,
                style=active_style,
                reference_images=refs,
            )

            asset_id = uuid.uuid4()
            file_ref = self.storage.save_environment_asset_bytes(
                environment_id=env.id,
                asset_id=asset_id,
                extension=artifact.image_info.extension,
                data=artifact.image_bytes,
            )
            asset = EnvironmentAsset(
                id=asset_id,
                environment_id=env.id,
                owner_id=user.id,
                asset_type="variation",
                file_reference=file_ref,
                prompt=prompt,
                provider=f"{artifact.provider}/{artifact.model}",
                generation_status="completed",
                asset_metadata={
                    "mime_type": artifact.image_info.mime_type,
                    "width": artifact.image_info.width,
                    "height": artifact.image_info.height,
                    "size_bytes": artifact.image_info.size_bytes,
                    "sha256": artifact.image_info.sha256,
                    "label": f"{env.name} — {payload.name}",
                    "variation_type": payload.variation_type,
                },
            )
            asset = self.repo.create_asset(asset)

            target_var: Optional[EnvironmentVariation] = None
            if payload.variation_id:
                target_var = self.repo.get_variation_by_id(payload.variation_id)
                if target_var and target_var.environment_id != env.id:
                    target_var = None

            if payload.is_default:
                self.repo.clear_default_variations(env.id)

            if target_var:
                target_var.name = payload.name
                target_var.variation_type = payload.variation_type
                if payload.description is not None:
                    target_var.description = payload.description
                target_var.asset_id = asset.id
                if payload.is_default:
                    target_var.is_default = True
                target_var = self.repo.save_variation(target_var)
            else:
                target_var = EnvironmentVariation(
                    environment_id=env.id,
                    name=payload.name,
                    description=payload.description,
                    variation_type=payload.variation_type,
                    asset_id=asset.id,
                    is_default=payload.is_default,
                )
                target_var = self.repo.create_variation(target_var)

            if payload.is_default or not env.default_asset_id:
                env.default_asset_id = asset.id
                self.repo.save(env)

            job.status = "completed"
            job.result_metadata = {
                "asset_id": str(asset.id),
                "variation_id": str(target_var.id),
            }
            job = self.repo.save_job(job)

            refreshed = self.repo.get_by_id_with_relations(env.id) or env
            return EnvironmentGenerationResultResponse(
                job=self._serialize_job(job),
                generated_assets=[
                    self._serialize_asset(asset, refreshed.default_asset_id)
                ],
                variation=self._serialize_variation(target_var),
                environment=self.serialize_environment(refreshed),
            )
        except (ImageAIConfigurationException, ImageProviderException, AppException) as exc:
            job.status = "failed"
            job.error_message = exc.detail
            self.repo.save_job(job)
            raise

    # ------------------------------------------------------------------
    # Variations CRUD
    # ------------------------------------------------------------------

    def list_variations(
        self, user: User, environment_id: uuid.UUID
    ) -> List[EnvironmentVariationResponse]:
        env = self._get_owned_environment(user, environment_id)
        return [
            self._serialize_variation(v)
            for v in self.repo.list_variations(env.id)
        ]

    def create_variation(
        self,
        user: User,
        environment_id: uuid.UUID,
        payload: EnvironmentVariationCreateRequest,
    ) -> EnvironmentVariationResponse:
        env = self._get_owned_environment(user, environment_id)
        if payload.is_default:
            self.repo.clear_default_variations(env.id)
        var = EnvironmentVariation(
            environment_id=env.id,
            name=payload.name.strip(),
            description=payload.description,
            variation_type=payload.variation_type,
            asset_id=payload.asset_id,
            is_default=payload.is_default,
        )
        created = self.repo.create_variation(var)
        if payload.is_default and payload.asset_id:
            env.default_asset_id = payload.asset_id
            self.repo.save(env)
        return self._serialize_variation(created)

    def update_variation(
        self,
        user: User,
        variation_id: uuid.UUID,
        payload: EnvironmentVariationUpdateRequest,
    ) -> EnvironmentVariationResponse:
        var = self.repo.get_variation_by_id(variation_id)
        if not var:
            raise NotFoundException("Environment variation not found.")
        env = self._get_owned_environment(user, var.environment_id)
        data = payload.model_dump(exclude_unset=True)

        if data.get("is_default") is True:
            self.repo.clear_default_variations(env.id)
            var.is_default = True
            if var.asset_id or data.get("asset_id"):
                env.default_asset_id = data.get("asset_id") or var.asset_id
                self.repo.save(env)
        elif "is_default" in data and data["is_default"] is False:
            var.is_default = False

        if "name" in data and data["name"]:
            var.name = data["name"].strip()
        if "description" in data:
            var.description = data["description"]
        if "variation_type" in data and data["variation_type"]:
            var.variation_type = data["variation_type"]
        if "asset_id" in data:
            var.asset_id = data["asset_id"]

        saved = self.repo.save_variation(var)
        return self._serialize_variation(saved)

    def delete_variation(
        self, user: User, variation_id: uuid.UUID
    ) -> None:
        var = self.repo.get_variation_by_id(variation_id)
        if not var:
            raise NotFoundException("Environment variation not found.")
        self._get_owned_environment(user, var.environment_id)
        self.repo.delete_variation(var)

    # ------------------------------------------------------------------
    # Assets & Upload & Media Delivery
    # ------------------------------------------------------------------

    def upload_asset(
        self,
        user: User,
        environment_id: uuid.UUID,
        raw_bytes: bytes,
        filename: Optional[str] = None,
        asset_type: str = "uploaded_reference",
        label: Optional[str] = None,
        set_as_default: bool = False,
    ) -> EnvironmentAssetResponse:
        env = self._get_owned_environment(user, environment_id)
        img_info = validate_and_inspect_image_bytes(raw_bytes)
        asset_id = uuid.uuid4()
        file_ref = self.storage.save_environment_asset_bytes(
            environment_id=env.id,
            asset_id=asset_id,
            extension=img_info.extension,
            data=raw_bytes,
        )
        asset = EnvironmentAsset(
            id=asset_id,
            environment_id=env.id,
            owner_id=user.id,
            asset_type=asset_type or "uploaded_reference",
            file_reference=file_ref,
            provider="upload",
            generation_status="completed",
            asset_metadata={
                "filename": filename or f"environment.{img_info.extension}",
                "label": label or filename or f"{env.name} Reference",
                "mime_type": img_info.mime_type,
                "width": img_info.width,
                "height": img_info.height,
                "size_bytes": img_info.size_bytes,
                "sha256": img_info.sha256,
            },
        )
        created = self.repo.create_asset(asset)
        if set_as_default or not env.default_asset_id:
            env.default_asset_id = created.id
            self.repo.save(env)
        return self._serialize_asset(created, env.default_asset_id)

    def list_assets(
        self,
        user: User,
        environment_id: uuid.UUID,
        asset_type: Optional[str] = None,
    ) -> List[EnvironmentAssetResponse]:
        env = self._get_owned_environment(user, environment_id)
        assets = self.repo.list_assets(env.id, asset_type=asset_type)
        return [
            self._serialize_asset(a, env.default_asset_id) for a in assets
        ]

    def update_asset(
        self,
        user: User,
        asset_id: uuid.UUID,
        payload: EnvironmentAssetUpdateRequest,
    ) -> EnvironmentAssetResponse:
        asset = self.repo.get_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Environment asset not found.")
        if asset.owner_id != user.id:
            raise ForbiddenException("You do not have access to this asset.")
        env = self._get_owned_environment(user, asset.environment_id)

        if payload.asset_type:
            asset.asset_type = payload.asset_type
        if payload.label is not None:
            meta = dict(asset.asset_metadata or {})
            meta["label"] = payload.label
            asset.asset_metadata = meta

        saved = self.repo.save_asset(asset)
        if payload.set_as_default:
            env.default_asset_id = saved.id
            self.repo.save(env)
        return self._serialize_asset(saved, env.default_asset_id)

    def delete_asset(self, user: User, asset_id: uuid.UUID) -> None:
        asset = self.repo.get_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Environment asset not found.")
        if asset.owner_id != user.id:
            raise ForbiddenException("You do not have access to this asset.")
        env = self._get_owned_environment(user, asset.environment_id)
        file_ref = asset.file_reference
        was_default = env.default_asset_id == asset.id
        self.repo.delete_asset(asset)
        self.storage.delete_asset(file_ref)

        if was_default:
            remaining = self.repo.list_assets(env.id)
            env.default_asset_id = remaining[0].id if remaining else None
            self.repo.save(env)

    def read_signed_or_owned_media(
        self,
        asset_id: uuid.UUID,
        expires: Optional[int] = None,
        sig: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> Tuple[bytes, str, str]:
        asset = self.repo.get_asset_by_id(asset_id)
        if not asset:
            raise NotFoundException("Environment asset not found.")

        authorized = False
        if expires is not None and sig:
            authorized = verify_media_signature(
                asset_id=asset.id, expires=expires, sig=sig
            )
        elif current_user and asset.owner_id == current_user.id:
            authorized = True

        if not authorized:
            raise ForbiddenException(
                "Invalid or expired signature for environment media asset."
            )

        raw_bytes = self.storage.read_asset_bytes(asset.file_reference)
        meta = asset.asset_metadata or {}
        mime = meta.get("mime_type", "image/png")
        filename = meta.get("filename") or f"environment-{asset.id}.png"
        return raw_bytes, mime, filename

    # ------------------------------------------------------------------
    # Jobs
    # ------------------------------------------------------------------

    def list_jobs(
        self, user: User, environment_id: uuid.UUID
    ) -> List[EnvironmentGenerationJobResponse]:
        env = self._get_owned_environment(user, environment_id)
        jobs = self.repo.list_jobs(env.id)
        return [self._serialize_job(j) for j in jobs]

    def get_job(
        self, user: User, job_id: uuid.UUID
    ) -> EnvironmentGenerationJobResponse:
        job = self.repo.get_job_by_id(job_id)
        if not job:
            raise NotFoundException("Environment generation job not found.")
        if job.owner_id != user.id:
            raise ForbiddenException("You do not have access to this job.")
        return self._serialize_job(job)

    # ------------------------------------------------------------------
    # Worlds & WorldLocations Hierarchy
    # ------------------------------------------------------------------

    def create_world(
        self, user: User, payload: WorldCreateRequest
    ) -> WorldResponse:
        project, _ = self._resolve_or_create_project(
            user=user, project_id=payload.project_id
        )
        world = World(
            owner_id=user.id,
            project_id=project.id,
            name=payload.name.strip(),
            description=payload.description,
            world_metadata={"lore_notes": payload.lore_notes or ""},
        )
        created = self.repo.create_world(world)

        if payload.seed_sample_hierarchy:
            region = WorldLocation(
                world_id=created.id,
                parent_id=None,
                name="Northern Forest Region",
                location_type="region",
                description="Ancient woodland region bordering the capital.",
                sort_order=0,
            )
            region = self.repo.create_world_location(region)
            sub_loc = WorldLocation(
                world_id=created.id,
                parent_id=region.id,
                name="Hidden Waterfall Sanctuary",
                location_type="natural_area",
                description="Bioluminescent waterfall glade beneath the canopy.",
                sort_order=0,
            )
            self.repo.create_world_location(sub_loc)

        refreshed = self.repo.get_world_by_id(created.id) or created
        return self.serialize_world(refreshed)

    def list_worlds(
        self, user: User, project_id: Optional[uuid.UUID] = None
    ) -> List[WorldResponse]:
        worlds = self.repo.list_worlds_by_owner(
            owner_id=user.id, project_id=project_id
        )
        return [self.serialize_world(w) for w in worlds]

    def get_world(self, user: User, world_id: uuid.UUID) -> WorldResponse:
        world = self._get_owned_world(user, world_id)
        return self.serialize_world(world)

    def update_world(
        self,
        user: User,
        world_id: uuid.UUID,
        payload: WorldUpdateRequest,
    ) -> WorldResponse:
        world = self._get_owned_world(user, world_id)
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"]:
            world.name = data["name"].strip()
        if "description" in data:
            world.description = data["description"]
        if "lore_notes" in data:
            meta = dict(world.world_metadata or {})
            meta["lore_notes"] = data["lore_notes"]
            world.world_metadata = meta
        world.updated_at = datetime.now(timezone.utc)
        saved = self.repo.save_world(world)
        return self.serialize_world(saved)

    def delete_world(self, user: User, world_id: uuid.UUID) -> None:
        world = self._get_owned_world(user, world_id)
        self.repo.delete_world(world)

    def create_world_location(
        self,
        user: User,
        world_id: uuid.UUID,
        payload: WorldLocationCreateRequest,
    ) -> WorldLocationResponse:
        world = self._get_owned_world(user, world_id)
        if payload.parent_id:
            parent = self.repo.get_world_location_by_id(payload.parent_id)
            if not parent or parent.world_id != world.id:
                raise AppException(
                    detail="Parent location must belong to the same world.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error_code="INVALID_PARENT_LOCATION",
                )
        if payload.environment_id:
            self._get_owned_environment(user, payload.environment_id)

        loc = WorldLocation(
            world_id=world.id,
            parent_id=payload.parent_id,
            environment_id=payload.environment_id,
            name=payload.name.strip(),
            location_type=payload.location_type or "location",
            description=payload.description,
            sort_order=payload.sort_order,
        )
        created = self.repo.create_world_location(loc)
        loaded = self.repo.get_world_location_by_id(created.id) or created
        return self.serialize_world_location(loaded)

    def update_world_location(
        self,
        user: User,
        location_id: uuid.UUID,
        payload: WorldLocationUpdateRequest,
    ) -> WorldLocationResponse:
        loc = self.repo.get_world_location_by_id(location_id)
        if not loc:
            raise NotFoundException("World location not found.")
        world = self._get_owned_world(user, loc.world_id)
        data = payload.model_dump(exclude_unset=True)

        if data.get("clear_parent"):
            loc.parent_id = None
        elif "parent_id" in data and data["parent_id"]:
            new_parent_id = data["parent_id"]
            if new_parent_id == loc.id:
                raise AppException(
                    detail="A world location cannot be its own parent.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error_code="CIRCULAR_LOCATION_HIERARCHY",
                )
            parent = self.repo.get_world_location_by_id(new_parent_id)
            if not parent or parent.world_id != world.id:
                raise AppException(
                    detail="Parent location must belong to the same world.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error_code="INVALID_PARENT_LOCATION",
                )
            loc.parent_id = new_parent_id

        if data.get("clear_environment"):
            loc.environment_id = None
        elif "environment_id" in data and data["environment_id"]:
            self._get_owned_environment(user, data["environment_id"])
            loc.environment_id = data["environment_id"]

        if "name" in data and data["name"]:
            loc.name = data["name"].strip()
        if "location_type" in data and data["location_type"]:
            loc.location_type = data["location_type"]
        if "description" in data:
            loc.description = data["description"]
        if "sort_order" in data and data["sort_order"] is not None:
            loc.sort_order = data["sort_order"]

        saved = self.repo.save_world_location(loc)
        loaded = self.repo.get_world_location_by_id(saved.id) or saved
        return self.serialize_world_location(loaded)

    def delete_world_location(
        self, user: User, location_id: uuid.UUID
    ) -> None:
        loc = self.repo.get_world_location_by_id(location_id)
        if not loc:
            raise NotFoundException("World location not found.")
        self._get_owned_world(user, loc.world_id)
        self.repo.delete_world_location(loc)

    # ------------------------------------------------------------------
    # Story, Scene & Character Planning Integration
    # ------------------------------------------------------------------

    def sync_environment_to_story(
        self,
        user: User,
        environment_id: uuid.UUID,
        payload: EnvironmentStorySyncRequest,
    ) -> EnvironmentResponse:
        env = self._get_owned_environment(user, environment_id)
        story = self.story_repo.get_by_id(payload.story_id)
        if not story:
            raise NotFoundException("Story not found.")
        if story.owner_id != user.id:
            raise ForbiddenException("You do not have access to this story.")

        env.story_id = story.id
        meta = dict(env.environment_metadata or {})
        story_loc_id = meta.get("story_location_id") or str(env.id)

        doc_obj = self.story_repo.build_document_from_orm(story)
        doc = doc_obj.model_dump(mode="json")
        locations = list(doc.get("locations") or [])

        matched_idx: Optional[int] = None
        for idx, loc in enumerate(locations):
            if (
                str(loc.get("id")) == str(story_loc_id)
                or str(loc.get("id")) == str(env.id)
                or str(loc.get("name", "")).strip().lower()
                == env.name.strip().lower()
            ):
                matched_idx = idx
                story_loc_id = str(loc.get("id"))
                break

        env_reqs_parts = [
            f"Style: {env.art_style}",
            f"Time: {env.time_of_day}",
            f"Weather: {env.weather}",
            f"Camera: {env.camera_perspective}",
        ]
        if meta.get("lighting"):
            env_reqs_parts.append(f"Lighting: {meta['lighting']}")

        loc_entry = {
            "id": story_loc_id,
            "name": env.name,
            "location_type": meta.get("location_type") or env.category,
            "description": env.description or f"{env.category} environment",
            "time_of_day": env.time_of_day,
            "weather_or_atmosphere": f"{env.weather}"
            + (f" — {env.visual_mood}" if env.visual_mood else ""),
            "environment_requirements": "; ".join(env_reqs_parts),
        }

        if matched_idx is not None:
            locations[matched_idx] = loc_entry
        else:
            locations.append(loc_entry)
        doc["locations"] = locations

        if payload.scene_ids:
            scenes = list(doc.get("scenes") or [])
            target_scene_set = {str(sid) for sid in payload.scene_ids}
            for sc in scenes:
                if str(sc.get("id")) in target_scene_set:
                    sc["location_id"] = story_loc_id
                    sc["location_name"] = env.name
                    sc["time_of_day"] = env.time_of_day
            doc["scenes"] = scenes
            meta["scene_ids"] = list(
                dict.fromkeys(
                    list(meta.get("scene_ids") or [])
                    + [str(sid) for sid in payload.scene_ids]
                )
            )

        if payload.character_ids:
            meta["character_ids"] = list(
                dict.fromkeys([str(cid) for cid in payload.character_ids])
            )

        meta["story_location_id"] = story_loc_id
        env.environment_metadata = meta
        saved_env = self.repo.save(env)

        from app.schemas.story import StoryOutputDocument

        validated_doc = StoryOutputDocument.model_validate(doc)
        self.story_repo.sync_document_to_relational_tables(
            story=story,
            document=validated_doc,
            create_version=False,
        )

        return self.serialize_environment(saved_env)

    def import_environments_from_story(
        self, user: User, story_id: uuid.UUID
    ) -> List[EnvironmentResponse]:
        story = self.story_repo.get_by_id(story_id)
        if not story:
            raise NotFoundException("Story not found.")
        if story.owner_id != user.id:
            raise ForbiddenException("You do not have access to this story.")

        existing_envs = self.repo.list_by_owner(
            owner_id=user.id, project_id=story.project_id
        )
        doc_obj = self.story_repo.build_document_from_orm(story)
        doc = doc_obj.model_dump(mode="json")
        story_locs = list(doc.get("locations") or [])
        scenes = list(doc.get("scenes") or [])

        synced_responses: List[EnvironmentResponse] = []
        for sloc in story_locs:
            loc_id = str(sloc.get("id") or uuid.uuid4())
            loc_name = str(sloc.get("name") or "Untitled Location").strip()

            found: Optional[Environment] = None
            for e in existing_envs:
                emeta = e.environment_metadata or {}
                if (
                    emeta.get("story_location_id") == loc_id
                    or str(e.id) == loc_id
                    or e.name.strip().lower() == loc_name.lower()
                ):
                    found = e
                    break

            linked_scene_ids = [
                str(sc.get("id"))
                for sc in scenes
                if str(sc.get("location_id")) == loc_id
                or str(sc.get("location_name", "")).strip().lower()
                == loc_name.lower()
            ]

            if found:
                fmeta = dict(found.environment_metadata or {})
                fmeta["story_location_id"] = loc_id
                fmeta["scene_ids"] = list(
                    dict.fromkeys(
                        list(fmeta.get("scene_ids") or []) + linked_scene_ids
                    )
                )
                found.story_id = story.id
                found.environment_metadata = fmeta
                saved = self.repo.save(found)
                synced_responses.append(self.serialize_environment(saved))
            else:
                created_resp = self.create_environment(
                    user=user,
                    payload=EnvironmentCreateRequest(
                        project_id=story.project_id,
                        story_id=story.id,
                        name=loc_name,
                        description=sloc.get("description")
                        or f"Story location from {story.title}",
                        category="Fantasy"
                        if "fantasy" in (story.genre or "").lower()
                        else "Natural",
                        location_type=sloc.get("location_type") or "Locations",
                        art_style=story.animation_style or "Anime",
                        visual_mood=sloc.get("weather_or_atmosphere")
                        or "Cinematic",
                        time_of_day=sloc.get("time_of_day") or "Afternoon",
                        weather="Clear",
                        scene_ids=linked_scene_ids,
                        story_location_id=loc_id,
                        seed_default_variations=True,
                    ),
                )
                synced_responses.append(created_resp)

        return synced_responses
