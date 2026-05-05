"""Sanity checks on the GitHub Actions workflow for parthenon-templates."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

REPO = Path(__file__).resolve().parents[2]
WORKFLOW = REPO / ".github" / "workflows" / "templates.yml"


@pytest.fixture(scope="module")
def workflow() -> dict[str, object]:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def test_workflow_runs_on_push_and_pr(workflow: dict[str, object]) -> None:
    # PyYAML parses bare ``on:`` as the boolean ``True`` key in some versions.
    on = workflow["on"] if "on" in workflow else workflow[True]  # type: ignore[index]
    assert "push" in on  # type: ignore[operator]
    assert "pull_request" in on  # type: ignore[operator]


def test_workflow_runs_on_python_3_12(workflow: dict[str, object]) -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    assert 'python-version: "3.12"' in text or "python-version: '3.12'" in text


def test_workflow_runs_lint_steps(workflow: dict[str, object]) -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    for needle in (
        "uv run ruff check",
        "uv run mypy --strict runtime",
        "uv run parthenon-templates validate-manifests",
        "uv run pytest",
    ):
        assert needle in text, f"workflow missing step: {needle}"


def test_workflow_uses_postgres_service(workflow: dict[str, object]) -> None:
    """Templates CI uses a Postgres service, NOT Docker compose Postgres."""
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "services:" in text
    assert "postgres:" in text
    assert "image: postgres:16" in text


def test_workflow_path_filtered_to_templates(workflow: dict[str, object]) -> None:
    """The workflow only runs when templates/ or its workflow file changes."""
    text = WORKFLOW.read_text(encoding="utf-8")
    assert '"templates/**"' in text
    assert '".github/workflows/templates.yml"' in text


def test_workflow_installs_r_base_core(workflow: dict[str, object]) -> None:
    """RNode tests need Rscript on PATH; CI must install r-base-core."""
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "r-base-core" in text
