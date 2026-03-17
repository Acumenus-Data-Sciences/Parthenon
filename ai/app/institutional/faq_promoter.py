"""FAQ Auto-Promoter — automatically promote frequently-asked questions to FAQs.

Monitors question frequency across distinct users and, when a question crosses
a configurable threshold, inserts it into the institutional knowledge base as
a ``faq`` artifact so future users can benefit from the collective wisdom.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import text

logger = logging.getLogger(__name__)


class FAQPromoter:
    """Promote frequently-asked questions to the institutional knowledge base.

    Parameters
    ----------
    engine:
        SQLAlchemy engine (or compatible mock) providing ``engine.connect()``
        as a context manager.
    embedder:
        Optional sentence-transformer style object for generating embeddings
        when inserting FAQ artifacts.  When ``None``, artifacts are stored
        without vector embeddings.
    threshold:
        Minimum number of distinct users who must have asked a similar question
        before it is promoted to an FAQ artifact.  Defaults to the value of
        ``settings.institutional_faq_threshold`` (typically 3).
    """

    def __init__(
        self,
        engine: Any,
        embedder: Optional[Any] = None,
        threshold: Optional[int] = None,
    ) -> None:
        self._engine = engine
        self._embedder = embedder
        if threshold is None:
            from app.config import settings
            threshold = settings.institutional_faq_threshold
        self._threshold = threshold

    def check_and_promote(self, question: str, answer: str) -> bool:
        """Check if *question* has been asked enough times to warrant FAQ promotion.

        Counts distinct users in ``app.abby_messages`` (joined to conversations) whose
        question is similar to *question* (case-insensitive substring match via
        ILIKE).  If the count meets or exceeds :attr:`_threshold`, inserts a new
        ``faq`` artifact into ``app.abby_knowledge_artifacts``.

        Parameters
        ----------
        question:
            The question text to evaluate.
        answer:
            The answer to associate with the FAQ artifact if promoted.

        Returns
        -------
        bool
            ``True`` if the question was promoted to an FAQ, ``False`` otherwise.
        """
        # Strip to a keyword for the ILIKE pattern (first 100 chars)
        pattern = f"%{question[:100]}%"

        try:
            with self._engine.connect() as conn:
                row = conn.execute(
                    text(
                        """
                        SELECT COUNT(DISTINCT c.user_id)
                        FROM app.abby_messages m
                        JOIN app.abby_conversations c ON c.id = m.conversation_id
                        WHERE m.role = 'user'
                          AND m.content ILIKE :pattern
                        """
                    ),
                    {"pattern": pattern},
                ).fetchone()
                count = int(row[0]) if row else 0

            if count < self._threshold:
                return False

            # Promote to FAQ
            with self._engine.connect() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO app.abby_knowledge_artifacts
                            (type, title, summary, status)
                        VALUES
                            ('faq', :title, :summary, 'active')
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {
                        "title": question[:255],
                        "summary": answer[:1000],
                    },
                )
                conn.commit()
            logger.info(
                "FAQ promoted: question=%r (asked by %d distinct users)",
                question[:80],
                count,
            )
            return True

        except Exception:
            logger.exception("FAQ promotion check failed for question=%r", question[:80])
            return False

    def get_faqs(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return active FAQ artifacts from the institutional knowledge base.

        Parameters
        ----------
        limit:
            Maximum number of FAQs to return.

        Returns
        -------
        list[dict]
            Each item is a ``dict`` with artifact columns from
            ``app.abby_knowledge_artifacts`` where ``type = 'faq'`` and
            ``status = 'active'``.
        """
        try:
            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        """
                        SELECT id, type, title, summary, usage_count, status
                        FROM app.abby_knowledge_artifacts
                        WHERE type = 'faq'
                          AND status = 'active'
                        ORDER BY usage_count DESC
                        LIMIT :limit
                        """
                    ),
                    {"limit": limit},
                ).fetchall()
            return [dict(row._mapping) for row in rows]
        except Exception:
            logger.exception("get_faqs query failed")
            return []
