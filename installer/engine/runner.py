# installer/engine/runner.py
from __future__ import annotations

import sys
import time
from typing import IO, Any

from .checkpoint import CheckpointStore
from .events import ProgressEvent
from .exceptions import StepError
from .registry import Context, Phase, PhaseRegistry


class StepRunner:
    def __init__(
        self,
        registry: PhaseRegistry,
        checkpoint: CheckpointStore,
        config: dict[str, Any],
        secrets: Any,
        output: IO[str] | None = None,
    ) -> None:
        self._registry = registry
        self._checkpoint = checkpoint
        self._config = config
        self._secrets = secrets
        self._output = output or sys.stdout
        self._start = time.monotonic()

    def run(self, resume: bool = False) -> bool:
        phases = self._registry.phases()
        phase_total = len(phases)

        if not resume or not self._checkpoint.exists():
            self._checkpoint.initialize(self._registry.all_step_ids())

        state = self._checkpoint.load()
        steps_status = state.get("steps", {})

        for phase_index, phase in enumerate(phases, 1):
            step_total = len(phase.steps)
            self._emit("phase_start", phase, None, phase_index, phase_total, 0, step_total,
                       f"Starting {phase.name}")

            for step_index, step in enumerate(phase.steps, 1):
                status = steps_status.get(step.id, "pending")

                if status in ("done", "skipped"):
                    self._emit("step_skip", phase, step.id, phase_index, phase_total,
                               step_index, step_total, f"{step.name} — already complete")
                    continue

                # Capture loop variables for closure
                _pi, _pt, _si, _st, _ph, _sid = (
                    phase_index, phase_total, step_index, step_total, phase, step.id
                )

                def _log(msg: str, pi=_pi, pt=_pt, si=_si, st=_st, ph=_ph, sid=_sid) -> None:
                    self._emit("log", ph, sid, pi, pt, si, st, msg)

                ctx = Context(config=self._config, secrets=self._secrets, emit=_log)

                try:
                    if step.check(ctx):
                        self._checkpoint.set_step(step.id, "skipped")
                        self._emit("step_skip", phase, step.id, phase_index, phase_total,
                                   step_index, step_total, f"{step.name} — skipping (already done)")
                        continue
                except Exception:
                    pass  # check() failure is non-fatal; proceed to run()

                self._checkpoint.set_step(step.id, "running")
                self._emit("step_start", phase, step.id, phase_index, phase_total,
                           step_index, step_total, step.name)

                try:
                    step.run(ctx)
                    self._checkpoint.set_step(step.id, "done")
                    self._emit("step_done", phase, step.id, phase_index, phase_total,
                               step_index, step_total, f"{step.name} — done")
                except StepError as exc:
                    self._checkpoint.set_step(step.id, "failed", str(exc))
                    self._emit("step_fail", phase, step.id, phase_index, phase_total,
                               step_index, step_total, str(exc))
                    self._emit("install_fail", phase, step.id, phase_index, phase_total,
                               step_index, step_total,
                               "Installation failed. Run with --resume to continue.")
                    return False

            self._emit("phase_done", phase, None, phase_index, phase_total,
                       step_total, step_total, f"{phase.name} complete")

        self._checkpoint.delete()
        if not phases:
            return True
        last = phases[-1]
        self._emit("install_done", last, None, phase_total, phase_total,
                   0, 0, "Installation complete.")
        return True

    def _emit(self, event_type: str, phase: Phase, step_id: str | None,
              phase_index: int, phase_total: int, step_index: int, step_total: int,
              message: str) -> None:
        event = ProgressEvent(
            type=event_type,
            phase=phase.id,
            step=step_id,
            phase_index=phase_index,
            phase_total=phase_total,
            step_index=step_index,
            step_total=step_total,
            message=message,
            elapsed_s=round(time.monotonic() - self._start, 2),
        )
        print(event.to_json(), file=self._output, flush=True)
