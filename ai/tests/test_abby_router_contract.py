"""Contract tests for the abby router.

Verifies the HTTP contract for key Abby endpoints (/abby/parse-cohort).
The underlying Ollama call is mocked so these tests run without a live
LLM. They validate request validation, response shape, and basic
fallback behaviour when the LLM returns unparseable output.

See `ai/app/routers/abby.py` for the live router source.
"""

import json
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _canned_parse_response() -> str:
    return json.dumps(
        {
            "cohort_name": "Type 2 Diabetes Adults",
            "cohort_description": "Adults aged 40-80 with T2DM",
            "demographics": {
                "sex": [],
                "age_min": 40,
                "age_max": 80,
                "race": [],
                "ethnicity": [],
                "location_state": [],
            },
            "terms": [
                {
                    "text": "type 2 diabetes mellitus",
                    "domain": "condition",
                    "role": "entry",
                    "negated": False,
                }
            ],
            "temporal": {
                "washout_days": 365,
                "within_days": None,
                "index_date_offset": 0,
            },
            "study_design": "incident",
            "confidence": 0.92,
            "warnings": [],
        }
    )


@patch("app.routers.abby.call_ollama", new_callable=AsyncMock)
def test_parse_cohort_contract_returns_structured_cohort_spec(
    mock_call_ollama: AsyncMock,
) -> None:
    """POST /abby/parse-cohort returns the structured CohortParseResponse shape."""
    mock_call_ollama.return_value = _canned_parse_response()

    response = client.post(
        "/abby/parse-cohort",
        json={
            "prompt": "Adults aged 40-80 with type 2 diabetes, incident",
            "page_context": "cohort-builder",
        },
    )
    assert response.status_code == 200
    body = response.json()
    # Top-level contract shape
    expected_keys = {
        "cohort_name",
        "cohort_description",
        "demographics",
        "terms",
        "temporal",
        "study_design",
        "confidence",
        "warnings",
        "raw_llm_output",
    }
    assert expected_keys.issubset(set(body.keys()))
    assert body["cohort_name"] == "Type 2 Diabetes Adults"
    assert isinstance(body["terms"], list)
    assert len(body["terms"]) == 1
    assert body["terms"][0]["domain"] == "condition"
    assert body["demographics"]["age_min"] == 40
    assert body["temporal"]["washout_days"] == 365


def test_parse_cohort_contract_missing_prompt_returns_422() -> None:
    """POST /abby/parse-cohort with no prompt returns 422 validation error."""
    response = client.post("/abby/parse-cohort", json={})
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body


def test_parse_cohort_contract_short_prompt_returns_422() -> None:
    """Prompts shorter than 5 chars are rejected by Pydantic validation."""
    response = client.post(
        "/abby/parse-cohort",
        json={"prompt": "hi"},
    )
    assert response.status_code == 422


@patch("app.routers.abby.call_ollama", new_callable=AsyncMock)
def test_parse_cohort_contract_falls_back_when_llm_returns_garbage(
    mock_call_ollama: AsyncMock,
) -> None:
    """When the LLM output is not valid JSON the endpoint returns a fallback shape."""
    mock_call_ollama.return_value = "not-json at all"

    response = client.post(
        "/abby/parse-cohort",
        json={
            "prompt": "Some cohort description that is long enough",
            "page_context": "cohort-builder",
        },
    )
    assert response.status_code == 200
    body = response.json()
    # Fallback contract: same shape, with zero confidence and a warning
    assert body["confidence"] == 0.0
    assert isinstance(body["warnings"], list)
    assert len(body["warnings"]) >= 1
    assert body["cohort_name"] == "Unnamed Cohort"
