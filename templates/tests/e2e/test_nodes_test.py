"""E2E test for the ``nodes_test`` template.

Three tiers of coverage:

* :func:`test_nodes_test_manifest_is_in_catalog` — passes today. Proves the
  manifest is well-formed and discoverable through the FastAPI catalog
  surface. No DB required.

* :func:`test_nodes_test_validation_pack_files_present_and_parse` — proves
  the validation pack ships the four files Plan 4 §6.4 requires and that
  they parse.

* :func:`test_nodes_test_runs_all_8_node_types` — full-flow smoke. Spins
  up a testcontainers Postgres, substitutes the ``fixtures_dir`` parameter
  with the real absolute path of the validation pack fixtures, submits
  the template through ``POST /runs``, and asserts every artifact and
  row-count / column-value post-condition. The Plan 1 runtime gap
  (``${parameters.*}`` interpolation + ``db_dsn`` threading) is closed,
  so this test runs as a regular pass — no ``xfail``.
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
NODES_TEST_DIR = REPO / "manifests" / "nodes_test"


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
    """FastAPI test client wired to the real nodes_test manifest directory."""
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


def test_nodes_test_manifest_is_in_catalog(configured_app: TestClient) -> None:
    """The nodes_test manifest is discoverable through the FastAPI catalog."""
    resp = configured_app.get("/templates", headers=_auth())
    assert resp.status_code == 200, resp.text
    catalog = resp.json()
    by_id = {entry["id"]: entry for entry in catalog}
    assert "nodes_test" in by_id, f"nodes_test missing from catalog: {sorted(by_id)}"
    entry = by_id["nodes_test"]
    assert entry["category"] == "diagnostic"
    assert "smoke-test" in entry["tags"]
    assert entry["singleton"] is False


def test_nodes_test_full_manifest_endpoint(configured_app: TestClient) -> None:
    """``GET /templates/nodes_test`` returns the full validated manifest payload."""
    resp = configured_app.get("/templates/nodes_test", headers=_auth())
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["metadata"]["id"] == "nodes_test"
    node_ids = [n["node_id"] for n in payload["spec"]["nodes"]]
    # All 8 node types must be present, in topological order.
    assert node_ids == [
        "csv_in",
        "file_copy",
        "bootstrap_schema",
        "db_load",
        "db_extract",
        "py_double",
        "py_summary",
        "r_summary",
    ]
    type_names = {n["type"] for n in payload["spec"]["nodes"]}
    assert type_names == {
        "csv_reader",
        "generic_file",
        "sql",
        "db_writer",
        "db_reader",
        "py2table",
        "python",
        "r",
    }


def test_nodes_test_validation_pack_files_present_and_parse() -> None:
    """The validation pack ships the four files Plan 4 §6.4 requires and they parse."""
    inputs = NODES_TEST_DIR / "validation" / "inputs" / "parameters.json"
    expected = NODES_TEST_DIR / "validation" / "expected" / "post_conditions.yaml"
    dqd = NODES_TEST_DIR / "validation" / "dqd_checks.yaml"
    readme = NODES_TEST_DIR / "validation" / "README.md"

    for path in (inputs, expected, dqd, readme):
        assert path.is_file(), f"missing validation pack file: {path}"

    params = json.loads(inputs.read_text(encoding="utf-8"))
    assert params["target_schema"] == "nodes_test_validation"
    assert "fixtures_dir" in params

    pc = yaml.safe_load(expected.read_text(encoding="utf-8"))
    kinds = {cond["kind"] for cond in pc["post_conditions"]}
    assert {"artifact_present", "row_count", "column_value"} <= kinds


def test_nodes_test_runs_all_8_node_types(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Submit nodes_test to a clean Postgres and assert every post-condition.

    Exercises every node type end-to-end against a real testcontainers
    Postgres. Confirms the materializer, every Phase 0 node, and the
    storage adapter all play together.
    """
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    fixtures_dir = (NODES_TEST_DIR / "fixtures").resolve()
    # The validation pack carries a placeholder; the test substitutes the
    # absolute path so the pack itself stays portable.
    raw_params = json.loads(
        (NODES_TEST_DIR / "validation" / "inputs" / "parameters.json").read_text(encoding="utf-8")
    )
    params = {**raw_params, "fixtures_dir": str(fixtures_dir)}
    target_schema = params["target_schema"]

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg_url(pg.get_connection_url())

        # Pre-clean so re-runs are deterministic.
        engine = create_engine(db_url, future=True)
        with engine.begin() as conn:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {target_schema} CASCADE"))

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

            submit = client.post(
                "/runs",
                json={
                    "template_id": "nodes_test",
                    "version": "0.1.0",
                    "parameters": params,
                    "correlation_id": "nodes-test-e2e",
                },
                headers=_auth(),
            )
            assert submit.status_code == 201, submit.text
            run_id = submit.json()["run_id"]

            deadline = time.time() + 120
            final_status = "running"
            while time.time() < deadline:
                resp = client.get(f"/runs/{run_id}", headers=_auth())
                final_status = resp.json()["status"]
                if final_status in {"completed", "failed", "cancelled"}:
                    break
                time.sleep(0.5)
            assert final_status == "completed", (
                f"nodes_test did not complete: {final_status}; "
                f"logs: {client.get(f'/runs/{run_id}/logs', headers=_auth()).json()}"
            )

            expected = yaml.safe_load(
                (NODES_TEST_DIR / "validation" / "expected" / "post_conditions.yaml").read_text(
                    encoding="utf-8"
                )
            )
            artifacts_resp = client.get(f"/runs/{run_id}/artifacts", headers=_auth())
            assert artifacts_resp.status_code == 200, artifacts_resp.text
            artifact_names = {a["name"] for a in artifacts_resp.json()["artifacts"]}

            with engine.connect() as conn:
                for cond in expected["post_conditions"]:
                    if cond["kind"] == "artifact_present":
                        assert cond["artifact_name"] in artifact_names, (
                            f"artifact missing: {cond['artifact_name']}; "
                            f"have {sorted(artifact_names)}"
                        )
                    elif cond["kind"] == "row_count":
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
        finally:
            get_settings.cache_clear()
            get_registry.cache_clear()
            get_storage.cache_clear()
            get_backend.cache_clear()
