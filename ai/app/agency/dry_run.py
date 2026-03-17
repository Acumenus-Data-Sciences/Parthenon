"""Dry Run Mode — simulate agency actions without executing side effects.

Provides:

- ``TOOL_DESCRIPTIONS`` — mapping of known tool names to simulation lambdas.
- :class:`DryRunSimulator` — simulate individual steps or entire plans.

Simulated results always include ``simulated=True`` plus tool-specific fields
so callers can display a meaningful preview to the user before they approve
real execution.
"""
from __future__ import annotations

import logging
from typing import Any

from app.agency.dag_executor import DAGStep

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool description registry
# ---------------------------------------------------------------------------

# Each entry is a callable ``(DAGStep) -> dict[str, Any]`` that returns the
# dry-run result for that tool.  The ``simulated`` key is injected by
# :class:`DryRunSimulator` so individual lambdas don't need to include it.

TOOL_DESCRIPTIONS: dict[str, Any] = {
    "create_concept_set": lambda step: {
        "would_create": "concept_set",
        "name": step.parameters.get("name"),
    },
    "generate_cohort": lambda step: {
        "would_execute": "cohort_generation",
        "cohort_id": step.parameters.get("cohort_id"),
    },
    "clone_cohort": lambda step: {
        "would_clone": "cohort",
        "source_cohort_id": step.parameters.get("source_cohort_id"),
    },
    "create_cohort_definition": lambda step: {
        "would_create": "cohort_definition",
        "name": step.parameters.get("name"),
    },
    "execute_sql": lambda step: {
        "read_only": True,
        "query_preview": str(step.parameters.get("query", ""))[:200],
    },
    "compare_cohorts": lambda step: {
        "would_compare": "cohorts",
        "cohort_ids": step.parameters.get("cohort_ids"),
    },
    "export_results": lambda step: {
        "would_export": "results",
        "format": step.parameters.get("format", "csv"),
    },
}


# ---------------------------------------------------------------------------
# Simulator
# ---------------------------------------------------------------------------


class DryRunSimulator:
    """Simulate agency steps without executing real side effects.

    Parameters
    ----------
    tool_descriptions:
        Mapping of tool name → simulation callable.  Defaults to the module-
        level :data:`TOOL_DESCRIPTIONS` dict.
    """

    def __init__(
        self,
        tool_descriptions: dict[str, Any] | None = None,
    ) -> None:
        self._tools = tool_descriptions if tool_descriptions is not None else TOOL_DESCRIPTIONS

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def simulate(self, step: DAGStep) -> dict[str, Any]:
        """Return a simulated result dict for *step*.

        The result always contains ``simulated=True`` plus any tool-specific
        fields defined in :data:`TOOL_DESCRIPTIONS`.  Unknown tools return a
        generic result with a ``note`` field explaining the situation.

        Parameters
        ----------
        step:
            The :class:`~app.agency.dag_executor.DAGStep` to simulate.

        Returns
        -------
        dict[str, Any]
            Simulation result with at minimum ``{"simulated": True}``.
        """
        handler = self._tools.get(step.tool_name)

        if handler is None:
            logger.info(
                "dry_run: no simulation handler for tool '%s', returning generic result",
                step.tool_name,
            )
            return {
                "simulated": True,
                "note": f"unknown tool '{step.tool_name}' — no simulation available",
            }

        try:
            extra = handler(step)
        except Exception:
            logger.exception(
                "dry_run: simulation handler for '%s' raised an exception",
                step.tool_name,
            )
            extra = {}

        return {"simulated": True, **extra}

    def simulate_plan(self, steps: list[DAGStep]) -> list[dict[str, Any]]:
        """Simulate an entire list of steps and return their results in order.

        Parameters
        ----------
        steps:
            Ordered list of :class:`~app.agency.dag_executor.DAGStep` objects.

        Returns
        -------
        list[dict[str, Any]]
            One simulation result per step, preserving order.
        """
        return [self.simulate(step) for step in steps]
