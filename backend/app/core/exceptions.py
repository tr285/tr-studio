"""
Custom application exceptions and global FastAPI exception handlers.
"""

from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import logger


class AppException(Exception):
    def __init__(
        self,
        detail: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error_code: str = "BAD_REQUEST",
    ) -> None:
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(detail)


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
        )


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="UNAUTHORIZED",
        )


class ForbiddenException(AppException):
    def __init__(self, detail: str = "You do not have permission to access this resource") -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="FORBIDDEN",
        )


class ConflictException(AppException):
    def __init__(self, detail: str = "Resource already exists") -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
        )


class AIConfigurationException(AppException):
    def __init__(
        self,
        detail: str = (
            "AI story generation is not configured. Set AI_API_KEY, AI_PROVIDER, and AI_MODEL "
            "in your backend .env file to enable AI generation, or create and edit your story manually."
        ),
    ) -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="AI_NOT_CONFIGURED",
        )


class AIProviderException(AppException):
    def __init__(
        self,
        detail: str = "The configured AI provider returned an error or invalid response.",
        status_code: int = status.HTTP_502_BAD_GATEWAY,
        error_code: str = "AI_PROVIDER_ERROR",
    ) -> None:
        super().__init__(
            detail=detail,
            status_code=status_code,
            error_code=error_code,
        )


class ImageAIConfigurationException(AppException):
    def __init__(
        self,
        detail: str = (
            "AI character image generation is not configured. Set IMAGE_PROVIDER, IMAGE_API_KEY, "
            "and IMAGE_MODEL in your backend .env file to enable AI image generation, or create "
            "characters manually and upload reference images."
        ),
    ) -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="IMAGE_AI_NOT_CONFIGURED",
        )


class ImageProviderException(AppException):
    def __init__(
        self,
        detail: str = "The configured AI image provider returned an error or invalid image response.",
        status_code: int = status.HTTP_502_BAD_GATEWAY,
        error_code: str = "IMAGE_PROVIDER_ERROR",
    ) -> None:
        super().__init__(
            detail=detail,
            status_code=status_code,
            error_code=error_code,
        )


class VoiceAIConfigurationException(AppException):
    def __init__(
        self,
        detail: str = (
            "AI voice and speech generation is not configured. Set VOICE_PROVIDER, VOICE_API_KEY, "
            "and VOICE_MODEL in your backend .env file to enable AI voice generation, or import audio files manually."
        ),
    ) -> None:
        super().__init__(
            detail=detail,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="VOICE_AI_NOT_CONFIGURED",
        )


class VoiceProviderException(AppException):
    def __init__(
        self,
        detail: str = "The configured AI voice provider returned an error or invalid audio response.",
        status_code: int = status.HTTP_502_BAD_GATEWAY,
        error_code: str = "VOICE_PROVIDER_ERROR",
    ) -> None:
        super().__init__(
            detail=detail,
            status_code=status_code,
            error_code=error_code,
        )



def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(
            status_code=exc.status_code,
            headers=headers,
            content={
                "detail": exc.detail,
                "error_code": exc.error_code,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        first_msg = "Validation error"
        if errors:
            loc = " -> ".join(str(x) for x in errors[0].get("loc", []) if x != "body")
            msg = errors[0].get("msg", "Invalid input")
            first_msg = f"{loc}: {msg}" if loc else msg

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": first_msg,
                "error_code": "VALIDATION_ERROR",
                "errors": [
                    {
                        "field": ".".join(str(x) for x in err.get("loc", [])),
                        "message": err.get("msg", ""),
                    }
                    for err in errors
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        logger.error("Database error on %s %s: %s", request.method, request.url.path, str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "A database error occurred while processing your request.",
                "error_code": "DATABASE_ERROR",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected internal server error occurred.",
                "error_code": "INTERNAL_SERVER_ERROR",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
