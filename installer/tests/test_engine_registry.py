from __future__ import annotations

import pytest
from installer.engine.registry import Context, Phase, PhaseRegistry, Step
from installer.engine.exceptions import StepError


def _noop_run(ctx: Context) -> None:
    pass


def _noop_check(ctx: Context) -> bool:
    return False


def make_step(step_id: str) -> Step:
    return Step(id=step_id, name=step_id, run=_noop_run, check=_noop_check)


def test_registry_preserves_phase_order():
    reg = PhaseRegistry()
    p1 = Phase(id="preflight", name="Preflight", steps=[make_step("preflight.a")])
    p2 = Phase(id="docker", name="Docker", steps=[make_step("docker.a")])
    reg.register(p1)
    reg.register(p2)
    assert [p.id for p in reg.phases()] == ["preflight", "docker"]


def test_all_step_ids_flat_ordered():
    reg = PhaseRegistry()
    reg.register(Phase(id="p1", name="P1", steps=[make_step("p1.a"), make_step("p1.b")]))
    reg.register(Phase(id="p2", name="P2", steps=[make_step("p2.a")]))
    assert reg.all_step_ids() == ["p1.a", "p1.b", "p2.a"]


def test_step_ids_unique_within_registry():
    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[make_step("p.a"), make_step("p.a")]))
    ids = reg.all_step_ids()
    assert len(ids) == len(set(ids)), "duplicate step IDs detected"


def test_context_emit_callable():
    messages: list[str] = []
    ctx = Context(config={}, secrets=None, emit=messages.append)
    ctx.emit("hello")
    assert messages == ["hello"]


def test_phases_returns_defensive_copy():
    reg = PhaseRegistry()
    p1 = Phase(id="p1", name="P1", steps=[make_step("p1.a")])
    reg.register(p1)
    phases = reg.phases()
    phases.append(Phase(id="p2", name="P2", steps=[]))
    assert len(reg.phases()) == 1, "external mutation of phases() should not affect registry"
