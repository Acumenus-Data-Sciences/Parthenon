# installer/version.py
"""Version detection and .parthenon-version management."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from acropolis.installer.utils import PARTHENON_ROOT

VERSION_FILE = PARTHENON_ROOT / ".parthenon-version"
CURRENT_VERSION = "1.0.7"


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
    "1.0.7": {
        "new": [
            "AGPLv3 relicense (was Apache-2.0) — see LICENSE + NOTICE; license-guard CI enforces headers",
            "CE/EE fork architecture — Plans 01-04: legal foundation, 8 extension points, industry templates, spec+plans",
            "8 Phase 2 extension points — AuthDriver, TenantResolver, CryptoProvider, AuditSink, ObservabilityShipper, FeatureFlags, AcropolisPhases, ComposeContract",
            "Harmonia — AI-assisted concept-mapping backend + reviewer UI (Plans 6+7)",
            "Industry templates — NAACCR cancer registry, STS National Database, NCDR, lis_lab_to_omop, ARTEMIS chemo regimens, SDTM→OMOP v5.4 bridge",
            "Managed OHDSI Shiny runtime — manifest contract, result loader, viewer schema guards, throttle/launch metrics, official module entrypoints",
            "Aqueduct ingestion templates — run progress, current_node, timestamps, cancel/reconciliation, end-to-end contract",
            "Compose composition contract + verifier (`scripts/verify_compose_contract.py`) with `--check-infra-overlay` mode",
            "Acropolis phase registry (installer Phase 2 #7) — discoverable phase plugins for CE+EE",
            "FeatureFlags store + EnterpriseGate component for capability gating",
            "GIS Phase 19 — county-level stratification, location_urban_pct, multi-source nationwide loaders, dataset registry",
            "Frontend i18n — 121 commits hardening locale coverage, fallbacks, Arabic locale alignment",
            "CMS Measures page — sortable + filterable; 72 eCQM titles backfilled from VSAC",
            "Installer GUI v0.3.0 (Tauri) — Phases 1-8: cross-platform elevation, Linux polkit, Windows UAC + WSL2 detect, macOS Docker Desktop / Colima / Rancher, server-mode (Caddy + LE + UFW), recovery panel, Hero Done page, 9-cell phase progress strip, auto-updater",
            "Installer-c — omop_cdm phase complete; 50-fingerprint diagnostic KB; new contract actions (health, credentials, service-status, open-app, port-holder, recover, diagnose)",
        ],
        "security": [
            "Sentinel CRITICAL — SQL injection bypass in DataInterrogationService (#298)",
            "Sentinel CRITICAL — plaintext password leak in logs (#294)",
            "Sentinel CRITICAL — hardcoded Orthanc credentials (#280)",
            "Sentinel HIGH — SQL safety bypass in DataInterrogationService (#279)",
            "Per-route permissions on /study-agent/* + FormRequest authorize() hardening",
            "Wazuh ports bound to localhost; token-based healthchecks",
        ],
        "upgraded": [
            "Org transfer — repo now lives under Acumenus-Data-Sciences (remotes auto-redirect from the prior personal org)",
            "Frontend deps — @tanstack/react-query, react-joyride 3.0.2→3.1.0, zod 4.3.6→4.4.3, deck.gl 9.2.11→9.3.2",
            "AI deps — transformers, esda >=2.9.0, cyvcf2 >=0.32.1, asyncpg >=0.31.0, spreg >=1.9.0, geopandas >=1.1.3",
            "GitHub Actions — actions/github-script 7→9, astral-sh/setup-uv 3→7",
        ],
        "fixes": [
            "deploy: auto-heal composer autoloader poisoned by /tmp worktree paths",
            "docker: install libuv1-dev so R `fs` package builds; preserve .gitignore mode in php entrypoint chmod sweep",
            "docker: scispacy en_core_sci_md wheel URL (was 404)",
            "ci: pin DB_TEST_* env vars; share ingest timestamp across wiki pages; AI review advisory; Darkstar build timeout 60→120",
            "test-infra: respect CI env when resolving test DB host; only patch *_testing config when broken",
            "study-workbench/designer — lock-race guard, dirty-form warning, NaN concept_id, ensureSession dedupe, error banners; 1380 LOC dead StudyDesigner.tsx removed",
            "patient-similarity — temporal compare validation; workspace workflow repair",
            "care-bundles — workbench workflow hardening; VSAC measures table title column",
        ],
        "config_required": [
            "No config changes required for upgrade from 1.0.6.",
            "EE-only: review `docs/architecture/extension-points/` for extension-point contracts before subclassing.",
        ],
    },
    "1.0.6": {
        "new": [
            "FinnGen Cohort Workbench — sessions, operation algebra, materialize, Atlas import, run history",
            "Authentik SSO via OIDC (Phase 7 live, feature-flagged per environment)",
            "Light mode — first-class theme with warm parchment palette + per-user preference",
            "Patient Similarity rework — UMAP, Phenotype Discovery, Inspector sidebar, AI step interpretation",
            "Acumenus Data Room project-management handoff — dataroom.acumenus.net local Apache vhost",
            "eCQM care bundle library expanded 10 → 45 (OHDSI-compliant)",
        ],
        "upgraded": [
            "Darkstar (R sidecar) — finngen route group, ROMOPAPI + HadesExtras + CO2AnalysisModules",
            "TypeScript 5.9 → 6.0, react-router-dom 6 → 7, pandas 2 → 3, uvicorn 0.42 → 0.44",
        ],
        "migrations": [
            "FinnGen schema (app.finngen_runs, app.finngen_analysis_modules)",
            "OIDC linking (app.user_external_identities, app.oidc_email_aliases)",
            "Postgres role split: parthenon_app (DML), parthenon_migrator (DDL), parthenon_owner",
        ],
        "config_required": [
            "Authentik OIDC credentials (only if enabling SSO)",
            "darkstar container must be healthy for FinnGen workbench",
        ],
    },
    "1.0.3": {
        "new": [
            "BlackRabbit — SQL Server, Synapse, Oracle profiling (replaces WhiteRabbit)",
            "LiveKit — Voice/video calls in Commons",
            "Arachne — Federated study execution",
            "Phoebe — Concept recommendations",
            "Aqueduct — Canvas UX overhaul",
            "Scribe API docs + Docusaurus reference",
            "Risk Scores v2 — 20 validated clinical instruments",
            "Standard PROs+ — Survey instrument library",
            "Poseidon — Data lakehouse with Dagster + dbt",
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
