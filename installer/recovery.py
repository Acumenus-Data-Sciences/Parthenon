"""Inspect .install-state.json and recommend a recovery mode.

Returns one of:
- "resume" when at least one step completed and one failed (Resume picks up)
- "retry"  when state is missing/corrupt (Retry from start)
- "reset"  when nothing completed and multiple failures suggest a stuck setup
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def inspect(state_path: Path) -> dict[str, Any]:
    """Return a recommendation payload."""
    if not state_path.exists():
        return {
            "mode": "retry",
            "can_resume": False,
            "last_phase": None,
            "message": "no install state found",
            "completed_steps": 0,
            "pending_steps": 0,
        }

    try:
        data = json.loads(state_path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        return {
            "mode": "retry",
            "can_resume": False,
            "last_phase": None,
            "message": f"could not parse install state: {exc}",
            "completed_steps": 0,
            "pending_steps": 0,
        }

    steps = data.get("steps") or {}
    completed = sum(1 for s in steps.values() if s == "completed")
    failed = sum(1 for s in steps.values() if s == "failed")
    pending = sum(1 for s in steps.values() if s == "pending")
    last_error = data.get("last_error") or {}
    last_phase = last_error.get("step")

    if completed == 0 and failed >= 2:
        mode = "reset"
        can_resume = False
    elif completed > 0 and failed >= 1:
        mode = "resume"
        can_resume = True
    elif failed >= 1:
        mode = "retry"
        can_resume = False
    else:
        mode = "retry"
        can_resume = False

    return {
        "mode": mode,
        "can_resume": can_resume,
        "last_phase": last_phase,
        "message": last_error.get("message", "no error recorded"),
        "completed_steps": completed,
        "pending_steps": pending,
    }
