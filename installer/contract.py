"""Machine-readable installer contract shared by UI shells.

The Python installer remains the installation source of truth.  This module
exposes the normalized defaults, service plan, validation, and preflight data
as JSON so the web and Rust shells do not need to duplicate installer rules.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import bundle_manifest, config, data_probe, docker_ops, preflight, utils


SECRET_FIELDS = {
    "abby_analyst_password",
    "admin_password",
    "cdm_password",
    "db_password",
    "enterprise_key",
    "frontier_api_key",
    "livekit_api_secret",
    "orthanc_password",
    "redis_password",
    "umls_api_key",
}


HADES_SUPPORTED_DBMS = [
    "PostgreSQL",
    "Microsoft SQL Server",
    "Oracle",
    "Amazon Redshift",
    "Snowflake",
    "Google BigQuery",
    "Apache Spark",
    "Azure Synapse Analytics Dedicated",
    "InterSystems IRIS",
    "DuckDB",
    "SQLite",
]

HADES_ADVANCED_DBMS = [
    "Apache Hive",
    "Apache Impala",
    "IBM Netezza",
    "Microsoft Parallel Data Warehouse",
]


def load_json(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    return json.loads(Path(path).read_text())


def normalize_defaults(
    overrides: dict[str, Any] | None = None,
    *,
    community: bool = False,
) -> dict[str, Any]:
    if community:
        return config.build_community_mvp_defaults(overrides)
    return config.build_config_defaults(overrides)


def redact(payload: dict[str, Any]) -> dict[str, Any]:
    redacted = dict(payload)
    for field in SECRET_FIELDS:
        if field in redacted:
            value = redacted[field]
            if value in (None, ""):
                redacted[field] = ""
            else:
                redacted[field] = "[redacted]"
    return redacted


def service_plan(cfg: dict[str, Any]) -> dict[str, Any]:
    return {
        "compose_services": docker_ops.compose_service_names(cfg),
        "health_services": docker_ops.service_health_plan(cfg),
        "required_ports": [
            {"port": port, "label": label}
            for port, label in preflight.required_ports(cfg)
        ],
        "datasets": list(cfg.get("datasets") or []),
        "modules": list(cfg.get("modules") or []),
        "data_setup": data_setup_plan(cfg),
    }


def data_setup_plan(cfg: dict[str, Any]) -> dict[str, Any]:
    mode = cfg.get("cdm_setup_mode") or "Create local PostgreSQL OMOP database"
    dbms = cfg.get("cdm_dialect") or "PostgreSQL"
    existing_state = cfg.get("cdm_existing_state") or "Empty database or schema"
    vocabulary_setup = cfg.get("vocabulary_setup") or "Use demo starter data"
    schemas = {
        "cdm": cfg.get("cdm_schema") or "omop",
        "vocabulary": cfg.get("vocabulary_schema") or "vocab",
        "results": cfg.get("results_schema") or "results",
        "temp": cfg.get("temp_schema") or "scratch",
    }

    phases: list[dict[str, str]] = []
    if mode == "Create local PostgreSQL OMOP database":
        target = "Local PostgreSQL"
        phases.extend([
            {
                "name": "Provision local PostgreSQL",
                "detail": "Create or reuse the local PostgreSQL service managed by Parthenon.",
            },
            {
                "name": "Create OMOP schemas",
                "detail": f"Prepare {schemas['cdm']}, {schemas['vocabulary']}, {schemas['results']}, and {schemas['temp']} schemas.",
            },
            {
                "name": "Install OMOP CDM DDL",
                "detail": "Create the OMOP CDM tables before clinical data is loaded.",
            },
        ])
    elif mode == "Use an existing OMOP CDM":
        target = "Existing OMOP CDM"
        phases.extend([
            {
                "name": "Connect to existing OMOP CDM",
                "detail": f"Use {dbms} and validate the configured schemas.",
            },
            {
                "name": "Validate CDM readiness",
                "detail": "Check OMOP tables, vocabulary tables, results schema, temp schema, and permissions.",
            },
        ])
    else:
        target = "Existing database server"
        phases.extend([
            {
                "name": "Connect to existing database server",
                "detail": f"Use {dbms} and inspect what has already been created.",
            },
            {
                "name": "Prepare OMOP target",
                "detail": f"Current state: {existing_state}. Create only the missing OMOP pieces.",
            },
        ])
        if existing_state != "Complete OMOP CDM exists":
            phases.append({
                "name": "Install missing OMOP CDM DDL",
                "detail": "Create schemas and tables when they are not already present.",
            })

    if vocabulary_setup == "Load Athena vocabulary ZIP":
        phases.append({
            "name": "Load Athena vocabulary",
            "detail": "Use the user-provided Athena ZIP; restricted vocabularies still require the user's licensed download.",
        })
    elif vocabulary_setup == "Use existing vocabulary":
        phases.append({
            "name": "Validate existing vocabulary",
            "detail": f"Confirm vocabulary tables are present in {schemas['vocabulary']}.",
        })
    elif vocabulary_setup == "Use demo starter data":
        phases.append({
            "name": "Load demo starter data",
            "detail": "Use Eunomia and bundled starter content where selected.",
        })
    else:
        phases.append({
            "name": "Defer vocabulary loading",
            "detail": "Install Parthenon now and guide the user to load Athena vocabulary later.",
        })

    phases.append({
        "name": "Register Parthenon data source",
        "detail": "Save the CDM, vocabulary, results, and temp schema mapping for Parthenon.",
    })

    return {
        "mode": mode,
        "target": target,
        "dbms": dbms,
        "existing_state": existing_state,
        "vocabulary_setup": vocabulary_setup,
        "schemas": schemas,
        "requires_connection_details": mode != "Create local PostgreSQL OMOP database",
        "hades_supported_dbms": HADES_SUPPORTED_DBMS,
        "advanced_deprecated_dbms": HADES_ADVANCED_DBMS,
        "phases": phases,
    }


def validate_defaults(
    overrides: dict[str, Any] | None = None,
    *,
    community: bool = False,
) -> dict[str, Any]:
    if community:
        normalized = config.build_community_mvp_defaults(overrides)
        return config.validate_config(normalized)
    return config.validate_config(overrides or {})


def preflight_payload(
    cfg: dict[str, Any],
    *,
    repo_root: str | None = None,
) -> dict[str, Any]:
    original_repo_root = utils.REPO_ROOT
    if repo_root:
        utils.REPO_ROOT = Path(repo_root).expanduser().resolve()
    try:
        checks = preflight.run_checks(cfg)
    finally:
        utils.REPO_ROOT = original_repo_root

    return {
        "repo_root": str(utils.REPO_ROOT if not repo_root else Path(repo_root).expanduser().resolve()),
        "failures": sum(1 for check in checks if check.status == "fail"),
        "warnings": sum(1 for check in checks if check.status == "warn"),
        "checks": [
            {"name": check.name, "status": check.status, "detail": check.detail}
            for check in checks
        ],
    }


def data_check_payload(
    cfg: dict[str, Any],
    *,
    repo_root: str | None = None,
) -> dict[str, Any]:
    return data_probe.run_checks(cfg, repo_root=repo_root)


def bundle_manifest_payload(*, repo_root: str | None = None) -> dict[str, Any]:
    manifest = bundle_manifest.build_manifest(repo_root=repo_root)
    checks = bundle_manifest.validate_manifest(manifest, repo_root=repo_root)
    manifest["validation"] = {
        "failures": sum(1 for check in checks if check["status"] == "fail"),
        "checks": checks,
    }
    return manifest


def build_payload(
    action: str,
    *,
    overrides: dict[str, Any] | None = None,
    community: bool = False,
    repo_root: str | None = None,
    redacted: bool = False,
) -> dict[str, Any]:
    cfg = normalize_defaults(overrides, community=community)

    if action == "defaults":
        payload: dict[str, Any] = cfg
    elif action == "validate":
        payload = {
            "ok": True,
            "config": validate_defaults(overrides, community=community),
        }
    elif action == "plan":
        payload = {
            "config": cfg,
            "plan": service_plan(cfg),
        }
    elif action == "preflight":
        payload = {
            "config": cfg,
            "preflight": preflight_payload(cfg, repo_root=repo_root),
        }
    elif action == "data-check":
        payload = {
            "config": cfg,
            "data_check": data_check_payload(cfg, repo_root=repo_root),
        }
    elif action == "bundle-manifest":
        payload = {
            "manifest": bundle_manifest_payload(repo_root=repo_root),
        }
    else:
        raise ValueError(f"Unsupported contract action: {action}")

    if redacted:
        if "config" in payload and isinstance(payload["config"], dict):
            payload = dict(payload)
            payload["config"] = redact(payload["config"])
        else:
            payload = redact(payload)
    return payload


def emit_json(payload: dict[str, Any], *, pretty: bool = False) -> None:
    print(json.dumps(payload, indent=2 if pretty else None, sort_keys=pretty))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Parthenon installer contract")
    parser.add_argument(
        "action",
        choices=["defaults", "validate", "plan", "preflight", "data-check", "bundle-manifest"],
        help="Contract payload to emit",
    )
    parser.add_argument("--community", action="store_true", help="Use Community MVP defaults")
    parser.add_argument("--input", type=str, default=None, help="JSON file with override/default values")
    parser.add_argument("--repo-root", type=str, default=None, help="Repo root to use for preflight checks")
    parser.add_argument("--redact", action="store_true", help="Redact secrets in the emitted JSON")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    args = parser.parse_args(argv)

    try:
        payload = build_payload(
            args.action,
            overrides=load_json(args.input),
            community=args.community,
            repo_root=args.repo_root,
            redacted=args.redact,
        )
    except Exception as exc:
        emit_json({"ok": False, "error": str(exc)}, pretty=True)
        return 1

    emit_json(payload, pretty=args.pretty)
    return 0


if __name__ == "__main__":
    sys.exit(main())
