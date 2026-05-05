"""Tests for the parthenon-cdm bootstrap helper.

Uses testcontainers-postgresql so we never touch the project's Docker PG.
Per ~/.claude/memory/feedback_db_operations.md: never connect to Docker PG.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap
from runtime.cdm.schema import SUPPORTED_CDM_VERSIONS, Schema

testcontainers = pytest.importorskip("testcontainers.postgres")


def _normalize_psycopg_url(url: str) -> str:
    """Coerce a testcontainers-postgresql URL to use the psycopg (v3) driver.

    testcontainers 4.9.0 emits ``postgresql+psycopg2://`` (the v2 driver, which
    is not pinned in our deps). We pin ``psycopg[binary]==3.2.3`` instead, so
    rewrite the dialect prefix to use the v3 driver.
    """
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@pytest.fixture()
def postgres_url() -> Generator[str, None, None]:
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16") as pg:
        yield _normalize_psycopg_url(pg.get_connection_url())


def test_supported_cdm_versions() -> None:
    assert set(SUPPORTED_CDM_VERSIONS) == {"5.3", "5.4", "oncology_ext"}


def test_schema_factory_for_5_4_returns_metadata() -> None:
    metadata = Schema.for_version("5.4")
    table_names = set(metadata.tables.keys())
    for required in ("person", "visit_occurrence", "drug_exposure", "concept"):
        # MetaData uses fully-qualified names with schema prefix.
        assert any(name.endswith(required) for name in table_names), required


def test_unsupported_version_raises() -> None:
    with pytest.raises(ValueError, match="unsupported CDM version"):
        Schema.for_version("4.99")


def test_bootstrap_creates_then_idempotently_reruns(postgres_url: str) -> None:
    engine = create_engine(postgres_url, future=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS bootstrap_test"))

    bootstrap(version="5.4", schema="bootstrap_test", engine=engine)
    bootstrap(version="5.4", schema="bootstrap_test", engine=engine)  # second call is a no-op

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'bootstrap_test' ORDER BY table_name"
            )
        ).fetchall()
    table_names = {r[0] for r in rows}
    for required in ("person", "visit_occurrence", "drug_exposure"):
        assert required in table_names
