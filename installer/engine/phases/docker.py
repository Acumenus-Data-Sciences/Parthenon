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
    return bool(statuses) and all(s in ("healthy", "") for s in statuses)


def _run_wait_healthy(ctx: Context) -> None:
    deadline = time.monotonic() + HEALTH_TIMEOUT_S
    while time.monotonic() < deadline:
        result = subprocess.run(
            ["docker", "compose", "ps", "--format", "{{.Name}}\t{{.Health}}"],
            capture_output=True, text=True, cwd=ROOT,
        )
        lines = [ln for ln in result.stdout.splitlines() if ln.strip()]
        unhealthy = [ln for ln in lines if "unhealthy" in ln or "starting" in ln]
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
