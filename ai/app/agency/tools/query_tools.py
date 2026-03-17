"""Query tools — agency executors for read-only comparison and export operations.

Each function follows the standard tool executor signature::

    async def execute_*(api_client, params, auth_token) -> dict

Return value schema:

* Success (compare): ``{"success": True, "cohort_a": <dict>, "cohort_b": <dict>, "message": <str>}``
* Success (export): ``{"success": True, "entity": <dict>, "message": <str>}``
* Failure: ``{"success": False, "error": <str>}``
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def execute_compare_cohorts(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Retrieve two cohort definitions and return them for side-by-side comparison.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``cohort_a_id`` (int, required) — First cohort definition ID.
        * ``cohort_b_id`` (int, required) — Second cohort definition ID.
    auth_token:
        Sanctum Bearer token.

    Returns
    -------
    dict
        ``{"success": True, "cohort_a": <dict>, "cohort_b": <dict>, "message": <str>}``
        or ``{"success": False, "error": <str>}``.
    """
    cohort_a_id: int = params["cohort_a_id"]
    cohort_b_id: int = params["cohort_b_id"]

    result_a = await api_client.call(
        "GET",
        f"/cohort-definitions/{cohort_a_id}",
        auth_token,
    )
    if not result_a.get("success"):
        return {
            "success": False,
            "error": result_a.get("error", f"Failed to fetch cohort {cohort_a_id}"),
        }

    result_b = await api_client.call(
        "GET",
        f"/cohort-definitions/{cohort_b_id}",
        auth_token,
    )
    if not result_b.get("success"):
        return {
            "success": False,
            "error": result_b.get("error", f"Failed to fetch cohort {cohort_b_id}"),
        }

    return {
        "success": True,
        "cohort_a": result_a["data"],
        "cohort_b": result_b["data"],
        "message": (
            f"Compared cohort definitions {cohort_a_id} and {cohort_b_id}"
        ),
    }


async def execute_export_results(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Export cohort or analysis results.

    Fetches the entity from ``/<entity_type>/<entity_id>`` and returns the
    payload.  The Laravel backend handles format-specific serialisation via
    an ``Accept`` or ``format`` query parameter if provided.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``entity_type`` (str, required) — Pluralised resource type, e.g.
          ``"cohort-definitions"`` or ``"analyses"``.
        * ``entity_id`` (int, required) — ID of the entity to export.
        * ``format`` (str, optional) — ``"csv"`` or ``"json"`` (default
          ``"json"``).
    auth_token:
        Sanctum Bearer token.

    Returns
    -------
    dict
        ``{"success": True, "entity": <dict>, "message": <str>}``
        or ``{"success": False, "error": <str>}``.
    """
    entity_type: str = params["entity_type"]
    entity_id: int = params["entity_id"]
    export_format: str = params.get("format", "json")

    path = f"/{entity_type}/{entity_id}"
    if export_format != "json":
        path += f"?format={export_format}"

    result = await api_client.call(
        "GET",
        path,
        auth_token,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", f"Failed to export {entity_type}/{entity_id}"),
        }

    return {
        "success": True,
        "entity": result["data"],
        "message": (
            f"Exported {entity_type} {entity_id} as {export_format}"
        ),
    }
