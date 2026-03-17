"""Agency API client — authenticated async HTTP client for Laravel API calls.

Makes Bearer-token-authenticated requests to the Laravel API on behalf of
users.  All paths are rooted under ``/api/v1/`` so callers pass short paths
such as ``/concept-sets`` rather than the full URL.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30.0


class AgencyApiClient:
    """Async HTTP client for Laravel API calls made by the agency module.

    Parameters
    ----------
    base_url:
        Root URL of the Laravel application (e.g. ``http://nginx:80``).
        Defaults to ``settings.agency_api_base_url``.
    """

    def __init__(self, base_url: Optional[str] = None) -> None:
        self._base_url = (base_url or settings.agency_api_base_url).rstrip("/")

    def _build_url(self, path: str) -> str:
        """Resolve a short path to a full ``/api/v1/`` URL."""
        path = path.lstrip("/")
        return f"{self._base_url}/api/v1/{path}"

    async def call(
        self,
        method: str,
        path: str,
        auth_token: str,
        data: Optional[dict[str, Any]] = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> dict[str, Any]:
        """Execute an authenticated API call against the Laravel backend.

        Parameters
        ----------
        method:
            HTTP verb (``GET``, ``POST``, ``PUT``, ``PATCH``, ``DELETE``).
        path:
            API path relative to ``/api/v1/`` (leading slash optional),
            e.g. ``concept-sets`` or ``/concept-sets/42``.
        auth_token:
            Sanctum Bearer token for the acting user.
        data:
            Request body serialised as JSON.  Ignored for ``GET``/``DELETE``
            unless the caller explicitly passes it (forwarded as JSON body).
        timeout:
            Request timeout in seconds.

        Returns
        -------
        dict
            ``{"success": True, "status": <int>, "data": <payload>}`` on a
            2xx response, or
            ``{"success": False, "status": <int>, "error": <message>}`` on any
            non-2xx or network error.
        """
        url = self._build_url(path)
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        method = method.upper()

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    json=data,
                )

            if response.is_success:
                try:
                    payload = response.json()
                except Exception:
                    payload = response.text
                return {"success": True, "status": response.status_code, "data": payload}

            # Non-2xx — extract error detail when available
            try:
                error_body = response.json()
                error_msg = error_body.get("message") or str(error_body)
            except Exception:
                error_msg = response.text or f"HTTP {response.status_code}"

            logger.warning(
                "Agency API call failed: %s %s -> %d: %s",
                method,
                url,
                response.status_code,
                error_msg,
            )
            return {
                "success": False,
                "status": response.status_code,
                "error": error_msg,
            }

        except httpx.TimeoutException:
            logger.error("Agency API timeout: %s %s (timeout=%.1fs)", method, url, timeout)
            return {"success": False, "status": 0, "error": f"Request timed out after {timeout}s"}

        except Exception as exc:
            logger.exception("Agency API unexpected error: %s %s", method, url)
            return {"success": False, "status": 0, "error": str(exc)}
