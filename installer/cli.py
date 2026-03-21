"""Main installer orchestrator.

Runs the 9-phase installation flow, tracking state in .install-state.json
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

from . import preflight, config, docker_ops, bootstrap, utils

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
         "sh", "-c", "cd /app && npm ci --legacy-peer-deps && npx vite build --mode production"]
    )
    if rc != 0:
        console.print("[red]✗ Frontend build failed.[/red]")
        sys.exit(1)
    console.print("[green]✓ Frontend built.[/green]\n")


# ---------------------------------------------------------------------------
# Solr indexing
# ---------------------------------------------------------------------------

def _index_solr(cfg: dict[str, Any]) -> None:
    console.rule("[bold]Phase 7 — Solr Indexing[/bold]")

    # Always index vocabulary (the highest-impact core)
    cores = ["vocabulary"]

    # Index cohorts and analyses if Eunomia demo data was loaded
    if cfg.get("include_eunomia"):
        cores.extend(["cohorts", "analyses"])

    console.print(f"  Indexing {len(cores)} Solr core(s): {', '.join(cores)}\n")

    for core in cores:
        console.print(f"  [cyan]▶[/cyan] Indexing Solr core: [bold]{core}[/bold]…")
        rc = utils.run_stream([
            "docker", "compose", "exec", "-T", "php",
            "php", "artisan", f"solr:index-{core}", "--no-interaction"
        ])
        if rc != 0:
            console.print(
                f"  [yellow]⚠ Solr indexing for '{core}' failed — "
                f"you can re-run later via Admin → System Health → Solr → Manage Solr Cores.[/yellow]"
            )
        else:
            console.print(f"  [green]✓ {core} indexed.[/green]")

    console.print()


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
    if cfg.get("enable_solr", True):
        solr_port = cfg.get("solr_port", 8983)
        lines.append(f"  [green]Solr:[/green]     http://localhost:{solr_port}/solr/")
    if cfg.get("ollama_url"):
        lines.append(f"  [green]ChromaDB:[/green] http://localhost:8000 (vector database)")
    if cfg.get("enable_study_agent"):
        lines.append(f"  [green]Study AI:[/green] http://localhost:8765 (study designer)")
    if cfg.get("enable_whiterabbit"):
        lines.append(f"  [green]Profiler:[/green] http://localhost:8090 (WhiteRabbit)")
    if cfg.get("enable_fhir_to_cdm"):
        lines.append(f"  [green]FHIR CDM:[/green] http://localhost:8091 (FHIR-to-CDM)")
    if cfg.get("enable_hecate"):
        lines.append(f"  [green]Hecate:[/green]   http://localhost:8080 (concept search)")
    if cfg.get("enable_orthanc"):
        lines.append(f"  [green]Orthanc:[/green]  http://localhost:8042 (DICOM server)")
    lines.append(f"  [green]GIS:[/green]      PostGIS spatial queries enabled")

    next_steps = [
        f"  • Open {display_url} to log in",
        "  • Run [bold]./deploy.sh[/bold] after code changes",
    ]
    if not cfg.get("vocab_zip_path"):
        next_steps.append(
            "  • [bold]Load OMOP vocabulary:[/bold] download from https://athena.ohdsi.org,\n"
            "    then: docker compose exec php php artisan parthenon:load-vocabularies --zip=/path/to/vocab.zip"
        )
    if not cfg.get("include_eunomia"):
        next_steps.append(
            "  • [bold]Load demo data:[/bold] docker compose exec php php artisan parthenon:load-eunomia"
        )
    if cfg.get("enable_solr", True):
        next_steps.append(
            "  • Re-index Solr cores: Admin → System Health → Solr → Manage Solr Cores"
        )
    next_steps.append(
        "  • Load GIS boundaries: Admin → System Health → GIS Data Management"
    )

    # Database info section
    lines.append("")
    lines.append("  [bold]Database layout[/bold] (single [cyan]parthenon[/cyan] DB, schema-isolated):")
    lines.append("    app.*             — Application tables (users, roles, cohorts)")
    lines.append("    omop.*            — OMOP CDM + Vocabulary tables (empty until data loaded)")
    lines.append("    results.*         — Achilles/DQD output + analysis catalog")
    if cfg.get("include_eunomia"):
        lines.append("    eunomia.*         — GiBleed demo CDM (2,694 patients)")
        lines.append("    eunomia_results.* — Demo Achilles characterization")

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

def run(*, non_interactive: bool = False, pre_seed: dict[str, Any] | None = None) -> None:
    """Run the full 9-phase installer.

    Args:
        non_interactive: Skip interactive prompts (use defaults).
        pre_seed: Dict of default values to pre-populate config prompts.
                  Passed from --defaults-file or parent installer (e.g. Acropolis).
    """
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

    # Merge pre-seed defaults into config (state file takes precedence for resume)
    if pre_seed and not cfg:
        cfg = dict(pre_seed)

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
            cfg = dict(pre_seed) if pre_seed else {}
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
        docker_ops.run(cfg=cfg)
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
    # Phase 5 — Dataset Acquisition
    # -----------------------------------------------------------------------
    if "datasets" not in completed:
        console.rule("[bold]Phase 5 — Dataset Acquisition[/bold]")

        # Determine which datasets to load
        dataset_keys = cfg.get("datasets")

        if not dataset_keys:
            # Build default list from legacy config flags
            dataset_keys = []
            if cfg.get("include_eunomia", True):
                dataset_keys.append("eunomia")

        if dataset_keys:
            from datasets.loader import run_selected, print_summary
            results = run_selected(dataset_keys, console=console)
            print_summary(results, console=console)
        else:
            console.print("[dim]No datasets selected during configuration.[/dim]")
            console.print(
                "  Run [bold]./parthenon-data[/bold] after installation to load datasets.\n"
            )

        # Handle vocabulary separately if ZIP was provided (legacy config path)
        vocab_zip = cfg.get("vocab_zip_path")
        if vocab_zip and "vocabulary" not in (dataset_keys or []):
            from datasets.loaders.vocabulary import load as load_vocab
            load_vocab(console=console, downloads_dir=utils.REPO_ROOT / "downloads", zip_path=vocab_zip)

        completed.append("datasets")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 6 — Frontend
    # -----------------------------------------------------------------------
    if "frontend" not in completed:
        _build_frontend()
        completed.append("frontend")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 7 — Solr Indexing (if enabled)
    # -----------------------------------------------------------------------
    if "solr" not in completed:
        if cfg.get("enable_solr", True):
            _index_solr(cfg)
        else:
            console.rule("[bold]Phase 7 — Solr Indexing[/bold]")
            console.print("[dim]Skipped (Solr not enabled).[/dim]\n")
        completed.append("solr")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 8 — Admin account
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
    # Phase 9 — Complete
    # -----------------------------------------------------------------------
    _clear_state()
    _print_summary(cfg)
