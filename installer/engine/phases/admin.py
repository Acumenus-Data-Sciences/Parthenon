# installer/engine/phases/admin.py
from __future__ import annotations

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils


def _check_seed_admin(ctx: Context) -> bool:
    result = utils.exec_php(
        "php artisan tinker --execute=\"echo App\\\\Models\\\\User::where('email', config('app.admin_email'))->exists() ? '1' : '0';\" --no-ansi 2>&1",
        check=False,
    )
    return result.stdout.strip() == "1"


def _run_seed_admin(ctx: Context) -> None:
    ctx.emit("Creating admin account…")
    result = utils.exec_php(
        "php artisan admin:seed --no-ansi 2>&1", check=False
    )
    if result.returncode != 0:
        raise StepError(f"Admin seed failed:\n{result.stdout}")
    ctx.emit("Admin account created")


def _check_export_credentials(ctx: Context) -> bool:
    return False  # always export so Acropolis can read them


def _run_export_credentials(ctx: Context) -> None:
    creds_path = utils.REPO_ROOT / ".install-credentials"
    keys = ["DB_PASSWORD", "REDIS_PASSWORD", "APP_KEY", "ADMIN_PASSWORD"]
    ctx.secrets.export_credentials_file(creds_path, keys)
    ctx.emit(f"Credentials written to {creds_path} (chmod 600)")


PHASE = Phase(
    id="admin",
    name="Admin Account",
    steps=[
        Step(id="admin.seed_admin", name="Create admin account",
             run=_run_seed_admin, check=_check_seed_admin),
        Step(id="admin.export_credentials", name="Export credentials file",
             run=_run_export_credentials, check=_check_export_credentials),
    ],
)
