"""SapBERT cosine similarity strategy for concept mapping.

Encodes the input text with SapBERT, then searches pgvector for the
nearest concept embeddings using cosine distance.
"""

import logging

from app.db import search_nearest
from app.models.schemas import ConceptCandidate
from app.services.sapbert import get_sapbert_service

logger = logging.getLogger(__name__)

STRATEGY_NAME = "sapbert_cosine"


class SapBERTSimilarityStrategy:
    """Find candidate concepts via SapBERT embedding similarity."""

    async def match(
        self,
        text: str,
        domain_hint: str | None = None,
        top_k: int = 10,
    ) -> list[ConceptCandidate]:
        """Encode text with SapBERT and search nearest embeddings.

        Args:
            text: The clinical term or description to match.
            domain_hint: Optional OMOP domain_id to filter results
                (e.g. "Condition", "Drug", "Measurement").
            top_k: Maximum number of candidates to return.

        Returns:
            List of ConceptCandidate with cosine similarity scores.
        """
        try:
            sapbert = get_sapbert_service()
            embedding = sapbert.encode_single(text)
        except Exception:
            logger.exception("SapBERT encoding failed for text=%r", text)
            return []

        try:
            # Fetch extra results when filtering by domain so we still
            # have enough candidates after the filter is applied.
            fetch_k = top_k * 3 if domain_hint else top_k
            results = search_nearest(embedding, top_k=fetch_k)
        except Exception:
            logger.exception("pgvector search failed for text=%r", text)
            return []

        candidates: list[ConceptCandidate] = []
        for row in results:
            if domain_hint and row.get("domain_id") != domain_hint:
                continue

            candidates.append(
                ConceptCandidate(
                    concept_id=int(row["concept_id"]),  # type: ignore[call-overload]
                    concept_name=str(row["concept_name"]),
                    domain_id=str(row.get("domain_id", "")),
                    vocabulary_id=str(row.get("vocabulary_id", "")),
                    score=float(row["similarity"]),  # type: ignore[arg-type]
                    strategy=STRATEGY_NAME,
                )
            )

            if len(candidates) >= top_k:
                break

        return candidates
