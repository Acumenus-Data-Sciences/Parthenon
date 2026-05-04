"""E2E: load_imaging_vocabulary against a Postgres testcontainer.

Builds a tiny CONCEPT.csv fixture, serves it via a `file://` URL, and
exercises the full template lifecycle via the FastAPI TestClient. Asserts
the post-load vocab.concept rowcount matches the fixture row count.
"""

from __future__ import annotations

import json
import time
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "load_imaging_vocabulary"


def _build_fixture_bundle(target: Path) -> None:
    """Create a tiny CONCEPT.csv bundle for the test (3 imaging concepts)."""
    csv_text = (
        "concept_name,domain_id,vocabulary_id,concept_class_id,standard_concept,concept_code\n"
        "Patient Name,Observation,Parthenon-Imaging,DICOM Attribute,,(0010|0010)\n"
        "Patient ID,Observation,Parthenon-Imaging,DICOM Attribute,,(0010|0020)\n"
        "Modality,Observation,Parthenon-Imaging,DICOM Attribute,,(0008|0060)\n"
    )
    with zipfile.ZipFile(target, "w") as zf:
        zf.writestr("CONCEPT.csv", csv_text)


def _normalize_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg2://", "postgresql+psycopg://").replace(
        "postgresql://", "postgresql+psycopg://"
    )


def _auth() -> dict[str, str]:
    return {"X-Parthenon-Internal-Token": "test-internal-token"}


@pytest.mark.integration
def test_load_imaging_vocabulary_runs_to_completion(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("testcontainers.postgres")
    from testcontainers.postgres import PostgresContainer

    fixture_zip = tmp_path / "dicom2omop_fixture.zip"
    _build_fixture_bundle(fixture_zip)
    fixture_url = f"file://{fixture_zip}"

    with PostgresContainer("postgres:16") as pg:
        db_url = _normalize_psycopg(pg.get_connection_url())
        engine = create_engine(db_url, future=True)
        bootstrap(version="5.4", schema="vocab", engine=engine)
        # bootstrap() ships the Phase 0 minimal schema (person/visit/drug/
        # concept). The OMOP vocabulary table isn't in the Phase 0 DDL
        # because real deployments load it via Athena. Stand it up here so
        # the loader's ON CONFLICT (vocabulary_id) clause has a target.
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
        params["source_url"] = fixture_url

        resp = client.post(
            "/runs",
            json={
                "template_id": "load_imaging_vocabulary",
                "version": "0.1.0",
                "parameters": params,
                "correlation_id": "imaging-vocab-e2e",
            },
            headers=_auth(),
        )
        assert resp.status_code == 201, resp.text
        run_id = resp.json()["run_id"]

        deadline = time.time() + 90
        final = "running"
        while time.time() < deadline:
            r = client.get(f"/runs/{run_id}", headers=_auth())
            final = r.json()["status"]
            if final in {"completed", "failed", "cancelled"}:
                break
            time.sleep(0.5)
        assert final == "completed", f"run did not complete: {final}"

        with engine.connect() as conn:
            n = conn.execute(
                text("SELECT COUNT(*) FROM vocab.concept WHERE vocabulary_id = 'Parthenon-Imaging'")
            ).scalar()
        assert n == 3, f"expected 3 imaging concepts loaded, got {n}"
