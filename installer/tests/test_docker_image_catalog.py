from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/docker-build.yml"
COMPOSE = ROOT / "docker-compose.yml"
JUPYTER_CONFIG = ROOT / "docker/jupyterhub/jupyterhub_config.py"

EXPECTED_WORKFLOW_IMAGES = {
    "php",
    "node",
    "postgres",
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
    compose = COMPOSE.read_text(encoding="utf-8")
    workflow_images = _workflow_dispatch_options(_workflow_text()) - {"all"}
    compose_images = set(
        re.findall(r"ghcr\.io/sudoshi/parthenon-([a-z0-9-]+):latest", compose)
    )

    assert "morpheus-ingest" not in compose
    assert compose_images <= workflow_images


def test_jupyterhub_uses_registry_user_image_by_default() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")
    config = JUPYTER_CONFIG.read_text(encoding="utf-8")

    assert "ghcr.io/sudoshi/parthenon-jupyter-user:latest" in compose
    assert "ghcr.io/sudoshi/parthenon-jupyter-user:latest" in config
    assert 'pull_policy = "never"' not in config
