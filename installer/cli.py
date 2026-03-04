"""Main installer orchestrator.

Runs the 8-phase installation flow, tracking state in .install-state.json
for resume-on-failure support.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.panel import Panel

from . import preflight, config, docker_ops, bootstrap, eunomia, utils

console = Console()
STATE_FILE = utils.REPO_ROOT / ".install-state.json"


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------

def _load_state() -> dict[str, Any]:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_state(state: dict[str, Any]) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2))
    STATE_FILE.chmod(0o600)


def _clear_state() -> None:
    if STATE_FILE.exists():
        STATE_FILE.unlink()


# ---------------------------------------------------------------------------
# Frontend build
# ---------------------------------------------------------------------------

def _build_frontend() -> None:
    console.rule("[bold]Phase 6 — Frontend Build[/bold]")
    console.print("  [cyan]▶[/cyan] Building React frontend (npm ci + vite build)…")
    # The node service has `profiles: [dev]` so it's not started by `up -d`.
    # Use `docker compose run --rm --no-deps` to spin up a one-shot build container.
    rc = utils.run_stream(
        ["docker", "compose", "run", "--rm", "--no-deps", "-T", "node",
         "sh", "-c", "cd /app && npm ci && npx vite build --mode production"]
    )
    if rc != 0:
        console.print("[red]✗ Frontend build failed.[/red]")
        sys.exit(1)
    console.print("[green]✓ Frontend built.[/green]\n")


# ---------------------------------------------------------------------------
# Summary banner
# ---------------------------------------------------------------------------

def _print_summary(cfg: dict[str, Any]) -> None:
    app_url = cfg["app_url"]
    nginx_port = cfg.get("nginx_port", 8082)
    # If url is localhost, append port
    if "localhost" in app_url and str(nginx_port) not in app_url:
        display_url = f"http://localhost:{nginx_port}"
    else:
        display_url = app_url

    eunomia_line = "  [green]Demo:[/green]     Eunomia GiBleed (Demo) ready" if cfg.get("include_eunomia") else ""

    cdm_dialect = cfg.get("cdm_dialect", "")
    cdm_line = f"  [green]CDM DB:[/green]   {cdm_dialect}" if cdm_dialect else ""

    lines = [
        f"  [green]URL:[/green]      {display_url}",
        f"  [green]Admin:[/green]    {cfg['admin_email']}",
        f"  [green]Password:[/green] (saved to .install-credentials)",
    ]
    if cdm_line:
        lines.append(cdm_line)
    if eunomia_line:
        lines.append(eunomia_line)

    next_steps = [
        f"  • Open {display_url} to log in",
        "  • Run [bold]./deploy.sh[/bold] after code changes",
        f"  • API docs at {display_url}/docs/api",
    ]
    if cfg.get("vocab_zip_path"):
        next_steps.append(
            f"  • Load vocabulary: Settings → Vocabulary Refresh → upload {cfg['vocab_zip_path']}"
        )

    lines += ["", "  [bold]Next steps:[/bold]"] + next_steps

    content = "\n".join(lines)
    console.print(
        Panel(
            f"[bold green]✓  Parthenon installed successfully![/bold green]\n\n{content}",
            title="Installation Complete",
            border_style="green",
            padding=(1, 2),
        )
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run(*, non_interactive: bool = False) -> None:
    """Run the full 8-phase installer."""
    console.print(
        Panel(
            "[bold cyan]Parthenon Installer[/bold cyan]\n"
            "[dim]Next-gen unified outcomes research platform[/dim]",
            border_style="cyan",
            padding=(1, 4),
        )
    )

    state = _load_state()
    cfg: dict[str, Any] = state.get("config", {})

    # --- Resume prompt ---
    completed = state.get("completed_phases", [])
    if completed and not non_interactive:
        import questionary
        last = completed[-1] if completed else "none"
        resume = questionary.confirm(
            f"Found a previous install attempt (last completed phase: {last}). Resume?",
            default=True,
        ).ask()
        if not resume:
            _clear_state()
            state = {}
            cfg = {}
            completed = []

    # -----------------------------------------------------------------------
    # Phase 1 — Preflight
    # -----------------------------------------------------------------------
    if "preflight" not in completed:
        preflight.run(interactive=not non_interactive)
        completed.append("preflight")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 2 — Configuration
    # -----------------------------------------------------------------------
    if "config" not in completed:
        cfg = config.collect(resume_data=cfg or None)
        config.write(cfg)
        completed.append("config")
        _save_state({"completed_phases": completed, "config": cfg})
    else:
        console.rule("[bold]Phase 2 — Configuration[/bold]")
        console.print("[dim]Resuming — using previously collected config.[/dim]\n")

    # -----------------------------------------------------------------------
    # Phase 3 — Docker
    # -----------------------------------------------------------------------
    if "docker" not in completed:
        docker_ops.run()
        completed.append("docker")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 4 — Laravel Bootstrap
    # -----------------------------------------------------------------------
    if "bootstrap" not in completed:
        bootstrap.run_laravel_bootstrap()
        completed.append("bootstrap")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 5 — Eunomia (optional)
    # -----------------------------------------------------------------------
    if "eunomia" not in completed:
        if cfg.get("include_eunomia", True):
            eunomia.run()
        else:
            console.rule("[bold]Phase 5 — Eunomia Demo Data[/bold]")
            console.print("[dim]Skipped (user opted out).[/dim]\n")
        completed.append("eunomia")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 6 — Frontend
    # -----------------------------------------------------------------------
    if "frontend" not in completed:
        _build_frontend()
        completed.append("frontend")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 7 — Admin account
    # -----------------------------------------------------------------------
    if "admin" not in completed:
        bootstrap.run_create_admin(
            email=cfg["admin_email"],
            name=cfg["admin_name"],
            password=cfg["admin_password"],
        )
        completed.append("admin")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 8 — Complete
    # -----------------------------------------------------------------------
    _clear_state()
    _print_summary(cfg)
