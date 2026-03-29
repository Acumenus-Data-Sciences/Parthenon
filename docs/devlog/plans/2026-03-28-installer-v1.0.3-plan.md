# Installer v1.0.3 Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update both Parthenon and Acropolis installers for the v1.0.3 release — new services, module-grouped UX, `--upgrade` flag, version detection, graceful migrations, and complete release notes.

**Architecture:** Six parallel workstreams touching ~12 files. Acropolis installer gets registry/routing/verification updates + module-grouped config + upgrade flow. Parthenon installer gets BlackRabbit/LiveKit/Orthanc config + module grouping + upgrade flow. Both share a `.parthenon-version` file. Changelog written for both GitHub release and in-app What's New.

**Tech Stack:** Python 3.12, Rich TUI, questionary prompts, Docker Compose, Bash (acropolis.sh)

---

## Task 1: Version File Infrastructure

**Files:**
- Create: `acropolis/installer/version.py`
- Modify: `install.py:58-72` (add `--upgrade` arg)

- [ ] **Step 1: Create `acropolis/installer/version.py`**

```python
# installer/version.py
"""Version detection and .parthenon-version management."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from acropolis.installer.utils import PARTHENON_ROOT

VERSION_FILE = PARTHENON_ROOT / ".parthenon-version"
CURRENT_VERSION = "1.0.3"


def read_version() -> dict[str, Any] | None:
    """Read .parthenon-version. Returns None if not found."""
    if not VERSION_FILE.exists():
        return None
    try:
        return json.loads(VERSION_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def write_version(
    *,
    edition: str = "community",
    modules: list[str] | None = None,
) -> None:
    """Write .parthenon-version after install/upgrade."""
    data = {
        "version": CURRENT_VERSION,
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "edition": edition,
        "modules": modules or [
            "research", "commons", "ai_knowledge",
            "data_pipeline", "infrastructure",
        ],
    }
    VERSION_FILE.write_text(json.dumps(data, indent=2) + "\n")


def detect_installed_version() -> str | None:
    """Detect the currently installed version.

    Checks .parthenon-version first, then falls back to heuristics
    (presence of .env, running containers).
    """
    info = read_version()
    if info:
        return info.get("version")

    # Heuristic: if .env exists but no version file, assume pre-1.0.3
    env_file = PARTHENON_ROOT / ".env"
    if env_file.exists():
        return "1.0.2"

    return None


# Upgrade changelog — shown to users during --upgrade
UPGRADE_NOTES: dict[str, dict[str, list[str]]] = {
    "1.0.3": {
        "new": [
            "BlackRabbit — SQL Server, Synapse, Oracle profiling (replaces WhiteRabbit)",
            "LiveKit — Voice/video calls in Commons",
            "Arachne — Federated study execution",
            "Phoebe — Concept recommendations",
            "Aqueduct — Canvas UX overhaul",
            "Scribe API docs + Docusaurus reference",
        ],
        "upgraded": [
            "Hecate — EmbeddingGemma-300M + Qdrant 1.17",
            "R Runtime — CohortMethod 6.0.1, PLP 6.6.0, DeepPLP",
            "Nginx — Security headers, template config",
        ],
        "migrations": [
            "WhiteRabbit → BlackRabbit (automatic)",
        ],
        "config_required": [
            "LiveKit credentials (if enabling Commons calls)",
            "Orthanc credentials (if not already set)",
        ],
    },
}
```

- [ ] **Step 2: Add `--upgrade` argument to `install.py`**

In `install.py`, modify `_parse_args()` to add:

```python
    parser.add_argument(
        "--upgrade",
        action="store_true",
        default=False,
        help="Upgrade an existing installation to the latest version",
    )
```

And modify `main()` to pass the flag:

```python
    try:
        if args.with_infrastructure:
            from acropolis.installer.cli import run as run_infrastructure
            run_infrastructure(upgrade=args.upgrade)
        else:
            run(pre_seed=defaults, upgrade=args.upgrade)
    except KeyboardInterrupt:
        print("\n\nInstall cancelled by user.")
        sys.exit(130)
```

- [ ] **Step 3: Verify the file loads**

Run: `cd /home/smudoshi/Github/Parthenon && python3 -c "from acropolis.installer.version import CURRENT_VERSION; print(CURRENT_VERSION)"`

Expected: `1.0.3`

- [ ] **Step 4: Commit**

```bash
git add acropolis/installer/version.py install.py
git commit -m "feat(installer): add version detection and --upgrade flag"
```

---

## Task 2: Service Registry & Discovery Updates

**Files:**
- Modify: `acropolis/installer/discovery.py:32-62` (CURATED_SERVICES list)
- Modify: `acropolis/installer/discovery.py:98-135` (_discover_local)

- [ ] **Step 1: Update CURATED_SERVICES list**

In `acropolis/installer/discovery.py`, replace the `CURATED_SERVICES` list (lines 33-62) with:

```python
CURATED_SERVICES: list[CuratedService] = [
    # Routable services — exposed through Traefik
    # Ports are container-internal (what Traefik connects to), NOT host-mapped.
    # e.g. nginx listens on 80 inside the container; 8082 is only the host mapping.
    CuratedService("nginx", "parthenon-nginx", 80, "parthenon", "always"),
    CuratedService("darkstar", "parthenon-darkstar", 8787, "darkstar", "always"),
    CuratedService("python-ai", "parthenon-ai", 8000, "ai", "always"),
    CuratedService("morpheus-ingest", "parthenon-morpheus-ingest", 8000, "morpheus", "always"),
    CuratedService("solr", "parthenon-solr", 8983, "solr", "if_running"),
    CuratedService("jupyterhub", "parthenon-jupyterhub", 8000, "jupyter", "if_running"),
    CuratedService("finngen-runner", "parthenon-finngen-runner", 8786, "finngen", "if_running"),
    CuratedService("reverb", "parthenon-reverb", 8080, "ws", "if_running"),
    CuratedService("grafana", "parthenon-grafana", 3000, "grafana", "if_running"),
    CuratedService("prometheus", "parthenon-prometheus", 9090, "prometheus", "if_running"),
    CuratedService("study-agent", "parthenon-study-agent", 8765, "study-agent", "if_running"),
    CuratedService("hecate", "parthenon-hecate", 8088, "hecate", "if_running"),
    CuratedService("blackrabbit", "parthenon-blackrabbit", 8090, "blackrabbit", "if_running"),
    CuratedService("arachne-datanode", "parthenon-arachne-datanode", 8880, "arachne", "if_running"),
    CuratedService("fhir-to-cdm", "parthenon-fhir-to-cdm", 8091, "fhir", "if_running"),
    CuratedService("orthanc", "parthenon-orthanc", 8042, "orthanc", "if_running"),
    # Internal services — recognized but not routable (no Traefik exposure)
    CuratedService("php", "parthenon-php", 9000, "", "internal"),
    CuratedService("postgres", "parthenon-postgres", 5432, "", "internal"),
    CuratedService("redis", "parthenon-redis", 6379, "", "internal"),
    CuratedService("horizon", "parthenon-horizon", 0, "", "internal"),
    CuratedService("chromadb", "parthenon-chromadb", 8000, "", "internal"),
    CuratedService("qdrant", "parthenon-qdrant", 6333, "", "internal"),
    CuratedService("loki", "parthenon-loki", 3100, "", "internal"),
    CuratedService("alloy", "parthenon-alloy", 12345, "", "internal"),
    CuratedService("cadvisor", "parthenon-cadvisor", 8080, "", "internal"),
    CuratedService("node-exporter", "parthenon-node-exporter", 9100, "", "internal"),
]
```

Key changes:
- `hecate` port: 8080 → 8088
- `whiterabbit` removed, `blackrabbit` added (port 8090)
- `arachne-datanode` added (port 8880)
- `qdrant` added as internal (port 6333)

- [ ] **Step 2: Add WhiteRabbit migration logic**

Add this function after `match_containers_to_registry()` (after line 95):

```python
def _migrate_whiterabbit(console: Console) -> bool:
    """Check for WhiteRabbit and offer migration to BlackRabbit.

    Returns True if migration was performed or not needed.
    """
    from acropolis.installer.utils import container_exists

    has_whiterabbit = container_exists("parthenon-whiterabbit")
    has_blackrabbit = container_exists("parthenon-blackrabbit")

    if not has_whiterabbit or has_blackrabbit:
        return True  # Nothing to migrate

    console.print(
        "\n[yellow]WhiteRabbit has been replaced by BlackRabbit in v1.0.3[/]\n"
        "[dim]BlackRabbit adds SQL Server, Azure Synapse, and Oracle database support.[/]\n"
    )

    migrate = questionary.confirm(
        "Migrate WhiteRabbit → BlackRabbit now? (stops WhiteRabbit, starts BlackRabbit)",
        default=True,
    ).ask()

    if not migrate:
        console.print("[dim]Skipping migration. WhiteRabbit will not be routed.[/]")
        return True

    import subprocess

    console.print("[cyan]Stopping WhiteRabbit...[/]")
    subprocess.run(
        ["docker", "compose", "stop", "whiterabbit"],
        cwd=str(PARTHENON_ROOT),
        capture_output=True,
    )

    console.print("[cyan]Starting BlackRabbit...[/]")
    result = subprocess.run(
        ["docker", "compose", "up", "-d", "blackrabbit"],
        cwd=str(PARTHENON_ROOT),
        capture_output=True,
    )

    if result.returncode == 0:
        console.print("[green]Migration complete: WhiteRabbit → BlackRabbit[/]\n")
        return True
    else:
        console.print(f"[red]BlackRabbit failed to start: {result.stderr.decode()[:200]}[/]")
        return False
```

Also add this import at the top of the file (after line 3):

```python
from acropolis.installer.utils import PARTHENON_ROOT
```

- [ ] **Step 3: Call migration in `_discover_local`**

In `_discover_local()`, add the migration call right before discovery (insert after line 102):

```python
    # Migrate WhiteRabbit → BlackRabbit if needed
    _migrate_whiterabbit(console)
```

- [ ] **Step 4: Add `container_exists` to utils.py if missing**

Check if `container_exists` is already in `acropolis/installer/utils.py`. If not, add:

```python
def container_exists(name: str) -> bool:
    """Check if a Docker container exists (running or stopped)."""
    result = subprocess.run(
        ["docker", "container", "inspect", name],
        capture_output=True,
    )
    return result.returncode == 0
```

- [ ] **Step 5: Verify imports work**

Run: `python3 -c "from acropolis.installer.discovery import CURATED_SERVICES; print(len(CURATED_SERVICES))"`

Expected: `26` (was 23 — added blackrabbit, arachne-datanode, qdrant; removed whiterabbit)

- [ ] **Step 6: Commit**

```bash
git add acropolis/installer/discovery.py acropolis/installer/utils.py
git commit -m "feat(installer): update service registry, add WhiteRabbit→BlackRabbit migration"
```

---

## Task 3: Preflight Port Updates

**Files:**
- Modify: `acropolis/installer/preflight.py:32-35` (EDITION_PORTS)

- [ ] **Step 1: Update enterprise port list**

In `acropolis/installer/preflight.py`, replace the `EDITION_PORTS` dict (lines 32-35):

```python
EDITION_PORTS: dict[str, list[int]] = {
    "community": [9443, 5050],
    "enterprise": [5678, 8088, 8880, 9002, 9042, 9000, 3306, 9200, 9092],
}
```

Change: replaced old 8088 (Superset, already there) and added 8880 (Arachne DataNode). Hecate's new port 8088 happens to already be in the enterprise list (it was Superset's port). Since both now use 8088, add a comment:

```python
EDITION_PORTS: dict[str, list[int]] = {
    "community": [9443, 5050],
    # 8088 = Superset (Acropolis) or Hecate (Parthenon) — depends on what's enabled
    "enterprise": [5678, 8088, 8880, 9002, 9042, 9000, 3306, 9200, 9092],
}
```

- [ ] **Step 2: Commit**

```bash
git add acropolis/installer/preflight.py
git commit -m "feat(installer): update preflight port checks for Arachne DataNode"
```

---

## Task 4: Routing Updates

**Files:**
- Modify: `acropolis/installer/routing.py:47-116` (generate_parthenon_routes)

- [ ] **Step 1: No code changes needed in routing.py**

The routing engine is already generic — it generates routes from the `DiscoveredService` list. Since we updated the `CURATED_SERVICES` registry in Task 2 with the correct ports and subdomains, routing will automatically generate correct routes for:
- `blackrabbit.${DOMAIN}` → port 8090 (was whiterabbit)
- `hecate.${DOMAIN}` → port 8088 (was 8080)
- `arachne.${DOMAIN}` → port 8880 (new)

No changes to `routing.py` are required. The routes are driven by discovery output.

- [ ] **Step 2: Verify by tracing the code path**

Read `routing.py:67-71` to confirm routes use `svc.subdomain` and `svc.port` from the DiscoveredService objects, which come from the curated registry.

---

## Task 5: Verification & Smoke Test Updates

**Files:**
- Modify: `acropolis/installer/verify.py:119-124` (display_summary service URLs)

- [ ] **Step 1: No structural changes needed in verify.py**

The smoke test logic (lines 28-77) is already generic — it checks container health for Acropolis containers by name and for exposed Parthenon services from the discovery list. Since the discovery list now has the updated services, smoke tests will automatically check `parthenon-blackrabbit` instead of `parthenon-whiterabbit`.

The summary display (lines 80-144) iterates over the services list, so URLs will automatically use the new subdomains.

No changes required. The verification is data-driven from discovery.

---

## Task 6: Generator Updates (acropolis.sh)

**Files:**
- Modify: `acropolis/installer/generator.py:120-143` (cmd_urls Parthenon section)
- Modify: `acropolis/installer/generator.py:181-187` (cmd_update)

- [ ] **Step 1: Update `cmd_urls` to show discovered Parthenon services**

In `generate_acropolis_sh()`, replace the `cmd_urls` function (lines 120-143) with:

```python
cmd_urls() {{
    echo -e "${{CYAN}}Infrastructure:${{NC}}"
    echo -e "  Traefik Dashboard  ${{GREEN}}https://$DOMAIN:8090${{NC}}"

    echo
    echo -e "${{CYAN}}Community Services:${{NC}}"
    echo -e "  Portainer          ${{GREEN}}https://portainer.$DOMAIN${{NC}}"
    echo -e "  pgAdmin            ${{GREEN}}https://pgadmin.$DOMAIN${{NC}}"

    if [[ "$EDITION" == "enterprise" ]]; then
        echo
        echo -e "${{CYAN}}Enterprise Services:${{NC}}"
        echo -e "  n8n                ${{GREEN}}https://n8n.$DOMAIN${{NC}}"
        echo -e "  Superset           ${{GREEN}}https://superset.$DOMAIN${{NC}}"
        echo -e "  DataHub            ${{GREEN}}https://datahub.$DOMAIN${{NC}}"
        echo -e "  Authentik          ${{GREEN}}https://auth.$DOMAIN${{NC}}"
    fi

    if [[ "$PARTHENON_MODE" != "standalone" ]]; then
        echo
        echo -e "${{CYAN}}Parthenon:${{NC}}"
        echo -e "  Application        ${{GREEN}}https://parthenon.$DOMAIN${{NC}}"
        for svc in "${{SERVICES[@]}}"; do
            echo -e "  $svc               ${{GREEN}}https://$svc.$DOMAIN${{NC}}"
        done
    fi
}}
```

This makes the Parthenon URLs dynamic from the SERVICES array instead of hardcoded.

- [ ] **Step 2: Update `cmd_update` to use --upgrade**

Replace `cmd_update` (lines 181-187):

```python
cmd_update() {{
    log_info "Upgrading Acropolis + Parthenon..."
    if [[ -f "$PARTHENON_PATH/install.py" ]]; then
        python3 "$PARTHENON_PATH/install.py" --with-infrastructure --upgrade
    else
        log_info "Pulling latest images..."
        docker compose "${{COMPOSE_FILES[@]}}" pull
        log_info "Restarting services..."
        docker compose "${{COMPOSE_FILES[@]}}" up -d
        log_ok "Update complete."
    fi
}}
```

- [ ] **Step 3: Commit**

```bash
git add acropolis/installer/generator.py
git commit -m "feat(installer): dynamic Parthenon URLs and --upgrade in acropolis.sh"
```

---

## Task 7: Module-Grouped UX for Parthenon Installer

**Files:**
- Modify: `installer/config.py:276-315` (optional services section)

- [ ] **Step 1: Replace the flat optional services section**

In `installer/config.py`, replace lines 276-315 (from the "Optional services" panel through the `enable_orthanc` prompt) with:

```python
    # --- Module selection ---
    console.print()
    console.print(
        Panel(
            "[bold]Parthenon Modules[/bold]\n\n"
            "  [cyan]▸ Research[/cyan]       Cohorts, Analyses, Studies\n"
            "    └ Arachne      Federated execution\n"
            "    └ Darkstar     R runtime (HADES)\n\n"
            "  [cyan]▸ Commons[/cyan]        Workspace & collaboration\n"
            "    └ LiveKit      Voice/video calls\n\n"
            "  [cyan]▸ AI & Knowledge[/cyan]\n"
            "    └ Hecate       Concept search & KG\n"
            "    └ Phoebe       Concept recommendations\n"
            "    └ Abby         AI assistant\n\n"
            "  [cyan]▸ Data Pipeline[/cyan]\n"
            "    └ BlackRabbit  Source profiling\n"
            "    └ Aqueduct     ETL mapping\n"
            "    └ Orthanc      DICOM imaging\n\n"
            "  [cyan]▸ Infrastructure[/cyan]\n"
            "    └ Solr         Search engine\n"
            "    └ Qdrant       Vector database\n"
            "    └ Redis        Cache & queues",
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

    # Research module services
    enable_study_agent = enable_research and questionary.confirm(
        "Enable Study Designer (AI-assisted study protocol builder)?",
        default=bool(ollama_url),
    ).ask()

    # Commons module — LiveKit credentials (security-sensitive)
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

    # AI & Knowledge module services
    enable_hecate = enable_ai and questionary.confirm(
        "Enable Hecate (vector concept search)?",
        default=bool(ollama_url),
    ).ask()
    enable_qdrant = enable_hecate  # Qdrant is required by Hecate

    # Data Pipeline module services
    enable_blackrabbit = enable_pipeline and questionary.confirm(
        "Enable BlackRabbit (source database profiling)?",
        default=True,
    ).ask()
    enable_fhir_to_cdm = enable_pipeline and questionary.confirm(
        "Enable FHIR-to-CDM (FHIR R4 ingestion to OMOP)?",
        default=True,
    ).ask()

    # Orthanc — credentials (security-sensitive)
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
                console.print(f"  [dim]Generated: {orthanc_password[:6]}…[/dim]")

    # Infrastructure module
    enable_solr = enable_infra and questionary.confirm(
        "Enable Apache Solr for high-performance search? (Recommended)",
        default=defaults.get("enable_solr", True),
    ).ask()
```

- [ ] **Step 2: Update the return dict**

Replace the return statement (around line 334) to include the new fields:

```python
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
    }
```

- [ ] **Step 3: Update `build_root_env` for new env vars**

In `build_root_env()`, replace the "Optional sidecar services" block (lines 391-407):

```python
    lines.append("")
    lines.append("# Optional sidecar services")
    if cfg.get("enable_study_agent"):
        lines.append("STUDY_AGENT_PORT=8765")
        lines.append("LLM_MODEL=gemma3:4b")
        lines.append("EMBED_MODEL=nomic-embed-text")
    if cfg.get("enable_blackrabbit"):
        lines.append("WHITERABBIT_PORT=8090")  # Docker Compose uses this var name
        lines.append("BLACKRABBIT_SCAN_TIMEOUT_SECONDS=1200")
    if cfg.get("enable_fhir_to_cdm"):
        lines.append("FHIR_TO_CDM_PORT=8091")
    if cfg.get("enable_hecate"):
        lines.append("HECATE_PORT=8088")
    if cfg.get("enable_qdrant"):
        lines.append("QDRANT_PORT=6333")
    if cfg.get("enable_orthanc"):
        lines.append("ORTHANC_PORT=8042")
        lines.append(f"ORTHANC_USER={cfg.get('orthanc_user', 'parthenon')}")
        lines.append(f"ORTHANC_PASSWORD={cfg.get('orthanc_password', '')}")
    if cfg.get("enable_livekit"):
        lines.append("")
        lines.append("# LiveKit (Commons voice/video)")
        lines.append(f"LIVEKIT_URL={cfg.get('livekit_url', '')}")
        lines.append(f"LIVEKIT_API_KEY={cfg.get('livekit_api_key', '')}")
        lines.append(f"LIVEKIT_API_SECRET={cfg.get('livekit_api_secret', '')}")

    # Host UID/GID for container permission mapping
    import os as _os
    lines.append("")
    lines.append("# Host user mapping")
    lines.append(f"HOST_UID={_os.getuid()}")
    lines.append(f"HOST_GID={_os.getgid()}")
    lines.append("DB_PORT=5432")
```

- [ ] **Step 4: Update `build_backend_env` for new services**

In `build_backend_env()`, replace the sidecar service URLs block (lines 490-495):

```python
        f"# Optional sidecar service URLs\n"
        f"BLACKRABBIT_URL={'http://blackrabbit:8090' if cfg.get('enable_blackrabbit') else ''}\n"
        f"FHIR_TO_CDM_URL={'http://fhir-to-cdm:8091' if cfg.get('enable_fhir_to_cdm') else ''}\n"
        f"HECATE_URL={'http://hecate:8088' if cfg.get('enable_hecate') else ''}\n"
        f"ORTHANC_URL={'http://orthanc:8042' if cfg.get('enable_orthanc') else ''}\n"
        f"LIVEKIT_URL={cfg.get('livekit_url', '') if cfg.get('enable_livekit') else ''}\n"
        f"LIVEKIT_API_KEY={cfg.get('livekit_api_key', '') if cfg.get('enable_livekit') else ''}\n"
        f"LIVEKIT_API_SECRET={cfg.get('livekit_api_secret', '') if cfg.get('enable_livekit') else ''}\n"
    )
```

- [ ] **Step 5: Update `_print_summary` in cli.py**

In `installer/cli.py`, update the summary references (lines 133-138):

Replace:
```python
    if cfg.get("enable_whiterabbit"):
        lines.append(f"  [green]Profiler:[/green] http://localhost:8090 (WhiteRabbit)")
```
With:
```python
    if cfg.get("enable_blackrabbit"):
        lines.append(f"  [green]Profiler:[/green] http://localhost:8090 (BlackRabbit)")
```

Replace:
```python
    if cfg.get("enable_hecate"):
        lines.append(f"  [green]Hecate:[/green]   http://localhost:8080 (concept search)")
```
With:
```python
    if cfg.get("enable_hecate"):
        lines.append(f"  [green]Hecate:[/green]   http://localhost:8088 (concept search)")
```

Add after the Orthanc line:
```python
    if cfg.get("enable_livekit"):
        lines.append(f"  [green]LiveKit:[/green]  {cfg.get('livekit_url', 'ws://localhost:7880')} (voice/video)")
```

- [ ] **Step 6: Commit**

```bash
git add installer/config.py installer/cli.py
git commit -m "feat(installer): module-grouped UX with LiveKit/BlackRabbit/Orthanc config"
```

---

## Task 8: Upgrade Flow for Parthenon Installer

**Files:**
- Modify: `installer/cli.py:190-197` (run function signature and early logic)

- [ ] **Step 1: Add upgrade parameter and logic to `run()`**

In `installer/cli.py`, modify the `run()` function signature (line 190):

```python
def run(*, non_interactive: bool = False, pre_seed: dict[str, Any] | None = None, upgrade: bool = False) -> None:
```

After the existing banner (line 205), insert the upgrade flow:

```python
    # ── Upgrade flow ──────────────────────────────────────────────────────
    if upgrade:
        from acropolis.installer.version import (
            detect_installed_version, write_version,
            CURRENT_VERSION, UPGRADE_NOTES,
        )
        from rich.panel import Panel as _Panel

        installed = detect_installed_version()
        if installed is None:
            console.print("[yellow]No existing installation detected. Running fresh install.[/yellow]\n")
            upgrade = False
        elif installed == CURRENT_VERSION:
            console.print(f"[green]Already at v{CURRENT_VERSION}. Nothing to upgrade.[/green]")
            return
        else:
            # Show what changed
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

            console.print(_Panel("\n".join(lines), border_style="cyan", padding=(1, 2)))

            import questionary as _q
            if not _q.confirm("Proceed with upgrade?", default=True).ask():
                console.print("[dim]Upgrade cancelled.[/dim]")
                return

            # Backup current .env
            env_path = utils.REPO_ROOT / ".env"
            if env_path.exists():
                backup_name = f".env.backup.{installed}"
                backup_path = utils.REPO_ROOT / backup_name
                import shutil
                shutil.copy2(env_path, backup_path)
                console.print(f"[green]Backed up .env to {backup_name}[/green]")

            # Append missing env vars
            _append_new_env_vars(utils.REPO_ROOT / ".env", console)
            _append_new_env_vars(utils.REPO_ROOT / "backend" / ".env", console)

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
            console.print("[cyan]Rebuilding frontend...[/cyan]")
            utils.run_stream([
                "docker", "compose", "run", "--rm", "--no-deps", "-T", "node",
                "sh", "-c", "cd /app && npm ci --legacy-peer-deps && npx vite build --mode production",
            ])

            # Write version file
            write_version()

            console.print(
                _Panel(
                    f"[bold green]Upgrade to v{CURRENT_VERSION} complete![/bold green]\n\n"
                    "Run [bold]./deploy.sh[/bold] to apply PHP caches and verify.",
                    border_style="green",
                    padding=(1, 2),
                )
            )
            return
```

- [ ] **Step 2: Add the `_append_new_env_vars` helper**

Add this function before `run()` (around line 188):

```python
# New env vars added in v1.0.3 (var_name, default_value)
_V103_NEW_VARS = [
    ("HECATE_PORT", "8088"),
    ("BLACKRABBIT_SCAN_TIMEOUT_SECONDS", "1200"),
    ("HOST_UID", str(__import__("os").getuid())),
    ("HOST_GID", str(__import__("os").getgid())),
    ("DB_PORT", "5432"),
    ("LIVEKIT_URL", ""),
    ("LIVEKIT_API_KEY", ""),
    ("LIVEKIT_API_SECRET", ""),
    ("ORTHANC_USER", "parthenon"),
    ("ORTHANC_PASSWORD", ""),
]


def _append_new_env_vars(env_path: Path, console: Console) -> None:
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
```

- [ ] **Step 3: Write version file on fresh install too**

At the end of `run()`, just before `_print_summary(cfg)` (line 335), add:

```python
    # Write version file
    from acropolis.installer.version import write_version
    write_version(modules=cfg.get("modules", []))
```

- [ ] **Step 4: Commit**

```bash
git add installer/cli.py
git commit -m "feat(installer): add --upgrade flow with version detection and env migration"
```

---

## Task 9: Upgrade Flow for Acropolis Installer

**Files:**
- Modify: `acropolis/installer/cli.py:106` (run function signature)

- [ ] **Step 1: Add upgrade parameter to Acropolis `run()`**

In `acropolis/installer/cli.py`, modify the function signature (line 106):

```python
def run(upgrade: bool = False) -> None:
```

After `_banner(console)` (line 109), insert:

```python
    # ── Upgrade flow ──────────────────────────────────────────────────────
    if upgrade:
        from acropolis.installer.version import (
            detect_installed_version, write_version,
            CURRENT_VERSION, UPGRADE_NOTES,
        )

        installed = detect_installed_version()
        if installed and installed != CURRENT_VERSION:
            notes = UPGRADE_NOTES.get(CURRENT_VERSION, {})
            lines = [f"[bold]Upgrading: v{installed} → v{CURRENT_VERSION}[/bold]\n"]
            if notes.get("new"):
                lines.append("[cyan]New Features:[/cyan]")
                for item in notes["new"]:
                    lines.append(f"  ✦ {item}")
            if notes.get("upgraded"):
                lines.append("\n[cyan]Upgraded:[/cyan]")
                for item in notes["upgraded"]:
                    lines.append(f"  ↑ {item}")

            console.print(Panel("\n".join(lines), border_style="cyan", padding=(1, 2)))

            if not questionary.confirm("Proceed with upgrade?", default=True).ask():
                console.print("[dim]Upgrade cancelled.[/dim]")
                return

        # Run full installer flow — it handles skip-if-completed via state
        # Fall through to the normal phase flow below
```

At the end of `run()` (before `state.clear()` on line 339), add:

```python
    # Write version file
    from acropolis.installer.version import write_version
    write_version(edition=edition.tier)
```

- [ ] **Step 2: Commit**

```bash
git add acropolis/installer/cli.py
git commit -m "feat(installer): add --upgrade support to Acropolis installer"
```

---

## Task 10: In-App Changelog (What's New)

**Files:**
- Modify: `backend/resources/changelog.md:1-5` (prepend new version)

- [ ] **Step 1: Add v1.0.3 entry to changelog**

Prepend this content after line 3 (after the "All notable changes" line) in `backend/resources/changelog.md`:

```markdown

## [1.0.3] — 2026-03-31

### Added
- **BlackRabbit** — next-gen source profiling replacing WhiteRabbit, with SQL Server, Azure Synapse, and Oracle database support
- **LiveKit** — real-time voice and video calls in Commons workspaces, powered by LiveKit Cloud with runtime provider switching
- **Arachne DataNode** — opt-in federated study execution for participating in OHDSI network studies
- **Phoebe** — AI-powered concept recommendations from OHDSI's concept_recommended table, integrated into Concept Set Editor and Detail pages
- **Scribe API docs** — replaced Scramble with Scribe, OpenAPI reference integrated into Docusaurus user manual

### Changed
- **Aqueduct** — full-screen canvas mode, persistent viewport, compact toolbar, universal CDM selector, click-to-map field detail modals
- **Hecate** — switched to EmbeddingGemma-300M via Ollama, Qdrant upgraded to v1.17.1
- **Darkstar (R Runtime)** — CohortMethod 6.0.1, PLP 6.6.0, DeepPatientLevelPrediction, DQD support
- **Nginx** — security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection), template-based config, 5GB upload support

### Installer
- Module-grouped setup — services organized by function (Research, Commons, AI & Knowledge, Data Pipeline, Infrastructure)
- `--upgrade` flag for in-place upgrades with version detection, changelog display, and automatic migrations
- WhiteRabbit → BlackRabbit automatic migration during upgrade

```

- [ ] **Step 2: Commit**

```bash
git add backend/resources/changelog.md
git commit -m "docs: add v1.0.3 What's New changelog"
```

---

## Task 11: GitHub Release Notes Draft

**Files:**
- Create: `docs/devlog/releases/v1.0.3-release-notes.md`

- [ ] **Step 1: Create release notes file**

```bash
mkdir -p docs/devlog/releases
```

Write `docs/devlog/releases/v1.0.3-release-notes.md`:

```markdown
# Parthenon v1.0.3

## Highlights

### BlackRabbit — Next-Gen Source Profiling
Replaces WhiteRabbit with a Python 3.12 FastAPI service adding SQL Server, Azure Synapse, and Oracle database support. Existing installations are migrated automatically during upgrade.

### LiveKit — Voice & Video in Commons
Real-time voice and video calls in Commons workspaces, powered by LiveKit Cloud with runtime provider switching.

### Arachne — Federated Study Execution
Opt-in Arachne DataNode integration for participating in OHDSI network studies. Enable with `docker compose --profile arachne up`.

### Phoebe — Concept Recommendations
AI-powered concept recommendations from OHDSI's concept_recommended table, integrated into Concept Set Editor and Detail pages.

### Aqueduct Canvas Overhaul
Full-screen canvas mode, persistent viewport, compact toolbar, universal CDM selector, and click-to-map field detail modals.

## New & Upgraded

- **Hecate** — Switched to EmbeddingGemma-300M via Ollama, Qdrant upgraded to v1.17.1 with 8GB memory
- **Darkstar (R Runtime)** — CohortMethod 6.0.1, PLP 6.6.0, DeepPatientLevelPrediction, DQD support
- **Scribe API Docs** — Replaced Scramble with Scribe, integrated OpenAPI reference into Docusaurus
- **Nginx** — Security headers, template-based config, DICOM proxy caching, 5GB upload support

## Installer

- **Module-grouped setup** — Services organized by function (Research, Commons, AI & Knowledge, Data Pipeline, Infrastructure)
- **`--upgrade` flag** — In-place upgrades with version detection, changelog display, and automatic migrations
- **WhiteRabbit → BlackRabbit migration** — Detected and handled automatically during upgrade

## Upgrading

```bash
# From v1.0.2
python3 install.py --upgrade

# With Acropolis infrastructure
python3 install.py --with-infrastructure --upgrade
```

## Infrastructure

- Host UID/GID auto-detection for PHP/Scanner containers
- Configurable DB_PORT
- Qdrant ports exposed (6333 REST, 6334 gRPC)

## Full Changelog

https://github.com/sudoshi/Parthenon/compare/v1.0.2...v1.0.3
```

- [ ] **Step 2: Commit**

```bash
git add docs/devlog/releases/v1.0.3-release-notes.md
git commit -m "docs: draft v1.0.3 GitHub release notes"
```

---

## Task 12: Add `.parthenon-version` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add version file to gitignore**

The `.parthenon-version` file is installation-specific and should not be committed. Add to `.gitignore`:

```
.parthenon-version
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .parthenon-version to gitignore"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Verify all Python imports resolve**

```bash
cd /home/smudoshi/Github/Parthenon
python3 -c "
from acropolis.installer.version import CURRENT_VERSION, UPGRADE_NOTES
from acropolis.installer.discovery import CURATED_SERVICES, _migrate_whiterabbit
from acropolis.installer.cli import run
print(f'Version: {CURRENT_VERSION}')
print(f'Services: {len(CURATED_SERVICES)}')
print(f'Upgrade notes: {list(UPGRADE_NOTES.keys())}')
print('All imports OK')
"
```

Expected:
```
Version: 1.0.3
Services: 26
Upgrade notes: ['1.0.3']
All imports OK
```

- [ ] **Step 2: Verify no WhiteRabbit references remain in installer code**

```bash
grep -rn "whiterabbit\|WhiteRabbit\|white_rabbit" acropolis/installer/ installer/ --include="*.py" | grep -v "migration\|migrate\|replaced\|__pycache__"
```

Expected: No results (all references should be migration-related)

- [ ] **Step 3: Run a dry import of the Parthenon installer config**

```bash
python3 -c "from installer.config import collect; print('Parthenon config module OK')"
```

- [ ] **Step 4: Verify changelog formatting**

```bash
head -30 backend/resources/changelog.md
```

Expected: v1.0.3 entry at the top, followed by v1.0.0

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git status
# Stage and commit any remaining fixes
```
