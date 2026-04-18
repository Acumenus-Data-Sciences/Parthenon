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

from . import config, docker_ops, preflight, utils


SECRET_FIELDS = {
    "abby_analyst_password",
    "admin_password",
    "db_password",
    "enterprise_key",
    "frontier_api_key",
    "livekit_api_secret",
    "orthanc_password",
    "redis_password",
    "umls_api_key",
}


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
        choices=["defaults", "validate", "plan", "preflight"],
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
