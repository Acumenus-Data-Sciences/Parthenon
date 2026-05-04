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


# --- PR-B (Plan 6) extension tests ---


def test_manifest_pr_b_imports() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.procedure",
        "runtime.fhir_to_omop.medication",
        "runtime.fhir_to_omop.immunization",
    ):
        assert module in text


def test_manifest_pr_b_resource_types_in_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    ingest = next(n for n in payload["spec"]["nodes"] if n["node_id"] == "ingest_fhir")
    rt = ingest["params"]["resource_types"]
    for resource in (
        "Patient",
        "Encounter",
        "Condition",
        "Observation",
        "Procedure",
        "MedicationRequest",
        "MedicationStatement",
        "MedicationAdministration",
        "Immunization",
    ):
        assert resource in rt, f"manifest missing PR-B resource type: {resource}"


def test_manifest_pr_b_load_targets_drug_exposure_and_procedure() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    assert "procedure_occurrence" in text
    assert "drug_exposure" in text


def test_pr_b_fixtures_present() -> None:
    fixtures = MANIFEST.parent / "fixtures" / "sample"
    for f in ("Procedure.ndjson", "MedicationRequest.ndjson", "Immunization.ndjson"):
        assert (fixtures / f).exists(), f"missing PR-B fixture: {f}"


def test_pr_b_post_conditions_added() -> None:
    pc = yaml.safe_load(
        (MANIFEST.parent / "validation" / "expected" / "post_conditions.yaml").read_text("utf-8")
    )
    tables = {p.get("table") for p in pc["post_conditions"]}
    assert any("procedure_occurrence" in str(t) for t in tables)
    assert any("drug_exposure" in str(t) for t in tables)


def test_readme_documents_pr_b_resources() -> None:
    text = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    for resource in ("Procedure", "MedicationRequest", "Immunization"):
        assert resource in text
    for cid in ("32839", "38000179", "38000180", "581452"):
        assert cid in text


def test_adr_0008_has_pr_b_amendment() -> None:
    adr = Path(__file__).resolve().parents[3] / "docs" / "adr" / "0008-fhir-to-omop-architecture.md"
    text = adr.read_text(encoding="utf-8")
    assert "PR-B" in text
    assert "drug_type_concept_id" in text
    assert "medicationReference" in text
    assert "CVX" in text


# --- PR-C (Plan 7) extension tests ---


def test_manifest_pr_c_imports() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    for module in (
        "runtime.fhir_to_omop.diagnostic_report",
        "runtime.fhir_to_omop.consent",
    ):
        assert module in text


def test_manifest_pr_c_resource_types_in_ingestion() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    ingest = next(n for n in payload["spec"]["nodes"] if n["node_id"] == "ingest_fhir")
    rt = ingest["params"]["resource_types"]
    for resource in ("DiagnosticReport", "Consent"):
        assert resource in rt, f"manifest missing PR-C resource type: {resource}"


def test_manifest_pr_c_consent_params() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "consent_permit_concept_id" in props
    assert "consent_deny_concept_id" in props


def test_manifest_pr_c_load_writes_consent_decisions() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    assert "consent_decisions" in text


def test_pr_c_consent_decisions_migration_exists() -> None:
    backend = Path(__file__).resolve().parents[3] / "backend"
    matches = list(backend.glob("database/migrations/*_create_consent_decisions_table.php"))
    assert matches, "Laravel migration for app.consent_decisions not found"
