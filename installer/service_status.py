"""Docker Compose service status collector.

Wraps `docker compose ps --format json` and normalizes output for UI shells.
Handles two output formats:
- Modern Compose (>= v2.21) emits a single JSON array
- Older Compose emits newline-delimited JSON objects (NDJSON)
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

    entries = _parse_compose_ps_output(stdout)
    services: list[dict[str, str]] = []
    for entry in entries:
        if not isinstance(entry, dict):
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


def _parse_compose_ps_output(stdout: str) -> list[Any]:
    """Parse `docker compose ps --format json` output.

    Modern Compose (>= v2.21) emits a single JSON array. Older Compose emits
    newline-delimited JSON objects. Try array first; fall back to NDJSON.
    """
    stripped = stdout.strip()
    if not stripped:
        return []
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    except json.JSONDecodeError:
        pass
    # Fall back to NDJSON line-by-line for older Compose versions
    entries: list[Any] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def _run_compose_ps() -> tuple[int, str, str]:
    """Indirection seam for tests.

    Catches FileNotFoundError so a missing `docker` binary is reported via
    the same exit-code-127 channel as a runtime "command not found", letting
    callers handle it without a top-level exception.
    """
    try:
        proc = subprocess.run(
            ["docker", "compose", "ps", "--format", "json"],
            capture_output=True,
            text=True,
            check=False,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError as err:
        return 127, "", f"docker: command not found ({err})"
