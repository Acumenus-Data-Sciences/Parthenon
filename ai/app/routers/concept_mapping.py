"""Concept mapping router — multi-strategy pipeline.

Provides endpoints for single-term and batch concept mapping using
the full Step 3B pipeline:  cache -> exact -> SapBERT -> LLM -> ensemble rank.
"""

import asyncio
import logging
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter

from app.models.schemas import (
    BatchMappingRequest,
    BatchMappingResponse,
    ConceptCandidate,
    MappingResult,
    MappingTermRequest,
    MappingTermResponse,
    RankedCandidate,
)
from app.services.ensemble_ranker import EnsembleRanker
from app.services.exact_match import ExactMatchStrategy
from app.services.historical_cache import HistoricalCacheStrategy
from app.services.llm_reasoning import LLMReasoningStrategy
from app.services.sapbert_similarity import SapBERTSimilarityStrategy

logger = logging.getLogger(__name__)

router = APIRouter()

# Strategy singletons
_exact = ExactMatchStrategy()
_sapbert = SapBERTSimilarityStrategy()
_llm = LLMReasoningStrategy()
_cache = HistoricalCacheStrategy()
_ranker = EnsembleRanker()

# SapBERT score thresholds that trigger LLM reasoning
_LLM_LOWER = 0.70
_LLM_UPPER = 0.95


# ------------------------------------------------------------------ #
#  Single-term mapping
# ------------------------------------------------------------------ #


@router.post("/map-term", response_model=MappingTermResponse)
async def map_term(request: MappingTermRequest) -> MappingTermResponse:
    """Map a single source term through the full pipeline.

    Execution order:
      1. Historical cache lookup
      2. Exact code match
      3. SapBERT cosine similarity
      4. LLM reasoning (only when the best SapBERT score is between
         0.70 and 0.95 — i.e. moderate confidence)
      5. Ensemble ranking
    """
    start = time.perf_counter()

    # Use description as display term, fall back to source_code
    term_text = request.source_description or request.source_code

    # Build optional context string for LLM
    context = _build_context(request)

    candidates_by_strategy: dict[str, list[ConceptCandidate]] = {}

    # 1. Historical cache
    cache_candidates = await _cache.match(
        source_code=request.source_code,
        source_description=request.source_description,
    )
    if cache_candidates:
        candidates_by_strategy["historical_cache"] = cache_candidates

    # 2. Exact code match
    exact_candidates = await _exact.match(
        source_code=request.source_code,
        source_vocabulary_id=request.source_vocabulary_id,
    )
    if exact_candidates:
        candidates_by_strategy["exact_code_match"] = exact_candidates

    # 3. SapBERT similarity
    sapbert_candidates = await _sapbert.match(text=term_text, top_k=10)
    if sapbert_candidates:
        candidates_by_strategy["sapbert_cosine"] = sapbert_candidates

    # 4. LLM reasoning — only for moderate-confidence SapBERT results
    best_sapbert = max((c.score for c in sapbert_candidates), default=0.0)
    if _LLM_LOWER <= best_sapbert <= _LLM_UPPER and sapbert_candidates:
        llm_input = _candidates_to_dicts(sapbert_candidates[:5])
        llm_candidates = await _llm.match(
            term=term_text,
            context=context,
            candidate_concepts=llm_input,
        )
        if llm_candidates:
            candidates_by_strategy["llm_reasoning"] = llm_candidates

    # 5. Ensemble ranking
    domain_hint = _infer_domain(candidates_by_strategy)
    ranked = _ranker.rank(candidates_by_strategy, domain_hint=domain_hint)

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return MappingTermResponse(
        term=term_text,
        candidates=ranked,
        mapping_time_ms=elapsed_ms,
    )


# ------------------------------------------------------------------ #
#  Batch mapping
# ------------------------------------------------------------------ #


@router.post("/map-batch", response_model=BatchMappingResponse)
async def map_batch(request: BatchMappingRequest) -> BatchMappingResponse:
    """Map a batch of source terms through the pipeline.

    Optimizations over per-term mapping:
      - Batch SapBERT encode (single model forward pass)
      - Parallel exact match and cache lookups via asyncio.gather
      - LLM reasoning only for terms with moderate SapBERT scores
    """
    start = time.perf_counter()
    strategies_used: dict[str, int] = defaultdict(int)
    results: list[MappingResult] = []

    # --- Batch SapBERT encoding ---
    texts = [t.source_description or t.source_code for t in request.terms]
    sapbert_embeddings: list[list[float]] = []
    try:
        from app.services.sapbert import get_sapbert_service

        sapbert = get_sapbert_service()
        sapbert_embeddings = sapbert.encode(texts)
    except Exception:
        logger.exception("Batch SapBERT encoding failed")
        sapbert_embeddings = [[] for _ in texts]

    # --- Batch pgvector search ---
    from app.db import search_nearest as _search_nearest

    sapbert_results_per_term: list[list[dict[str, object]]] = []
    for emb in sapbert_embeddings:
        if emb:
            try:
                sapbert_results_per_term.append(_search_nearest(emb, top_k=10))
            except Exception:
                sapbert_results_per_term.append([])
        else:
            sapbert_results_per_term.append([])

    # --- Parallel exact + cache lookups ---
    async def _lookup_exact(
        code: str, vocab_id: str | None
    ) -> list[ConceptCandidate]:
        return await _exact.match(code, vocab_id)

    async def _lookup_cache(
        code: str, desc: str | None
    ) -> list[ConceptCandidate]:
        return await _cache.match(code, desc)

    exact_tasks = [
        _lookup_exact(t.source_code, t.source_vocabulary_id)
        for t in request.terms
    ]
    cache_tasks = [
        _lookup_cache(t.source_code, t.source_description)
        for t in request.terms
    ]

    exact_results = await asyncio.gather(*exact_tasks, return_exceptions=True)
    cache_results = await asyncio.gather(*cache_tasks, return_exceptions=True)

    # --- Per-term assembly + optional LLM ---
    for i, term in enumerate(request.terms):
        term_text = term.source_description or term.source_code
        candidates_by_strategy: dict[str, list[ConceptCandidate]] = {}

        # Cache
        cache_cands = (
            cache_results[i]
            if isinstance(cache_results[i], list)
            else []
        )
        if cache_cands:
            candidates_by_strategy["historical_cache"] = cache_cands
            strategies_used["historical_cache"] += 1

        # Exact
        exact_cands = (
            exact_results[i]
            if isinstance(exact_results[i], list)
            else []
        )
        if exact_cands:
            candidates_by_strategy["exact_code_match"] = exact_cands
            strategies_used["exact_code_match"] += 1

        # SapBERT
        sapbert_rows = sapbert_results_per_term[i]
        sapbert_cands = [
            ConceptCandidate(
                concept_id=int(r["concept_id"]),
                concept_name=str(r["concept_name"]),
                domain_id=str(r.get("domain_id", "")),
                vocabulary_id=str(r.get("vocabulary_id", "")),
                score=float(r["similarity"]),
                strategy="sapbert_cosine",
            )
            for r in sapbert_rows
        ]
        if sapbert_cands:
            candidates_by_strategy["sapbert_cosine"] = sapbert_cands
            strategies_used["sapbert_cosine"] += 1

        # LLM for moderate confidence
        best_sap = max((c.score for c in sapbert_cands), default=0.0)
        if _LLM_LOWER <= best_sap <= _LLM_UPPER and sapbert_cands:
            context = _build_context_from_term(term)
            llm_input = _candidates_to_dicts(sapbert_cands[:5])
            llm_cands = await _llm.match(
                term=term_text,
                context=context,
                candidate_concepts=llm_input,
            )
            if llm_cands:
                candidates_by_strategy["llm_reasoning"] = llm_cands
                strategies_used["llm_reasoning"] += 1

        # Rank
        domain_hint = _infer_domain(candidates_by_strategy)
        ranked = _ranker.rank(candidates_by_strategy, domain_hint=domain_hint)

        results.append(
            MappingResult(
                term=term_text,
                source_code=term.source_code,
                candidates=ranked,
            )
        )

    total_ms = int((time.perf_counter() - start) * 1000)

    return BatchMappingResponse(
        results=results,
        total_time_ms=total_ms,
        strategies_used=dict(strategies_used),
    )


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #


def _build_context(request: MappingTermRequest) -> str | None:
    """Assemble a context string from optional request fields."""
    parts: list[str] = []
    if request.source_table:
        parts.append(f"Source table: {request.source_table}")
    if request.source_column:
        parts.append(f"Source column: {request.source_column}")
    if request.source_vocabulary_id:
        parts.append(f"Source vocabulary: {request.source_vocabulary_id}")
    if request.sample_values:
        parts.append(f"Sample values: {', '.join(request.sample_values[:10])}")
    return "; ".join(parts) if parts else None


def _build_context_from_term(term: Any) -> str | None:
    """Build context from a MappingTerm (batch endpoint)."""
    parts: list[str] = []
    if term.source_table:
        parts.append(f"Source table: {term.source_table}")
    if term.source_column:
        parts.append(f"Source column: {term.source_column}")
    if term.source_vocabulary_id:
        parts.append(f"Source vocabulary: {term.source_vocabulary_id}")
    return "; ".join(parts) if parts else None


def _candidates_to_dicts(
    candidates: list[ConceptCandidate],
) -> list[dict[str, object]]:
    """Convert ConceptCandidate list to plain dicts for LLM input."""
    return [
        {
            "concept_id": c.concept_id,
            "concept_name": c.concept_name,
            "domain_id": c.domain_id,
            "vocabulary_id": c.vocabulary_id,
            "score": c.score,
        }
        for c in candidates
    ]


def _infer_domain(
    candidates_by_strategy: dict[str, list[ConceptCandidate]],
) -> str | None:
    """Infer the most common domain from all candidates.

    Returns the domain_id that appears most frequently, or None if
    there are no candidates.
    """
    domain_counts: dict[str, int] = defaultdict(int)
    for candidates in candidates_by_strategy.values():
        for c in candidates:
            if c.domain_id:
                domain_counts[c.domain_id] += 1

    if not domain_counts:
        return None

    return max(domain_counts, key=domain_counts.get)  # type: ignore[arg-type]
