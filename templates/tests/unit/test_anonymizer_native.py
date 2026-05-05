"""ParthenonNativeBackend: pure-Python rule engine for the v1 anonymizer config."""

from __future__ import annotations

import hashlib
from datetime import date

from runtime.nodes.anonymizer_backends.base import AnonymizerBackend
from runtime.nodes.anonymizer_backends.native import ParthenonNativeBackend
from runtime.nodes.anonymizer_config import load_config


def test_implements_protocol() -> None:
    backend = ParthenonNativeBackend(salt="run-salt-1")
    assert isinstance(backend, AnonymizerBackend)


def test_redact_replaces_with_marker() -> None:
    cfg = load_config({"version": "1", "rules": [{"path": "Patient.name", "operation": "redact"}]})
    backend = ParthenonNativeBackend(salt="x")
    out = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "name": [{"family": "Doe"}]}
    )
    assert out["name"] == "***REDACTED***"


def test_keep_preserves_field() -> None:
    cfg = load_config(
        {
            "version": "1",
            "default_action": "redact",
            "rules": [{"path": "Patient.gender", "operation": "keep"}],
        }
    )
    backend = ParthenonNativeBackend(salt="x")
    out = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "gender": "male", "name": "FAM"}
    )
    assert out["gender"] == "male"


def test_dateshift_is_deterministic_per_patient() -> None:
    cfg = load_config(
        {
            "version": "1",
            "rules": [
                {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}}
            ],
        }
    )
    backend = ParthenonNativeBackend(salt="run-salt-deterministic")
    p = {"resourceType": "Patient", "id": "p1", "birthDate": "1970-06-15"}
    a = backend.anonymize_resource(cfg, dict(p))
    b = backend.anonymize_resource(cfg, dict(p))
    assert a["birthDate"] == b["birthDate"], "same patient + same salt -> same shift"
    delta = abs((date.fromisoformat(a["birthDate"]) - date(1970, 6, 15)).days)
    assert delta <= 30


def test_dateshift_differs_across_patients() -> None:
    cfg = load_config(
        {
            "version": "1",
            "rules": [
                {"path": "Patient.birthDate", "operation": "dateShift", "params": {"max_days": 30}}
            ],
        }
    )
    backend = ParthenonNativeBackend(salt="x")
    a = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p1", "birthDate": "1970-06-15"}
    )
    b = backend.anonymize_resource(
        cfg, {"resourceType": "Patient", "id": "p2", "birthDate": "1970-06-15"}
    )
    assert a["birthDate"] != b["birthDate"], "different patients should shift differently"


def test_cryptohash_sha256() -> None:
    cfg = load_config(
        {
            "version": "1",
            "rules": [
                {
                    "path": "Patient.id",
                    "operation": "cryptoHash",
                    "params": {"algorithm": "sha256"},
                }
            ],
        }
    )
    backend = ParthenonNativeBackend(salt="run-salt-1")
    out = backend.anonymize_resource(cfg, {"resourceType": "Patient", "id": "p1"})
    expected = hashlib.sha256(b"run-salt-1:p1").hexdigest()
    assert out["id"] == expected


def test_default_redact_applies_to_unmatched_fields() -> None:
    """When default_action=redact, fields not in any rule are redacted."""
    cfg = load_config(
        {
            "version": "1",
            "default_action": "redact",
            "rules": [{"path": "Patient.id", "operation": "keep"}],
        }
    )
    backend = ParthenonNativeBackend(salt="x")
    out = backend.anonymize_resource(
        cfg,
        {
            "resourceType": "Patient",
            "id": "p1",
            "name": [{"family": "Doe"}],
            "telecom": [{"system": "phone", "value": "555-0100"}],
        },
    )
    assert out["id"] == "p1"
    assert out["name"] == "***REDACTED***"
    assert out["telecom"] == "***REDACTED***"
