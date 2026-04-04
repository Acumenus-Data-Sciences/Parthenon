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
      "edition":        "Enterprise Edition",
      "enterprise_key": "example-enterprise-key",
      "umls_api_key":   "example-umls-api-key",
      "db_password":    "optional-override"
    }

Field details:

- ``admin_email``    — Pre-populates the admin email prompt.
- ``admin_name``     — Pre-populates the admin display name prompt.
- ``admin_password`` — Pre-populates the admin password (still confirmable).
- ``app_url``        — Pre-populates the application URL prompt.
- ``timezone``       — Pre-populates the timezone prompt (IANA format).
- ``experience``     — Pre-populates the experience-level question ("Beginner" or "Experienced").
- ``edition``        — Pre-selects "Community Edition" or "Enterprise Edition".
- ``enterprise_key`` — Supplies the Enterprise Edition key when required.
- ``umls_api_key``   — Supplies the UMLS key required for vocabulary import workflows.
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

EXPERIENCE_CHOICES = ["Beginner", "Experienced"]
LEGACY_EXPERIENCE_ALIASES = {"First-time": "Beginner"}
EDITION_CHOICES = ["Community Edition", "Enterprise Edition"]
CDM_DIALECT_CHOICES = [
    "PostgreSQL",
    "Microsoft SQL Server",
    "Google BigQuery",
    "Amazon Redshift",
    "Snowflake",
    "Oracle",
    "Not sure yet / will configure later",
]
ENV_CHOICES = ["local", "production"]
MODULE_CHOICES = ["research", "commons", "ai_knowledge", "data_pipeline", "infrastructure"]


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


def _sanitize_modules(modules: list[str] | tuple[str, ...] | None) -> list[str]:
    if not modules:
        return list(MODULE_CHOICES)
    return [module for module in modules if module in MODULE_CHOICES]


def _coerce_bool(value: Any, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "y", "on"}:
            return True
        if lowered in {"0", "false", "no", "n", "off"}:
            return False
    return bool(value)


def _coerce_int(value: Any, *, default: int) -> int:
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _next_free_port(preferred: int, *, used: set[int]) -> int:
    port = preferred
    while port in used or not utils.is_port_free(port):
        port += 1
    used.add(port)
    return port


def _resolve_port(seed: dict[str, Any], key: str, *, default: int, used: set[int], fixed: bool = False) -> int:
    if key in seed and seed.get(key) not in (None, ""):
        port = _coerce_int(seed.get(key), default=default)
        used.add(port)
        return port
    if fixed:
        used.add(default)
        return default
    return _next_free_port(default, used=used)


def _validated_choice(value: Any, *, choices: list[str], default: str) -> str:
    if isinstance(value, str):
        value = LEGACY_EXPERIENCE_ALIASES.get(value, value)
    if isinstance(value, str) and value in choices:
        return value
    return default


def build_config_defaults(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    """Resolve a complete config dict from partial seed values."""
    seed = dict(overrides or {})
    modules = _sanitize_modules(seed.get("modules"))
    if not modules:
        modules = list(MODULE_CHOICES)
    used_ports: set[int] = set()

    app_url = (seed.get("app_url") or "http://localhost").strip()
    ollama_url = (seed.get("ollama_url") or "http://host.docker.internal:11434").strip()

    enable_research = "research" in modules
    enable_commons = "commons" in modules
    enable_ai = "ai_knowledge" in modules
    enable_pipeline = "data_pipeline" in modules
    enable_infra = "infrastructure" in modules

    cfg = {
        "experience": _validated_choice(
            seed.get("experience"),
            choices=EXPERIENCE_CHOICES,
            default="Beginner",
        ),
        "edition": _validated_choice(
            seed.get("edition"),
            choices=EDITION_CHOICES,
            default="Community Edition",
        ),
        "enterprise_key": (seed.get("enterprise_key") or "").strip(),
        "umls_api_key": (seed.get("umls_api_key") or "").strip(),
        "vocab_zip_path": (seed.get("vocab_zip_path") or "").strip() or None,
        "cdm_dialect": _validated_choice(
            seed.get("cdm_dialect"),
            choices=CDM_DIALECT_CHOICES,
            default="PostgreSQL",
        ),
        "app_url": app_url,
        "env": _validated_choice(seed.get("env"), choices=ENV_CHOICES, default="local"),
        "db_password": seed.get("db_password") or _generate_password(24),
        "admin_email": (seed.get("admin_email") or "admin@example.com").strip(),
        "admin_name": (seed.get("admin_name") or "Admin").strip(),
        "admin_password": seed.get("admin_password") or _generate_password(16),
        "timezone": (seed.get("timezone") or "UTC").strip(),
        "include_eunomia": _coerce_bool(seed.get("include_eunomia"), default=True),
        "ollama_url": ollama_url,
        "modules": modules,
        "enable_study_agent": enable_research and _coerce_bool(seed.get("enable_study_agent"), default=bool(ollama_url)),
        "enable_blackrabbit": enable_pipeline and _coerce_bool(seed.get("enable_blackrabbit"), default=True),
        "enable_fhir_to_cdm": enable_pipeline and _coerce_bool(seed.get("enable_fhir_to_cdm"), default=True),
        "enable_hecate": enable_ai and _coerce_bool(seed.get("enable_hecate"), default=False),
        "enable_qdrant": False,
        "enable_orthanc": enable_pipeline and _coerce_bool(seed.get("enable_orthanc"), default=False),
        "enable_livekit": enable_commons and _coerce_bool(seed.get("enable_livekit"), default=False),
        "livekit_url": (seed.get("livekit_url") or "ws://localhost:7880").strip(),
        "livekit_api_key": (seed.get("livekit_api_key") or "").strip(),
        "livekit_api_secret": seed.get("livekit_api_secret") or "",
        "orthanc_user": (seed.get("orthanc_user") or "parthenon").strip(),
        "orthanc_password": seed.get("orthanc_password") or "",
        "enable_solr": enable_infra and _coerce_bool(seed.get("enable_solr"), default=True),
        "nginx_port": _resolve_port(seed, "nginx_port", default=8082, used=used_ports, fixed=True),
        "postgres_port": _resolve_port(seed, "postgres_port", default=5480, used=used_ports),
        "redis_port": _resolve_port(seed, "redis_port", default=6381, used=used_ports),
        "ai_port": _resolve_port(seed, "ai_port", default=8002, used=used_ports),
        "solr_port": _resolve_port(seed, "solr_port", default=8983, used=used_ports),
        "solr_java_mem": (seed.get("solr_java_mem") or "-Xms512m -Xmx2g").strip(),
        "study_agent_port": _resolve_port(seed, "study_agent_port", default=8765, used=used_ports),
        "jupyter_port": _resolve_port(seed, "jupyter_port", default=8888, used=used_ports),
        "r_port": _resolve_port(seed, "r_port", default=8787, used=used_ports),
        "blackrabbit_port": _resolve_port(seed, "blackrabbit_port", default=8090, used=used_ports),
        "fhir_to_cdm_port": _resolve_port(seed, "fhir_to_cdm_port", default=8091, used=used_ports),
        "hecate_port": _resolve_port(seed, "hecate_port", default=8088, used=used_ports),
        "orthanc_port": _resolve_port(seed, "orthanc_port", default=8042, used=used_ports),
    }

    if not cfg["enable_livekit"]:
        cfg["livekit_api_key"] = ""
        cfg["livekit_api_secret"] = ""
    if cfg["enable_orthanc"] and not cfg["orthanc_password"]:
        cfg["orthanc_password"] = _generate_password(24)
    if not cfg["enable_orthanc"]:
        cfg["orthanc_password"] = ""
    if cfg["experience"] == "Beginner":
        if not seed.get("edition"):
            cfg["edition"] = "Community Edition"
        cfg["enterprise_key"] = ""
        cfg["vocab_zip_path"] = None
    if cfg["edition"] == "Community Edition":
        cfg["enterprise_key"] = ""

    cfg["enable_qdrant"] = cfg["enable_hecate"]
    cfg["frontier_api_key"] = seed.get("frontier_api_key") or ""
    cfg["install_ollama"] = _coerce_bool(seed.get("install_ollama"), default=False)

    # Acropolis enterprise services (opt-out: default True when Enterprise)
    is_enterprise = cfg["edition"] == "Enterprise Edition"
    cfg["enable_authentik"] = is_enterprise and _coerce_bool(seed.get("enable_authentik"), default=True)
    cfg["enable_superset"] = is_enterprise and _coerce_bool(seed.get("enable_superset"), default=True)
    cfg["enable_datahub"] = is_enterprise and _coerce_bool(seed.get("enable_datahub"), default=True)
    cfg["enable_wazuh"] = is_enterprise and _coerce_bool(seed.get("enable_wazuh"), default=True)
    cfg["enable_n8n"] = is_enterprise and _coerce_bool(seed.get("enable_n8n"), default=True)
    # Community infra services (Enterprise only — Community Edition doesn't include Acropolis services)
    cfg["enable_portainer"] = is_enterprise and _coerce_bool(seed.get("enable_portainer"), default=True)
    cfg["enable_pgadmin"] = is_enterprise and _coerce_bool(seed.get("enable_pgadmin"), default=True)
    cfg["enable_grafana"] = is_enterprise and _coerce_bool(seed.get("enable_grafana"), default=True)

    if "datasets" in seed:
        cfg["datasets"] = seed["datasets"]

    return cfg


def validate_config(cfg: dict[str, Any]) -> dict[str, Any]:
    """Validate config values and return the normalized dict."""
    normalized = build_config_defaults(cfg)

    if normalized["experience"] not in EXPERIENCE_CHOICES:
        raise ValueError("experience must be 'Beginner' or 'Experienced'")
    if normalized["edition"] not in EDITION_CHOICES:
        raise ValueError("edition must be 'Community Edition' or 'Enterprise Edition'")
    if normalized["experience"] == "Beginner" and normalized["edition"] != "Community Edition":
        raise ValueError("Beginner users must use the Community Edition installer path")
    if normalized["edition"] == "Enterprise Edition":
        if not normalized["enterprise_key"]:
            raise ValueError("enterprise_key is required for Enterprise Edition")
        from . import license as lic
        if not lic.validate_format(normalized["enterprise_key"]):
            raise ValueError("enterprise_key must be in ACRO-XXXX-XXXX-XXXX format")
        valid, msg = lic.validate_against_db(normalized["enterprise_key"])
        if not valid:
            raise ValueError(msg)
    if normalized["experience"] != "Beginner" and not normalized["umls_api_key"]:
        raise ValueError("umls_api_key is required for vocabulary imports")
    if normalized["cdm_dialect"] not in CDM_DIALECT_CHOICES:
        raise ValueError("cdm_dialect is not a supported option")
    if normalized["env"] not in ENV_CHOICES:
        raise ValueError("env must be 'local' or 'production'")
    if not normalized["app_url"]:
        raise ValueError("app_url is required")
    if not normalized["admin_email"]:
        raise ValueError("admin_email is required")
    if not normalized["admin_name"]:
        raise ValueError("admin_name is required")
    if len(normalized["admin_password"]) < 8:
        raise ValueError("admin_password must be at least 8 characters")
    if not normalized["timezone"]:
        raise ValueError("timezone is required")

    for key in [
        "nginx_port",
        "postgres_port",
        "redis_port",
        "ai_port",
        "solr_port",
        "study_agent_port",
        "jupyter_port",
        "r_port",
        "blackrabbit_port",
        "fhir_to_cdm_port",
        "hecate_port",
        "orthanc_port",
    ]:
        port = normalized[key]
        if not isinstance(port, int) or not (1 <= port <= 65535):
            raise ValueError(f"{key} must be an integer between 1 and 65535")

    if normalized["enable_livekit"]:
        if not normalized["livekit_url"].startswith(("ws://", "wss://")):
            raise ValueError("livekit_url must start with ws:// or wss:// when LiveKit is enabled")
        if not normalized["livekit_api_key"]:
            raise ValueError("livekit_api_key is required when LiveKit is enabled")
        if not normalized["livekit_api_secret"]:
            raise ValueError("livekit_api_secret is required when LiveKit is enabled")

    if normalized["experience"] == "Experienced" and normalized["vocab_zip_path"]:
        vocab_check = _validate_vocab_zip(normalized["vocab_zip_path"])
        if vocab_check is not True:
            raise ValueError(str(vocab_check))

    return normalized


def _ask_experience(defaults: dict[str, Any]) -> tuple[str, str | None]:
    """
    Ask experience level, gate first-timers on prerequisites, and
    optionally collect an Athena vocabulary ZIP path for experienced users.

    Returns (experience, vocab_zip_path | None).
    """
    import questionary

    experience: str = questionary.select(
        "Beginner or Experienced OHDSI/OMOP User?",
        choices=["Beginner", "Experienced"],
        default=defaults.get("experience", "Beginner"),
    ).ask()

    if experience == "Beginner":
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


def collect(resume_data: dict[str, Any] | None = None, *, non_interactive: bool = False) -> dict[str, Any]:
    """Run the interactive config wizard. Returns a config dict."""
    console.rule("[bold]Phase 2 — Configuration[/bold]")
    raw_defaults = dict(resume_data or {})
    defaults = build_config_defaults(raw_defaults)

    if non_interactive:
        console.print("[dim]Non-interactive mode — using provided defaults and generated values.[/dim]\n")
        return validate_config(defaults)

    import questionary
    console.print("Answer the prompts below. Press [Enter] to accept defaults.\n")

    # Experience level / prerequisites gate (skip when resuming — already answered)
    if "experience" not in raw_defaults:
        experience, vocab_zip_path = _ask_experience(defaults)
    else:
        experience = LEGACY_EXPERIENCE_ALIASES.get(defaults["experience"], defaults["experience"])
        vocab_zip_path = defaults.get("vocab_zip_path")

    if experience == "Beginner":
        edition = "Community Edition"
        enterprise_key = ""
    else:
        edition = questionary.select(
            "Choose an installation edition",
            choices=EDITION_CHOICES,
            default=defaults.get("edition", "Community Edition"),
        ).ask()
        enterprise_key = ""
        if edition == "Enterprise Edition":
            from . import license as lic
            while True:
                enterprise_key = questionary.text(
                    "Enterprise Key (ACRO-XXXX-XXXX-XXXX)",
                    validate=lambda v: lic.validate_format(v.strip()) or "Invalid format. Expected: ACRO-XXXX-XXXX-XXXX",
                ).ask()
                enterprise_key = enterprise_key.strip().upper()
                console.print("[dim]Validating license key...[/dim]")
                valid, msg = lic.validate_against_db(enterprise_key)
                if valid:
                    console.print(f"[green]{msg}[/green]")
                    break
                console.print(f"[red]{msg}[/red]")

    umls_api_key = questionary.password(
        "UMLS Key",
        default=defaults.get("umls_api_key", ""),
        validate=lambda v: bool(v.strip()) or "UMLS Key is required for vocabulary imports",
    ).ask()

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
        "Load Eunomia demo CDM? (Recommended — adds sample CDM data)",
        default=True,
    ).ask()

    ollama_url = questionary.text(
        "Ollama base URL (leave blank to skip AI features; enables ChromaDB vector database)",
        default=defaults.get("ollama_url", "http://host.docker.internal:11434"),
    ).ask()

    # --- Module selection ---
    console.print()
    console.print(
        Panel(
            "[bold]Parthenon Modules[/bold]\n\n"
            "  [cyan]Research[/cyan]       Cohorts, Analyses, Studies\n"
            "    Arachne      Federated execution\n"
            "    Darkstar     R runtime (HADES)\n\n"
            "  [cyan]Commons[/cyan]        Workspace & collaboration\n"
            "    LiveKit      Voice/video calls\n\n"
            "  [cyan]AI & Knowledge[/cyan]\n"
            "    Hecate       Concept search & KG\n"
            "    Phoebe       Concept recommendations\n"
            "    Abby         AI assistant\n\n"
            "  [cyan]Data Pipeline[/cyan]\n"
            "    BlackRabbit  Source profiling\n"
            "    Aqueduct     ETL mapping\n"
            "    Orthanc      DICOM imaging\n\n"
            "  [cyan]Infrastructure[/cyan]\n"
            "    Solr         Search engine\n"
            "    Qdrant       Vector database\n"
            "    Redis        Cache & queues",
            title="Module Selection",
            border_style="cyan",
            padding=(1, 2),
        )
    )

    modules = questionary.checkbox(
        "Enable modules (all recommended):",
        choices=[
            questionary.Choice("Research", value="research", checked=True),
            questionary.Choice("Commons", value="commons", checked=True),
            questionary.Choice("AI & Knowledge", value="ai_knowledge", checked=True),
            questionary.Choice("Data Pipeline", value="data_pipeline", checked=True),
            questionary.Choice("Infrastructure", value="infrastructure", checked=True),
        ],
    ).ask()

    enable_research = "research" in modules
    enable_commons = "commons" in modules
    enable_ai = "ai_knowledge" in modules
    enable_pipeline = "data_pipeline" in modules
    enable_infra = "infrastructure" in modules

    # Research module
    enable_study_agent = enable_research and questionary.confirm(
        "Enable Study Designer (AI-assisted study protocol builder)?",
        default=bool(ollama_url),
    ).ask()

    # Commons — LiveKit credentials
    enable_livekit = False
    livekit_url = ""
    livekit_api_key = ""
    livekit_api_secret = ""
    if enable_commons:
        enable_livekit = questionary.confirm(
            "Enable LiveKit voice/video calls in Commons?",
            default=False,
        ).ask()
        if enable_livekit:
            console.print("\n[bold]LiveKit Configuration:[/bold]")
            livekit_url = questionary.text(
                "LiveKit URL:",
                default=defaults.get("livekit_url", "ws://localhost:7880"),
                validate=lambda v: v.startswith(("ws://", "wss://")) or "URL must start with ws:// or wss://",
            ).ask()
            livekit_api_key = questionary.text(
                "LiveKit API Key:",
                validate=lambda v: bool(v.strip()) or "API key is required",
            ).ask()
            livekit_api_secret = questionary.password(
                "LiveKit API Secret:",
                validate=lambda v: bool(v.strip()) or "API secret is required",
            ).ask()

    # AI & Knowledge
    enable_hecate = enable_ai and questionary.confirm(
        "Enable Hecate (vector concept search)?",
        default=defaults.get("enable_hecate", False),
    ).ask()
    enable_qdrant = enable_hecate

    # Data Pipeline
    enable_blackrabbit = enable_pipeline and questionary.confirm(
        "Enable BlackRabbit (source database profiling)?",
        default=True,
    ).ask()
    enable_fhir_to_cdm = enable_pipeline and questionary.confirm(
        "Enable FHIR-to-CDM (FHIR R4 ingestion to OMOP)?",
        default=True,
    ).ask()

    enable_orthanc = False
    orthanc_user = "parthenon"
    orthanc_password = ""
    if enable_pipeline:
        enable_orthanc = questionary.confirm(
            "Enable Orthanc (DICOM medical imaging server)?",
            default=defaults.get("enable_orthanc", False),
        ).ask()
        if enable_orthanc:
            console.print("\n[bold]Orthanc Credentials:[/bold]")
            orthanc_user = questionary.text(
                "Orthanc username:",
                default="parthenon",
            ).ask()
            orthanc_password = questionary.text(
                "Orthanc password (blank = auto-generate):",
                default="",
            ).ask()
            if not orthanc_password:
                orthanc_password = _generate_password(24)
                console.print(f"  [dim]Generated: {orthanc_password[:6]}...[/dim]")

    # Infrastructure — Solr moved here
    enable_solr = enable_infra and questionary.confirm(
        "Enable Apache Solr for high-performance search? (Recommended)",
        default=defaults.get("enable_solr", True),
    ).ask()

    show_advanced = questionary.confirm("Configure advanced port settings?", default=False).ask()

    nginx_port = int(defaults.get("nginx_port", 8082))
    postgres_port = int(defaults.get("postgres_port", 5480))
    redis_port = int(defaults.get("redis_port", 6381))
    ai_port = int(defaults.get("ai_port", 8002))
    solr_port = int(defaults.get("solr_port", 8983))
    solr_java_mem = str(defaults.get("solr_java_mem", "-Xms512m -Xmx2g"))

    if show_advanced:
        nginx_port = int(questionary.text("NGINX_PORT", default=str(nginx_port)).ask())
        if enable_solr:
            solr_java_mem = questionary.text("SOLR_JAVA_MEM", default=solr_java_mem).ask()

    return validate_config({
        "experience":        experience,
        "edition":           edition,
        "enterprise_key":    enterprise_key,
        "umls_api_key":      umls_api_key,
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
        "enable_blackrabbit": enable_blackrabbit,
        "enable_fhir_to_cdm": enable_fhir_to_cdm,
        "enable_hecate":     enable_hecate,
        "enable_qdrant":     enable_qdrant,
        "enable_orthanc":    enable_orthanc,
        "enable_livekit":    enable_livekit,
        "livekit_url":       livekit_url,
        "livekit_api_key":   livekit_api_key,
        "livekit_api_secret": livekit_api_secret,
        "orthanc_user":      orthanc_user,
        "orthanc_password":  orthanc_password,
        "modules":           modules,
        "nginx_port":        nginx_port,
        "postgres_port":     postgres_port,
        "redis_port":        redis_port,
        "ai_port":           ai_port,
        "solr_port":         solr_port,
        "solr_java_mem":     solr_java_mem,
        "study_agent_port":  defaults.get("study_agent_port", 8765),
        "jupyter_port":      defaults.get("jupyter_port", 8888),
        "r_port":            defaults.get("r_port", 8787),
        "blackrabbit_port":  defaults.get("blackrabbit_port", 8090),
        "fhir_to_cdm_port":  defaults.get("fhir_to_cdm_port", 8091),
        "hecate_port":       defaults.get("hecate_port", 8088),
        "orthanc_port":      defaults.get("orthanc_port", 8042),
    })


def build_root_env(cfg: dict[str, Any]) -> str:
    lines = [
        f"# Parthenon — generated by installer",
        f"APP_ENV={cfg['env']}",
        f"PARTHENON_EDITION={cfg.get('edition', 'Community Edition')}",
        f"PARTHENON_ENTERPRISE_KEY={cfg.get('enterprise_key', '')}",
        f"UMLS_API_KEY={cfg.get('umls_api_key', '')}",
        f"DB_PASSWORD={cfg['db_password']}",
        f"",
        f"# Host port mapping",
        f"NGINX_PORT={cfg['nginx_port']}",
        f"VITE_PORT=5175",
        f"POSTGRES_PORT={cfg['postgres_port']}",
        f"REDIS_PORT={cfg['redis_port']}",
        f"AI_PORT={cfg['ai_port']}",
        f"JUPYTER_PORT={cfg.get('jupyter_port', 8888)}",
        f"R_PORT={cfg.get('r_port', 8787)}",
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
        lines.append(f"STUDY_AGENT_PORT={cfg.get('study_agent_port', 8765)}")
        lines.append("LLM_MODEL=gemma3:4b")
        lines.append("EMBED_MODEL=nomic-embed-text")
    if cfg.get("enable_blackrabbit"):
        lines.append(f"WHITERABBIT_PORT={cfg.get('blackrabbit_port', 8090)}")
        lines.append("BLACKRABBIT_SCAN_TIMEOUT_SECONDS=1200")
    if cfg.get("enable_fhir_to_cdm"):
        lines.append(f"FHIR_TO_CDM_PORT={cfg.get('fhir_to_cdm_port', 8091)}")
    if cfg.get("enable_hecate"):
        lines.append(f"HECATE_PORT={cfg.get('hecate_port', 8088)}")
    if cfg.get("enable_qdrant"):
        lines.append("QDRANT_PORT=6333")
    if cfg.get("enable_orthanc"):
        lines.append(f"ORTHANC_PORT={cfg.get('orthanc_port', 8042)}")
        lines.append(f"ORTHANC_USER={cfg.get('orthanc_user', 'parthenon')}")
        lines.append(f"ORTHANC_PASSWORD={cfg.get('orthanc_password', '')}")
    if cfg.get("enable_livekit"):
        lines.append("")
        lines.append("# LiveKit (Commons voice/video)")
        lines.append(f"LIVEKIT_URL={cfg.get('livekit_url', '')}")
        lines.append(f"LIVEKIT_API_KEY={cfg.get('livekit_api_key', '')}")
        lines.append(f"LIVEKIT_API_SECRET={cfg.get('livekit_api_secret', '')}")

    import os as _os
    lines.append("")
    lines.append("# Host user mapping")
    lines.append(f"HOST_UID={_os.getuid()}")
    lines.append(f"HOST_GID={_os.getgid()}")
    lines.append("DB_PORT=5432")

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
        f"UMLS_API_KEY={cfg.get('umls_api_key', '')}\n"
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
        f"BLACKRABBIT_URL={'http://blackrabbit:8090' if cfg.get('enable_blackrabbit') else ''}\n"
        f"FHIR_TO_CDM_URL={'http://fhir-to-cdm:8091' if cfg.get('enable_fhir_to_cdm') else ''}\n"
        f"HECATE_URL={'http://hecate:8088' if cfg.get('enable_hecate') else ''}\n"
        f"ORTHANC_URL={'http://orthanc:8042' if cfg.get('enable_orthanc') else ''}\n"
        f"LIVEKIT_URL={cfg.get('livekit_url', '') if cfg.get('enable_livekit') else ''}\n"
        f"LIVEKIT_API_KEY={cfg.get('livekit_api_key', '') if cfg.get('enable_livekit') else ''}\n"
        f"LIVEKIT_API_SECRET={cfg.get('livekit_api_secret', '') if cfg.get('enable_livekit') else ''}\n"
    )


def _show_diff(path: Path, content: str) -> None:
    console.print(f"\n[bold cyan]{path}[/bold cyan]")
    syntax = Syntax(content, "ini", theme="monokai", line_numbers=False)
    console.print(Panel(syntax, expand=False))


def write(cfg: dict[str, Any], *, confirm: bool = True) -> None:
    """Write .env and backend/.env after showing a preview."""
    cfg = validate_config(cfg)
    root_env = build_root_env(cfg)
    backend_env = build_backend_env(cfg)

    console.print("\n[bold]Configuration preview:[/bold]")
    _show_diff(REPO_ROOT / ".env", root_env)
    _show_diff(REPO_ROOT / "backend" / ".env", backend_env)

    if confirm:
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
