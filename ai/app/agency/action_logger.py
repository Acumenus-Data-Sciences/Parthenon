"""Action Logger — persist agency actions with checkpoint and rollback support.

Every tool execution made by the agency module is recorded in
``app.abby_action_log``.  Rows carry the full parameter set, the API result,
an optional checkpoint snapshot (used for rollback), and a ``rolled_back``
flag that is set to ``TRUE`` when an action is undone.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from sqlalchemy import text

logger = logging.getLogger(__name__)


class ActionLogger:
    """Persist and query agency action log entries.

    Parameters
    ----------
    engine:
        SQLAlchemy engine (or compatible mock) providing ``engine.connect()``
        as a context manager that returns a connection with ``.execute()``.
    """

    def __init__(self, engine: Any) -> None:
        self._engine = engine

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def log_action(
        self,
        *,
        user_id: Optional[int],
        action_type: str,
        tool_name: str,
        risk_level: str,
        parameters: Optional[dict[str, Any]] = None,
        result: Optional[dict[str, Any]] = None,
        plan: Optional[dict[str, Any]] = None,
        checkpoint_data: Optional[dict[str, Any]] = None,
    ) -> int:
        """INSERT an action row and return the generated ``id``.

        Parameters
        ----------
        user_id:
            ID of the user on whose behalf the action was taken.
        action_type:
            Broad category, e.g. ``"create"``, ``"update"``, ``"delete"``.
        tool_name:
            Name of the tool that executed the action, e.g.
            ``"create_concept_set"``.
        risk_level:
            ``"low"``, ``"medium"``, or ``"high"``.
        parameters:
            The tool call parameters as a JSON-serialisable dict.
        result:
            The API response payload as a JSON-serialisable dict.
        plan:
            The agency plan object that triggered this action (optional).
        checkpoint_data:
            A snapshot of any state that would be needed to reverse this
            action (optional).

        Returns
        -------
        int
            The ``id`` of the newly inserted row.
        """
        params: dict[str, Any] = {
            "user_id": user_id,
            "action_type": action_type,
            "tool_name": tool_name,
            "risk_level": risk_level,
            "plan": json.dumps(plan) if plan is not None else None,
            "parameters": json.dumps(parameters) if parameters is not None else None,
            "result": json.dumps(result) if result is not None else None,
            "checkpoint_data": (
                json.dumps(checkpoint_data) if checkpoint_data is not None else None
            ),
        }
        with self._engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO app.abby_action_log
                        (user_id, action_type, tool_name, risk_level,
                         plan, parameters, result, checkpoint_data)
                    VALUES
                        (:user_id, :action_type, :tool_name, :risk_level,
                         :plan::jsonb, :parameters::jsonb, :result::jsonb,
                         :checkpoint_data::jsonb)
                    RETURNING id
                    """
                ),
                params,
            ).fetchone()
        return int(row[0])

    def mark_rolled_back(self, action_id: int) -> None:
        """Set ``rolled_back = TRUE`` for the given action.

        Parameters
        ----------
        action_id:
            Primary key of the row to update.
        """
        with self._engine.connect() as conn:
            conn.execute(
                text(
                    """
                    UPDATE app.abby_action_log
                    SET rolled_back = TRUE
                    WHERE id = :action_id
                    """
                ),
                {"action_id": action_id},
            )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_recent_actions(
        self,
        user_id: int,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Return the most recent action log rows for a user.

        Parameters
        ----------
        user_id:
            Filter rows to this user.
        limit:
            Maximum number of rows to return (newest first).

        Returns
        -------
        list[dict]
            Each item is a ``dict`` with all columns from
            ``app.abby_action_log``.
        """
        try:
            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        """
                        SELECT id, user_id, action_type, tool_name, risk_level,
                               plan, parameters, result, checkpoint_data,
                               rolled_back, created_at
                        FROM app.abby_action_log
                        WHERE user_id = :user_id
                        ORDER BY created_at DESC
                        LIMIT :limit
                        """
                    ),
                    {"user_id": user_id, "limit": limit},
                ).fetchall()
            return [dict(row._mapping) for row in rows]
        except Exception:
            logger.exception(
                "Failed to fetch recent actions for user_id=%d", user_id
            )
            return []
