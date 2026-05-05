"""End-to-end smoke: HTTP submit a 3-node fixture manifest and assert artifacts.

Drives the full FastAPI surface (POST /runs, GET /runs/{id}, GET
/runs/{id}/artifacts) through ``TestClient`` against the in-process Prefect
backend. Verifies that the registry → materializer → backend → storage
pipeline produces the expected artifacts on disk.
"""

from __future__ import annotations

import time
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
THREE_NODE = REPO / "tests" / "fixtures" / "manifests_valid" / "three_node_smoke.yaml"


@pytest.fixture()
def configured_app(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")

    manifests_root = tmp_path / "manifests"
    (manifests_root / "three_node_smoke").mkdir(parents=True)
    (manifests_root / "three_node_smoke" / "manifest.yaml").write_bytes(THREE_NODE.read_bytes())
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(manifests_root))

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


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def test_three_node_smoke_runs_to_completion_with_artifact(
    configured_app: TestClient,
) -> None:
    submit = configured_app.post(
        "/runs",
        json={
            "template_id": "three_node_smoke",
            "version": "0.1.0",
            "parameters": {"count": 5},
            "correlation_id": "smoke-1",
        },
        headers=_auth(),
    )
    assert submit.status_code == 201, submit.text
    run_id = submit.json()["run_id"]

    deadline = time.time() + 60
    final_status = "running"
    while time.time() < deadline:
        status_resp = configured_app.get(f"/runs/{run_id}", headers=_auth())
        final_status = status_resp.json()["status"]
        if final_status in {"completed", "failed", "cancelled"}:
            break
        time.sleep(0.25)
    assert final_status == "completed"

    artifacts_resp = configured_app.get(f"/runs/{run_id}/artifacts", headers=_auth())
    assert artifacts_resp.status_code == 200
    names = {a["name"] for a in artifacts_resp.json()["artifacts"]}
    assert "rows.parquet" in names
    assert "fetched.txt" in names
