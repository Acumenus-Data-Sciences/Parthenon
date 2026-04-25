"""Tests for installer.recovery module."""
from __future__ import annotations

import json
from pathlib import Path

from installer import recovery


def _write_state(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload))


def test_inspect_recommends_resume_when_one_step_failed(tmp_path):
    state_path = tmp_path / ".install-state.json"
    _write_state(
        state_path,
        {
            "schema_version": 2,
            "started_at": "2026-04-24T10:00:00Z",
            "steps": {
                "preflight.os": "completed",
                "bootstrap.compose_up": "completed",
                "frontend.build": "failed",
                "solr.index": "pending",
            },
            "last_error": {
                "step": "frontend.build",
                "message": "vite build failed: ENOMEM",
                "timestamp": "2026-04-24T10:05:00Z",
            },
        },
    )

    result = recovery.inspect(state_path)

    assert result["mode"] == "resume"
    assert result["can_resume"] is True
    assert result["last_phase"] == "frontend.build"
    assert "vite build failed" in result["message"]
    assert result["completed_steps"] == 2
    assert result["pending_steps"] == 1


def test_inspect_recommends_retry_when_state_missing(tmp_path):
    state_path = tmp_path / ".install-state.json"

    result = recovery.inspect(state_path)

    assert result == {
        "mode": "retry",
        "can_resume": False,
        "last_phase": None,
        "message": "no install state found",
        "completed_steps": 0,
        "pending_steps": 0,
    }


def test_inspect_recommends_retry_when_state_unparseable(tmp_path):
    state_path = tmp_path / ".install-state.json"
    state_path.write_text("not json")

    result = recovery.inspect(state_path)

    assert result["mode"] == "retry"
    assert result["can_resume"] is False
    assert "could not parse" in result["message"]


def test_inspect_recommends_reset_when_all_steps_failed(tmp_path):
    state_path = tmp_path / ".install-state.json"
    _write_state(
        state_path,
        {
            "schema_version": 2,
            "steps": {"a": "failed", "b": "failed", "c": "failed"},
            "last_error": {"step": "a", "message": "first failure"},
        },
    )

    result = recovery.inspect(state_path)

    assert result["mode"] == "reset"
    assert result["can_resume"] is False
