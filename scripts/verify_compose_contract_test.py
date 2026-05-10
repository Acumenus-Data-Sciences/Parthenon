"""Tests for ``scripts/verify_compose_contract.py`` (Plan 02-08)."""
from __future__ import annotations

import subprocess
import tempfile
import textwrap
from pathlib import Path


VERIFIER = Path(__file__).parent / "verify_compose_contract.py"


def _write(directory: Path, name: str, body: str) -> None:
    (directory / name).write_text(textwrap.dedent(body).lstrip())


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", str(VERIFIER), *args],
        capture_output=True,
        text=True,
    )


# ── CE-side checks ──────────────────────────────────────────────────────────

def _seed_minimal_ce_root(root: Path) -> None:
    """Lay down a minimal CE compose tree the verifier accepts."""
    (root / "acropolis").mkdir()
    _write(
        root,
        "docker-compose.yml",
        """
        services:
          php:
            container_name: parthenon-php
            image: ghcr.io/acumenus-data-sciences/parthenon-php:latest
          nginx:
            container_name: parthenon-nginx
            image: nginx:1.27-alpine
          node:
            container_name: parthenon-node
            image: ghcr.io/acumenus-data-sciences/parthenon-node:latest
          postgres:
            container_name: parthenon-postgres
            image: pgvector/pgvector:pg16
          redis:
            container_name: parthenon-redis
            image: redis:7-alpine
          python-ai:
            container_name: python-ai
            image: ghcr.io/acumenus-data-sciences/parthenon-python-ai:latest
          solr:
            container_name: parthenon-solr
            image: solr:9.7
          horizon:
            container_name: parthenon-horizon
            image: ghcr.io/acumenus-data-sciences/parthenon-php:latest
          fhir-to-cdm:
            container_name: parthenon-fhir-to-cdm
            image: ghcr.io/acumenus-data-sciences/parthenon-fhir-to-cdm:latest
          study-agent:
            container_name: parthenon-study-agent
            image: ghcr.io/acumenus-data-sciences/parthenon-study-agent:latest
          hecate:
            container_name: parthenon-hecate
            image: ghcr.io/acumenus-data-sciences/parthenon-hecate:latest
        volumes:
          parthenon-storage:
        """,
    )
    _write(
        root / "acropolis",
        "docker-compose.base.yml",
        """
        services:
          traefik:
            container_name: acropolis-traefik
            image: traefik:v3.1
        volumes: {}
        """,
    )
    _write(
        root / "acropolis",
        "docker-compose.community.yml",
        """
        services:
          portainer:
            container_name: acropolis-portainer
            image: portainer/portainer-ce:2.21.4
          pgadmin:
            container_name: acropolis-pgadmin
            image: dpage/pgadmin4:8.12
        volumes: {}
        """,
    )


def test_ce_passes_on_minimal_valid_repo() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _seed_minimal_ce_root(root)
        result = _run("--repo-root", str(root))
        assert result.returncode == 0, result.stdout + result.stderr


def test_ce_fails_when_image_outside_namespace() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _seed_minimal_ce_root(root)
        # Overwrite php with an out-of-namespace ghcr image.
        _write(
            root,
            "docker-compose.yml",
            """
            services:
              php:
                container_name: parthenon-php
                image: ghcr.io/some-other-org/something:latest
            """,
        )
        result = _run("--repo-root", str(root))
        assert result.returncode == 1
        assert "not in acumenus-data-sciences/parthenon-* namespace" in result.stdout


def test_ce_fails_when_required_stable_service_is_missing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "acropolis").mkdir()
        # Only define php, leave others missing.
        _write(
            root,
            "docker-compose.yml",
            """
            services:
              php:
                container_name: parthenon-php
                image: ghcr.io/acumenus-data-sciences/parthenon-php:latest
            """,
        )
        _write(root / "acropolis", "docker-compose.base.yml", "services: {}\n")
        result = _run("--repo-root", str(root))
        assert result.returncode == 1
        assert "missing required stable service" in result.stdout


def test_ce_fails_when_container_name_does_not_match_convention() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _seed_minimal_ce_root(root)
        _write(
            root,
            "docker-compose.yml",
            """
            services:
              php:
                container_name: my-weird-php
                image: ghcr.io/acumenus-data-sciences/parthenon-php:latest
            """,
        )
        result = _run("--repo-root", str(root))
        assert result.returncode == 1
        assert "non-standard container_name" in result.stdout


def test_ce_fails_when_volume_uses_ee_prefix() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _seed_minimal_ce_root(root)
        _write(
            root,
            "docker-compose.yml",
            """
            services: {}
            volumes:
              parthenon-ee-leak:
            """,
        )
        result = _run("--repo-root", str(root))
        assert result.returncode == 1
        assert "EE-prefixed volume" in result.stdout


# ── EE overlay checks ───────────────────────────────────────────────────────

def test_ee_passes_on_valid_overlay() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services:
              keycloak:
                container_name: parthenon-ee-keycloak
                image: ghcr.io/acumenus-data-sciences/parthenon-ee-keycloak:latest
                ports:
                  - "8181:8080"
            volumes:
              parthenon-ee-keycloak-data:
            networks:
              parthenon-ee-keycloak: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        # --ce-only means "skip CE checks"; the valid overlay alone should
        # produce zero violations.
        assert result.returncode == 0, result.stdout + result.stderr


def test_ee_fails_when_low_port_collides_with_ce() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services:
              keycloak:
                ports:
                  - "8081:8080"
                image: ghcr.io/acumenus-data-sciences/parthenon-ee-keycloak:latest
            volumes:
              parthenon-ee-keycloak-data: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        assert result.returncode == 1
        assert "binds host port" in result.stdout


def test_ee_fails_when_overriding_container_name_of_stable_service() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services:
              php:
                container_name: parthenon-ee-php-fips
            volumes:
              parthenon-ee-data: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        assert result.returncode == 1
        assert "container_name on stable service" in result.stdout


def test_ee_fails_when_volume_not_prefixed() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services: {}
            volumes:
              keycloak-data: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        assert result.returncode == 1
        assert "not parthenon-ee-* prefixed" in result.stdout


def test_ee_fails_when_network_not_prefixed() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services: {}
            volumes:
              parthenon-ee-data: {}
            networks:
              keycloak-net: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        assert result.returncode == 1
        assert "not parthenon-ee-* prefixed" in result.stdout


def test_ee_fails_when_image_outside_ee_namespace() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services:
              proprietary:
                image: ghcr.io/some-vendor/secret:1.0
                ports:
                  - "9100:9100"
            volumes:
              parthenon-ee-data: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        assert result.returncode == 1
        assert "not in expected namespace" in result.stdout


def test_ee_fails_when_healthcheck_is_no_op() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ee = Path(tmp) / "ee.yml"
        _write(
            Path(tmp),
            "ee.yml",
            """
            services:
              php:
                healthcheck:
                  test: ["CMD-SHELL", "true"]
            volumes:
              parthenon-ee-data: {}
            """,
        )
        result = _run("--check-ee", str(ee), "--ce-only")
        assert result.returncode == 1
        assert "weakens healthcheck" in result.stdout


# ── Live repo smoke ─────────────────────────────────────────────────────────

def test_actual_repo_compose_satisfies_contract() -> None:
    """The repo's own compose files must satisfy the contract on every PR."""
    repo_root = Path(__file__).resolve().parent.parent
    result = _run("--repo-root", str(repo_root))
    assert result.returncode == 0, result.stdout + result.stderr
