"""``ConceptMappingSuggesterNode`` — orchestration for the rerank pipeline.

Phase 3 Plan 6 Task 9 (T-024A). Commercial-tier (proprietary). Reads
unmapped-source-code rows from a queue table, runs each through
embed → retrieve → rerank, and writes the resulting ``RerankResult``
list as a JSON artifact.

Queue contracts the node knows about:

- ``unmapped_local_lab_code`` (Plan 5 Task 7) — populated by the
  ``lis_lab_to_omop`` template.
- ``unmapped_ndc`` and ``unmapped_icdo3`` are placeholders for future
  templates; the node reads any ``(local_code, local_code_text,
  source_vocab)`` shape via configurable column names.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

from runtime.commercial.mapping.embedder import BgeEmbedder
from runtime.commercial.mapping.reranker import ConceptReranker
from runtime.commercial.mapping.retriever import ConceptRetriever
from runtime.commercial.mapping.types import RerankResult
from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

_LOGGER = logging.getLogger(__name__)


@runtime_checkable
class _CursorProtocol(Protocol):
    def execute(self, query: str, params: tuple[Any, ...] = ...) -> Any: ...

    def fetchall(self) -> list[tuple[Any, ...]]: ...

    def __iter__(self) -> Iterator[tuple[Any, ...]]: ...


@dataclass(frozen=True)
class _UnmappedRow:
    local_code: str
    local_code_text: str
    source_vocab: str


def _select_unmapped(
    cursor: _CursorProtocol,
    *,
    queue_table: str,
    code_column: str,
    text_column: str,
    vocab_column: str,
    limit: int,
) -> list[_UnmappedRow]:
    sql = f"""
        SELECT {code_column}, {text_column}, {vocab_column}
        FROM {queue_table}
        ORDER BY 1
        LIMIT %s
    """
    cursor.execute(sql, (limit,))
    out: list[_UnmappedRow] = []
    for row in cursor.fetchall():
        out.append(
            _UnmappedRow(
                local_code=str(row[0]),
                local_code_text=str(row[1]) if len(row) > 1 and row[1] is not None else "",
                source_vocab=str(row[2]) if len(row) > 2 and row[2] is not None else "L",
            )
        )
    return out


# Type alias for the cursor factory the node uses to talk to the DB.
# Production wires psycopg.connect; tests pass a fake.
ConnectFactory = Callable[[str], Any]


class ConceptMappingSuggesterNode(Node):
    """Run embed -> retrieve -> rerank over a queue of unmapped codes.

    Required params (from manifest):

    - ``queue_table``: fully-qualified table name (e.g.
      ``lis_lab_source.unmapped_local_lab_code``).
    - ``code_column``: column with the local code (e.g. ``local_code``).
    - ``text_column``: column with the local human-readable label
      (e.g. ``local_code_text``).
    - ``vocab_column``: column with the source vocabulary tag
      (e.g. ``coding_system``).
    - ``limit``: max rows to process per run (default 1000).
    - ``output_artifact``: file name for the JSON RerankResult batch.

    Dependencies are injectable so unit tests can stub the embedder,
    retriever, reranker, and DB connection.
    """

    type_name = "concept_mapping_suggester"

    def __init__(
        self,
        embedder: BgeEmbedder | None = None,
        retriever: ConceptRetriever | None = None,
        reranker: ConceptReranker | None = None,
        connect: ConnectFactory | None = None,
    ) -> None:
        super().__init__()
        self._embedder = embedder
        self._retriever = retriever
        self._reranker = reranker
        self._connect = connect

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        try:
            queue_table = str(params["queue_table"])
            code_column = str(params.get("code_column", "local_code"))
            text_column = str(params.get("text_column", "local_code_text"))
            vocab_column = str(params.get("vocab_column", "coding_system"))
            limit = int(params.get("limit", 1000))
            output_name = str(params.get("output_artifact", "rerank_results.json"))
        except (KeyError, TypeError, ValueError) as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"ConceptMappingSuggesterNode: missing/invalid param ({exc})",
            )

        if context.db_dsn is None:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="ConceptMappingSuggesterNode requires context.db_dsn",
            )

        embedder = self._embedder or BgeEmbedder()
        retriever = self._retriever or ConceptRetriever()
        reranker = self._reranker or ConceptReranker(rerank_model="degraded@unwired")
        connect = self._connect
        if connect is None:  # pragma: no cover — real PG path
            import psycopg

            connect = psycopg.connect

        results: list[RerankResult] = []
        conn = connect(context.db_dsn)
        try:
            with conn.cursor() as cursor:
                rows = _select_unmapped(
                    cursor,
                    queue_table=queue_table,
                    code_column=code_column,
                    text_column=text_column,
                    vocab_column=vocab_column,
                    limit=limit,
                )
                for row in rows:
                    text = row.local_code_text or row.local_code
                    embeddings = embedder.embed([text])
                    if not embeddings:
                        continue
                    candidates = retriever.search(cursor, embeddings[0])
                    rr = reranker.rerank(
                        source_text=text,
                        source_code=row.local_code,
                        source_vocab=row.source_vocab,
                        candidates=candidates,
                    )
                    results.append(rr)
        finally:
            conn.close()

        payload = json.dumps([r.model_dump() for r in results], indent=2, default=str).encode(
            "utf-8"
        )
        context.write_artifact(output_name, payload)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={"rerank_count": len(results)},
            artifacts=[],  # path documented in outputs; full NodeArtifact list optional.
        )


__all__ = ["ConceptMappingSuggesterNode"]
