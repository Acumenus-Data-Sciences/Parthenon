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
    """Indirection seam for tests.

    Catches FileNotFoundError so a missing binary (lsof / ss / netstat /
    tasklist) is reported via the same exit-code-127 channel as a runtime
    "command not found", which lets the platform-specific dispatchers fall
    through to the next probe instead of bubbling an exception.
    """
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError as err:
        return 127, "", str(err)
