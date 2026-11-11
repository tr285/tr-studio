"""Aggregated API v1 router."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    animation,
    audio,
    auth,
    characters,
    environments,
    health,
    projects,
    render,
    scene_builder,
    stories,
)

api_v1_router = APIRouter()

api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_v1_router.include_router(stories.stories_router, prefix="/stories", tags=["Stories"])
api_v1_router.include_router(stories.scenes_router, prefix="/scenes", tags=["Scenes"])
api_v1_router.include_router(
    characters.characters_router,
    prefix="/characters",
    tags=["Characters"],
)
api_v1_router.include_router(
    characters.character_jobs_router,
    prefix="/character-generation-jobs",
    tags=["Character Generation Jobs"],
)
api_v1_router.include_router(
    characters.character_expressions_router,
    prefix="/character-expressions",
    tags=["Character Expressions"],
)
api_v1_router.include_router(
    characters.character_poses_router,
    prefix="/character-poses",
    tags=["Character Poses"],
)
api_v1_router.include_router(
    characters.character_outfits_router,
    prefix="/character-outfits",
    tags=["Character Outfits"],
)
api_v1_router.include_router(
    characters.character_assets_router,
    prefix="/character-assets",
    tags=["Character Assets"],
)
api_v1_router.include_router(environments.router)
api_v1_router.include_router(environments.variations_router)
api_v1_router.include_router(environments.assets_router)
api_v1_router.include_router(environments.jobs_router)
api_v1_router.include_router(environments.worlds_router)
api_v1_router.include_router(environments.world_locations_router)
api_v1_router.include_router(scene_builder.project_scenes_router)
api_v1_router.include_router(scene_builder.scene_builder_router)
api_v1_router.include_router(scene_builder.scene_shots_router)
api_v1_router.include_router(scene_builder.scene_character_assignments_router)
api_v1_router.include_router(scene_builder.scene_asset_assignments_router)
api_v1_router.include_router(scene_builder.scene_jobs_router)
api_v1_router.include_router(animation.animation_router)
api_v1_router.include_router(audio.router)
api_v1_router.include_router(audio.assets_router)
api_v1_router.include_router(render.router, tags=["Render Pipeline"])
api_v1_router.include_router(render.exports_router, prefix="/exports", tags=["Exports & Media"])
