"""SQL tools — agency executors for validated read-only SQL execution.

Provides a safety layer that rejects any SQL containing DML/DDL patterns
before forwarding validated queries to the API.

Functions
---------
validate_sql_safety(sql)
    Returns True only if the SQL is a pure SELECT statement with no
    dangerous operations.
execute_sql(api_client, params, auth_token)
    Validates the query then delegates to the API.
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Safety patterns
# ---------------------------------------------------------------------------

# Each pattern is a compiled regex that, if matched, signals a dangerous query.
# Patterns are case-insensitive and match at word boundaries where applicable.
DANGEROUS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bINSERT\b", re.IGNORECASE),
    re.compile(r"\bUPDATE\b", re.IGNORECASE),
    re.compile(r"\bDELETE\b", re.IGNORECASE),
    re.compile(r"\bDROP\b", re.IGNORECASE),
    re.compile(r"\bALTER\b", re.IGNORECASE),
    re.compile(r"\bCREATE\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\b", re.IGNORECASE),
    re.compile(r"\bGRANT\b", re.IGNORECASE),
    re.compile(r"\bREVOKE\b", re.IGNORECASE),
    re.compile(r"\bCOPY\b", re.IGNORECASE),
    re.compile(r"\bpg_", re.IGNORECASE),
    re.compile(r"\binformation_schema\b", re.IGNORECASE),
]


def validate_sql_safety(sql: str) -> bool:
    """Return True if *sql* is safe (pure SELECT), False otherwise.

    Safety is determined by scanning for any of the :data:`DANGEROUS_PATTERNS`
    and confirming that the trimmed, normalised statement starts with SELECT.

    Parameters
    ----------
    sql:
        SQL string to validate.

    Returns
    -------
    bool
        ``True`` if the query passes all safety checks; ``False`` if any
        dangerous pattern is detected or the query does not start with SELECT.
    """
    if not sql or not sql.strip():
        return False

    # Reject if any dangerous pattern is present anywhere in the query.
    for pattern in DANGEROUS_PATTERNS:
        if pattern.search(sql):
            logger.warning("SQL safety check failed — dangerous pattern detected: %s", pattern.pattern)
            return False

    # The query must begin with SELECT (after stripping whitespace/comments).
    normalised = sql.strip()
    if not re.match(r"^\s*SELECT\b", normalised, re.IGNORECASE):
        logger.warning("SQL safety check failed — query does not start with SELECT")
        return False

    return True


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------


async def execute_sql(
    api_client: Any,
    params: dict[str, Any],
    auth_token: str,
) -> dict[str, Any]:
    """Validate and execute a SQL query via the API.

    The query is first passed through :func:`validate_sql_safety`.  If it
    fails validation the call is blocked immediately and no API request is
    made.

    Parameters
    ----------
    api_client:
        :class:`~app.agency.api_client.AgencyApiClient` instance.
    params:
        Expected keys:

        * ``query`` (str, required) — SQL query to execute.
        * ``source_id`` (int, optional) — Data source ID to run against.
    auth_token:
        Sanctum Bearer token for the acting user.

    Returns
    -------
    dict
        ``{"success": True, "rows": <list>, "message": <str>}`` on success,
        ``{"success": False, "error": "SQL blocked: ...", "blocked": True}``
        if the query fails safety validation, or
        ``{"success": False, "error": <str>}`` on API failure.
    """
    query: str = params.get("query", "")

    if not validate_sql_safety(query):
        logger.warning("Blocked unsafe SQL query: %.200s", query)
        return {
            "success": False,
            "error": "SQL blocked: query contains disallowed patterns or is not a pure SELECT statement",
            "blocked": True,
        }

    payload: dict[str, Any] = {"query": query}
    if "source_id" in params:
        payload["source_id"] = params["source_id"]

    result = await api_client.call(
        "POST",
        "/sql/execute",
        auth_token,
        data=payload,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "SQL execution failed"),
        }

    rows: list[Any] = result["data"].get("rows", [])
    return {
        "success": True,
        "rows": rows,
        "message": f"Query executed successfully — {len(rows)} row(s) returned",
    }
