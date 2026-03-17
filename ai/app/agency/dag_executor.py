"""DAG Executor — parallel step execution with dependency tracking.

Provides:

- :class:`DAGStep` — a single node in the dependency graph.
- :class:`DAGPlan` — a collection of steps with topological wave computation.
- :class:`DAGExecutor` — async executor that runs waves concurrently.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger(__name__)

# Type alias for the async callable that executes a single step.
StepExecutor = Callable[["DAGStep"], Awaitable[dict[str, Any]]]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class DAGStep:
    """A single node in the execution DAG.

    Parameters
    ----------
    id:
        Unique identifier for this step within its plan.
    tool_name:
        Name of the tool to invoke.
    parameters:
        Keyword arguments forwarded to the tool executor.
    depends_on:
        IDs of steps that must complete successfully before this step runs.
    status:
        Execution state — ``"pending"``, ``"success"``, ``"failed"``, or
        ``"skipped"``.
    result:
        Return value from the step executor (set after execution).
    """

    id: str
    tool_name: str
    parameters: dict[str, Any]
    depends_on: list[str] = field(default_factory=list)
    status: str = "pending"
    result: Optional[dict[str, Any]] = None

    def to_dict(self) -> dict[str, Any]:
        """Serialise the step to a plain dict."""
        return {
            "id": self.id,
            "tool_name": self.tool_name,
            "parameters": self.parameters,
            "depends_on": list(self.depends_on),
            "status": self.status,
            "result": self.result,
        }


@dataclass
class DAGPlan:
    """A collection of :class:`DAGStep` objects forming a dependency graph.

    Parameters
    ----------
    steps:
        List of :class:`DAGStep` instances.  IDs must be unique within the
        plan; ``depends_on`` entries must reference other step IDs.
    """

    steps: list[DAGStep]

    # ------------------------------------------------------------------
    # Topological ordering
    # ------------------------------------------------------------------

    def get_execution_waves(self) -> list[list[DAGStep]]:
        """Return steps grouped into sequential execution waves.

        Steps within the same wave have no dependency on each other and can be
        run concurrently.  Steps in wave *N+1* depend only on steps in waves
        ≤ *N*.

        Returns
        -------
        list[list[DAGStep]]
            Ordered list of waves; each wave is a list of :class:`DAGStep`.

        Raises
        ------
        ValueError
            If a dependency cycle is detected in the graph.
        """
        step_by_id: dict[str, DAGStep] = {s.id: s for s in self.steps}

        # Build in-degree map and adjacency list (dependency → dependents).
        in_degree: dict[str, int] = {s.id: 0 for s in self.steps}
        dependents: dict[str, list[str]] = defaultdict(list)

        for step in self.steps:
            for dep_id in step.depends_on:
                if dep_id not in step_by_id:
                    raise ValueError(
                        f"Step '{step.id}' references unknown dependency '{dep_id}'"
                    )
                in_degree[step.id] += 1
                dependents[dep_id].append(step.id)

        # Kahn's algorithm — process nodes with zero in-degree wave by wave.
        queue: deque[str] = deque(
            step_id for step_id, deg in in_degree.items() if deg == 0
        )
        waves: list[list[DAGStep]] = []
        processed = 0

        while queue:
            wave_size = len(queue)
            wave: list[DAGStep] = []

            for _ in range(wave_size):
                step_id = queue.popleft()
                wave.append(step_by_id[step_id])
                processed += 1

                for dependent_id in dependents[step_id]:
                    in_degree[dependent_id] -= 1
                    if in_degree[dependent_id] == 0:
                        queue.append(dependent_id)

            waves.append(wave)

        if processed != len(self.steps):
            raise ValueError(
                "cycle detected in DAG — cannot determine execution order"
            )

        return waves

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Serialise the plan to a plain dict."""
        return {"steps": [s.to_dict() for s in self.steps]}


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------


class DAGExecutor:
    """Async executor that processes :class:`DAGPlan` waves concurrently.

    Each wave is computed via :meth:`DAGPlan.get_execution_waves`.  Steps
    within a wave run in parallel via :func:`asyncio.gather`.  If any step in
    a wave fails (raises an exception), all steps that depend on it (directly
    or transitively) are marked as ``"skipped"`` and not executed.
    """

    async def execute(
        self,
        plan: DAGPlan,
        step_executor: StepExecutor,
    ) -> DAGPlan:
        """Execute *plan* using *step_executor* for each step.

        Parameters
        ----------
        plan:
            The :class:`DAGPlan` to execute.
        step_executor:
            An async callable ``(DAGStep) -> dict`` invoked for each step.
            Raising an exception marks the step as failed.

        Returns
        -------
        DAGPlan
            The same *plan* object with updated step statuses and results.
        """
        waves = plan.get_execution_waves()

        # Track which step IDs have failed so dependents can be skipped.
        failed_ids: set[str] = set()

        for wave in waves:
            await self._execute_wave(wave, step_executor, failed_ids, plan)

        return plan

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _execute_wave(
        self,
        wave: list[DAGStep],
        step_executor: StepExecutor,
        failed_ids: set[str],
        plan: DAGPlan,
    ) -> None:
        """Run all steps in *wave* concurrently, respecting prior failures."""
        # Build a set of all currently failed IDs for quick lookup.
        tasks = []
        skipped_steps = []
        active_steps = []

        for step in wave:
            if any(dep in failed_ids for dep in step.depends_on):
                skipped_steps.append(step)
            else:
                active_steps.append(step)

        # Mark skipped immediately.
        for step in skipped_steps:
            step.status = "skipped"
            logger.info("Step '%s' skipped due to upstream failure", step.id)

        if not active_steps:
            return

        # Run active steps concurrently.
        results = await asyncio.gather(
            *[self._run_step(step, step_executor) for step in active_steps],
            return_exceptions=True,
        )

        for step, outcome in zip(active_steps, results):
            if isinstance(outcome, BaseException):
                step.status = "failed"
                step.result = {"error": str(outcome)}
                failed_ids.add(step.id)
                logger.error("Step '%s' raised an exception: %s", step.id, outcome)
            else:
                step.status = "success"
                step.result = outcome
                logger.info("Step '%s' completed successfully", step.id)

    @staticmethod
    async def _run_step(
        step: DAGStep,
        step_executor: StepExecutor,
    ) -> dict[str, Any]:
        """Invoke *step_executor* for a single step and return its result."""
        return await step_executor(step)
