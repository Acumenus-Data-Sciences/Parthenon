"""Validate docker-compose.yml entry for parthenon-templates."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml


@pytest.fixture()
def compose() -> dict[str, object]:
    repo = Path(__file__).resolve().parents[2]
    return yaml.safe_load((repo / "docker-compose.yml").read_text(encoding="utf-8"))


def test_service_exists(compose: dict[str, object]) -> None:
    services = compose["services"]
    assert isinstance(services, dict)
    assert "parthenon-templates" in services


def test_service_uses_internal_network_only(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    networks = svc["networks"]
    assert "parthenon" in networks
    # Service is NOT exposed via Nginx — no `ports:` mapping.
    assert "ports" not in svc, "parthenon-templates must not publish ports to host"


def test_service_runs_as_non_root_via_image(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    build = svc["build"]
    assert build["dockerfile"] == "templates/Dockerfile"


def test_service_mounts_storage_volume(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    mounts = svc["volumes"]
    assert any(
        "templates_storage:/var/parthenon/storage/templates" in m for m in mounts
    ), f"missing storage volume mount, got {mounts!r}"


def test_named_volume_declared(compose: dict[str, object]) -> None:
    volumes = compose["volumes"]
    assert "templates_storage" in volumes


def test_service_passes_internal_token_env(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    env = svc["environment"]
    assert any(e.startswith("PARTHENON_INTERNAL_TOKEN=${PARTHENON_INTERNAL_TOKEN") for e in env)


def test_service_has_healthcheck(compose: dict[str, object]) -> None:
    svc = compose["services"]["parthenon-templates"]  # type: ignore[index]
    assert "healthcheck" in svc
