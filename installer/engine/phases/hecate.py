# installer/engine/phases/hecate.py
from __future__ import annotations

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import hecate_bootstrap, utils

ROOT = utils.REPO_ROOT


def _check_fetch_assets(ctx: Context) -> bool:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("enable_hecate"):
        return True  # not enabled — treat as already done
    return not hecate_bootstrap.required_missing(root=ROOT)


def _run_fetch_assets(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("enable_hecate"):
        ctx.emit("Hecate not enabled — skipping")
        return
    try:
        hecate_bootstrap.ensure(resolved)
    except Exception as exc:
        raise StepError(f"Hecate asset fetch failed: {exc}") from exc
    ctx.emit("Hecate assets fetched and validated")


def _check_extract_assets(ctx: Context) -> bool:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("enable_hecate"):
        return True
    return not hecate_bootstrap.required_missing(root=ROOT)


def _run_extract_assets(ctx: Context) -> None:
    resolved = ctx.config.get("resolved", {})
    if not resolved.get("enable_hecate"):
        ctx.emit("Hecate not enabled — skipping extraction")
        return
    # ensure() is idempotent; if files already extracted it returns early
    try:
        hecate_bootstrap.ensure(resolved)
    except Exception as exc:
        raise StepError(f"Hecate extraction failed: {exc}") from exc
    ctx.emit("Hecate assets extracted")


PHASE = Phase(
    id="hecate",
    name="Hecate Bootstrap",
    steps=[
        Step(id="hecate.fetch_assets", name="Fetch Hecate vector DB assets",
             run=_run_fetch_assets, check=_check_fetch_assets),
        Step(id="hecate.extract_assets", name="Extract Hecate assets",
             run=_run_extract_assets, check=_check_extract_assets),
    ],
)
