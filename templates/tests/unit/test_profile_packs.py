"""Profile packs ship as curated JSON, one file per FHIR profile."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

PROFILE_PACK_ROOT = Path(__file__).resolve().parents[2] / "runtime" / "nodes" / "profile_packs"
EXPECTED = ["us-core", "mcode", "ips", "mii"]


@pytest.mark.parametrize("profile", EXPECTED)
def test_profile_pack_exists_and_parses(profile: str) -> None:
    path = PROFILE_PACK_ROOT / f"{profile}.json"
    assert path.exists(), f"profile pack missing: {path}"
    payload = json.loads(path.read_text(encoding="utf-8"))
    # Every pack has a name, version, and a non-empty resources list.
    assert payload["profile"] == profile
    assert isinstance(payload["version"], str) and payload["version"]
    assert isinstance(payload["resources"], list) and payload["resources"]


def test_profile_pack_resources_are_known_fhir_types() -> None:
    """Every resource declared in a pack is a real FHIR R4 resource type."""
    known = {
        "Patient",
        "Encounter",
        "Condition",
        "Observation",
        "Procedure",
        "MedicationRequest",
        "MedicationStatement",
        "MedicationAdministration",
        "Immunization",
        "DiagnosticReport",
        "Consent",
        "QuestionnaireResponse",
        "AllergyIntolerance",
        "DocumentReference",
        "Specimen",
        "ImagingStudy",
    }
    for profile in EXPECTED:
        payload = json.loads((PROFILE_PACK_ROOT / f"{profile}.json").read_text("utf-8"))
        for r in payload["resources"]:
            assert r["type"] in known, f"{profile}.json: unknown resource type {r['type']!r}"
