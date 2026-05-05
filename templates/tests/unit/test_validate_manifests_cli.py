"""Tests for the parthenon-templates CLI (validate-manifests + lint-secret-keys)."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from runtime.cli import app

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid"
INVALID = REPO / "tests" / "fixtures" / "manifests_invalid"


@pytest.fixture()
def runner() -> CliRunner:
    return CliRunner()


def test_validate_passes_on_valid_directory(runner: CliRunner) -> None:
    result = runner.invoke(app, ["validate-manifests", "--root", str(VALID)])
    assert result.exit_code == 0, result.output
    assert "OK" in result.output


def test_validate_fails_on_invalid_directory(runner: CliRunner, tmp_path: Path) -> None:
    bad_root = tmp_path / "manifests"
    (bad_root / "missing_required").mkdir(parents=True)
    (bad_root / "missing_required" / "manifest.yaml").write_bytes(
        (INVALID / "missing_required.yaml").read_bytes()
    )
    result = runner.invoke(app, ["validate-manifests", "--root", str(bad_root)])
    assert result.exit_code != 0
    assert "missing_required" in result.output


def test_lint_secret_keys_flags_unmarked_token(runner: CliRunner, tmp_path: Path) -> None:
    bad_root = tmp_path / "manifests"
    (bad_root / "leaky").mkdir(parents=True)
    (bad_root / "leaky" / "manifest.yaml").write_text(
        (
            "apiVersion: parthenon.acumenus.net/v1\n"
            "kind: Template\n"
            "metadata:\n"
            "  id: leaky\n"
            "  name: Leaky\n"
            "  version: 0.1.0\n"
            "  category: diagnostic\n"
            "  cdm_versions: []\n"
            "spec:\n"
            "  parameters:\n"
            "    type: object\n"
            "    properties:\n"
            "      github_token: {type: string}\n"
            "    required: [github_token]\n"
            "  requires: {cdm_initialized: false, vocabularies: []}\n"
            "  nodes:\n"
            "    - node_id: a\n"
            "      type: python\n"
            "      params:\n"
            "        code: |\n"
            "          def main(c, p):\n"
            "              return {}\n"
            "        inputs: {}\n"
            "  post_conditions: []\n"
        ),
        encoding="utf-8",
    )
    result = runner.invoke(app, ["lint-secret-keys", "--root", str(bad_root)])
    assert result.exit_code != 0
    assert "github_token" in result.output


def test_lint_secret_keys_passes_when_marked(runner: CliRunner) -> None:
    result = runner.invoke(app, ["lint-secret-keys", "--root", str(VALID)])
    assert result.exit_code == 0
