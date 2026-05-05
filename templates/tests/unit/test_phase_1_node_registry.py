"""Phase 1 nodes are wired into the orchestrator's NODE_REGISTRY and the manifest schema."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.base import Node
from runtime.nodes.dicom_metadata import DicomMetadataNode
from runtime.nodes.fhir_resource import FhirResourceNode
from runtime.orchestration.node_registry import NODE_REGISTRY, get_node_class
from runtime.registry.manifest import NODE_TYPES

SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "runtime" / "registry" / "schema" / "template.v1.json"
)


@pytest.mark.parametrize(
    ("type_name", "cls"),
    [
        ("fhir_resource", FhirResourceNode),
        ("dicom_metadata", DicomMetadataNode),
        ("anonymizer", AnonymizerNode),
    ],
)
def test_phase_1_nodes_registered(type_name: str, cls: type[Node]) -> None:
    assert NODE_REGISTRY.get(type_name) is cls
    assert get_node_class(type_name) is cls


@pytest.mark.parametrize("node_type", ["fhir_resource", "dicom_metadata", "anonymizer"])
def test_phase_1_node_types_in_manifest_NODE_TYPES(node_type: str) -> None:
    assert node_type in NODE_TYPES


@pytest.mark.parametrize("node_type", ["fhir_resource", "dicom_metadata", "anonymizer"])
def test_phase_1_node_types_accepted_by_schema(node_type: str) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    manifest = {
        "apiVersion": "parthenon.acumenus.net/v1",
        "kind": "Template",
        "metadata": {
            "id": "phase1_node_probe",
            "name": "probe",
            "version": "0.1.0",
            "owner": "templates@acumenus.net",
            "license": "Apache-2.0",
        },
        "spec": {
            "cdm_versions": ["5.4"],
            "nodes": [
                {"node_id": "n0", "type": node_type, "params": {}},
            ],
        },
    }
    errors = list(Draft202012Validator(schema).iter_errors(manifest))
    type_path_errors = [e for e in errors if "type" in [str(p) for p in e.absolute_path]]
    assert not type_path_errors, [
        (".".join(str(p) for p in e.absolute_path), e.message) for e in type_path_errors
    ]
