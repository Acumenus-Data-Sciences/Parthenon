# installer/tests/test_engine_integration.py
"""Integration tests — require Docker. Skipped in CI if Docker is unavailable.

Run with: pytest installer/tests/test_engine_integration.py -v -m integration
"""
from __future__ import annotations

import io
import json
import subprocess
import pytest
from pathlib import Path

from installer.engine.checkpoint import CheckpointStore
from installer.engine.phases.preflight import PHASE as PREFLIGHT_PHASE
from installer.engine.registry import PhaseRegistry
from installer.engine.runner import StepRunner
from installer.engine.secrets import SecretManager


def _docker_available() -> bool:
    try:
        r = subprocess.run(["docker", "info"], capture_output=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _docker_available(), reason="Docker not available"
)


def test_preflight_steps_pass_on_healthy_system(tmp_path: Path):
    """Docker and Compose version checks must pass on a machine with Docker running.

    Port and container-conflict checks are skipped in this assertion because a
    running dev environment legitimately occupies those ports and has Parthenon
    containers active.  Only the two checks that are always safe to assert on
    a Docker-capable machine are validated here.
    """
    reg = PhaseRegistry()
    reg.register(PREFLIGHT_PHASE)

    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "s"), output=out)
    runner.run()

    events = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
    # Docker version and compose version steps must never fail on a Docker-capable host
    infra_fails = [
        e for e in events
        if e["type"] == "step_fail"
        and e["step"] in ("preflight.check_docker", "preflight.check_compose")
    ]
    assert infra_fails == [], f"Docker/Compose preflight failed: {infra_fails}"


def test_preflight_is_idempotent(tmp_path: Path):
    """Running preflight twice should mark all steps skipped on the second run."""
    reg = PhaseRegistry()
    reg.register(PREFLIGHT_PHASE)

    store = CheckpointStore(tmp_path / ".state.json")
    secrets = SecretManager(tmp_path / "s")

    # First run
    out1 = io.StringIO()
    StepRunner(reg, store, config={}, secrets=secrets, output=out1).run()
    # Re-init checkpoint with all steps marked done for second run
    store.initialize(reg.all_step_ids())
    for sid in reg.all_step_ids():
        store.set_step(sid, "done")

    # Second run with resume=True
    out2 = io.StringIO()
    StepRunner(reg, store, config={}, secrets=secrets, output=out2).run(resume=True)
    events2 = [json.loads(line) for line in out2.getvalue().splitlines() if line.strip()]

    skip_events = [e for e in events2 if e["type"] == "step_skip"]
    step_starts = [e for e in events2 if e["type"] == "step_start"]
    assert len(step_starts) == 0, "No steps should have run on the second pass"
    assert len(skip_events) == len(PREFLIGHT_PHASE.steps)


def test_all_events_have_required_fields(tmp_path: Path):
    """Every event emitted during preflight must have all required JSON keys."""
    reg = PhaseRegistry()
    reg.register(PREFLIGHT_PHASE)

    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "s"), output=out)
    runner.run()

    required = {"type", "phase", "step", "phase_index", "phase_total",
                "step_index", "step_total", "message", "elapsed_s"}
    for line in out.getvalue().splitlines():
        if not line.strip():
            continue
        data = json.loads(line)
        missing = required - set(data.keys())
        assert not missing, f"Event missing keys {missing}: {data}"
