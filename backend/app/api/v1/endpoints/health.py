"""API v1 health and version metadata endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter

from app.core.config import get_settings
from app.database.session import check_database_connection

router = APIRouter()


@router.get("/health", summary="API v1 Health & Version Check")
def api_v1_health() -> dict:
    settings = get_settings()
    db_connected = check_database_connection()
    return {
        "status": "healthy" if db_connected else "degraded",
        "service": settings.APP_NAME,
        "api_version": "v1",
        "app_version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_connected else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
