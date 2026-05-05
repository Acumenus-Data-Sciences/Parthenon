"""SciSpaCy NER sidecar — HTTP shim matching parthenon-ai-service contract.

Loads en_core_sci_md once at module import time. Each /v1/ner/infer request
runs the loaded NER pipeline against the input text and returns the same
JSON shape the LLM backend produces, so SciSpacyBackend is a drop-in
plug-in for NlpBackend.

v0.1 ships span extraction only; concept_id mappings via the SciSpaCy
UMLS linker is a Phase 3 follow-up (ADR 0012).
"""

from __future__ import annotations

import os
from typing import Any

import spacy
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

_MODEL_NAME = os.environ.get("SCISPACY_MODEL", "en_core_sci_md")
_NLP = spacy.load(_MODEL_NAME)

app = FastAPI(title="parthenon-scispacy")


class InferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    model: str = _MODEL_NAME
    # `prompt` is accepted for contract parity with the LLM backend even
    # though SciSpaCy ignores it. Recorded in the audit trail upstream.
    prompt: str | None = None


class Span(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: int
    end: int
    text: str
    label: str


class Mapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    span_index: int
    concept_id: int
    vocabulary_id: str
    confidence: float


class InferResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    spans: list[Span]
    mappings: list[Mapping]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": _MODEL_NAME}


@app.post("/v1/ner/infer", response_model=InferResponse)
def infer(req: InferRequest) -> InferResponse:
    doc = _NLP(req.text)
    spans: list[Span] = []
    for ent in doc.ents:
        spans.append(
            Span(
                start=int(ent.start_char),
                end=int(ent.end_char),
                text=str(ent.text),
                label=_label_to_omop_domain(ent.label_),
            )
        )
    return InferResponse(spans=spans, mappings=[])


def _label_to_omop_domain(label: str) -> str:
    """Map SciSpaCy entity labels to the four labels NoteNlpNode expects."""
    upper = label.upper()
    if upper in ("DISEASE", "CONDITION", "DISORDER"):
        return "condition"
    if upper in ("CHEMICAL", "DRUG", "MEDICATION"):
        return "drug"
    if upper == "PROCEDURE":
        return "procedure"
    if upper in ("TEST", "MEASUREMENT", "FINDING"):
        return "measurement"
    return "condition"
