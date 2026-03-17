"""Migration bridge — dual-read from PostgreSQL and ChromaDB during transition.

While the system migrates conversation history from ChromaDB to PostgreSQL,
this bridge provides a unified search interface:

1. Always queries PostgreSQL first (the target store).
2. If PostgreSQL returns no results AND ``dual_read`` is True, falls back to
   the legacy ChromaDB query function.
3. Merges results from both sources, deduplicating by exact content match.

Once the migration is complete, set ``dual_read=False`` to disable the
ChromaDB fallback and route all traffic to PostgreSQL exclusively.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Unified result from either PostgreSQL or ChromaDB."""

    content: str
    distance: float
    role: str = "unknown"
    source: str = "postgres"  # "postgres" | "chroma"


class MigrationBridge:
    """Unified search over PostgreSQL (primary) and ChromaDB (legacy fallback).

    Parameters
    ----------
    pg_store:
        A ``ConversationStore`` instance (or any object with a
        ``search_similar(query, user_id, limit) -> list`` method).
    chroma_query_fn:
        A callable ``(query: str, limit: int) -> list[dict]`` that queries
        the legacy ChromaDB collection.  Each dict must have a ``"content"``
        key; ``"distance"`` and ``"role"`` are optional.
    dual_read:
        When True, fall back to ChromaDB if PostgreSQL returns no results.
        Set to False after migration is verified complete.
    """

    def __init__(
        self,
        pg_store: Any,
        chroma_query_fn: Callable[[str, int], list[dict[str, Any]]],
        dual_read: bool = True,
    ) -> None:
        self._pg_store = pg_store
        self._chroma_query_fn = chroma_query_fn
        self.dual_read = dual_read

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(
        self,
        *,
        query: str,
        user_id: int,
        limit: int = 10,
    ) -> list[SearchResult]:
        """Return deduplicated results from PostgreSQL and optionally ChromaDB."""
        results: list[SearchResult] = []

        # --- Primary: PostgreSQL ---
        try:
            pg_rows = self._pg_store.search_similar(
                query=query, user_id=user_id, limit=limit
            )
            for row in pg_rows:
                results.append(
                    SearchResult(
                        content=row.content,
                        distance=float(row.distance) if row.distance is not None else 0.0,
                        role=getattr(row, "role", "unknown"),
                        source="postgres",
                    )
                )
        except Exception:
            logger.exception("MigrationBridge: PostgreSQL query failed")

        # --- Fallback: ChromaDB (only when dual_read and pg returned nothing) ---
        if self.dual_read and not results:
            try:
                chroma_rows = self._chroma_query_fn(query, limit)
                for row in chroma_rows:
                    results.append(
                        SearchResult(
                            content=row.get("content", ""),
                            distance=float(row.get("distance", 0.0)),
                            role=row.get("role", "unknown"),
                            source="chroma",
                        )
                    )
            except Exception:
                logger.exception("MigrationBridge: ChromaDB fallback query failed")

        return self._deduplicate(results)

    # ------------------------------------------------------------------
    # Deduplication
    # ------------------------------------------------------------------

    @staticmethod
    def _deduplicate(results: list[SearchResult]) -> list[SearchResult]:
        """Remove duplicate entries by exact content equality.

        When duplicates exist, the entry with the lower (better) distance
        is kept.  PostgreSQL results naturally take precedence because they
        are inserted first (lower distance wins if values differ).
        """
        seen: dict[str, SearchResult] = {}
        for result in results:
            key = result.content
            if key not in seen or result.distance < seen[key].distance:
                seen[key] = result
        return list(seen.values())
