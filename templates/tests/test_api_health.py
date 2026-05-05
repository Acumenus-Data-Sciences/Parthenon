"""Health endpoint integration test using FastAPI's TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from runtime.api import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_returns_200(client: TestClient) -> None:
    # /health is intentionally unauthenticated (matches HIGHSEC §2.3 public-route allowlist).
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "parthenon-templates"}


def test_app_metadata() -> None:
    assert app.title == "parthenon-templates"
    assert app.version == "0.1.0"
