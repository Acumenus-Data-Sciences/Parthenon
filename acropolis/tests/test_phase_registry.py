"""Tests for the Acropolis installer phase registry (Plan 02-07)."""
from __future__ import annotations

import pytest

from acropolis.installer.phases.base import (
    InstallerContext,
    Phase,
    PhaseError,
    PhaseResult,
)
from acropolis.installer.phases.registry import PhaseRegistry
from acropolis.tests.fixtures.stub_fips_bootstrap_phase import StubFipsBootstrapPhase


# ── Tiny in-test phase fixtures ──────────────────────────────────────────────

class StubA(Phase):
    id = "stub.a"
    order = 100

    def run(self, ctx: InstallerContext) -> PhaseResult:
        return PhaseResult(self.id, success=True)


class StubB(Phase):
    id = "stub.b"
    order = 200
    depends_on = ["stub.a"]

    def run(self, ctx: InstallerContext) -> PhaseResult:
        return PhaseResult(self.id, success=True)


class StubFailing(Phase):
    id = "stub.fail"
    order = 100

    def run(self, ctx: InstallerContext) -> PhaseResult:
        return PhaseResult(self.id, success=False, message="boom")


class StubLogger(Phase):
    """Phase that appends its id to a shared list when run."""

    def __init__(self, log: list[str], pid: str, order: int = 0, depends_on: list[str] | None = None) -> None:
        self.id = pid
        self.order = order
        self.depends_on = depends_on or []
        self._log = log

    def run(self, ctx: InstallerContext) -> PhaseResult:
        self._log.append(self.id)
        return PhaseResult(self.id, success=True)


# ── Tests ────────────────────────────────────────────────────────────────────

def test_register_and_list():
    reg = PhaseRegistry()
    reg.register(StubA())
    reg.register(StubB())
    assert reg.names() == ["stub.a", "stub.b"]


def test_empty_id_rejected():
    class Bad(Phase):
        id = ""

        def run(self, ctx):
            return PhaseResult(self.id, success=True)

    reg = PhaseRegistry()
    with pytest.raises(ValueError, match="empty id"):
        reg.register(Bad())


def test_topological_sort_respects_depends_on():
    reg = PhaseRegistry()
    reg.register(StubB())
    reg.register(StubA())
    sorted_ids = [p.id for p in reg.sorted_phases("community")]
    assert sorted_ids.index("stub.a") < sorted_ids.index("stub.b")


def test_ee_only_phase_excluded_in_community_edition():
    reg = PhaseRegistry()
    reg.register(StubA())
    reg.register(StubFipsBootstrapPhase())
    ids = [p.id for p in reg.sorted_phases("community")]
    assert "stub.enterprise.fips_bootstrap" not in ids
    assert "stub.a" in ids


def test_ee_only_phase_included_in_enterprise_edition():
    reg = PhaseRegistry()
    reg.register(StubA())
    reg.register(StubFipsBootstrapPhase())
    # depends_on points at a community phase that IS applicable to
    # enterprise — the registry's filter retains it.
    class CommunityPreflight(Phase):
        id = "community.preflight"
        order = 100

        def run(self, ctx):
            return PhaseResult(self.id, success=True)

    reg.register(CommunityPreflight())

    ids = [p.id for p in reg.sorted_phases("enterprise")]
    assert "stub.enterprise.fips_bootstrap" in ids
    # depends_on must be respected
    assert ids.index("community.preflight") < ids.index("stub.enterprise.fips_bootstrap")


def test_duplicate_id_raises():
    reg = PhaseRegistry()
    reg.register(StubA())
    with pytest.raises(ValueError, match="already registered"):
        reg.register(StubA())


def test_missing_dependency_raises():
    class Orphan(Phase):
        id = "orphan"
        depends_on = ["does-not-exist"]

        def run(self, ctx):
            return PhaseResult(self.id, success=True)

    reg = PhaseRegistry()
    reg.register(Orphan())
    with pytest.raises(PhaseError, match="depends_on"):
        reg.sorted_phases("community")


def test_cycle_detection():
    class C1(Phase):
        id = "c.1"
        depends_on = ["c.2"]

        def run(self, ctx):
            return PhaseResult(self.id, success=True)

    class C2(Phase):
        id = "c.2"
        depends_on = ["c.1"]

        def run(self, ctx):
            return PhaseResult(self.id, success=True)

    reg = PhaseRegistry()
    reg.register(C1())
    reg.register(C2())
    with pytest.raises(PhaseError, match="cycle"):
        reg.sorted_phases("community")


def test_run_all_executes_in_topological_order():
    reg = PhaseRegistry()
    log: list[str] = []
    reg.register(StubLogger(log, "p.b", order=200, depends_on=["p.a"]))
    reg.register(StubLogger(log, "p.a", order=100))

    ctx = _stub_ctx()
    reg.run_all(ctx, edition="community")
    assert log == ["p.a", "p.b"]


def test_run_all_aborts_on_failure_with_phase_error():
    reg = PhaseRegistry()
    reg.register(StubFailing())

    ctx = _stub_ctx()
    with pytest.raises(PhaseError, match="boom"):
        reg.run_all(ctx, edition="community")


def test_run_all_propagates_unhandled_exception():
    class Throws(Phase):
        id = "throws"

        def run(self, ctx):
            raise RuntimeError("kaboom")

    reg = PhaseRegistry()
    reg.register(Throws())
    ctx = _stub_ctx()
    with pytest.raises(PhaseError, match="kaboom"):
        reg.run_all(ctx, edition="community")


def test_pluggability_proof_stub_fips_phase_runs_when_registered_at_runtime():
    """The headline pluggability proof: an EE-shaped stub plugs in via
    a single ``register()`` call. CE never patches anything."""
    from acropolis.installer.phases.community import register_into

    reg = PhaseRegistry()
    register_into(reg)
    reg.register(StubFipsBootstrapPhase())

    ids = [p.id for p in reg.sorted_phases("enterprise")]
    assert "stub.enterprise.fips_bootstrap" in ids
    # And it appears AFTER the community preflight per depends_on.
    assert ids.index("community.preflight") < ids.index("stub.enterprise.fips_bootstrap")


def test_clear_resets_the_registry():
    reg = PhaseRegistry()
    reg.register(StubA())
    reg.register(StubB())
    reg.clear()
    assert reg.names() == []


# ── Helpers ──────────────────────────────────────────────────────────────────

def _stub_ctx() -> InstallerContext:
    """Build a minimal ``InstallerContext`` for tests that don't read the state file."""
    from rich.console import Console

    from acropolis.installer.state import InstallState

    state = InstallState.__new__(InstallState)
    state.path = None  # type: ignore[assignment]
    state.version = 1
    state.started_at = ""
    state.completed_phases = []
    state.current_phase = None
    state.data = {}
    return InstallerContext(state=state, console=Console())
