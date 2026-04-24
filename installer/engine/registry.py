from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass(frozen=True)
class Context:
    config: dict[str, Any]
    secrets: Any          # SecretManager — use Any to avoid circular import
    emit: Callable[[str], None]  # log a message for the current step


@dataclass(frozen=True)
class Step:
    id: str
    name: str
    run: Callable[[Context], None]   # raises StepError on failure
    check: Callable[[Context], bool] # returns True if step can be safely skipped


@dataclass(frozen=True)
class Phase:
    id: str
    name: str
    steps: list[Step] = field(default_factory=list)


class PhaseRegistry:
    def __init__(self) -> None:
        self._phases: list[Phase] = []

    def register(self, phase: Phase) -> None:
        self._phases.append(phase)

    def phases(self) -> list[Phase]:
        return list(self._phases)

    def all_step_ids(self) -> list[str]:
        seen = set()
        result = []
        for phase in self._phases:
            for step in phase.steps:
                if step.id not in seen:
                    result.append(step.id)
                    seen.add(step.id)
        return result
