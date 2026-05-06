"""``ConceptRetriever`` — pgvector top-K cosine search over bge-base embeddings.

Phase 3 Plan 6 Task 6 (T-024A). Commercial-tier (proprietary). Wraps the
``vocab.concept_embedding_bge`` table (Task 4) so callers feed a query
embedding and get back ranked ``ConceptCandidate`` rows.

The retriever is deliberately stateless — caller manages the cursor and
connection. Pair it with ``BgeEmbedder`` to embed the query first, then
hand the vector here.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any, Protocol, runtime_checkable

from runtime.commercial.mapping.types import ConceptCandidate


@runtime_checkable
class _CursorProtocol(Protocol):
    """Subset of psycopg.Cursor used by the retriever."""

    def execute(self, query: str, params: tuple[Any, ...] = ...) -> Any: ...

    def fetchall(self) -> list[tuple[Any, ...]]: ...

    def __iter__(self) -> Iterator[tuple[Any, ...]]: ...


def _vector_literal(embedding: list[float]) -> str:
    """Render a list of floats as pgvector's bracket syntax for parameter bind."""
    return "[" + ",".join(f"{x:.7f}" for x in embedding) + "]"


class ConceptRetriever:
    """pgvector top-K cosine search wrapper."""

    type_name = "concept_retriever"

    DEFAULT_TOP_K = 50

    def search(
        self,
        cursor: _CursorProtocol,
        query_embedding: list[float],
        *,
        top_k: int = DEFAULT_TOP_K,
        domain_filter: str | None = None,
        vocabulary_filter: list[str] | None = None,
    ) -> list[ConceptCandidate]:
        """Return up to ``top_k`` ranked ConceptCandidate rows.

        Joins ``vocab.concept_embedding_bge`` to ``vocab.concept`` and uses
        the cosine-distance operator (``<=>``) ascending for nearest first.
        ``similarity = 1 - distance`` so the candidate's ``similarity`` field
        is a [0, 1] cosine score consumable by the rerank prompt (Task 7/8).

        Filters:

        - ``domain_filter``: if set, only candidates with that ``domain_id``
          (e.g. ``'Measurement'`` for lab harmonization).
        - ``vocabulary_filter``: if set, only candidates from those source
          vocabularies (e.g. ``['LOINC']`` to constrain lab queries).

        Standard concepts only — ``standard_concept = 'S'`` is always applied.
        """
        if top_k < 1:
            raise ValueError(f"top_k must be >= 1; got {top_k}")
        if len(query_embedding) == 0:
            raise ValueError("query_embedding must be non-empty")

        sql = """
            SELECT
                c.concept_id,
                c.concept_name,
                c.vocabulary_id,
                c.domain_id,
                COALESCE(c.standard_concept, '') AS standard_concept,
                1 - (e.embedding <=> %s::vector) AS similarity
            FROM vocab.concept_embedding_bge e
            JOIN vocab.concept c USING (concept_id)
            WHERE c.standard_concept = 'S'
              AND c.invalid_reason IS NULL
              AND (%s::text IS NULL OR c.domain_id = %s)
              AND (%s::text[] IS NULL OR c.vocabulary_id = ANY(%s))
            ORDER BY e.embedding <=> %s::vector
            LIMIT %s
        """
        vec = _vector_literal(query_embedding)
        cursor.execute(
            sql,
            (
                vec,
                domain_filter,
                domain_filter,
                vocabulary_filter,
                vocabulary_filter,
                vec,
                top_k,
            ),
        )

        out: list[ConceptCandidate] = []
        for row in cursor.fetchall():
            cid, cname, vid, did, std, sim = row
            out.append(
                ConceptCandidate(
                    concept_id=int(cid),
                    concept_name=str(cname),
                    vocabulary_id=str(vid),
                    domain_id=str(did),
                    standard_concept=str(std),
                    similarity=max(0.0, min(1.0, float(sim))),
                )
            )
        return out


__all__ = ["ConceptRetriever"]
