"""Phase 3 Plan 5 Task 9 (T-023): LoincHarmonizer protocol + stub."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from runtime.lab.harmonizer import LoincHarmonizer, LoincHarmonizerStub, Suggestion


def test_stub_returns_empty_suggestion_list() -> None:
    h = LoincHarmonizerStub()
    out = h.suggest("FAC-GLU", "Facility glucose panel", ["mg/dL"])
    assert out == []


def test_stub_conforms_to_loinc_harmonizer_protocol() -> None:
    """Runtime-checkable: callers can ``isinstance(x, LoincHarmonizer)``."""
    assert isinstance(LoincHarmonizerStub(), LoincHarmonizer)


def test_suggestion_is_frozen() -> None:
    s = Suggestion(loinc_code="2345-7", loinc_text="Glucose", score=0.91)
    with pytest.raises(ValidationError):
        s.score = 0.5  # type: ignore[misc]


def test_suggestion_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        Suggestion(
            loinc_code="2345-7",
            loinc_text="Glucose",
            score=0.91,
            extra_field="rejected",  # type: ignore[call-arg]
        )


@pytest.mark.parametrize("score", [-0.01, 1.01, 2.5, -10.0])
def test_suggestion_score_must_be_in_unit_interval(score: float) -> None:
    with pytest.raises(ValidationError):
        Suggestion(loinc_code="2345-7", loinc_text="Glucose", score=score)


def test_suggestion_rationale_default_empty() -> None:
    s = Suggestion(loinc_code="2345-7", loinc_text="Glucose", score=0.5)
    assert s.rationale == ""


def test_stub_handles_empty_examples_list() -> None:
    h = LoincHarmonizerStub()
    assert h.suggest("FAC-GLU", "Facility glucose", []) == []


def test_protocol_signature_accepts_keyword_args() -> None:
    """Future implementations must accept all 3 args; stub follows shape."""
    h: LoincHarmonizer = LoincHarmonizerStub()
    out = h.suggest(local_code="FAC-K", local_text="Potassium", examples=["mmol/L"])
    assert out == []
