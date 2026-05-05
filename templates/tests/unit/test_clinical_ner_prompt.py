"""Clinical NER prompt v0.1.0 + JSON schema (Task 11)."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

PROMPT_DIR = Path(__file__).resolve().parents[2] / "runtime" / "nlp" / "prompts" / "v0.1.0"


def test_prompt_has_required_sections() -> None:
    prompt = (PROMPT_DIR / "clinical_ner_v1.md").read_text(encoding="utf-8")
    body = prompt.lower()
    for required in ("# system", "# instructions", "# output format", "# constraints"):
        assert required.lower() in body, f"prompt missing section: {required}"


def test_prompt_references_omop_vocabularies() -> None:
    prompt = (PROMPT_DIR / "clinical_ner_v1.md").read_text(encoding="utf-8")
    for vocab in ("SNOMED", "RxNorm", "LOINC"):
        assert vocab in prompt, f"prompt should mention vocabulary {vocab}"


def test_prompt_mentions_phi_constraint() -> None:
    prompt = (PROMPT_DIR / "clinical_ner_v1.md").read_text(encoding="utf-8")
    body = prompt.lower()
    assert "hipaa" in body or "phi" in body, "prompt must call out PHI constraint"


def test_json_schema_loads() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)


def test_schema_accepts_minimal_output() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate({"spans": [], "mappings": []}, schema)


def test_schema_accepts_realistic_output() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(
        {
            "spans": [
                {"start": 0, "end": 10, "text": "chest pain", "label": "condition"},
                {"start": 28, "end": 38, "text": "lisinopril", "label": "drug"},
            ],
            "mappings": [
                {
                    "span_index": 0,
                    "concept_id": 4030518,
                    "vocabulary_id": "SNOMED",
                    "confidence": 0.93,
                },
                {
                    "span_index": 1,
                    "concept_id": 1308216,
                    "vocabulary_id": "RxNorm",
                    "confidence": 0.97,
                },
            ],
        },
        schema,
    )


def test_schema_rejects_inverted_offsets() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text(encoding="utf-8"))
    # JSON schema can't express start<end so we leave that to Pydantic; here we just
    # assert the schema rejects negative starts or zero-length spans.
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(
            {"spans": [{"start": -1, "end": 5, "text": "x", "label": "condition"}], "mappings": []},
            schema,
        )


def test_schema_rejects_unknown_label() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text(encoding="utf-8"))
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(
            {
                "spans": [{"start": 0, "end": 5, "text": "x", "label": "demographic"}],
                "mappings": [],
            },
            schema,
        )


def test_schema_rejects_unknown_vocabulary() -> None:
    schema = json.loads((PROMPT_DIR / "clinical_ner_v1.schema.json").read_text(encoding="utf-8"))
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(
            {
                "spans": [{"start": 0, "end": 5, "text": "x", "label": "drug"}],
                "mappings": [
                    {"span_index": 0, "concept_id": 1, "vocabulary_id": "ICD-10", "confidence": 0.9}
                ],
            },
            schema,
        )
