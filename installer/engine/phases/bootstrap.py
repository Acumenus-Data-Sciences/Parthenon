# installer/engine/phases/bootstrap.py
from __future__ import annotations

import subprocess

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT


def _exec_php(cmd: str) -> subprocess.CompletedProcess:
    return utils.exec_php(cmd, check=False)


def _check_composer_install(ctx: Context) -> bool:
    return (ROOT / "backend" / "vendor").is_dir()


def _run_composer_install(ctx: Context) -> None:
    ctx.emit("Running composer install…")
    result = _exec_php("composer install --no-interaction --optimize-autoloader 2>&1")
    if result.returncode != 0:
        raise StepError(f"composer install failed:\n{result.stdout}")
    ctx.emit("composer install — done")


def _check_generate_app_key(ctx: Context) -> bool:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return False
    content = env_path.read_text()
    return "APP_KEY=base64:" in content


def _run_generate_app_key(ctx: Context) -> None:
    result = _exec_php("php artisan key:generate --force 2>&1")
    if result.returncode != 0:
        raise StepError(f"artisan key:generate failed:\n{result.stdout}")
    ctx.emit("APP_KEY generated")


def _check_run_migrations(ctx: Context) -> bool:
    result = _exec_php("php artisan migrate:status --no-ansi 2>&1")
    if result.returncode != 0:
        return False
    return "Pending" not in result.stdout and result.stdout.strip() != ""


def _run_run_migrations(ctx: Context) -> None:
    ctx.emit("Running database migrations…")
    result = _exec_php("php artisan migrate --force --no-ansi 2>&1")
    if result.returncode != 0:
        raise StepError(f"artisan migrate failed:\n{result.stdout}")
    ctx.emit("Migrations complete")


def _check_run_seeders(ctx: Context) -> bool:
    result = _exec_php(
        "php artisan tinker --execute=\"echo DB::table('app.roles')->count();\" --no-ansi 2>&1"
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_run_seeders(ctx: Context) -> None:
    ctx.emit("Seeding database…")
    result = _exec_php("php artisan db:seed --force --no-ansi 2>&1")
    if result.returncode != 0:
        raise StepError(f"artisan db:seed failed:\n{result.stdout}")
    ctx.emit("Seeding complete")


def _check_fix_permissions(ctx: Context) -> bool:
    storage = ROOT / "backend" / "storage"
    return storage.is_dir() and utils.run(
        ["test", "-w", str(storage)], capture=True, check=False
    ).returncode == 0


def _run_fix_permissions(ctx: Context) -> None:
    result = _exec_php(
        "chown -R www-data:www-data storage bootstrap/cache && chmod -R 775 storage bootstrap/cache 2>&1"
    )
    if result.returncode != 0:
        raise StepError(f"Permission fix failed:\n{result.stdout}")
    ctx.emit("Storage permissions set")


def _check_verify_postgis(ctx: Context) -> bool:
    result = _exec_php(
        "php artisan tinker --execute=\"echo DB::select(\\\"SELECT COUNT(*) FROM pg_extension WHERE extname='postgis'\\\")[0]->count;\" --no-ansi 2>&1"
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_verify_postgis(ctx: Context) -> None:
    result = _exec_php(
        "php artisan tinker --execute=\"DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');\" --no-ansi 2>&1"
    )
    if result.returncode != 0:
        raise StepError(f"PostGIS extension could not be enabled:\n{result.stdout}")
    ctx.emit("PostGIS extension verified")


PHASE = Phase(
    id="bootstrap",
    name="Laravel Bootstrap",
    steps=[
        Step(id="bootstrap.composer_install", name="Install Composer dependencies",
             run=_run_composer_install, check=_check_composer_install),
        Step(id="bootstrap.generate_app_key", name="Generate APP_KEY",
             run=_run_generate_app_key, check=_check_generate_app_key),
        Step(id="bootstrap.run_migrations", name="Run database migrations",
             run=_run_run_migrations, check=_check_run_migrations),
        Step(id="bootstrap.run_seeders", name="Seed database",
             run=_run_run_seeders, check=_check_run_seeders),
        Step(id="bootstrap.fix_permissions", name="Fix storage permissions",
             run=_run_fix_permissions, check=_check_fix_permissions),
        Step(id="bootstrap.verify_postgis", name="Verify PostGIS extension",
             run=_run_verify_postgis, check=_check_verify_postgis),
    ],
)
