"""Integration tests: sql_node end-to-end via the Materializer + FlowSpec path.

Phase 3 Plan 0 Task 3 (T-022). The unit suite in
``tests/unit/test_sql_node.py`` covers the in-process resolver wiring; here
we stress the Materializer → FlowSpec → SqlNode handoff so a regression in
``manifest_dir`` plumbing surfaces immediately.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest
import yaml

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.sql_node import SqlNode
from runtime.registry.manifest import load_manifest_from_path
from runtime.registry.materializer import Materializer


@pytest.fixture()
def manifest_with_sql_files(tmp_path: Path) -> Path:
    """Synthesize a complete manifest dir + bootstrap SQL on disk."""
    manifest_dir = tmp_path / "demo_template"
    sql_dir = manifest_dir / "sql"
    sql_dir.mkdir(parents=True)
    (sql_dir / "00_bootstrap.sql").write_text(
        "CREATE TABLE ${parameters.target_schema}_orders (id INTEGER, status TEXT);",
        encoding="utf-8",
    )
    (sql_dir / "01_seed.sql").write_text(
        "INSERT INTO ${parameters.target_schema}_orders (id, status) VALUES (1, 'open');",
        encoding="utf-8",
    )
    (sql_dir / "99_summary.sql").write_text(
        "SELECT id, status FROM ${parameters.target_schema}_orders ORDER BY id",
        encoding="utf-8",
    )

    manifest_payload = {
        "apiVersion": "parthenon.acumenus.net/v1",
        "kind": "Template",
        "metadata": {
            "id": "sql_file_integration",
            "name": "sql_file integration",
            "version": "0.1.0",
            "category": "ingestion",
            "cdm_versions": ["5.4"],
        },
        "spec": {
            "parameters": {
                "type": "object",
                "properties": {"target_schema": {"type": "string"}},
                "required": ["target_schema"],
            },
            "requires": {"cdm_initialized": False, "vocabularies": []},
            "nodes": [
                {
                    "node_id": "bootstrap",
                    "type": "sql",
                    "params": {"sql_file": "file://sql/00_bootstrap.sql"},
                },
                {
                    "node_id": "seed",
                    "type": "sql",
                    "depends_on": ["bootstrap"],
                    "params": {"sql_file": "file://sql/01_seed.sql"},
                },
                {
                    "node_id": "summarize",
                    "type": "sql",
                    "depends_on": ["seed"],
                    "params": {
                        "statements": ["SELECT 1"],
                        "fetch_query_file": "file://sql/99_summary.sql",
                        "result_artifact": "summary",
                    },
                },
            ],
            "post_conditions": [],
        },
    }
    (manifest_dir / "manifest.yaml").write_text(
        yaml.safe_dump(manifest_payload), encoding="utf-8"
    )
    return manifest_dir


def test_materializer_propagates_manifest_dir(manifest_with_sql_files: Path) -> None:
    manifest = load_manifest_from_path(manifest_with_sql_files / "manifest.yaml")
    flow, _ = Materializer().materialize(
        manifest, {"target_schema": "demo"}, manifest_dir=manifest_with_sql_files
    )
    assert flow.manifest_dir == manifest_with_sql_files


def test_full_pipeline_against_sqlite(
    manifest_with_sql_files: Path, tmp_path: Path
) -> None:
    """End-to-end: each FlowNode runs SqlNode.run with the manifest_dir set.

    Mirrors what the Prefect backend does, minus the Prefect runtime.
    """
    manifest = load_manifest_from_path(manifest_with_sql_files / "manifest.yaml")
    flow, _ = Materializer().materialize(
        manifest, {"target_schema": "demo"}, manifest_dir=manifest_with_sql_files
    )
    sqlite_url = f"sqlite:///{tmp_path / 'integration.db'}"

    rows: list[dict[str, Any]] = []
    for fnode in flow.nodes:
        ctx = NodeContext(
            run_id="run-1",
            node_id=fnode.node_id,
            logger=logging.getLogger(f"test.integration.{fnode.node_id}"),
            secrets={},
            artifact_dir=tmp_path,
            db_dsn=sqlite_url,
            manifest_dir=flow.manifest_dir,
            run_parameters=dict(flow.parameters),
        )
        result = SqlNode().run(ctx, dict(fnode.params))
        assert result.status == NodeStatus.SUCCESS, (
            f"node {fnode.node_id} failed: {result.error_message}"
        )
        if "rows" in result.outputs:
            rows = list(result.outputs["rows"])

    assert rows == [{"id": 1, "status": "open"}]


def test_sql_file_traversal_blocked_through_full_pipeline(
    tmp_path: Path,
) -> None:
    """A manifest that asks for ../etc/passwd fails fast at SqlNode."""
    manifest_dir = tmp_path / "evil"
    manifest_dir.mkdir()
    ctx = NodeContext(
        run_id="run-evil",
        node_id="bad",
        logger=logging.getLogger("test.evil"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=f"sqlite:///{tmp_path / 'e.db'}",
        manifest_dir=manifest_dir,
    )
    result = SqlNode().run(ctx, {"sql_file": "file://../../etc/passwd"})
    assert result.status == NodeStatus.FAILED
    msg = (result.error_message or "").lower()
    assert "outside manifest dir" in msg
