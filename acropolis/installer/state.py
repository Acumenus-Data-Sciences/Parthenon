"""Install state persistence for resume-on-failure."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class InstallState:
    """Manages .install-state.json for resume-on-failure."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.version: int = 1
        self.started_at: str = ""
        self.completed_phases: list[int] = []
        self.current_phase: int | None = None
        self.data: dict[str, Any] = {}
        if self.path.exists():
            self.load()

    def load(self) -> None:
        """Load state from disk."""
        raw = json.loads(self.path.read_text())
        self.version = raw.get("version", 1)
        self.started_at = raw.get("started_at", "")
        self.completed_phases = raw.get("completed_phases", [])
        self.current_phase = raw.get("current_phase")
        self.data = raw.get("data", {})

    def save(self) -> None:
        """Persist state to disk with restricted permissions."""
        if not self.started_at:
            self.started_at = datetime.now(timezone.utc).isoformat()
        payload = {
            "version": self.version,
            "started_at": self.started_at,
            "completed_phases": self.completed_phases,
            "current_phase": self.current_phase,
            "data": self.data,
        }
        self.path.write_text(json.dumps(payload, indent=2) + "\n")
        os.chmod(self.path, 0o600)

    def complete_phase(self, phase: int) -> None:
        """Mark a phase as completed."""
        if phase not in self.completed_phases:
            self.completed_phases.append(phase)
        self.current_phase = None

    def start_phase(self, phase: int) -> None:
        """Mark a phase as in-progress."""
        self.current_phase = phase

    def is_completed(self, phase: int) -> bool:
        """Check if a phase has been completed."""
        return phase in self.completed_phases

    def exists(self) -> bool:
        """Check if a state file exists on disk."""
        return self.path.exists()

    def clear(self) -> None:
        """Remove state file and reset in-memory state."""
        if self.path.exists():
            self.path.unlink()
        self.completed_phases = []
        self.current_phase = None
        self.data = {}
        self.started_at = ""
