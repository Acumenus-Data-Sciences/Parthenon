"""Typed Pydantic models for the concept-mapping retrieve-rerank pipeline.

Phase 3 Plan 6 Task 3 (T-024A). Commercial-tier (proprietary).

- ``ConceptCandidate`` is the per-row shape from ``ConceptRetriever`` (Task 6)
  — one OMOP standard concept plus its retrieval similarity score.
- ``RerankResult`` is what ``ConceptReranker`` (Task 8) and
  ``ConceptMappingSuggesterNode`` (Task 9) emit — the source code/text
  bundled with a ranked list of candidates and an overall confidence.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ConceptCandidate(BaseModel):
    """One OMOP standard concept candidate from pgvector retrieval."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    concept_id: int = Field(description="vocab.concept.concept_id")
    concept_name: str = Field(description="vocab.concept.concept_name")
    vocabulary_id: str = Field(description="e.g. SNOMED, RxNorm, LOINC")
    domain_id: str = Field(description="e.g. Condition, Drug, Measurement")
    standard_concept: str = Field(
        description="'S' = standard; 'C' = classification; '' = non-standard."
    )
    similarity: float = Field(
        ge=0.0,
        le=1.0,
        description="1 - cosine_distance from pgvector; 1.0 = identical embedding",
    )


class RerankResult(BaseModel):
    """Output of the retrieve-then-rerank pipeline for a single source code."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    source_text: str = Field(description="The local text being mapped (e.g. 'Glucose')")
    source_code: str = Field(description="The local code (e.g. 'FAC-GLU')")
    source_vocab: str = Field(description="The local vocabulary (e.g. 'L', 'NDC', 'ICDO3')")
    candidates: list[ConceptCandidate] = Field(
        description="Ranked top-N candidates after rerank (most-likely first)."
    )
    rerank_model: str = Field(description="Identifier of the rerank model that produced the order.")
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall confidence in the top-1 candidate; closer to 1 = stronger.",
    )


__all__ = ["ConceptCandidate", "RerankResult"]
