"""End-to-end SciSpaCy through the live parthenon-scispacy sidecar.

Skipped if the sidecar is not reachable (which is the local-dev case).
The CI workflow brings the sidecar up before this step, so it runs there.
"""

from __future__ import annotations

import os

import httpx
import pytest

from runtime.nlp.backends.scispacy import SciSpacyBackend


def _sidecar_reachable() -> bool:
    url = os.environ.get("PARTHENON_SCISPACY_URL", "http://localhost:5101")
    try:
        r = httpx.get(f"{url}/health", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.integration
@pytest.mark.skipif(not _sidecar_reachable(), reason="parthenon-scispacy sidecar not reachable")
def test_scispacy_extracts_clinical_entities() -> None:
    backend = SciSpacyBackend(sidecar_url=os.environ.get("PARTHENON_SCISPACY_URL"))
    result = backend.infer(
        "Patient reports chest pain and shortness of breath. Started lisinopril 10mg.",
        "v0.1.0",
    )
    assert (
        len(result.spans) >= 2
    ), f"expected at least 2 entities (chest pain, lisinopril), got {len(result.spans)}"
    labels = {s.label for s in result.spans}
    assert {
        "condition",
        "drug",
    } & labels, f"expected at least one of condition or drug labels, got {labels}"
