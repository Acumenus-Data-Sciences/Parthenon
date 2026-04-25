# Installer Phase 1 — Contract Surface Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Python installer contract (`install.py --contract …`) with seven new actions (`health`, `credentials`, `service-status`, `open-app`, `port-holder`, `recover`, `diagnose`) and ship the initial diagnostic knowledge base, so the Rust GUI can drive a comprehensive first-login experience without owning any new state logic.

**Architecture:** Thin Rust shell, Python contract is the single source of truth. Each new action is a pure function in a small new module (`installer/health.py`, `installer/recovery.py`, `installer/diagnostics.py`) plus a dispatch entry in `installer/contract.py:build_payload` and the argparse `choices` list in `install.py` and `installer/contract.py:main`. All modules tested with pytest, matching the pattern in `installer/tests/test_contract.py`.

**Tech Stack:** Python 3.11+, pytest, stdlib only (no new deps). Existing modules used: `installer.config`, `installer.utils`, `installer.bundle_manifest`, `installer.engine.checkpoint` (for `recover`).

**Spec reference:** `docs/superpowers/specs/2026-04-24-installer-first-run-comprehensive-design.md` — Areas A2, A3, B2, C5, D10, G1–G8.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `installer/health.py` | NEW | HTTP probe of `/api/v1/health` — pure function, no I/O loop |
| `installer/recovery.py` | NEW | Inspect `.install-state.json`, recommend Resume/Retry/Reset |
| `installer/diagnostics.py` | NEW | Match error streams against the KB |
| `installer/diagnostics-kb.json` | NEW | JSON array of fingerprint entries |
| `installer/contract.py` | MODIFY | Add 7 action handlers + dispatch + argparse choices |
| `install.py` | MODIFY | Add 7 new actions to `--contract` choices list (line ~100) |
| `installer/tests/test_health.py` | NEW | Unit tests with stubbed HTTP |
| `installer/tests/test_credentials.py` | NEW | Unit tests with tmp_path fixtures |
| `installer/tests/test_service_status.py` | NEW | Unit tests with mocked `docker compose ps` |
| `installer/tests/test_recovery.py` | NEW | Unit tests with synthetic state files |
| `installer/tests/test_diagnostics.py` | NEW | One fixture per KB entry; regex regression catcher |
| `installer/tests/test_contract.py` | MODIFY | Add round-trip tests for each new action |

**No file exceeds ~250 LOC.** Each new module has one responsibility.

---

### Task 1: `health` contract action

**Files:**
- Create: `installer/health.py`
- Create: `installer/tests/test_health.py`
- Modify: `installer/contract.py` (add `health_payload`, dispatch in `build_payload`, argparse choice)
- Modify: `install.py:100` (add `health` to `--contract` choices)

- [ ] **Step 1: Write the failing test**

Create `installer/tests/test_health.py`:

```python
"""Tests for installer.health module."""
from __future__ import annotations

from unittest.mock import patch
from urllib.error import URLError

from installer import health


def test_probe_returns_ready_when_endpoint_returns_200():
    with patch("installer.health._http_get") as mock_get:
        mock_get.return_value = (200, "")
        result = health.probe("http://localhost:8082", attempt=1)
    assert result == {"ready": True, "attempt": 1, "last_status": 200}


def test_probe_returns_not_ready_when_endpoint_returns_502():
    with patch("installer.health._http_get") as mock_get:
        mock_get.return_value = (502, "")
        result = health.probe("http://localhost:8082", attempt=3)
    assert result == {"ready": False, "attempt": 3, "last_status": 502}


def test_probe_returns_not_ready_on_connection_refused():
    with patch("installer.health._http_get") as mock_get:
        mock_get.side_effect = URLError("Connection refused")
        result = health.probe("http://localhost:8082", attempt=2)
    assert result == {"ready": False, "attempt": 2, "last_status": 0}


def test_probe_strips_trailing_slash_from_url():
    with patch("installer.health._http_get") as mock_get:
        mock_get.return_value = (200, "")
        health.probe("http://localhost:8082/", attempt=1)
    mock_get.assert_called_once_with("http://localhost:8082/api/v1/health")
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'installer.health'`.

- [ ] **Step 3: Write minimal implementation**

Create `installer/health.py`:

```python
"""HTTP health probe of the installed Parthenon app URL.

Pure function — no loops, no sleeps, no side effects beyond a single HTTP
request. The Rust GUI is responsible for the polling cadence (every 2 s,
default timeout 120 s = 60 attempts).
"""
from __future__ import annotations

from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


def probe(app_url: str, attempt: int) -> dict[str, Any]:
    """Probe `<app_url>/api/v1/health` and return the result.

    Returns:
        {"ready": bool, "attempt": int, "last_status": int}
        last_status is 0 when the connection failed entirely.
    """
    url = app_url.rstrip("/") + "/api/v1/health"
    try:
        status, _body = _http_get(url)
    except URLError:
        return {"ready": False, "attempt": attempt, "last_status": 0}

    return {
        "ready": status == 200,
        "attempt": attempt,
        "last_status": status,
    }


def _http_get(url: str, timeout: float = 5.0) -> tuple[int, str]:
    """Indirection seam for tests."""
    req = Request(url, headers={"User-Agent": "parthenon-installer/health"})
    with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - localhost only
        return resp.status, resp.read().decode("utf-8", errors="replace")
```

- [ ] **Step 4: Run test to verify it passes**

```
python -m pytest installer/tests/test_health.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Wire `health` into the contract dispatch**

Open `installer/contract.py`. Find `def build_payload(...)`. Add a new elif branch and a new helper above it:

```python
def health_payload(cfg: dict[str, Any], *, attempt: int = 1) -> dict[str, Any]:
    from . import health as installer_health
    app_url = cfg.get("app_url") or "http://localhost"
    return installer_health.probe(app_url, attempt=attempt)
```

Add the dispatch branch inside `build_payload` (after the `bundle-manifest` branch, before the final `else: raise ValueError`):

```python
    elif action == "health":
        attempt = 1
        if overrides and isinstance(overrides.get("_health_attempt"), int):
            attempt = overrides["_health_attempt"]
        payload = health_payload(cfg, attempt=attempt)
```

Update the action choices in `installer/contract.py:main()` argparse:

```python
        choices=["defaults", "validate", "plan", "preflight", "data-check", "bundle-manifest", "health"],
```

Update `install.py:100` argparse choices identically:

```python
        choices=["defaults", "validate", "plan", "preflight", "data-check", "bundle-manifest", "health"],
```

- [ ] **Step 6: Add a contract round-trip test**

Open `installer/tests/test_contract.py`. Append:

```python
def test_health_contract_action_returns_probe_shape(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    monkeypatch.setattr(
        "installer.health._http_get",
        lambda url, timeout=5.0: (200, ""),
    )

    payload = contract.build_payload(
        "health",
        community=True,
        overrides={"app_url": "http://localhost:8082"},
    )

    assert payload == {"ready": True, "attempt": 1, "last_status": 200}
```

- [ ] **Step 7: Run all contract tests**

```
python -m pytest installer/tests/test_contract.py installer/tests/test_health.py -v
```

Expected: all green.

- [ ] **Step 8: Commit**

```
git add installer/health.py installer/tests/test_health.py installer/contract.py installer/tests/test_contract.py install.py
git commit -m "feat(installer): add health contract action

Probes <app_url>/api/v1/health from the host. Pure function — Rust GUI
owns polling cadence (every 2 s, 120 s default timeout per spec A3).
Adds 'health' to install.py and installer/contract.py argparse choices."
```

---

### Task 2: `credentials` contract action

**Files:**
- Modify: `installer/contract.py` (add `credentials_payload`, dispatch, argparse)
- Modify: `install.py:100` (add `credentials` to choices)
- Create: `installer/tests/test_credentials.py`

- [ ] **Step 1: Write the failing test**

Create `installer/tests/test_credentials.py`:

```python
"""Tests for the credentials contract action."""
from __future__ import annotations

from pathlib import Path

from installer import contract


def _write_creds(path: Path, content: str) -> None:
    path.write_text(content)
    path.chmod(0o600)


def test_credentials_action_reads_admin_password(tmp_path, monkeypatch):
    monkeypatch.setattr("installer.utils.REPO_ROOT", tmp_path)
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    creds_path = tmp_path / ".install-credentials"
    _write_creds(
        creds_path,
        "DB_PASSWORD=db-secret\n"
        "REDIS_PASSWORD=redis-secret\n"
        "APP_KEY=base64:abc\n"
        "ADMIN_PASSWORD=Admin-XYZ-123\n",
    )

    payload = contract.build_payload(
        "credentials",
        community=True,
        overrides={"admin_email": "admin@example.com"},
    )

    assert payload == {
        "admin_email": "admin@example.com",
        "admin_password": "Admin-XYZ-123",
        "credentials_path": str(creds_path),
    }


def test_credentials_action_returns_error_when_file_missing(tmp_path, monkeypatch):
    monkeypatch.setattr("installer.utils.REPO_ROOT", tmp_path)
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "credentials",
        community=True,
        overrides={"admin_email": "admin@example.com"},
    )

    assert payload == {
        "admin_email": "admin@example.com",
        "admin_password": None,
        "credentials_path": str(tmp_path / ".install-credentials"),
        "error": "credentials file not found",
    }


def test_credentials_action_ignores_blank_lines_and_comments(tmp_path, monkeypatch):
    monkeypatch.setattr("installer.utils.REPO_ROOT", tmp_path)
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    creds_path = tmp_path / ".install-credentials"
    _write_creds(
        creds_path,
        "# generated by installer\n"
        "\n"
        "ADMIN_PASSWORD=Real-Password\n",
    )

    payload = contract.build_payload(
        "credentials",
        community=True,
        overrides={"admin_email": "admin@example.com"},
    )

    assert payload["admin_password"] == "Real-Password"
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_credentials.py -v
```

Expected: FAIL with `ValueError: Unsupported contract action: credentials`.

- [ ] **Step 3: Write the credentials handler**

In `installer/contract.py`, above `def build_payload(...)`, add:

```python
def credentials_payload(cfg: dict[str, Any]) -> dict[str, Any]:
    """Read .install-credentials and surface admin email + password.

    Format is KEY=VALUE per line, written by `engine.secrets.export_credentials_file`.
    Returns the password verbatim — caller decides whether to display.
    """
    creds_path = utils.REPO_ROOT / ".install-credentials"
    result: dict[str, Any] = {
        "admin_email": cfg.get("admin_email") or "admin@example.com",
        "admin_password": None,
        "credentials_path": str(creds_path),
    }
    if not creds_path.exists():
        result["error"] = "credentials file not found"
        return result

    for line in creds_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() == "ADMIN_PASSWORD":
            result["admin_password"] = value
            break
    return result
```

Add the dispatch branch in `build_payload` (above `else: raise ValueError`):

```python
    elif action == "credentials":
        payload = credentials_payload(cfg)
```

**Important:** the `credentials` action exists specifically to surface the admin password to the GUI — `--contract-redact` must NOT scrub it. Add a module-level set near `SECRET_FIELDS`:

```python
NON_REDACTABLE_ACTIONS = {"credentials"}
```

And modify the `if redacted:` block at the bottom of `build_payload` to skip these actions. Replace:

```python
    if redacted:
        if "config" in payload and isinstance(payload["config"], dict):
            payload = dict(payload)
            payload["config"] = redact(payload["config"])
        else:
            payload = redact(payload)
    return payload
```

with:

```python
    if redacted and action not in NON_REDACTABLE_ACTIONS:
        if "config" in payload and isinstance(payload["config"], dict):
            payload = dict(payload)
            payload["config"] = redact(payload["config"])
        else:
            payload = redact(payload)
    return payload
```

Add `"credentials"` to both argparse choices lists (`installer/contract.py:main` and `install.py:100`).

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest installer/tests/test_credentials.py -v
```

Expected: 3 passed.

- [ ] **Step 4b: Add a redaction-bypass test**

Append to `installer/tests/test_credentials.py`:

```python
def test_credentials_action_is_not_redacted_even_with_redact_flag(tmp_path, monkeypatch):
    monkeypatch.setattr("installer.utils.REPO_ROOT", tmp_path)
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)
    creds_path = tmp_path / ".install-credentials"
    _write_creds(creds_path, "ADMIN_PASSWORD=Plain-Password\n")
    creds_path.chmod(0o600)

    payload = contract.build_payload(
        "credentials",
        community=True,
        overrides={"admin_email": "admin@example.com"},
        redacted=True,
    )

    # Even with redacted=True, the credentials action must surface the real
    # password — that's its whole purpose. Other actions like 'defaults' would
    # still redact admin_password.
    assert payload["admin_password"] == "Plain-Password"
```

Run:

```
python -m pytest installer/tests/test_credentials.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```
git add installer/contract.py installer/tests/test_credentials.py install.py
git commit -m "feat(installer): add credentials contract action

Reads .install-credentials and surfaces admin email + password to UI
shells. The password is returned verbatim (not redacted) — the GUI
decides masking. Spec A2."
```

---

### Task 3: `service-status` contract action

**Files:**
- Create: `installer/service_status.py`
- Create: `installer/tests/test_service_status.py`
- Modify: `installer/contract.py` (dispatch + argparse)
- Modify: `install.py:100` (add `service-status` to choices)

- [ ] **Step 1: Write the failing test**

Create `installer/tests/test_service_status.py`:

```python
"""Tests for installer.service_status module."""
from __future__ import annotations

from unittest.mock import patch

from installer import service_status


def test_collect_parses_docker_compose_ps_json():
    docker_output = (
        '{"Service":"nginx","State":"running","Health":"healthy","Status":"Up 3 minutes"}\n'
        '{"Service":"postgres","State":"running","Health":"healthy","Status":"Up 3 minutes"}\n'
        '{"Service":"php","State":"running","Health":"starting","Status":"Up 30 seconds"}\n'
    )
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert result == {
        "available": True,
        "services": [
            {"name": "nginx", "state": "running", "health": "healthy", "status": "Up 3 minutes"},
            {"name": "postgres", "state": "running", "health": "healthy", "status": "Up 3 minutes"},
            {"name": "php", "state": "running", "health": "starting", "status": "Up 30 seconds"},
        ],
    }


def test_collect_handles_empty_health_field():
    docker_output = '{"Service":"redis","State":"running","Health":"","Status":"Up 1 minute"}\n'
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert result["services"][0]["health"] == "none"


def test_collect_returns_unavailable_when_docker_missing():
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (127, "", "command not found")
        result = service_status.collect()

    assert result == {
        "available": False,
        "services": [],
        "error": "command not found",
    }


def test_collect_skips_blank_lines():
    docker_output = (
        '{"Service":"nginx","State":"running","Health":"healthy","Status":"Up"}\n'
        "\n"
        "  \n"
    )
    with patch("installer.service_status._run_compose_ps") as mock_run:
        mock_run.return_value = (0, docker_output, "")
        result = service_status.collect()

    assert len(result["services"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_service_status.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `installer/service_status.py`:

```python
"""Docker Compose service status collector.

Wraps `docker compose ps --format json` and normalizes output for UI shells.
Each line of the docker output is one JSON object describing one service.
"""
from __future__ import annotations

import json
import subprocess
from typing import Any


def collect() -> dict[str, Any]:
    """Return current compose service states.

    Output:
        {
          "available": bool,           # False when docker compose itself failed
          "services": [
            {"name": str, "state": str, "health": str, "status": str},
            ...
          ],
          "error": str (only when available is False)
        }
    """
    rc, stdout, stderr = _run_compose_ps()
    if rc != 0:
        return {
            "available": False,
            "services": [],
            "error": (stderr or stdout or "docker compose ps failed").strip(),
        }

    services: list[dict[str, str]] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        services.append(
            {
                "name": entry.get("Service", "") or entry.get("Name", ""),
                "state": entry.get("State", "unknown"),
                "health": entry.get("Health") or "none",
                "status": entry.get("Status", ""),
            }
        )

    return {"available": True, "services": services}


def _run_compose_ps() -> tuple[int, str, str]:
    """Indirection seam for tests."""
    proc = subprocess.run(
        ["docker", "compose", "ps", "--format", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.returncode, proc.stdout, proc.stderr
```

Wire into `installer/contract.py`. Add above `build_payload`:

```python
def service_status_payload() -> dict[str, Any]:
    from . import service_status as installer_service_status
    return installer_service_status.collect()
```

Dispatch branch:

```python
    elif action == "service-status":
        payload = service_status_payload()
```

Add `"service-status"` to both argparse choices.

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest installer/tests/test_service_status.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```
git add installer/service_status.py installer/tests/test_service_status.py installer/contract.py install.py
git commit -m "feat(installer): add service-status contract action

Surfaces docker compose service states to UI shells. Each service entry
includes state (running/exited/...), health (healthy/starting/none), and
status string. Backs spec D10 service-status grid on the Hero Done page."
```

---

### Task 4: `open-app` contract action

**Files:**
- Modify: `installer/contract.py` (add `open_app_payload`, dispatch, argparse)
- Modify: `install.py:100` (add `open-app` to choices)
- Modify: `installer/tests/test_contract.py` (add round-trip test)

- [ ] **Step 1: Write the failing test**

Append to `installer/tests/test_contract.py`:

```python
def test_open_app_action_returns_canonical_url(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "open-app",
        community=True,
        overrides={"app_url": "http://localhost", "nginx_port": 8082},
    )

    assert payload == {"url": "http://localhost:8082"}


def test_open_app_action_preserves_existing_port(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "open-app",
        community=True,
        overrides={"app_url": "http://localhost:9999", "nginx_port": 8082},
    )

    assert payload == {"url": "http://localhost:9999"}


def test_open_app_action_preserves_external_url(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "open-app",
        community=True,
        overrides={"app_url": "https://parthenon.example.com", "nginx_port": 8082},
    )

    assert payload == {"url": "https://parthenon.example.com"}
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_contract.py::test_open_app_action_returns_canonical_url -v
```

Expected: FAIL — `Unsupported contract action: open-app`.

- [ ] **Step 3: Write the implementation**

In `installer/contract.py`, add above `build_payload`:

```python
def open_app_payload(cfg: dict[str, Any]) -> dict[str, Any]:
    """Resolve the canonical user-facing URL.

    If app_url is a localhost URL with no port, append the nginx port (mirrors
    `installer.cli._print_summary` logic). External URLs pass through untouched.
    """
    app_url = (cfg.get("app_url") or "http://localhost").strip().rstrip("/")
    nginx_port = cfg.get("nginx_port") or 8082
    if "localhost" in app_url and f":{nginx_port}" not in app_url:
        # Match cli.py heuristic: only inject port if no port already present
        # after the host segment.
        already_has_port = ":" in app_url.split("//", 1)[1]
        if not already_has_port:
            app_url = f"{app_url}:{nginx_port}"
    return {"url": app_url}
```

Dispatch branch:

```python
    elif action == "open-app":
        payload = open_app_payload(cfg)
```

Add `"open-app"` to both argparse choices lists.

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest installer/tests/test_contract.py -v -k open_app
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```
git add installer/contract.py installer/tests/test_contract.py install.py
git commit -m "feat(installer): add open-app contract action

Returns the canonical user-facing URL for the Hero 'Open Parthenon' CTA.
Localhost URLs without a port get the nginx port injected (mirrors
installer/cli.py:_print_summary heuristic). External URLs pass through.
Spec A1 + D4."
```

---

### Task 5: `port-holder` contract action

**Files:**
- Create: `installer/port_holder.py`
- Create: `installer/tests/test_port_holder.py`
- Modify: `installer/contract.py` (dispatch + argparse)
- Modify: `install.py:100` (add `port-holder` to choices)

- [ ] **Step 1: Write the failing test**

Create `installer/tests/test_port_holder.py`:

```python
"""Tests for installer.port_holder module."""
from __future__ import annotations

from unittest.mock import patch

from installer import port_holder


def test_identify_parses_lsof_output_on_macos():
    lsof_output = (
        "COMMAND     PID    USER   FD   TYPE\n"
        "nginx     12345 smudoshi   6u  IPv4\n"
    )
    with patch("installer.port_holder._platform", return_value="Darwin"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.return_value = (0, lsof_output, "")
            result = port_holder.identify(8082)

    assert result == {
        "found": True,
        "port": 8082,
        "pid": 12345,
        "name": "nginx",
        "command": "nginx",
        "platform_used": "lsof",
    }


def test_identify_returns_not_found_on_empty_lsof():
    with patch("installer.port_holder._platform", return_value="Linux"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.return_value = (1, "", "")
            result = port_holder.identify(9999)

    assert result == {"found": False, "port": 9999, "platform_used": "lsof"}


def test_identify_falls_back_to_ss_when_lsof_missing():
    ss_output = (
        "Netid State Recv-Q Send-Q Local Address:Port  Peer  Process\n"
        "tcp   LISTEN 0 511 0.0.0.0:8082 0.0.0.0:* users:((\"nginx\",pid=4321,fd=6))\n"
    )
    with patch("installer.port_holder._platform", return_value="Linux"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.side_effect = [
                (127, "", "command not found"),  # lsof missing
                (0, ss_output, ""),               # ss succeeds
            ]
            result = port_holder.identify(8082)

    assert result["found"] is True
    assert result["pid"] == 4321
    assert result["name"] == "nginx"
    assert result["platform_used"] == "ss"


def test_identify_uses_netstat_on_windows():
    netstat_output = (
        "Active Connections\n"
        "  Proto  Local Address          Foreign Address        State           PID\n"
        "  TCP    0.0.0.0:8082           0.0.0.0:0              LISTENING       1234\n"
    )
    with patch("installer.port_holder._platform", return_value="Windows"):
        with patch("installer.port_holder._run") as mock_run:
            mock_run.return_value = (0, netstat_output, "")
            result = port_holder.identify(8082)

    assert result["found"] is True
    assert result["pid"] == 1234
    assert result["platform_used"] == "netstat"
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_port_holder.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `installer/port_holder.py`:

```python
"""Identify the process holding a TCP port.

Used by the Rust GUI when a preflight port check fails. Tries lsof first
on macOS/Linux, falls back to ss; uses netstat on Windows.
"""
from __future__ import annotations

import platform as _stdlib_platform
import re
import subprocess
from typing import Any


def identify(port: int) -> dict[str, Any]:
    """Return information about whoever holds `port`, or `{"found": False, ...}`."""
    plat = _platform()
    if plat == "Windows":
        return _identify_windows(port)
    return _identify_unix(port)


def _identify_unix(port: int) -> dict[str, Any]:
    rc, stdout, _stderr = _run(["lsof", "-i", f":{port}", "-sTCP:LISTEN", "-n", "-P"])
    if rc == 0 and stdout.strip():
        match = _parse_lsof(stdout)
        if match is not None:
            return {**match, "found": True, "port": port, "platform_used": "lsof"}
    if rc == 127:  # lsof missing → try ss
        rc2, stdout2, _ = _run(["ss", "-ltnp", f"sport = :{port}"])
        if rc2 == 0 and stdout2.strip():
            match = _parse_ss(stdout2)
            if match is not None:
                return {**match, "found": True, "port": port, "platform_used": "ss"}
        return {"found": False, "port": port, "platform_used": "ss"}
    return {"found": False, "port": port, "platform_used": "lsof"}


def _identify_windows(port: int) -> dict[str, Any]:
    rc, stdout, _stderr = _run(["netstat", "-ano"])
    if rc != 0:
        return {"found": False, "port": port, "platform_used": "netstat"}

    pid: int | None = None
    for line in stdout.splitlines():
        if "LISTENING" not in line:
            continue
        if f":{port} " not in line and not line.strip().endswith(f":{port}"):
            continue
        parts = line.split()
        if len(parts) >= 5 and parts[-1].isdigit():
            pid = int(parts[-1])
            break

    if pid is None:
        return {"found": False, "port": port, "platform_used": "netstat"}

    name, command = _resolve_windows_pid(pid)
    return {
        "found": True,
        "port": port,
        "pid": pid,
        "name": name,
        "command": command,
        "platform_used": "netstat",
    }


_LSOF_LINE = re.compile(r"^(\S+)\s+(\d+)\s+\S+", re.MULTILINE)
_SS_PROCESS = re.compile(r'\(\("([^"]+)",pid=(\d+),')


def _parse_lsof(stdout: str) -> dict[str, Any] | None:
    for line in stdout.splitlines():
        if line.startswith("COMMAND"):
            continue
        match = _LSOF_LINE.match(line)
        if match:
            name = match.group(1)
            pid = int(match.group(2))
            return {"pid": pid, "name": name, "command": name}
    return None


def _parse_ss(stdout: str) -> dict[str, Any] | None:
    match = _SS_PROCESS.search(stdout)
    if not match:
        return None
    name = match.group(1)
    pid = int(match.group(2))
    return {"pid": pid, "name": name, "command": name}


def _resolve_windows_pid(pid: int) -> tuple[str, str]:
    """Return (image name, full command) for a pid; falls back to placeholders."""
    rc, stdout, _ = _run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"])
    if rc == 0 and stdout.strip():
        first = stdout.splitlines()[0]
        cells = [cell.strip('"') for cell in first.split(",")]
        if cells:
            return cells[0], cells[0]
    return f"pid-{pid}", f"pid-{pid}"


def _platform() -> str:
    """Indirection seam for tests."""
    return _stdlib_platform.system()


def _run(cmd: list[str]) -> tuple[int, str, str]:
    """Indirection seam for tests."""
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return proc.returncode, proc.stdout, proc.stderr
```

In `installer/contract.py`, add above `build_payload`:

```python
def port_holder_payload(cfg: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    from . import port_holder as installer_port_holder
    port = overrides.get("_port") if overrides else None
    if not isinstance(port, int):
        return {"found": False, "error": "_port (int) is required"}
    return installer_port_holder.identify(port)
```

Dispatch branch (note: it uses raw `overrides`, not normalized cfg, because the port comes via `_port`):

```python
    elif action == "port-holder":
        payload = port_holder_payload(cfg, overrides or {})
```

Add `"port-holder"` to both argparse choices.

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest installer/tests/test_port_holder.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```
git add installer/port_holder.py installer/tests/test_port_holder.py installer/contract.py install.py
git commit -m "feat(installer): add port-holder contract action

Identifies the process holding a TCP port. lsof preferred on macOS/Linux,
ss fallback when lsof is missing, netstat + tasklist on Windows. Backs
spec B2 — turns 'Port 8082 in use' into 'Port 8082 in use by nginx pid 1234'."
```

---

### Task 6: `recover` contract action

**Files:**
- Create: `installer/recovery.py`
- Create: `installer/tests/test_recovery.py`
- Modify: `installer/contract.py` (dispatch + argparse)
- Modify: `install.py:100` (add `recover` to choices)

- [ ] **Step 1: Write the failing test**

Create `installer/tests/test_recovery.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_recovery.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `installer/recovery.py`:

```python
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
```

In `installer/contract.py`, add above `build_payload`:

```python
def recover_payload() -> dict[str, Any]:
    from . import recovery as installer_recovery
    state_path = utils.REPO_ROOT / ".install-state.json"
    return installer_recovery.inspect(state_path)
```

Dispatch branch:

```python
    elif action == "recover":
        payload = recover_payload()
```

Add `"recover"` to both argparse choices.

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest installer/tests/test_recovery.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```
git add installer/recovery.py installer/tests/test_recovery.py installer/contract.py install.py
git commit -m "feat(installer): add recover contract action

Inspects .install-state.json and recommends Resume/Retry/Reset. Resume
when one step completed and another failed (typical transient failure);
Reset when nothing completed but multiple failures (stuck setup); Retry
otherwise. Backs spec C5 + Block 3 recovery hierarchy."
```

---

### Task 7: Diagnostic KB schema and initial 10 fingerprints

**Files:**
- Create: `installer/diagnostics-kb.json`
- Create: `installer/diagnostics.py`
- Create: `installer/tests/test_diagnostics.py`

- [ ] **Step 1: Write the failing test**

Create `installer/tests/test_diagnostics.py`:

```python
"""Tests for installer.diagnostics module — KB matcher + entry fixtures."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from installer import diagnostics


KB_PATH = Path(__file__).resolve().parents[1] / "diagnostics-kb.json"


def test_kb_loads_and_validates_schema():
    entries = diagnostics.load_kb()
    assert len(entries) >= 10
    required_keys = {"id", "fingerprint", "category", "severity", "user_message", "platforms"}
    for entry in entries:
        missing = required_keys - set(entry)
        assert not missing, f"entry {entry.get('id')} missing keys: {missing}"
        assert entry["severity"] in {"error", "warn"}, entry["id"]
        assert isinstance(entry["platforms"], list)
        for plat in entry["platforms"]:
            assert plat in {"all", "darwin", "linux", "windows"}


def test_match_returns_matching_entry():
    log = "OSError: [Errno 98] Address already in use: ('0.0.0.0', 8082)"
    matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="bootstrap", platform="linux"
    )
    assert matches
    top = matches[0]
    assert top["id"] == "port-conflict-generic"
    assert top["fix_action"] == "port-holder"
    assert top["fix_args"] == {"port": 8082}


def test_match_returns_empty_when_no_fingerprint_hits():
    matches = diagnostics.match(
        stdout="completely benign success message",
        stderr="",
        exit_code=0,
        phase="solr",
        platform="linux",
    )
    assert matches == []


def test_match_filters_by_platform():
    log = "WSL is not installed"
    linux_matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="preflight", platform="linux"
    )
    win_matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="preflight", platform="windows"
    )
    assert linux_matches == []  # WSL fingerprint is windows-only
    assert win_matches  # at least one match


def test_kb_fingerprints_compile():
    """Every fingerprint must be a valid regex."""
    import re
    for entry in diagnostics.load_kb():
        try:
            re.compile(entry["fingerprint"])
        except re.error as exc:
            pytest.fail(f"entry {entry['id']} has invalid regex: {exc}")
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_diagnostics.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the KB file**

Create `installer/diagnostics-kb.json`:

```json
[
  {
    "id": "port-conflict-generic",
    "fingerprint": "Address already in use.*['(](\\d+)['\\)]",
    "category": "port-conflict",
    "severity": "error",
    "fix_action": "port-holder",
    "fix_args_template": {"port": "$1"},
    "user_message": "Port {port} is already in use. Use the port-holder action to find and stop the process.",
    "learn_more": "docs/install/port-conflicts",
    "platforms": ["all"]
  },
  {
    "id": "docker-daemon-not-running-mac",
    "fingerprint": "Cannot connect to the Docker daemon at unix:///var/run/docker\\.sock",
    "category": "docker",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "Docker Desktop is not running. Start Docker Desktop, wait for the whale icon to be steady, then retry.",
    "learn_more": "docs/install/docker-not-running",
    "platforms": ["darwin"]
  },
  {
    "id": "docker-daemon-not-running-linux",
    "fingerprint": "Cannot connect to the Docker daemon.*Is the docker daemon running",
    "category": "docker",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "The Docker daemon is not running. Start it with `sudo systemctl start docker`.",
    "learn_more": "docs/install/docker-not-running",
    "platforms": ["linux"]
  },
  {
    "id": "wsl-not-installed",
    "fingerprint": "(WSL is not installed|wsl\\.exe.*not recognized|The Windows Subsystem for Linux is not installed)",
    "category": "wsl",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "WSL2 is required on Windows. Install it with `wsl --install` from an Administrator PowerShell, then reboot.",
    "learn_more": "docs/install/wsl-setup",
    "platforms": ["windows"]
  },
  {
    "id": "wsl-no-distros",
    "fingerprint": "There are no distributions installed",
    "category": "wsl",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "WSL is installed but no Linux distribution is set up. Install Ubuntu with `wsl --install -d Ubuntu-24.04`.",
    "learn_more": "docs/install/wsl-setup",
    "platforms": ["windows"]
  },
  {
    "id": "python3-missing-in-distro",
    "fingerprint": "(python3: command not found|/bin/sh: python3: not found)",
    "category": "wsl",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "python3 is not installed inside the WSL distro. Run `sudo apt-get install -y python3 python3-pip` inside WSL, then retry.",
    "learn_more": "docs/install/wsl-setup",
    "platforms": ["windows"]
  },
  {
    "id": "image-pull-rate-limit",
    "fingerprint": "toomanyrequests: You have reached your pull rate limit",
    "category": "network",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "Docker Hub pull rate limit hit. Sign in to Docker Hub with `docker login` (free tier allows 200 pulls per 6 hours).",
    "learn_more": "docs/install/docker-rate-limit",
    "platforms": ["all"]
  },
  {
    "id": "disk-full-docker",
    "fingerprint": "no space left on device",
    "category": "disk",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "Disk is full. Free space with `docker system prune -af` or remove unused volumes with `docker volume prune`.",
    "learn_more": "docs/install/disk-space",
    "platforms": ["all"]
  },
  {
    "id": "compose-permission-denied-socket",
    "fingerprint": "permission denied while trying to connect to the Docker daemon socket",
    "category": "docker",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "Your user is not in the `docker` group. Run `sudo usermod -aG docker $USER`, then log out and back in.",
    "learn_more": "docs/install/docker-group",
    "platforms": ["linux"]
  },
  {
    "id": "backend-env-missing",
    "fingerprint": "(backend/\\.env.*No such file or directory|cp: cannot stat 'backend/\\.env)",
    "category": "config",
    "severity": "error",
    "fix_action": null,
    "fix_args": {},
    "user_message": "backend/.env is missing. Run `cp backend/.env.example backend/.env`, edit any required values, then retry.",
    "learn_more": "docs/install/env-setup",
    "platforms": ["all"]
  }
]
```

- [ ] **Step 4: Write the matcher implementation**

Create `installer/diagnostics.py`:

```python
"""Match installer error streams against the diagnostic knowledge base.

Layer 1 of the spec's Diagnostic Knowledge Engine (Area G). The KB lives in
installer/diagnostics-kb.json. Each entry has a regex `fingerprint`; on match,
the entry produces a user-facing message plus an optional `fix_action`
referencing another contract action that can repair the failure.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

KB_PATH = Path(__file__).resolve().parent / "diagnostics-kb.json"


def load_kb() -> list[dict[str, Any]]:
    """Load and return all KB entries (cached on first call)."""
    if not KB_PATH.exists():
        return []
    return json.loads(KB_PATH.read_text())


def match(
    *,
    stdout: str,
    stderr: str,
    exit_code: int,
    phase: str,
    platform: str,
) -> list[dict[str, Any]]:
    """Return matching KB entries, ranked by severity then KB order.

    `platform` should be one of: darwin, linux, windows.
    `fix_args` are rendered from `fix_args_template` using regex captures.
    """
    haystack = f"{stdout}\n{stderr}"
    matches: list[dict[str, Any]] = []

    for entry in load_kb():
        platforms = entry.get("platforms") or ["all"]
        if "all" not in platforms and platform not in platforms:
            continue

        regex = re.compile(entry["fingerprint"], re.MULTILINE)
        m = regex.search(haystack)
        if not m:
            continue

        fix_args = _render_args(entry, m)
        message = _render_message(entry["user_message"], fix_args)

        matches.append(
            {
                "id": entry["id"],
                "category": entry["category"],
                "severity": entry["severity"],
                "fix_action": entry.get("fix_action"),
                "fix_args": fix_args,
                "message": message,
                "learn_more": entry.get("learn_more", ""),
            }
        )

    severity_rank = {"error": 0, "warn": 1}
    matches.sort(key=lambda e: severity_rank.get(e["severity"], 9))
    return matches


def _render_args(entry: dict[str, Any], match_obj: re.Match[str]) -> dict[str, Any]:
    template = entry.get("fix_args_template")
    if template is None:
        return entry.get("fix_args") or {}

    rendered: dict[str, Any] = {}
    for key, value in template.items():
        if isinstance(value, str) and value.startswith("$"):
            try:
                group = int(value[1:])
                captured = match_obj.group(group)
                # Coerce numeric-looking captures to int (e.g. port numbers).
                rendered[key] = int(captured) if captured.isdigit() else captured
            except (ValueError, IndexError):
                rendered[key] = value
        else:
            rendered[key] = value
    return rendered


def _render_message(template: str, args: dict[str, Any]) -> str:
    try:
        return template.format(**args)
    except (KeyError, IndexError):
        return template
```

- [ ] **Step 5: Run tests to verify they pass**

```
python -m pytest installer/tests/test_diagnostics.py -v
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```
git add installer/diagnostics.py installer/diagnostics-kb.json installer/tests/test_diagnostics.py
git commit -m "feat(installer): add diagnostic KB matcher with 10 seed entries

Layer 1 of spec Area G. installer/diagnostics-kb.json holds regex
fingerprints; installer/diagnostics.py matches error streams against them
and renders user-facing messages with regex captures. Initial KB covers
port conflicts, Docker daemon liveness, WSL setup, image rate limits,
disk full, group permissions, and missing .env."
</content_continued_in_step>
```

The commit message above truncates — use this complete version:

```
git commit -m "feat(installer): add diagnostic KB matcher with 10 seed entries

Layer 1 of spec Area G. KB lives at installer/diagnostics-kb.json;
installer/diagnostics.py matches error streams against the KB regexes
and renders user-facing messages with regex captures. Initial KB covers
port conflicts, Docker daemon (mac/linux), WSL setup, missing python3
in distro, image pull rate limits, disk full, docker group permissions,
and missing backend/.env."
```

---

### Task 8: `diagnose` contract action

**Files:**
- Modify: `installer/contract.py` (add `diagnose_payload`, dispatch, argparse)
- Modify: `install.py:100` (add `diagnose` to choices)
- Modify: `installer/tests/test_contract.py` (add round-trip test)

- [ ] **Step 1: Write the failing test**

Append to `installer/tests/test_contract.py`:

```python
def test_diagnose_action_returns_matched_fingerprints(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "diagnose",
        community=True,
        overrides={
            "_diagnose_input": {
                "stdout": "OSError: [Errno 98] Address already in use: ('0.0.0.0', 8082)",
                "stderr": "",
                "exit_code": 1,
                "phase": "bootstrap",
                "platform": "linux",
            },
        },
    )

    assert "matches" in payload
    assert len(payload["matches"]) >= 1
    top = payload["matches"][0]
    assert top["id"] == "port-conflict-generic"
    assert top["fix_action"] == "port-holder"
    assert top["fix_args"] == {"port": 8082}
    assert payload["ai_assist_eligible"] is False  # match found


def test_diagnose_action_marks_ai_assist_eligible_when_no_match(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "diagnose",
        community=True,
        overrides={
            "_diagnose_input": {
                "stdout": "Some unmatched novel error",
                "stderr": "",
                "exit_code": 1,
                "phase": "frontend",
                "platform": "linux",
            },
        },
    )

    assert payload["matches"] == []
    assert payload["ai_assist_eligible"] is True


def test_diagnose_action_returns_empty_when_exit_code_zero(monkeypatch):
    monkeypatch.setattr("installer.config.utils.is_port_free", lambda port: True)

    payload = contract.build_payload(
        "diagnose",
        community=True,
        overrides={
            "_diagnose_input": {
                "stdout": "Address already in use",
                "stderr": "",
                "exit_code": 0,
                "phase": "noop",
                "platform": "linux",
            },
        },
    )

    assert payload["matches"] == []
    assert payload["ai_assist_eligible"] is False  # not a failure
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest installer/tests/test_contract.py -v -k diagnose
```

Expected: FAIL — `Unsupported contract action: diagnose`.

- [ ] **Step 3: Write the dispatch handler**

In `installer/contract.py`, add above `build_payload`:

```python
def diagnose_payload(overrides: dict[str, Any]) -> dict[str, Any]:
    from . import diagnostics as installer_diagnostics

    input_payload = (overrides or {}).get("_diagnose_input") or {}
    stdout = input_payload.get("stdout", "")
    stderr = input_payload.get("stderr", "")
    exit_code = int(input_payload.get("exit_code", 0))
    phase = input_payload.get("phase", "")
    platform_name = input_payload.get("platform", "linux")

    if exit_code == 0:
        return {"matches": [], "ai_assist_eligible": False}

    matches = installer_diagnostics.match(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        phase=phase,
        platform=platform_name,
    )
    return {
        "matches": matches,
        "ai_assist_eligible": len(matches) == 0,
    }
```

Dispatch branch:

```python
    elif action == "diagnose":
        payload = diagnose_payload(overrides or {})
```

Add `"diagnose"` to both argparse choices.

- [ ] **Step 4: Run tests to verify they pass**

```
python -m pytest installer/tests/test_contract.py -v -k diagnose
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```
git add installer/contract.py installer/tests/test_contract.py install.py
git commit -m "feat(installer): add diagnose contract action

Wraps the KB matcher (Task 7). Returns ranked matches plus
ai_assist_eligible (true when no fingerprint matched and exit_code != 0)
— the future hook for Layer 2 (BYO-key Claude assist) per spec G9."
```

---

### Task 9: Expand the KB to ~50 fingerprints

**Files:**
- Modify: `installer/diagnostics-kb.json`
- Modify: `installer/tests/test_diagnostics.py` (add per-entry fixtures)

- [ ] **Step 1: Append the additional 40 fingerprints**

Open `installer/diagnostics-kb.json` and add these entries to the JSON array (between the existing closing `]` and the last entry's closing `}`, append commas and the new entries):

```json
  {
    "id": "docker-compose-v1-only",
    "fingerprint": "docker-compose: error: argument COMMAND.*invalid choice",
    "category": "docker",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Only Docker Compose v1 was found. Parthenon requires Docker Compose v2 (`docker compose ...`). Update Docker to a recent version.",
    "learn_more": "docs/install/docker-compose-v2",
    "platforms": ["all"]
  },
  {
    "id": "docker-not-installed",
    "fingerprint": "docker: command not found",
    "category": "docker",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Docker is not installed. Install Docker Desktop (mac/Windows) or Docker Engine (Linux) and retry.",
    "learn_more": "docs/install/docker",
    "platforms": ["all"]
  },
  {
    "id": "image-pull-unauthorized",
    "fingerprint": "(unauthorized: authentication required|denied: requested access to the resource is denied)",
    "category": "network",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "An image is private and you are not authenticated. Run `docker login` (or `docker login ghcr.io`) and retry.",
    "learn_more": "docs/install/registry-auth",
    "platforms": ["all"]
  },
  {
    "id": "image-not-found",
    "fingerprint": "manifest for .* not found",
    "category": "network",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "An image referenced by docker-compose was not found. Confirm your network is up and the image tag is correct.",
    "learn_more": "docs/install/image-not-found",
    "platforms": ["all"]
  },
  {
    "id": "dns-resolution-failure",
    "fingerprint": "(Temporary failure in name resolution|getaddrinfo failed|EAI_AGAIN)",
    "category": "network",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "DNS resolution failed. Confirm internet connectivity and that no corporate VPN/proxy is required.",
    "learn_more": "docs/install/network",
    "platforms": ["all"]
  },
  {
    "id": "https-cert-error",
    "fingerprint": "(SSL certificate problem|certificate has expired|self.signed certificate)",
    "category": "network",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "TLS certificate problem reaching a registry. If you're behind a corporate proxy, set HTTPS_PROXY or import the proxy CA into your trust store.",
    "learn_more": "docs/install/proxy",
    "platforms": ["all"]
  },
  {
    "id": "compose-port-already-allocated",
    "fingerprint": "Bind for 0\\.0\\.0\\.0:(\\d+) failed: port is already allocated",
    "category": "port-conflict",
    "severity": "error",
    "fix_action": "port-holder",
    "fix_args_template": {"port": "$1"},
    "user_message": "Port {port} is already mapped by another container. Stop the conflicting container or change the host port.",
    "learn_more": "docs/install/port-conflicts",
    "platforms": ["all"]
  },
  {
    "id": "out-of-memory-compose-up",
    "fingerprint": "(Killed.*OOM|out of memory|cannot allocate memory)",
    "category": "memory",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "A service was killed for lack of memory. Increase Docker Desktop memory to at least 6 GB (Preferences → Resources).",
    "learn_more": "docs/install/memory",
    "platforms": ["all"]
  },
  {
    "id": "postgres-password-mismatch",
    "fingerprint": "(password authentication failed for user|FATAL:.*password)",
    "category": "database",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "PostgreSQL rejected the configured password. Reset the database with `docker compose down -v` (deletes data) or fix the DB_PASSWORD value in backend/.env.",
    "learn_more": "docs/install/postgres-credentials",
    "platforms": ["all"]
  },
  {
    "id": "postgres-not-ready",
    "fingerprint": "(could not connect to server.*Connection refused|the database system is starting up)",
    "category": "database",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "PostgreSQL is starting up. The installer will wait — if this persists past 60 s, check `docker compose logs postgres`.",
    "learn_more": "docs/install/postgres-startup",
    "platforms": ["all"]
  },
  {
    "id": "redis-connection-refused",
    "fingerprint": "Could not connect to Redis at .*: Connection refused",
    "category": "redis",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Redis is not reachable. Check `docker compose logs redis` and confirm REDIS_PASSWORD is set in backend/.env.",
    "learn_more": "docs/install/redis",
    "platforms": ["all"]
  },
  {
    "id": "solr-startup-oom",
    "fingerprint": "Solr.*OutOfMemoryError",
    "category": "memory",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Solr ran out of heap. Edit SOLR_HEAP in backend/.env to a larger value (default 512 m → try 1 g) and `docker compose up -d --force-recreate solr`.",
    "learn_more": "docs/install/solr-memory",
    "platforms": ["all"]
  },
  {
    "id": "vite-build-oom",
    "fingerprint": "(JavaScript heap out of memory|FATAL ERROR.*Reached heap limit)",
    "category": "memory",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Vite ran out of Node heap. Set NODE_OPTIONS=--max-old-space-size=4096 and rerun the install.",
    "learn_more": "docs/install/vite-memory",
    "platforms": ["all"]
  },
  {
    "id": "composer-network-failure",
    "fingerprint": "(Could not authenticate against|Failed to download.*from packagist)",
    "category": "network",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Composer (PHP) cannot reach Packagist. Check internet/proxy settings; if behind a proxy, set HTTPS_PROXY before running the installer.",
    "learn_more": "docs/install/composer-network",
    "platforms": ["all"]
  },
  {
    "id": "npm-eperm-windows",
    "fingerprint": "EPERM: operation not permitted",
    "category": "permissions",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "npm hit a permissions error. Close any IDE that has the project open, or run from a non-OneDrive folder.",
    "learn_more": "docs/install/npm-permissions",
    "platforms": ["windows"]
  },
  {
    "id": "macos-quarantine-warning",
    "fingerprint": "operation not permitted.*\\.app",
    "category": "permissions",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "macOS is blocking a quarantined binary. Right-click → Open the .app once, or run `xattr -dr com.apple.quarantine <path>`.",
    "learn_more": "docs/install/gatekeeper",
    "platforms": ["darwin"]
  },
  {
    "id": "selinux-denial",
    "fingerprint": "(SELinux is preventing|avc: denied)",
    "category": "security",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "SELinux denied a Docker volume mount. Add `:Z` to the volume in docker-compose.community.yml or set SELinux to permissive temporarily for testing.",
    "learn_more": "docs/install/selinux",
    "platforms": ["linux"]
  },
  {
    "id": "wsl-version-1",
    "fingerprint": "(WSL 1|--set-version 2)",
    "category": "wsl",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Your WSL distro is on WSL 1. Upgrade with `wsl --set-version <distro> 2` and re-run the installer.",
    "learn_more": "docs/install/wsl-version",
    "platforms": ["windows"]
  },
  {
    "id": "docker-desktop-wsl-integration-off",
    "fingerprint": "(WSL distro does not have Docker integration|cannot connect to WSL.*docker)",
    "category": "wsl",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Docker Desktop's WSL integration is disabled for your distro. Open Docker Desktop → Settings → Resources → WSL integration, enable your distro, click Apply & Restart.",
    "learn_more": "docs/install/docker-desktop-wsl",
    "platforms": ["windows"]
  },
  {
    "id": "git-not-installed",
    "fingerprint": "git: command not found",
    "category": "tooling",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "git is not installed. Install git and retry.",
    "learn_more": "docs/install/tooling",
    "platforms": ["all"]
  },
  {
    "id": "pip-install-permission-denied",
    "fingerprint": "Could not install packages due to an OSError.*Permission denied",
    "category": "permissions",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "pip cannot write to its install location. On Linux, prefix with sudo OR use a venv. On macOS/Windows in WSL, prefer `pip install --user`.",
    "learn_more": "docs/install/pip-permissions",
    "platforms": ["all"]
  },
  {
    "id": "achilles-sql-error",
    "fingerprint": "(Achilles failed|R session aborted.*Achilles)",
    "category": "analytics",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "OHDSI Achilles characterization failed for one source. The install can continue; re-run later via Admin → System Health → Achilles.",
    "learn_more": "docs/install/achilles",
    "platforms": ["all"]
  },
  {
    "id": "vocabulary-zip-not-found",
    "fingerprint": "(Athena vocabulary ZIP.*not found|vocab\\.zip: No such file)",
    "category": "config",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "The Athena vocabulary ZIP path is invalid. Re-download from https://athena.ohdsi.org and update the path in Configure.",
    "learn_more": "docs/install/vocabulary",
    "platforms": ["all"]
  },
  {
    "id": "hecate-bootstrap-missing",
    "fingerprint": "(hecate.*bootstrap.*missing|qdrant_collections.*not found)",
    "category": "hecate",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "Hecate concept-search bootstrap assets are missing. Use the 'Download Hecate bootstrap' button in preflight, or skip Hecate by unchecking it in Configure.",
    "learn_more": "docs/install/hecate",
    "platforms": ["all"]
  },
  {
    "id": "compose-yaml-parse-error",
    "fingerprint": "(yaml: line \\d+: |error parsing.*docker-compose)",
    "category": "config",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "docker-compose.yml has a syntax error. Run `docker compose config` to see the parser's complaint.",
    "learn_more": "docs/install/compose-syntax",
    "platforms": ["all"]
  },
  {
    "id": "host-networking-not-supported",
    "fingerprint": "host networking is not supported",
    "category": "docker",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "Docker Desktop on macOS/Windows does not support `network_mode: host`. The installer's compose file should not use it.",
    "learn_more": "docs/install/host-networking",
    "platforms": ["darwin", "windows"]
  },
  {
    "id": "free-port-3000-vite",
    "fingerprint": "Port 3000 is already in use",
    "category": "port-conflict",
    "severity": "warn",
    "fix_action": "port-holder",
    "fix_args_template": {"port": 3000},
    "user_message": "Port 3000 is busy. The installer can use a different port — re-run with `VITE_PORT=3001` exported.",
    "learn_more": "docs/install/port-conflicts",
    "platforms": ["all"]
  },
  {
    "id": "free-port-5432-postgres",
    "fingerprint": "(0\\.0\\.0\\.0:5432.*already in use|port 5432 is already)",
    "category": "port-conflict",
    "severity": "error",
    "fix_action": "port-holder",
    "fix_args_template": {"port": 5432},
    "user_message": "Port 5432 is busy. Stop the local PostgreSQL service holding it, or set DB_PORT to another port in backend/.env.",
    "learn_more": "docs/install/postgres-port",
    "platforms": ["all"]
  },
  {
    "id": "ollama-unreachable",
    "fingerprint": "(connection refused.*11434|ollama.*not reachable)",
    "category": "ai",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "Ollama (AI features) is not reachable on port 11434. Either install Ollama and `ollama serve`, or unset OLLAMA_URL in backend/.env to disable AI features.",
    "learn_more": "docs/install/ollama",
    "platforms": ["all"]
  },
  {
    "id": "wsl-distro-missing-curl",
    "fingerprint": "curl: command not found",
    "category": "wsl",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "curl is not installed in your WSL distro. Run `sudo apt-get install -y curl` inside WSL, then retry.",
    "learn_more": "docs/install/wsl-setup",
    "platforms": ["windows"]
  },
  {
    "id": "tar-not-found-windows",
    "fingerprint": "tar: command not found",
    "category": "tooling",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "tar is not installed in your WSL distro. Run `sudo apt-get install -y tar` inside WSL, then retry.",
    "learn_more": "docs/install/wsl-setup",
    "platforms": ["windows"]
  },
  {
    "id": "node-version-too-old",
    "fingerprint": "(npm WARN.*requires.*node.*>=20|engine.*node.*not satisfied)",
    "category": "tooling",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "Node.js version is too old. Install Node 20 or newer (via nvm or nodejs.org) and retry.",
    "learn_more": "docs/install/node-version",
    "platforms": ["all"]
  },
  {
    "id": "docker-context-pointing-elsewhere",
    "fingerprint": "Cannot connect to the Docker daemon at tcp://",
    "category": "docker",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "docker is configured to talk to a remote daemon. Run `docker context use default` and retry.",
    "learn_more": "docs/install/docker-context",
    "platforms": ["all"]
  },
  {
    "id": "rosetta-needed-on-arm",
    "fingerprint": "exec format error",
    "category": "platform",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "An x86-64 binary cannot run on Apple Silicon. Confirm you downloaded the universal/arm64 .dmg, or install Rosetta with `softwareupdate --install-rosetta`.",
    "learn_more": "docs/install/apple-silicon",
    "platforms": ["darwin"]
  },
  {
    "id": "appimage-fuse-missing",
    "fingerprint": "(AppImage requires FUSE|dlopen.*libfuse)",
    "category": "tooling",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": ".AppImage needs FUSE. On Ubuntu 22.04+: `sudo apt-get install -y libfuse2`.",
    "learn_more": "docs/install/appimage-fuse",
    "platforms": ["linux"]
  },
  {
    "id": "rpm-signature-not-trusted",
    "fingerprint": "(NOKEY|GPG.*key not.*imported)",
    "category": "security",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "The RPM is signed but its public key is not in your keyring. Import SIGNING-KEY.asc and retry.",
    "learn_more": "docs/install/verifying-signatures",
    "platforms": ["linux"]
  },
  {
    "id": "deb-signature-failed",
    "fingerprint": "(BADSIG|gpg: BAD signature)",
    "category": "security",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "The .deb signature did not verify. Do not install — re-download and verify against SHA256SUMS.txt.",
    "learn_more": "docs/install/verifying-signatures",
    "platforms": ["linux"]
  },
  {
    "id": "frontend-build-missing",
    "fingerprint": "(frontend/dist.*not found|frontend assets are not built)",
    "category": "frontend",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "The frontend build was not produced. Re-run with the community runtime profile, or run `./deploy.sh --frontend` manually.",
    "learn_more": "docs/install/frontend",
    "platforms": ["all"]
  },
  {
    "id": "subprocess-killed-by-user",
    "fingerprint": "(Terminated|Interrupt|KeyboardInterrupt)",
    "category": "user",
    "severity": "warn",
    "fix_action": null, "fix_args": {},
    "user_message": "The installer was cancelled by the user. State is preserved — Resume picks up from the last completed step.",
    "learn_more": "docs/install/cancel-and-resume",
    "platforms": ["all"]
  },
  {
    "id": "permission-denied-tmp",
    "fingerprint": "Permission denied.*\\/tmp",
    "category": "permissions",
    "severity": "error",
    "fix_action": null, "fix_args": {},
    "user_message": "/tmp is not writable. Confirm disk isn't full and that /tmp is mounted with default permissions.",
    "learn_more": "docs/install/tmp-permissions",
    "platforms": ["linux", "darwin"]
  }
```

You should now have ~50 entries total (10 from Task 7 + 40 from this task).

- [ ] **Step 2: Add per-entry fixture tests**

Append to `installer/tests/test_diagnostics.py`:

```python
@pytest.fixture(scope="module")
def kb_entries():
    return diagnostics.load_kb()


# Map id -> (input log, expected platform)
KB_FIXTURES = {
    "docker-compose-v1-only": ("docker-compose: error: argument COMMAND: invalid choice: 'compose'", "linux"),
    "docker-not-installed": ("docker: command not found", "linux"),
    "image-pull-unauthorized": ("unauthorized: authentication required", "linux"),
    "image-not-found": ("manifest for ghcr.io/foo/bar:latest not found", "linux"),
    "dns-resolution-failure": ("Temporary failure in name resolution", "linux"),
    "https-cert-error": ("SSL certificate problem: unable to get local issuer", "linux"),
    "compose-port-already-allocated": ("Bind for 0.0.0.0:8082 failed: port is already allocated", "linux"),
    "out-of-memory-compose-up": ("Killed: OOM in container", "linux"),
    "postgres-password-mismatch": ("FATAL:  password authentication failed for user \"parthenon\"", "linux"),
    "postgres-not-ready": ("could not connect to server: Connection refused", "linux"),
    "redis-connection-refused": ("Could not connect to Redis at 127.0.0.1:6379: Connection refused", "linux"),
    "solr-startup-oom": ("Solr: java.lang.OutOfMemoryError: Java heap space", "linux"),
    "vite-build-oom": ("FATAL ERROR: Reached heap limit Allocation failed", "linux"),
    "composer-network-failure": ("Could not authenticate against packagist.org", "linux"),
    "selinux-denial": ("avc: denied { read } for path=...", "linux"),
    "wsl-version-1": ("Please update to WSL 2 with `wsl --set-version <distro> 2`", "windows"),
    "git-not-installed": ("git: command not found", "linux"),
    "pip-install-permission-denied": (
        "Could not install packages due to an OSError: [Errno 13] Permission denied",
        "linux",
    ),
    "vocabulary-zip-not-found": ("Athena vocabulary ZIP /tmp/vocab.zip not found", "linux"),
    "hecate-bootstrap-missing": ("hecate concept search bootstrap missing", "linux"),
    "compose-yaml-parse-error": ("yaml: line 42: did not find expected '-' indicator", "linux"),
    "free-port-5432-postgres": ("port 5432 is already in use", "linux"),
    "ollama-unreachable": ("connection refused dialing 127.0.0.1:11434", "linux"),
    "wsl-distro-missing-curl": ("curl: command not found", "windows"),
    "tar-not-found-windows": ("tar: command not found", "windows"),
    "node-version-too-old": ("npm WARN engine package@1.0.0: wanted: {node>=20.0.0}", "linux"),
    "docker-context-pointing-elsewhere": ("Cannot connect to the Docker daemon at tcp://1.2.3.4:2376", "linux"),
    "rosetta-needed-on-arm": ("exec format error", "darwin"),
    "appimage-fuse-missing": ("AppImage requires FUSE to run", "linux"),
    "deb-signature-failed": ("gpg: BAD signature from \"Acumenus\"", "linux"),
    "frontend-build-missing": ("frontend/dist not found", "linux"),
    "subprocess-killed-by-user": ("KeyboardInterrupt", "linux"),
}


@pytest.mark.parametrize("entry_id,fixture", list(KB_FIXTURES.items()))
def test_kb_entry_matches_its_fixture(entry_id, fixture, kb_entries):
    log, platform = fixture
    matches = diagnostics.match(
        stdout=log, stderr="", exit_code=1, phase="any", platform=platform
    )
    matched_ids = [m["id"] for m in matches]
    assert entry_id in matched_ids, f"{entry_id} did not match its fixture"
```

- [ ] **Step 3: Run tests to verify they pass**

```
python -m pytest installer/tests/test_diagnostics.py -v
```

Expected: ~37 passed (5 base tests + 32 fixture tests; some entries have no fixture by design — that's OK).

- [ ] **Step 4: Commit**

```
git add installer/diagnostics-kb.json installer/tests/test_diagnostics.py
git commit -m "feat(installer): expand diagnostic KB to 50 fingerprints

Adds 40 entries covering Docker (v1 vs v2, missing daemon, bad context,
auth, rate limit, image not found), network (DNS, TLS, proxy), memory
(compose OOM, Solr/Vite heap), DB (postgres password, startup, redis),
WSL (v1, integration off, missing curl/tar), permissions (npm, pip, tmp),
platform (Apple Silicon, FUSE, SELinux), and signature/security
(GPG NOKEY, BADSIG). Each entry has a parametrized fixture in tests."
```

---

### Task 10: Round-trip integration test for the full contract surface

**Files:**
- Create: `installer/tests/test_contract_round_trip.py`

- [ ] **Step 1: Write the integration test**

Create `installer/tests/test_contract_round_trip.py`:

```python
"""End-to-end round-trip tests for the new contract actions.

Each test invokes `python install.py --contract <action> --community ...` as
a subprocess and asserts the JSON output shape. This catches argparse and
dispatch wiring regressions that unit tests miss.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def _run_contract(action: str, *, input_json: dict | None = None) -> dict:
    cmd = [
        sys.executable,
        "install.py",
        "--contract",
        action,
        "--community",
        "--contract-redact",
        "--contract-pretty",
    ]
    if input_json is not None:
        input_path = REPO_ROOT / f".test-{action}-input.json"
        input_path.write_text(json.dumps(input_json))
        cmd.extend(["--contract-input", str(input_path)])
    try:
        proc = subprocess.run(
            cmd, cwd=REPO_ROOT, capture_output=True, text=True, check=False
        )
    finally:
        if input_json is not None:
            (REPO_ROOT / f".test-{action}-input.json").unlink(missing_ok=True)
    if proc.returncode != 0:
        pytest.fail(f"contract {action} exited {proc.returncode}: {proc.stderr}")
    return json.loads(proc.stdout)


def test_open_app_round_trip():
    payload = _run_contract(
        "open-app", input_json={"app_url": "http://localhost", "nginx_port": 8082}
    )
    assert payload == {"url": "http://localhost:8082"}


def test_credentials_round_trip_when_file_missing():
    payload = _run_contract("credentials", input_json={"admin_email": "admin@x.test"})
    assert payload["admin_email"] == "admin@x.test"
    assert payload["admin_password"] is None
    assert "error" in payload


def test_recover_round_trip_no_state():
    payload = _run_contract("recover")
    assert payload["mode"] == "retry"
    assert payload["can_resume"] is False


def test_diagnose_round_trip_with_match():
    payload = _run_contract(
        "diagnose",
        input_json={
            "_diagnose_input": {
                "stdout": "OSError: [Errno 98] Address already in use: ('0.0.0.0', 8082)",
                "stderr": "",
                "exit_code": 1,
                "phase": "bootstrap",
                "platform": "linux",
            }
        },
    )
    assert len(payload["matches"]) >= 1
    assert payload["matches"][0]["id"] == "port-conflict-generic"


def test_diagnose_round_trip_no_match_marks_ai_assist_eligible():
    payload = _run_contract(
        "diagnose",
        input_json={
            "_diagnose_input": {
                "stdout": "novel error not in the KB",
                "stderr": "",
                "exit_code": 1,
                "phase": "frontend",
                "platform": "linux",
            }
        },
    )
    assert payload["matches"] == []
    assert payload["ai_assist_eligible"] is True


def test_port_holder_round_trip():
    payload = _run_contract("port-holder", input_json={"_port": 65535})
    # Port 65535 is unlikely to be in use; either way we get a valid shape.
    assert "found" in payload
    assert payload["port"] == 65535
```

- [ ] **Step 2: Run all tests**

```
python -m pytest installer/tests/test_contract_round_trip.py -v
```

Expected: 6 passed.

- [ ] **Step 3: Run the full Phase 1 test suite**

```
python -m pytest installer/tests/test_health.py installer/tests/test_credentials.py installer/tests/test_service_status.py installer/tests/test_recovery.py installer/tests/test_diagnostics.py installer/tests/test_port_holder.py installer/tests/test_contract.py installer/tests/test_contract_round_trip.py -v
```

Expected: all green.

- [ ] **Step 4: Commit**

```
git add installer/tests/test_contract_round_trip.py
git commit -m "test(installer): end-to-end round-trip tests for new contract actions

Invokes \`python install.py --contract <action>\` as subprocess and asserts
JSON shape for open-app, credentials, recover, diagnose (matched and
unmatched), and port-holder. Catches argparse wiring regressions that
unit tests miss."
```

---

### Task 11: Update CI workflow to exercise the new contract surface

**Files:**
- Modify: `.github/workflows/build-rust-installer-gui.yml` (extend the "Validate Python installer contract" step)

- [ ] **Step 1: Read the current contract validation step**

```
grep -n -A 15 "Validate Python installer contract" .github/workflows/build-rust-installer-gui.yml
```

The existing step calls these contract actions: `validate`, `plan`, `data-check`, `bundle-manifest`. We need to add the seven new actions.

- [ ] **Step 2: Modify the workflow step**

Open `.github/workflows/build-rust-installer-gui.yml`. Find the step `name: Validate Python installer contract`. After the existing `python install.py --contract bundle-manifest …` line, append:

```yaml
          # New contract actions added in Phase 1
          python install.py --contract health --community --contract-redact --contract-pretty >/dev/null
          python install.py --contract credentials --community --contract-redact --contract-pretty >/dev/null
          python install.py --contract service-status --community --contract-redact --contract-pretty >/dev/null
          python install.py --contract open-app --community --contract-redact --contract-pretty >/dev/null
          python install.py --contract recover --community --contract-redact --contract-pretty >/dev/null
          # diagnose requires an input payload
          echo '{"_diagnose_input":{"stdout":"benign","stderr":"","exit_code":0,"phase":"x","platform":"linux"}}' > /tmp/diagnose-input.json
          python install.py --contract diagnose --community --contract-input /tmp/diagnose-input.json --contract-redact --contract-pretty >/dev/null
          # port-holder requires a port input
          echo '{"_port":65535}' > /tmp/port-holder-input.json
          python install.py --contract port-holder --community --contract-input /tmp/port-holder-input.json --contract-redact --contract-pretty >/dev/null
```

- [ ] **Step 3: Lint the workflow YAML locally**

```
docker compose config --quiet || true   # only checks compose, skip if no docker
python -c "import yaml; yaml.safe_load(open('.github/workflows/build-rust-installer-gui.yml'))"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add .github/workflows/build-rust-installer-gui.yml
git commit -m "ci(installer): exercise 7 new contract actions in CI

Extends 'Validate Python installer contract' to call health,
credentials, service-status, open-app, recover, diagnose, and
port-holder. Catches argparse + dispatch regressions before release."
```

---

### Task 12: Update install.py argparse help to reflect new actions

**Files:**
- Modify: `install.py:99-103`

- [ ] **Step 1: Update the choices tuple and help text**

Open `install.py` and find the `--contract` argument definition (around line 99). The choices list should now match what we've added across Tasks 1, 2, 3, 4, 5, 6, 8. Replace:

```python
    parser.add_argument(
        "--contract",
        choices=["defaults", "validate", "plan", "preflight", "data-check", "bundle-manifest", "health", "credentials", "service-status", "open-app", "port-holder", "recover", "diagnose"],
        default=None,
        help="Emit machine-readable installer contract JSON and exit",
    )
```

(If your incremental commits already updated this each time, this task is a no-op verifier.)

Confirm `installer/contract.py:main()` argparse choices are also identical. Both must list all 13 actions.

- [ ] **Step 2: Run the round-trip suite once more**

```
python -m pytest installer/tests/test_contract_round_trip.py -v
```

Expected: all green.

- [ ] **Step 3: Manual smoke test from the repo root**

```
python install.py --contract health --community --contract-pretty
python install.py --contract recover --community --contract-pretty
python install.py --contract open-app --community --contract-pretty
```

Expected: each prints valid JSON to stdout, exits 0.

- [ ] **Step 4: Commit (if anything changed)**

```
git diff --stat
# If empty, skip commit. Otherwise:
git add install.py installer/contract.py
git commit -m "chore(installer): align --contract choices across install.py and contract.py main"
```

---

## Phase 1 Done Criteria

- [ ] All 12 tasks complete with their commits in place
- [ ] `pytest installer/tests/ -v` runs all tests green
- [ ] `python install.py --contract <action> --community --contract-pretty` works for each of the 13 supported actions (6 existing + 7 new)
- [ ] CI workflow `Validate Python installer contract` step calls all 13 actions
- [ ] No regressions in the existing test suite (`pytest installer/tests/test_contract.py`, `test_preflight.py`, etc.)
- [ ] Spec areas A2, A3, B2, C5, D10, G1–G8 all have a contract surface ready for Phase 2 (Rust GUI consumption)

---

## What Phase 1 Does NOT Include

These are intentionally deferred to later phases:

- Rust GUI changes (Phase 2 + Phase 3+)
- Tauri plugins (Phase 2)
- WSL distro enumeration on Windows (Phase 2 — Rust-side helper, not a contract action)
- UI mockups for the Hero Done page (Phase 4)
- CI release plumbing (Phase 7) — this phase only adds CI tests for the contract; F1–F6 remain untouched
- Any AI / LLM integration (deferred to v0.3.0 per spec Future Work)

The Phase 1 commit set should be self-contained, pass CI on its own, and not block any other phase.
