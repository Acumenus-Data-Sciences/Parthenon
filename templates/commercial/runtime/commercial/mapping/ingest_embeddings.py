"""Concept embedding ingest job.

Phase 3 Plan 6 Task 5 (T-024A). Commercial-tier (proprietary). Walks
``vocab.concept`` in batches of N, embeds ``concept_name`` via
``BgeEmbedder`` (Task 2), and INSERTs / UPDATEs into
``vocab.concept_embedding_bge`` (Task 4 schema).

Behavior:

- Idempotent on re-run: rows already embedded with the same model name
  are skipped via a NOT EXISTS subquery in the source query, so the job
  resumes mid-flight after an interrupted run.
- ``--vocabulary`` filter: restrict to specific source vocabularies
  (default: all standard concepts). Plan-driven default set covers the
  vocabularies that drive the Plan 5 unmapped queue: SNOMED, RxNorm,
  LOINC, ATC, HCPCS.
- Throughput target (per plan): ~1M concepts in <1 hour on a single A10
  GPU. CPU-only fallback runs slower but still completes.

CLI:

    python -m runtime.commercial.mapping.ingest_embeddings \\
        --vocabulary SNOMED RxNorm LOINC ATC HCPCS \\
        --batch-size 1024
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from typing import Any, Protocol, cast, runtime_checkable

from runtime.commercial.mapping.embedder import BgeEmbedder

_LOGGER = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = 1024
DEFAULT_VOCABULARIES = ("SNOMED", "RxNorm", "LOINC", "ATC", "HCPCS")


@dataclass(frozen=True)
class _ConceptRow:
    concept_id: int
    concept_name: str


@dataclass(frozen=True)
class IngestStats:
    """Result of a run; useful for tests + scheduled-run reporting."""

    total_seen: int
    total_embedded: int
    total_skipped: int
    batches: int


# ---------------------------------------------------------------------------
# Cursor and connection abstractions
# ---------------------------------------------------------------------------


@runtime_checkable
class _CursorProtocol(Protocol):
    """Subset of psycopg.Cursor we touch — defined for typing + duck-check."""

    def execute(self, query: str, params: tuple[Any, ...] = ...) -> Any: ...

    def executemany(self, query: str, params_list: list[tuple[Any, ...]]) -> Any: ...

    def __iter__(self) -> Iterator[tuple[Any, ...]]: ...


def _select_unmapped_concepts(
    cursor: _CursorProtocol, vocabularies: tuple[str, ...], model_name: str, batch_size: int
) -> Iterable[_ConceptRow]:
    """Stream (concept_id, concept_name) for standard concepts not yet embedded.

    The NOT EXISTS predicate makes the run idempotent — resume picks up
    where it left off after a crash.
    """
    sql = """
        SELECT c.concept_id, c.concept_name
        FROM vocab.concept c
        WHERE c.standard_concept = 'S'
          AND c.invalid_reason IS NULL
          AND c.vocabulary_id = ANY(%s)
          AND NOT EXISTS (
              SELECT 1
              FROM vocab.concept_embedding_bge e
              WHERE e.concept_id = c.concept_id
                AND e.model_name = %s
          )
        ORDER BY c.concept_id
    """
    cursor.execute(sql, (list(vocabularies), model_name))
    for row in cursor:
        cid, name = row[0], row[1]
        yield _ConceptRow(concept_id=int(cid), concept_name=str(name))


def _upsert_embeddings(cursor: _CursorProtocol, rows: list[tuple[int, str, str]]) -> None:
    """Bulk UPSERT (concept_id, embedding_literal, model_name) rows.

    The embedding is passed as a pgvector literal string ``'[0.1,0.2,...]'``
    so the call doesn't need the ``psycopg-pgvector`` adapter installed.
    """
    if not rows:
        return
    cursor.executemany(
        """
        INSERT INTO vocab.concept_embedding_bge (concept_id, embedding, model_name)
        VALUES (%s, %s::vector, %s)
        ON CONFLICT (concept_id) DO UPDATE
        SET embedding   = EXCLUDED.embedding,
            model_name  = EXCLUDED.model_name,
            embedded_at = NOW()
        """,
        rows,
    )


def _vector_literal(embedding: list[float]) -> str:
    """Render a list of floats as pgvector's bracket syntax."""
    return "[" + ",".join(f"{x:.7f}" for x in embedding) + "]"


def _chunked(iterable: Iterable[_ConceptRow], size: int) -> Iterator[list[_ConceptRow]]:
    batch: list[_ConceptRow] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def run_ingest(
    *,
    cursor: _CursorProtocol,
    embedder: BgeEmbedder,
    vocabularies: tuple[str, ...] = DEFAULT_VOCABULARIES,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> IngestStats:
    """Run the ingest pipeline against an open cursor.

    Pure: caller controls connection lifetime and commit cadence.
    """
    total_seen = 0
    total_embedded = 0
    batches = 0

    rows = _select_unmapped_concepts(cursor, vocabularies, embedder.model_name, batch_size)
    for batch in _chunked(rows, batch_size):
        total_seen += len(batch)
        texts = [r.concept_name for r in batch]
        vectors = embedder.embed(texts)
        upsert_rows: list[tuple[int, str, str]] = [
            (r.concept_id, _vector_literal(v), embedder.model_name)
            for r, v in zip(batch, vectors, strict=True)
        ]
        _upsert_embeddings(cursor, upsert_rows)
        total_embedded += len(upsert_rows)
        batches += 1
        _LOGGER.info(
            "concept_embedding_bge: batch %d, +%d rows (cumulative %d)",
            batches,
            len(upsert_rows),
            total_embedded,
        )

    return IngestStats(
        total_seen=total_seen,
        total_embedded=total_embedded,
        total_skipped=total_seen - total_embedded,
        batches=batches,
    )


def main(
    argv: list[str] | None = None,
    *,
    connect: Callable[[str], Any] | None = None,
    embedder: BgeEmbedder | None = None,
) -> int:
    """CLI entry point.

    ``connect`` and ``embedder`` are injectable so tests can pass a fake
    connection factory and a stub embedder without a live PG or pulling
    the ~430 MB bge-base weights.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--vocabulary",
        nargs="+",
        default=list(DEFAULT_VOCABULARIES),
        help="Restrict ingest to these source vocabularies (default: all 5 plan defaults).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Concepts per embedding+upsert batch (default: 1024).",
    )
    parser.add_argument(
        "--model-name",
        default=BgeEmbedder.DEFAULT_MODEL,
        help="sentence-transformers model name (default: BAAI/bge-base-en-v1.5).",
    )
    parser.add_argument(
        "--db-url",
        default=os.environ.get("PARTHENON_DB_URL"),
        help="psycopg DSN; default $PARTHENON_DB_URL.",
    )
    args = parser.parse_args(argv)

    if not args.db_url:
        parser.error("--db-url (or $PARTHENON_DB_URL) is required")

    logging.basicConfig(level=logging.INFO)
    if embedder is None:
        embedder = BgeEmbedder(args.model_name)

    if connect is None:  # pragma: no cover — real PG path
        import psycopg

        connect = psycopg.connect

    conn = cast(Any, connect(args.db_url))
    try:
        with conn.cursor() as cursor:
            stats = run_ingest(
                cursor=cursor,
                embedder=embedder,
                vocabularies=tuple(args.vocabulary),
                batch_size=args.batch_size,
            )
        conn.commit()
    finally:
        conn.close()

    _LOGGER.info(
        "concept_embedding_bge ingest done: seen=%d, embedded=%d, batches=%d",
        stats.total_seen,
        stats.total_embedded,
        stats.batches,
    )
    return 0


__all__ = ["IngestStats", "main", "run_ingest"]


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
