# installer/engine/checkpoint.py
from __future__ import annotations

import json
import os
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 2


class CheckpointStore:
    def __init__(self, path: Path) -> None:
        self._path = Path(path)

    def initialize(self, all_step_ids: list[str]) -> None:
        data = {
            "schema_version": SCHEMA_VERSION,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "steps": {sid: "pending" for sid in all_step_ids},
            "last_error": None,
        }
        self._write(data)

    def exists(self) -> bool:
        return self._path.exists()

    def load(self) -> dict[str, Any]:
        if not self._path.exists():
            return {}
        with open(self._path) as f:
            data = json.load(f)
        if data.get("schema_version", 1) < SCHEMA_VERSION:
            data = self._migrate(data)
        # A step left in "running" means the previous run crashed mid-step.
        # Demote to "failed" so the next run retries it and last_error is populated.
        steps = data.get("steps", {})
        crashed = [sid for sid, s in steps.items() if s == "running"]
        if crashed:
            for sid in crashed:
                steps[sid] = "failed"
            data.setdefault("last_error", {})
            data["last_error"] = {
                "step": crashed[-1],
                "message": "Process was interrupted while this step was running.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._write(data)
        return data

    def set_step(self, step_id: str, status: str, error: str | None = None) -> None:
        data = self.load()
        if "steps" not in data:
            data["steps"] = {}
        data["steps"][step_id] = status
        if error:
            data["last_error"] = {
                "step": step_id,
                "message": error,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        self._write(data)

    def delete(self) -> None:
        self._path.unlink(missing_ok=True)

    def _write(self, data: dict[str, Any]) -> None:
        self._path.write_text(json.dumps(data, indent=2))
        os.chmod(self._path, stat.S_IRUSR | stat.S_IWUSR)

    def _migrate(self, data: dict[str, Any]) -> dict[str, Any]:
        # v1 format: {"completed_phases": [...], "config": {...}}
        # We can't reconstruct step-level granularity from phase names alone.
        # Return a fresh v2 schema so the runner replays from the beginning.
        return {
            "schema_version": SCHEMA_VERSION,
            "started_at": data.get("started_at", datetime.now(timezone.utc).isoformat()),
            "steps": {},
            "last_error": None,
        }
