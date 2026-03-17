"""Tests for Phase 5 high-risk tools: modify, analysis, and SQL (Task 3)."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agency.tools.modify_tools import (
    execute_modify_concept_set,
    execute_modify_cohort_criteria,
)
from app.agency.tools.analysis_tools import (
    execute_run_characterization,
    execute_run_incidence_analysis,
)
from app.agency.tools.sql_tools import (
    validate_sql_safety,
    execute_sql,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_api(responses: list[dict[str, Any]]) -> Any:
    """Return a mock AgencyApiClient whose call() yields *responses* in order."""
    client = MagicMock()
    client.call = AsyncMock(side_effect=responses)
    return client


# ---------------------------------------------------------------------------
# modify_concept_set
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_modify_concept_set_success() -> None:
    """execute_modify_concept_set adds items via POST and removes via DELETE."""
    api = _mock_api([
        {"success": True, "status": 201, "data": {"id": 101}},   # add item 1
        {"success": True, "status": 200, "data": {}},             # remove item 50
    ])
    result = await execute_modify_concept_set(
        api_client=api,
        params={
            "concept_set_id": 10,
            "add_items": [{"concept_id": 201826, "include_descendants": True}],
            "remove_item_ids": [50],
        },
        auth_token="tok_test",
    )
    assert result["success"] is True
    assert result["concept_set_id"] == 10
    assert result["added"] == 1
    assert result["removed"] == 1


# ---------------------------------------------------------------------------
# modify_cohort_criteria
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_modify_cohort_criteria_success() -> None:
    """execute_modify_cohort_criteria sends PUT with updated expression."""
    api = _mock_api([
        {"success": True, "status": 200, "data": {"id": 7, "name": "Diabetics"}},
    ])
    result = await execute_modify_cohort_criteria(
        api_client=api,
        params={
            "cohort_definition_id": 7,
            "expression": {"PrimaryCriteria": {"CriteriaList": []}},
        },
        auth_token="tok_test",
    )
    assert result["success"] is True
    assert result["cohort_definition_id"] == 7
    # Verify it used PUT
    call_args = api.call.call_args
    assert call_args.args[0] == "PUT"


# ---------------------------------------------------------------------------
# run_characterization
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_characterization_success() -> None:
    """execute_run_characterization returns analysis_id on 202 acceptance."""
    api = _mock_api([
        {"success": True, "status": 202, "data": {"id": 55}},
    ])
    result = await execute_run_characterization(
        api_client=api,
        params={"cohort_definition_id": 7, "source_id": 1},
        auth_token="tok_test",
    )
    assert result["success"] is True
    assert result["analysis_id"] == 55
    # Confirm payload included type=characterization
    call_args = api.call.call_args
    assert call_args.kwargs.get("data", {}).get("type") == "characterization"


# ---------------------------------------------------------------------------
# run_incidence_analysis
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_incidence_analysis_success() -> None:
    """execute_run_incidence_analysis returns analysis_id on 202 acceptance."""
    api = _mock_api([
        {"success": True, "status": 202, "data": {"id": 88}},
    ])
    result = await execute_run_incidence_analysis(
        api_client=api,
        params={
            "target_cohort_id": 10,
            "outcome_cohort_id": 20,
            "source_id": 1,
        },
        auth_token="tok_test",
    )
    assert result["success"] is True
    assert result["analysis_id"] == 88
    call_args = api.call.call_args
    assert call_args.kwargs.get("data", {}).get("type") == "incidence_rate"


# ---------------------------------------------------------------------------
# validate_sql_safety
# ---------------------------------------------------------------------------


def test_validate_sql_safety_select_true() -> None:
    """Pure SELECT queries are safe."""
    assert validate_sql_safety("SELECT * FROM cdm.person WHERE person_id = 1") is True


def test_validate_sql_safety_insert_false() -> None:
    """INSERT queries are blocked."""
    assert validate_sql_safety("INSERT INTO cdm.person (person_id) VALUES (1)") is False


def test_validate_sql_safety_update_false() -> None:
    """UPDATE queries are blocked."""
    assert validate_sql_safety("UPDATE cdm.person SET gender_concept_id = 8507") is False


def test_validate_sql_safety_delete_false() -> None:
    """DELETE queries are blocked."""
    assert validate_sql_safety("DELETE FROM cdm.person WHERE person_id = 1") is False


def test_validate_sql_safety_drop_false() -> None:
    """DROP statements are blocked."""
    assert validate_sql_safety("DROP TABLE cdm.person") is False


def test_validate_sql_safety_truncate_false() -> None:
    """TRUNCATE statements are blocked."""
    assert validate_sql_safety("TRUNCATE TABLE cdm.person") is False


# ---------------------------------------------------------------------------
# execute_sql
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_sql_safe_query_succeeds() -> None:
    """A safe SELECT query is forwarded to the API and returns rows."""
    api = _mock_api([
        {"success": True, "status": 200, "data": {"rows": [{"person_id": 1}]}},
    ])
    result = await execute_sql(
        api_client=api,
        params={"query": "SELECT person_id FROM cdm.person LIMIT 1"},
        auth_token="tok_test",
    )
    assert result["success"] is True
    assert len(result["rows"]) == 1


@pytest.mark.asyncio
async def test_execute_sql_unsafe_query_blocked() -> None:
    """A DROP query is blocked before the API is called."""
    api = _mock_api([])  # Should never be called
    result = await execute_sql(
        api_client=api,
        params={"query": "DROP TABLE cdm.person"},
        auth_token="tok_test",
    )
    assert result["success"] is False
    assert result.get("blocked") is True
    api.call.assert_not_called()
