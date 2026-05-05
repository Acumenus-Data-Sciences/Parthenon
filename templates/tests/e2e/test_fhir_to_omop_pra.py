"""E2E: fhir_to_omop PR-A pipeline against Postgres testcontainer + fixture corpus.

Bootstraps vocab + omop schemas, seeds the IG-required concepts (Gender, Race,
Ethnicity, SNOMED, LOINC), points the manifest at the bundled fixture FHIR
NDJSON, runs the full 7-stage pipeline, and asserts:
  - 2 PERSON rows
  - 2 VISIT_OCCURRENCE rows
  - 2 CONDITION_OCCURRENCE rows
  - 2 MEASUREMENT rows (vital-signs split)
  - 2 OBSERVATION rows (social-history split)
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
MANIFEST_DIR = REPO / "manifests" / "fhir_to_omop"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _wait_for(client: TestClient, run_id: str, timeout: int = 120) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        s = r.json()["status"]
        if s in {"completed", "failed", "cancelled"}:
            return str(s)
        time.sleep(0.5)
    return "timeout"


def _seed_vocab_and_omop_tables(engine):
    """Seed minimal vocab + create omop tables the loader writes to.

    Phase 0 ships only person/visit/drug/concept in v5.4 SQL; the rest of the
    OMOP tables (vocabulary, condition_occurrence, measurement, observation,
    visit_occurrence with all columns the loader uses) need fixturing here.
    """
    with engine.begin() as conn:
        # Seed concept rows the mappers need to resolve. The shipped concept
        # table has NOT NULL columns for domain_id/concept_class_id/dates.
        conn.execute(
            text(
                "INSERT INTO vocab.concept "
                "(concept_id, concept_name, domain_id, vocabulary_id, "
                "concept_class_id, standard_concept, concept_code, "
                "valid_start_date, valid_end_date) "
                "VALUES "
                "(8507, 'MALE', 'Gender', 'Gender', 'Gender', 'S', 'M', "
                "'1970-01-01', '2099-12-31'), "
                "(8532, 'FEMALE', 'Gender', 'Gender', 'Gender', 'S', 'F', "
                "'1970-01-01', '2099-12-31'), "
                "(38003563, 'White', 'Race', 'Race', 'Race', 'S', '2106-3', "
                "'1970-01-01', '2099-12-31'), "
                "(38003567, 'Not Hispanic or Latino', 'Ethnicity', 'Ethnicity', "
                "'Ethnicity', 'S', '2186-5', '1970-01-01', '2099-12-31'), "
                "(4267416, 'Hypertension', 'Condition', 'SNOMED', "
                "'Clinical Finding', 'S', '38341003', '1970-01-01', '2099-12-31'), "
                "(4112343, 'Asthma', 'Condition', 'SNOMED', 'Clinical Finding', "
                "'S', '195967001', '1970-01-01', '2099-12-31'), "
                "(3004249, 'Systolic blood pressure', 'Measurement', 'LOINC', "
                "'Lab Test', 'S', '8480-6', '1970-01-01', '2099-12-31'), "
                "(3025315, 'Body weight', 'Measurement', 'LOINC', 'Lab Test', "
                "'S', '29463-7', '1970-01-01', '2099-12-31'), "
                "(40766240, 'Tobacco smoking status', 'Observation', 'LOINC', "
                "'Survey', 'S', '72166-2', '1970-01-01', '2099-12-31')"
            )
        )
        # The OMOP target tables the loader inserts into. Phase 0 ships
        # person/concept only — we fixture the rest with the columns the
        # loader writes.
        conn.execute(
            text(
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
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS omop.condition_occurrence (
                    condition_occurrence_id BIGSERIAL PRIMARY KEY,
                    person_id BIGINT NOT NULL,
                    condition_concept_id INTEGER NOT NULL,
                    condition_start_date DATE NOT NULL,
                    condition_start_datetime TIMESTAMP,
                    condition_end_date DATE,
                    condition_type_concept_id INTEGER,
                    condition_source_value VARCHAR(50),
                    condition_source_concept_id INTEGER,
                    visit_occurrence_id BIGINT
                )
                """
            )
        )
        conn.execute(
            text(
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
                """
            )
        )
        conn.execute(
            text(
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
                """
            )
        )


@pytest.mark.integration
def test_fhir_to_omop_pra_runs_to_completion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    fixture_dir = tmp_path / "fhir_in"
    fixture_dir.mkdir()
    for f in (MANIFEST_DIR / "fixtures" / "sample").glob("*.ndjson"):
        shutil.copy(f, fixture_dir / f.name)

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="omop", engine=engine)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        _seed_vocab_and_omop_tables(engine)

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

        r = client.post(
            "/runs",
            json={
                "template_id": "fhir_to_omop",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "fhir-to-omop-pra-e2e",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        with engine.connect() as conn:
            persons = conn.execute(text("SELECT COUNT(*) FROM omop.person")).scalar()
            visits = conn.execute(text("SELECT COUNT(*) FROM omop.visit_occurrence")).scalar()
            conditions = conn.execute(
                text("SELECT COUNT(*) FROM omop.condition_occurrence")
            ).scalar()
            measurements = conn.execute(text("SELECT COUNT(*) FROM omop.measurement")).scalar()
            observations = conn.execute(text("SELECT COUNT(*) FROM omop.observation")).scalar()
        assert persons == 2, f"expected 2 persons, got {persons}"
        assert visits == 2, f"expected 2 visits, got {visits}"
        assert conditions == 2, f"expected 2 conditions, got {conditions}"
        assert measurements == 2, f"expected 2 measurements, got {measurements}"
        assert observations == 2, f"expected 2 observations, got {observations}"
