"""Knowledge Capture Pipeline — automatic artifact extraction from user interactions.

Records cohort patterns, analysis configurations, user corrections, and data
quality findings into the institutional knowledge base. Artifacts are stored
with vector embeddings to enable semantic similarity search.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy import text

logger = logging.getLogger(__name__)


@dataclass
class KnowledgeArtifact:
    """Represents a captured knowledge artifact.

    Attributes
    ----------
    artifact_type:
        Category of the artifact, e.g. ``"cohort_pattern"`` or
        ``"analysis_config"``.
    title:
        Short human-readable title for the artifact.
    summary:
        Longer description of what was learned.
    tags:
        List of keyword tags for filtering.
    disease_area:
        Disease/therapeutic area this artifact relates to.
    artifact_data:
        Raw structured data captured from the interaction.
    """

    artifact_type: str
    title: str
    summary: str
    tags: list[str] = field(default_factory=list)
    disease_area: str = ""
    artifact_data: dict[str, Any] = field(default_factory=dict)


class KnowledgeCapture:
    """Capture and retrieve institutional knowledge artifacts.

    Parameters
    ----------
    engine:
        SQLAlchemy engine (or compatible mock) providing ``engine.connect()``
        as a context manager.
    embedder:
        Optional sentence-transformer style object with an ``encode(text)``
        method.  When provided, embeddings are stored alongside artifacts and
        similarity search is enabled.
    """

    def __init__(self, engine: Any, embedder: Optional[Any] = None) -> None:
        self._engine = engine
        self._embedder = embedder

    # ------------------------------------------------------------------
    # Public capture methods
    # ------------------------------------------------------------------

    def capture_cohort_creation(
        self,
        *,
        user_id: int,
        cohort_name: str,
        disease_area: str = "",
        cohort_data: Optional[dict[str, Any]] = None,
        concept_ids: Optional[list[int]] = None,
        expression_summary: Optional[str] = None,
        tags: Optional[list[str]] = None,
        source_conversation_id: Optional[int] = None,
    ) -> KnowledgeArtifact:
        """Capture a cohort definition as a ``cohort_pattern`` artifact.

        Parameters
        ----------
        user_id:
            ID of the user who created the cohort.
        cohort_name:
            Human-readable name for the cohort.
        disease_area:
            Disease/therapeutic area of the cohort.
        cohort_data:
            Full cohort definition data (concept IDs, inclusion rules, etc.).
        tags:
            Optional keyword tags.
        source_conversation_id:
            ID of the Abby conversation that triggered this capture.

        Returns
        -------
        KnowledgeArtifact
            The created artifact with ``artifact_type == "cohort_pattern"``.
        """
        # Build cohort_data from explicit fields if not provided directly
        resolved_data: dict[str, Any] = cohort_data or {}
        if concept_ids is not None:
            resolved_data = {**resolved_data, "concept_ids": concept_ids}
        if expression_summary is not None:
            resolved_data = {**resolved_data, "expression_summary": expression_summary}

        summary = f"Cohort definition for {cohort_name}"
        if disease_area:
            summary += f" in {disease_area}"
        if expression_summary:
            summary += f". {expression_summary}"

        artifact = KnowledgeArtifact(
            artifact_type="cohort_pattern",
            title=cohort_name,
            summary=summary,
            tags=tags or [],
            disease_area=disease_area,
            artifact_data=resolved_data,
        )
        self._store(
            artifact=artifact,
            user_id=user_id,
            source_conversation_id=source_conversation_id,
        )
        return artifact

    def capture_analysis_completion(
        self,
        *,
        user_id: int,
        analysis_name: str,
        study_design: str,
        disease_area: str,
        analysis_data: dict[str, Any],
        tags: Optional[list[str]] = None,
        source_conversation_id: Optional[int] = None,
    ) -> KnowledgeArtifact:
        """Capture a completed analysis configuration as an ``analysis_config`` artifact.

        Parameters
        ----------
        user_id:
            ID of the user who ran the analysis.
        analysis_name:
            Human-readable name for the analysis.
        study_design:
            Study design type, e.g. ``"cohort"``, ``"self_controlled"``.
        disease_area:
            Disease/therapeutic area.
        analysis_data:
            Analysis parameters (target/comparator/outcome IDs, settings, etc.).
        tags:
            Optional keyword tags.
        source_conversation_id:
            ID of the Abby conversation that triggered this capture.

        Returns
        -------
        KnowledgeArtifact
            The created artifact with ``artifact_type == "analysis_config"``.
        """
        artifact = KnowledgeArtifact(
            artifact_type="analysis_config",
            title=analysis_name,
            summary=f"{study_design} analysis configuration for {analysis_name} in {disease_area}",
            tags=tags or [],
            disease_area=disease_area,
            artifact_data=analysis_data,
        )
        self._store(
            artifact=artifact,
            user_id=user_id,
            study_design=study_design,
            source_conversation_id=source_conversation_id,
        )
        return artifact

    def capture_correction(
        self,
        *,
        user_id: int,
        original_response: str,
        correction: str,
        context: Optional[dict[str, Any]] = None,
        applied_globally: bool = False,
    ) -> int:
        """Record a user correction to an Abby response.

        Parameters
        ----------
        user_id:
            ID of the user who provided the correction.
        original_response:
            The text of Abby's original (incorrect) response.
        correction:
            The user's corrected version.
        context:
            Optional metadata (conversation ID, turn number, etc.).
        applied_globally:
            Whether this correction should be applied across all users.

        Returns
        -------
        int
            The ``id`` of the newly inserted correction row.
        """
        params: dict[str, Any] = {
            "user_id": user_id,
            "original_response": original_response,
            "correction": correction,
            "context": json.dumps(context) if context is not None else None,
            "applied_globally": applied_globally,
        }
        with self._engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO app.abby_corrections
                        (user_id, original_response, correction, context, applied_globally)
                    VALUES
                        (:user_id, :original_response, :correction,
                         :context::jsonb, :applied_globally)
                    RETURNING id
                    """
                ),
                params,
            ).fetchone()
        return int(row[0])

    def capture_data_finding(
        self,
        *,
        discovered_by: int,
        affected_domain: str,
        affected_tables: list[str],
        finding_summary: str,
        severity: str = "info",
        workaround: Optional[str] = None,
        verified: bool = False,
    ) -> int:
        """Record a data quality finding discovered during analysis.

        Parameters
        ----------
        discovered_by:
            User ID of the person who discovered the finding.
        affected_domain:
            Domain or CDM table group affected, e.g. ``"condition_occurrence"``.
        affected_tables:
            List of fully-qualified table names involved.
        finding_summary:
            Human-readable description of the data quality issue.
        severity:
            One of ``"info"``, ``"warning"``, or ``"error"``.
        workaround:
            Optional description of a known workaround.
        verified:
            Whether the finding has been independently verified.

        Returns
        -------
        int
            The ``id`` of the newly inserted finding row.
        """
        params: dict[str, Any] = {
            "discovered_by": discovered_by,
            "affected_domain": affected_domain,
            "affected_tables": affected_tables,
            "finding_summary": finding_summary,
            "severity": severity,
            "workaround": workaround,
            "verified": verified,
        }
        with self._engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO app.abby_data_findings
                        (discovered_by, affected_domain, affected_tables,
                         finding_summary, severity, workaround, verified)
                    VALUES
                        (:discovered_by, :affected_domain, :affected_tables,
                         :finding_summary, :severity, :workaround, :verified)
                    RETURNING id
                    """
                ),
                params,
            ).fetchone()
        return int(row[0])

    def search_similar(
        self,
        query: str,
        limit: int = 5,
        artifact_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Find knowledge artifacts similar to a query using pgvector cosine distance.

        When no embedder is configured, falls back to an empty result set.

        Parameters
        ----------
        query:
            Natural-language query to find similar artifacts for.
        limit:
            Maximum number of results to return.
        artifact_type:
            Optional filter to restrict results to a specific type.

        Returns
        -------
        list[dict]
            Each item is a ``dict`` with artifact columns, ordered by similarity.
        """
        if self._embedder is None:
            logger.warning("search_similar called without an embedder — returning empty list")
            return []

        embedding = self._embed(query)
        embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

        type_filter = "AND type = :artifact_type" if artifact_type else ""
        params: dict[str, Any] = {
            "embedding": embedding_str,
            "limit": limit,
        }
        if artifact_type:
            params["artifact_type"] = artifact_type

        try:
            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        f"""
                        SELECT id, type, title, summary, tags, disease_area,
                               study_design, artifact_data, usage_count,
                               accuracy_score, status, created_at
                        FROM app.abby_knowledge_artifacts
                        WHERE status = 'active'
                        {type_filter}
                        ORDER BY embedding <=> :embedding::vector
                        LIMIT :limit
                        """
                    ),
                    params,
                ).fetchall()
            return [dict(row._mapping) for row in rows]
        except Exception:
            logger.exception("Failed to execute similarity search for query=%r", query)
            return []

    def increment_usage(self, artifact_id: int) -> None:
        """Increment the usage counter for a knowledge artifact.

        Parameters
        ----------
        artifact_id:
            Primary key of the artifact to update.
        """
        with self._engine.connect() as conn:
            conn.execute(
                text(
                    """
                    UPDATE app.abby_knowledge_artifacts
                    SET usage_count = usage_count + 1
                    WHERE id = :artifact_id
                    """
                ),
                {"artifact_id": artifact_id},
            )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _store(
        self,
        *,
        artifact: KnowledgeArtifact,
        user_id: int,
        study_design: Optional[str] = None,
        source_conversation_id: Optional[int] = None,
    ) -> int:
        """INSERT a knowledge artifact row and return the generated ``id``.

        Parameters
        ----------
        artifact:
            The artifact to store.
        user_id:
            ID of the user who produced this artifact.
        study_design:
            Optional study design type for analysis artifacts.
        source_conversation_id:
            Optional conversation that triggered the artifact capture.

        Returns
        -------
        int
            The ``id`` of the newly inserted row.
        """
        embedding = self._embed(artifact.title + " " + artifact.summary) if self._embedder else None
        embedding_str: Optional[str] = None
        if embedding is not None:
            embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

        params: dict[str, Any] = {
            "type": artifact.artifact_type,
            "title": artifact.title,
            "summary": artifact.summary,
            "tags": artifact.tags,
            "disease_area": artifact.disease_area or None,
            "study_design": study_design,
            "created_by": user_id,
            "source_conversation_id": source_conversation_id,
            "artifact_data": json.dumps(artifact.artifact_data),
            "embedding": embedding_str,
        }

        with self._engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO app.abby_knowledge_artifacts
                        (type, title, summary, tags, disease_area, study_design,
                         created_by, source_conversation_id, artifact_data, embedding)
                    VALUES
                        (:type, :title, :summary, :tags, :disease_area, :study_design,
                         :created_by, :source_conversation_id,
                         :artifact_data::jsonb,
                         CASE WHEN :embedding IS NULL THEN NULL
                              ELSE :embedding::vector END)
                    RETURNING id
                    """
                ),
                params,
            ).fetchone()
        return int(row[0])

    def _embed(self, text_input: str) -> Optional[list[float]]:
        """Generate an embedding vector for ``text_input``.

        Returns ``None`` if no embedder is configured.

        Parameters
        ----------
        text_input:
            The text to encode into a vector.

        Returns
        -------
        list[float] or None
        """
        if self._embedder is None:
            return None
        try:
            result = self._embedder.encode(text_input)
            # Convert numpy arrays or other iterables to plain list
            return list(result)
        except Exception:
            logger.exception("Embedding failed for input=%r", text_input[:100])
            return None
