"""Local dev runner: ``parthenon-nodes run <NodeClass> --params params.json``.

Spawned via the ``parthenon-nodes`` console script (see ``[project.scripts]``
in pyproject.toml). Designed for dev / debugging — boots no FastAPI app, no
Prefect server, just instantiates a single :class:`runtime.nodes.base.Node`
subclass, runs it against a JSON params file, and prints the result envelope
to stdout. The :func:`list_nodes` subcommand prints the registry so authors
can discover what is wired in.

The CLI is intentionally minimal: the full orchestration story lives in the
HTTP API (see ``runtime/api.py``) and the orchestration adapter (Tasks 19+).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import typer

from runtime.nodes.base import Node, NodeContext
from runtime.nodes.csv_reader import CsvReaderNode
from runtime.nodes.db_reader import DbReaderNode
from runtime.nodes.db_writer import DbWriterNode
from runtime.nodes.generic_file import GenericFileNode
from runtime.nodes.py2table import Py2TableNode
from runtime.nodes.python_node import PythonNode
from runtime.nodes.r_node import RNode
from runtime.nodes.sql_node import SqlNode

app = typer.Typer(help="Run a single Node locally for dev / debugging.")

_REGISTRY: dict[str, type[Node]] = {
    "PythonNode": PythonNode,
    "SqlNode": SqlNode,
    "CsvReaderNode": CsvReaderNode,
    "DbReaderNode": DbReaderNode,
    "DbWriterNode": DbWriterNode,
    "Py2TableNode": Py2TableNode,
    "GenericFileNode": GenericFileNode,
    "RNode": RNode,
}


def _build_logger(node_class: str) -> logging.Logger:
    """Configure (idempotently) a stderr logger for the given node class."""
    logger = logging.getLogger(f"runner.{node_class}")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


@app.command("list")
def list_nodes() -> None:
    """List node classes available to the runner."""
    for name in sorted(_REGISTRY):
        typer.echo(f"{name:20} {_REGISTRY[name].type_name}")


@app.command("run")
def run_node(
    node_class: str = typer.Argument(..., help="One of: " + ", ".join(sorted(_REGISTRY))),
    params: Path = typer.Option(..., "--params", help="Path to JSON params file."),
    artifact_dir: Path | None = typer.Option(
        None,
        "--artifact-dir",
        help="Where the node should write artifacts (default: ./artifacts).",
    ),
    db_dsn: str | None = typer.Option(None, "--db-dsn", help="SQLAlchemy DSN, optional."),
    run_id: str = typer.Option("local", "--run-id"),
    node_id: str = typer.Option("local-node", "--node-id"),
    manifest_dir: Path | None = typer.Option(
        None,
        "--manifest-dir",
        help="Directory of the source manifest; required for sql_node sql_file.",
    ),
) -> None:
    """Execute a single node and print the JSON result to stdout."""
    cls = _REGISTRY.get(node_class)
    if cls is None:
        typer.echo(f"unknown node: {node_class!r}", err=True)
        raise typer.Exit(code=2)

    # Resolve artifact_dir lazily so the default is not evaluated at import.
    resolved_artifact_dir = artifact_dir if artifact_dir is not None else Path.cwd() / "artifacts"
    resolved_artifact_dir.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = json.loads(params.read_text(encoding="utf-8"))

    context = NodeContext(
        run_id=run_id,
        node_id=node_id,
        logger=_build_logger(node_class),
        secrets={},
        artifact_dir=resolved_artifact_dir,
        db_dsn=db_dsn,
        manifest_dir=manifest_dir,
    )
    node = cls()
    result = node.run(context, payload)
    typer.echo(
        json.dumps(
            {
                "status": result.status.value,
                "outputs": result.outputs,
                "artifacts": [
                    {
                        "name": a.name,
                        "path": str(a.path),
                        "media_type": a.media_type,
                        "size_bytes": a.size_bytes,
                    }
                    for a in result.artifacts
                ],
                "error_message": result.error_message,
            }
        )
    )
    if result.status.value == "failed":
        raise typer.Exit(code=1)


# Allow ``python -m runtime.runner`` for parity with the entrypoint.
if __name__ == "__main__":  # pragma: no cover
    app()


__all__ = ["app"]
