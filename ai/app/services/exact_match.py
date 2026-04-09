"""Exact match strategy for concept mapping.

Looks up source codes directly in vocab.concept and
vocab.source_to_concept_map tables. Returns high-confidence results
for exact code matches.
"""

import logging

from sqlalchemy import text

from app.db import get_engine
from app.models.schemas import ConceptCandidate

logger = logging.getLogger(__name__)

STRATEGY_NAME = "exact_code_match"


class ExactMatchStrategy:
    """Match source codes exactly against OMOP vocabulary tables."""

    async def match(
        self,
        source_code: str,
        source_vocabulary_id: str | None = None,
    ) -> list[ConceptCandidate]:
        """Find concepts by exact code match.

        Searches vocab.concept for an exact concept_code match
        (case-insensitive) and also checks vocab.source_to_concept_map
        for mapped equivalents.

        Args:
            source_code: The source code to look up.
            source_vocabulary_id: Optional vocabulary filter.

        Returns:
            List of ConceptCandidate with score 1.0 for standard
            concepts and 0.95 for non-standard.
        """
        candidates: list[ConceptCandidate] = []

        try:
            engine = get_engine()

            # --- Direct concept code lookup ---
            concept_params: dict[str, str | int] = {"code": source_code}
            concept_query = """
                SELECT
                    c.concept_id,
                    c.concept_name,
                    c.domain_id,
                    c.vocabulary_id,
                    c.standard_concept
                FROM vocab.concept c
                WHERE LOWER(c.concept_code) = LOWER(:code)
            """
            if source_vocabulary_id is not None:
                concept_query += " AND LOWER(c.vocabulary_id) = LOWER(:vocab_id)"
                concept_params["vocab_id"] = source_vocabulary_id

            concept_query += " LIMIT 20"

            with engine.connect() as conn:
                rows = conn.execute(text(concept_query), concept_params)
                for row in rows:
                    score = 1.0 if row.standard_concept == "S" else 0.95
                    candidates.append(
                        ConceptCandidate(
                            concept_id=row.concept_id,
                            concept_name=row.concept_name,
                            domain_id=row.domain_id,
                            vocabulary_id=row.vocabulary_id,
                            score=score,
                            strategy=STRATEGY_NAME,
                        )
                    )

            # --- Source-to-concept map lookup ---
            stcm_params: dict[str, str | int] = {"code": source_code}
            stcm_query = """
                SELECT
                    c.concept_id,
                    c.concept_name,
                    c.domain_id,
                    c.vocabulary_id,
                    c.standard_concept
                FROM vocab.source_to_concept_map stcm
                JOIN vocab.concept c ON c.concept_id = stcm.target_concept_id
                WHERE LOWER(stcm.source_code) = LOWER(:code)
            """
            if source_vocabulary_id is not None:
                stcm_query += (
                    " AND LOWER(stcm.source_vocabulary_id) = LOWER(:vocab_id)"
                )
                stcm_params["vocab_id"] = source_vocabulary_id

            stcm_query += " LIMIT 20"

            seen_ids = {c.concept_id for c in candidates}

            with engine.connect() as conn:
                rows = conn.execute(text(stcm_query), stcm_params)
                for row in rows:
                    if row.concept_id in seen_ids:
                        continue
                    seen_ids.add(row.concept_id)
                    score = 1.0 if row.standard_concept == "S" else 0.95
                    candidates.append(
                        ConceptCandidate(
                            concept_id=row.concept_id,
                            concept_name=row.concept_name,
                            domain_id=row.domain_id,
                            vocabulary_id=row.vocabulary_id,
                            score=score,
                            strategy=STRATEGY_NAME,
                        )
                    )

        except Exception:
            logger.exception("Exact match lookup failed for code=%s", source_code)

        return candidates
