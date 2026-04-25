"""HTTP health probe of the installed Parthenon app URL.

Pure function — no loops, no sleeps, no side effects beyond a single HTTP
request. The Rust GUI is responsible for the polling cadence (every 2 s,
default timeout 120 s = 60 attempts).
"""
from __future__ import annotations

from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


def probe(app_url: str, attempt: int) -> dict[str, Any]:
    """Probe `<app_url>/api/v1/health` and return the result.

    Returns:
        {"ready": bool, "attempt": int, "last_status": int}
        last_status is 0 when the connection failed entirely.
    """
    url = app_url.rstrip("/") + "/api/v1/health"
    try:
        status, _body = _http_get(url)
    except URLError:
        return {"ready": False, "attempt": attempt, "last_status": 0}

    return {
        "ready": status == 200,
        "attempt": attempt,
        "last_status": status,
    }


def _http_get(url: str, timeout: float = 5.0) -> tuple[int, str]:
    """Single HTTP GET with a fixed timeout. Extracted as a seam for test patching.

    Unlike a bare ``urlopen`` call, this function never raises ``HTTPError``
    for 4xx/5xx responses — it returns ``(status_code, body)`` so callers
    always get the real HTTP status rather than a generic connection-failure 0.
    """
    from urllib.error import HTTPError  # noqa: PLC0415 - local import avoids circular at module level

    req = Request(url, headers={"User-Agent": "parthenon-installer/health"})
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - localhost only
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
        return exc.code, body
