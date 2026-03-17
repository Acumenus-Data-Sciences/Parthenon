"""Cohort tools — agency executors for cohort definition operations.

Each function follows the standard tool executor signature::

    async def execute_*(api_client, params, auth_token) -> dict

Return value schema:

* Success (create/generate): ``{"success": True, "<id_key>": <int>, "message": <str>}``
* Success (clone): ``{"success": True, "cohort_definition_id": <int>, "message": <str>}``
* Failure: ``{"success": False, "error": <str>}``
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def execute_create_cohort_definition(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Create a new cohort definition.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``name`` (str, required) — Display name.
        * ``description`` (str, optional) — Descriptive text.
        * ``expression`` (dict, optional) — OMOP cohort expression JSON.
    auth_token:
        Sanctum Bearer token.

    Returns
    -------
    dict
        ``{"success": True, "cohort_definition_id": <int>, "message": <str>}``
        or ``{"success": False, "error": <str>}``.
    """
    payload: dict[str, Any] = {"name": params["name"]}
    for optional in ("description", "expression"):
        if optional in params:
            payload[optional] = params[optional]

    result = await api_client.call(
        "POST",
        "/cohort-definitions",
        auth_token,
        data=payload,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "Failed to create cohort definition"),
        }

    cohort_definition_id: int = result["data"]["id"]
    return {
        "success": True,
        "cohort_definition_id": cohort_definition_id,
        "message": (
            f"Cohort definition '{params['name']}' created "
            f"(id={cohort_definition_id})"
        ),
    }


async def execute_generate_cohort(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Trigger generation of a cohort definition against a data source.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``cohort_definition_id`` (int, required) — ID to generate.
        * ``data_source_id`` (int, optional) — Target data source.
    auth_token:
        Sanctum Bearer token.

    Returns
    -------
    dict
        ``{"success": True, "generation_id": <int>, "message": <str>}``
        or ``{"success": False, "error": <str>}``.
    """
    cohort_definition_id: int = params["cohort_definition_id"]
    payload: dict[str, Any] = {}
    if "data_source_id" in params:
        payload["data_source_id"] = params["data_source_id"]

    result = await api_client.call(
        "POST",
        f"/cohort-definitions/{cohort_definition_id}/generate",
        auth_token,
        data=payload or None,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "Failed to trigger cohort generation"),
        }

    generation_id: int = result["data"].get("generation_id", cohort_definition_id)
    return {
        "success": True,
        "generation_id": generation_id,
        "message": (
            f"Cohort generation triggered for definition {cohort_definition_id} "
            f"(generation_id={generation_id})"
        ),
    }


async def execute_clone_cohort(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Clone an existing cohort definition.

    Fetches the source definition then POSTs a new definition with the same
    expression and an optional new name.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``cohort_definition_id`` (int, required) — Source ID.
        * ``new_name`` (str, optional) — Name for the clone.
    auth_token:
        Sanctum Bearer token.

    Returns
    -------
    dict
        ``{"success": True, "cohort_definition_id": <int>, "message": <str>}``
        or ``{"success": False, "error": <str>}``.
    """
    source_id: int = params["cohort_definition_id"]

    # Fetch source definition
    source_result = await api_client.call(
        "GET",
        f"/cohort-definitions/{source_id}",
        auth_token,
    )
    if not source_result.get("success"):
        return {
            "success": False,
            "error": source_result.get("error", f"Failed to fetch cohort definition {source_id}"),
        }

    source_data: dict[str, Any] = source_result["data"]
    new_name: str = params.get("new_name") or f"Copy of {source_data.get('name', source_id)}"

    payload: dict[str, Any] = {
        "name": new_name,
        "description": source_data.get("description", ""),
    }
    if "expression" in source_data:
        payload["expression"] = source_data["expression"]

    create_result = await api_client.call(
        "POST",
        "/cohort-definitions",
        auth_token,
        data=payload,
    )
    if not create_result.get("success"):
        return {
            "success": False,
            "error": create_result.get("error", "Failed to create cloned cohort definition"),
        }

    new_id: int = create_result["data"]["id"]
    return {
        "success": True,
        "cohort_definition_id": new_id,
        "message": f"Cloned cohort {source_id} to new definition '{new_name}' (id={new_id})",
    }
