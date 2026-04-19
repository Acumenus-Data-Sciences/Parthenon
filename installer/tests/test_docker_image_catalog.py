from __future__ import annotations

import re
from pathlib import Path

from installer import docker_ops


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/docker-build.yml"
COMPOSE = ROOT / "docker-compose.yml"
COMMUNITY_COMPOSE = ROOT / "docker-compose.community.yml"
JUPYTER_CONFIG = ROOT / "docker/jupyterhub/jupyterhub_config.py"

EXPECTED_WORKFLOW_IMAGES = {
    "nginx",
    "php",
    "node",
    "postgres",
    "solr",
    "python-ai",
    "study-agent",
    "jupyterhub",
    "jupyter-user",
    "darkstar",
    "hecate",
    "blackrabbit",
    "fhir-to-cdm",
    "ohif-build",
}


def _workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def _workflow_dispatch_options(text: str) -> set[str]:
    match = re.search(r"options:\n(?P<body>(?:\s+- [a-z0-9-]+\n)+)", text)
    assert match is not None
    return set(re.findall(r"- ([a-z0-9-]+)", match.group("body")))


def _workflow_case_images(text: str) -> set[str]:
    return set(re.findall(r"^\s+([a-z0-9-]+)\)\s+DOCKERFILE=", text, re.MULTILINE))


def test_docker_workflow_uses_current_image_catalog() -> None:
    text = _workflow_text()

    assert "morpheus-ingest" not in text
    assert "whiterabbit" not in text
    assert "blackrabbit" in text
    assert _workflow_dispatch_options(text) == EXPECTED_WORKFLOW_IMAGES | {"all"}
    assert _workflow_case_images(text) == EXPECTED_WORKFLOW_IMAGES


def test_workflow_dockerfiles_and_contexts_exist() -> None:
    text = _workflow_text()

    for raw_path in re.findall(r'DOCKERFILE="([^"]+)"', text):
        dockerfile = ROOT / raw_path.removeprefix("./")
        assert dockerfile.is_file(), raw_path

    for raw_path in re.findall(r'CONTEXT="([^"]+)"', text):
        context = ROOT / raw_path.removeprefix("./")
        assert context.is_dir(), raw_path


def test_compose_ghcr_images_are_buildable_by_workflow() -> None:
    compose = "\n".join(
        path.read_text(encoding="utf-8") for path in (COMPOSE, COMMUNITY_COMPOSE)
    )
    workflow_images = _workflow_dispatch_options(_workflow_text()) - {"all"}
    compose_images = set(
        re.findall(
            r"ghcr\.io/sudoshi/parthenon-([a-z0-9-]+):(?:latest|\$\{PARTHENON_IMAGE_TAG:-latest\})",
            compose,
        )
    )

    assert "morpheus-ingest" not in compose
    assert compose_images <= workflow_images


def test_community_runtime_compose_avoids_app_source_mounts() -> None:
    compose = COMMUNITY_COMPOSE.read_text(encoding="utf-8")

    assert "build:" not in compose
    assert "./backend:/var/www/html" not in compose
    assert "./frontend" not in compose
    assert "./solr/configsets" not in compose
    assert "ghcr.io/sudoshi/parthenon-nginx:${PARTHENON_IMAGE_TAG:-latest}" in compose
    assert "ghcr.io/sudoshi/parthenon-solr:${PARTHENON_IMAGE_TAG:-latest}" in compose


def test_community_runtime_compose_covers_installer_services() -> None:
    compose = COMMUNITY_COMPOSE.read_text(encoding="utf-8")
    compose_services = set(re.findall(r"^  ([a-z0-9-]+):\n", compose, re.MULTILINE))
    selected_services = set(
        docker_ops.compose_service_names(
            {
                "edition": "Community Edition",
                "enable_solr": True,
                "enable_study_agent": True,
                "enable_hecate": True,
                "enable_blackrabbit": True,
                "enable_fhir_to_cdm": True,
                "enable_orthanc": True,
            }
        )
    )

    assert selected_services <= compose_services
    assert "horizon" in compose_services


def test_jupyterhub_uses_registry_user_image_by_default() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")
    config = JUPYTER_CONFIG.read_text(encoding="utf-8")

    assert "ghcr.io/sudoshi/parthenon-jupyter-user:latest" in compose
    assert "ghcr.io/sudoshi/parthenon-jupyter-user:latest" in config
    assert 'pull_policy = "never"' not in config
