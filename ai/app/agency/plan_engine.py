"""Plan Engine — Plan-Confirm-Execute orchestration for Abby agency actions.

The engine manages the lifecycle of an :class:`ActionPlan`:

1. ``create_plan()`` — validates tool names and builds a PENDING plan.
2. ``approve_plan()`` — user confirmation transitions to APPROVED.
3. ``execute_plan()`` — executes steps sequentially, logging each result.

A plan expires after a configurable TTL (default 30 minutes) to prevent
stale approvals.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)

_PLAN_TTL_MINUTES = 30


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class PlanStatus(str, Enum):
    """Lifecycle states of an :class:`ActionPlan`."""

    PENDING = "pending"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class PlanStep:
    """A single tool invocation within an :class:`ActionPlan`.

    Parameters
    ----------
    tool_name:
        Registered tool name (validated against :class:`~.ToolRegistry`).
    parameters:
        Keyword arguments forwarded to the tool executor.
    status:
        Execution state — ``"pending"``, ``"success"``, ``"failed"``, or
        ``"skipped"``.
    result:
        Raw return value from the tool executor (set after execution).
    error:
        Error message if execution failed.
    """

    tool_name: str
    parameters: dict[str, Any]
    status: str = "pending"
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Serialise the step to a plain dict."""
        return {
            "tool_name": self.tool_name,
            "parameters": self.parameters,
            "status": self.status,
            "result": self.result,
            "error": self.error,
        }


@dataclass
class ActionPlan:
    """A multi-step plan awaiting user confirmation before execution.

    Parameters
    ----------
    plan_id:
        UUID string uniquely identifying this plan.
    user_id:
        ID of the user who requested the plan.
    description:
        Natural-language summary of what the plan will accomplish.
    steps:
        Ordered list of :class:`PlanStep` objects.
    status:
        Current lifecycle state (see :class:`PlanStatus`).
    created_at:
        UTC timestamp when the plan was created.
    expires_at:
        UTC timestamp after which the plan must not be executed.
    auth_token:
        Sanctum Bearer token used when making API calls on behalf of the user.
    """

    plan_id: str
    user_id: int
    description: str
    steps: list[PlanStep]
    status: PlanStatus
    created_at: datetime
    expires_at: datetime
    auth_token: str

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_expired(self) -> bool:
        """Return ``True`` if the plan has passed its expiry time."""
        return datetime.now(tz=timezone.utc) > self.expires_at

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Serialise the plan to a plain dict (auth_token excluded)."""
        return {
            "plan_id": self.plan_id,
            "user_id": self.user_id,
            "description": self.description,
            "steps": [s.to_dict() for s in self.steps],
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


class PlanEngine:
    """Orchestrates the Plan-Confirm-Execute loop for agency actions.

    Parameters
    ----------
    tool_registry:
        Registry of available tools.  Defaults to
        :meth:`~.ToolRegistry.default` when ``None``.
    action_logger:
        :class:`~.ActionLogger` instance for persisting execution records.
        May be ``None`` (logging is skipped).
    api_client:
        :class:`~.AgencyApiClient` instance for Laravel API calls.
        May be ``None`` (tool execution will fail gracefully).
    db_engine:
        SQLAlchemy engine used by action_logger.  May be ``None``.
    """

    def __init__(
        self,
        tool_registry: Any = None,
        action_logger: Any = None,
        api_client: Any = None,
        db_engine: Any = None,
    ) -> None:
        if tool_registry is None:
            from app.agency.tool_registry import ToolRegistry
            tool_registry = ToolRegistry.default()

        self._registry = tool_registry
        self._logger = action_logger
        self._api_client = api_client
        self._db_engine = db_engine

        # In-memory plan store (keyed by plan_id)
        self._plans: dict[str, ActionPlan] = {}

    # ------------------------------------------------------------------
    # Plan lifecycle
    # ------------------------------------------------------------------

    def create_plan(
        self,
        user_id: int,
        description: str,
        steps: list[dict[str, Any]],
        auth_token: str,
        ttl_minutes: int = _PLAN_TTL_MINUTES,
    ) -> ActionPlan:
        """Validate and create a new PENDING :class:`ActionPlan`.

        Parameters
        ----------
        user_id:
            ID of the requesting user.
        description:
            Natural-language description of the plan's intent.
        steps:
            List of dicts with ``tool_name`` and ``parameters`` keys.
        auth_token:
            Sanctum Bearer token for API calls.
        ttl_minutes:
            How many minutes before the plan expires (default 30).

        Returns
        -------
        ActionPlan
            The newly created plan in PENDING status.

        Raises
        ------
        ValueError
            If any step references an unregistered tool name.
        """
        # Validate all tool names before creating anything
        for step_dict in steps:
            tool_name = step_dict.get("tool_name", "")
            if self._registry.get(tool_name) is None:
                raise ValueError(
                    f"Unknown tool '{tool_name}'. "
                    f"Registered tools: {[t.name for t in self._registry.list_tools()]}"
                )

        now = datetime.now(tz=timezone.utc)
        plan_steps = [
            PlanStep(
                tool_name=s["tool_name"],
                parameters=s.get("parameters", {}),
            )
            for s in steps
        ]
        plan = ActionPlan(
            plan_id=str(uuid.uuid4()),
            user_id=user_id,
            description=description,
            steps=plan_steps,
            status=PlanStatus.PENDING,
            created_at=now,
            expires_at=now + timedelta(minutes=ttl_minutes),
            auth_token=auth_token,
        )
        self._plans[plan.plan_id] = plan
        logger.info("Created plan %s for user %d (%d steps)", plan.plan_id, user_id, len(plan_steps))
        return plan

    def approve_plan(self, plan: ActionPlan) -> None:
        """Transition *plan* from PENDING to APPROVED."""
        plan.status = PlanStatus.APPROVED
        logger.info("Plan %s approved by user %d", plan.plan_id, plan.user_id)

    def cancel_plan(self, plan: ActionPlan) -> None:
        """Transition *plan* to CANCELLED (terminal state)."""
        plan.status = PlanStatus.CANCELLED
        logger.info("Plan %s cancelled", plan.plan_id)

    def get_plan(self, plan_id: str) -> Optional[ActionPlan]:
        """Return the :class:`ActionPlan` for *plan_id*, or ``None``."""
        return self._plans.get(plan_id)

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    async def execute_plan(self, plan: ActionPlan) -> ActionPlan:
        """Execute all APPROVED steps sequentially.

        Steps are executed in order.  If any step fails, remaining steps are
        marked as ``"skipped"`` and the plan status is set to FAILED.

        Parameters
        ----------
        plan:
            An APPROVED :class:`ActionPlan`.

        Returns
        -------
        ActionPlan
            The same plan object with updated step statuses.
        """
        if plan.is_expired:
            plan.status = PlanStatus.FAILED
            logger.warning("Plan %s expired before execution", plan.plan_id)
            return plan

        plan.status = PlanStatus.EXECUTING
        failed = False

        for step in plan.steps:
            if failed:
                step.status = "skipped"
                continue

            try:
                result = await self._execute_step(step, plan)
                step.result = result
                if result.get("success"):
                    step.status = "success"
                    self._log_action(step, plan, result)
                else:
                    step.status = "failed"
                    step.error = result.get("error", "Unknown error")
                    self._log_action(step, plan, result)
                    failed = True
            except Exception as exc:
                step.status = "failed"
                step.error = str(exc)
                logger.exception("Step %s failed with exception", step.tool_name)
                failed = True

        plan.status = PlanStatus.FAILED if failed else PlanStatus.COMPLETED
        return plan

    async def _execute_step(
        self, step: PlanStep, plan: ActionPlan
    ) -> dict[str, Any]:
        """Route a single step to the appropriate tool executor.

        Tool executors are imported lazily to avoid circular imports.
        """
        from app.agency.tools.concept_set_tools import execute_create_concept_set
        from app.agency.tools.cohort_tools import (
            execute_clone_cohort,
            execute_create_cohort_definition,
            execute_generate_cohort,
        )
        from app.agency.tools.query_tools import execute_compare_cohorts, execute_export_results

        tool_map = {
            "create_concept_set": execute_create_concept_set,
            "create_cohort_definition": execute_create_cohort_definition,
            "generate_cohort": execute_generate_cohort,
            "clone_cohort": execute_clone_cohort,
            "compare_cohorts": execute_compare_cohorts,
            "export_results": execute_export_results,
        }

        executor = tool_map.get(step.tool_name)
        if executor is None:
            return {"success": False, "error": f"No executor for tool '{step.tool_name}'"}

        return await executor(
            api_client=self._api_client,
            params=step.parameters,
            auth_token=plan.auth_token,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _log_action(
        self,
        step: PlanStep,
        plan: ActionPlan,
        result: dict[str, Any],
    ) -> None:
        """Persist an action log entry if an :class:`ActionLogger` is available."""
        if self._logger is None:
            return
        try:
            from app.agency.tool_registry import ToolRegistry
            tool_def = self._registry.get(step.tool_name)
            risk_level = tool_def.risk_level.value if tool_def else "unknown"
            self._logger.log_action(
                user_id=plan.user_id,
                action_type="execute",
                tool_name=step.tool_name,
                risk_level=risk_level,
                parameters=step.parameters,
                result=result,
                plan=plan.to_dict(),
            )
        except Exception:
            logger.exception("Failed to log action for step %s", step.tool_name)
