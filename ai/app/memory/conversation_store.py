"""PostgreSQL-backed conversation store with pgvector semantic search.

All SQL uses the ``app.`` schema prefix and ``sqlalchemy.text()`` for queries.
Methods degrade gracefully — exceptions are logged, not re-raised (callers get
empty results rather than a 500 error).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


@dataclass
class MessageResult:
    """A single message returned from a store query."""

    id: int
    role: str
    content: str
    distance: float | None = None
    conversation_id: int | None = None
    created_at: Any = None


class ConversationStore:
    """Stores conversation messages in PostgreSQL with pgvector embeddings.

    Parameters
    ----------
    engine:
        A SQLAlchemy ``Engine`` connected to the Parthenon PostgreSQL database.
    embedder:
        Any object exposing ``encode(texts: list[str]) -> list[list[float]]``.
        Typically a ``sentence_transformers.SentenceTransformer`` instance.
    embedding_dim:
        Dimensionality expected from the embedder (default 384 for all-MiniLM-L6-v2).
    """

    def __init__(
        self,
        engine: Engine,
        embedder: Any,
        embedding_dim: int = 384,
    ) -> None:
        self._engine = engine
        self._embedder = embedder
        self._embedding_dim = embedding_dim

    # ------------------------------------------------------------------
    # Write path
    # ------------------------------------------------------------------

    def store_message(
        self,
        *,
        conversation_id: int,
        role: str,
        content: str,
        user_id: int | None = None,
    ) -> None:
        """Embed ``content`` and persist the message to ``app.conversation_messages``.

        Uses a ctid sub-query pattern to avoid the PostgreSQL limitation that
        UPDATE does not support LIMIT.
        """
        try:
            embedding = self._embedder.encode([content])[0]
            embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

            with self._engine.connect() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO app.conversation_messages
                            (conversation_id, role, content, embedding, user_id)
                        VALUES
                            (:conversation_id, :role, :content, :embedding::vector, :user_id)
                        """
                    ),
                    {
                        "conversation_id": conversation_id,
                        "role": role,
                        "content": content,
                        "embedding": embedding_str,
                        "user_id": user_id,
                    },
                )
                conn.commit()
        except Exception:
            logger.exception(
                "ConversationStore.store_message failed for conversation_id=%s", conversation_id
            )

    # ------------------------------------------------------------------
    # Read paths
    # ------------------------------------------------------------------

    def search_similar(
        self,
        *,
        query: str,
        user_id: int,
        limit: int = 10,
        distance_threshold: float = 1.0,
    ) -> list[MessageResult]:
        """Return messages semantically similar to ``query`` using cosine distance.

        Results are ordered by ascending cosine distance (closer = more similar).
        """
        try:
            query_embedding = self._embedder.encode([query])[0]
            embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        """
                        SELECT
                            cm.id,
                            cm.role,
                            cm.content,
                            cm.embedding <=> :query_vec::vector AS distance,
                            cm.conversation_id
                        FROM app.conversation_messages cm
                        JOIN app.conversations c ON c.id = cm.conversation_id
                        WHERE c.user_id = :user_id
                          AND cm.embedding <=> :query_vec::vector < :threshold
                        ORDER BY distance ASC
                        LIMIT :limit
                        """
                    ),
                    {
                        "query_vec": embedding_str,
                        "user_id": user_id,
                        "threshold": distance_threshold,
                        "limit": limit,
                    },
                ).fetchall()

            return [
                MessageResult(
                    id=row[0],
                    role=row[1],
                    content=row[2],
                    distance=row[3],
                    conversation_id=row[4],
                )
                for row in rows
            ]
        except Exception:
            logger.exception("ConversationStore.search_similar failed for user_id=%s", user_id)
            return []

    def get_recent(
        self,
        *,
        user_id: int,
        limit: int = 20,
        conversation_id: int | None = None,
    ) -> list[MessageResult]:
        """Return the most recent messages for a user, newest first."""
        try:
            filters = "c.user_id = :user_id"
            params: dict[str, Any] = {"user_id": user_id, "limit": limit}

            if conversation_id is not None:
                filters += " AND cm.conversation_id = :conversation_id"
                params["conversation_id"] = conversation_id

            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        f"""
                        SELECT
                            cm.id,
                            cm.role,
                            cm.content,
                            cm.created_at
                        FROM app.conversation_messages cm
                        JOIN app.conversations c ON c.id = cm.conversation_id
                        WHERE {filters}
                        ORDER BY cm.created_at DESC
                        LIMIT :limit
                        """
                    ),
                    params,
                ).fetchall()

            return [
                MessageResult(
                    id=row[0],
                    role=row[1],
                    content=row[2],
                    created_at=row[3],
                )
                for row in rows
            ]
        except Exception:
            logger.exception("ConversationStore.get_recent failed for user_id=%s", user_id)
            return []
