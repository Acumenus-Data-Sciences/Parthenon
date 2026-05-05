"""The shipped anonymizer config library validates and covers expected fields."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from runtime.nodes.anonymizer_config import load_config

LIBRARY = Path(__file__).resolve().parents[2] / "runtime" / "instruments" / "anonymizer_configs"


@pytest.mark.parametrize("name", ["hipaa_safe_harbor", "minimal_redaction"])
def test_library_config_validates(name: str) -> None:
    cfg = json.loads((LIBRARY / f"{name}.json").read_text(encoding="utf-8"))
    parsed = load_config(cfg)
    assert parsed.version == "1"


def test_hipaa_safe_harbor_redacts_18_identifiers_minimum() -> None:
    """Spot-check that the HIPAA config redacts the obvious Safe Harbor fields."""
    cfg = json.loads((LIBRARY / "hipaa_safe_harbor.json").read_text(encoding="utf-8"))
    paths_redacted = {r["path"] for r in cfg["rules"] if r["operation"] == "redact"}
    expected_redacted_paths = {
        "Patient.name",
        "Patient.address",
        "Patient.telecom",
        "Patient.identifier",
        "Patient.photo",
    }
    assert expected_redacted_paths.issubset(
        paths_redacted
    ), f"missing HIPAA fields in redact list: {expected_redacted_paths - paths_redacted}"


def test_hipaa_safe_harbor_dateshifts_birthdate() -> None:
    cfg = json.loads((LIBRARY / "hipaa_safe_harbor.json").read_text(encoding="utf-8"))
    rules_for_birthdate = [r for r in cfg["rules"] if r["path"] == "Patient.birthDate"]
    assert rules_for_birthdate
    assert rules_for_birthdate[0]["operation"] == "dateShift"


def test_hipaa_safe_harbor_hashes_patient_id() -> None:
    cfg = json.loads((LIBRARY / "hipaa_safe_harbor.json").read_text(encoding="utf-8"))
    rules_for_id = [r for r in cfg["rules"] if r["path"] == "Patient.id"]
    assert rules_for_id
    assert rules_for_id[0]["operation"] == "cryptoHash"


def test_minimal_redaction_keeps_gender() -> None:
    """minimal_redaction is research-friendly: keeps gender for cohort selection."""
    cfg = json.loads((LIBRARY / "minimal_redaction.json").read_text(encoding="utf-8"))
    keep_paths = {r["path"] for r in cfg["rules"] if r["operation"] == "keep"}
    assert "Patient.gender" in keep_paths


def test_library_readme_exists() -> None:
    assert (LIBRARY / "README.md").exists()
    text = (LIBRARY / "README.md").read_text(encoding="utf-8")
    assert "hipaa_safe_harbor" in text.lower()
    assert "minimal_redaction" in text.lower()
