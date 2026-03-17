"""Tests for Phase 4 action tools (Task 7)."""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agency.tools.concept_set_tools import execute_create_concept_set
from app.agency.tools.cohort_tools import (
    execute_clone_cohort,
    execute_create_cohort_definition,
    execute_generate_cohort,
)
from app.agency.tools.query_tools import execute_compare_cohorts, execute_export_results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_api(responses: list[dict[str, Any]]) -> Any:
    """Return a mock AgencyApiClient whose call() yields *responses* in order."""
    client = MagicMock()
    client.call = AsyncMock(side_effect=responses)
    return client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_concept_set() -> None:
    """execute_create_concept_set should return concept_set_id on success."""
    api = _mock_api([
        {"success": True, "status": 201, "data": {"id": 42, "name": "My Set"}},
    ])
    result = await execute_create_concept_set(
        api_client=api,
        params={"name": "My Set", "description": "A test concept set"},
        auth_token="tok_abc",
    )
    assert result["success"] is True
    assert result["concept_set_id"] == 42


@pytest.mark.asyncio
async def test_create_concept_set_with_items() -> None:
    """Adding items should call the API 3 times: 1 create + 2 add-item calls."""
    api = _mock_api([
        {"success": True, "status": 201, "data": {"id": 10, "name": "Set"}},
        {"success": True, "status": 201, "data": {"id": 1}},
        {"success": True, "status": 201, "data": {"id": 2}},
    ])
    result = await execute_create_concept_set(
        api_client=api,
        params={
            "name": "Set",
            "items": [
                {"concept_id": 123, "include_descendants": True},
                {"concept_id": 456, "include_descendants": False},
            ],
        },
        auth_token="tok_abc",
    )
    assert result["success"] is True
    assert result["concept_set_id"] == 10
    assert api.call.call_count == 3


@pytest.mark.asyncio
async def test_create_cohort_definition() -> None:
    """execute_create_cohort_definition should return cohort_definition_id."""
    api = _mock_api([
        {"success": True, "status": 201, "data": {"id": 7, "name": "Diabetics"}},
    ])
    result = await execute_create_cohort_definition(
        api_client=api,
        params={"name": "Diabetics", "description": "Type 2 diabetes cohort"},
        auth_token="tok_xyz",
    )
    assert result["success"] is True
    assert result["cohort_definition_id"] == 7


@pytest.mark.asyncio
async def test_generate_cohort() -> None:
    """execute_generate_cohort should return a generation_id on 202 response."""
    api = _mock_api([
        {"success": True, "status": 202, "data": {"generation_id": 99}},
    ])
    result = await execute_generate_cohort(
        api_client=api,
        params={"cohort_definition_id": 7, "data_source_id": 1},
        auth_token="tok_xyz",
    )
    assert result["success"] is True
    assert result["generation_id"] == 99


@pytest.mark.asyncio
async def test_compare_cohorts() -> None:
    """execute_compare_cohorts should fetch both cohorts and return combined data."""
    cohort_a = {"id": 1, "name": "Cohort A", "count": 100}
    cohort_b = {"id": 2, "name": "Cohort B", "count": 200}
    api = _mock_api([
        {"success": True, "status": 200, "data": cohort_a},
        {"success": True, "status": 200, "data": cohort_b},
    ])
    result = await execute_compare_cohorts(
        api_client=api,
        params={"cohort_a_id": 1, "cohort_b_id": 2},
        auth_token="tok_abc",
    )
    assert result["success"] is True
    assert result["cohort_a"] == cohort_a
    assert result["cohort_b"] == cohort_b
    assert api.call.call_count == 2
