"""Bootstrap v5.3 and Oncology Extension paths."""

from __future__ import annotations

from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text

from runtime.cdm.bootstrap import bootstrap

testcontainers = pytest.importorskip("testcontainers.postgres")


def _normalize_psycopg_url(url: str) -> str:
    """Coerce a testcontainers-postgresql URL to use psycopg v3 (matches deps)."""
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


def _table_set(url: str, schema: str) -> set[str]:
    engine = create_engine(url, future=True)
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = :s"),
            {"s": schema},
        ).fetchall()
    return {r[0] for r in rows}


def test_bootstrap_v5_3_creates_person(postgres_url: str) -> None:
    engine = create_engine(postgres_url, future=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS v53"))
    bootstrap(version="5.3", schema="v53", engine=engine)
    assert "person" in _table_set(postgres_url, "v53")


def test_bootstrap_oncology_ext_adds_episode(postgres_url: str) -> None:
    engine = create_engine(postgres_url, future=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS onc"))
    bootstrap(version="oncology_ext", schema="onc", engine=engine)
    tables = _table_set(postgres_url, "onc")
    assert "person" in tables
    assert "episode" in tables
    assert "episode_event" in tables
