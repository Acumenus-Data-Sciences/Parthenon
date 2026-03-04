"""Phase 1 — Preflight checks.

Verifies Python version, Docker availability, open ports, disk space,
and the presence of an existing installation before proceeding.
"""
from __future__ import annotations

import sys
from typing import NamedTuple

from rich.console import Console
from rich.table import Table

from . import utils

console = Console()

REQUIRED_PORTS = [8082, 5480, 6381, 8002, 8787]
MIN_DISK_GB = 5.0


class CheckResult(NamedTuple):
    name: str
    status: str   # "ok", "warn", "fail"
    detail: str


def _check_python() -> CheckResult:
    v = sys.version_info
    if v >= (3, 9):
        return CheckResult("Python ≥ 3.9", "ok", f"{v.major}.{v.minor}.{v.micro}")
    return CheckResult("Python ≥ 3.9", "fail", f"{v.major}.{v.minor}.{v.micro} (need ≥ 3.9)")


def _check_os() -> CheckResult:
    name = utils.os_name()
    return CheckResult("Operating system", "ok", name)


def _check_docker_version() -> CheckResult:
    ver = utils.docker_version()
    if ver is None:
        return CheckResult(
            "Docker ≥ 24.0",
            "fail",
            "docker not found — install from https://docs.docker.com/get-docker/",
        )
    # Try to parse version number
    try:
        token = ver.split()[2].rstrip(",")  # "Docker version 24.0.6, build ..."
        major = int(token.split(".")[0])
        if major >= 24:
            return CheckResult("Docker ≥ 24.0", "ok", ver.split()[2].rstrip(","))
        return CheckResult("Docker ≥ 24.0", "warn", f"{token} (recommend ≥ 24.0)")
    except Exception:
        return CheckResult("Docker ≥ 24.0", "ok", ver)


def _check_compose() -> CheckResult:
    ver = utils.docker_compose_version()
    if ver is None:
        return CheckResult(
            "Docker Compose v2",
            "fail",
            "docker compose not found — update Docker or install plugin",
        )
    # `docker compose version` returning *any* string means the v2 Go plugin is
    # present.  The plugin version number can be >= 2 (e.g. v5.x) — do not
    # compare it against the string "v2" or "2." which would false-positive.
    # Only warn if the standalone docker-compose v1 Python script is all that's
    # available (that would show up as `docker-compose version 1.x`).
    version_tag = ver.split()[-1]  # e.g. "v5.1.0"
    try:
        major = int(version_tag.lstrip("v").split(".")[0])
        if major >= 2:
            return CheckResult("Docker Compose v2", "ok", version_tag)
        return CheckResult("Docker Compose v2", "warn", f"v1 detected ({version_tag}) — upgrade recommended")
    except (ValueError, IndexError):
        return CheckResult("Docker Compose v2", "ok", version_tag)


def _check_daemon() -> CheckResult:
    if utils.docker_daemon_running():
        return CheckResult("Docker daemon", "ok", "running")
    return CheckResult("Docker daemon", "fail", "not running — start Docker Desktop or `sudo systemctl start docker`")


def _check_docker_group() -> CheckResult:
    if utils.os_name() != "Linux":
        return CheckResult("Linux docker group", "ok", "N/A")
    if utils.user_in_docker_group():
        return CheckResult("Linux docker group", "ok", "user is in docker group")
    return CheckResult(
        "Linux docker group",
        "warn",
        "user not in docker group — you may need `sudo` or run: sudo usermod -aG docker $USER",
    )


def _check_ports() -> list[CheckResult]:
    results = []
    for port in REQUIRED_PORTS:
        if utils.is_port_free(port):
            results.append(CheckResult(f"Port {port} free", "ok", "available"))
        else:
            results.append(CheckResult(f"Port {port} free", "fail", f"port {port} is in use — stop the process using it or change port in .env"))
    return results


def _check_disk() -> CheckResult:
    free = utils.free_disk_gb()
    if free >= MIN_DISK_GB:
        return CheckResult("Disk space ≥ 5 GB", "ok", f"{free:.1f} GB free")
    return CheckResult("Disk space ≥ 5 GB", "fail", f"only {free:.1f} GB free — need at least {MIN_DISK_GB} GB")


def _check_repo() -> CheckResult:
    compose = utils.REPO_ROOT / "docker-compose.yml"
    if compose.exists():
        return CheckResult("Repo complete", "ok", str(utils.REPO_ROOT))
    return CheckResult("Repo complete", "fail", "docker-compose.yml not found — run from Parthenon repo root")


def _check_existing_install() -> CheckResult:
    if utils.container_exists("parthenon-nginx"):
        return CheckResult(
            "Existing install",
            "warn",
            "parthenon-nginx container detected — re-install will overwrite configuration",
        )
    return CheckResult("Existing install", "ok", "none detected")


def run_checks() -> list[CheckResult]:
    """Run all preflight checks and return the results."""
    checks: list[CheckResult] = []
    checks.append(_check_python())
    checks.append(_check_os())
    checks.append(_check_docker_version())
    checks.append(_check_compose())
    checks.append(_check_daemon())
    checks.append(_check_docker_group())
    checks.extend(_check_ports())
    checks.append(_check_disk())
    checks.append(_check_repo())
    checks.append(_check_existing_install())
    return checks


def display_results(checks: list[CheckResult]) -> None:
    table = Table(title="Preflight Checks", show_header=True, header_style="bold cyan")
    table.add_column("Check", style="white")
    table.add_column("Status", justify="center")
    table.add_column("Detail", style="dim")

    icons = {"ok": "[green]✓[/green]", "warn": "[yellow]⚠[/yellow]", "fail": "[red]✗[/red]"}

    for check in checks:
        table.add_row(check.name, icons[check.status], check.detail)

    console.print(table)


def assert_no_failures(checks: list[CheckResult]) -> None:
    """Exit if any check is a hard failure."""
    failures = [c for c in checks if c.status == "fail"]
    if failures:
        console.print(f"\n[red]✗ {len(failures)} preflight check(s) failed. Fix the issues above and retry.[/red]")
        sys.exit(1)


def run(*, interactive: bool = True) -> list[CheckResult]:
    """Execute preflight phase. Returns checks list."""
    console.rule("[bold]Phase 1 — Preflight Checks[/bold]")
    checks = run_checks()
    display_results(checks)
    assert_no_failures(checks)

    # If existing install detected, ask to continue
    existing = next((c for c in checks if c.name == "Existing install" and c.status == "warn"), None)
    if existing and interactive:
        import questionary
        ok = questionary.confirm(
            "An existing Parthenon install was detected. Continue anyway (may overwrite config)?",
            default=False,
        ).ask()
        if not ok:
            console.print("[yellow]Install cancelled.[/yellow]")
            sys.exit(0)

    console.print("[green]✓ All preflight checks passed.[/green]\n")
    return checks
