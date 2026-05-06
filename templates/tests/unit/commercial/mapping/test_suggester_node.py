"""Phase 3 Plan 6 Task 9 (T-024A): ConceptMappingSuggesterNode."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pytest

from runtime.commercial.mapping.embedder import BgeEmbedder
from runtime.commercial.mapping.reranker import ConceptReranker
from runtime.commercial.mapping.retriever import ConceptRetriever
from runtime.commercial.mapping.suggester_node import ConceptMappingSuggesterNode
from runtime.commercial.mapping.types import ConceptCandidate
from runtime.nodes.base import NodeContext, NodeStatus


class _FakeCursor:
    def __init__(self, queue_rows: list[tuple[Any, ...]]) -> None:
        self._queue_rows = queue_rows
        self.executes: list[tuple[str, tuple[Any, ...]]] = []

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        self.executes.append((query, params))

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._queue_rows)

    def __iter__(self) -> Any:
        return iter(self._queue_rows)

    def __enter__(self) -> _FakeCursor:
        return self

    def __exit__(self, *args: Any) -> None:
        return None


class _FakeConn:
    def __init__(self, cursor: _FakeCursor) -> None:
        self._cursor = cursor
        self.closed = False

    def cursor(self) -> _FakeCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


def _stub_embedder() -> BgeEmbedder:
    class _Fake:
        def encode(
            self, texts: list[str], *, normalize_embeddings: bool = True
        ) -> list[list[float]]:
            return [[0.01] * 768 for _ in texts]

    return BgeEmbedder(loader=lambda _name: _Fake())  # type: ignore[arg-type]


class _StubRetriever(ConceptRetriever):
    """Returns a fixed candidate list regardless of input vector."""

    def search(
        self,
        cursor: Any,
        query_embedding: list[float],
        *,
        top_k: int = 50,
        domain_filter: str | None = None,
        vocabulary_filter: list[str] | None = None,
    ) -> list[ConceptCandidate]:
        return [
            ConceptCandidate(
                concept_id=4193704,
                concept_name="Glucose",
                vocabulary_id="LOINC",
                domain_id="Measurement",
                standard_concept="S",
                similarity=0.9,
            )
        ]


def _make_context(tmp_path: Path) -> NodeContext:
    artifact_dir = tmp_path / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return NodeContext(
        run_id="test-run",
        node_id="suggester-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=artifact_dir,
        db_dsn="postgresql://stub",
    )


def test_run_with_empty_queue_emits_zero_results(tmp_path: Path) -> None:
    cursor = _FakeCursor(queue_rows=[])
    conn = _FakeConn(cursor)
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(rerank_model="test"),
        connect=lambda _dsn: conn,
    )
    res = node.run(
        _make_context(tmp_path),
        {
            "queue_table": "lis_lab_source.unmapped_local_lab_code",
            "code_column": "local_code",
            "text_column": "local_code_text",
            "vocab_column": "coding_system",
            "limit": 100,
        },
    )
    assert res.status is NodeStatus.SUCCESS
    assert res.outputs == {"rerank_count": 0}
    artifact = (tmp_path / "artifacts" / "rerank_results.json").read_text()
    assert json.loads(artifact) == []


def test_run_with_queue_rows_emits_rerank_results(tmp_path: Path) -> None:
    cursor = _FakeCursor(
        queue_rows=[
            ("FAC-GLU", "Facility glucose", "L"),
            ("FAC-K", "Facility potassium", "L"),
        ]
    )
    conn = _FakeConn(cursor)
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(rerank_model="degraded@unwired"),
        connect=lambda _dsn: conn,
    )
    res = node.run(
        _make_context(tmp_path),
        {
            "queue_table": "lis_lab_source.unmapped_local_lab_code",
        },
    )
    assert res.status is NodeStatus.SUCCESS
    assert res.outputs["rerank_count"] == 2
    artifact = json.loads((tmp_path / "artifacts" / "rerank_results.json").read_text())
    assert len(artifact) == 2
    assert artifact[0]["source_code"] == "FAC-GLU"
    assert artifact[0]["candidates"][0]["concept_id"] == 4193704


def test_run_missing_queue_table_param_fails(tmp_path: Path) -> None:
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(),
        connect=lambda _dsn: _FakeConn(_FakeCursor([])),
    )
    res = node.run(_make_context(tmp_path), {})
    assert res.status is NodeStatus.FAILED
    assert res.error_message and "queue_table" in res.error_message


def test_run_no_db_dsn_fails(tmp_path: Path) -> None:
    ctx = _make_context(tmp_path)
    ctx.db_dsn = None
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(),
        connect=lambda _dsn: _FakeConn(_FakeCursor([])),
    )
    res = node.run(ctx, {"queue_table": "schema.t"})
    assert res.status is NodeStatus.FAILED
    assert res.error_message and "db_dsn" in res.error_message


def test_run_uses_custom_column_names(tmp_path: Path) -> None:
    """Param-driven column names — different queues have different columns."""
    cursor = _FakeCursor(queue_rows=[("X", "x", "v")])
    conn = _FakeConn(cursor)
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(),
        connect=lambda _dsn: conn,
    )
    node.run(
        _make_context(tmp_path),
        {
            "queue_table": "schema.alt_queue",
            "code_column": "ndc",
            "text_column": "drug_name",
            "vocab_column": "ndc_source",
        },
    )
    select_query = cursor.executes[0][0]
    assert "ndc, drug_name, ndc_source" in select_query
    assert "schema.alt_queue" in select_query


def test_run_writes_custom_output_filename(tmp_path: Path) -> None:
    cursor = _FakeCursor(queue_rows=[])
    conn = _FakeConn(cursor)
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(),
        connect=lambda _dsn: conn,
    )
    node.run(
        _make_context(tmp_path),
        {
            "queue_table": "schema.t",
            "output_artifact": "lis_lab_rerank.json",
        },
    )
    assert (tmp_path / "artifacts" / "lis_lab_rerank.json").is_file()


def test_node_type_name_is_concept_mapping_suggester() -> None:
    assert ConceptMappingSuggesterNode.type_name == "concept_mapping_suggester"


def test_run_closes_connection_on_failure(tmp_path: Path) -> None:
    """If DB iteration raises, conn.close() must still run."""
    cursor = _FakeCursor(queue_rows=[])

    def boom_query(_query: str, _params: tuple[Any, ...] = ()) -> None:
        raise RuntimeError("simulated DB failure")

    cursor.execute = boom_query  # type: ignore[method-assign]
    conn = _FakeConn(cursor)
    node = ConceptMappingSuggesterNode(
        embedder=_stub_embedder(),
        retriever=_StubRetriever(),
        reranker=ConceptReranker(),
        connect=lambda _dsn: conn,
    )
    with pytest.raises(RuntimeError):
        node.run(_make_context(tmp_path), {"queue_table": "schema.t"})
    assert conn.closed
