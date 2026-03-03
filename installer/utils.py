"""Utility helpers: subprocess execution, OS detection, port/disk checks."""
from __future__ import annotations

import os
import platform
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).parent.parent


# ---------------------------------------------------------------------------
# OS detection
# ---------------------------------------------------------------------------

def os_name() -> str:
    """Return 'macOS', 'Linux', or 'Windows'."""
    s = platform.system()
    if s == "Darwin":
        return "macOS"
    if s == "Windows":
        return "Windows"
    return "Linux"


def is_windows() -> bool:
    return platform.system() == "Windows"


# ---------------------------------------------------------------------------
# Subprocess helpers
# ---------------------------------------------------------------------------

def run(
    cmd: list[str],
    *,
    capture: bool = False,
    check: bool = True,
    cwd: Optional[Path] = None,
    env: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    """Run a command, optionally capturing output."""
    merged_env = None
    if env is not None:
        merged_env = {**os.environ, **env}
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
        cwd=cwd or REPO_ROOT,
        env=merged_env,
    )


def run_stream(cmd: list[str], *, cwd: Optional[Path] = None) -> int:
    """Run a command streaming stdout/stderr; return exit code."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=cwd or REPO_ROOT,
    )
    for line in proc.stdout:  # type: ignore[union-attr]
        print(line, end="", flush=True)
    proc.wait()
    return proc.returncode


def docker_compose(args: list[str], *, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    """Run `docker compose <args>` in the repo root."""
    return run(["docker", "compose", *args], capture=capture, check=check, cwd=REPO_ROOT)


def exec_php(cmd: str, *, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command inside the parthenon-php container (non-interactive)."""
    return run(["docker", "compose", "exec", "-T", "php", *cmd.split()], check=check, cwd=REPO_ROOT)


def exec_pg(cmd: str, *, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command inside the parthenon-postgres container."""
    return run(["docker", "compose", "exec", "-T", "postgres", *cmd.split()], check=check, cwd=REPO_ROOT)


def exec_node(cmd: str, *, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command inside the parthenon-node container."""
    return run(["docker", "compose", "exec", "-T", "node", "sh", "-c", cmd], check=check, cwd=REPO_ROOT)


# ---------------------------------------------------------------------------
# Port / disk helpers
# ---------------------------------------------------------------------------

def is_port_free(port: int) -> bool:
    """Return True if the TCP port is not bound on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        try:
            s.connect(("127.0.0.1", port))
            return False  # something answered
        except (ConnectionRefusedError, OSError):
            return True


def free_disk_gb(path: Path = REPO_ROOT) -> float:
    """Return free disk space in GB for the filesystem containing *path*."""
    usage = shutil.disk_usage(path)
    return usage.free / (1024 ** 3)


# ---------------------------------------------------------------------------
# Docker helpers
# ---------------------------------------------------------------------------

def docker_binary() -> Optional[str]:
    return shutil.which("docker") or (shutil.which("docker.exe") if is_windows() else None)


def docker_version() -> Optional[str]:
    """Return docker version string or None if not found."""
    try:
        result = run(["docker", "--version"], capture=True, check=True)
        return result.stdout.strip()
    except Exception:
        return None


def docker_compose_version() -> Optional[str]:
    try:
        result = run(["docker", "compose", "version"], capture=True, check=True)
        return result.stdout.strip()
    except Exception:
        return None


def docker_daemon_running() -> bool:
    try:
        run(["docker", "info"], capture=True, check=True)
        return True
    except Exception:
        return False


def container_health(name: str) -> str:
    """Return health status string: 'healthy', 'unhealthy', 'starting', 'running', or 'unknown'."""
    try:
        result = run(
            ["docker", "inspect", "--format={{.State.Health.Status}}", name],
            capture=True,
            check=True,
        )
        status = result.stdout.strip()
        if status:
            return status
        # No healthcheck — fall back to running state
        result2 = run(
            ["docker", "inspect", "--format={{.State.Status}}", name],
            capture=True,
            check=True,
        )
        return result2.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def container_exists(name: str) -> bool:
    try:
        result = run(
            ["docker", "inspect", "--format={{.Name}}", name],
            capture=True,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Linux docker-group check
# ---------------------------------------------------------------------------

def user_in_docker_group() -> bool:
    """Return True if current user is in the docker group (Linux only)."""
    if is_windows() or platform.system() == "Darwin":
        return True
    try:
        import grp
        docker_gid = grp.getgrnam("docker").gr_gid
        return docker_gid in os.getgroups()
    except Exception:
        return False
