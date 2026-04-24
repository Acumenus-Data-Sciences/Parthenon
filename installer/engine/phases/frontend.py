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
