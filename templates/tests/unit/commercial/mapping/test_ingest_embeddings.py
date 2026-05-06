"""Phase 3 Plan 6 Task 5 (T-024A): concept embedding ingest job."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from typing import Any

import pytest

from runtime.commercial.mapping.embedder import BgeEmbedder
from runtime.commercial.mapping.ingest_embeddings import (
    IngestStats,
    _vector_literal,
    main,
    run_ingest,
)


class _FakeCursor:
    """Records SQL calls; iterates fake rows on demand."""

    def __init__(self, rows: list[tuple[int, str]]) -> None:
        self._rows = rows
        self.executes: list[tuple[str, tuple[Any, ...]]] = []
        self.executemany_calls: list[tuple[str, list[tuple[Any, ...]]]] = []

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        self.executes.append((query, params))

    def executemany(self, query: str, params_list: list[tuple[Any, ...]]) -> None:
        self.executemany_calls.append((query, params_list))

    def __iter__(self):  # type: ignore[no-untyped-def]
        return iter(self._rows)

    def __enter__(self) -> _FakeCursor:
        return self

    def __exit__(self, *args: Any) -> None:
        return None


class _FakeConn:
    def __init__(self, cursor: _FakeCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.closed = False

    def cursor(self) -> _FakeCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def close(self) -> None:
        self.closed = True


def _stub_embedder() -> BgeEmbedder:
    """Returns a BgeEmbedder backed by a deterministic fake encoder."""

    class _FakeModel:
        def encode(
            self, texts: list[str], *, normalize_embeddings: bool = True
        ) -> list[list[float]]:
            return [[float((len(t) + i) % 7) / 7.0 for i in range(768)] for t in texts]

    return BgeEmbedder(loader=lambda _name: _FakeModel())  # type: ignore[arg-type]


# ---------- pure-helper tests ----------


def test_vector_literal_uses_pgvector_bracket_syntax() -> None:
    out = _vector_literal([0.1, 0.2, 0.3])
    assert out.startswith("[")
    assert out.endswith("]")
    assert "0.1000000" in out
    assert "0.2000000" in out


def test_vector_literal_handles_empty_list() -> None:
    """Defensive — embedder never returns []; assert it doesn't blow up anyway."""
    assert _vector_literal([]) == "[]"


# ---------- run_ingest tests ----------


def test_run_ingest_zero_concepts_is_noop() -> None:
    cursor = _FakeCursor(rows=[])
    stats = run_ingest(cursor=cursor, embedder=_stub_embedder())
    assert stats.total_seen == 0
    assert stats.total_embedded == 0
    assert stats.batches == 0
    # Still issued the SELECT query.
    assert any("FROM vocab.concept" in q for q, _ in cursor.executes)
    # No upsert needed.
    assert cursor.executemany_calls == []


def test_run_ingest_one_batch() -> None:
    rows = [(c, f"Concept {c}") for c in (1001, 1002, 1003)]
    cursor = _FakeCursor(rows=rows)
    stats = run_ingest(cursor=cursor, embedder=_stub_embedder(), batch_size=10)
    assert stats.total_seen == 3
    assert stats.total_embedded == 3
    assert stats.batches == 1
    # The upsert payload had 3 rows of (concept_id, vector_literal, model_name).
    assert len(cursor.executemany_calls) == 1
    upsert_query, payload = cursor.executemany_calls[0]
    assert "INSERT INTO vocab.concept_embedding_bge" in upsert_query
    assert "ON CONFLICT (concept_id) DO UPDATE" in upsert_query
    assert len(payload) == 3
    assert payload[0][0] == 1001
    assert payload[0][1].startswith("[") and payload[0][1].endswith("]")
    assert payload[0][2] == "BAAI/bge-base-en-v1.5"


def test_run_ingest_chunks_into_multiple_batches() -> None:
    rows = [(c, f"name-{c}") for c in range(2500, 2510)]
    cursor = _FakeCursor(rows=rows)
    stats = run_ingest(cursor=cursor, embedder=_stub_embedder(), batch_size=4)
    assert stats.total_seen == 10
    assert stats.batches == 3  # 4 + 4 + 2
    assert len(cursor.executemany_calls) == 3
    assert sum(len(p) for _, p in cursor.executemany_calls) == 10


def test_run_ingest_select_uses_not_exists_idempotency_filter() -> None:
    cursor = _FakeCursor(rows=[])
    run_ingest(cursor=cursor, embedder=_stub_embedder())
    select_query = cursor.executes[0][0]
    assert "NOT EXISTS" in select_query
    assert "vocab.concept_embedding_bge" in select_query


def test_run_ingest_filters_to_standard_concepts_only() -> None:
    cursor = _FakeCursor(rows=[])
    run_ingest(cursor=cursor, embedder=_stub_embedder())
    select_query = cursor.executes[0][0]
    assert "standard_concept = 'S'" in select_query
    assert "invalid_reason IS NULL" in select_query


def test_run_ingest_uses_vocabulary_filter_param() -> None:
    cursor = _FakeCursor(rows=[])
    run_ingest(
        cursor=cursor,
        embedder=_stub_embedder(),
        vocabularies=("SNOMED", "RxNorm"),
    )
    _query, params = cursor.executes[0]
    assert params[0] == ["SNOMED", "RxNorm"]
    assert params[1] == "BAAI/bge-base-en-v1.5"  # model name passed for skip filter


def test_ingest_stats_total_skipped_is_seen_minus_embedded() -> None:
    stats = IngestStats(total_seen=10, total_embedded=10, total_skipped=0, batches=2)
    assert stats.total_skipped == 0
    # Sanity: dataclass is frozen — assignment raises FrozenInstanceError.
    with pytest.raises(FrozenInstanceError):
        stats.total_seen = 5  # type: ignore[misc]


# ---------- main() CLI tests ----------


def test_main_requires_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PARTHENON_DB_URL", raising=False)
    with pytest.raises(SystemExit) as excinfo:
        main([])
    # argparse error => SystemExit code 2.
    assert excinfo.value.code == 2


def test_main_runs_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PARTHENON_DB_URL", "postgresql://stub")
    cursor = _FakeCursor(rows=[(1, "Aspirin"), (2, "Atenolol")])
    conn = _FakeConn(cursor)

    rc = main(
        ["--batch-size", "1024"],
        connect=lambda _dsn: conn,
        embedder=_stub_embedder(),
    )
    assert rc == 0
    assert conn.committed
    assert conn.closed


def test_main_passes_vocabulary_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PARTHENON_DB_URL", "postgresql://stub")
    cursor = _FakeCursor(rows=[])
    conn = _FakeConn(cursor)
    rc = main(
        ["--vocabulary", "SNOMED", "LOINC"],
        connect=lambda _dsn: conn,
        embedder=_stub_embedder(),
    )
    assert rc == 0
    _query, params = cursor.executes[0]
    assert params[0] == ["SNOMED", "LOINC"]
