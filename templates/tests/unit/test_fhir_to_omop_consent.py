"""Consent mapper unit tests (Plan 7 PR-C)."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.consent import (
    ConsentDecision,
    ConsentRow,
    MalformedConsentError,
    map_consent,
)


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE concept ("
                "concept_id INTEGER PRIMARY KEY, concept_name TEXT, "
                "vocabulary_id TEXT, concept_code TEXT, standard_concept TEXT)"
            )
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


CONSENT_PERMIT_CONCEPT = 4055893  # OMOP "Patient consent given"
CONSENT_DENY_CONCEPT = 4054745  # OMOP "Patient consent withdrawn"


def test_map_consent_permit(engine) -> None:
    fhir = {
        "resourceType": "Consent",
        "id": "c1",
        "status": "active",
        "patient": {"reference": "Patient/p1"},
        "provision": {"type": "permit"},
        "dateTime": "2026-04-01T10:00:00Z",
    }
    row, decision = map_consent(
        fhir,
        _resolver(engine),
        permit_concept_id=CONSENT_PERMIT_CONCEPT,
        deny_concept_id=CONSENT_DENY_CONCEPT,
    )
    assert isinstance(row, ConsentRow)
    assert row.observation_concept_id == CONSENT_PERMIT_CONCEPT
    assert isinstance(decision, ConsentDecision)
    assert decision.decision == "permit"
    assert decision.person_source_value == "p1"


def test_map_consent_deny(engine) -> None:
    fhir = {
        "resourceType": "Consent",
        "id": "c2",
        "status": "active",
        "patient": {"reference": "Patient/p2"},
        "provision": {"type": "deny"},
        "dateTime": "2026-04-01",
    }
    row, decision = map_consent(
        fhir,
        _resolver(engine),
        permit_concept_id=CONSENT_PERMIT_CONCEPT,
        deny_concept_id=CONSENT_DENY_CONCEPT,
    )
    assert row.observation_concept_id == CONSENT_DENY_CONCEPT
    assert decision.decision == "deny"


def test_map_consent_missing_provision_type_raises(engine) -> None:
    fhir = {
        "resourceType": "Consent",
        "id": "c3",
        "status": "active",
        "patient": {"reference": "Patient/p1"},
        "provision": {},
        "dateTime": "2026-04-01",
    }
    with pytest.raises(MalformedConsentError, match="provision.type"):
        map_consent(
            fhir,
            _resolver(engine),
            permit_concept_id=CONSENT_PERMIT_CONCEPT,
            deny_concept_id=CONSENT_DENY_CONCEPT,
        )


def test_map_consent_unknown_provision_type_raises(engine) -> None:
    fhir = {
        "resourceType": "Consent",
        "id": "c4",
        "status": "active",
        "patient": {"reference": "Patient/p1"},
        "provision": {"type": "neither-permit-nor-deny"},
        "dateTime": "2026-04-01",
    }
    with pytest.raises(MalformedConsentError, match="provision.type"):
        map_consent(
            fhir,
            _resolver(engine),
            permit_concept_id=CONSENT_PERMIT_CONCEPT,
            deny_concept_id=CONSENT_DENY_CONCEPT,
        )


def test_map_consent_missing_patient_raises(engine) -> None:
    fhir = {
        "resourceType": "Consent",
        "id": "c5",
        "status": "active",
        "provision": {"type": "permit"},
        "dateTime": "2026-04-01",
    }
    with pytest.raises(MalformedConsentError, match="patient"):
        map_consent(
            fhir,
            _resolver(engine),
            permit_concept_id=CONSENT_PERMIT_CONCEPT,
            deny_concept_id=CONSENT_DENY_CONCEPT,
        )
