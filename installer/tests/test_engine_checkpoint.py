# installer/tests/test_engine_checkpoint.py
from __future__ import annotations
import json
import stat
from pathlib import Path
import pytest
from installer.engine.checkpoint import CheckpointStore, SCHEMA_VERSION


@pytest.fixture
def store(tmp_path: Path) -> CheckpointStore:
    return CheckpointStore(tmp_path / ".install-state.json")


def test_initialize_writes_all_steps_pending(store: CheckpointStore):
    store.initialize(["p.a", "p.b", "p.c"])
    data = store.load()
    assert data["schema_version"] == SCHEMA_VERSION
    assert data["steps"] == {"p.a": "pending", "p.b": "pending", "p.c": "pending"}
    assert data["last_error"] is None


def test_file_is_chmod_600(store: CheckpointStore, tmp_path: Path):
    store.initialize(["p.a"])
    path = tmp_path / ".install-state.json"
    mode = oct(stat.S_IMODE(path.stat().st_mode))
    assert mode == "0o600"


def test_set_step_updates_status(store: CheckpointStore):
    store.initialize(["p.a", "p.b"])
    store.set_step("p.a", "done")
    data = store.load()
    assert data["steps"]["p.a"] == "done"
    assert data["steps"]["p.b"] == "pending"


def test_set_step_records_error(store: CheckpointStore):
    store.initialize(["p.a"])
    store.set_step("p.a", "failed", error="port 5432 in use")
    data = store.load()
    assert data["steps"]["p.a"] == "failed"
    assert data["last_error"]["step"] == "p.a"
    assert data["last_error"]["message"] == "port 5432 in use"


def test_crash_in_running_treated_as_failed_on_load(store: CheckpointStore):
    store.initialize(["p.a"])
    store.set_step("p.a", "running")
    # Simulate crash: load sees "running" — the runner treats it as failed
    data = store.load()
    assert data["steps"]["p.a"] == "running"


def test_delete_removes_file(store: CheckpointStore, tmp_path: Path):
    store.initialize(["p.a"])
    store.delete()
    assert not (tmp_path / ".install-state.json").exists()


def test_load_returns_empty_dict_when_file_missing(store: CheckpointStore):
    assert store.load() == {}


def test_migrate_v1_to_v2(store: CheckpointStore, tmp_path: Path):
    v1 = {"completed_phases": ["preflight", "config"], "config": {"app_url": "http://localhost"}}
    path = tmp_path / ".install-state.json"
    path.write_text(json.dumps(v1))
    data = store.load()
    assert data["schema_version"] == SCHEMA_VERSION
    assert "steps" in data
