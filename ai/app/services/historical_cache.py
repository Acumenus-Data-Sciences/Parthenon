"""Historical cache strategy for concept mapping.

Looks up previously approved mappings in app.mapping_cache so that
repeat terms are resolved instantly without hitting SapBERT or the LLM.
"""

import logging

from sqlalchemy import text

from app.db import get_engine
from app.models.schemas import ConceptCandidate

logger = logging.getLogger(__name__)

STRATEGY_NAME = "historical_cache"


class HistoricalCacheStrategy:
    """Resolve concepts from cached/approved historical mappings."""

    async def match(
        self,
        source_code: str,
        source_description: str | None = None,
    ) -> list[ConceptCandidate]:
        """Search the mapping cache for previously approved mappings.

        First tries an exact match on source_code. If source_description
        is provided, also tries a trigram similarity match against cached
        descriptions.

        Args:
            source_code: The source code to look up.
            source_description: Optional description for fuzzy matching.

        Returns:
            List of ConceptCandidate with slightly discounted scores.
        """
        candidates: list[ConceptCandidate] = []
        seen_ids: set[int] = set()

        try:
            engine = get_engine()

            # --- Exact source_code match ---
            with engine.connect() as conn:
                rows = conn.execute(
                    text("""
                        SELECT
                            mc.target_concept_id,
                            mc.confidence,
                            c.concept_name,
                            c.domain_id,
                            c.vocabulary_id,
                            c.standard_concept
                        FROM app.mapping_cache mc
                        JOIN vocab.concepts c
                            ON c.concept_id = mc.target_concept_id
                        WHERE LOWER(mc.source_code) = LOWER(:code)
                        ORDER BY mc.confidence DESC
                        LIMIT 10
                    """),
                    {"code": source_code},
                )

                for row in rows:
                    cid = int(row.target_concept_id)
                    if cid in seen_ids:
                        continue
                    seen_ids.add(cid)

                    # Slight discount for cached results
                    score = float(row.confidence) * 0.95

                    candidates.append(
                        ConceptCandidate(
                            concept_id=cid,
                            concept_name=row.concept_name,
                            domain_id=row.domain_id,
                            vocabulary_id=row.vocabulary_id,
                            score=score,
                            strategy=STRATEGY_NAME,
                        )
                    )

            # --- Trigram similarity on description ---
            if source_description and len(candidates) < 5:
                with engine.connect() as conn:
                    rows = conn.execute(
                        text("""
                            SELECT
                                mc.target_concept_id,
                                mc.confidence,
                                c.concept_name,
                                c.domain_id,
                                c.vocabulary_id,
                                c.standard_concept,
                                similarity(mc.source_description, :desc) AS sim
                            FROM app.mapping_cache mc
                            JOIN vocab.concepts c
                                ON c.concept_id = mc.target_concept_id
                            WHERE mc.source_description IS NOT NULL
                              AND similarity(mc.source_description, :desc) > 0.3
                            ORDER BY sim DESC
                            LIMIT 10
                        """),
                        {"desc": source_description},
                    )

                    for row in rows:
                        cid = int(row.target_concept_id)
                        if cid in seen_ids:
                            continue
                        seen_ids.add(cid)

                        # Discount: original confidence * 0.95 * trigram sim
                        score = float(row.confidence) * 0.95 * float(row.sim)

                        candidates.append(
                            ConceptCandidate(
                                concept_id=cid,
                                concept_name=row.concept_name,
                                domain_id=row.domain_id,
                                vocabulary_id=row.vocabulary_id,
                                score=score,
                                strategy=STRATEGY_NAME,
                            )
                        )

        except Exception:
            logger.exception(
                "Historical cache lookup failed for code=%s", source_code
            )

        return candidates
