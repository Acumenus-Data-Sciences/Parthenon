# installer/tests/test_engine_events.py
from __future__ import annotations
import json
import pytest
from installer.engine.events import ProgressEvent


def test_progress_event_to_json_roundtrip():
    event = ProgressEvent(
        type="step_start",
        phase="docker",
        step="docker.pull_images",
        phase_index=4,
        phase_total=9,
        step_index=1,
        step_total=5,
        message="Pulling Docker images",
        elapsed_s=12.4,
    )
    raw = event.to_json()
    data = json.loads(raw)
    assert data["type"] == "step_start"
    assert data["phase"] == "docker"
    assert data["step"] == "docker.pull_images"
    assert data["phase_index"] == 4
    assert data["elapsed_s"] == 12.4


def test_progress_event_step_none_serializes_as_null():
    event = ProgressEvent(
        type="phase_start",
        phase="preflight",
        step=None,
        phase_index=1,
        phase_total=9,
        step_index=0,
        step_total=5,
        message="Starting preflight",
        elapsed_s=0.0,
    )
    data = json.loads(event.to_json())
    assert data["step"] is None


def test_progress_event_all_fields_present():
    event = ProgressEvent(
        type="install_done",
        phase="admin",
        step=None,
        phase_index=9,
        phase_total=9,
        step_index=0,
        step_total=0,
        message="Done",
        elapsed_s=300.0,
    )
    data = json.loads(event.to_json())
    expected_keys = {"type", "phase", "step", "phase_index", "phase_total", "step_index", "step_total", "message", "elapsed_s"}
    assert expected_keys == set(data.keys())
