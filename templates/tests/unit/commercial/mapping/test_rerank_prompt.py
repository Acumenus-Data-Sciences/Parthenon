"""Phase 3 Plan 6 Task 7 (T-024A): concept_rerank prompt + schema."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

_PROMPT_DIR = Path(__file__).resolve().parents[4] / "runtime" / "nlp" / "prompts" / "v0.1.0"
_PROMPT = _PROMPT_DIR / "concept_rerank.md"
_SCHEMA = _PROMPT_DIR / "concept_rerank.schema.json"


def _load_schema() -> dict[str, object]:
    return json.loads(_SCHEMA.read_text(encoding="utf-8"))


def test_prompt_exists() -> None:
    assert _PROMPT.is_file()


def test_schema_exists() -> None:
    assert _SCHEMA.is_file()


def test_prompt_has_system_section() -> None:
    text = _PROMPT.read_text(encoding="utf-8")
    assert "## SYSTEM" in text


def test_prompt_has_user_template_section() -> None:
    text = _PROMPT.read_text(encoding="utf-8")
    assert "## USER" in text
    # Template variables present.
    assert "{{source_text}}" in text
    assert "{{source_code}}" in text
    assert "{{source_vocab}}" in text
    assert "{{candidates_json}}" in text


def test_prompt_documents_no_fabrication_rule() -> None:
    """Plan 6: 'NEVER fabricate a concept_id...' is the critical safety rule."""
    text = _PROMPT.read_text(encoding="utf-8")
    assert "NEVER fabricate" in text or "never fabricate" in text.lower()


def test_prompt_includes_few_shot_examples() -> None:
    text = _PROMPT.read_text(encoding="utf-8")
    assert "FEW-SHOT EXAMPLES" in text
    assert "Example 1" in text
    assert "Example 2" in text
    assert "Example 3" in text


def test_schema_is_valid_jsonschema() -> None:
    schema = _load_schema()
    # Self-consistency: the schema describes a valid Draft 2020-12 metaschema instance.
    jsonschema.Draft202012Validator.check_schema(schema)


def test_schema_top_level_required_fields() -> None:
    schema = _load_schema()
    required = schema["required"]
    assert isinstance(required, list)
    assert "ranked" in required
    assert "confidence" in required


def test_schema_ranked_array_max_5() -> None:
    schema = _load_schema()
    ranked = schema["properties"]["ranked"]
    assert ranked["minItems"] == 1
    assert ranked["maxItems"] == 5


def test_schema_per_item_concept_id_integer() -> None:
    schema = _load_schema()
    item_schema = schema["properties"]["ranked"]["items"]
    assert item_schema["properties"]["concept_id"]["type"] == "integer"


def test_schema_per_item_score_in_unit_interval() -> None:
    schema = _load_schema()
    score = schema["properties"]["ranked"]["items"]["properties"]["score"]
    assert score["minimum"] == 0.0
    assert score["maximum"] == 1.0


def test_schema_confidence_in_unit_interval() -> None:
    schema = _load_schema()
    confidence = schema["properties"]["confidence"]
    assert confidence["minimum"] == 0.0
    assert confidence["maximum"] == 1.0


def test_valid_response_passes_schema() -> None:
    schema = _load_schema()
    response = {
        "ranked": [
            {"concept_id": 4193704, "score": 0.95, "rationale": "exact LOINC match"},
            {"concept_id": 33747003, "score": 0.62, "rationale": "SNOMED parent"},
        ],
        "confidence": 0.91,
        "rerank_model": "gpt-4o-mini@concept_rerank-v0.1.0",
    }
    jsonschema.Draft202012Validator(schema).validate(response)


def test_invalid_response_fails_schema() -> None:
    schema = _load_schema()
    bad = {
        "ranked": [{"concept_id": "not-an-int", "score": 0.5}],
        "confidence": 1.5,  # > 1.0
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(bad)


def test_response_with_too_many_ranked_fails_schema() -> None:
    """maxItems = 5; 6+ items rejects."""
    schema = _load_schema()
    too_many = {
        "ranked": [{"concept_id": i, "score": 0.5} for i in range(6)],
        "confidence": 0.5,
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(too_many)
