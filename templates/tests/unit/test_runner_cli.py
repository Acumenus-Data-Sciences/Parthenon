"""Tests for the ``parthenon-nodes`` Typer CLI."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from runtime.runner import app


@pytest.fixture()
def cli() -> CliRunner:
    return CliRunner()


def test_run_python_node_inline(cli: CliRunner, tmp_path: Path) -> None:
    params_file = tmp_path / "params.json"
    params_file.write_text(
        json.dumps(
            {
                "code": "def main(context, params):\n    return {'value': params['x'] * 2}\n",
                "inputs": {"x": 21},
            }
        ),
        encoding="utf-8",
    )
    result = cli.invoke(
        app,
        [
            "run",
            "PythonNode",
            "--params",
            str(params_file),
            "--artifact-dir",
            str(tmp_path),
        ],
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["status"] == "success"
    assert payload["outputs"] == {"value": 42}


def test_run_unknown_node_class_fails(cli: CliRunner, tmp_path: Path) -> None:
    params_file = tmp_path / "p.json"
    params_file.write_text("{}", encoding="utf-8")
    result = cli.invoke(
        app,
        ["run", "DoesNotExist", "--params", str(params_file)],
    )
    assert result.exit_code != 0
    assert "unknown node" in result.output.lower()


def test_list_nodes_shows_eight_bootstrap_nodes(cli: CliRunner) -> None:
    result = cli.invoke(app, ["list"])
    assert result.exit_code == 0
    for name in (
        "PythonNode",
        "SqlNode",
        "CsvReaderNode",
        "DbReaderNode",
        "DbWriterNode",
        "Py2TableNode",
        "GenericFileNode",
        "RNode",
    ):
        assert name in result.output
