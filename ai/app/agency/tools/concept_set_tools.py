"""Concept Set tools — agency executors for OMOP concept set operations.

Each function in this module follows the standard tool executor signature::

    async def execute_*(api_client, params, auth_token) -> dict

Return value schema:

* Success: ``{"success": True, "concept_set_id": <int>, "message": <str>}``
* Failure: ``{"success": False, "error": <str>}``
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def execute_create_concept_set(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Create a concept set and optionally add items to it.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``name`` (str, required) — Display name for the concept set.
        * ``description`` (str, optional) — Descriptive text.
        * ``items`` (list[dict], optional) — Concept items to add after
          creation.  Each item dict is posted as-is to
          ``/concept-sets/{id}/items``.
    auth_token:
        Sanctum Bearer token for the acting user.

    Returns
    -------
    dict
        ``{"success": True, "concept_set_id": <int>, "message": <str>}`` on
        success, or ``{"success": False, "error": <str>}`` on failure.
    """
    payload: dict[str, Any] = {"name": params["name"]}
    if "description" in params:
        payload["description"] = params["description"]

    create_result = await api_client.call(
        "POST",
        "/concept-sets",
        auth_token,
        data=payload,
    )
    if not create_result.get("success"):
        return {
            "success": False,
            "error": create_result.get("error", "Failed to create concept set"),
        }

    concept_set_id: int = create_result["data"]["id"]

    # Add items if provided
    items: list[dict[str, Any]] = params.get("items", [])
    for item in items:
        item_result = await api_client.call(
            "POST",
            f"/concept-sets/{concept_set_id}/items",
            auth_token,
            data=item,
        )
        if not item_result.get("success"):
            logger.warning(
                "Failed to add item to concept set %d: %s",
                concept_set_id,
                item_result.get("error"),
            )
            # Continue adding remaining items even if one fails

    return {
        "success": True,
        "concept_set_id": concept_set_id,
        "message": f"Concept set '{params['name']}' created (id={concept_set_id})",
    }
