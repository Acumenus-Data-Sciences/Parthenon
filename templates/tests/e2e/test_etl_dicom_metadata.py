"""E2E: etl_dicom_metadata against a Postgres testcontainer + load_imaging_vocabulary first.

Stages the bundled DICOM fixture corpus, bootstraps Postgres with vocab and
omop schemas, fixtures the vocabulary + image_occurrence tables (Phase 0
DDL doesn't include them), runs load_imaging_vocabulary against a 1-concept
fixture so the modality lookup resolves, then submits etl_dicom_metadata
and asserts the post-load image_occurrence rowcount.
"""

from __future__ import annotations

import json
import subprocess
import time
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
DICOM_MANIFEST_DIR = REPO / "manifests" / "etl_dicom_metadata"
VOCAB_MANIFEST_DIR = REPO / "manifests" / "load_imaging_vocabulary"


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


def _stage_fixtures() -> Path:
    """Run the fixture builder script and return the fixture dir path."""
    builder = DICOM_MANIFEST_DIR / "fixtures" / "sample" / "build_fixtures.py"
    subprocess.run(["python", str(builder)], check=True)
    return DICOM_MANIFEST_DIR / "fixtures" / "sample" / "dicom"


def _build_vocab_fixture(target: Path) -> str:
    csv_text = (
        "concept_name,domain_id,vocabulary_id,concept_class_id,standard_concept,concept_code\n"
        "Modality,Observation,Parthenon-Imaging,DICOM Attribute,,(0008|0060)\n"
    )
    with zipfile.ZipFile(target, "w") as zf:
        zf.writestr("CONCEPT.csv", csv_text)
    return f"file://{target}"


def _wait_for(client: TestClient, run_id: str, timeout: int = 90) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/runs/{run_id}", headers=_auth())
        status = r.json()["status"]
        if status in {"completed", "failed", "cancelled"}:
            return str(status)
        time.sleep(0.5)
    return "timeout"


@pytest.mark.integration
def test_etl_dicom_metadata_runs_to_completion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    dicom_dir = _stage_fixtures()
    vocab_url = _build_vocab_fixture(tmp_path / "vocab.zip")

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        bootstrap(version="5.4", schema="omop", engine=engine)
        # Phase 0 DDL doesn't ship vocab.vocabulary or omop.image_occurrence;
        # fixture them so the templates' SQL resolves.
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS vocab.vocabulary (
                        vocabulary_id VARCHAR(20) PRIMARY KEY,
                        vocabulary_name VARCHAR(255) NOT NULL,
                        vocabulary_reference VARCHAR(255),
                        vocabulary_version VARCHAR(255),
                        vocabulary_concept_id INTEGER NOT NULL
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS omop.image_occurrence (
                        image_occurrence_id SERIAL PRIMARY KEY,
                        person_id INTEGER,
                        image_study_uid VARCHAR(255),
                        image_series_uid VARCHAR(255),
                        image_occurrence_date DATE,
                        modality_concept_id INTEGER,
                        anatomic_site_concept_id INTEGER,
                        image_occurrence_concept_id INTEGER
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

        # 1. Run load_imaging_vocabulary first to seed the modality concept.
        vocab_params = json.loads(
            (VOCAB_MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
        )
        vocab_params["source_url"] = vocab_url
        r = client.post(
            "/runs",
            json={
                "template_id": "load_imaging_vocabulary",
                "version": "0.1.0",
                "parameters": vocab_params,
                "correlation_id": "vocab-pre-dicom",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        # 2. Submit etl_dicom_metadata.
        params = json.loads(
            (DICOM_MANIFEST_DIR / "validation" / "inputs" / "parameters.json").read_text("utf-8")
        )
        params["dicom_dir"] = str(dicom_dir)
        r = client.post(
            "/runs",
            json={
                "template_id": "etl_dicom_metadata",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "dicom-etl-e2e",
            },
            headers=_auth(),
        )
        assert r.status_code == 201, r.text
        assert _wait_for(client, r.json()["run_id"]) == "completed"

        with engine.connect() as conn:
            n = conn.execute(text("SELECT COUNT(*) FROM omop.image_occurrence")).scalar()
        assert n is not None and n >= 3, f"expected >=3 image_occurrence rows, got {n}"
