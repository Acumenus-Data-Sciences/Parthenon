"""fhir_to_omop manifest validates and uses Plan 5 mappers."""

from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "fhir_to_omop" / "manifest.yaml"


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "fhir_to_omop"
    assert manifest.metadata.category == "ingestion"


def test_manifest_imports_pra_mappers() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.patient",
        "runtime.fhir_to_omop.encounter",
        "runtime.fhir_to_omop.condition",
        "runtime.fhir_to_omop.observation",
    ):
        assert module in text


def test_manifest_uses_fhir_resource_for_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


def test_manifest_supports_strict_profile_match_param() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "strict_profile_match" in props


def test_manifest_targets_pr_a_resources() -> None:
    """PR-A scope: Patient, Encounter, Condition, Observation only."""
    text = MANIFEST.read_text(encoding="utf-8")
    for resource in ("Patient", "Encounter", "Condition", "Observation"):
        assert resource in text
