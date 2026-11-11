"""
TR STUDIO — FastAPI Application Entrypoint
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import shutil
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware import (
    InMemoryRateLimiterMiddleware,
    RequestBodySizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.database.session import check_database_connection
from app.services.render.ffmpeg_encoder import find_binary

settings = get_settings()
logger = setup_logging(debug=settings.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "Starting %s v%s in %s mode",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )
    if check_database_connection():
        logger.info("PostgreSQL database connection verified.")
    else:
        logger.warning("PostgreSQL database is currently unreachable on startup.")
    yield
    logger.info("Shutting down %s backend.", settings.APP_NAME)


def create_application() -> FastAPI:
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        description="Backend API for TR STUDIO — AI-Powered Animated Story Creation Platform.",
        version=settings.APP_VERSION,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Configure CORS via environment variables
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Step 10: Production Security Middlewares
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestBodySizeLimitMiddleware, max_json_size_mb=5, max_media_size_mb=100)
    app.add_middleware(InMemoryRateLimiterMiddleware, default_limit_per_min=240, auth_limit_per_min=50)

    # Register global structured error handlers
    register_exception_handlers(app)

    # Root health check endpoint with multi-subsystem observability
    @app.get("/health", tags=["Health"], summary="Root Comprehensive Service Health Check")
    def root_health() -> dict:
        db_ok = check_database_connection()
        ffmpeg_path = find_binary("ffmpeg")
        ffmpeg_ok = Path(ffmpeg_path).exists() if ffmpeg_path else False

        # Redis check
        redis_ok = False
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=1.0)
            redis_ok = bool(r.ping())
        except Exception:
            redis_ok = False

        # Storage directory check
        storage_dir = Path(settings.STORAGE_LOCAL_DIR)
        storage_ok = storage_dir.exists() and storage_dir.is_dir()

        all_healthy = db_ok and storage_ok
        return {
            "status": "healthy" if all_healthy else "degraded",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "database": "connected" if db_ok else "disconnected",
            "subsystems": {
                "database": "connected" if db_ok else "disconnected",
                "redis": "connected" if redis_ok else "unreachable",
                "storage": "writable" if storage_ok else "error",
                "ffmpeg": "available" if ffmpeg_ok else "missing",
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # Include API v1 router (/api/v1/...)
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()
