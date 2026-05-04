"""E2E: fhir_to_omop PR-B (Procedure + Medications + Immunization).

Extends Plan 5's PR-A E2E with the three PR-B resource types. Fixtures the
two additional OMOP tables (procedure_occurrence, drug_exposure) inline,
seeds three additional concepts (CPT 44950, RxNorm 6809, CVX 141), and
asserts post-load row counts:

  - PERSON = 2, VISIT_OCCURRENCE = 2 (PR-A unchanged)
  - CONDITION_OCCURRENCE = 2, MEASUREMENT = 2, OBSERVATION = 2 (PR-A unchanged)
  - PROCEDURE_OCCURRENCE = 1 (the appendectomy)
  - DRUG_EXPOSURE = 2 (1 MedicationRequest + 1 Immunization)
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
    with engine.begin() as conn:
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
                "'Survey', 'S', '72166-2', '1970-01-01', '2099-12-31'), "
                "(2002608, 'Appendectomy', 'Procedure', 'CPT4', 'CPT4', 'S', "
                "'44950', '1970-01-01', '2099-12-31'), "
                "(1503297, 'metformin', 'Drug', 'RxNorm', 'Ingredient', 'S', "
                "'6809', '1970-01-01', '2099-12-31'), "
                "(45769446, 'Influenza vaccine', 'Drug', 'CVX', 'CVX', 'S', "
                "'141', '1970-01-01', '2099-12-31')"
            )
        )
        # OMOP target tables — Phase 0 ships only person/concept and a skeletal
        # drug_exposure (no SERIAL), so we drop the latter first to recreate
        # with the columns + autoinc the loader expects.
        conn.execute(text("DROP TABLE IF EXISTS omop.drug_exposure"))
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
            """
            CREATE TABLE IF NOT EXISTS omop.procedure_occurrence (
                procedure_occurrence_id BIGSERIAL PRIMARY KEY,
                person_id BIGINT NOT NULL,
                procedure_concept_id INTEGER NOT NULL,
                procedure_date DATE NOT NULL,
                procedure_datetime TIMESTAMP,
                procedure_type_concept_id INTEGER,
                procedure_source_value VARCHAR(50),
                procedure_source_concept_id INTEGER,
                visit_occurrence_id BIGINT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS omop.drug_exposure (
                drug_exposure_id BIGSERIAL PRIMARY KEY,
                person_id BIGINT NOT NULL,
                drug_concept_id INTEGER NOT NULL,
                drug_exposure_start_date DATE NOT NULL,
                drug_exposure_start_datetime TIMESTAMP,
                drug_exposure_end_date DATE,
                drug_exposure_end_datetime TIMESTAMP,
                drug_type_concept_id INTEGER,
                drug_source_value VARCHAR(50),
                drug_source_concept_id INTEGER,
                visit_occurrence_id BIGINT
            )
            """,
        ):
            conn.execute(text(ddl))


@pytest.mark.integration
def test_fhir_to_omop_prb_runs_to_completion(
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
                "correlation_id": "fhir-to-omop-prb-e2e",
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
            measurements = conn.execute(
                text("SELECT COUNT(*) FROM omop.measurement")
            ).scalar()
            observations = conn.execute(
                text("SELECT COUNT(*) FROM omop.observation")
            ).scalar()
            procedures = conn.execute(
                text("SELECT COUNT(*) FROM omop.procedure_occurrence")
            ).scalar()
            drugs = conn.execute(text("SELECT COUNT(*) FROM omop.drug_exposure")).scalar()
        assert persons == 2, f"expected 2 persons, got {persons}"
        assert visits == 2, f"expected 2 visits, got {visits}"
        assert conditions == 2, f"expected 2 conditions, got {conditions}"
        assert measurements == 2, f"expected 2 measurements, got {measurements}"
        assert observations == 2, f"expected 2 observations, got {observations}"
        assert procedures == 1, f"expected 1 procedure, got {procedures}"
        assert drugs == 2, f"expected 2 drug_exposures, got {drugs}"
