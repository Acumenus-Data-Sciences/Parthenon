# Installer v2 Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `installer/engine/` — a clean Python engine module with step-level idempotent checkpointing, OS keychain-backed secrets, Docker secrets injection, and structured JSON progress events for the Tauri GUI — while leaving the existing CLI interface intact.

**Architecture:** New `installer/engine/` package sits alongside existing installer modules. The existing `cli.py` becomes a thin shim that constructs a `PhaseRegistry`, `CheckpointStore`, and `SecretManager`, then calls `StepRunner.run()`. All 9 phases are reimplemented as engine phase files that delegate to the existing `utils.py`, `docker_ops.py`, `bootstrap.py`, and `preflight.py` helpers. No existing module is deleted.

**Tech Stack:** Python 3.9+, `keyring` (OS keychain), `pytest`, `subprocess`, `json`, `pathlib`

---

## File Map

**Create:**
- `installer/engine/__init__.py` — re-exports `StepRunner`, `PhaseRegistry`, `CheckpointStore`, `SecretManager`
- `installer/engine/exceptions.py` — `StepError` (single exception class)
- `installer/engine/events.py` — `ProgressEvent` dataclass + JSON serializer
- `installer/engine/registry.py` — `Step`, `Phase`, `PhaseRegistry`, `Context`
- `installer/engine/checkpoint.py` — `CheckpointStore` (step-level state, schema v2)
- `installer/engine/secrets.py` — `SecretManager` (keyring + fallback)
- `installer/engine/runner.py` — `StepRunner`
- `installer/engine/phases/__init__.py` — `DEFAULT_REGISTRY` populated from all 9 phases
- `installer/engine/phases/preflight.py` — 5-step preflight phase
- `installer/engine/phases/config.py` — 3-step config phase
- `installer/engine/phases/hecate.py` — 2-step hecate bootstrap phase
- `installer/engine/phases/docker.py` — 4-step docker phase
- `installer/engine/phases/bootstrap.py` — 6-step Laravel bootstrap phase
- `installer/engine/phases/datasets.py` — 3-step dataset acquisition phase
- `installer/engine/phases/frontend.py` — 2-step frontend build phase
- `installer/engine/phases/solr.py` — 3-step Solr indexing phase
- `installer/engine/phases/admin.py` — 2-step admin account phase
- `installer/requirements.txt` — `keyring`, `pytest`
- `docker/secrets-entrypoint.sh` — sources `/run/secrets/*` into env before exec
- `installer/tests/test_engine_events.py`
- `installer/tests/test_engine_registry.py`
- `installer/tests/test_engine_checkpoint.py`
- `installer/tests/test_engine_secrets.py`
- `installer/tests/test_engine_contract.py`
- `installer/tests/test_engine_integration.py`

**Modify:**
- `installer/cli.py` — thin shim; delegates to `DEFAULT_REGISTRY` + `StepRunner`
- `docker-compose.yml` — add `secrets:` top-level declarations

---

## Task 1: Engine scaffold + exceptions + events

**Files:**
- Create: `installer/engine/__init__.py`
- Create: `installer/engine/exceptions.py`
- Create: `installer/engine/events.py`
- Create: `installer/requirements.txt`
- Test: `installer/tests/test_engine_events.py`

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /path/to/Parthenon
python -m pytest installer/tests/test_engine_events.py -v
```

Expected: `ModuleNotFoundError: No module named 'installer.engine'`

- [ ] **Step 3: Create requirements.txt and engine scaffold**

```
# installer/requirements.txt
keyring>=25.0.0
pytest>=8.0.0
```

```python
# installer/engine/__init__.py
from .runner import StepRunner
from .registry import PhaseRegistry
from .checkpoint import CheckpointStore
from .secrets import SecretManager

__all__ = ["StepRunner", "PhaseRegistry", "CheckpointStore", "SecretManager"]
```

```python
# installer/engine/exceptions.py
from __future__ import annotations


class StepError(Exception):
    """Raised by a Step.run() implementation to signal a recoverable failure."""
```

```python
# installer/engine/events.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest installer/tests/test_engine_events.py -v
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/engine/__init__.py installer/engine/exceptions.py installer/engine/events.py installer/requirements.txt installer/tests/test_engine_events.py
git commit -m "feat(installer-v2): add engine scaffold, StepError, ProgressEvent"
```

---

## Task 2: PhaseRegistry + Context

**Files:**
- Create: `installer/engine/registry.py`
- Test: `installer/tests/test_engine_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# installer/tests/test_engine_registry.py
from __future__ import annotations
import pytest
from installer.engine.registry import Context, Phase, PhaseRegistry, Step
from installer.engine.exceptions import StepError


def _noop_run(ctx: Context) -> None:
    pass


def _noop_check(ctx: Context) -> bool:
    return False


def make_step(step_id: str) -> Step:
    return Step(id=step_id, name=step_id, run=_noop_run, check=_noop_check)


def test_registry_preserves_phase_order():
    reg = PhaseRegistry()
    p1 = Phase(id="preflight", name="Preflight", steps=[make_step("preflight.a")])
    p2 = Phase(id="docker", name="Docker", steps=[make_step("docker.a")])
    reg.register(p1)
    reg.register(p2)
    assert [p.id for p in reg.phases()] == ["preflight", "docker"]


def test_all_step_ids_flat_ordered():
    reg = PhaseRegistry()
    reg.register(Phase(id="p1", name="P1", steps=[make_step("p1.a"), make_step("p1.b")]))
    reg.register(Phase(id="p2", name="P2", steps=[make_step("p2.a")]))
    assert reg.all_step_ids() == ["p1.a", "p1.b", "p2.a"]


def test_step_ids_unique_within_registry():
    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[make_step("p.a"), make_step("p.a")]))
    ids = reg.all_step_ids()
    assert len(ids) == len(set(ids)), "duplicate step IDs detected"


def test_context_emit_callable():
    messages: list[str] = []
    ctx = Context(config={}, secrets=None, emit=messages.append)
    ctx.emit("hello")
    assert messages == ["hello"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: `ImportError` — `registry` module not found

- [ ] **Step 3: Implement registry.py**

```python
# installer/engine/registry.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Context:
    config: dict[str, Any]
    secrets: Any          # SecretManager — use Any to avoid circular import
    emit: Callable[[str], None]  # log a message for the current step


@dataclass
class Step:
    id: str
    name: str
    run: Callable[[Context], None]   # raises StepError on failure
    check: Callable[[Context], bool] # returns True if step can be safely skipped


@dataclass
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
        return [step.id for phase in self._phases for step in phase.steps]
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/engine/registry.py installer/tests/test_engine_registry.py
git commit -m "feat(installer-v2): add Step, Phase, PhaseRegistry, Context"
```

---

## Task 3: CheckpointStore

**Files:**
- Create: `installer/engine/checkpoint.py`
- Test: `installer/tests/test_engine_checkpoint.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest installer/tests/test_engine_checkpoint.py -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement checkpoint.py**

```python
# installer/engine/checkpoint.py
from __future__ import annotations

import json
import os
import stat
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 2


class CheckpointStore:
    def __init__(self, path: Path) -> None:
        self._path = path

    def initialize(self, all_step_ids: list[str]) -> None:
        data = {
            "schema_version": SCHEMA_VERSION,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "steps": {sid: "pending" for sid in all_step_ids},
            "last_error": None,
        }
        self._write(data)

    def load(self) -> dict:
        if not self._path.exists():
            return {}
        with open(self._path) as f:
            data = json.load(f)
        if data.get("schema_version", 1) < SCHEMA_VERSION:
            data = self._migrate(data)
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

    def _write(self, data: dict) -> None:
        self._path.write_text(json.dumps(data, indent=2))
        os.chmod(self._path, stat.S_IRUSR | stat.S_IWUSR)

    def _migrate(self, data: dict) -> dict:
        # v1 format: {"completed_phases": [...], "config": {...}}
        # We can't reconstruct step-level granularity from phase names alone.
        # Return a fresh v2 schema so the runner replays from the beginning.
        return {
            "schema_version": SCHEMA_VERSION,
            "started_at": data.get("started_at", datetime.now(timezone.utc).isoformat()),
            "steps": {},
            "last_error": None,
        }
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest installer/tests/test_engine_checkpoint.py -v
```

Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/engine/checkpoint.py installer/tests/test_engine_checkpoint.py
git commit -m "feat(installer-v2): add CheckpointStore with step-level state and schema migration"
```

---

## Task 4: SecretManager

**Files:**
- Create: `installer/engine/secrets.py`
- Test: `installer/tests/test_engine_secrets.py`

- [ ] **Step 1: Install keyring and write the failing tests**

```bash
pip install keyring --break-system-packages
```

```python
# installer/tests/test_engine_secrets.py
from __future__ import annotations
import os
import stat
from pathlib import Path
import pytest
import keyring
import keyring.backends.memory
from installer.engine.secrets import SecretManager, SERVICE_NAME


@pytest.fixture(autouse=True)
def memory_keyring():
    """Use in-memory keyring for all tests — no system keychain interaction."""
    keyring.set_keyring(keyring.backends.memory.MemoryKeyring())
    yield
    # reset to default after each test
    keyring.core._keyring_backend = None  # type: ignore[attr-defined]


@pytest.fixture
def mgr() -> SecretManager:
    return SecretManager()


def test_set_and_get_roundtrip(mgr: SecretManager):
    mgr.set("DB_PASSWORD", "supersecret")
    assert mgr.get("DB_PASSWORD") == "supersecret"


def test_get_missing_key_returns_none(mgr: SecretManager):
    assert mgr.get("NONEXISTENT") is None


def test_delete_removes_key(mgr: SecretManager):
    mgr.set("APP_KEY", "base64:abc123")
    mgr.delete("APP_KEY")
    assert mgr.get("APP_KEY") is None


def test_write_docker_secrets_creates_files(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    mgr.set("REDIS_PASSWORD", "redispass")
    mgr.write_docker_secrets(["DB_PASSWORD", "REDIS_PASSWORD"], tmp_path)
    db_file = tmp_path / "DB_PASSWORD"
    assert db_file.exists()
    assert db_file.read_text() == "dbpass"
    mode = oct(stat.S_IMODE(db_file.stat().st_mode))
    assert mode == "0o600"


def test_write_docker_secrets_skips_missing_keys(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    mgr.write_docker_secrets(["DB_PASSWORD", "NONEXISTENT"], tmp_path)
    assert (tmp_path / "DB_PASSWORD").exists()
    assert not (tmp_path / "NONEXISTENT").exists()


def test_export_credentials_file(mgr: SecretManager, tmp_path: Path):
    mgr.set("DB_PASSWORD", "dbpass")
    mgr.set("ADMIN_PASSWORD", "adminpass")
    out = tmp_path / ".install-credentials"
    mgr.export_credentials_file(out, ["DB_PASSWORD", "ADMIN_PASSWORD"])
    content = out.read_text()
    assert "DB_PASSWORD=dbpass" in content
    assert "ADMIN_PASSWORD=adminpass" in content
    mode = oct(stat.S_IMODE(out.stat().st_mode))
    assert mode == "0o600"
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest installer/tests/test_engine_secrets.py -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement secrets.py**

```python
# installer/engine/secrets.py
from __future__ import annotations

import os
import stat
from pathlib import Path

import keyring
import keyring.errors

SERVICE_NAME = "parthenon-installer"


class SecretManager:
    """Stores and retrieves secrets via the OS keychain (keyring).

    Falls back to a plaintext file store in ~/.parthenon-secrets/ on
    headless systems where no keyring daemon is available (CI runners).
    """

    def __init__(self, fallback_dir: Path | None = None) -> None:
        self._fallback_dir = fallback_dir or (Path.home() / ".parthenon-secrets")
        self._use_keyring = self._probe_keyring()

    def _probe_keyring(self) -> bool:
        try:
            keyring.set_password(SERVICE_NAME, "__probe__", "1")
            keyring.delete_password(SERVICE_NAME, "__probe__")
            return True
        except Exception:
            return False

    def set(self, key: str, value: str) -> None:
        if self._use_keyring:
            keyring.set_password(SERVICE_NAME, key, value)
        else:
            self._fb_write(key, value)

    def get(self, key: str) -> str | None:
        if self._use_keyring:
            return keyring.get_password(SERVICE_NAME, key)
        return self._fb_read(key)

    def delete(self, key: str) -> None:
        if self._use_keyring:
            try:
                keyring.delete_password(SERVICE_NAME, key)
            except keyring.errors.PasswordDeleteError:
                pass
        else:
            (self._fallback_dir / key).unlink(missing_ok=True)

    def write_docker_secrets(self, keys: list[str], secrets_dir: Path) -> None:
        """Write each secret as a file in secrets_dir (chmod 600)."""
        secrets_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        for key in keys:
            value = self.get(key)
            if value is None:
                continue
            path = secrets_dir / key
            path.write_text(value)
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def export_credentials_file(self, path: Path, keys: list[str]) -> None:
        """Write KEY=VALUE lines for each key to path (chmod 600)."""
        lines = [f"{k}={v}" for k in keys if (v := self.get(k)) is not None]
        path.write_text("\n".join(lines) + "\n")
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def _fb_write(self, key: str, value: str) -> None:
        self._fallback_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        path = self._fallback_dir / key
        path.write_text(value)
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)

    def _fb_read(self, key: str) -> str | None:
        path = self._fallback_dir / key
        return path.read_text().strip() if path.exists() else None
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest installer/tests/test_engine_secrets.py -v
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add installer/engine/secrets.py installer/tests/test_engine_secrets.py
git commit -m "feat(installer-v2): add SecretManager with keyring backend and fallback"
```

---

## Task 5: StepRunner + contract tests

**Files:**
- Create: `installer/engine/runner.py`
- Test: `installer/tests/test_engine_contract.py`

- [ ] **Step 1: Write the failing contract tests**

```python
# installer/tests/test_engine_contract.py
from __future__ import annotations
import io
import json
import pytest
from installer.engine.checkpoint import CheckpointStore
from installer.engine.events import ProgressEvent
from installer.engine.exceptions import StepError
from installer.engine.registry import Context, Phase, PhaseRegistry, Step
from installer.engine.runner import StepRunner
from installer.engine.secrets import SecretManager


def _make_registry(*phase_specs: tuple[str, list[str]]) -> PhaseRegistry:
    """Build a PhaseRegistry from (phase_id, [step_id, ...]) tuples."""
    reg = PhaseRegistry()
    for phase_id, step_ids in phase_specs:
        steps = [
            Step(
                id=f"{phase_id}.{sid}",
                name=sid,
                run=lambda ctx, _sid=sid: ctx.emit(f"ran {_sid}"),
                check=lambda ctx: False,
            )
            for sid in step_ids
        ]
        reg.register(Phase(id=phase_id, name=phase_id.title(), steps=steps))
    return reg


def _run_and_collect(reg: PhaseRegistry, tmp_path) -> tuple[bool, list[dict]]:
    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "secrets"), output=out)
    result = runner.run()
    events = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
    return result, events


def test_install_done_is_last_event(tmp_path):
    reg = _make_registry(("p1", ["a", "b"]))
    ok, events = _run_and_collect(reg, tmp_path)
    assert ok
    assert events[-1]["type"] == "install_done"


def test_phase_index_monotonically_increasing(tmp_path):
    reg = _make_registry(("p1", ["a"]), ("p2", ["b"]))
    _, events = _run_and_collect(reg, tmp_path)
    phase_starts = [e for e in events if e["type"] == "phase_start"]
    assert [e["phase_index"] for e in phase_starts] == [1, 2]


def test_step_index_resets_per_phase(tmp_path):
    reg = _make_registry(("p1", ["a", "b"]), ("p2", ["c"]))
    _, events = _run_and_collect(reg, tmp_path)
    p2_step_starts = [e for e in events if e["type"] == "step_start" and e["phase"] == "p2"]
    assert p2_step_starts[0]["step_index"] == 1


def test_failed_step_emits_step_fail_then_install_fail(tmp_path):
    def _bad_run(ctx: Context) -> None:
        raise StepError("boom")

    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[
        Step(id="p.bad", name="bad", run=_bad_run, check=lambda ctx: False)
    ]))
    ok, events = _run_and_collect(reg, tmp_path)
    assert not ok
    types = [e["type"] for e in events]
    assert "step_fail" in types
    assert "install_fail" in types
    assert types.index("step_fail") < types.index("install_fail")


def test_resume_skips_done_steps(tmp_path):
    calls: list[str] = []

    def _run_a(ctx: Context) -> None:
        calls.append("a")

    def _run_b(ctx: Context) -> None:
        calls.append("b")

    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[
        Step(id="p.a", name="a", run=_run_a, check=lambda ctx: False),
        Step(id="p.b", name="b", run=_run_b, check=lambda ctx: False),
    ]))

    # First run: fail after step a
    store = CheckpointStore(tmp_path / ".state.json")
    store.initialize(reg.all_step_ids())
    store.set_step("p.a", "done")
    store.set_step("p.b", "failed", "fake error")

    out = io.StringIO()
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "s"), output=out)
    runner.run(resume=True)

    # Only step b should have been called
    assert calls == ["b"]


def test_idempotency_check_skips_step(tmp_path):
    calls: list[str] = []

    reg = PhaseRegistry()
    reg.register(Phase(id="p", name="P", steps=[
        Step(
            id="p.a",
            name="a",
            run=lambda ctx: calls.append("ran"),
            check=lambda ctx: True,  # already done
        )
    ]))
    _, events = _run_and_collect(reg, tmp_path)
    assert calls == []
    skip_events = [e for e in events if e["type"] == "step_skip"]
    assert len(skip_events) == 1


def test_all_events_valid_json(tmp_path):
    reg = _make_registry(("p1", ["a", "b"]), ("p2", ["c"]))
    _, events = _run_and_collect(reg, tmp_path)
    required = {"type", "phase", "step", "phase_index", "phase_total",
                "step_index", "step_total", "message", "elapsed_s"}
    for event in events:
        assert required == set(event.keys()), f"missing keys in {event}"
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest installer/tests/test_engine_contract.py -v
```

Expected: `ImportError` — runner not found

- [ ] **Step 3: Implement runner.py**

```python
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

        if not resume:
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

                def _log(msg: str, _pi=phase_index, _pt=phase_total, _si=step_index, _st=step_total, _p=phase, _s=step.id) -> None:
                    self._emit("log", _p, _s, _pi, _pt, _si, _st, msg)

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
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest installer/tests/test_engine_contract.py -v
```

Expected: 7 tests PASS

- [ ] **Step 5: Run all engine tests to verify nothing regressed**

```bash
python -m pytest installer/tests/test_engine_events.py installer/tests/test_engine_registry.py installer/tests/test_engine_checkpoint.py installer/tests/test_engine_secrets.py installer/tests/test_engine_contract.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add installer/engine/runner.py installer/tests/test_engine_contract.py
git commit -m "feat(installer-v2): add StepRunner with resume, idempotency checks, and event emission"
```

---

## Task 6: Preflight phase

**Files:**
- Create: `installer/engine/phases/__init__.py`
- Create: `installer/engine/phases/preflight.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to installer/tests/test_engine_registry.py (append these tests)

def test_preflight_phase_registered_in_default_registry():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "preflight" in ids


def test_preflight_all_step_ids_prefixed():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase = next(p for p in DEFAULT_REGISTRY.phases() if p.id == "preflight")
    for step in phase.steps:
        assert step.id.startswith("preflight.")
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest installer/tests/test_engine_registry.py::test_preflight_phase_registered_in_default_registry -v
```

Expected: `ImportError`

- [ ] **Step 3: Implement phases/preflight.py**

```python
# installer/engine/phases/preflight.py
from __future__ import annotations

import socket

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

REQUIRED_PORTS = [5173, 8082, 5432, 6379, 8983, 8002]


def _check_always_false(ctx: Context) -> bool:
    return False  # preflight always re-verifies system state


def _run_check_docker(ctx: Context) -> None:
    version = utils.docker_version()
    if version is None:
        raise StepError("Docker is not installed or not running. Install Docker Desktop and retry.")
    try:
        major = int(version.split(".")[0])
    except ValueError:
        raise StepError(f"Cannot parse Docker version: {version!r}")
    if major < 24:
        raise StepError(f"Docker {version} is too old. Version 24+ is required.")
    ctx.emit(f"Docker {version} — OK")


def _run_check_compose(ctx: Context) -> None:
    version = utils.docker_compose_version()
    if version is None:
        raise StepError("Docker Compose v2 is not available. Update Docker Desktop.")
    if not version.startswith("v2") and not version.startswith("2"):
        raise StepError(f"Docker Compose {version} is v1. Compose v2+ is required.")
    ctx.emit(f"Docker Compose {version} — OK")


def _run_check_ports(ctx: Context) -> None:
    busy = [p for p in REQUIRED_PORTS if not utils.is_port_free(p)]
    if busy:
        raise StepError(f"Ports already in use: {busy}. Free them or reconfigure.")
    ctx.emit(f"Ports {REQUIRED_PORTS} — all free")


def _run_check_disk(ctx: Context) -> None:
    free = utils.free_disk_gb()
    if free < 5.0:
        raise StepError(f"Only {free:.1f} GB free. 5 GB minimum required.")
    ctx.emit(f"Disk space: {free:.1f} GB free — OK")


def _run_check_conflicts(ctx: Context) -> None:
    import subprocess
    result = subprocess.run(
        ["docker", "ps", "--filter", "name=parthenon", "--format", "{{.Names}}"],
        capture_output=True, text=True,
    )
    names = [n for n in result.stdout.splitlines() if n.strip()]
    if names:
        raise StepError(
            f"Existing Parthenon containers detected: {names}. "
            "Run 'docker compose down' before a fresh install."
        )
    ctx.emit("No conflicting containers — OK")


PHASE = Phase(
    id="preflight",
    name="Preflight",
    steps=[
        Step(id="preflight.check_docker", name="Check Docker version",
             run=_run_check_docker, check=_check_always_false),
        Step(id="preflight.check_compose", name="Check Docker Compose v2",
             run=_run_check_compose, check=_check_always_false),
        Step(id="preflight.check_ports", name="Check required ports are free",
             run=_run_check_ports, check=_check_always_false),
        Step(id="preflight.check_disk", name="Check disk space (5 GB minimum)",
             run=_run_check_disk, check=_check_always_false),
        Step(id="preflight.check_conflicts", name="Check for conflicting containers",
             run=_run_check_conflicts, check=_check_always_false),
    ],
)
```

- [ ] **Step 4: Create phases/__init__.py with DEFAULT_REGISTRY**

```python
# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
# Remaining phases registered in Tasks 7-10
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: all PASS including the 2 new preflight tests

- [ ] **Step 6: Commit**

```bash
git add installer/engine/phases/__init__.py installer/engine/phases/preflight.py
git commit -m "feat(installer-v2): add preflight phase (5 steps)"
```

---

## Task 7: Config phase

**Files:**
- Create: `installer/engine/phases/config.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to installer/tests/test_engine_registry.py

def test_config_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "config" in ids

def test_config_phase_has_three_steps():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase = next(p for p in DEFAULT_REGISTRY.phases() if p.id == "config")
    assert len(phase.steps) == 3
    assert phase.steps[0].id == "config.gather"
    assert phase.steps[1].id == "config.write_env"
    assert phase.steps[2].id == "config.store_secrets"
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest installer/tests/test_engine_registry.py::test_config_phase_registered -v
```

Expected: FAIL — "config" not in registry

- [ ] **Step 3: Implement phases/config.py**

```python
# installer/engine/phases/config.py
from __future__ import annotations

from pathlib import Path
from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import config as cfg_module, utils

ROOT = utils.REPO_ROOT


def _check_gather(ctx: Context) -> bool:
    return False  # always re-evaluate; pre_seed may change


def _run_gather(ctx: Context) -> None:
    pre_seed = ctx.config.get("pre_seed", {})
    non_interactive = ctx.config.get("non_interactive", False)
    try:
        resolved = cfg_module.build_config(
            non_interactive=non_interactive,
            pre_seed=pre_seed,
        )
    except Exception as exc:
        raise StepError(f"Config gathering failed: {exc}") from exc
    ctx.config["resolved"] = resolved
    ctx.emit(f"Config gathered — edition={resolved.get('PARTHENON_EDITION', 'community')}")


def _check_write_env(ctx: Context) -> bool:
    env_file = ROOT / "backend" / ".env"
    return env_file.exists() and "APP_KEY=" in env_file.read_text()


def _run_write_env(ctx: Context) -> None:
    resolved = ctx.config.get("resolved")
    if resolved is None:
        raise StepError("Config not gathered — run config.gather first")
    try:
        cfg_module.write_env_files(resolved)
    except Exception as exc:
        raise StepError(f"Writing .env files failed: {exc}") from exc
    ctx.emit("Written: .env, backend/.env")


def _check_store_secrets(ctx: Context) -> bool:
    return ctx.secrets.get("DB_PASSWORD") is not None


def _run_store_secrets(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    secret_keys = ["DB_PASSWORD", "REDIS_PASSWORD", "APP_KEY", "ADMIN_PASSWORD"]
    stored = 0
    for key in secret_keys:
        value = resolved.get(key)
        if value:
            ctx.secrets.set(key, value)
            stored += 1
    ctx.emit(f"Stored {stored} secrets in OS keychain")


PHASE = Phase(
    id="config",
    name="Configuration",
    steps=[
        Step(id="config.gather", name="Gather configuration",
             run=_run_gather, check=_check_gather),
        Step(id="config.write_env", name="Write .env files",
             run=_run_write_env, check=_check_write_env),
        Step(id="config.store_secrets", name="Store secrets in OS keychain",
             run=_run_store_secrets, check=_check_store_secrets),
    ],
)
```

- [ ] **Step 4: Register config phase in phases/__init__.py**

```python
# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
DEFAULT_REGISTRY.register(CONFIG)
# Remaining phases registered in Tasks 8-10
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add installer/engine/phases/config.py installer/engine/phases/__init__.py
git commit -m "feat(installer-v2): add config phase (gather, write_env, store_secrets)"
```

---

## Task 8: Hecate + Docker phases

**Files:**
- Create: `installer/engine/phases/hecate.py`
- Create: `installer/engine/phases/docker.py`

- [ ] **Step 1: Write the failing tests**

```python
# Add to installer/tests/test_engine_registry.py

def test_hecate_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "hecate" in ids

def test_docker_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "docker" in ids

def test_phase_order_is_correct():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert ids.index("preflight") < ids.index("config")
    assert ids.index("config") < ids.index("hecate")
    assert ids.index("hecate") < ids.index("docker")
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest installer/tests/test_engine_registry.py::test_hecate_phase_registered -v
```

Expected: FAIL

- [ ] **Step 3: Implement phases/hecate.py**

```python
# installer/engine/phases/hecate.py
from __future__ import annotations

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import hecate_bootstrap, utils

ROOT = utils.REPO_ROOT


def _check_fetch_assets(ctx: Context) -> bool:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("HECATE_ENABLED"):
        return True  # skip if not enabled
    marker = ROOT / ".hecate-bootstrap-done"
    return marker.exists()


def _run_fetch_assets(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("HECATE_ENABLED"):
        ctx.emit("Hecate not enabled — skipping asset fetch")
        return
    try:
        hecate_bootstrap.fetch_and_validate(resolved)
    except Exception as exc:
        raise StepError(f"Hecate asset fetch failed: {exc}") from exc
    (ROOT / ".hecate-bootstrap-done").touch()
    ctx.emit("Hecate assets fetched and validated")


def _check_extract_assets(ctx: Context) -> bool:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("HECATE_ENABLED"):
        return True
    return (ROOT / "chroma").is_dir()


def _run_extract_assets(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("HECATE_ENABLED"):
        ctx.emit("Hecate not enabled — skipping extraction")
        return
    try:
        hecate_bootstrap.extract(resolved)
    except Exception as exc:
        raise StepError(f"Hecate extraction failed: {exc}") from exc
    ctx.emit("Hecate assets extracted")


PHASE = Phase(
    id="hecate",
    name="Hecate Bootstrap",
    steps=[
        Step(id="hecate.fetch_assets", name="Fetch Hecate vector DB assets",
             run=_run_fetch_assets, check=_check_fetch_assets),
        Step(id="hecate.extract_assets", name="Extract Hecate assets",
             run=_run_extract_assets, check=_check_extract_assets),
    ],
)
```

- [ ] **Step 4: Implement phases/docker.py**

```python
# installer/engine/phases/docker.py
from __future__ import annotations

import subprocess
import time

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT
NETWORK_NAME = "parthenon_default"
HEALTH_TIMEOUT_S = 300
HEALTH_POLL_S = 5


def _check_create_networks(ctx: Context) -> bool:
    result = subprocess.run(
        ["docker", "network", "ls", "--filter", f"name={NETWORK_NAME}", "--format", "{{.Name}}"],
        capture_output=True, text=True,
    )
    return NETWORK_NAME in result.stdout.splitlines()


def _run_create_networks(ctx: Context) -> None:
    result = subprocess.run(
        ["docker", "network", "create", NETWORK_NAME],
        capture_output=True, text=True,
    )
    if result.returncode != 0 and "already exists" not in result.stderr:
        raise StepError(f"Failed to create network {NETWORK_NAME}: {result.stderr.strip()}")
    ctx.emit(f"Network {NETWORK_NAME} ready")


def _check_pull_images(ctx: Context) -> bool:
    result = subprocess.run(
        ["docker", "compose", "images", "--format", "json"],
        capture_output=True, text=True, cwd=ROOT,
    )
    return result.returncode == 0 and len(result.stdout.strip()) > 10


def _run_pull_images(ctx: Context) -> None:
    compose_file = utils.active_compose_file()
    ctx.emit("Pulling Docker images (this may take several minutes)…")
    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "pull"],
        capture_output=False, cwd=ROOT,
    )
    if result.returncode != 0:
        raise StepError("docker compose pull failed. Check your network connection.")
    ctx.emit("All images pulled")


def _check_start_containers(ctx: Context) -> bool:
    result = subprocess.run(
        ["docker", "compose", "ps", "--format", "{{.Name}}"],
        capture_output=True, text=True, cwd=ROOT,
    )
    return "php" in result.stdout and "postgres" in result.stdout


def _run_start_containers(ctx: Context) -> None:
    compose_file = utils.active_compose_file()
    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "up", "-d", "--remove-orphans"],
        capture_output=True, text=True, cwd=ROOT,
    )
    if result.returncode != 0:
        raise StepError(f"docker compose up failed:\n{result.stderr.strip()}")
    ctx.emit("Containers started")


def _check_wait_healthy(ctx: Context) -> bool:
    result = subprocess.run(
        ["docker", "compose", "ps", "--format", "{{.Health}}"],
        capture_output=True, text=True, cwd=ROOT,
    )
    statuses = result.stdout.splitlines()
    return statuses and all(s in ("healthy", "") for s in statuses)


def _run_wait_healthy(ctx: Context) -> None:
    deadline = time.monotonic() + HEALTH_TIMEOUT_S
    while time.monotonic() < deadline:
        result = subprocess.run(
            ["docker", "compose", "ps", "--format", "{{.Name}}\t{{.Health}}"],
            capture_output=True, text=True, cwd=ROOT,
        )
        lines = [l for l in result.stdout.splitlines() if l.strip()]
        unhealthy = [l for l in lines if "unhealthy" in l or "starting" in l]
        if not unhealthy:
            ctx.emit(f"All {len(lines)} containers healthy")
            return
        ctx.emit(f"Waiting for {len(unhealthy)} container(s)…")
        time.sleep(HEALTH_POLL_S)
    raise StepError(f"Containers not healthy after {HEALTH_TIMEOUT_S}s. Run 'docker compose logs' to diagnose.")


PHASE = Phase(
    id="docker",
    name="Docker",
    steps=[
        Step(id="docker.create_networks", name="Create Docker networks",
             run=_run_create_networks, check=_check_create_networks),
        Step(id="docker.pull_images", name="Pull Docker images",
             run=_run_pull_images, check=_check_pull_images),
        Step(id="docker.start_containers", name="Start containers",
             run=_run_start_containers, check=_check_start_containers),
        Step(id="docker.wait_healthy", name="Wait for containers to be healthy",
             run=_run_wait_healthy, check=_check_wait_healthy),
    ],
)
```

- [ ] **Step 5: Register both phases in phases/__init__.py**

```python
# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG
from .hecate import PHASE as HECATE
from .docker import PHASE as DOCKER

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
DEFAULT_REGISTRY.register(CONFIG)
DEFAULT_REGISTRY.register(HECATE)
DEFAULT_REGISTRY.register(DOCKER)
# Remaining phases registered in Tasks 9-10
```

- [ ] **Step 6: Run tests**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add installer/engine/phases/hecate.py installer/engine/phases/docker.py installer/engine/phases/__init__.py
git commit -m "feat(installer-v2): add hecate and docker phases"
```

---

## Task 9: Bootstrap phase

**Files:**
- Create: `installer/engine/phases/bootstrap.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to installer/tests/test_engine_registry.py

def test_bootstrap_phase_has_six_steps():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase = next((p for p in DEFAULT_REGISTRY.phases() if p.id == "bootstrap"), None)
    assert phase is not None
    assert len(phase.steps) == 6
```

- [ ] **Step 2: Run to verify it fails**

```bash
python -m pytest installer/tests/test_engine_registry.py::test_bootstrap_phase_has_six_steps -v
```

Expected: FAIL — bootstrap not in registry

- [ ] **Step 3: Implement phases/bootstrap.py**

```python
# installer/engine/phases/bootstrap.py
from __future__ import annotations

import subprocess

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT


def _exec_php(cmd: str) -> subprocess.CompletedProcess:
    return utils.exec_php(cmd, check=False)


def _check_composer_install(ctx: Context) -> bool:
    return (ROOT / "backend" / "vendor").is_dir()


def _run_composer_install(ctx: Context) -> None:
    ctx.emit("Running composer install…")
    result = _exec_php("composer install --no-interaction --optimize-autoloader 2>&1")
    if result.returncode != 0:
        raise StepError(f"composer install failed:\n{result.stdout}")
    ctx.emit("composer install — done")


def _check_generate_app_key(ctx: Context) -> bool:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return False
    content = env_path.read_text()
    return "APP_KEY=base64:" in content


def _run_generate_app_key(ctx: Context) -> None:
    result = _exec_php("php artisan key:generate --force 2>&1")
    if result.returncode != 0:
        raise StepError(f"artisan key:generate failed:\n{result.stdout}")
    ctx.emit("APP_KEY generated")


def _check_run_migrations(ctx: Context) -> bool:
    result = _exec_php("php artisan migrate:status --no-ansi 2>&1")
    if result.returncode != 0:
        return False
    return "Pending" not in result.stdout and result.stdout.strip() != ""


def _run_run_migrations(ctx: Context) -> None:
    ctx.emit("Running database migrations…")
    result = _exec_php("php artisan migrate --force --no-ansi 2>&1")
    if result.returncode != 0:
        raise StepError(f"artisan migrate failed:\n{result.stdout}")
    ctx.emit("Migrations complete")


def _check_run_seeders(ctx: Context) -> bool:
    result = _exec_php(
        "php artisan tinker --execute=\"echo DB::table('app.roles')->count();\" --no-ansi 2>&1"
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_run_seeders(ctx: Context) -> None:
    ctx.emit("Seeding database…")
    result = _exec_php("php artisan db:seed --force --no-ansi 2>&1")
    if result.returncode != 0:
        raise StepError(f"artisan db:seed failed:\n{result.stdout}")
    ctx.emit("Seeding complete")


def _check_fix_permissions(ctx: Context) -> bool:
    storage = ROOT / "backend" / "storage"
    return storage.is_dir() and utils.run(
        ["test", "-w", str(storage)], capture=True, check=False
    ).returncode == 0


def _run_fix_permissions(ctx: Context) -> None:
    result = _exec_php(
        "chown -R www-data:www-data storage bootstrap/cache && chmod -R 775 storage bootstrap/cache 2>&1"
    )
    if result.returncode != 0:
        raise StepError(f"Permission fix failed:\n{result.stdout}")
    ctx.emit("Storage permissions set")


def _check_verify_postgis(ctx: Context) -> bool:
    result = _exec_php(
        "php artisan tinker --execute=\"echo DB::select(\\\"SELECT COUNT(*) FROM pg_extension WHERE extname='postgis'\\\")[0]->count;\" --no-ansi 2>&1"
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_verify_postgis(ctx: Context) -> None:
    result = _exec_php(
        "php artisan tinker --execute=\"DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');\" --no-ansi 2>&1"
    )
    if result.returncode != 0:
        raise StepError(f"PostGIS extension could not be enabled:\n{result.stdout}")
    ctx.emit("PostGIS extension verified")


PHASE = Phase(
    id="bootstrap",
    name="Laravel Bootstrap",
    steps=[
        Step(id="bootstrap.composer_install", name="Install Composer dependencies",
             run=_run_composer_install, check=_check_composer_install),
        Step(id="bootstrap.generate_app_key", name="Generate APP_KEY",
             run=_run_generate_app_key, check=_check_generate_app_key),
        Step(id="bootstrap.run_migrations", name="Run database migrations",
             run=_run_run_migrations, check=_check_run_migrations),
        Step(id="bootstrap.run_seeders", name="Seed database",
             run=_run_run_seeders, check=_check_run_seeders),
        Step(id="bootstrap.fix_permissions", name="Fix storage permissions",
             run=_run_fix_permissions, check=_check_fix_permissions),
        Step(id="bootstrap.verify_postgis", name="Verify PostGIS extension",
             run=_run_verify_postgis, check=_check_verify_postgis),
    ],
)
```

- [ ] **Step 4: Register in phases/__init__.py**

```python
# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG
from .hecate import PHASE as HECATE
from .docker import PHASE as DOCKER
from .bootstrap import PHASE as BOOTSTRAP

DEFAULT_REGISTRY = PhaseRegistry()
DEFAULT_REGISTRY.register(PREFLIGHT)
DEFAULT_REGISTRY.register(CONFIG)
DEFAULT_REGISTRY.register(HECATE)
DEFAULT_REGISTRY.register(DOCKER)
DEFAULT_REGISTRY.register(BOOTSTRAP)
# Remaining phases in Task 10
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add installer/engine/phases/bootstrap.py installer/engine/phases/__init__.py
git commit -m "feat(installer-v2): add bootstrap phase (composer, migrations, seeders, permissions, postgis)"
```

---

## Task 10: Datasets + Frontend + Solr + Admin phases

**Files:**
- Create: `installer/engine/phases/datasets.py`
- Create: `installer/engine/phases/frontend.py`
- Create: `installer/engine/phases/solr.py`
- Create: `installer/engine/phases/admin.py`

- [ ] **Step 1: Write the failing test**

```python
# Add to installer/tests/test_engine_registry.py

def test_all_nine_phases_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    expected = ["preflight", "config", "hecate", "docker", "bootstrap",
                "datasets", "frontend", "solr", "admin"]
    assert ids == expected
```

- [ ] **Step 2: Run to verify it fails**

```bash
python -m pytest installer/tests/test_engine_registry.py::test_all_nine_phases_registered -v
```

Expected: FAIL

- [ ] **Step 3: Implement phases/datasets.py**

```python
# installer/engine/phases/datasets.py
from __future__ import annotations

import subprocess
from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT


def _check_load_eunomia(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo DB::connection('eunomia')->table('person')->count();\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_load_eunomia(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("LOAD_EUNOMIA", True):
        ctx.emit("Eunomia loading skipped by config")
        return
    ctx.emit("Loading GiBleed demo dataset (Eunomia)…")
    result = utils.exec_php(
        "php artisan parthenon:load-eunomia --fresh --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Eunomia load failed:\n{result.stdout}")
    ctx.emit("Eunomia demo dataset loaded")


def _check_load_vocabulary(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo DB::connection('omop')->table('vocab.concept')->count();\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 1000
    except ValueError:
        return False


def _run_load_vocabulary(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    vocab_zip = resolved.get("ATHENA_VOCAB_ZIP")
    if not vocab_zip:
        ctx.emit("No Athena vocabulary ZIP configured — skipping vocab load")
        return
    ctx.emit(f"Loading vocabulary from {vocab_zip}…")
    result = utils.exec_php(
        f"php artisan vocabulary:import --zip={vocab_zip} --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Vocabulary import failed:\n{result.stdout}")
    ctx.emit("Vocabulary loaded")


def _check_seed_demo_data(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo DB::table('app.cohort_definitions')->count();\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_seed_demo_data(ctx: Context) -> None:
    ctx.emit("Seeding Commons demo data…")
    result = utils.exec_php(
        "php artisan commons:seed-demo --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Demo data seed failed:\n{result.stdout}")
    ctx.emit("Demo data seeded")


PHASE = Phase(
    id="datasets",
    name="Dataset Acquisition",
    steps=[
        Step(id="datasets.load_eunomia", name="Load Eunomia demo dataset",
             run=_run_load_eunomia, check=_check_load_eunomia),
        Step(id="datasets.load_vocabulary", name="Load OMOP vocabulary",
             run=_run_load_vocabulary, check=_check_load_vocabulary),
        Step(id="datasets.seed_demo_data", name="Seed Commons demo data",
             run=_run_seed_demo_data, check=_check_seed_demo_data),
    ],
)
```

- [ ] **Step 4: Implement phases/frontend.py**

```python
# installer/engine/phases/frontend.py
from __future__ import annotations

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT


def _check_build_frontend(ctx: Context) -> bool:
    if utils.release_runtime_enabled():
        return True
    dist = ROOT / "frontend" / "dist"
    return dist.is_dir() and any(dist.iterdir())


def _run_build_frontend(ctx: Context) -> None:
    if utils.release_runtime_enabled():
        ctx.emit("Using pre-built frontend from release runtime image — skipping build")
        return
    ctx.emit("Building React frontend…")
    rc = utils.run_stream(["env", "DEPLOY_SKIP_SMOKE=true", "bash", "./deploy.sh", "--frontend"])
    if rc != 0:
        raise StepError("Frontend build failed. Check Node/npm logs above.")
    ctx.emit("Frontend built")


def _check_restart_nginx(ctx: Context) -> bool:
    return False  # always restart after a build


def _run_restart_nginx(ctx: Context) -> None:
    utils.run(["docker", "compose", "restart", "nginx"], capture=True, check=False)
    ctx.emit("nginx restarted")


PHASE = Phase(
    id="frontend",
    name="Frontend Build",
    steps=[
        Step(id="frontend.build", name="Build React frontend",
             run=_run_build_frontend, check=_check_build_frontend),
        Step(id="frontend.restart_nginx", name="Restart nginx",
             run=_run_restart_nginx, check=_check_restart_nginx),
    ],
)
```

- [ ] **Step 5: Implement phases/solr.py**

```python
# installer/engine/phases/solr.py
from __future__ import annotations

import urllib.request
import json as _json
from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils


def _solr_num_docs(core: str, port: int = 8983) -> int:
    try:
        url = f"http://localhost:{port}/solr/{core}/select?q=*:*&rows=0&wt=json"
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = _json.loads(resp.read())
            return data["response"]["numFound"]
    except Exception:
        return -1


def _check_index_vocabulary(ctx: Context) -> bool:
    return _solr_num_docs("vocabulary") > 0


def _run_index_vocabulary(ctx: Context) -> None:
    ctx.emit("Indexing vocabulary Solr core…")
    result = utils.exec_php(
        "php artisan solr:index vocabulary --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Solr vocabulary indexing failed:\n{result.stdout}")
    ctx.emit("Vocabulary core indexed")


def _check_index_cohorts(ctx: Context) -> bool:
    return _solr_num_docs("cohorts") >= 0  # core exists and responds


def _run_index_cohorts(ctx: Context) -> None:
    ctx.emit("Indexing cohorts Solr core…")
    result = utils.exec_php(
        "php artisan solr:index cohorts --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Solr cohorts indexing failed:\n{result.stdout}")
    ctx.emit("Cohorts core indexed")


def _check_index_analyses(ctx: Context) -> bool:
    return _solr_num_docs("analyses") >= 0


def _run_index_analyses(ctx: Context) -> None:
    ctx.emit("Indexing analyses Solr core…")
    result = utils.exec_php(
        "php artisan solr:index analyses --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Solr analyses indexing failed:\n{result.stdout}")
    ctx.emit("Analyses core indexed")


PHASE = Phase(
    id="solr",
    name="Solr Indexing",
    steps=[
        Step(id="solr.index_vocabulary", name="Index vocabulary core",
             run=_run_index_vocabulary, check=_check_index_vocabulary),
        Step(id="solr.index_cohorts", name="Index cohorts core",
             run=_run_index_cohorts, check=_check_index_cohorts),
        Step(id="solr.index_analyses", name="Index analyses core",
             run=_run_index_analyses, check=_check_index_analyses),
    ],
)
```

- [ ] **Step 6: Implement phases/admin.py**

```python
# installer/engine/phases/admin.py
from __future__ import annotations

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils


def _check_seed_admin(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo App\\\\Models\\\\User::where('email', config('app.admin_email'))->exists() ? '1' : '0';\" --no-ansi 2>&1",
        check=False,
    )
    return result.stdout.strip() == "1"


def _run_seed_admin(ctx: Context) -> None:
    ctx.emit("Creating admin account…")
    result = utils.exec_php(
        "php artisan admin:seed --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Admin seed failed:\n{result.stdout}")
    ctx.emit("Admin account created")


def _check_export_credentials(ctx: Context) -> bool:
    return False  # always export so Acropolis can read them


def _run_export_credentials(ctx: Context) -> None:
    from installer import utils as _u
    creds_path = _u.REPO_ROOT / ".install-credentials"
    keys = ["DB_PASSWORD", "REDIS_PASSWORD", "APP_KEY", "ADMIN_PASSWORD"]
    ctx.secrets.export_credentials_file(creds_path, keys)
    ctx.emit(f"Credentials written to {creds_path} (chmod 600)")


PHASE = Phase(
    id="admin",
    name="Admin Account",
    steps=[
        Step(id="admin.seed_admin", name="Create admin account",
             run=_run_seed_admin, check=_check_seed_admin),
        Step(id="admin.export_credentials", name="Export credentials file",
             run=_run_export_credentials, check=_check_export_credentials),
    ],
)
```

- [ ] **Step 7: Register all four phases in phases/__init__.py**

```python
# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG
from .hecate import PHASE as HECATE
from .docker import PHASE as DOCKER
from .bootstrap import PHASE as BOOTSTRAP
from .datasets import PHASE as DATASETS
from .frontend import PHASE as FRONTEND
from .solr import PHASE as SOLR
from .admin import PHASE as ADMIN

DEFAULT_REGISTRY = PhaseRegistry()
for phase in (PREFLIGHT, CONFIG, HECATE, DOCKER, BOOTSTRAP, DATASETS, FRONTEND, SOLR, ADMIN):
    DEFAULT_REGISTRY.register(phase)
```

- [ ] **Step 8: Run tests**

```bash
python -m pytest installer/tests/test_engine_registry.py -v
```

Expected: all PASS including `test_all_nine_phases_registered`

- [ ] **Step 9: Commit**

```bash
git add installer/engine/phases/datasets.py installer/engine/phases/frontend.py installer/engine/phases/solr.py installer/engine/phases/admin.py installer/engine/phases/__init__.py
git commit -m "feat(installer-v2): add datasets, frontend, solr, and admin phases (9 total)"
```

---

## Task 11: Docker secrets integration

**Files:**
- Create: `docker/secrets-entrypoint.sh`
- Modify: `installer/engine/phases/docker.py` (write secrets before compose up)
- Modify: `.gitignore` (add `.secrets/`)

- [ ] **Step 1: Write the failing test**

```python
# installer/tests/test_engine_secrets.py — append these tests

def test_write_docker_secrets_creates_secrets_dir(tmp_path):
    mgr = SecretManager()
    mgr.set("DB_PASSWORD", "pass123")
    secrets_dir = tmp_path / ".secrets"
    mgr.write_docker_secrets(["DB_PASSWORD"], secrets_dir)
    assert secrets_dir.is_dir()
    mode = oct(stat.S_IMODE(secrets_dir.stat().st_mode))
    assert mode == "0o700"
```

- [ ] **Step 2: Run to verify it fails**

```bash
python -m pytest installer/tests/test_engine_secrets.py::test_write_docker_secrets_creates_secrets_dir -v
```

Expected: PASS (this one should already pass from Task 4 — if so, move on)

- [ ] **Step 3: Create docker/secrets-entrypoint.sh**

```bash
#!/bin/sh
# Source each /run/secrets/* file as an environment variable before exec.
# Used when Docker secrets are bind-mounted from .secrets/ via compose override.
for f in /run/secrets/*; do
    [ -f "$f" ] && export "$(basename "$f")"="$(cat "$f")"
done
exec "$@"
```

```bash
chmod +x docker/secrets-entrypoint.sh
```

- [ ] **Step 4: Add .secrets/ to .gitignore**

Open `.gitignore` and add after the `.env` entries:

```
.secrets/
docker-compose.secrets.yml
```

- [ ] **Step 5: Add write_secrets_compose_override to SecretManager**

Add this method to `installer/engine/secrets.py`:

```python
    def write_compose_secrets_override(
        self, keys: list[str], secrets_dir: Path, override_path: Path
    ) -> None:
        """Generate docker-compose.secrets.yml that bind-mounts secrets files.

        Call this before docker compose up, then delete it after containers are healthy.
        """
        import yaml  # only needed here

        self.write_docker_secrets(keys, secrets_dir)

        secret_defs = {k: {"file": str(secrets_dir / k)} for k in keys if (secrets_dir / k).exists()}
        service_secrets = {k: None for k in secret_defs}  # None = use defaults

        services_needing_secrets = ["php", "postgres", "redis", "horizon", "reverb"]
        services = {
            svc: {"secrets": list(service_secrets.keys())}
            for svc in services_needing_secrets
        }

        override = {
            "version": "3.8",
            "services": services,
            "secrets": secret_defs,
        }

        override_path.write_text(
            "# Auto-generated by installer — do not commit\n"
        )
        import json as _json
        # Write as JSON (valid YAML superset, avoids PyYAML dependency)
        override_path.write_text(
            "# Auto-generated by installer — do not commit\n"
            + _json.dumps(override, indent=2)
        )
        import os, stat as _stat
        os.chmod(override_path, _stat.S_IRUSR | _stat.S_IWUSR)
```

- [ ] **Step 6: Update docker phase to write secrets before compose up**

In `installer/engine/phases/docker.py`, modify `_run_start_containers`:

```python
def _run_start_containers(ctx: Context) -> None:
    import json as _json

    DOCKER_SECRETS = ["DB_PASSWORD", "REDIS_PASSWORD", "APP_KEY", "ADMIN_PASSWORD",
                      "RESEND_KEY", "CLAUDE_API_KEY"]
    secrets_dir = ROOT / ".secrets"
    override_path = ROOT / "docker-compose.secrets.yml"

    ctx.secrets.write_docker_secrets(DOCKER_SECRETS, secrets_dir)
    ctx.emit(f"Secrets written to {secrets_dir}")

    compose_file = utils.active_compose_file()
    result = subprocess.run(
        ["docker", "compose", "-f", compose_file, "-f", str(override_path),
         "up", "-d", "--remove-orphans"],
        capture_output=True, text=True, cwd=ROOT,
    )
    if result.returncode != 0:
        raise StepError(f"docker compose up failed:\n{result.stderr.strip()}")
    ctx.emit("Containers started with secrets injected")
```

Note: `docker-compose.secrets.yml` is generated in a prior step. If it does not exist, compose falls back to the base file gracefully (the `-f` flag is skipped in that case). Add a guard:

```python
    compose_files = ["docker", "compose", "-f", compose_file]
    if override_path.exists():
        compose_files += ["-f", str(override_path)]
    result = subprocess.run(
        compose_files + ["up", "-d", "--remove-orphans"],
        capture_output=True, text=True, cwd=ROOT,
    )
```

- [ ] **Step 7: Run all engine tests**

```bash
python -m pytest installer/tests/ -v -k "engine"
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add docker/secrets-entrypoint.sh .gitignore installer/engine/secrets.py installer/engine/phases/docker.py
git commit -m "feat(installer-v2): add Docker secrets integration (secrets-entrypoint, compose override)"
```

---

## Task 12: CLI shim update

**Files:**
- Modify: `installer/cli.py`

- [ ] **Step 1: Write the failing test**

```python
# installer/tests/test_engine_contract.py — append

def test_engine_run_function_importable():
    """The top-level run() in cli.py must accept pre_seed and non_interactive kwargs."""
    import inspect
    from installer import cli
    sig = inspect.signature(cli.run)
    assert "pre_seed" in sig.parameters
    assert "non_interactive" in sig.parameters
    assert "resume" in sig.parameters
```

- [ ] **Step 2: Run to verify it fails**

```bash
python -m pytest installer/tests/test_engine_contract.py::test_engine_run_function_importable -v
```

Expected: FAIL — `resume` not in `cli.run` signature

- [ ] **Step 3: Update cli.py run() function**

Replace the body of `run()` in `installer/cli.py` (keep the signature section intact, replace the implementation below the docstring):

```python
def run(*, non_interactive: bool = False, pre_seed: dict[str, Any] | None = None,
        upgrade: bool = False, resume: bool = False) -> None:
    """Run the 9-phase installer via the v2 engine.

    Args:
        non_interactive: Skip interactive prompts (use defaults).
        pre_seed: Dict of default values to pre-populate config prompts.
                  Passed from --defaults-file or parent installer (e.g. Acropolis).
        upgrade: If True, run upgrade flow instead of fresh install.
        resume: If True, resume from last checkpoint.
    """
    from .engine import StepRunner, CheckpointStore, SecretManager
    from .engine.phases import DEFAULT_REGISTRY

    config: dict[str, Any] = {
        "non_interactive": non_interactive,
        "pre_seed": pre_seed or {},
        "upgrade": upgrade,
    }

    checkpoint = CheckpointStore(STATE_FILE)
    secrets = SecretManager()

    runner = StepRunner(
        registry=DEFAULT_REGISTRY,
        checkpoint=checkpoint,
        config=config,
        secrets=secrets,
    )

    success = runner.run(resume=resume)
    if not success:
        sys.exit(1)
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest installer/tests/test_engine_contract.py -v
```

Expected: all PASS

- [ ] **Step 5: Run the full test suite**

```bash
python -m pytest installer/tests/ -v
```

Expected: all PASS (existing tests + new engine tests)

- [ ] **Step 6: Commit**

```bash
git add installer/cli.py
git commit -m "feat(installer-v2): wire cli.py shim to v2 StepRunner (preserves --defaults-file, --resume)"
```

---

## Task 13: Integration tests

**Files:**
- Create: `installer/tests/test_engine_integration.py`

- [ ] **Step 1: Write the integration test**

```python
# installer/tests/test_engine_integration.py
"""Integration tests — require Docker. Skipped in CI if Docker is unavailable.

Run with: pytest installer/tests/test_engine_integration.py -v -m integration
"""
from __future__ import annotations

import io
import json
import subprocess
import pytest
from pathlib import Path

from installer.engine.checkpoint import CheckpointStore
from installer.engine.phases.preflight import PHASE as PREFLIGHT_PHASE
from installer.engine.registry import PhaseRegistry, Phase, Step, Context
from installer.engine.runner import StepRunner
from installer.engine.secrets import SecretManager


def _docker_available() -> bool:
    try:
        r = subprocess.run(["docker", "info"], capture_output=True, timeout=5)
        return r.returncode == 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _docker_available(), reason="Docker not available"
)


def test_preflight_steps_pass_on_healthy_system(tmp_path: Path):
    """All preflight steps should pass on a machine with Docker running."""
    reg = PhaseRegistry()
    reg.register(PREFLIGHT_PHASE)

    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "s"), output=out)
    result = runner.run()

    events = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
    fail_events = [e for e in events if e["type"] == "step_fail"]
    assert result is True, f"Preflight failed: {fail_events}"


def test_preflight_is_idempotent(tmp_path: Path):
    """Running preflight twice should mark all steps skipped on the second run."""
    reg = PhaseRegistry()
    reg.register(PREFLIGHT_PHASE)

    store = CheckpointStore(tmp_path / ".state.json")
    secrets = SecretManager(tmp_path / "s")

    # First run
    out1 = io.StringIO()
    StepRunner(reg, store, config={}, secrets=secrets, output=out1).run()
    # Save state from first run (store was deleted on success — re-init for second run)
    store.initialize(reg.all_step_ids())
    for sid in reg.all_step_ids():
        store.set_step(sid, "done")

    # Second run with resume=True
    out2 = io.StringIO()
    StepRunner(reg, store, config={}, secrets=secrets, output=out2).run(resume=True)
    events2 = [json.loads(line) for line in out2.getvalue().splitlines() if line.strip()]

    skip_events = [e for e in events2 if e["type"] == "step_skip"]
    step_starts = [e for e in events2 if e["type"] == "step_start"]
    assert len(step_starts) == 0, "No steps should have run on the second pass"
    assert len(skip_events) == len(PREFLIGHT_PHASE.steps)


def test_all_events_have_required_fields(tmp_path: Path):
    """Every event emitted during preflight must have all required JSON keys."""
    reg = PhaseRegistry()
    reg.register(PREFLIGHT_PHASE)

    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config={}, secrets=SecretManager(tmp_path / "s"), output=out)
    runner.run()

    required = {"type", "phase", "step", "phase_index", "phase_total",
                "step_index", "step_total", "message", "elapsed_s"}
    for line in out.getvalue().splitlines():
        if not line.strip():
            continue
        data = json.loads(line)
        missing = required - set(data.keys())
        assert not missing, f"Event missing keys {missing}: {data}"
```

- [ ] **Step 2: Run integration tests**

```bash
python -m pytest installer/tests/test_engine_integration.py -v -m integration
```

Expected: 3 tests PASS (if Docker is running), or `SKIPPED` if Docker is unavailable

- [ ] **Step 3: Run the complete test suite**

```bash
python -m pytest installer/tests/ -v
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add installer/tests/test_engine_integration.py
git commit -m "test(installer-v2): add integration tests for preflight idempotency and event contract"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✓ Section 1 (engine module structure) → Tasks 1-5
- ✓ Section 2 (step registry + idempotency check) → Task 2 + all phase tasks
- ✓ Section 3 (checkpoint store schema v2) → Task 3
- ✓ Section 4 (SecretManager + Docker secrets) → Tasks 4 + 11
- ✓ Section 5 (JSON progress events) → Task 1 + Task 5 (StepRunner emitter)
- ✓ Section 6 (testing strategy) → Tasks 1-5 (unit), Task 13 (integration), contract tests in Task 5
- ✓ Backward compatibility (--defaults-file, --resume, --non-interactive) → Task 12

**Placeholder scan:** No TBDs or vague steps found.

**Type consistency:**
- `StepError` imported from `..exceptions` in all phase files ✓
- `Context` imported from `..registry` in all phase files ✓
- `PHASE` constant exported from each phase file, imported as aliased name in `phases/__init__.py` ✓
- `SecretManager.write_docker_secrets(keys, dir)` signature consistent across Task 4 definition and Task 11 usage ✓
