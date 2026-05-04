"""AnonymizerNode: backend selector + per-run salt + anonymized output dir."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.base import NodeContext, NodeStatus


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-anon",
        node_id="anon-1",
        logger=logging.getLogger("test.anon"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


VALID_CFG: dict = {
    "version": "1",
    "rules": [{"path": "Patient.name", "operation": "redact"}],
}


def _write_resources(dir_: Path, resources: list[dict]) -> None:
    dir_.mkdir(parents=True, exist_ok=True)
    for i, r in enumerate(resources):
        (dir_ / f"resource_{i}.json").write_text(json.dumps(r), encoding="utf-8")


def test_type_name() -> None:
    assert AnonymizerNode.type_name == "anonymizer"


def test_native_backend_anonymizes_directory(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "in"
    _write_resources(
        src,
        [
            {"resourceType": "Patient", "id": "p1", "name": [{"family": "Doe"}]},
            {"resourceType": "Patient", "id": "p2", "name": [{"family": "Smith"}]},
        ],
    )
    result = AnonymizerNode().run(
        context,
        {"backend": "native", "input_dir": str(src), "config": VALID_CFG},
    )
    assert result.status == NodeStatus.SUCCESS, result.error_message
    out_dir = tmp_path / "anonymized"
    assert out_dir.exists()
    files = sorted(out_dir.glob("*.json"))
    assert len(files) == 2
    for f in files:
        payload = json.loads(f.read_text("utf-8"))
        assert payload["name"] == "***REDACTED***"


def test_unknown_backend_fails(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "in"
    _write_resources(src, [])
    result = AnonymizerNode().run(
        context,
        {"backend": "made-up", "input_dir": str(src), "config": VALID_CFG},
    )
    assert result.status == NodeStatus.FAILED
    assert "backend" in (result.error_message or "")


def test_invalid_config_fails(context: NodeContext, tmp_path: Path) -> None:
    src = tmp_path / "in"
    _write_resources(src, [])
    result = AnonymizerNode().run(
        context,
        {
            "backend": "native",
            "input_dir": str(src),
            "config": {"rules": []},  # missing version
        },
    )
    assert result.status == NodeStatus.FAILED
    assert "config" in (result.error_message or "").lower()


def test_outputs_record_salt_digest_only(context: NodeContext, tmp_path: Path) -> None:
    """The result outputs include the salt's SHA-256 digest (audit trail) but not the salt itself."""
    src = tmp_path / "in"
    _write_resources(src, [{"resourceType": "Patient", "id": "p1"}])
    result = AnonymizerNode().run(
        context,
        {"backend": "native", "input_dir": str(src), "config": VALID_CFG},
    )
    assert result.status == NodeStatus.SUCCESS, result.error_message
    assert "salt_digest" in result.outputs
    assert len(result.outputs["salt_digest"]) == 64  # sha256 hex
    serialized = json.dumps(result.outputs)
    # The only "salt" mention should be inside "salt_digest" — never raw salt.
    assert serialized.count("salt") == serialized.count("salt_digest")


def test_missing_input_dir_fails(context: NodeContext) -> None:
    result = AnonymizerNode().run(
        context,
        {"backend": "native", "input_dir": "/nonexistent", "config": VALID_CFG},
    )
    assert result.status == NodeStatus.FAILED
    assert "input_dir" in (result.error_message or "")
