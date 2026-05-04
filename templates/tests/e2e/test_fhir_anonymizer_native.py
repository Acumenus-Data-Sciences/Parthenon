"""E2E: fhir_anonymizer with native backend (no sidecar).

Always runs in CI. Asserts the manifest end-to-end pipeline executes
successfully, produces the expected per-resource-type file count, and
no source PHI string survives in the anonymized output.
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "fhir_anonymizer"


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _wait_for(client: TestClient, run_id: str, timeout: int = 60) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.3)
    return "timeout"


@pytest.mark.integration
def test_fhir_anonymizer_native_runs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    src_fixtures = MANIFEST_DIR / "fixtures" / "sample_with_phi"
    for f in src_fixtures.glob("*.ndjson"):
        shutil.copy(f, fixture_dir / f.name)

    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
    # No DB needed — fhir_anonymizer is a file-to-file transform.
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
    params["backend"] = "native"

    r = client.post(
        "/runs",
        json={
            "template_id": "fhir_anonymizer",
            "version": "0.1.0",
            "parameters": params,
            "correlation_id": "fhir-anon-native-e2e",
        },
        headers=_auth(),
    )
    assert r.status_code == 201, r.text
    assert _wait_for(client, r.json()["run_id"]) == "completed"

    storage_root = Path(tmp_path / "storage")
    run_dirs = list(storage_root.glob("*/anonymize"))
    assert run_dirs, f"no anonymize node dir in storage: {list(storage_root.glob('*'))}"
    anonymized = run_dirs[0] / "anonymized"
    assert anonymized.exists()
    files = sorted(anonymized.glob("*.json"))
    assert len(files) == 5, f"expected 5 anonymized files, got {len(files)}"

    # PHI redaction check: no source PHI strings in any anonymized file.
    forbidden = [
        "Jane Doe",
        "John Smith",
        "555-0100",
        "555-0101",
        "MRN-12345-67890",
        "MRN-77777-88888",
        "jane.doe@example.com",
        "123 Main St",
        "456 Oak Ave",
    ]
    blob = "\n".join(f.read_text("utf-8") for f in files)
    for s in forbidden:
        assert s not in blob, f"PHI string {s!r} leaked into anonymized output"
