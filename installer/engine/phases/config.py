# installer/engine/phases/config.py
from __future__ import annotations

from pathlib import Path
from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import config as cfg_module, utils

ROOT = utils.REPO_ROOT


def _check_gather(ctx: Context) -> bool:
    return False  # always re-evaluate; pre_seed may change


def _run_gather(ctx: Context) -> None:
    pre_seed = ctx.config.get("pre_seed", {})
    non_interactive = ctx.config.get("non_interactive", False)
    try:
        resolved = cfg_module.collect(
            resume_data=pre_seed,
            non_interactive=non_interactive,
        )
    except Exception as exc:
        raise StepError(f"Config gathering failed: {exc}") from exc
    ctx.config["resolved"] = resolved
    ctx.emit(f"Config gathered — edition={resolved.get('PARTHENON_EDITION', 'community')}")


def _check_write_env(ctx: Context) -> bool:
    env_file = ROOT / "backend" / ".env"
    return env_file.exists() and "APP_KEY=" in env_file.read_text()


def _run_write_env(ctx: Context) -> None:
    resolved = ctx.config.get("resolved")
    if resolved is None:
        raise StepError("Config not gathered — run config.gather first")
    try:
        cfg_module.write(resolved, confirm=False)
    except Exception as exc:
        raise StepError(f"Writing .env files failed: {exc}") from exc
    ctx.emit("Written: .env, backend/.env")


def _check_store_secrets(ctx: Context) -> bool:
    return ctx.secrets.get("DB_PASSWORD") is not None


def _run_store_secrets(ctx: Context) -> None:
    resolved = ctx.config.get("resolved")
    if resolved is None:
        raise StepError("Config not gathered — run config.gather first")
    secret_keys = ["DB_PASSWORD", "REDIS_PASSWORD", "APP_KEY", "ADMIN_PASSWORD"]
    stored = 0
    for key in secret_keys:
        value = resolved.get(key)
        if value is not None:
            ctx.secrets.set(key, value)
            stored += 1
    ctx.emit(f"Stored {stored} secrets in OS keychain")


PHASE = Phase(
    id="config",
    name="Configuration",
    steps=[
        Step(id="config.gather", name="Gather configuration",
             run=_run_gather, check=_check_gather),
        Step(id="config.write_env", name="Write .env files",
             run=_run_write_env, check=_check_write_env),
        Step(id="config.store_secrets", name="Store secrets in OS keychain",
             run=_run_store_secrets, check=_check_store_secrets),
    ],
)
