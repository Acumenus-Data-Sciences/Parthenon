"""E2E: qr_eq5d5l_to_measurement against a Postgres testcontainer + fixture FHIR corpus.

Stages 2 fixture QRs into a directory the templates container can read,
bootstraps vocab + omop schemas, fixtures omop.measurement (Phase 0 DDL
ships only the minimal table set), submits the template via FastAPI
TestClient, polls to completion, and asserts:
  - 10 item rows (2 QRs x 5 items)
  - 2 VAS rows
  - 2 utility-index rows (one per (subject, date) tuple)
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "qr_eq5d5l_to_measurement"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
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
        time.sleep(0.5)
    return "timeout"


@pytest.mark.integration
def test_eq5d5l_runs_and_derives_utility(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    fixture_dir = tmp_path / "qr_fixtures"
    fixture_dir.mkdir()
    src_fixture = MANIFEST_DIR / "fixtures" / "sample" / "QuestionnaireResponse.ndjson"
    shutil.copy(src_fixture, fixture_dir / "QuestionnaireResponse.ndjson")

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="omop", engine=engine)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        # Phase 0 DDL doesn't ship omop.measurement; fixture it for the test.
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS omop.measurement (
                        measurement_id SERIAL PRIMARY KEY,
                        person_id INTEGER,
                        measurement_concept_id INTEGER NOT NULL,
                        measurement_date DATE,
                        measurement_type_concept_id INTEGER,
                        value_as_number NUMERIC,
                        value_as_concept_id INTEGER,
                        unit_concept_id INTEGER,
                        measurement_source_value VARCHAR(50)
                    )
                    """
                )
            )

        monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
        monkeypatch.setenv("PARTHENON_STORAGE_ROOT", str(tmp_path / "storage"))
        monkeypatch.setenv("PARTHENON_ORCHESTRATION_BACKEND", "prefect")
        monkeypatch.setenv("PARTHENON_MANIFESTS_ROOT", str(REPO / "manifests"))
        monkeypatch.setenv("DATABASE_URL", db_url)

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
        params["ndjson_dir"] = str(fixture_dir)
        params["eq5d_value_set_path"] = str(
            REPO / "runtime" / "instruments" / "value_sets" / "eq5d5l_placeholder.csv"
        )

        r = client.post(
            "/runs",
            json={
                "template_id": "qr_eq5d5l_to_measurement",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "eq5d5l-e2e",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        with engine.connect() as conn:
            items = conn.execute(
                text(
                    "SELECT COUNT(*) FROM omop.measurement "
                    "WHERE measurement_source_value IN ('MO','SC','UA','PD','AD')"
                )
            ).scalar()
            vas = conn.execute(
                text("SELECT COUNT(*) FROM omop.measurement WHERE measurement_source_value = 'VAS'")
            ).scalar()
            utilities = conn.execute(
                text(
                    "SELECT COUNT(*) FROM omop.measurement "
                    "WHERE measurement_source_value = 'EQ5D5L_UTILITY'"
                )
            ).scalar()
        assert items == 10, f"expected 10 item rows, got {items}"
        assert vas == 2, f"expected 2 VAS rows, got {vas}"
        assert utilities == 2, f"expected 2 utility rows, got {utilities}"
