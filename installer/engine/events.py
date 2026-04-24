from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass
class ProgressEvent:
    type: str         # step_start | step_done | step_skip | step_fail
                      # | phase_start | phase_done | install_done | install_fail | log
    phase: str        # e.g. "docker"
    step: str | None  # e.g. "docker.pull_images" — None for phase/install events
    phase_index: int  # 1-based
    phase_total: int  # always 9
    step_index: int   # 1-based within phase (0 for phase events)
    step_total: int   # total steps in current phase
    message: str
    elapsed_s: float  # seconds since StepRunner was created

    def to_json(self) -> str:
        return json.dumps(asdict(self))
