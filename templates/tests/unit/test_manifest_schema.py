"""JSON Schema check for manifest v1 plus invalid-fixture coverage."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator

REPO = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO / "runtime" / "registry" / "schema" / "template.v1.json"
INVALID_DIR = REPO / "tests" / "fixtures" / "manifests_invalid"
VALID_DIR = REPO / "tests" / "fixtures" / "manifests_valid"


@pytest.fixture(scope="module")
def schema() -> dict[str, object]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_schema_is_draft_2020_12_compatible(schema: dict[str, object]) -> None:
    Draft202012Validator.check_schema(schema)


def test_schema_requires_top_level_keys(schema: dict[str, object]) -> None:
    required = schema["required"]
    assert set(required) == {"apiVersion", "kind", "metadata", "spec"}  # type: ignore[arg-type]


def test_schema_requires_metadata_id_and_version(schema: dict[str, object]) -> None:
    metadata_required = schema["properties"]["metadata"]["required"]  # type: ignore[index]
    for key in ("id", "name", "version", "category", "cdm_versions"):
        assert key in metadata_required


def test_schema_describes_node_dag(schema: dict[str, object]) -> None:
    spec_props = schema["properties"]["spec"]["properties"]  # type: ignore[index]
    nodes = spec_props["nodes"]
    assert nodes["type"] == "array"
    item_required = nodes["items"]["required"]
    for key in ("node_id", "type"):
        assert key in item_required


def test_minimal_valid_manifest_passes(schema: dict[str, object]) -> None:
    manifest = yaml.safe_load((VALID_DIR / "minimal.yaml").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(manifest))
    assert errors == [], errors


def test_sql_node_accepts_sql_file_param(schema: dict[str, object]) -> None:
    """sql nodes may carry ``sql_file: file://...`` as a body source.

    Phase 3 Plan 0 (T-022): sql_node learns to read SQL bodies from disk.
    The node-level enforcement (``sql_file`` XOR ``statements``) lives in
    SqlNode itself; the schema must merely accept the parameter.
    """
    manifest = yaml.safe_load((VALID_DIR / "sql_file_node.yaml").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(manifest))
    assert errors == [], errors


@pytest.mark.parametrize(
    "fixture",
    ["missing_required.yaml", "unknown_node_type.yaml", "circular_dependency.yaml"],
)
def test_invalid_manifest_fixture_fails_schema_or_dag(
    fixture: str, schema: dict[str, object]
) -> None:
    """Schema rejects shape errors; DAG-shape errors (cycles) are caught by FlowSpec, not schema.

    The fixture file must be syntactically valid YAML; *some* of these failures
    only surface at materialization time. The schema test asserts that AT LEAST
    one of (a) schema rejects it OR (b) the file has a documented assertion
    in its leading comment.
    """
    text = (INVALID_DIR / fixture).read_text(encoding="utf-8")
    manifest = yaml.safe_load(text)
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(manifest))

    assertion_line = next(
        (line for line in text.splitlines() if line.startswith("# expected_error:")),
        None,
    )
    assert assertion_line is not None, "fixture must declare # expected_error: <reason>"
    if "schema" in assertion_line:
        assert errors, f"expected schema errors for {fixture}"
    elif "dag" in assertion_line:
        # DAG-shape failures are tested separately in Task 25/27.
        pass
