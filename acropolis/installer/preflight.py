# installer/preflight.py
"""Phase 1: Preflight checks — validate environment readiness."""
from __future__ import annotations

import sys
from typing import NamedTuple

from rich.console import Console
from rich.table import Table

from acropolis.installer.utils import (
    docker_compose_version,
    docker_daemon_running,
    docker_version,
    free_disk_gb,
    is_port_free,
    os_name,
    user_in_docker_group,
)


class CheckResult(NamedTuple):
    name: str
    status: str  # ok, warn, fail
    detail: str


# Base ports required by all editions
BASE_PORTS = [80, 443, 8090]

# Additional ports by edition tier
EDITION_PORTS: dict[str, list[int]] = {
    "community": [9443, 5050],
    "enterprise": [5678, 8088, 9002, 9042, 9000, 3306, 9200, 9092],
}


def check_python_version() -> CheckResult:
    ver = sys.version_info
    if ver >= (3, 9):
        return CheckResult("Python version", "ok", f"{ver.major}.{ver.minor}.{ver.micro}")
    return CheckResult("Python version", "fail", f"{ver.major}.{ver.minor} (need >= 3.9)")


def check_docker_version() -> CheckResult:
    ver = docker_version()
    if ver is None:
        return CheckResult("Docker", "fail", "Not installed")
    major = int(ver.split(".")[0])
    if major >= 24:
        return CheckResult("Docker", "ok", f"v{ver}")
    return CheckResult("Docker", "fail", f"v{ver} (need >= 24.0)")


def check_docker_compose() -> CheckResult:
    ver = docker_compose_version()
    if ver is None:
        return CheckResult("Docker Compose v2", "fail", "Not installed")
    return CheckResult("Docker Compose v2", "ok", f"v{ver}")


def check_docker_daemon() -> CheckResult:
    if docker_daemon_running():
        return CheckResult("Docker daemon", "ok", "Running")
    return CheckResult("Docker daemon", "fail", "Not running")


def check_docker_group() -> CheckResult:
    if os_name() != "Linux":
        return CheckResult("Docker group", "ok", f"N/A ({os_name()})")
    if user_in_docker_group():
        return CheckResult("Docker group", "ok", "User in docker group")
    return CheckResult(
        "Docker group",
        "warn",
        "User not in docker group. Run: sudo usermod -aG docker $USER && newgrp docker",
    )


def check_disk_space() -> CheckResult:
    gb = free_disk_gb()
    if gb >= 10:
        return CheckResult("Disk space", "ok", f"{gb:.1f} GB free")
    if gb >= 5:
        return CheckResult("Disk space", "warn", f"{gb:.1f} GB free (10 GB recommended)")
    return CheckResult("Disk space", "fail", f"{gb:.1f} GB free (need >= 5 GB)")


def check_ports_free(ports: list[int]) -> CheckResult:
    busy = [p for p in ports if not is_port_free(p)]
    if not busy:
        return CheckResult("Required ports", "ok", f"All {len(ports)} ports available")
    return CheckResult(
        "Required ports",
        "fail",
        f"Ports in use: {', '.join(str(p) for p in busy)}",
    )


def run_preflight() -> list[CheckResult]:
    """Run all base preflight checks. Returns list of results."""
    return [
        check_python_version(),
        check_docker_version(),
        check_docker_compose(),
        check_docker_daemon(),
        check_docker_group(),
        check_disk_space(),
        check_ports_free(BASE_PORTS),
    ]


def run_edition_port_check(tier: str) -> CheckResult:
    """Run supplemental port check for a specific edition tier."""
    extra_ports = EDITION_PORTS.get(tier, [])
    if not extra_ports:
        return CheckResult(f"{tier} ports", "ok", "No additional ports required")
    return check_ports_free(extra_ports)


def display_results(results: list[CheckResult], console: Console) -> None:
    """Display preflight results as a Rich table."""
    table = Table(title="Preflight Checks", show_lines=True)
    table.add_column("Check", style="bold")
    table.add_column("Status")
    table.add_column("Detail")

    status_styles = {"ok": "[green]PASS[/]", "warn": "[yellow]WARN[/]", "fail": "[red]FAIL[/]"}

    for r in results:
        table.add_row(r.name, status_styles.get(r.status, r.status), r.detail)

    console.print(table)


def has_failures(results: list[CheckResult]) -> bool:
    """Return True if any check has status 'fail'."""
    return any(r.status == "fail" for r in results)


def has_warnings(results: list[CheckResult]) -> bool:
    """Return True if any check has status 'warn'."""
    return any(r.status == "warn" for r in results)
