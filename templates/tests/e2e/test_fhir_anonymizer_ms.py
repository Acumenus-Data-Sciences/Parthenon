"""E2E: fhir_anonymizer with MS sidecar backend.

Skipped when the parthenon-anonymizer sidecar isn't reachable (typical dev
environment). CI brings the sidecar up before running this test (consistent
with Plan 1 Task 15's equivalence test pattern).
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "fhir_anonymizer"
SIDECAR_URL = "http://parthenon-anonymizer:8080"


def _sidecar_reachable() -> bool:
    try:
        with httpx.Client(timeout=2.0) as client:
            return client.get(f"{SIDECAR_URL}/health").status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not _sidecar_reachable(),
    reason="parthenon-anonymizer sidecar not reachable (skip in dev; required in CI)",
)


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _wait_for(client: TestClient, run_id: str, timeout: int = 90) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.3)
    return "timeout"


@pytest.mark.integration
def test_fhir_anonymizer_ms_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    for f in (MANIFEST_DIR / "fixtures" / "sample_with_phi").glob("*.ndjson"):
        shutil.copy(f, fixture_dir / f.name)

    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://placeholder@127.0.0.1:5432/none")

    from runtime.api import app
    from runtime.dependencies import (
        get_backend,
        get_registry,
        get_settings,
        get_storage,
    )

    for c in (get_settings, get_registry, get_storage, get_backend):
        c.cache_clear()

    client = TestClient(app)
    params = json.loads(
        (MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
    )
    params["input_path"] = str(fixture_dir)
    params["backend"] = "ms"

    r = client.post(
        "/runs",
        json={
            "template_id": "fhir_anonymizer",
            "version": "0.1.0",
            "parameters": params,
            "correlation_id": "fhir-anon-ms-e2e",
        },
        headers=_auth(),
    )
    assert r.status_code == 201, r.text
    assert _wait_for(client, r.json()["run_id"]) == "completed"
