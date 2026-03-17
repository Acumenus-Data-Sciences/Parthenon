"""Knowledge Surfacing — contextual retrieval of institutional knowledge artifacts.

Wraps KnowledgeCapture to provide a query-time interface for surfacing relevant
artifacts from the institutional knowledge base, filtered by semantic distance.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class KnowledgeSurfacer:
    """Surface relevant institutional knowledge artifacts for a given query.

    Parameters
    ----------
    knowledge_capture:
        A :class:`~app.institutional.knowledge_capture.KnowledgeCapture` instance
        used for similarity search.
    """

    def __init__(self, knowledge_capture: Any) -> None:
        self._knowledge_capture = knowledge_capture

    def suggest(
        self,
        query: str,
        max_results: int = 5,
        max_distance: float = 0.5,
    ) -> list[dict[str, Any]]:
        """Return institutional artifacts semantically similar to *query*.

        Delegates to :meth:`KnowledgeCapture.search_similar` and filters out
        results whose ``distance`` field exceeds *max_distance*.

        Parameters
        ----------
        query:
            Natural-language query describing the current user intent.
        max_results:
            Maximum number of results to request from the search backend.
        max_distance:
            Maximum cosine distance (0–1) allowed.  Results with
            ``distance > max_distance`` are discarded.

        Returns
        -------
        list[dict]
            Filtered list of artifact dicts, ordered by similarity.
        """
        try:
            raw = self._knowledge_capture.search_similar(query, limit=max_results)
        except Exception:
            logger.exception("search_similar failed for query=%r", query[:80])
            return []

        return [r for r in raw if r.get("distance", 0.0) <= max_distance]

    def format_for_prompt(self, suggestions: list[dict[str, Any]]) -> str:
        """Format a list of artifact suggestions for inclusion in a system prompt.

        Parameters
        ----------
        suggestions:
            List of artifact dicts as returned by :meth:`suggest`.

        Returns
        -------
        str
            A formatted block with an ``INSTITUTIONAL KNOWLEDGE`` header and
            one entry per artifact showing its type, title, summary, and
            usage count.
        """
        if not suggestions:
            return ""

        lines: list[str] = [
            "INSTITUTIONAL KNOWLEDGE (from other researchers):",
        ]
        for artifact in suggestions:
            artifact_type = artifact.get("type", "unknown")
            title = artifact.get("title", "Untitled")
            summary = artifact.get("summary", "")
            usage_count = artifact.get("usage_count", 0)
            lines.append(
                f"  [{artifact_type}] {title} — {summary} (used {usage_count}x)"
            )

        return "\n".join(lines)
