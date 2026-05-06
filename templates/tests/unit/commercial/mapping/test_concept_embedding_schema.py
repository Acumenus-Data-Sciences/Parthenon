"""Phase 3 Plan 6 Task 4 (T-024A): pgvector schema for bge embeddings."""

from __future__ import annotations

from pathlib import Path

import pytest

_MIGRATION = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "runtime"
    / "commercial"
    / "mapping"
    / "migrations"
    / "01_concept_embedding_bge.sql"
)


def _read() -> str:
    return _MIGRATION.read_text(encoding="utf-8")


def test_migration_exists() -> None:
    assert _MIGRATION.is_file()


def test_creates_pgvector_extension() -> None:
    assert "CREATE EXTENSION IF NOT EXISTS vector" in _read()


def test_creates_concept_embedding_bge_in_vocab_schema() -> None:
    assert "CREATE TABLE IF NOT EXISTS vocab.concept_embedding_bge" in _read()


def test_concept_id_pk_with_fk_to_vocab_concept() -> None:
    sql = _read()
    assert "concept_id  BIGINT      PRIMARY KEY REFERENCES vocab.concept (concept_id)" in sql


def test_embedding_column_uses_768_dim_vector() -> None:
    """Must match BgeEmbedder.EMBEDDING_DIM constant."""
    assert "embedding   vector(768) NOT NULL" in _read()


def test_model_name_default_is_bge_base() -> None:
    assert "DEFAULT 'BAAI/bge-base-en-v1.5'" in _read()


def test_creates_ivfflat_cosine_index() -> None:
    sql = _read()
    assert "USING ivfflat (embedding vector_cosine_ops)" in sql
    assert "WITH (lists = 200)" in sql


def test_index_naming_is_explicit() -> None:
    sql = _read()
    assert "concept_embedding_bge_ivfflat_cos" in sql
    assert "concept_embedding_bge_model_idx" in sql


def test_migration_is_idempotent() -> None:
    """All DDL must use IF NOT EXISTS so re-runs are safe."""
    sql = _read()
    assert sql.count("IF NOT EXISTS") >= 4  # extension + table + 2 indexes


def test_no_phi_or_seed_data() -> None:
    """Structural-only — no INSERT statements."""
    assert "INSERT INTO" not in _read().upper()


@pytest.mark.parametrize(
    "column",
    ["concept_id", "embedding", "model_name", "embedded_at"],
)
def test_table_has_required_columns(column: str) -> None:
    assert column in _read()
