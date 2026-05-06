"""Phase 3 Plan 6 Task 8 (T-024A): ConceptReranker via LLM."""

from __future__ import annotations

from typing import Any

from runtime.commercial.mapping.reranker import (
    GRACEFUL_DEGRADE_DISCOUNT,
    ConceptReranker,
)
from runtime.commercial.mapping.types import ConceptCandidate


def _cand(
    concept_id: int = 4193704,
    concept_name: str = "Glucose",
    similarity: float = 0.91,
) -> ConceptCandidate:
    return ConceptCandidate(
        concept_id=concept_id,
        concept_name=concept_name,
        vocabulary_id="LOINC",
        domain_id="Measurement",
        standard_concept="S",
        similarity=similarity,
    )


def _make_llm_response(
    ranked: list[dict[str, Any]] | None = None,
    confidence: float = 0.92,
    rerank_model: str = "fake-llm@v0.1.0",
) -> dict[str, Any]:
    if ranked is None:
        ranked = [
            {"concept_id": 4193704, "score": 0.95, "rationale": "exact"},
            {"concept_id": 99, "score": 0.55},
        ]
    return {"ranked": ranked, "confidence": confidence, "rerank_model": rerank_model}


def test_rerank_with_no_candidates_returns_empty_result() -> None:
    r = ConceptReranker()
    out = r.rerank(
        source_text="???",
        source_code="UNKNOWN",
        source_vocab="L",
        candidates=[],
    )
    assert out.candidates == []
    assert out.confidence == 0.0


def test_rerank_with_no_llm_degrades_to_retriever_order() -> None:
    """Confidence = top1.similarity * 0.7 when LLM is absent."""
    r = ConceptReranker(llm_callable=None)
    cands = [_cand(concept_id=1, similarity=0.9), _cand(concept_id=2, similarity=0.7)]
    out = r.rerank(
        source_text="glucose",
        source_code="FAC-GLU",
        source_vocab="L",
        candidates=cands,
    )
    assert out.candidates == cands  # order preserved
    assert out.confidence == 0.9 * GRACEFUL_DEGRADE_DISCOUNT
    assert out.rerank_model.endswith("+degraded")


def test_rerank_with_llm_returns_reranked_candidates() -> None:
    captured: dict[str, Any] = {}

    def fake_llm(prompt: str, version: str) -> dict[str, Any]:
        captured["prompt"] = prompt
        captured["version"] = version
        return _make_llm_response()

    r = ConceptReranker(llm_callable=fake_llm)
    cands = [
        _cand(concept_id=99, concept_name="Glucose toxicity", similarity=0.88),
        _cand(concept_id=4193704, concept_name="Glucose", similarity=0.85),
    ]
    out = r.rerank(
        source_text="glucose",
        source_code="FAC-GLU",
        source_vocab="L",
        candidates=cands,
    )
    # LLM reranked 4193704 to top-1.
    assert out.candidates[0].concept_id == 4193704
    assert out.confidence == 0.92
    assert out.rerank_model == "fake-llm@v0.1.0"
    # Prompt rendered the user template.
    assert "FAC-GLU" in captured["prompt"]


def test_rerank_drops_fabricated_concept_ids() -> None:
    """The SYSTEM prompt forbids fabrication; if LLM violates, drop them."""

    def fake_llm(prompt: str, version: str) -> dict[str, Any]:
        # concept_id=999999 is NOT in the input candidates list.
        return _make_llm_response(
            ranked=[
                {"concept_id": 999999, "score": 0.99},  # fabricated
                {"concept_id": 4193704, "score": 0.85},  # real
            ]
        )

    r = ConceptReranker(llm_callable=fake_llm)
    cands = [_cand(concept_id=4193704, similarity=0.8)]
    out = r.rerank(
        source_text="glucose",
        source_code="FAC-GLU",
        source_vocab="L",
        candidates=cands,
    )
    assert len(out.candidates) == 1
    assert out.candidates[0].concept_id == 4193704


def test_rerank_all_fabricated_falls_back_to_degrade() -> None:
    def fake_llm(prompt: str, version: str) -> dict[str, Any]:
        return _make_llm_response(ranked=[{"concept_id": 999999, "score": 0.99}])

    r = ConceptReranker(llm_callable=fake_llm)
    cands = [_cand(concept_id=4193704, similarity=0.8)]
    out = r.rerank(
        source_text="glucose",
        source_code="FAC-GLU",
        source_vocab="L",
        candidates=cands,
    )
    assert out.rerank_model.endswith("+degraded")
    assert out.candidates[0].concept_id == 4193704


def test_rerank_llm_exception_degrades_gracefully() -> None:
    def boom(prompt: str, version: str) -> dict[str, Any]:
        raise RuntimeError("LLM API down")

    r = ConceptReranker(llm_callable=boom)
    cands = [_cand(concept_id=4193704, similarity=0.92)]
    out = r.rerank(
        source_text="glucose",
        source_code="FAC-GLU",
        source_vocab="L",
        candidates=cands,
    )
    assert out.rerank_model.endswith("+degraded")
    assert out.confidence == 0.92 * GRACEFUL_DEGRADE_DISCOUNT


def test_rerank_clamps_confidence_to_unit_interval() -> None:
    def overflow(prompt: str, version: str) -> dict[str, Any]:
        return _make_llm_response(confidence=1.5)  # impossible but defensive

    r = ConceptReranker(llm_callable=overflow)
    cands = [_cand(concept_id=4193704, similarity=0.8)]
    out = r.rerank(
        source_text="t",
        source_code="c",
        source_vocab="v",
        candidates=cands,
    )
    assert out.confidence == 1.0


def test_rerank_invalid_confidence_type_defaults_to_zero() -> None:
    def garbage(prompt: str, version: str) -> dict[str, Any]:
        return _make_llm_response(confidence="oops")  # type: ignore[arg-type]

    r = ConceptReranker(llm_callable=garbage)
    cands = [_cand(concept_id=4193704, similarity=0.8)]
    out = r.rerank(
        source_text="t",
        source_code="c",
        source_vocab="v",
        candidates=cands,
    )
    assert out.confidence == 0.0


def test_rerank_llm_returns_none_falls_back_to_degrade() -> None:
    def returns_none(prompt: str, version: str) -> dict[str, Any] | None:
        return None

    r = ConceptReranker(llm_callable=returns_none)
    cands = [_cand(concept_id=4193704, similarity=0.6)]
    out = r.rerank(
        source_text="t",
        source_code="c",
        source_vocab="v",
        candidates=cands,
    )
    assert out.rerank_model.endswith("+degraded")
    assert out.confidence == 0.6 * GRACEFUL_DEGRADE_DISCOUNT


def test_rerank_caps_at_top_n() -> None:
    def fake_llm(prompt: str, version: str) -> dict[str, Any]:
        return _make_llm_response(
            ranked=[{"concept_id": i, "score": 0.5 - i * 0.05} for i in range(1, 11)]
        )

    r = ConceptReranker(llm_callable=fake_llm, top_n=5)
    cands = [_cand(concept_id=i, similarity=0.5) for i in range(1, 11)]
    out = r.rerank(
        source_text="t",
        source_code="c",
        source_vocab="v",
        candidates=cands,
    )
    assert len(out.candidates) == 5


def test_rerank_default_top_n_is_5() -> None:
    """Plan 6: 'returns ranked top-5'."""
    from runtime.commercial.mapping.reranker import DEFAULT_TOP_N

    assert DEFAULT_TOP_N == 5
