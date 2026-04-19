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

from . import preflight, config, docker_ops, bootstrap, hecate_bootstrap, utils

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
    if utils.release_runtime_enabled():
        console.print("[dim]Using frontend assets packaged in the Community runtime image.[/dim]\n")
        return

    console.print("  [cyan]▶[/cyan] Building React frontend via ./deploy.sh --frontend…")
    rc = utils.run_stream(
        ["env", "DEPLOY_SKIP_SMOKE=true", "bash", "./deploy.sh", "--frontend"]
    )
    if rc != 0:
        console.print("[red]✗ Frontend build failed.[/red]")
        sys.exit(1)

    # Restart nginx so it picks up the freshly-built frontend/dist bind mount.
    # On macOS Docker Desktop, nginx mounting an empty directory at startup can
    # cache that empty state even after files appear — restart forces a re-scan.
    console.print("  [cyan]▶[/cyan] Restarting nginx to serve new frontend dist…")
    utils.run(["docker", "compose", "restart", "nginx"], capture=True, check=False)

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
        lines.append("  [green]ChromaDB:[/green] internal-only service enabled")
    if cfg.get("enable_study_agent"):
        lines.append(f"  [green]Study AI:[/green] http://localhost:{cfg.get('study_agent_port', 8765)} (study designer)")
    if cfg.get("enable_blackrabbit"):
        lines.append(f"  [green]Profiler:[/green] http://localhost:{cfg.get('blackrabbit_port', 8090)} (BlackRabbit)")
    if cfg.get("enable_fhir_to_cdm"):
        lines.append(f"  [green]FHIR CDM:[/green] http://localhost:{cfg.get('fhir_to_cdm_port', 8091)} (FHIR-to-CDM)")
    if cfg.get("enable_hecate"):
        lines.append(f"  [green]Hecate:[/green]   http://localhost:{cfg.get('hecate_port', 8088)} (concept search)")
    if cfg.get("enable_orthanc"):
        lines.append(f"  [green]Orthanc:[/green]  http://localhost:{cfg.get('orthanc_port', 8042)} (DICOM server)")
    if cfg.get("enable_livekit"):
        lines.append(f"  [green]LiveKit:[/green]  {cfg.get('livekit_url', 'ws://localhost:7880')} (voice/video)")
    lines.append(f"  [green]GIS:[/green]      PostGIS spatial queries enabled")

    next_steps = [
        f"  • Open {display_url} to log in",
    ]
    if utils.release_runtime_enabled():
        next_steps.append("  • Update by downloading a newer installer release or pulling newer Community runtime images")
    else:
        next_steps.append("  • Run [bold]./deploy.sh[/bold] after code changes")
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
# Upgrade helpers
# ---------------------------------------------------------------------------

_V103_NEW_VARS = [
    ("HECATE_PORT", "8088"),
    ("BLACKRABBIT_PORT", "8090"),
    ("BLACKRABBIT_SCAN_TIMEOUT_SECONDS", "1200"),
    ("HOST_UID", str(utils.host_uid())),
    ("HOST_GID", str(utils.host_gid())),
    ("DB_PORT", "5432"),
    ("LIVEKIT_URL", ""),
    ("LIVEKIT_API_KEY", ""),
    ("LIVEKIT_API_SECRET", ""),
    ("ORTHANC_USER", "parthenon"),
    ("ORTHANC_PASSWORD", ""),
]


def _append_new_env_vars(env_path: Path) -> None:
    """Append missing env vars from v1.0.3 to an existing .env file."""
    if not env_path.exists():
        return

    content = env_path.read_text()
    existing_keys = set()
    for line in content.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, _ = line.partition("=")
            existing_keys.add(key.strip())

    new_lines = []
    for var, default in _V103_NEW_VARS:
        if var not in existing_keys:
            new_lines.append(f"{var}={default}")

    if new_lines:
        with open(env_path, "a") as f:
            f.write("\n# Added by v1.0.3 upgrade\n")
            f.write("\n".join(new_lines) + "\n")
        console.print(f"  [green]Added {len(new_lines)} new env vars to {env_path.name}[/green]")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run(*, non_interactive: bool = False, pre_seed: dict[str, Any] | None = None, upgrade: bool = False) -> None:
    """Run the full 9-phase installer.

    Args:
        non_interactive: Skip interactive prompts (use defaults).
        pre_seed: Dict of default values to pre-populate config prompts.
                  Passed from --defaults-file or parent installer (e.g. Acropolis).
        upgrade: If True, run upgrade flow instead of fresh install.
    """
    console.print(
        Panel(
            "[bold cyan]Parthenon Installer[/bold cyan]\n"
            "[dim]Next-gen unified outcomes research platform[/dim]",
            border_style="cyan",
            padding=(1, 4),
        )
    )

    # ── Upgrade flow ──────────────────────────────────────────────────────
    if upgrade:
        from acropolis.installer.version import (
            detect_installed_version, write_version,
            CURRENT_VERSION, UPGRADE_NOTES,
        )

        installed = detect_installed_version()
        if installed is None:
            console.print("[yellow]No existing installation detected. Running fresh install.[/yellow]\n")
            upgrade = False
        elif installed == CURRENT_VERSION:
            console.print(f"[green]Already at v{CURRENT_VERSION}. Nothing to upgrade.[/green]")
            return
        else:
            notes = UPGRADE_NOTES.get(CURRENT_VERSION, {})
            lines = [f"[bold]Upgrading Parthenon: v{installed} → v{CURRENT_VERSION}[/bold]\n"]
            if notes.get("new"):
                lines.append("[cyan]New Features:[/cyan]")
                for item in notes["new"]:
                    lines.append(f"  ✦ {item}")
            if notes.get("upgraded"):
                lines.append("\n[cyan]Upgraded:[/cyan]")
                for item in notes["upgraded"]:
                    lines.append(f"  ↑ {item}")
            if notes.get("migrations"):
                lines.append("\n[yellow]Migrations:[/yellow]")
                for item in notes["migrations"]:
                    lines.append(f"  ⚠ {item}")
            if notes.get("config_required"):
                lines.append("\n[cyan]New Config Required:[/cyan]")
                for item in notes["config_required"]:
                    lines.append(f"  ? {item}")

            console.print(Panel("\n".join(lines), border_style="cyan", padding=(1, 2)))

            import questionary as _q
            if not _q.confirm("Proceed with upgrade?", default=True).ask():
                console.print("[dim]Upgrade cancelled.[/dim]")
                return

            # Backup current .env
            env_path = utils.REPO_ROOT / ".env"
            if env_path.exists():
                import shutil
                backup_name = f".env.backup.{installed}"
                shutil.copy2(env_path, utils.REPO_ROOT / backup_name)
                console.print(f"[green]Backed up .env to {backup_name}[/green]")

            # Append missing env vars
            _append_new_env_vars(utils.REPO_ROOT / ".env")
            _append_new_env_vars(utils.REPO_ROOT / "backend" / ".env")

            # Pull updated images
            console.print("\n[cyan]Pulling updated images...[/cyan]")
            utils.run_stream(["docker", "compose", "pull"])

            # Restart services
            console.print("[cyan]Restarting services...[/cyan]")
            utils.run_stream(["docker", "compose", "up", "-d"])

            # Run migrations
            console.print("[cyan]Running database migrations...[/cyan]")
            utils.run_stream([
                "docker", "compose", "exec", "-T", "php",
                "php", "artisan", "migrate", "--force",
            ])

            # Rebuild frontend
            _build_frontend()

            # Write version file
            write_version()

            console.print(
                Panel(
                    f"[bold green]Upgrade to v{CURRENT_VERSION} complete![/bold green]\n\n"
                    "Run [bold]./deploy.sh[/bold] to apply PHP caches and verify.",
                    border_style="green",
                    padding=(1, 2),
                )
            )
            return

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
        preflight.run(interactive=not non_interactive, cfg=cfg or None)
        completed.append("preflight")
        _save_state({"completed_phases": completed, "config": cfg})

    # -----------------------------------------------------------------------
    # Phase 2 — Configuration
    # -----------------------------------------------------------------------
    if "config" not in completed:
        cfg = config.collect(resume_data=cfg or None, non_interactive=non_interactive)
        config.write(cfg, confirm=not non_interactive)
        completed.append("config")
        _save_state({"completed_phases": completed, "config": cfg})
    else:
        console.rule("[bold]Phase 2 — Configuration[/bold]")
        console.print("[dim]Resuming — using previously collected config.[/dim]\n")

    # -----------------------------------------------------------------------
    # Hecate bootstrap assets (before Docker mounts them)
    # -----------------------------------------------------------------------
    if "hecate-assets" not in completed:
        hecate_bootstrap.ensure(cfg, console=console)
        completed.append("hecate-assets")
        _save_state({"completed_phases": completed, "config": cfg})

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

    # Write version file
    from acropolis.installer.version import write_version
    write_version(modules=cfg.get("modules", []))

    _print_summary(cfg)
