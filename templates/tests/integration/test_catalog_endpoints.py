"""End-to-end tests for the catalog + run endpoints."""

from __future__ import annotations

import time
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"


@pytest.fixture()
def configured_app(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")

    manifests_root = tmp_path / "manifests"
    (manifests_root / "minimal_template").mkdir(parents=True)
    (manifests_root / "minimal_template" / "manifest.yaml").write_bytes(VALID.read_bytes())
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(manifests_root))

    # Clear caches AFTER env is set so dependencies see the new values.
    from runtime.api import app
    from runtime.dependencies import get_backend, get_registry, get_storage
    from runtime.settings import get_settings

    get_settings.cache_clear()
    get_registry.cache_clear()
    get_storage.cache_clear()
    get_backend.cache_clear()

    yield TestClient(app)

    get_settings.cache_clear()
    get_registry.cache_clear()
    get_storage.cache_clear()
    get_backend.cache_clear()


def _auth(headers: dict[str, str] | None = None) -> dict[str, str]:
    base = {"X-Parthenon-Internal-Token": "test-internal-token"}
    if headers:
        base.update(headers)
    return base


def test_list_templates_returns_catalog(configured_app: TestClient) -> None:
    response = configured_app.get("/templates", headers=_auth())
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload[0]["id"] == "minimal_template"
    assert payload[0]["version"] == "0.1.0"


def test_list_templates_requires_internal_token(configured_app: TestClient) -> None:
    response = configured_app.get("/templates")
    assert response.status_code == 401


def test_get_template_returns_full_manifest(configured_app: TestClient) -> None:
    response = configured_app.get("/templates/minimal_template", headers=_auth())
    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["id"] == "minimal_template"
    assert payload["spec"]["nodes"][0]["node_id"] == "only"


def test_get_unknown_template_404(configured_app: TestClient) -> None:
    response = configured_app.get("/templates/nope", headers=_auth())
    assert response.status_code == 404


def test_submit_run_returns_run_id(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "0.1.0",
        "parameters": {},
        "correlation_id": "lar-1",
    }
    response = configured_app.post("/runs", json=body, headers=_auth())
    assert response.status_code == 201
    data = response.json()
    assert "run_id" in data
    assert data["status"] in {"queued", "running", "completed"}


def test_run_lifecycle_status_logs_artifacts(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "0.1.0",
        "parameters": {},
        "correlation_id": "lar-2",
    }
    response = configured_app.post("/runs", json=body, headers=_auth())
    assert response.status_code == 201
    run_id = response.json()["run_id"]

    deadline = time.time() + 30
    status_resp = configured_app.get(f"/runs/{run_id}", headers=_auth())
    while time.time() < deadline:
        status_resp = configured_app.get(f"/runs/{run_id}", headers=_auth())
        assert status_resp.status_code == 200
        status = status_resp.json()["status"]
        if status in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.2)
    assert status_resp.json()["status"] == "completed"

    logs_resp = configured_app.get(f"/runs/{run_id}/logs", headers=_auth())
    assert logs_resp.status_code == 200
    assert isinstance(logs_resp.json()["lines"], list)

    artifacts_resp = configured_app.get(f"/runs/{run_id}/artifacts", headers=_auth())
    assert artifacts_resp.status_code == 200
    assert isinstance(artifacts_resp.json()["artifacts"], list)


def test_delete_run_cancels(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "0.1.0",
        "parameters": {},
        "correlation_id": "lar-3",
    }
    submit = configured_app.post("/runs", json=body, headers=_auth())
    run_id = submit.json()["run_id"]
    cancel = configured_app.delete(f"/runs/{run_id}", headers=_auth())
    assert cancel.status_code == 204


def test_submit_run_unknown_template_404(configured_app: TestClient) -> None:
    body = {
        "template_id": "does_not_exist",
        "version": "0.1.0",
        "parameters": {},
    }
    response = configured_app.post("/runs", json=body, headers=_auth())
    assert response.status_code == 404


def test_submit_run_version_mismatch_409(configured_app: TestClient) -> None:
    body = {
        "template_id": "minimal_template",
        "version": "9.9.9",
        "parameters": {},
    }
    response = configured_app.post("/runs", json=body, headers=_auth())
    assert response.status_code == 409
