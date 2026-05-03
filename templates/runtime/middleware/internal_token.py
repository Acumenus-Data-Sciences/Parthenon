"""Internal-token middleware.

Every request except the unauthenticated allowlist must carry a matching
``X-Parthenon-Internal-Token`` header. Constant-time comparison.
"""

from __future__ import annotations

import hmac
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from runtime.settings import get_settings

HEADER_NAME = "X-Parthenon-Internal-Token"
UNAUTHENTICATED_PATHS = frozenset({"/health"})


class InternalTokenMiddleware(BaseHTTPMiddleware):
    """Reject requests that do not present the configured internal token."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path in UNAUTHENTICATED_PATHS:
            return await call_next(request)

        settings = get_settings()
        expected = settings.internal_token
        if not expected:
            return JSONResponse(
                status_code=503,
                content={"detail": "PARTHENON_INTERNAL_TOKEN not configured"},
            )

        provided = request.headers.get(HEADER_NAME)
        if provided is None:
            return JSONResponse(
                status_code=401,
                content={"detail": f"missing {HEADER_NAME}"},
            )
        if not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
            return JSONResponse(
                status_code=401,
                content={"detail": f"invalid {HEADER_NAME}"},
            )
        return await call_next(request)
