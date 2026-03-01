"""Ensemble ranker for multi-strategy concept mapping.

Merges candidates from exact match, SapBERT similarity, LLM reasoning,
and historical cache strategies. Deduplicates by concept_id, applies
domain-specific strategy weights, and returns the top-ranked results.
"""

import logging
from collections import defaultdict

from app.models.schemas import ConceptCandidate, RankedCandidate

logger = logging.getLogger(__name__)

# Domain-specific weights for each strategy.
# Keys: strategy name -> weight multiplier.
DOMAIN_WEIGHTS: dict[str, dict[str, float]] = {
    "Condition": {
        "exact_code_match": 1.0,
        "sapbert_cosine": 0.85,
        "llm_reasoning": 0.80,
        "historical_cache": 0.95,
    },
    "Drug": {
        "exact_code_match": 1.0,
        "sapbert_cosine": 0.75,
        "llm_reasoning": 0.85,
        "historical_cache": 0.95,
    },
    "Measurement": {
        "exact_code_match": 1.0,
        "sapbert_cosine": 0.80,
        "llm_reasoning": 0.75,
        "historical_cache": 0.90,
    },
}

DEFAULT_WEIGHTS: dict[str, float] = {
    "exact_code_match": 1.0,
    "sapbert_cosine": 0.80,
    "llm_reasoning": 0.80,
    "historical_cache": 0.90,
}


class EnsembleRanker:
    """Merge and rank candidates from multiple mapping strategies."""

    def rank(
        self,
        candidates_by_strategy: dict[str, list[ConceptCandidate]],
        domain_hint: str | None = None,
    ) -> list[RankedCandidate]:
        """Combine, deduplicate, weight, and rank all candidates.

        For each unique concept_id the final score is the *maximum*
        weighted score across all strategies that produced it.

        Args:
            candidates_by_strategy: Mapping from strategy name to the
                list of ConceptCandidate objects it produced.
            domain_hint: Optional OMOP domain_id used to select the
                weight profile (e.g. "Condition", "Drug").

        Returns:
            Up to 5 RankedCandidate objects sorted by final_score
            descending.
        """
        weights = DOMAIN_WEIGHTS.get(domain_hint or "", DEFAULT_WEIGHTS)

        # Accumulate per-concept metadata and per-strategy scores.
        # concept_id -> {strategy_name: weighted_score}
        scores: dict[int, dict[str, float]] = defaultdict(dict)
        # concept_id -> best metadata seen so far
        meta: dict[int, dict[str, object]] = {}

        for strategy, candidates in candidates_by_strategy.items():
            weight = weights.get(strategy, DEFAULT_WEIGHTS.get(strategy, 0.80))

            for c in candidates:
                weighted = c.score * weight
                scores[c.concept_id][strategy] = weighted

                # Keep the metadata from the highest-scoring occurrence
                existing = meta.get(c.concept_id)
                if existing is None or weighted > float(
                    existing.get("_best_score", 0.0)
                ):
                    meta[c.concept_id] = {
                        "concept_name": c.concept_name,
                        "domain_id": c.domain_id,
                        "vocabulary_id": c.vocabulary_id,
                        "_best_score": weighted,
                    }

        # Build ranked candidates
        ranked: list[RankedCandidate] = []
        for cid, strategy_scores in scores.items():
            final_score = max(strategy_scores.values())
            primary_strategy = max(strategy_scores, key=strategy_scores.get)  # type: ignore[arg-type]

            info = meta[cid]

            # Look up standard_concept from the best exact match if present
            standard_concept = self._find_standard_concept(
                cid, candidates_by_strategy
            )

            ranked.append(
                RankedCandidate(
                    concept_id=cid,
                    concept_name=str(info["concept_name"]),
                    domain_id=str(info["domain_id"]),
                    vocabulary_id=str(info["vocabulary_id"]),
                    standard_concept=standard_concept,
                    final_score=round(final_score, 4),
                    strategy_scores={
                        k: round(v, 4) for k, v in strategy_scores.items()
                    },
                    primary_strategy=primary_strategy,
                )
            )

        ranked.sort(key=lambda r: r.final_score, reverse=True)
        return ranked[:5]

    @staticmethod
    def _find_standard_concept(
        concept_id: int,
        candidates_by_strategy: dict[str, list[ConceptCandidate]],
    ) -> str | None:
        """Extract the standard_concept flag for a concept_id.

        Scans all strategies to find any candidate that carries the
        standard_concept attribute (typically from exact match or cache
        queries that join to vocab.concepts).
        """
        # ConceptCandidate doesn't carry standard_concept directly, but
        # the database-backed strategies populate it in the score.
        # We return None here; the router can enrich later if needed.
        return None
