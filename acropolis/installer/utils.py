"""Shared utilities for the Acropolis infrastructure installer."""
from __future__ import annotations

import os
import platform
import secrets
import shutil
import socket
import string
import subprocess
from pathlib import Path
from typing import Optional


# acropolis/ directory (where infrastructure compose files live)
ACROPOLIS_ROOT = Path(__file__).resolve().parent.parent

# Parthenon project root (parent of acropolis/)
PARTHENON_ROOT = ACROPOLIS_ROOT.parent

# Legacy alias — some modules reference REPO_ROOT for acropolis-specific paths
REPO_ROOT = ACROPOLIS_ROOT


def os_name() -> str:
    """Return 'Linux', 'macOS', or 'Windows'."""
    system = platform.system()
    if system == "Darwin":
        return "macOS"
    return system


def run(
    cmd: list[str],
    *,
    capture: bool = True,
    cwd: Optional[Path] = None,
    check: bool = False,
) -> subprocess.CompletedProcess:
    """Run a subprocess command."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        cwd=cwd or ACROPOLIS_ROOT,
        check=check,
    )


def run_stream(cmd: list[str], *, cwd: Optional[Path] = None) -> int:
    """Run a command and stream output line-by-line. Returns exit code."""
    with subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=cwd or ACROPOLIS_ROOT,
    ) as proc:
        if proc.stdout:
            for line in proc.stdout:
                print(line, end="")
        return proc.wait()


def docker_compose(
    *args: str, cwd: Optional[Path] = None, capture: bool = True
) -> subprocess.CompletedProcess:
    """Run a docker compose command."""
    return run(["docker", "compose", *args], capture=capture, cwd=cwd)


def exec_in_container(
    container: str, cmd: list[str], *, capture: bool = True
) -> subprocess.CompletedProcess:
    """Execute a command inside a running container."""
    return run(
        ["docker", "exec", container, *cmd],
        capture=capture,
    )


def is_port_free(port: int) -> bool:
    """Check if a TCP port is available on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        result = s.connect_ex(("127.0.0.1", port))
        # connect_ex returns 0 if connection succeeded (port in use)
        return result != 0


def free_disk_gb(path: Optional[Path] = None) -> float:
    """Return available disk space in GB."""
    usage = shutil.disk_usage(path or PARTHENON_ROOT)
    return usage.free / (1024**3)


def docker_version() -> Optional[str]:
    """Return Docker version string or None."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split()
            version = parts[2].rstrip(",") if len(parts) >= 3 else None
            return version
    except FileNotFoundError:
        pass
    return None


def docker_compose_version() -> Optional[str]:
    """Return Docker Compose version string or None."""
    try:
        result = subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split()
            version = parts[-1].lstrip("v") if parts else None
            return version
    except FileNotFoundError:
        pass
    return None


def docker_daemon_running() -> bool:
    """Check if Docker daemon is running."""
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def container_health(container_name: str) -> str:
    """Return container health status: healthy, unhealthy, running, unknown."""
    try:
        result = subprocess.run(
            [
                "docker",
                "inspect",
                "--format",
                "{{.State.Health.Status}}",
                container_name,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            status = result.stdout.strip()
            return status if status else "running"
        return "unknown"
    except FileNotFoundError:
        return "unknown"


def wait_healthy(container_name: str, timeout: int = 60) -> bool:
    """Poll container until healthy or timeout. Returns True if healthy."""
    import time

    start = time.monotonic()
    while time.monotonic() - start < timeout:
        status = container_health(container_name)
        if status == "healthy":
            return True
        if status == "unhealthy":
            return False
        time.sleep(2)
    return False


def container_exists(container_name: str) -> bool:
    """Check if a container exists (running or stopped)."""
    result = run(
        ["docker", "ps", "-a", "--format", "{{.Names}}", "--filter", f"name=^{container_name}$"]
    )
    return container_name in result.stdout


def user_in_docker_group() -> bool:
    """Check if current user is in the docker group (Linux only)."""
    if os_name() != "Linux":
        return True
    try:
        result = subprocess.run(["groups"], capture_output=True, text=True)
        return "docker" in result.stdout.split()
    except FileNotFoundError:
        return False


def generate_password(length: int = 24) -> str:
    """Generate a random alphanumeric password with - and _."""
    alphabet = string.ascii_letters + string.digits + "-_"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def network_exists(network_name: str) -> bool:
    """Check if a Docker network exists."""
    result = run(["docker", "network", "inspect", network_name])
    return result.returncode == 0


def create_network(network_name: str) -> bool:
    """Create a Docker bridge network. Returns True on success."""
    result = run(["docker", "network", "create", network_name])
    return result.returncode == 0


def remove_network(network_name: str) -> bool:
    """Remove a Docker network. Returns True on success."""
    result = run(["docker", "network", "rm", network_name])
    return result.returncode == 0


def connect_container_to_network(container: str, network: str) -> bool:
    """Connect a running container to a network."""
    result = run(["docker", "network", "connect", network, container])
    return result.returncode == 0


def disconnect_container_from_network(container: str, network: str) -> bool:
    """Disconnect a container from a network."""
    result = run(["docker", "network", "disconnect", network, container])
    return result.returncode == 0


def containers_on_network(network_name: str) -> list[str]:
    """List container names connected to a Docker network."""
    result = run(
        [
            "docker",
            "network",
            "inspect",
            "--format",
            "{{range .Containers}}{{.Name}} {{end}}",
            network_name,
        ]
    )
    if result.returncode != 0:
        return []
    return result.stdout.strip().split()
