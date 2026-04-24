# installer/engine/phases/preflight.py
from __future__ import annotations

import re
import subprocess

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
    m = re.search(r"(\d+)\.\d+", version)
    if not m:
        raise StepError(f"Cannot parse Docker version: {version!r}")
    major = int(m.group(1))
    if major < 24:
        raise StepError(f"Docker {version} is too old. Version 24+ is required.")
    ctx.emit(f"Docker {version} — OK")


def _run_check_compose(ctx: Context) -> None:
    version = utils.docker_compose_version()
    if version is None:
        raise StepError("Docker Compose v2 is not available. Update Docker Desktop.")
    m = re.search(r"v?(\d+)\.\d+", version)
    if not m or int(m.group(1)) < 2:
        raise StepError(f"Docker Compose {version} is v1 or unrecognized. Compose v2+ is required.")
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
