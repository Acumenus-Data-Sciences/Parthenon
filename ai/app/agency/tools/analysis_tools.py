"""Analysis tools — agency executors for OHDSI characterization and incidence analyses.

Each function follows the standard tool executor signature::

    async def execute_*(api_client, params, auth_token) -> dict

Return value schema:

* Success: ``{"success": True, "analysis_id": <int>, "message": <str>}``
* Failure: ``{"success": False, "error": <str>}``
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def execute_run_characterization(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Submit a characterization analysis for asynchronous execution.

    Posts to ``/analyses`` with ``type="characterization"`` and returns the
    analysis ID once the backend has accepted the job (HTTP 202).

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``cohort_definition_id`` (int, required) — Cohort to characterize.
        * ``source_id`` (int, optional) — Data source ID.
        * ``feature_analyses`` (list[dict], optional) — Feature analysis configs.
        * ``name`` (str, optional) — Display name for the analysis.
    auth_token:
        Sanctum Bearer token for the acting user.

    Returns
    -------
    dict
        ``{"success": True, "analysis_id": <int>, "message": <str>}`` on
        success, or ``{"success": False, "error": <str>}`` on failure.
    """
    payload: dict[str, Any] = {
        "type": "characterization",
        "cohort_definition_id": params["cohort_definition_id"],
    }
    for optional in ("source_id", "feature_analyses", "name"):
        if optional in params:
            payload[optional] = params[optional]

    result = await api_client.call(
        "POST",
        "/analyses",
        auth_token,
        data=payload,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "Failed to submit characterization analysis"),
        }

    analysis_id: int = result["data"]["id"]
    return {
        "success": True,
        "analysis_id": analysis_id,
        "message": (
            f"Characterization analysis submitted for cohort "
            f"{params['cohort_definition_id']} (analysis_id={analysis_id})"
        ),
    }


async def execute_run_incidence_analysis(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Submit an incidence rate analysis for asynchronous execution.

    Posts to ``/analyses`` with ``type="incidence_rate"`` and returns the
    analysis ID once the backend has accepted the job (HTTP 202).

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``target_cohort_id`` (int, required) — Target cohort definition ID.
        * ``outcome_cohort_id`` (int, required) — Outcome cohort definition ID.
        * ``source_id`` (int, optional) — Data source ID.
        * ``washout_days`` (int, optional) — Clean-window period in days.
        * ``name`` (str, optional) — Display name for the analysis.
    auth_token:
        Sanctum Bearer token for the acting user.

    Returns
    -------
    dict
        ``{"success": True, "analysis_id": <int>, "message": <str>}`` on
        success, or ``{"success": False, "error": <str>}`` on failure.
    """
    payload: dict[str, Any] = {
        "type": "incidence_rate",
        "target_cohort_id": params["target_cohort_id"],
        "outcome_cohort_id": params["outcome_cohort_id"],
    }
    for optional in ("source_id", "washout_days", "name"):
        if optional in params:
            payload[optional] = params[optional]

    result = await api_client.call(
        "POST",
        "/analyses",
        auth_token,
        data=payload,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "Failed to submit incidence rate analysis"),
        }

    analysis_id: int = result["data"]["id"]
    return {
        "success": True,
        "analysis_id": analysis_id,
        "message": (
            f"Incidence rate analysis submitted (target={params['target_cohort_id']}, "
            f"outcome={params['outcome_cohort_id']}, analysis_id={analysis_id})"
        ),
    }
