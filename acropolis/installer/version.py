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
