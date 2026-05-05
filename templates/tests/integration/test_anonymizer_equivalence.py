"""Semantic equivalence between MsAnonymizerBackend and ParthenonNativeBackend.

Per spec decision Q7 the two backends must produce *semantically* equivalent
output on the same config — not bit-identical. This integration test asserts
the contract:

(a) the same fields are redacted (or replaced with the backend's redact marker)
(b) ``dateShift`` outputs fall within the configured tolerance
(c) ``keep`` fields are byte-equal
(d) ``cryptoHash`` outputs are not the original value (the algorithm/salt
    formats differ between backends, so we don't expect identical hashes)

Skipped when the sidecar isn't reachable (typical dev environment); CI is
expected to start the sidecar before running this test.
"""

from __future__ import annotations

from datetime import date

import httpx
import pytest

from runtime.nodes.anonymizer_backends.ms import MsAnonymizerBackend
from runtime.nodes.anonymizer_backends.native import ParthenonNativeBackend
from runtime.nodes.anonymizer_config import load_config

SIDECAR_URL = "http://parthenon-anonymizer:8080"


def _sidecar_reachable() -> bool:
    try:
        with httpx.Client(timeout=2.0) as client:
            return client.get(f"{SIDECAR_URL}/health").status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not _sidecar_reachable(),
    reason="parthenon-anonymizer sidecar not running (skip in dev; required in CI)",
)


CFG: dict = {
    "version": "1",
    "rules": [
        {"path": "Patient.name", "operation": "redact"},
        {
            "path": "Patient.id",
            "operation": "cryptoHash",
            "params": {"algorithm": "sha256"},
        },
        {
            "path": "Patient.birthDate",
            "operation": "dateShift",
            "params": {"max_days": 30},
        },
        {"path": "Patient.gender", "operation": "keep"},
    ],
}

PATIENT: dict = {
    "resourceType": "Patient",
    "id": "p1",
    "name": [{"family": "Doe", "given": ["John"]}],
    "gender": "male",
    "birthDate": "1970-06-15",
}


@pytest.mark.integration
def test_semantic_equivalence_on_patient() -> None:
    cfg = load_config(CFG)
    salt = "shared-test-salt-do-not-use-in-prod"

    native = ParthenonNativeBackend(salt=salt).anonymize_resource(cfg, dict(PATIENT))
    ms = MsAnonymizerBackend(sidecar_url=SIDECAR_URL).anonymize_resource(cfg, dict(PATIENT))

    # (a) Same redaction outcome on `name` (both backends mark it redacted somehow).
    native_redacted = native.get("name") in {"***REDACTED***", None, ""}
    ms_redacted = ms.get("name") in {"***REDACTED***", None, ""}
    assert native_redacted == ms_redacted, (native, ms)

    # (b) Both date shifts within configured tolerance (max_days=30).
    for out in (native, ms):
        shifted = date.fromisoformat(out["birthDate"])
        delta = abs((shifted - date(1970, 6, 15)).days)
        assert delta <= 30, f"shift exceeded tolerance: {delta} days"

    # (c) Preserved fields byte-equal.
    assert native["gender"] == ms["gender"] == "male"

    # (d) cryptoHash output is not the original — algorithms/salt formats differ
    # between backends, so we don't compare hashes directly.
    assert native["id"] != "p1"
    assert ms["id"] != "p1"
