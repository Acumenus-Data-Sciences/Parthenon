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


def test_preflight_phase_registered_in_default_registry():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "preflight" in ids


def test_preflight_all_step_ids_prefixed():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase = next(p for p in DEFAULT_REGISTRY.phases() if p.id == "preflight")
    for step in phase.steps:
        assert step.id.startswith("preflight.")


def test_config_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "config" in ids


def test_config_phase_has_three_steps():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase = next(p for p in DEFAULT_REGISTRY.phases() if p.id == "config")
    assert len(phase.steps) == 3
    assert phase.steps[0].id == "config.gather"
    assert phase.steps[1].id == "config.write_env"
    assert phase.steps[2].id == "config.store_secrets"


def test_hecate_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "hecate" in ids


def test_docker_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "docker" in ids


def test_phase_order_is_correct():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert ids.index("preflight") < ids.index("config")
    assert ids.index("config") < ids.index("hecate")
    assert ids.index("hecate") < ids.index("docker")


def test_bootstrap_phase_has_six_steps():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase = next((p for p in DEFAULT_REGISTRY.phases() if p.id == "bootstrap"), None)
    assert phase is not None
    assert len(phase.steps) == 6


def test_all_nine_phases_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    expected = ["preflight", "config", "hecate", "docker", "bootstrap",
                "datasets", "frontend", "solr", "admin"]
    assert ids == expected
