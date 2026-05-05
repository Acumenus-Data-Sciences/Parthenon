"""Typed Pydantic models for clinical NER results.

Spans carry character offsets + the matched substring + a coarse domain
label (one of ``condition`` | ``drug`` | ``procedure`` | ``measurement``).
Concept mappings link a span (by index into the spans list) to an OMOP
concept_id with a confidence score and the source vocabulary the
concept_id resolves into.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class NerSpan(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    start: int = Field(ge=0, description="Character offset, inclusive.")
    end: int = Field(gt=0, description="Character offset, exclusive.")
    text: str
    label: str

    @model_validator(mode="after")
    def _check_offsets(self) -> NerSpan:
        if self.start >= self.end:
            raise ValueError(f"start ({self.start}) must be < end ({self.end})")
        return self


class NerConceptMapping(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    span_index: int = Field(ge=0)
    concept_id: int
    vocabulary_id: str
    confidence: float = Field(ge=0.0, le=1.0)


class NerInferenceResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spans: list[NerSpan]
    mappings: list[NerConceptMapping]
    model_name: str
    prompt_version: str
