"""Phase 3 Plan 6 Task 3 (T-024A): ConceptCandidate + RerankResult types."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from runtime.commercial.mapping.types import ConceptCandidate, RerankResult


def _candidate(**overrides: object) -> ConceptCandidate:
    base: dict[str, object] = {
        "concept_id": 4193704,
        "concept_name": "Glucose [Mass/volume] in Serum or Plasma",
        "vocabulary_id": "LOINC",
        "domain_id": "Measurement",
        "standard_concept": "S",
        "similarity": 0.92,
    }
    base.update(overrides)
    return ConceptCandidate(**base)  # type: ignore[arg-type]


def test_candidate_construction_valid() -> None:
    c = _candidate()
    assert c.concept_id == 4193704
    assert c.vocabulary_id == "LOINC"
    assert 0.0 <= c.similarity <= 1.0


def test_candidate_frozen() -> None:
    c = _candidate()
    with pytest.raises(ValidationError):
        c.similarity = 0.5  # type: ignore[misc]


def test_candidate_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        _candidate(extra_field="rejected")


@pytest.mark.parametrize("similarity", [-0.01, 1.01, 2.0, -1.0])
def test_candidate_similarity_must_be_in_unit_interval(similarity: float) -> None:
    with pytest.raises(ValidationError):
        _candidate(similarity=similarity)


def test_rerank_result_with_candidates() -> None:
    r = RerankResult(
        source_text="glucose",
        source_code="FAC-GLU",
        source_vocab="L",
        candidates=[_candidate()],
        rerank_model="bge-base+gpt-4o-mini@v0.1.0",
        confidence=0.91,
    )
    assert r.source_code == "FAC-GLU"
    assert len(r.candidates) == 1
    assert r.candidates[0].concept_id == 4193704


def test_rerank_result_with_zero_candidates_allowed() -> None:
    """Empty candidate list = 'no opinion'; allowed (matches harmonizer stub semantics)."""
    r = RerankResult(
        source_text="???",
        source_code="UNKNOWN",
        source_vocab="L",
        candidates=[],
        rerank_model="stub@v0.1.0",
        confidence=0.0,
    )
    assert r.candidates == []
    assert r.confidence == 0.0


def test_rerank_result_frozen() -> None:
    r = RerankResult(
        source_text="t",
        source_code="c",
        source_vocab="v",
        candidates=[],
        rerank_model="m",
        confidence=0.5,
    )
    with pytest.raises(ValidationError):
        r.confidence = 0.9  # type: ignore[misc]


def test_rerank_result_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        RerankResult(
            source_text="t",
            source_code="c",
            source_vocab="v",
            candidates=[],
            rerank_model="m",
            confidence=0.5,
            unknown_field="rejected",  # type: ignore[call-arg]
        )


@pytest.mark.parametrize("confidence", [-0.01, 1.01, 2.0, -1.0])
def test_rerank_result_confidence_must_be_in_unit_interval(confidence: float) -> None:
    with pytest.raises(ValidationError):
        RerankResult(
            source_text="t",
            source_code="c",
            source_vocab="v",
            candidates=[],
            rerank_model="m",
            confidence=confidence,
        )
