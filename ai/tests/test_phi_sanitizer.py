"""Tests for PHI Sanitizer — regex-based PHI detection and redaction."""
import sys
from types import SimpleNamespace

import pytest
from app.routing.phi_sanitizer import PHISanitizer, SanitizationResult


@pytest.fixture
def sanitizer() -> PHISanitizer:
    return PHISanitizer(use_ner=False)


def test_detects_ssn(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("Patient SSN is 123-45-6789")
    assert result.phi_detected is True
    types = [f.pattern_type for f in result.findings]
    assert "ssn" in types


def test_detects_mrn(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("MRN: 12345678")
    assert result.phi_detected is True


def test_detects_phone(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("Call patient at (555) 123-4567")
    assert result.phi_detected is True


def test_detects_email(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("Contact john.doe@hospital.org")
    assert result.phi_detected is True


def test_detects_dob_format(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("DOB: 03/15/1965")
    assert result.phi_detected is True


def test_clean_clinical_query(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("What is the prevalence of Type 2 diabetes?")
    assert result.phi_detected is False


def test_clean_aggregate_stats(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("There are 2,847 patients with HbA1c > 9.0")
    assert result.phi_detected is False


def test_clean_concept_names(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("SNOMED concept 201826 maps to Type 2 diabetes mellitus")
    assert result.phi_detected is False


def test_clean_cohort_definition(sanitizer: PHISanitizer) -> None:
    text = (
        "Cohort entry: first occurrence of Type 2 diabetes. "
        "Inclusion: age >= 18 at cohort entry date."
    )
    result = sanitizer.scan(text)
    assert result.phi_detected is False


def test_redaction_replaces_phi(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("Patient SSN is 123-45-6789")
    assert "123-45-6789" not in result.redacted_text
    assert "[REDACTED]" in result.redacted_text


def test_redaction_count(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan(
        "Patient SSN is 123-45-6789 and email is jane@hospital.org"
    )
    assert result.redaction_count >= 2


def test_multiple_phi_types(sanitizer: PHISanitizer) -> None:
    text = (
        "Patient John Smith, DOB: 01/12/1970, MRN: 98765432, "
        "call at (555) 987-6543"
    )
    result = sanitizer.scan(text)
    assert result.phi_detected is True
    assert result.redaction_count >= 3


def test_empty_string(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("")
    assert result.phi_detected is False


def test_concept_ids_not_flagged_as_mrn(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan(
        "Concept ID 4329847 represents heart failure in SNOMED hierarchy"
    )
    assert result.phi_detected is False


def test_year_not_flagged_as_dob(sanitizer: PHISanitizer) -> None:
    result = sanitizer.scan("Data from 2019 to 2024 shows an increasing trend")
    assert result.phi_detected is False


def test_missing_spacy_model_falls_back_to_regex_only(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken_load(_name: str) -> None:
        raise OSError("missing en_core_web_sm")

    monkeypatch.setitem(sys.modules, "spacy", SimpleNamespace(load=broken_load))

    sanitizer = PHISanitizer(use_ner=True)
    result = sanitizer.scan("Contact john.doe@hospital.org")

    assert result.phi_detected is True
    assert sanitizer._ner_available is False
