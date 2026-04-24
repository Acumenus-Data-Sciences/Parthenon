# installer/tests/test_engine_contract.py
from __future__ import annotations
import io
import json
import pytest
from installer.engine.checkpoint import CheckpointStore
from installer.engine.events import ProgressEvent
from installer.engine.exceptions import StepError
from installer.engine.registry import Context, Phase, PhaseRegistry, Step
from installer.engine.runner import StepRunner
from installer.engine.secrets import SecretManager


def _make_registry(*phase_specs: tuple[str, list[str]]) -> PhaseRegistry:
    """Build a PhaseRegistry from (phase_id, [step_id, ...]) tuples."""
    reg = PhaseRegistry()
    for phase_id, step_ids in phase_specs:
        steps = [
            Step(
                id=f"{phase_id}.{sid}",
                name=sid,
                run=lambda ctx, _sid=sid: ctx.emit(f"ran {_sid}"),
                check=lambda ctx: False,
            )
            for sid in step_ids
        ]
        reg.register(Phase(id=phase_id, name=phase_id.title(), steps=steps))
    return reg


def _run_and_collect(reg: PhaseRegistry, tmp_path) -> tuple[bool, list[dict]]:
    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "secrets"), output=out)
    result = runner.run()
    events = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
    return result, events


def test_install_done_is_last_event(tmp_path):
    reg = _make_registry(("p1", ["a", "b"]))
    ok, events = _run_and_collect(reg, tmp_path)
    assert ok
    assert events[-1]["type"] == "install_done"


def test_phase_index_monotonically_increasing(tmp_path):
    reg = _make_registry(("p1", ["a"]), ("p2", ["b"]))
    _, events = _run_and_collect(reg, tmp_path)
    phase_starts = [e for e in events if e["type"] == "phase_start"]
    assert [e["phase_index"] for e in phase_starts] == [1, 2]


def test_step_index_resets_per_phase(tmp_path):
    reg = _make_registry(("p1", ["a", "b"]), ("p2", ["c"]))
    _, events = _run_and_collect(reg, tmp_path)
    p2_step_starts = [e for e in events if e["type"] == "step_start" and e["phase"] == "p2"]
    assert p2_step_starts[0]["step_index"] == 1


def test_failed_step_emits_step_fail_then_install_fail(tmp_path):
    def _bad_run(ctx: Context) -> None:
        raise StepError("boom")

    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[
        Step(id="p.bad", name="bad", run=_bad_run, check=lambda ctx: False)
    ]))
    ok, events = _run_and_collect(reg, tmp_path)
    assert not ok
    types = [e["type"] for e in events]
    assert "step_fail" in types
    assert "install_fail" in types
    assert types.index("step_fail") < types.index("install_fail")


def test_resume_skips_done_steps(tmp_path):
    calls: list[str] = []

    def _run_a(ctx: Context) -> None:
        calls.append("a")

    def _run_b(ctx: Context) -> None:
        calls.append("b")

    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[
        Step(id="p.a", name="a", run=_run_a, check=lambda ctx: False),
        Step(id="p.b", name="b", run=_run_b, check=lambda ctx: False),
    ]))

    # Pre-populate checkpoint: step a is done, step b is failed
    store = CheckpointStore(tmp_path / ".state.json")
    store.initialize(reg.all_step_ids())
    store.set_step("p.a", "done")
    store.set_step("p.b", "failed", "fake error")

    out = io.StringIO()
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "s"), output=out)
    runner.run(resume=True)

    # Only step b should have been called
    assert calls == ["b"]


def test_idempotency_check_skips_step(tmp_path):
    calls: list[str] = []

    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[
        Step(
            id="p.a",
            name="a",
            run=lambda ctx: calls.append("ran"),
            check=lambda ctx: True,  # already done
        )
    ]))
    _, events = _run_and_collect(reg, tmp_path)
    assert calls == []
    skip_events = [e for e in events if e["type"] == "step_skip"]
    assert len(skip_events) == 1


def test_all_events_valid_json(tmp_path):
    reg = _make_registry(("p1", ["a", "b"]), ("p2", ["c"]))
    _, events = _run_and_collect(reg, tmp_path)
    required = {"type", "phase", "step", "phase_index", "phase_total",
                "step_index", "step_total", "message", "elapsed_s"}
    for event in events:
        assert required == set(event.keys()), f"missing keys in {event}"


def test_engine_run_function_importable():
    """The top-level run() in cli.py must accept pre_seed and non_interactive kwargs."""
    import inspect
    from installer import cli
    sig = inspect.signature(cli.run)
    assert "pre_seed" in sig.parameters
    assert "non_interactive" in sig.parameters
    # Note: "resume" will be added in Task 12 CLI shim update
