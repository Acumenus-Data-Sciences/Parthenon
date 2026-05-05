"""Performance acceptance: 1M Observations through fhir_to_omop in < 10 min.

Marked ``slow`` + ``integration``. The default ``pytest -q`` skips it. Run
explicitly:

    uv run pytest tests/performance/ -v -m slow

Devplan T-015 acceptance criterion: 1M Observation resources processed in
<10 minutes on the reference hardware (8 vCPU, 32 GB, NVMe-class disk;
spec decision Q5). The harness records wall time and peak RSS; the wall
time gates the assertion, the RSS check is a soft warning so CI doesn't
flap on instance-to-instance jitter.
"""

from __future__ import annotations

import json
import os
import resource as r_mod
import time
import warnings
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "fhir_to_omop"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _seed_minimal_vocab(engine) -> None:
    """Seed enough LOINC + Gender concepts for the synthetic generator's codes."""
    rows = [
        (8507, "M", "Gender"),
        (8532, "F", "Gender"),
        (3004249, "8480-6", "LOINC"),
        (3025315, "29463-7", "LOINC"),
        (3025460, "8302-2", "LOINC"),
        (3025456, "39156-5", "LOINC"),
    ]
    with engine.begin() as conn:
        for cid, code, vocab in rows:
            conn.execute(
                text(
                    "INSERT INTO vocab.concept "
                    "(concept_id, concept_name, vocabulary_id, concept_code, "
                    "standard_concept, concept_class_id, domain_id, "
                    "valid_start_date, valid_end_date) "
                    "VALUES (:cid, :n, :v, :c, 'S', 'CLASS', 'Measurement', "
                    "'1970-01-01', '2099-12-31')"
                ),
                {"cid": cid, "n": f"concept-{cid}", "v": vocab, "c": code},
            )


@pytest.mark.slow
@pytest.mark.integration
def test_1m_observations_under_10_minutes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    from .generate_fixture import generate_observations

    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    n_obs = int(os.environ.get("PARTHENON_PERF_OBS_COUNT", "1000000"))
    generate_observations(fixture_dir, n_observations=n_obs, seed=42)

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="omop", engine=engine)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        _seed_minimal_vocab(engine)

        with engine.begin() as conn:
            for ddl in (
                """
                CREATE TABLE IF NOT EXISTS omop.visit_occurrence (
                    visit_occurrence_id BIGINT PRIMARY KEY,
                    person_id BIGINT NOT NULL,
                    visit_concept_id INTEGER NOT NULL,
                    visit_start_date DATE NOT NULL,
                    visit_start_datetime TIMESTAMP,
                    visit_end_date DATE NOT NULL,
                    visit_end_datetime TIMESTAMP,
                    visit_type_concept_id INTEGER,
                    visit_source_value VARCHAR(50),
                    visit_source_concept_id INTEGER
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS omop.measurement (
                    measurement_id BIGSERIAL PRIMARY KEY,
                    person_id BIGINT NOT NULL,
                    measurement_concept_id INTEGER NOT NULL,
                    measurement_date DATE NOT NULL,
                    measurement_datetime TIMESTAMP,
                    measurement_type_concept_id INTEGER,
                    value_as_number NUMERIC,
                    unit_concept_id INTEGER,
                    measurement_source_value VARCHAR(50),
                    measurement_source_concept_id INTEGER,
                    visit_occurrence_id BIGINT
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS omop.observation (
                    observation_id BIGSERIAL PRIMARY KEY,
                    person_id BIGINT NOT NULL,
                    observation_concept_id INTEGER NOT NULL,
                    observation_date DATE NOT NULL,
                    observation_datetime TIMESTAMP,
                    observation_type_concept_id INTEGER,
                    value_as_number NUMERIC,
                    value_as_string VARCHAR(255),
                    value_as_concept_id INTEGER,
                    observation_source_value VARCHAR(50),
                    observation_source_concept_id INTEGER,
                    visit_occurrence_id BIGINT
                )
                """,
            ):
                conn.execute(text(ddl))

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

        rss_before = r_mod.getrusage(r_mod.RUSAGE_SELF).ru_maxrss
        t0 = time.monotonic()

        r = client.post(
            "/runs",
            json={
                "template_id": "fhir_to_omop",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "perf-1m",
            },
            headers={"X-Parthenon-Internal-Token": "test-internal-token"},
        )
        assert r.status_code == 201, r.text
        run_id = r.json()["run_id"]

        # 10-minute budget for the run + 100s buffer for the polling loop.
        deadline = time.time() + 700
        final = "running"
        while time.time() < deadline:
            resp = client.get(
                f"/runs/{run_id}",
                headers={"X-Parthenon-Internal-Token": "test-internal-token"},
            )
            final = resp.json()["status"]
            if final in {"completed", "failed", "cancelled"}:
                break
            time.sleep(2.0)

        elapsed = time.monotonic() - t0
        rss_after = r_mod.getrusage(r_mod.RUSAGE_SELF).ru_maxrss
        rss_delta_mb = (rss_after - rss_before) / 1024

        # Expose the measured numbers for the Plan 7 Task 7 decision document.
        print(
            f"perf: {n_obs} observations, status={final}, "
            f"elapsed={elapsed:.1f}s, RSS delta={rss_delta_mb:.0f}MB"
        )

        assert final == "completed", f"run did not complete: {final}"
        # Hard performance assertion (devplan T-015 acceptance criterion).
        assert elapsed < 600, f"1M observations took {elapsed:.1f}s, budget is 600s"
        # Soft RSS check — warn but don't fail (cloud runners vary).
        if rss_delta_mb > 4096:
            warnings.warn(
                f"RSS grew by {rss_delta_mb:.0f}MB (soft budget 4096MB)",
                UserWarning,
                stacklevel=2,
            )
