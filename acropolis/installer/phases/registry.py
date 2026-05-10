"""Discovers, orders, and runs Acropolis installer phases.

Discovery sources (in order):

  1. **CE built-ins** — registered explicitly by ``cli.run()`` via
     :func:`acropolis.installer.phases.community.register_into`.
  2. **Setuptools entry points** — group ``parthenon.acropolis.phases``.
     EE bundles register their phases here in their own ``pyproject.toml``.
  3. **Runtime registration** — ``registry.register(MyPhase())`` for
     ad-hoc development and tests.

The registry topologically sorts by ``depends_on`` (Kahn's algorithm),
breaks ties by ``Phase.order`` then ``Phase.id`` (lexicographic). It
filters by edition and ``requires_enterprise`` before sorting so EE
phases vanish on community installs without needing to be deregistered.
"""
from __future__ import annotations

import importlib
import importlib.metadata
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from rich.console import Console

from acropolis.installer.phases.base import (
    InstallerContext,
    Phase,
    PhaseError,
    PhaseResult,
)


class PhaseRegistry:
    """Holds the ordered set of Phases for one installer invocation."""

    #: Setuptools entry-point group EE bundles use to advertise phases.
    ENTRY_POINT_GROUP = "parthenon.acropolis.phases"

    def __init__(self, console: Console | None = None) -> None:
        self._phases: list[Phase] = []
        self._console = console

    # ── Registration ───────────────────────────────────────────────────────

    def register(self, phase: Phase) -> None:
        """Add a phase. Raises ``ValueError`` if the id collides."""
        if not phase.id:
            raise ValueError(
                f"Phase subclass {type(phase).__name__} has empty id"
            )
        if any(p.id == phase.id for p in self._phases):
            raise ValueError(f"Phase id '{phase.id}' already registered")
        self._phases.append(phase)

    def discover_entry_points(self) -> list[str]:
        """Load EE-published phases via setuptools entry points.

        Returns the list of successfully loaded phase ids. Failures are
        logged through the registry's console but do not abort discovery
        — a single misbehaving EE plugin can't take the installer down.
        """
        loaded: list[str] = []
        try:
            eps = importlib.metadata.entry_points(group=self.ENTRY_POINT_GROUP)
        except TypeError:
            # Python < 3.10 fallback (Acropolis targets 3.12 but be defensive).
            eps = importlib.metadata.entry_points().get(  # type: ignore[attr-defined]
                self.ENTRY_POINT_GROUP, []
            )
        for ep in eps:
            try:
                phase_cls = ep.load()
                phase = phase_cls() if isinstance(phase_cls, type) else phase_cls
                self.register(phase)
                loaded.append(phase.id)
            except Exception as exc:  # noqa: BLE001 — defensive boundary
                if self._console is not None:
                    self._console.print(
                        f"[yellow]warn:[/] failed to load phase '{ep.name}': {exc}"
                    )
        return loaded

    def names(self) -> list[str]:
        return [p.id for p in self._phases]

    def phases(self) -> list[Phase]:
        return list(self._phases)

    def clear(self) -> None:
        self._phases.clear()

    # ── Ordering ───────────────────────────────────────────────────────────

    def sorted_phases(
        self,
        edition: str,
        *,
        include_skipped: bool = False,
    ) -> list[Phase]:
        """Return phases topologically sorted with ties broken by ``order``.

        Phases not applicable to ``edition`` are dropped unless
        ``include_skipped=True``. Raises :class:`PhaseError` on missing
        dependency or cycle.
        """
        applicable = [
            p
            for p in self._phases
            if include_skipped or p.is_applicable(edition)
        ]

        indeg: dict[str, int] = {p.id: 0 for p in applicable}
        graph: dict[str, list[str]] = {p.id: [] for p in applicable}
        by_id = {p.id: p for p in applicable}

        for p in applicable:
            for dep in p.depends_on:
                if dep not in indeg:
                    raise PhaseError(
                        p.id,
                        f"depends_on '{dep}' is not registered or not applicable to edition '{edition}'",
                    )
                graph[dep].append(p.id)
                indeg[p.id] += 1

        ready = sorted(
            (pid for pid, d in indeg.items() if d == 0),
            key=lambda pid: (by_id[pid].order, pid),
        )
        result: list[Phase] = []
        while ready:
            pid = ready.pop(0)
            result.append(by_id[pid])
            for child in graph[pid]:
                indeg[child] -= 1
                if indeg[child] == 0:
                    ready.append(child)
            ready.sort(key=lambda pid: (by_id[pid].order, pid))

        if len(result) != len(applicable):
            cycle = [pid for pid, d in indeg.items() if d > 0]
            raise PhaseError(
                "registry",
                f"depends_on cycle detected among phases: {cycle}",
            )
        return result

    # ── Execution ──────────────────────────────────────────────────────────

    def run_all(
        self,
        ctx: InstallerContext,
        edition: str,
    ) -> list[PhaseResult]:
        """Run every applicable phase in order, returning the result list.

        Resume behavior preserved from the legacy inline flow: when a
        phase has a ``legacy_state_id`` already in ``ctx.state.completed_phases``,
        the phase's :meth:`Phase.run` is responsible for re-hydrating any
        derived data from ``ctx.state.data`` and returning
        ``PhaseResult(skipped=True)``. The registry does not auto-skip;
        phases need to handle their own resume because some phases re-run
        partial work (e.g. the parthenon-install sub-phase re-discovers
        services after install).
        """
        results: list[PhaseResult] = []
        for phase in self.sorted_phases(edition):
            t0 = time.time()
            if self._console is not None:
                self._console.rule(f"[bold cyan]{phase.id}[/]")
            try:
                r = phase.run(ctx)
            except PhaseError:
                raise
            except Exception as exc:  # noqa: BLE001 — boundary
                raise PhaseError(
                    phase.id, f"unhandled exception: {exc}"
                ) from exc
            r.duration_s = time.time() - t0
            results.append(r)
            if not r.success and not r.skipped:
                raise PhaseError(phase.id, r.message or "phase reported failure", r.diagnostics)
        return results
