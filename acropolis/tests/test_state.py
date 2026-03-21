"""Tests for installer.state module."""
import json
import os
from pathlib import Path
from installer.state import InstallState


def test_state_init_empty(tmp_path):
    state = InstallState(tmp_path / ".install-state.json")
    assert state.completed_phases == []
    assert state.current_phase is None
    assert state.data == {}


def test_state_save_and_load(tmp_path):
    path = tmp_path / ".install-state.json"
    state = InstallState(path)
    state.data["topology"] = {"mode": "local"}
    state.complete_phase(1)
    state.save()

    loaded = InstallState(path)
    loaded.load()
    assert loaded.completed_phases == [1]
    assert loaded.data["topology"]["mode"] == "local"


def test_state_file_permissions(tmp_path):
    path = tmp_path / ".install-state.json"
    state = InstallState(path)
    state.save()

    mode = oct(os.stat(path).st_mode)[-3:]
    assert mode == "600"


def test_state_complete_phase(tmp_path):
    state = InstallState(tmp_path / ".install-state.json")
    state.complete_phase(1)
    state.complete_phase(2)
    assert state.completed_phases == [1, 2]
    state.complete_phase(2)
    assert state.completed_phases == [1, 2]


def test_state_is_completed(tmp_path):
    state = InstallState(tmp_path / ".install-state.json")
    state.complete_phase(1)
    assert state.is_completed(1) is True
    assert state.is_completed(2) is False


def test_state_clear(tmp_path):
    path = tmp_path / ".install-state.json"
    state = InstallState(path)
    state.complete_phase(1)
    state.data["foo"] = "bar"
    state.save()

    state.clear()
    assert state.completed_phases == []
    assert state.data == {}
    assert not path.exists()


def test_state_exists(tmp_path):
    path = tmp_path / ".install-state.json"
    state = InstallState(path)
    assert state.exists() is False
    state.save()
    assert state.exists() is True
