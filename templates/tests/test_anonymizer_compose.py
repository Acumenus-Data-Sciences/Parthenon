"""Verify the parthenon-anonymizer sidecar service is wired into docker-compose correctly."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_compose() -> dict[str, Any]:
    with open(REPO_ROOT / "docker-compose.yml", encoding="utf-8") as f:
        return dict(yaml.safe_load(f))


def test_anonymizer_service_declared() -> None:
    compose = _load_compose()
    assert "parthenon-anonymizer" in compose["services"]


def test_anonymizer_image_uses_parthenon_ghcr_mirror() -> None:
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    image = svc.get("image") or ""
    assert image.startswith("ghcr.io/sudoshi/parthenon-fhir-anonymizer"), image


def test_anonymizer_runs_non_root() -> None:
    """The Dockerfile must declare USER and not be root at runtime."""
    dockerfile = (REPO_ROOT / "docker" / "parthenon-anonymizer" / "Dockerfile").read_text(
        encoding="utf-8"
    )
    user_directives = [line for line in dockerfile.splitlines() if line.strip().startswith("USER ")]
    assert user_directives, "Dockerfile missing USER directive"
    last_user = user_directives[-1].split()[1]
    assert last_user not in {"root", "0"}, f"sidecar runs as {last_user!r}"


def test_anonymizer_no_published_ports_to_host() -> None:
    """No ports: stanza — sidecar is internal-network only."""
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    assert not svc.get("ports"), f"unexpected ports: {svc.get('ports')}"


def test_anonymizer_on_parthenon_network() -> None:
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    networks = svc.get("networks") or []
    assert "parthenon" in networks, networks


def test_anonymizer_healthcheck_present() -> None:
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    assert "healthcheck" in svc
    assert any("/health" in str(t) for t in svc["healthcheck"]["test"])


def test_anonymizer_drops_capabilities() -> None:
    """Defense in depth: cap_drop ALL + no-new-privileges."""
    compose = _load_compose()
    svc = compose["services"]["parthenon-anonymizer"]
    assert "ALL" in (svc.get("cap_drop") or [])
    assert any("no-new-privileges" in str(opt) for opt in (svc.get("security_opt") or []))
