"""Phase ABC + the structural types every Phase implementation depends on.

A phase is a single step in the Acropolis installer flow. Phases hold no
state of their own — every mutation goes through the shared
:class:`InstallerContext` so resume-from-checkpoint works the same way it
did when the flow was inlined in ``cli.py``.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from rich.console import Console

    from acropolis.installer.config import InstallConfig
    from acropolis.installer.discovery import DiscoveredService
    from acropolis.installer.editions import EditionConfig
    from acropolis.installer.state import InstallState
    from acropolis.installer.topology import TopologyConfig


@dataclass
class PhaseResult:
    """Outcome of running a single phase.

    ``skipped=True`` means the phase decided to no-op (e.g. resume after
    crash detected the phase had already completed). The registry treats
    skipped phases as successes for ordering purposes but does not call
    ``state.complete_phase`` again.

    R7 (Cross-Plan Revision): ``warnings`` is the canonical place for
    non-fatal advisories. EE phases like ``signed_audit_setup`` or
    ``observability_shipper_init`` use this for "primary action OK,
    optional verification (test ship) failed; please check after install."
    """

    phase_id: str
    success: bool
    skipped: bool = False
    duration_s: float = 0.0
    message: str = ""
    diagnostics: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class PhaseError(RuntimeError):
    """Raised when a phase fails fatally and the installer cannot continue."""

    def __init__(
        self,
        phase_id: str,
        message: str,
        diagnostics: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(f"[{phase_id}] {message}")
        self.phase_id = phase_id
        self.diagnostics = diagnostics or {}


@dataclass
class InstallerContext:
    """Mutable bag of state shared across phases.

    Phases read & write this object. The registry creates one instance
    per ``run_all`` invocation and threads it through every phase.
    Replaces the implicit local-variable bag the inlined ``cli.run()``
    flow used to keep state in (config, topology, edition, services,
    connections were all locals); now they live here so EE phases can
    read them without the cli.py re-wiring them.
    """

    state: InstallState
    console: Console
    upgrade: bool = False

    # Filled in as phases run; ``None`` means "phase that produces this
    # has not run yet (or is being resumed and we re-hydrated it from
    # state)". Resume hydration happens in ``cli.run()`` before phases
    # execute.
    topology: TopologyConfig | None = None
    edition: EditionConfig | None = None
    services: list[DiscoveredService] = field(default_factory=list)
    config: InstallConfig | None = None
    connections: list[str] = field(default_factory=list)

    # Smoke-test outcome from VerifyPhase, used by the day-2 generator.
    smoke_passed: int = 0
    smoke_failed: int = 0
    smoke_skipped: int = 0


class Phase(ABC):
    """Base class for every Acropolis installer step.

    Subclasses set the four class-level metadata fields and implement
    :meth:`run`. The registry consults metadata for ordering, edition
    filtering, and dependency resolution.
    """

    #: Stable string identifier — ``community.preflight``, ``community.deploy``,
    #: ``enterprise.fips_bootstrap``. Used by :attr:`depends_on` references and
    #: by the registry log output.
    id: str = ""

    #: Sort order within the same edition. Lower runs first. CE phases use
    #: 100..1000; EE phases pick a slot that respects ``depends_on``.
    order: int = 0

    #: Editions this phase applies to. Empty list = all editions.
    editions: list[str] = []

    #: Phase IDs this phase depends on. Registry topologically sorts.
    depends_on: list[str] = []

    #: Whether running this phase requires the user to have selected the
    #: enterprise tier. CE phases set this False; EE phases set it True.
    requires_enterprise: bool = False

    #: Numeric ID matching the legacy ``InstallState.is_completed(N)``
    #: contract. None means "this phase is new and not represented in
    #: the legacy state machine" — the registry then assumes it must run.
    #: Existing CE phases keep their numbers (preflight=1 .. verify=9)
    #: so an old ``.install-state.json`` from before this refactor still
    #: resumes correctly.
    legacy_state_id: int | None = None

    @abstractmethod
    def run(self, ctx: InstallerContext) -> PhaseResult:
        """Execute the phase, mutating ``ctx`` as needed."""

    def is_applicable(self, edition: str) -> bool:
        """Whether the registry should consider this phase for ``edition``."""
        if self.requires_enterprise and edition != "enterprise":
            return False
        if not self.editions:
            return True
        return edition in self.editions

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return f"<Phase {self.id} order={self.order}>"
