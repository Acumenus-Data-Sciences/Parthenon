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
    """Phase 4: key:generate, migrate, seed."""
    console.rule("[bold]Phase 4 — Laravel Bootstrap[/bold]")
    _step("Generating application key", "php artisan key:generate --force")
    _step("Running database migrations", "php artisan migrate --force")
    _step("Seeding database", "php artisan db:seed --class=DatabaseSeeder --force")
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

    console.print("[green]✓ Admin account ready.[/green]\n")
