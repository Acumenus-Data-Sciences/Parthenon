"""Ariadne concept mapping router.

Wraps OHDSI Ariadne modules (verbatim_mapping, vector_search, llm_mapping,
term_cleanup) with our own infrastructure: Ollama instead of OpenAI, our
PostgreSQL connection for vocabulary lookups and pgvector similarity search.

Ariadne is alpha software, so every import is lazy and wrapped in try/except.
All three endpoints degrade gracefully to raw-SQL + Ollama fallbacks when the
package is unavailable.

Endpoints
---------
POST /ariadne/map          — verbatim → vector → LLM three-stage pipeline
POST /ariadne/clean-terms  — LLM-based clinical term normalisation
POST /ariadne/vector-search — pgvector cosine similarity over concept embeddings
"""

import asyncio
import logging
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.config import settings
from app.db import get_session

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_MATCH_TYPE = Literal["verbatim", "vector", "llm", "none"]


def _safe_str(val: object) -> str:
    return str(val) if val is not None else ""


async def _ollama_chat(prompt: str, system: str | None = None) -> str:
    """Send a single-turn chat request to Ollama and return the reply text.

    Uses httpx directly so we stay async throughout the request lifecycle.
    """
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload: dict[str, object] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
    }

    url = f"{settings.ollama_base_url}/api/chat"
    async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return str(data.get("message", {}).get("content", ""))


# ---------------------------------------------------------------------------
# Pydantic models — /map
# ---------------------------------------------------------------------------


class MapRequest(BaseModel):
    """Request body for the /map endpoint."""

    source_terms: list[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Source terms to map to standard OMOP concepts.",
    )
    target_vocabularies: list[str] | None = Field(
        default=None,
        description="Restrict results to these vocabulary IDs (e.g. ['SNOMED', 'RxNorm']).",
    )
    target_domains: list[str] | None = Field(
        default=None,
        description="Restrict results to these domain IDs (e.g. ['Condition', 'Drug']).",
    )
    include_synonyms: bool = Field(
        default=True,
        description="Include concept_synonym table in verbatim matching.",
    )
    max_candidates: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of candidates to return per term.",
    )


class ConceptCandidate(BaseModel):
    """A single candidate OMOP concept for a source term."""

    concept_id: int
    concept_name: str
    vocabulary_id: str
    domain_id: str
    standard_concept: str | None = None
    match_type: _MATCH_TYPE
    confidence: float = Field(ge=0.0, le=1.0)


class TermMapping(BaseModel):
    """Mapping result for a single source term."""

    source_term: str
    candidates: list[ConceptCandidate]
    best_match: ConceptCandidate | None = None
    match_type: _MATCH_TYPE


class MapResponse(BaseModel):
    mappings: list[TermMapping]


# ---------------------------------------------------------------------------
# Pydantic models — /clean-terms
# ---------------------------------------------------------------------------


class CleanTermsRequest(BaseModel):
    terms: list[str] = Field(..., min_length=1, max_length=200)


class CleanedTerm(BaseModel):
    original: str
    cleaned: str


class CleanTermsResponse(BaseModel):
    cleaned: list[CleanedTerm]


# ---------------------------------------------------------------------------
# Pydantic models — /vector-search
# ---------------------------------------------------------------------------


class VectorSearchRequest(BaseModel):
    term: str = Field(..., min_length=1, max_length=500)
    max_results: int = Field(default=25, ge=1, le=100)
    vocabulary_id: str | None = None
    domain_id: str | None = None


class VectorSearchResult(BaseModel):
    concept_id: int
    concept_name: str
    vocabulary_id: str
    domain_id: str
    standard_concept: str | None = None
    similarity: float


class VectorSearchResponse(BaseModel):
    term: str
    results: list[VectorSearchResult]


# ---------------------------------------------------------------------------
# Internal: verbatim matching (SQL fallback, always available)
# ---------------------------------------------------------------------------


def _build_vocab_filter_clause(
    target_vocabularies: list[str] | None,
    target_domains: list[str] | None,
    param_prefix: str = "",
) -> tuple[str, dict[str, object]]:
    """Build WHERE fragment and bind-params for vocabulary/domain filters.

    Returns (clause_fragment, params_dict).  The fragment starts with ' AND '
    so it can be appended directly after an existing WHERE clause.
    """
    clause_parts: list[str] = []
    params: dict[str, object] = {}

    if target_vocabularies:
        vocab_schema = settings.ariadne_vocab_schema
        keys = [f"{param_prefix}vocab_{i}" for i in range(len(target_vocabularies))]
        placeholders = ", ".join(f":{k}" for k in keys)
        clause_parts.append(f"c.vocabulary_id IN ({placeholders})")
        for k, v in zip(keys, target_vocabularies):
            params[k] = v

    if target_domains:
        keys = [f"{param_prefix}domain_{i}" for i in range(len(target_domains))]
        placeholders = ", ".join(f":{k}" for k in keys)
        clause_parts.append(f"c.domain_id IN ({placeholders})")
        for k, v in zip(keys, target_domains):
            params[k] = v

    clause = (" AND " + " AND ".join(clause_parts)) if clause_parts else ""
    return clause, params


def _verbatim_match_sql(
    term: str,
    vocab_schema: str,
    target_vocabularies: list[str] | None,
    target_domains: list[str] | None,
    include_synonyms: bool,
    max_candidates: int,
) -> list[ConceptCandidate]:
    """Exact-string verbatim match against concept_name and optionally concept_synonym.

    Uses ILIKE for case-insensitive matching as a practical compromise between
    true exact matching and broad fuzzy matching; confidence is 1.0 for a
    case-insensitive exact hit, 0.9 for a synonym hit.
    """
    filter_clause, filter_params = _build_vocab_filter_clause(
        target_vocabularies, target_domains
    )

    # Primary match on concept_name
    name_sql = f"""
        SELECT
            c.concept_id,
            c.concept_name,
            c.vocabulary_id,
            c.domain_id,
            c.standard_concept,
            1.0 AS confidence,
            'verbatim' AS match_src
        FROM {vocab_schema}.concept c
        WHERE c.concept_name ILIKE :term
          AND c.invalid_reason IS NULL
          AND c.standard_concept = 'S'
          {filter_clause}
        LIMIT :lim
    """

    results: list[ConceptCandidate] = []
    with get_session() as session:
        rows = session.execute(
            text(name_sql), {"term": term, "lim": max_candidates, **filter_params}
        ).fetchall()

        for row in rows:
            results.append(
                ConceptCandidate(
                    concept_id=int(row.concept_id),
                    concept_name=_safe_str(row.concept_name),
                    vocabulary_id=_safe_str(row.vocabulary_id),
                    domain_id=_safe_str(row.domain_id),
                    standard_concept=_safe_str(row.standard_concept) or None,
                    match_type="verbatim",
                    confidence=float(row.confidence),
                )
            )

        if include_synonyms and len(results) < max_candidates:
            remaining = max_candidates - len(results)
            seen_ids = {c.concept_id for c in results}
            syn_sql = f"""
                SELECT
                    c.concept_id,
                    c.concept_name,
                    c.vocabulary_id,
                    c.domain_id,
                    c.standard_concept,
                    0.9 AS confidence,
                    'verbatim_synonym' AS match_src
                FROM {vocab_schema}.concept_synonym cs
                JOIN {vocab_schema}.concept c ON c.concept_id = cs.concept_id
                WHERE cs.concept_synonym_name ILIKE :term
                  AND c.invalid_reason IS NULL
                  AND c.standard_concept = 'S'
                  {filter_clause}
                LIMIT :lim
            """
            syn_rows = session.execute(
                text(syn_sql),
                {"term": term, "lim": remaining, **filter_params},
            ).fetchall()

            for row in syn_rows:
                if int(row.concept_id) not in seen_ids:
                    results.append(
                        ConceptCandidate(
                            concept_id=int(row.concept_id),
                            concept_name=_safe_str(row.concept_name),
                            vocabulary_id=_safe_str(row.vocabulary_id),
                            domain_id=_safe_str(row.domain_id),
                            standard_concept=_safe_str(row.standard_concept) or None,
                            match_type="verbatim",
                            confidence=float(row.confidence),
                        )
                    )

    return results


# ---------------------------------------------------------------------------
# Internal: vector similarity search (SQL, always available)
# ---------------------------------------------------------------------------


def _vector_search_sql(
    embedding_str: str,
    vocab_schema: str,
    target_vocabularies: list[str] | None,
    target_domains: list[str] | None,
    max_results: int,
) -> list[VectorSearchResult]:
    """pgvector cosine similarity search over concept_embeddings."""
    filter_clause, filter_params = _build_vocab_filter_clause(
        target_vocabularies, target_domains, param_prefix="vs_"
    )

    sql = f"""
        SELECT
            ce.concept_id,
            c.concept_name,
            c.vocabulary_id,
            c.domain_id,
            c.standard_concept,
            1 - (ce.embedding <=> :emb::vector) AS similarity
        FROM {vocab_schema}.concept_embeddings ce
        JOIN {vocab_schema}.concept c ON c.concept_id = ce.concept_id
        WHERE c.invalid_reason IS NULL
          AND c.standard_concept = 'S'
          {filter_clause}
        ORDER BY ce.embedding <=> :emb::vector
        LIMIT :lim
    """

    with get_session() as session:
        rows = session.execute(
            text(sql),
            {"emb": embedding_str, "lim": max_results, **filter_params},
        ).fetchall()

    return [
        VectorSearchResult(
            concept_id=int(row.concept_id),
            concept_name=_safe_str(row.concept_name),
            vocabulary_id=_safe_str(row.vocabulary_id),
            domain_id=_safe_str(row.domain_id),
            standard_concept=_safe_str(row.standard_concept) or None,
            similarity=float(row.similarity),
        )
        for row in rows
    ]


def _encode_term_to_vector(term: str) -> list[float] | None:
    """Encode a term using SapBERT (if available) and return the vector.

    Returns None when SapBERT is not initialised so the caller can fall back.
    """
    try:
        from app.services.sapbert import get_sapbert_service

        service = get_sapbert_service()
        return service.encode_single(term)
    except Exception:
        logger.debug("SapBERT unavailable for vector encoding of %r", term)
        return None


def _try_ariadne_encode(term: str) -> list[float] | None:
    """Attempt to use Ariadne's vector_search module for encoding.

    Falls back to SapBERT if Ariadne is not installed or raises.
    """
    try:
        from ariadne.vector_search import VectorSearcher  # type: ignore[import]

        searcher = VectorSearcher()
        vec = searcher.encode(term)
        if vec is not None:
            return list(vec)
    except Exception:
        logger.debug("Ariadne VectorSearcher unavailable, falling back to SapBERT")

    return _encode_term_to_vector(term)


# ---------------------------------------------------------------------------
# Internal: LLM candidate ranking
# ---------------------------------------------------------------------------

_LLM_RANK_SYSTEM = (
    "You are a clinical informaticist expert in OMOP CDM vocabulary mapping. "
    "Given a source clinical term and a list of candidate standard concepts, "
    "return ONLY a JSON array of the candidate concept_ids ranked from best "
    "to worst match.  Example output: [316139, 44782032, 37016200]. "
    "No explanation, no markdown fences — pure JSON array."
)


async def _llm_rank_candidates(
    source_term: str,
    candidates: list[ConceptCandidate],
) -> list[ConceptCandidate]:
    """Ask Ollama to rank candidates and return them re-ordered by LLM preference.

    The LLM is only invoked when there are at least 2 candidates (no point
    ranking a single result) and we have moderate vector confidence (< 0.95).
    On any failure the original order is preserved.
    """
    if len(candidates) <= 1:
        return candidates

    candidate_lines = "\n".join(
        f"  {c.concept_id}: {c.concept_name} ({c.vocabulary_id} / {c.domain_id})"
        for c in candidates
    )
    prompt = (
        f'Source term: "{source_term}"\n\n'
        f"Candidates:\n{candidate_lines}\n\n"
        "Return the concept_ids as a JSON array ranked best-to-worst."
    )

    try:
        # First try Ariadne's llm_mapping module
        try:
            from ariadne.llm_mapping import LLMMappingPipeline  # type: ignore[import]

            pipeline = LLMMappingPipeline()
            ranked_ids: list[int] = pipeline.rank_candidates(
                source_term, [c.concept_id for c in candidates]
            )
        except Exception:
            logger.debug("Ariadne LLMMappingPipeline unavailable, using raw Ollama")
            reply = await _ollama_chat(prompt, system=_LLM_RANK_SYSTEM)

            import json
            import re

            # Strip markdown fences if the model disobeys
            clean = re.sub(r"```[^\n]*\n?", "", reply).strip()
            ranked_ids = json.loads(clean)

        # Re-order candidates according to LLM ranking
        id_order = {cid: idx for idx, cid in enumerate(ranked_ids)}
        reordered = sorted(
            candidates,
            key=lambda c: id_order.get(c.concept_id, len(ranked_ids)),
        )
        # Re-assign confidence based on rank position
        total = len(reordered)
        return [
            c.model_copy(
                update={
                    "match_type": "llm",
                    "confidence": round(1.0 - (rank / total) * 0.3, 4),
                }
            )
            for rank, c in enumerate(reordered)
        ]
    except Exception:
        logger.warning("LLM ranking failed for %r, keeping original order", source_term)
        return candidates


# ---------------------------------------------------------------------------
# POST /map
# ---------------------------------------------------------------------------


@router.post("/map", response_model=MapResponse, summary="Map source terms to OMOP standard concepts")
async def map_terms(request: MapRequest) -> MapResponse:
    """Three-stage concept mapping pipeline for one or more source terms.

    Stage 1 — Verbatim: exact ILIKE match on concept_name and concept_synonym.
    Stage 2 — Vector: pgvector cosine similarity over SapBERT embeddings.
    Stage 3 — LLM: Ollama re-ranks vector candidates when confidence is moderate.

    Ariadne library modules are used where available; every stage has a
    plain-SQL / Ollama fallback so the endpoint works even without Ariadne.
    """
    vocab_schema = settings.ariadne_vocab_schema
    mappings: list[TermMapping] = []

    async def _process_term(source_term: str) -> TermMapping:
        # ------------------------------------------------------------------
        # Stage 1: Verbatim matching
        # ------------------------------------------------------------------
        verbatim_candidates: list[ConceptCandidate] = []
        try:
            # Try Ariadne verbatim_mapping first
            try:
                from ariadne.verbatim_mapping import VerbatimMapper  # type: ignore[import]

                mapper = VerbatimMapper(schema=vocab_schema)
                raw = mapper.match(
                    source_term,
                    include_synonyms=request.include_synonyms,
                    target_vocabularies=request.target_vocabularies,
                    target_domains=request.target_domains,
                )
                verbatim_candidates = [
                    ConceptCandidate(
                        concept_id=int(r["concept_id"]),
                        concept_name=_safe_str(r.get("concept_name")),
                        vocabulary_id=_safe_str(r.get("vocabulary_id")),
                        domain_id=_safe_str(r.get("domain_id")),
                        standard_concept=_safe_str(r.get("standard_concept")) or None,
                        match_type="verbatim",
                        confidence=float(r.get("confidence", 1.0)),
                    )
                    for r in (raw or [])
                ]
            except Exception:
                logger.debug("Ariadne VerbatimMapper unavailable, using SQL fallback")
                verbatim_candidates = _verbatim_match_sql(
                    term=source_term,
                    vocab_schema=vocab_schema,
                    target_vocabularies=request.target_vocabularies,
                    target_domains=request.target_domains,
                    include_synonyms=request.include_synonyms,
                    max_candidates=request.max_candidates,
                )
        except Exception:
            logger.exception("Verbatim matching failed for %r", source_term)

        # If we got a high-confidence verbatim hit, short-circuit
        top_verbatim_conf = max((c.confidence for c in verbatim_candidates), default=0.0)
        if verbatim_candidates and top_verbatim_conf >= 0.95:
            cands = verbatim_candidates[: request.max_candidates]
            return TermMapping(
                source_term=source_term,
                candidates=cands,
                best_match=cands[0],
                match_type="verbatim",
            )

        # ------------------------------------------------------------------
        # Stage 2: Vector similarity
        # ------------------------------------------------------------------
        vector_candidates: list[ConceptCandidate] = []
        try:
            embedding = _try_ariadne_encode(source_term)
            if embedding:
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                vs_results = _vector_search_sql(
                    embedding_str=embedding_str,
                    vocab_schema=vocab_schema,
                    target_vocabularies=request.target_vocabularies,
                    target_domains=request.target_domains,
                    max_results=request.max_candidates,
                )
                vector_candidates = [
                    ConceptCandidate(
                        concept_id=r.concept_id,
                        concept_name=r.concept_name,
                        vocabulary_id=r.vocabulary_id,
                        domain_id=r.domain_id,
                        standard_concept=r.standard_concept,
                        match_type="vector",
                        confidence=round(r.similarity, 4),
                    )
                    for r in vs_results
                ]
        except Exception:
            logger.exception("Vector search failed for %r", source_term)

        # Merge verbatim + vector, deduplicate by concept_id (verbatim wins)
        seen: set[int] = set()
        merged: list[ConceptCandidate] = []
        for c in verbatim_candidates + vector_candidates:
            if c.concept_id not in seen:
                seen.add(c.concept_id)
                merged.append(c)

        if not merged:
            return TermMapping(
                source_term=source_term,
                candidates=[],
                best_match=None,
                match_type="none",
            )

        # ------------------------------------------------------------------
        # Stage 3: LLM re-ranking (only when top score is moderate)
        # ------------------------------------------------------------------
        top_conf = max((c.confidence for c in merged), default=0.0)
        llm_ranked = merged
        final_match_type: _MATCH_TYPE = merged[0].match_type

        if 0.60 <= top_conf < 0.95 and len(merged) >= 2:
            try:
                llm_ranked = await _llm_rank_candidates(
                    source_term, merged[: request.max_candidates]
                )
                final_match_type = "llm"
            except Exception:
                logger.warning("LLM stage skipped for %r", source_term)

        cands = llm_ranked[: request.max_candidates]
        return TermMapping(
            source_term=source_term,
            candidates=cands,
            best_match=cands[0] if cands else None,
            match_type=final_match_type,
        )

    # Process all terms concurrently
    tasks = [_process_term(t) for t in request.source_terms]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.exception("Mapping failed for term %r", request.source_terms[i])
            mappings.append(
                TermMapping(
                    source_term=request.source_terms[i],
                    candidates=[],
                    best_match=None,
                    match_type="none",
                )
            )
        else:
            mappings.append(result)  # type: ignore[arg-type]

    return MapResponse(mappings=mappings)


# ---------------------------------------------------------------------------
# POST /clean-terms
# ---------------------------------------------------------------------------

_TERM_CLEANUP_SYSTEM = (
    "You are a clinical terminology normalisation expert. "
    "Given a list of raw clinical terms, return a JSON object with key "
    '"cleaned" whose value is an array of objects, each with keys '
    '"original" and "cleaned". '
    "Remove qualifiers like 'unspecified', 'NOS', 'not otherwise specified', "
    "'with or without', 'excluding', trailing anatomical ambiguities, and other "
    "noise that does not contribute to the core clinical meaning. "
    "Preserve medical specificity. Output ONLY valid JSON — no prose, no fences."
)


@router.post(
    "/clean-terms",
    response_model=CleanTermsResponse,
    summary="Normalise messy clinical terms using LLM",
)
async def clean_terms(request: CleanTermsRequest) -> CleanTermsResponse:
    """Normalise clinical terms with LLM-based term cleanup.

    Uses Ariadne's term_cleanup module when available, otherwise falls back
    to a direct Ollama prompt that mirrors Ariadne's cleanup system prompt.

    Removes noise tokens such as:
      - "unspecified", "NOS", "not otherwise specified"
      - "with or without …", "excluding …"
      - Redundant anatomical qualifiers
    """
    import json
    import re

    try:
        # Attempt Ariadne term_cleanup first
        try:
            from ariadne.term_cleanup import TermCleaner  # type: ignore[import]

            cleaner = TermCleaner()
            raw_results = cleaner.clean(request.terms)
            cleaned = [
                CleanedTerm(
                    original=item.get("original", ""),
                    cleaned=item.get("cleaned", ""),
                )
                for item in (raw_results or [])
            ]
            return CleanTermsResponse(cleaned=cleaned)
        except Exception:
            logger.debug("Ariadne TermCleaner unavailable, using Ollama fallback")

        # Ollama fallback — send all terms in a single prompt to amortise latency
        terms_block = "\n".join(f"- {t}" for t in request.terms)
        prompt = f"Normalise these clinical terms:\n\n{terms_block}"

        reply = await _ollama_chat(prompt, system=_TERM_CLEANUP_SYSTEM)

        # Strip markdown code fences if present
        clean_reply = re.sub(r"```[^\n]*\n?", "", reply).strip()
        data = json.loads(clean_reply)

        # Support both {"cleaned": [...]} and bare [...]
        items: list[dict[str, str]] = data.get("cleaned", data) if isinstance(data, dict) else data

        # Build a lookup by original term to handle partial LLM output
        lookup: dict[str, str] = {
            item.get("original", ""): item.get("cleaned", item.get("original", ""))
            for item in items
            if isinstance(item, dict)
        }

        cleaned = [
            CleanedTerm(original=t, cleaned=lookup.get(t, t))
            for t in request.terms
        ]
        return CleanTermsResponse(cleaned=cleaned)

    except Exception as exc:
        logger.exception("Term cleanup failed")
        raise HTTPException(status_code=500, detail=f"Term cleanup failed: {exc}") from exc


# ---------------------------------------------------------------------------
# POST /vector-search
# ---------------------------------------------------------------------------


@router.post(
    "/vector-search",
    response_model=VectorSearchResponse,
    summary="Semantic similarity search over OMOP concept embeddings",
)
async def vector_search(request: VectorSearchRequest) -> VectorSearchResponse:
    """Search concept embeddings using pgvector cosine similarity.

    Encodes the query term with SapBERT (or Ariadne's vector module when
    available) and returns the nearest neighbours from the concept_embeddings
    table in the configured vocabulary schema.

    Optional filters on vocabulary_id and domain_id are applied as SQL WHERE
    clauses before similarity ranking.
    """
    # Build optional vocabulary/domain filter lists from single-value params
    target_vocabularies = [request.vocabulary_id] if request.vocabulary_id else None
    target_domains = [request.domain_id] if request.domain_id else None

    try:
        embedding = _try_ariadne_encode(request.term)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Embedding generation failed: {exc}"
        ) from exc

    if not embedding:
        raise HTTPException(
            status_code=503,
            detail=(
                "No embedding model available. "
                "Ensure SapBERT or Ariadne vector_search is configured."
            ),
        )

    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

    try:
        results = _vector_search_sql(
            embedding_str=embedding_str,
            vocab_schema=settings.ariadne_vocab_schema,
            target_vocabularies=target_vocabularies,
            target_domains=target_domains,
            max_results=request.max_results,
        )
    except Exception as exc:
        logger.exception("pgvector search failed for %r", request.term)
        raise HTTPException(
            status_code=500, detail=f"Vector search failed: {exc}"
        ) from exc

    return VectorSearchResponse(term=request.term, results=results)
