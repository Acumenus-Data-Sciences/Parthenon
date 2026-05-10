#!/usr/bin/env python3
"""Statically verify CE compose files against the composition contract.

Plan 02-08 — Compose Composition Contract.

The verifier enforces the rules documented in
``docs/architecture/extension-points/compose-composition.md``. It is the
machine-checkable counterpart to that doc and runs in CI on every PR that
touches a compose file.

Usage::

    python3 scripts/verify_compose_contract.py
    python3 scripts/verify_compose_contract.py --check-ee /path/to/parthenon-ee/enterprise/docker-compose.ee.yml

Exit codes:
    0 — contract satisfied
    1 — contract violation
    2 — unable to parse a compose file
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

import yaml


# ── Contract constants ──────────────────────────────────────────────────────

#: CE compose files the verifier walks. EE overlays are checked separately
#: via ``--check-ee`` (this script does not assume Parthenon-EE is on disk).
CE_COMPOSE_FILES: list[str] = [
    "docker-compose.yml",
    "docker-compose.community.yml",
    "acropolis/docker-compose.base.yml",
    "acropolis/docker-compose.community.yml",
]

#: Service names that form the public CE API. Renaming or removing any of
#: these is a BREAKING change. Adding new services is fine. EE overlays may
#: extend these (env, volumes, depends_on) but MUST NOT rename or replace.
#:
#: This list captures the BASELINE — services already present and load-bearing
#: in the deployed CE stack. New CE services do not have to be added here;
#: only services we explicitly want to mark as "operators rely on this name
#: in scripts" need stable-name protection.
STABLE_SERVICE_NAMES: set[str] = {
    # Core application
    "php", "nginx", "node", "postgres", "redis",
    "python-ai", "solr", "horizon",
    "fhir-to-cdm", "study-agent", "hecate",
    # Acropolis CE (only required when Acropolis is loaded)
    "traefik", "portainer", "pgadmin",
}

#: Services that live in Acropolis overlay files only. The verifier never
#: fails when these are missing from the *core* compose files — it only
#: fails when an Acropolis file declares them with the wrong name shape.
ACROPOLIS_ONLY_SERVICES: set[str] = {"traefik", "portainer", "pgadmin", "authentik"}

#: Container names follow ``parthenon-<service>`` (core stack) or
#: ``acropolis-<service>`` (Acropolis overlay services). Both prefixes are
#: documented public API; downstream operator scripts (acropolis.sh, the
#: install state machine) reference both forms.
CONTAINER_NAME_RE: re.Pattern[str] = re.compile(
    r"^(parthenon|acropolis)-[a-z0-9][a-z0-9-]*$"
)

#: Per-service allowlist for container names that pre-date the
#: ``parthenon-<service>`` convention. These names are baked into Grafana
#: dashboards, nginx upstream resolution, and operator scripts; renaming
#: them would be a breaking production change. New services MUST follow
#: the prefix convention; this map captures the baseline.
LEGACY_CONTAINER_NAMES: dict[str, set[str]] = {
    "python-ai": {"python-ai"},
}

#: Acceptable CE network names. EE-introduced networks are required to be
#: ``parthenon-ee-`` prefixed and are allowed automatically through the
#: prefix check below.
NETWORK_NAMES_CE_OK: set[str] = {
    "parthenon", "acumenus", "default",
    "acropolis", "acropolis-backend",
    "backend", "jupyter_users",
}

#: EE port floor — host ports below this number are CE territory.
EE_PORT_FLOOR: int = 8100

#: CE registry namespace prefix on ghcr.io. Anything pushed to ghcr.io
#: under a different organization is a contract violation in a CE compose
#: file.
CE_GHCR_PREFIX: str = "ghcr.io/acumenus-data-sciences/parthenon-"

#: EE registry namespace prefix on ghcr.io. EE images live in their own
#: ``parthenon-ee-<service>`` repository to keep the CE/EE boundary
#: visible at the registry layer too.
EE_GHCR_PREFIX: str = "ghcr.io/acumenus-data-sciences/parthenon-ee-"


# ── YAML helpers ────────────────────────────────────────────────────────────

def _load(path: Path) -> dict[str, Any]:
    try:
        loaded = yaml.safe_load(path.read_text())
    except Exception as exc:  # noqa: BLE001 — report the path
        print(f"FAIL parse {path}: {exc}")
        sys.exit(2)
    return loaded or {}


def _services(doc: dict[str, Any]) -> dict[str, Any]:
    services = doc.get("services") or {}
    return services if isinstance(services, dict) else {}


def _is_ghcr_image(image: str) -> bool:
    return isinstance(image, str) and image.startswith("ghcr.io/")


# ── CE verifiers ────────────────────────────────────────────────────────────

def verify_ce_files(repo_root: Path) -> list[str]:
    """Walk every CE compose file and check container names + image namespace."""
    errors: list[str] = []
    for rel in CE_COMPOSE_FILES:
        path = repo_root / rel
        if not path.exists():
            continue
        doc = _load(path)
        for name, spec in _services(doc).items():
            if not isinstance(spec, dict):
                continue
            container = spec.get("container_name")
            if container:
                container_str = str(container)
                allowed_legacy = LEGACY_CONTAINER_NAMES.get(name, set())
                if (
                    not CONTAINER_NAME_RE.match(container_str)
                    and container_str not in allowed_legacy
                ):
                    expected = "'parthenon-<service>' or 'acropolis-<service>'"
                    if allowed_legacy:
                        expected += f" or one of {sorted(allowed_legacy)}"
                    errors.append(
                        f"{rel}: service {name} has non-standard container_name "
                        f"'{container_str}'; expected {expected}"
                    )
            image = spec.get("image", "")
            if _is_ghcr_image(image) and not str(image).startswith(CE_GHCR_PREFIX):
                errors.append(
                    f"{rel}: service {name} image '{image}' is on ghcr.io "
                    f"but not in acumenus-data-sciences/parthenon-* namespace"
                )
        for vol in (doc.get("volumes") or {}).keys():
            if str(vol).startswith("parthenon-ee-"):
                errors.append(
                    f"{rel}: CE compose file declares EE-prefixed volume '{vol}'"
                )
        for net in (doc.get("networks") or {}).keys():
            net_str = str(net)
            if net_str in NETWORK_NAMES_CE_OK:
                continue
            if net_str.startswith("parthenon-"):
                continue
            errors.append(
                f"{rel}: unexpected CE network '{net_str}' "
                f"(allowed: {sorted(NETWORK_NAMES_CE_OK)} or parthenon-*)"
            )
    return errors


def verify_ce_stable_services_present(repo_root: Path) -> list[str]:
    """Every non-Acropolis stable service must be defined somewhere in CE."""
    declared: set[str] = set()
    for rel in CE_COMPOSE_FILES:
        path = repo_root / rel
        if path.exists():
            declared |= set(_services(_load(path)).keys())
    required = STABLE_SERVICE_NAMES - ACROPOLIS_ONLY_SERVICES
    missing = sorted(required - declared)
    return [f"missing required stable service: {svc}" for svc in missing]


# ── EE verifier ─────────────────────────────────────────────────────────────

def verify_ee_overlay(ee_path: Path) -> list[str]:
    """Apply the EE-overlay rules to a single Parthenon-EE compose file."""
    if not ee_path.exists():
        return [f"EE overlay path does not exist: {ee_path}"]
    doc = _load(ee_path)
    errors: list[str] = []

    for name, spec in _services(doc).items():
        spec = spec or {}
        if name in STABLE_SERVICE_NAMES:
            if "container_name" in spec:
                errors.append(
                    f"{ee_path}: EE overlay sets container_name on stable "
                    f"service '{name}' — forbidden"
                )
            healthcheck = spec.get("healthcheck") or {}
            test = healthcheck.get("test")
            if isinstance(test, list) and any(
                isinstance(t, str) and t.lower().strip() in {"true", "/bin/true"}
                for t in test
            ):
                errors.append(
                    f"{ee_path}: EE overlay weakens healthcheck on stable "
                    f"service '{name}' (no-op test)"
                )
        for port_spec in spec.get("ports") or []:
            host = str(port_spec).split(":")[0]
            if host.isdigit() and int(host) < EE_PORT_FLOOR:
                errors.append(
                    f"{ee_path}: EE service '{name}' binds host port {host} "
                    f"(< {EE_PORT_FLOOR})"
                )
        image = spec.get("image", "")
        if _is_ghcr_image(image):
            image_str = str(image)
            if not (
                image_str.startswith(EE_GHCR_PREFIX)
                or image_str.startswith(CE_GHCR_PREFIX)
            ):
                errors.append(
                    f"{ee_path}: EE service '{name}' image '{image}' not in "
                    f"expected namespace ({EE_GHCR_PREFIX}* or {CE_GHCR_PREFIX}*)"
                )

    for vol in (doc.get("volumes") or {}).keys():
        if not str(vol).startswith("parthenon-ee-"):
            errors.append(
                f"{ee_path}: EE volume '{vol}' is not parthenon-ee-* prefixed"
            )

    for net in (doc.get("networks") or {}).keys():
        net_str = str(net)
        if net_str in NETWORK_NAMES_CE_OK:
            continue
        if not net_str.startswith("parthenon-ee-"):
            errors.append(
                f"{ee_path}: EE network '{net_str}' is not parthenon-ee-* prefixed"
            )

    return errors


# ── Entry point ─────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=".", type=Path)
    parser.add_argument("--check-ee", default=None, type=Path)
    parser.add_argument(
        "--ce-only",
        action="store_true",
        help="Skip CE-side checks (used in tests for the EE overlay path)",
    )
    args = parser.parse_args(argv)

    errors: list[str] = []
    if not args.ce_only:
        errors += verify_ce_files(args.repo_root)
        errors += verify_ce_stable_services_present(args.repo_root)
    if args.check_ee is not None:
        errors += verify_ee_overlay(args.check_ee)

    if errors:
        print("Compose composition contract violations:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("OK: compose composition contract satisfied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
