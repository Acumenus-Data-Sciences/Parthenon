"""Plan 3 Task 5: per-backend NER metrics."""

from __future__ import annotations

from runtime.nlp.eval.metrics import compute_metrics
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def test_perfect_match_yields_f1_one() -> None:
    gold = [
        {
            "start": 0,
            "end": 10,
            "text": "chest pain",
            "label": "condition",
            "concept_id": 4030518,
            "vocabulary_id": "SNOMED",
        }
    ]
    pred = NerInferenceResult(
        spans=[NerSpan(start=0, end=10, text="chest pain", label="condition")],
        mappings=[
            NerConceptMapping(
                span_index=0, concept_id=4030518, vocabulary_id="SNOMED", confidence=0.9
            )
        ],
        model_name="x",
        prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_f1 == 1.0
    assert m.concept_match_rate == 1.0
    assert m.concept_match_rate_by_vocab["SNOMED"] == 1.0


def test_no_overlap_yields_f1_zero() -> None:
    gold = [
        {
            "start": 0,
            "end": 10,
            "text": "chest pain",
            "label": "condition",
            "concept_id": 4030518,
            "vocabulary_id": "SNOMED",
        }
    ]
    pred = NerInferenceResult(
        spans=[NerSpan(start=20, end=30, text="other", label="condition")],
        mappings=[],
        model_name="x",
        prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_f1 == 0.0
    assert m.concept_match_rate == 0.0


def test_span_match_but_wrong_concept_id() -> None:
    gold = [
        {
            "start": 0,
            "end": 4,
            "text": "pain",
            "label": "condition",
            "concept_id": 1234,
            "vocabulary_id": "SNOMED",
        }
    ]
    pred = NerInferenceResult(
        spans=[NerSpan(start=0, end=4, text="pain", label="condition")],
        mappings=[
            NerConceptMapping(span_index=0, concept_id=9999, vocabulary_id="SNOMED", confidence=0.5)
        ],
        model_name="x",
        prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_f1 == 1.0
    assert m.concept_match_rate == 0.0


def test_partial_overlap_counts_as_match() -> None:
    gold = [
        {
            "start": 0,
            "end": 10,
            "text": "chest pain",
            "label": "condition",
            "concept_id": 1,
            "vocabulary_id": "SNOMED",
        }
    ]
    pred = NerInferenceResult(
        spans=[NerSpan(start=6, end=10, text="pain", label="condition")],
        mappings=[],
        model_name="x",
        prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_recall == 1.0


def test_extra_predictions_lower_precision() -> None:
    gold = [
        {
            "start": 0,
            "end": 4,
            "text": "pain",
            "label": "condition",
            "concept_id": 1,
            "vocabulary_id": "SNOMED",
        }
    ]
    pred = NerInferenceResult(
        spans=[
            NerSpan(start=0, end=4, text="pain", label="condition"),
            NerSpan(start=10, end=14, text="ache", label="condition"),
        ],
        mappings=[
            NerConceptMapping(span_index=0, concept_id=1, vocabulary_id="SNOMED", confidence=1.0)
        ],
        model_name="x",
        prompt_version="v0.1.0",
    )
    m = compute_metrics(gold=gold, pred=pred)
    assert m.span_recall == 1.0
    assert m.span_precision == 0.5
