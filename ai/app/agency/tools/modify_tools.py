"""Modify tools — agency executors for high-risk mutation operations.

These tools perform destructive or irreversible modifications to existing
OMOP concept sets and cohort definitions.  Each executor follows the
standard tool executor signature::

    async def execute_*(api_client, params, auth_token) -> dict

Return value schema:

* Success: ``{"success": True, "message": <str>, ...}``
* Failure: ``{"success": False, "error": <str>}``
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def execute_modify_concept_set(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Add and/or remove concepts from an existing concept set.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``concept_set_id`` (int, required) — ID of the concept set to modify.
        * ``add_items`` (list[dict], optional) — Concept items to add via
          POST /concept-sets/{id}/items.
        * ``remove_item_ids`` (list[int], optional) — Item IDs to remove via
          DELETE /concept-sets/{id}/items/{item_id}.
    auth_token:
        Sanctum Bearer token for the acting user.

    Returns
    -------
    dict
        ``{"success": True, "concept_set_id": <int>, "message": <str>,
        "added": <int>, "removed": <int>}`` on success, or
        ``{"success": False, "error": <str>}`` on failure.
    """
    concept_set_id: int = params["concept_set_id"]
    add_items: list[dict[str, Any]] = params.get("add_items", [])
    remove_item_ids: list[int] = params.get("remove_item_ids", [])

    added = 0
    removed = 0

    for item in add_items:
        result = await api_client.call(
            "POST",
            f"/concept-sets/{concept_set_id}/items",
            auth_token,
            data=item,
        )
        if result.get("success"):
            added += 1
        else:
            logger.warning(
                "Failed to add item to concept set %d: %s",
                concept_set_id,
                result.get("error"),
            )

    for item_id in remove_item_ids:
        result = await api_client.call(
            "DELETE",
            f"/concept-sets/{concept_set_id}/items/{item_id}",
            auth_token,
        )
        if result.get("success"):
            removed += 1
        else:
            logger.warning(
                "Failed to remove item %d from concept set %d: %s",
                item_id,
                concept_set_id,
                result.get("error"),
            )

    return {
        "success": True,
        "concept_set_id": concept_set_id,
        "added": added,
        "removed": removed,
        "message": (
            f"Concept set {concept_set_id} modified: "
            f"{added} item(s) added, {removed} item(s) removed"
        ),
    }


async def execute_modify_cohort_criteria(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Update the expression (inclusion/exclusion criteria) of a cohort definition.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``cohort_definition_id`` (int, required) — ID of the cohort to update.
        * ``expression`` (dict, required) — New OMOP cohort expression JSON.
        * ``name`` (str, optional) — Updated display name.
        * ``description`` (str, optional) — Updated description.
    auth_token:
        Sanctum Bearer token for the acting user.

    Returns
    -------
    dict
        ``{"success": True, "cohort_definition_id": <int>, "message": <str>}``
        on success, or ``{"success": False, "error": <str>}`` on failure.
    """
    cohort_definition_id: int = params["cohort_definition_id"]

    payload: dict[str, Any] = {"expression": params["expression"]}
    for optional in ("name", "description"):
        if optional in params:
            payload[optional] = params[optional]

    result = await api_client.call(
        "PUT",
        f"/cohort-definitions/{cohort_definition_id}",
        auth_token,
        data=payload,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", f"Failed to update cohort definition {cohort_definition_id}"),
        }

    return {
        "success": True,
        "cohort_definition_id": cohort_definition_id,
        "message": f"Cohort definition {cohort_definition_id} criteria updated",
    }
