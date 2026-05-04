"""fhir_to_omop manifest validates and uses Plan 5 mappers."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "fhir_to_omop" / "manifest.yaml"
VAL_ROOT = MANIFEST.parent / "validation"
FIXTURES = MANIFEST.parent / "fixtures" / "sample"


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


def test_validation_pack_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_fixture_corpus_present() -> None:
    """4 NDJSON files (Patient, Encounter, Condition, Observation)."""
    expected = {
        "Patient.ndjson",
        "Encounter.ndjson",
        "Condition.ndjson",
        "Observation.ndjson",
    }
    actual = {p.name for p in FIXTURES.glob("*.ndjson")}
    assert expected.issubset(actual), f"missing fixture files: {expected - actual}"


def test_fixture_resources_marked_synthetic() -> None:
    """Every fixture line must carry the SYNTHETIC tag."""
    for f in FIXTURES.glob("*.ndjson"):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            obj = json.loads(line)
            tag = obj.get("meta", {}).get("tag", [])
            assert any(
                t.get("code") == "SYNTHETIC" for t in tag
            ), f"missing SYNTHETIC tag in {f.name}"


def test_post_conditions_assert_pra_resource_counts() -> None:
    pc = yaml.safe_load(
        (VAL_ROOT / "expected" / "post_conditions.yaml").read_text(encoding="utf-8")
    )
    tables = {p["table"]: p for p in pc["post_conditions"] if p["kind"] == "row_count"}
    assert tables["omop.person"]["expected"] == 2
    assert tables["omop.visit_occurrence"]["expected"] == 2
    assert tables["omop.condition_occurrence"]["expected"] == 2
    assert tables["omop.measurement"]["expected"] == 2
    assert tables["omop.observation"]["expected"] == 2


REQUIRED_HEADINGS = [
    "## What it does",
    "## When to use it",
    "## Parameters",
    "## Prerequisites",
    "## Examples",
    "## Limitations",
    "## License / attribution",
    "## Security notes",
]


def test_readme_has_required_sections() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for h in REQUIRED_HEADINGS:
        assert h in text, f"README missing section: {h}"


def test_readme_documents_pr_a_scope_and_pr_b_pr_c_deferral() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    assert "PR-A" in text
    assert "PR-B" in text or "Plan 6" in text
    assert "PR-C" in text or "Plan 7" in text
