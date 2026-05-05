"""Internal-token middleware enforces X-Parthenon-Internal-Token on every non-health route."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from runtime.api import app


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    # Settings is cached; force a reload by clearing the lru_cache.
    from runtime.settings import get_settings

    get_settings.cache_clear()
    return TestClient(app)


def test_health_does_not_require_token(client: TestClient) -> None:
    assert client.get("/health").status_code == 200


def test_protected_route_rejects_missing_header(client: TestClient) -> None:
    # /openapi.json is part of the protected surface.
    response = client.get("/openapi.json")
    assert response.status_code == 401
    assert response.json() == {"detail": "missing X-Parthenon-Internal-Token"}


def test_protected_route_rejects_invalid_token(client: TestClient) -> None:
    response = client.get(
        "/openapi.json",
        headers={"X-Parthenon-Internal-Token": "wrong-token"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "invalid X-Parthenon-Internal-Token"}


def test_protected_route_accepts_valid_token(client: TestClient) -> None:
    response = client.get(
        "/openapi.json",
        headers={"X-Parthenon-Internal-Token": "test-internal-token"},
    )
    assert response.status_code == 200


def test_missing_server_token_rejects_all(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the server is misconfigured (empty token), every protected request is rejected."""
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "")
    from runtime.settings import get_settings

    get_settings.cache_clear()
    misconf_client = TestClient(app)
    response = misconf_client.get(
        "/openapi.json",
        headers={"X-Parthenon-Internal-Token": "anything"},
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "PARTHENON_INTERNAL_TOKEN not configured"}
