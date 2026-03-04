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
    console.print("[bold]Step 1/6:[/bold] Installing PHP dependencies (composer install)…")
    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php",
         "composer", "install", "--no-dev", "--optimize-autoloader", "--no-interaction"]
    )
    if rc != 0:
        console.print("[red]composer install failed.[/red]")
        sys.exit(1)

    # Step 2 — key:generate
    console.print("[bold]Step 2/6:[/bold] Generating application key…")
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
    console.print("[bold]Step 3/6:[/bold] Reloading PHP container (picks up new APP_KEY)…")
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
    console.print("[bold]Step 4/6:[/bold] Running database migrations…")
    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php",
         "php", "artisan", "migrate", "--force"]
    )
    if rc != 0:
        console.print("[red]Database migration failed.[/red]")
        sys.exit(1)

    # Step 5 — seed
    console.print("[bold]Step 5/6:[/bold] Seeding database (roles, providers, bundles)…")
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
    console.print("[bold]Step 6/6:[/bold] Setting storage permissions…")
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

    console.print("[green]✓ Laravel bootstrap complete.[/green]\n")


def run_create_admin(email: str, name: str, password: str) -> None:
    """Phase 7: create the super-admin account non-interactively."""
    console.rule("[bold]Phase 7 — Admin Account[/bold]")
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
