"""E2E test for the hello_cdm template.

Two-tier coverage:

* :func:`test_hello_cdm_manifest_is_in_catalog` — passes today. Proves the
  manifest is well-formed and discoverable through the FastAPI catalog
  surface. This is what CI runs on every push (no DB required).

* :func:`test_hello_cdm_runs_and_passes_validation_pack` — currently
  ``xfail``. The runtime needs two pieces that land in later plans before
  this can pass:

  1. ``${parameters.*}`` substitution inside ``FlowNode.params``
     (the materializer passes raw params through, so SQL still contains
     literal ``${parameters.target_schema}``).
  2. ``PrefectBackend`` threading ``context.db_dsn`` from
     ``DATABASE_URL``/settings into ``NodeContext`` (today it is always
     ``None``).

  Once both land, this test should be flipped from ``xfail`` to a regular
  test. It uses a testcontainers Postgres so it never touches the project's
  Docker PG (per ~/.claude/memory/feedback_db_operations.md).
"""

from __future__ import annotations

import json
import time
from collections.abc import Generator
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

REPO = Path(__file__).resolve().parents[2]
HELLO_CDM_DIR = REPO / "manifests" / "hello_cdm"


def _normalize_psycopg_url(url: str) -> str:
    """Coerce a testcontainers-postgresql URL to use psycopg v3."""
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@pytest.fixture()
def configured_app(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    """FastAPI test client wired to the real hello_cdm manifest directory."""
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
    monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
    monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))

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


def test_hello_cdm_manifest_is_in_catalog(configured_app: TestClient) -> None:
    """The hello_cdm manifest is discoverable through the FastAPI catalog."""
    resp = configured_app.get("/templates", headers=_auth())
    assert resp.status_code == 200, resp.text
    catalog = resp.json()
    by_id = {entry["id"]: entry for entry in catalog}
    assert "hello_cdm" in by_id, f"hello_cdm missing from catalog: {sorted(by_id)}"
    entry = by_id["hello_cdm"]
    assert entry["category"] == "ingestion"
    assert "5.4" in entry["cdm_versions"]
    assert "demo" in entry["tags"]
    assert entry["singleton"] is False


def test_hello_cdm_full_manifest_endpoint(configured_app: TestClient) -> None:
    """``GET /templates/hello_cdm`` returns the full validated manifest payload."""
    resp = configured_app.get("/templates/hello_cdm", headers=_auth())
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["metadata"]["id"] == "hello_cdm"
    node_ids = [n["node_id"] for n in payload["spec"]["nodes"]]
    assert node_ids == ["bootstrap", "insert_person", "query_person"]


def test_hello_cdm_validation_pack_files_present_and_parse() -> None:
    """The validation pack ships the four files Plan 4 §6.4 requires and they parse."""
    inputs = HELLO_CDM_DIR / "validation" / "inputs" / "parameters.json"
    expected = HELLO_CDM_DIR / "validation" / "expected" / "post_conditions.yaml"
    dqd = HELLO_CDM_DIR / "validation" / "dqd_checks.yaml"
    readme = HELLO_CDM_DIR / "validation" / "README.md"

    for path in (inputs, expected, dqd, readme):
        assert path.is_file(), f"missing validation pack file: {path}"

    params = json.loads(inputs.read_text(encoding="utf-8"))
    assert params["target_schema"] == "hello_cdm_demo_validation"
    assert params["cdm_version"] == "5.4"

    pc = yaml.safe_load(expected.read_text(encoding="utf-8"))
    kinds = {cond["kind"] for cond in pc["post_conditions"]}
    assert {"row_count", "column_value", "artifact_present"} <= kinds


def test_hello_cdm_runs_and_passes_validation_pack(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Submit hello_cdm to a clean Postgres and assert the validation pack."""
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg_url(pg.get_connection_url())

        # Pre-clean so re-runs (xfail flips) are deterministic.
        engine = create_engine(db_url, future=True)
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS hello_cdm_demo_validation CASCADE"))

        monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
        monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
        monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
        monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
        monkeypatch.setenv("DATABASE_URL", db_url)

        from runtime.api import app
        from runtime.dependencies import get_backend, get_registry, get_storage
        from runtime.settings import get_settings

        get_settings.cache_clear()
        get_registry.cache_clear()
        get_storage.cache_clear()
        get_backend.cache_clear()

        try:
            client = TestClient(app)
            params = json.loads(
                (HELLO_CDM_DIR / "validation" / "inputs" / "parameters.json").read_text(
                    encoding="utf-8"
                )
            )

            submit = client.post(
                "/runs",
                json={
                    "template_id": "hello_cdm",
                    "version": "0.1.0",
                    "parameters": params,
                    "correlation_id": "hello-cdm-e2e",
                },
                headers=_auth(),
            )
            assert submit.status_code == 201, submit.text
            run_id = submit.json()["run_id"]

            deadline = time.time() + 60
            final_status = "running"
            while time.time() < deadline:
                resp = client.get(f"/runs/{run_id}", headers=_auth())
                final_status = resp.json()["status"]
                if final_status in {"completed", "failed", "cancelled"}:
                    break
                time.sleep(0.5)
            assert final_status == "completed", f"hello_cdm did not complete: {final_status}"

            # Assert the validation pack post-conditions.
            expected = yaml.safe_load(
                (HELLO_CDM_DIR / "validation" / "expected" / "post_conditions.yaml").read_text(
                    encoding="utf-8"
                )
            )
            with engine.connect() as conn:
                for cond in expected["post_conditions"]:
                    if cond["kind"] == "row_count":
                        count = conn.execute(text(f"SELECT COUNT(*) FROM {cond['table']}")).scalar()
                        assert count == cond["expected"], f"row_count failed: {cond}"
                    elif cond["kind"] == "column_value":
                        value = conn.execute(
                            text(
                                f"SELECT {cond['column']} FROM {cond['table']} "
                                f"WHERE {cond['where']}"
                            )
                        ).scalar()
                        assert value == cond["expected"], f"column_value failed: {cond}"
                    elif cond["kind"] == "artifact_present":
                        artifacts_resp = client.get(f"/runs/{run_id}/artifacts", headers=_auth())
                        names = {a["name"] for a in artifacts_resp.json()["artifacts"]}
                        assert cond["artifact_name"] in names, f"artifact missing: {cond}"
        finally:
            get_settings.cache_clear()
            get_registry.cache_clear()
            get_storage.cache_clear()
            get_backend.cache_clear()
