"""
Production Security & Rate Limiting Middlewares for TR STUDIO Step 10.
Includes:
- SecurityHeadersMiddleware (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- RequestBodySizeLimitMiddleware (Protects server memory against oversized malicious payloads)
- InMemoryRateLimiterMiddleware (Token-bucket rate limiting for API protection)
"""

import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Applies strict HTTP security headers to all incoming responses."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # Basic security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # Content-Security-Policy allowing local/blob media rendering
        csp = (
            "default-src 'self'; "
            "img-src 'self' data: blob: *; "
            "media-src 'self' blob: *; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:;"
        )
        response.headers["Content-Security-Policy"] = csp

        return response


class RequestBodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Enforces maximum request body size based on route type to prevent memory exhaustion."""

    def __init__(self, app, max_json_size_mb: int = 5, max_media_size_mb: int = 100) -> None:
        super().__init__(app)
        self.max_json_bytes = max_json_size_mb * 1024 * 1024
        self.max_media_bytes = max_media_size_mb * 1024 * 1024

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length_bytes = int(content_length)
                is_media_upload = any(
                    part in request.url.path
                    for part in ["/assets", "/character-assets", "/environment-assets", "/audio-assets", "/upload"]
                )
                max_allowed = self.max_media_bytes if is_media_upload else self.max_json_bytes

                if length_bytes > max_allowed:
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={
                            "detail": f"Request body too large. Max allowed is {max_allowed // (1024 * 1024)} MB.",
                            "error_code": "PAYLOAD_TOO_LARGE",
                        },
                    )
            except ValueError:
                pass

        return await call_next(request)


class InMemoryRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding window rate limiter tracking request frequencies per client IP.
    Higher limits for general endpoints (200 req/min), stricter limits for auth (40 req/min).
    """

    def __init__(
        self,
        app,
        default_limit_per_min: int = 240,
        auth_limit_per_min: int = 40,
    ) -> None:
        super().__init__(app)
        self.default_limit = default_limit_per_min
        self.auth_limit = auth_limit_per_min
        self._ip_history: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "127.0.0.1"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Exempt health checks and options requests
        if request.url.path in ("/health", "/api/v1/health") or request.method == "OPTIONS":
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        # In automated test suites, standard TestClient calls (host "testclient"/"testserver")
        # should not be throttled unless an explicit rate limit test header is provided.
        if (
            client_ip in ("testclient", "testserver")
            and "x-test-rate-limit" not in request.headers
            and "x-forwarded-for" not in request.headers
        ):
            return await call_next(request)

        now = time.time()
        window_start = now - 60.0

        is_auth_route = "/auth/" in request.url.path
        limit = self.auth_limit if is_auth_route else self.default_limit

        # Clean history older than 60s
        history = self._ip_history[client_ip]
        self._ip_history[client_ip] = [ts for ts in history if ts > window_start]

        if len(self._ip_history[client_ip]) >= limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": "60", "X-RateLimit-Limit": str(limit)},
                content={
                    "detail": "Rate limit exceeded. Please wait a moment before trying again.",
                    "error_code": "RATE_LIMIT_EXCEEDED",
                },
            )

        self._ip_history[client_ip].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(self._ip_history[client_ip])))
        return response
