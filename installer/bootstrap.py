"""Phase 4 — Laravel Bootstrap & Phase 7 — Admin Account.

Runs artisan commands inside the PHP container:
  - key:generate
  - migrate
  - db:seed
  - admin:create (non-interactive)
"""
from __future__ import annotations

import sys

from rich.console import Console

from . import utils

console = Console()


def _step(label: str, cmd: str) -> None:
    console.print(f"  [cyan]▶[/cyan] {label}…", end=" ")
    result = utils.exec_php(cmd, check=False)
    if result.returncode == 0:
        console.print("[green]done[/green]")
    else:
        console.print("[red]FAILED[/red]")
        if result.stdout:
            console.print(result.stdout)
        if result.stderr:
            console.print(result.stderr)
        sys.exit(1)


def run_laravel_bootstrap() -> None:
    """Phase 4: composer install, key:generate, container reload, migrate, seed, permissions."""
    console.rule("[bold]Phase 4 — Laravel Bootstrap[/bold]")

    # Step 1 — composer install
    # The PHP Dockerfile installs vendor/ into the image, but docker-compose bind-mounts
    # ./backend:/var/www/html at runtime, which shadows the image's vendor/. On a fresh
    # clone the host backend/vendor/ doesn't exist, so artisan fails immediately.
    console.print("[bold]Step 1/7:[/bold] Installing PHP dependencies (composer install)…")
    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php",
         "composer", "install", "--no-dev", "--optimize-autoloader", "--no-interaction"]
    )
    if rc != 0:
        console.print("[red]composer install failed.[/red]")
        sys.exit(1)

    # Step 2 — key:generate (skip if already set — re-generating would invalidate
    # encrypted DB data if Phase 4 is being resumed after a partial run).
    env_path = utils.REPO_ROOT / "backend" / ".env"
    existing_key = ""
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("APP_KEY=base64:"):
                existing_key = line.split("=", 1)[1]
                break

    if existing_key:
        console.print("[bold]Step 2/7:[/bold] Application key already set — skipping key:generate.")
    else:
        console.print("[bold]Step 2/7:[/bold] Generating application key…")
        result = utils.run(
            ["docker", "compose", "exec", "-T", "php",
             "php", "artisan", "key:generate", "--force"],
            capture=True, check=False
        )
        if result.returncode != 0:
            console.print(f"[red]key:generate failed:[/red]\n{result.stderr}")
            sys.exit(1)

    # Step 3 — recreate php container + wait healthy
    # docker compose restart does NOT reload env_file. Container recreation (up -d)
    # re-reads backend/.env so the new APP_KEY is in the process environment.
    # Without this, db:seed fails with "No application encryption key has been specified."
    console.print("[bold]Step 3/7:[/bold] Reloading PHP container (picks up new APP_KEY)…")
    rc = utils.run_stream(["docker", "compose", "up", "-d", "php"])
    if rc != 0:
        console.print("[red]Failed to recreate php container.[/red]")
        sys.exit(1)

    console.print("  Waiting for PHP-FPM to be healthy…")
    if not utils.wait_healthy("parthenon-php", timeout_s=90):
        console.print("[red]PHP container did not become healthy within 90 seconds.[/red]")
        sys.exit(1)

    # Clear any stale config cache that might hold the old empty APP_KEY
    utils.run(
        ["docker", "compose", "exec", "-T", "php", "php", "artisan", "config:clear"],
        check=False, capture=True
    )

    # Step 4 — migrate
    # PROTECTED_CONSOLE_DATABASES is a safety guard that blocks bare `migrate`
    # on the parthenon database (added after a 2026-03-30 incident). During fresh
    # install the DB is empty, so bare migrate is safe. Setting the env var to
    # empty bypasses the guard for this single invocation only.
    console.print("[bold]Step 4/7:[/bold] Running database migrations…")
    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T",
         "-e", "PROTECTED_CONSOLE_DATABASES=",
         "php", "php", "artisan", "migrate", "--force"]
    )
    if rc != 0:
        console.print("[red]Database migration failed.[/red]")
        sys.exit(1)

    # Step 5 — seed
    console.print("[bold]Step 5/7:[/bold] Seeding database (roles, providers, bundles)…")
    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php",
         "php", "artisan", "db:seed", "--class=DatabaseSeeder", "--force"]
    )
    if rc != 0:
        console.print("[red]Database seeding failed.[/red]")
        sys.exit(1)

    # Step 6 — fix storage permissions
    # PHP-FPM runs as www-data. On fresh installs, storage/ and bootstrap/cache/ may be
    # owned by root or the host user, causing HTTP 500 on all API calls.
    console.print("[bold]Step 6/7:[/bold] Setting storage permissions…")
    utils.run(
        ["docker", "compose", "exec", "-T", "php",
         "chown", "-R", "www-data:www-data", "storage", "bootstrap/cache"],
        check=False, capture=True
    )
    utils.run(
        ["docker", "compose", "exec", "-T", "php",
         "chmod", "-R", "775", "storage", "bootstrap/cache"],
        check=False, capture=True
    )

    # PostGIS verification — non-fatal, informational only
    console.print("  [cyan]▶[/cyan] Verifying PostGIS extension…", end=" ")
    result = utils.run(
        ["docker", "compose", "exec", "-T", "postgres",
         "psql", "-U", "parthenon", "-d", "parthenon", "-tAc",
         "SELECT extversion FROM pg_extension WHERE extname = 'postgis';"],
        capture=True, check=False, cwd=utils.REPO_ROOT,
    )
    postgis_version = (result.stdout or "").strip()
    if postgis_version:
        console.print(f"[green]v{postgis_version}[/green]")
    else:
        console.print("[yellow]not found (GIS features will be unavailable)[/yellow]")

    # Step 7 — abby_analyst role setup (non-fatal: requires omop schema)
    console.print("[bold]Step 7/7:[/bold] Setting up abby_analyst read-only role…", end=" ")
    abby_result = utils.run(
        ["docker", "compose", "exec", "-T", "php",
         "php", "artisan", "abby:setup-analyst"],
        capture=True, check=False, cwd=utils.REPO_ROOT,
    )
    if abby_result.returncode == 0:
        console.print("[green]done[/green]")
    else:
        console.print("[yellow]skipped (non-fatal)[/yellow]")
        console.print(
            "  [dim]Re-run after loading OMOP vocabulary: "
            "docker compose exec php php artisan abby:setup-analyst[/dim]"
        )

    # Start Horizon now that vendor/ exists on the bind mount.
    console.print("[bold]Step 8:[/bold] Starting Horizon queue worker…")
    rc = utils.run_stream(["docker", "compose", "up", "-d", "horizon"])
    if rc != 0:
        console.print("[yellow]⚠ Horizon failed to start — queued jobs won't run until resolved.[/yellow]")
    else:
        console.print("[green]✓ Horizon started.[/green]")

    console.print("[green]✓ Laravel bootstrap complete.[/green]\n")


def run_create_admin(email: str, name: str, password: str) -> None:
    """Phase 8: create the super-admin account non-interactively."""
    console.rule("[bold]Phase 8 — Admin Account[/bold]")
    console.print(f"  [cyan]▶[/cyan] Creating admin account ({email})…", end=" ")

    # Build the command as a list to avoid shell quoting issues
    result = utils.run(
        [
            "docker", "compose", "exec", "-T", "php",
            "php", "artisan", "admin:create",
            f"--email={email}",
            f"--name={name}",
            f"--password={password}",
            "--force",
        ],
        check=False,
        cwd=utils.REPO_ROOT,
    )

    if result.returncode == 0:
        console.print("[green]done[/green]")
    else:
        console.print("[red]FAILED[/red]")
        if result.stdout:
            console.print(result.stdout)
        if result.stderr:
            console.print(result.stderr)
        sys.exit(1)

    # Flag the account so the Setup Wizard's Change Password step activates on
    # first login.  The installer wrote the generated password to
    # .install-credentials; the wizard prompts the admin to replace it.
    console.print("  [cyan]▶[/cyan] Flagging account for password change on first login…", end=" ")
    pw_result = utils.run(
        [
            "docker", "compose", "exec", "-T", "postgres",
            "psql", "-U", "parthenon", "-d", "parthenon",
            "-c", f"UPDATE app.users SET must_change_password = true WHERE email = '{email}';",
        ],
        check=False,
        capture=True,
        cwd=utils.REPO_ROOT,
    )
    if pw_result.returncode == 0:
        console.print("[green]done[/green]")
    else:
        # Non-fatal — wizard will still appear, password step will be skipped
        console.print("[yellow]skipped (non-fatal)[/yellow]")

    console.print("[green]✓ Admin account ready.[/green]\n")
