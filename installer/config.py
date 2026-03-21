"""Phase 2 — Configuration wizard.

Collects user preferences via questionary prompts, then writes:
  .env             (repo root — Docker Compose env vars)
  backend/.env     (Laravel app env vars)

Also saves generated credentials to .install-credentials (gitignored).

## --defaults-file JSON Schema

When invoked via ``python3 install.py --defaults-file path.json``, the JSON
file pre-seeds the interactive prompts. All fields are optional — they set
the default value shown to the user, who can still edit any field.

Acropolis writes this file during its Phase 5 (config collection) and passes
it to Parthenon's installer to avoid prompting for values already collected.

.. code-block:: json

    {
      "admin_email":    "admin@acumenus.net",
      "admin_name":     "Administrator",
      "admin_password": "auto-generated-or-user-supplied",
      "app_url":        "https://parthenon.acumenus.net",
      "timezone":       "America/New_York",
      "experience":     "Experienced",
      "db_password":    "optional-override"
    }

Field details:

- ``admin_email``    — Pre-populates the admin email prompt.
- ``admin_name``     — Pre-populates the admin display name prompt.
- ``admin_password`` — Pre-populates the admin password (still confirmable).
- ``app_url``        — Pre-populates the application URL prompt.
- ``timezone``       — Pre-populates the timezone prompt (IANA format).
- ``experience``     — Skips the experience-level question ("First-time" or "Experienced").
- ``db_password``    — Pre-populates the database password instead of auto-generating.

Output: ``.install-credentials`` (JSON, chmod 600) is always written after
config collection, containing ``app_url``, ``admin_email``, ``admin_password``,
and ``db_password``. Acropolis reads this file post-install to verify success
and display credentials in its summary. Do not change the format.
"""
from __future__ import annotations

import json
import secrets
import string
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

from . import utils

console = Console()
REPO_ROOT = utils.REPO_ROOT


def _generate_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits + "-_"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _extract_host(url: str) -> str:
    """Extract hostname from a URL string."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).hostname or "localhost"
    except Exception:
        return "localhost"


def _build_sanctum_domains(app_url: str) -> str:
    host = _extract_host(app_url)
    domains = {"localhost", "localhost:80", "localhost:5173", "localhost:8082"}
    if host not in ("localhost", "127.0.0.1"):
        domains.add(host)
    return ",".join(sorted(domains))


def _session_domain(app_url: str) -> str:
    host = _extract_host(app_url)
    if host in ("localhost", "127.0.0.1"):
        return "null"
    return host


PREREQS_URL = "https://acumenus.notion.site/Prerequisites-3dd65283fdc44bc8b4f76a0f8072d3d1"


def _validate_vocab_zip(path: str) -> bool | str:
    p = Path(path.strip())
    if not p.exists():
        return "File not found — enter the full path to your Athena vocabulary ZIP"
    if p.suffix.lower() != ".zip":
        return "Must be a .zip file downloaded from Athena (athena.ohdsi.org)"
    return True


def _ask_experience(defaults: dict[str, Any]) -> tuple[str, str | None]:
    """
    Ask experience level, gate first-timers on prerequisites, and
    optionally collect an Athena vocabulary ZIP path for experienced users.

    Returns (experience, vocab_zip_path | None).
    """
    import questionary

    experience: str = questionary.select(
        "Are you a first-time or experienced OHDSI user/developer?",
        choices=["First-time", "Experienced"],
        default=defaults.get("experience", "First-time"),
    ).ask()

    if experience == "First-time":
        console.print()
        console.print(
            Panel(
                "[bold]Before installing Parthenon you must complete the prerequisites.[/bold]\n\n"
                f"  [cyan]{PREREQS_URL}[/cyan]\n\n"
                "The prerequisites guide covers:\n"
                "  • Downloading an Athena OMOP vocabulary ZIP\n"
                "  • Preparing your OMOP CDM database\n"
                "  • Docker and system requirements",
                title="Prerequisites",
                border_style="yellow",
                padding=(1, 2),
            )
        )
        done = questionary.confirm(
            "Have you completed all prerequisites at acumenus.notion.site?",
            default=False,
        ).ask()
        if not done:
            console.print()
            console.print(
                Panel(
                    "[yellow]Please complete the prerequisites before running the installer.[/yellow]\n\n"
                    f"  [cyan]{PREREQS_URL}[/cyan]",
                    border_style="yellow",
                    padding=(1, 2),
                )
            )
            raise SystemExit(0)
        return experience, None

    # Experienced path — ask about Athena vocab ZIP
    has_zip = questionary.confirm(
        "Do you have an Athena vocabulary ZIP ready?",
        default=True,
    ).ask()

    vocab_zip_path: str | None = None
    if has_zip:
        vocab_zip_path = questionary.text(
            "Path to Athena vocabulary ZIP",
            default=defaults.get("vocab_zip_path", ""),
            validate=_validate_vocab_zip,
        ).ask()
        vocab_zip_path = str(Path(vocab_zip_path.strip()).resolve())
    else:
        console.print(
            "  [dim]No problem — you can load the vocabulary later via "
            "Settings → Vocabulary Refresh after first login.[/dim]\n"
        )

    return experience, vocab_zip_path


def collect(resume_data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run the interactive config wizard. Returns a config dict."""
    import questionary

    console.rule("[bold]Phase 2 — Configuration[/bold]")
    console.print("Answer the prompts below. Press [Enter] to accept defaults.\n")

    defaults = resume_data or {}

    # Experience level / prerequisites gate (skip when resuming — already answered)
    if "experience" not in defaults:
        experience, vocab_zip_path = _ask_experience(defaults)
    else:
        experience = defaults["experience"]
        vocab_zip_path = defaults.get("vocab_zip_path")

    # --- CDM database ---
    console.print()
    console.print(
        Panel(
            "[bold]Parthenon ships with a bundled PostgreSQL container for application data[/bold]\n"
            "[dim](user accounts, cohort definitions, analysis results, etc.)[/dim]\n\n"
            "Your [bold]OMOP CDM database[/bold] is separate — Parthenon connects to it as a "
            "read/write data source.\nYou will register the connection details after first login "
            "via [bold]Settings → Data Sources[/bold].",
            title="CDM Database",
            border_style="cyan",
            padding=(1, 2),
        )
    )

    cdm_dialect = questionary.select(
        "What database system hosts your OMOP CDM?",
        choices=[
            "PostgreSQL",
            "Microsoft SQL Server",
            "Google BigQuery",
            "Amazon Redshift",
            "Snowflake",
            "Oracle",
            "Not sure yet / will configure later",
        ],
        default=defaults.get("cdm_dialect", "PostgreSQL"),
    ).ask()

    app_url = questionary.text(
        "App URL",
        default=defaults.get("app_url", "http://localhost"),
    ).ask()

    env = questionary.select(
        "Environment",
        choices=["local", "production"],
        default=defaults.get("env", "local"),
    ).ask()

    db_password = defaults.get("db_password") or _generate_password(24)
    use_generated_db = questionary.confirm(
        f"Use auto-generated DB password ({db_password[:6]}…)?",
        default=True,
    ).ask()
    if not use_generated_db:
        db_password = questionary.password("DB password").ask()

    admin_email = questionary.text(
        "Admin email",
        default=defaults.get("admin_email", "admin@example.com"),
    ).ask()

    admin_name = questionary.text(
        "Admin name",
        default=defaults.get("admin_name", "Admin"),
    ).ask()

    admin_password = defaults.get("admin_password") or _generate_password(16)
    use_generated_admin_pw = questionary.confirm(
        f"Use auto-generated admin password ({admin_password[:4]}…)?",
        default=True,
    ).ask()
    if not use_generated_admin_pw:
        admin_password = questionary.password("Admin password (min 8 chars)").ask()

    timezone = questionary.text(
        "Timezone",
        default=defaults.get("timezone", "UTC"),
    ).ask()

    include_eunomia = questionary.confirm(
        "Load Eunomia GiBleed demo dataset? (Recommended — adds sample CDM data)",
        default=True,
    ).ask()

    ollama_url = questionary.text(
        "Ollama base URL (leave blank to skip AI features; enables ChromaDB vector database)",
        default=defaults.get("ollama_url", "http://host.docker.internal:11434"),
    ).ask()

    enable_solr = questionary.confirm(
        "Enable Apache Solr for high-performance search? (Recommended)",
        default=defaults.get("enable_solr", True),
    ).ask()

    # --- Optional sidecar services ---
    console.print()
    console.print(
        Panel(
            "[bold]Optional services extend Parthenon with additional capabilities.[/bold]\n"
            "[dim]All are optional — you can enable them later by editing .env and "
            "running docker compose up -d.[/dim]",
            title="Optional Services",
            border_style="cyan",
            padding=(1, 2),
        )
    )

    enable_study_agent = questionary.confirm(
        "Enable Study Designer (AI-assisted study protocol builder)?",
        default=defaults.get("enable_study_agent", bool(ollama_url)),
    ).ask()

    enable_whiterabbit = questionary.confirm(
        "Enable WhiteRabbit (source database profiling)?",
        default=defaults.get("enable_whiterabbit", True),
    ).ask()

    enable_fhir_to_cdm = questionary.confirm(
        "Enable FHIR-to-CDM (FHIR R4 ingestion to OMOP)?",
        default=defaults.get("enable_fhir_to_cdm", True),
    ).ask()

    enable_hecate = questionary.confirm(
        "Enable Hecate (vector concept search)?",
        default=defaults.get("enable_hecate", bool(ollama_url)),
    ).ask()

    enable_qdrant = enable_hecate  # Qdrant is required by Hecate

    enable_orthanc = questionary.confirm(
        "Enable Orthanc (DICOM medical imaging server)?",
        default=defaults.get("enable_orthanc", False),
    ).ask()

    show_advanced = questionary.confirm("Configure advanced port settings?", default=False).ask()

    nginx_port = 8082
    postgres_port = 5480
    redis_port = 6381
    ai_port = 8002
    solr_port = 8983
    solr_java_mem = "-Xms512m -Xmx2g"

    if show_advanced:
        nginx_port    = int(questionary.text("NGINX_PORT",    default=str(nginx_port)).ask())
        postgres_port = int(questionary.text("POSTGRES_PORT", default=str(postgres_port)).ask())
        redis_port    = int(questionary.text("REDIS_PORT",    default=str(redis_port)).ask())
        ai_port       = int(questionary.text("AI_PORT",       default=str(ai_port)).ask())
        if enable_solr:
            solr_port     = int(questionary.text("SOLR_PORT",     default=str(solr_port)).ask())
            solr_java_mem = questionary.text("SOLR_JAVA_MEM", default=solr_java_mem).ask()

    return {
        "experience":        experience,
        "vocab_zip_path":    vocab_zip_path,
        "cdm_dialect":       cdm_dialect,
        "app_url":           app_url,
        "env":               env,
        "db_password":       db_password,
        "admin_email":       admin_email,
        "admin_name":        admin_name,
        "admin_password":    admin_password,
        "timezone":          timezone,
        "include_eunomia":   include_eunomia,
        "ollama_url":        ollama_url,
        "enable_solr":       enable_solr,
        "enable_study_agent": enable_study_agent,
        "enable_whiterabbit": enable_whiterabbit,
        "enable_fhir_to_cdm": enable_fhir_to_cdm,
        "enable_hecate":     enable_hecate,
        "enable_qdrant":     enable_qdrant,
        "enable_orthanc":    enable_orthanc,
        "nginx_port":        nginx_port,
        "postgres_port":     postgres_port,
        "redis_port":        redis_port,
        "ai_port":           ai_port,
        "solr_port":         solr_port,
        "solr_java_mem":     solr_java_mem,
    }


def build_root_env(cfg: dict[str, Any]) -> str:
    lines = [
        f"# Parthenon — generated by installer",
        f"APP_ENV={cfg['env']}",
        f"DB_PASSWORD={cfg['db_password']}",
        f"",
        f"# Host port mapping",
        f"NGINX_PORT={cfg['nginx_port']}",
        f"VITE_PORT=5175",
        f"POSTGRES_PORT={cfg['postgres_port']}",
        f"REDIS_PORT={cfg['redis_port']}",
        f"AI_PORT={cfg['ai_port']}",
    ]

    if cfg.get("enable_solr", True):
        lines += [
            f"SOLR_PORT={cfg.get('solr_port', 8983)}",
            f"SOLR_JAVA_MEM={cfg.get('solr_java_mem', '-Xms512m -Xmx2g')}",
        ]

    lines += [
        f"",
        f"# Ollama",
        f"OLLAMA_BASE_URL={cfg['ollama_url'] or 'http://host.docker.internal:11434'}",
        f"OLLAMA_MODEL=MedAIBase/MedGemma1.5:4b",
    ]

    # Optional sidecar service ports
    lines.append("")
    lines.append("# Optional sidecar services")
    if cfg.get("enable_study_agent"):
        lines.append("STUDY_AGENT_PORT=8765")
        lines.append("LLM_MODEL=gemma3:4b")
        lines.append("EMBED_MODEL=nomic-embed-text")
    if cfg.get("enable_whiterabbit"):
        lines.append("WHITERABBIT_PORT=8090")
    if cfg.get("enable_fhir_to_cdm"):
        lines.append("FHIR_TO_CDM_PORT=8091")
    if cfg.get("enable_hecate"):
        lines.append("HECATE_PORT=8080")
    if cfg.get("enable_qdrant"):
        lines.append("QDRANT_PORT=6333")
    if cfg.get("enable_orthanc"):
        lines.append("ORTHANC_PORT=8042")

    return "\n".join(lines) + "\n"


def build_backend_env(cfg: dict[str, Any]) -> str:
    is_prod = cfg["env"] == "production"
    session_domain = _session_domain(cfg["app_url"])
    sanctum_domains = _build_sanctum_domains(cfg["app_url"])

    return (
        f"APP_NAME=Parthenon\n"
        f"APP_ENV={cfg['env']}\n"
        f"APP_KEY=\n"
        f"APP_DEBUG={'false' if is_prod else 'true'}\n"
        f"APP_TIMEZONE={cfg['timezone']}\n"
        f"APP_URL={cfg['app_url']}\n"
        f"APP_VERSION=0.1.0\n"
        f"\n"
        f"APP_LOCALE=en\n"
        f"APP_FALLBACK_LOCALE=en\n"
        f"APP_FAKER_LOCALE=en_US\n"
        f"APP_MAINTENANCE_DRIVER=file\n"
        f"BCRYPT_ROUNDS=12\n"
        f"\n"
        f"LOG_CHANNEL=stack\n"
        f"LOG_STACK=single\n"
        f"LOG_DEPRECATIONS_CHANNEL=null\n"
        f"LOG_LEVEL={'warning' if is_prod else 'debug'}\n"
        f"\n"
        f"# Single database — all schemas in one parthenon DB\n"
        f"DB_CONNECTION=pgsql\n"
        f"DB_HOST=postgres\n"
        f"DB_PORT=5432\n"
        f"DB_DATABASE=parthenon\n"
        f"DB_USERNAME=parthenon\n"
        f"DB_PASSWORD={cfg['db_password']}\n"
        f"\n"
        f"SESSION_DRIVER=redis\n"
        f"SESSION_LIFETIME=120\n"
        f"SESSION_ENCRYPT=false\n"
        f"SESSION_PATH=/\n"
        f"SESSION_DOMAIN={session_domain}\n"
        f"\n"
        f"BROADCAST_CONNECTION=redis\n"
        f"FILESYSTEM_DISK=local\n"
        f"QUEUE_CONNECTION=redis\n"
        f"\n"
        f"CACHE_STORE=redis\n"
        f"CACHE_PREFIX=parthenon_\n"
        f"\n"
        f"REDIS_CLIENT=phpredis\n"
        f"REDIS_HOST=redis\n"
        f"REDIS_PASSWORD=null\n"
        f"REDIS_PORT=6379\n"
        f"\n"
        f"SANCTUM_STATEFUL_DOMAINS={sanctum_domains}\n"
        f"\n"
        f"AI_SERVICE_URL=http://python-ai:8000\n"
        f"R_SERVICE_URL=http://darkstar:8787\n"
        f"\n"
        f"HORIZON_DASHBOARD_ENABLED=true\n"
        f"\n"
        f"MAIL_MAILER=log\n"
        f"RESEND_API_KEY=\n"
        f"MAIL_FROM_ADDRESS=noreply@parthenon.local\n"
        f'MAIL_FROM_NAME="${{APP_NAME}}"\n'
        f"\n"
        f'VITE_APP_NAME="${{APP_NAME}}"\n'
        f"\n"
        f"# Solr search\n"
        f"SOLR_ENABLED={'true' if cfg.get('enable_solr', True) else 'false'}\n"
        f"SOLR_HOST=solr\n"
        f"SOLR_PORT=8983\n"
        f"SOLR_TIMEOUT=5\n"
        f"SOLR_CORE_VOCABULARY=vocabulary\n"
        f"SOLR_CORE_COHORTS=cohorts\n"
        f"SOLR_CORE_ANALYSES=analyses\n"
        f"SOLR_CORE_MAPPINGS=mappings\n"
        f"SOLR_CORE_CLINICAL=clinical\n"
        f"SOLR_CORE_IMAGING=imaging\n"
        f"SOLR_CORE_CLAIMS=claims\n"
        f"SOLR_CORE_GIS_SPATIAL=gis_spatial\n"
        f"\n"
        f"# Optional sidecar service URLs\n"
        f"WHITERABBIT_URL={'http://whiterabbit:8090' if cfg.get('enable_whiterabbit') else ''}\n"
        f"FHIR_TO_CDM_URL={'http://fhir-to-cdm:8091' if cfg.get('enable_fhir_to_cdm') else ''}\n"
        f"HECATE_URL={'http://hecate:8080' if cfg.get('enable_hecate') else ''}\n"
        f"ORTHANC_URL={'http://orthanc:8042' if cfg.get('enable_orthanc') else ''}\n"
    )


def _show_diff(path: Path, content: str) -> None:
    console.print(f"\n[bold cyan]{path}[/bold cyan]")
    syntax = Syntax(content, "ini", theme="monokai", line_numbers=False)
    console.print(Panel(syntax, expand=False))


def write(cfg: dict[str, Any]) -> None:
    """Write .env and backend/.env after showing a preview."""
    root_env = build_root_env(cfg)
    backend_env = build_backend_env(cfg)

    console.print("\n[bold]Configuration preview:[/bold]")
    _show_diff(REPO_ROOT / ".env", root_env)
    _show_diff(REPO_ROOT / "backend" / ".env", backend_env)

    import questionary
    ok = questionary.confirm("Write these files?", default=True).ask()
    if not ok:
        console.print("[yellow]Aborted. No files written.[/yellow]")
        raise SystemExit(0)

    (REPO_ROOT / ".env").write_text(root_env)
    (REPO_ROOT / "backend" / ".env").write_text(backend_env)

    # Write Vite local env so the "Fill demo credentials" button on the login
    # screen knows the actual admin credentials chosen during this install.
    # *.local is gitignored; Vite bakes these values into the JS bundle at
    # Phase 6 build time.  If the file is absent, the button is hidden.
    study_agent_line = f"VITE_STUDY_AGENT_ENABLED={'true' if cfg.get('enable_study_agent') else 'false'}\n"
    frontend_env_local = (
        f"VITE_DEMO_EMAIL={cfg['admin_email']}\n"
        f"VITE_DEMO_PASSWORD={cfg['admin_password']}\n"
        f"{study_agent_line}"
    )
    (REPO_ROOT / "frontend" / ".env.local").write_text(frontend_env_local)

    # Save credentials
    creds_path = REPO_ROOT / ".install-credentials"
    creds = {
        "app_url":        cfg["app_url"],
        "admin_email":    cfg["admin_email"],
        "admin_password": cfg["admin_password"],
        "db_password":    cfg["db_password"],
    }
    creds_path.write_text(json.dumps(creds, indent=2))
    creds_path.chmod(0o600)

    console.print(f"[green]✓ Credentials saved to {creds_path.name}[/green]")
    console.print("[green]✓ .env files written.[/green]\n")
