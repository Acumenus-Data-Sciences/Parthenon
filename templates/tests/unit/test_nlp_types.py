"""NerSpan + NerConceptMapping + NerInferenceResult Pydantic types."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def test_ner_span_validates_offsets() -> None:
    span = NerSpan(start=0, end=10, text="chest pain", label="condition")
    assert span.start == 0
    assert span.end == 10


def test_ner_span_rejects_inverted_offsets() -> None:
    with pytest.raises(ValidationError):
        NerSpan(start=14, end=0, text="x", label="condition")


def test_ner_span_rejects_equal_offsets() -> None:
    with pytest.raises(ValidationError):
        NerSpan(start=5, end=5, text="x", label="condition")


def test_ner_concept_mapping_carries_vocab_name() -> None:
    mapping = NerConceptMapping(
        span_index=0,
        concept_id=4030518,
        vocabulary_id="SNOMED",
        confidence=0.93,
    )
    assert mapping.vocabulary_id == "SNOMED"
    assert mapping.confidence == 0.93


def test_ner_concept_mapping_rejects_out_of_range_confidence() -> None:
    with pytest.raises(ValidationError):
        NerConceptMapping(span_index=0, concept_id=1, vocabulary_id="SNOMED", confidence=1.5)


def test_ner_inference_result_aggregates() -> None:
    result = NerInferenceResult(
        spans=[NerSpan(start=0, end=10, text="chest pain", label="condition")],
        mappings=[
            NerConceptMapping(
                span_index=0, concept_id=4030518, vocabulary_id="SNOMED", confidence=0.93
            )
        ],
        model_name="medgemma:7b",
        prompt_version="v0.1.0",
    )
    assert len(result.spans) == 1
    assert result.model_name == "medgemma:7b"


def test_ner_inference_result_forbids_extra_fields() -> None:
    with pytest.raises(ValidationError):
        NerInferenceResult(  # type: ignore[call-arg]
            spans=[],
            mappings=[],
            model_name="x",
            prompt_version="v0.1.0",
            extra_field="not allowed",
        )
