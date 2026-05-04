"""qr_eq5d5l_to_measurement manifest validates against template.v1.json."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "qr_eq5d5l_to_measurement" / "manifest.yaml"
)
VAL_ROOT = MANIFEST.parent / "validation"
FIXTURES = MANIFEST.parent / "fixtures" / "sample"


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "qr_eq5d5l_to_measurement"
    assert manifest.metadata.category == "ingestion"


def test_manifest_uses_fhir_resource_node() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


def test_manifest_imports_pro_base() -> None:
    """The python nodes must reference runtime.instruments.pro_base for the reuse contract."""
    text = MANIFEST.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


def test_manifest_declares_eq5d_value_set_path_param() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "eq5d_value_set_path" in props
    assert "placeholder" in props["eq5d_value_set_path"]["default"].lower()


def test_validation_pack_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_fixture_ndjson_present_and_parseable() -> None:
    fixture = FIXTURES / "QuestionnaireResponse.ndjson"
    assert fixture.exists()
    lines = [line for line in fixture.read_text("utf-8").splitlines() if line.strip()]
    assert len(lines) >= 2
    for line in lines:
        qr = json.loads(line)
        assert qr["resourceType"] == "QuestionnaireResponse"


def test_inputs_parameters_satisfy_required() -> None:
    inputs = json.loads((VAL_ROOT / "inputs" / "parameters.json").read_text("utf-8"))
    for required in (
        "source",
        "target_schema",
        "mo_concept_id",
        "sc_concept_id",
        "ua_concept_id",
        "pd_concept_id",
        "ad_concept_id",
        "vas_concept_id",
        "utility_concept_id",
    ):
        assert required in inputs, f"missing: {required}"
