"""
KnowledgeGraphService — OMOP concept hierarchy traversal with Redis caching.

Queries the vocabulary schema for concept hierarchies, relationships, and
siblings using concept_ancestor and concept_relationship tables.
"""

import json
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """Traverse OMOP concept hierarchies with Redis-backed caching."""

    def __init__(
        self,
        engine: Engine,
        redis_client: Any,
        vocab_schema: str = "vocab",
        cache_ttl: int = 3600,
        cache_prefix: str = "abby:kg:",
    ) -> None:
        self.engine = engine
        self.redis_client = redis_client
        self.vocab_schema = vocab_schema
        self.cache_ttl = cache_ttl
        self.cache_prefix = cache_prefix

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    def _cache_key(self, namespace: str, *parts: Any) -> str:
        key_parts = ":".join(str(p) for p in parts)
        return f"{self.cache_prefix}{namespace}:{key_parts}"

    def _get_cached(self, key: str) -> list[dict[str, Any]] | None:
        try:
            raw = self.redis_client.get(key)
            if raw is not None:
                return json.loads(raw)
        except Exception:
            logger.exception("Redis get failed for key %s", key)
        return None

    def _set_cached(self, key: str, value: list[dict[str, Any]]) -> None:
        try:
            self.redis_client.setex(key, self.cache_ttl, json.dumps(value))
        except Exception:
            logger.exception("Redis setex failed for key %s", key)

    # ------------------------------------------------------------------
    # Row conversion
    # ------------------------------------------------------------------

    def _row_to_dict(self, row: Any) -> dict[str, Any]:
        """Convert a SQLAlchemy Row to a plain dict."""
        return dict(zip(row.keys(), (row[k] for k in row.keys())))

    # ------------------------------------------------------------------
    # Concept lookup
    # ------------------------------------------------------------------

    def get_concept(self, concept_id: int) -> dict[str, Any] | None:
        """Return a single concept by ID, or None if not found."""
        key = self._cache_key("concept", concept_id)
        cached = self._get_cached(key)
        if cached is not None:
            return cached[0] if cached else None

        sql = text(
            f"SELECT concept_id, concept_name, domain_id, vocabulary_id, standard_concept"
            f" FROM {self.vocab_schema}.concept"
            f" WHERE concept_id = :cid"
        )
        try:
            with self.engine.connect() as conn:
                row = conn.execute(sql, {"cid": concept_id}).fetchone()
                if row is None:
                    self._set_cached(key, [])
                    return None
                result = self._row_to_dict(row)
                self._set_cached(key, [result])
                return result
        except Exception:
            logger.exception("get_concept failed for concept_id=%s", concept_id)
            return None

    # ------------------------------------------------------------------
    # Hierarchy traversal
    # ------------------------------------------------------------------

    def get_ancestors(
        self,
        concept_id: int,
        max_levels: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return ancestor concepts from concept_ancestor."""
        max_levels = max_levels if max_levels is not None else 999
        key = self._cache_key("ancestors", concept_id, max_levels)
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        sql = text(
            f"SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id, c.standard_concept"
            f" FROM {self.vocab_schema}.concept_ancestor ca"
            f" JOIN {self.vocab_schema}.concept c ON c.concept_id = ca.ancestor_concept_id"
            f" WHERE ca.descendant_concept_id = :cid"
            f"   AND ca.ancestor_concept_id != :cid"
            f"   AND ca.min_levels_of_separation <= :max_levels"
            f" ORDER BY ca.min_levels_of_separation"
        )
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql, {"cid": concept_id, "max_levels": max_levels})
                result = [self._row_to_dict(r) for r in rows]
                self._set_cached(key, result)
                return result
        except Exception:
            logger.exception("get_ancestors failed for concept_id=%s", concept_id)
            return []

    def get_descendants(
        self,
        concept_id: int,
        max_levels: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return descendant concepts from concept_ancestor, limited to 50."""
        max_levels = max_levels if max_levels is not None else 999
        key = self._cache_key("descendants", concept_id, max_levels)
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        sql = text(
            f"SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id, c.standard_concept"
            f" FROM {self.vocab_schema}.concept_ancestor ca"
            f" JOIN {self.vocab_schema}.concept c ON c.concept_id = ca.descendant_concept_id"
            f" WHERE ca.ancestor_concept_id = :cid"
            f"   AND ca.descendant_concept_id != :cid"
            f"   AND ca.min_levels_of_separation <= :max_levels"
            f" ORDER BY ca.min_levels_of_separation"
            f" LIMIT 50"
        )
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql, {"cid": concept_id, "max_levels": max_levels})
                result = [self._row_to_dict(r) for r in rows]
                self._set_cached(key, result)
                return result
        except Exception:
            logger.exception("get_descendants failed for concept_id=%s", concept_id)
            return []

    def get_siblings(self, concept_id: int) -> list[dict[str, Any]]:
        """Return sibling concepts (same direct parent)."""
        key = self._cache_key("siblings", concept_id)
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        try:
            parents = self.get_ancestors(concept_id, max_levels=1)
            if not parents:
                self._set_cached(key, [])
                return []

            parent_id = parents[0]["concept_id"]
            siblings = self.get_descendants(parent_id, max_levels=1)
            # Exclude the concept itself
            result = [s for s in siblings if s["concept_id"] != concept_id]
            self._set_cached(key, result)
            return result
        except Exception:
            logger.exception("get_siblings failed for concept_id=%s", concept_id)
            return []

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    def find_related(
        self,
        concept_id: int,
        relationship_types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Return related concepts via concept_relationship."""
        rel_key = ":".join(sorted(relationship_types or []))
        key = self._cache_key("related", concept_id, rel_key)
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        type_clause = ""
        params: dict[str, Any] = {"cid": concept_id}
        if relationship_types:
            placeholders = ", ".join(f":rt{i}" for i in range(len(relationship_types)))
            type_clause = f" AND cr.relationship_id IN ({placeholders})"
            for i, rt in enumerate(relationship_types):
                params[f"rt{i}"] = rt

        sql = text(
            f"SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id,"
            f"       c.standard_concept, cr.relationship_id"
            f" FROM {self.vocab_schema}.concept_relationship cr"
            f" JOIN {self.vocab_schema}.concept c ON c.concept_id = cr.concept_id_2"
            f" WHERE cr.concept_id_1 = :cid"
            f"   AND cr.invalid_reason IS NULL"
            f"{type_clause}"
        )
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql, params)
                result = [self._row_to_dict(r) for r in rows]
                self._set_cached(key, result)
                return result
        except Exception:
            logger.exception("find_related failed for concept_id=%s", concept_id)
            return []

    # ------------------------------------------------------------------
    # Formatting helpers for LLM prompts
    # ------------------------------------------------------------------

    def format_hierarchy(
        self,
        concepts: list[dict[str, Any]],
        direction: str = "ancestors",
    ) -> str:
        """Produce readable text for a concept hierarchy."""
        if not concepts:
            return f"No {direction} found."

        lines = [f"Concept {direction}:"]
        for i, c in enumerate(concepts, start=1):
            name = c.get("concept_name", "Unknown")
            cid = c.get("concept_id", "")
            domain = c.get("domain_id", "")
            lines.append(f"  {i}. {name} (ID: {cid}, Domain: {domain})")
        return "\n".join(lines)

    def format_related(self, concepts: list[dict[str, Any]]) -> str:
        """Produce readable text for related concepts."""
        if not concepts:
            return "No related concepts found."

        lines = ["Related concepts:"]
        for i, c in enumerate(concepts, start=1):
            name = c.get("concept_name", "Unknown")
            cid = c.get("concept_id", "")
            rel = c.get("relationship_id", "")
            domain = c.get("domain_id", "")
            lines.append(f"  {i}. {name} (ID: {cid}, Relationship: {rel}, Domain: {domain})")
        return "\n".join(lines)
