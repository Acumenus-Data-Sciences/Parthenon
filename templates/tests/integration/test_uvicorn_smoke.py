"""Spin up uvicorn in-process and verify the /health endpoint via httpx.

This complements the FastAPI TestClient-based unit tests by exercising the
full ASGI lifecycle (lifespan, middleware ordering, JSON serialization).
"""

from __future__ import annotations

import asyncio
import socket
import threading
from collections.abc import Generator

import httpx
import pytest
import uvicorn

from runtime.api import app


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture()
def server() -> Generator[str, None, None]:
    port = _free_port()
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        lifespan="on",
    )
    server_obj = uvicorn.Server(config)

    def _run() -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(server_obj.serve())
        finally:
            loop.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    # Block until the server reports startup complete.
    while not server_obj.started:
        if not thread.is_alive():
            raise RuntimeError("uvicorn thread died before startup")

    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server_obj.should_exit = True
        thread.join(timeout=5)


def test_health_via_real_uvicorn(server: str) -> None:
    response = httpx.get(f"{server}/health", timeout=5.0)
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "parthenon-templates"}


def test_internal_token_enforced_via_real_uvicorn(
    server: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    from runtime.settings import get_settings

    get_settings.cache_clear()
    response = httpx.get(f"{server}/openapi.json", timeout=5.0)
    assert response.status_code == 401
    headers = {"X-Parthenon-Internal-Token": "test-internal-token"}
    response_ok = httpx.get(f"{server}/openapi.json", headers=headers, timeout=5.0)
    assert response_ok.status_code == 200
