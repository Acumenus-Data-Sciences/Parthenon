"""HIGHSEC regression: source PHI never appears in anonymized output.

Treat any future failure here as a HIGHSEC blocker — analogous to the
Plan 1 pixel-data regression test (test_dicom_metadata_no_pixels.py).
The test runs the native backend against the synthetic-PHI fixture and
asserts the HIPAA Safe Harbor config redacts every PHI string in the
known list.

If a PHI category is in the fixture but the HIPAA config doesn't redact
the corresponding field, ADD the redact rule to hipaa_safe_harbor.json —
the test is the gate.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.anonymizer_config import load_config
from runtime.nodes.base import NodeContext

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "manifests" / "fhir_anonymizer" / "fixtures" / "sample_with_phi"
HIPAA_CONFIG = REPO / "runtime" / "instruments" / "anonymizer_configs" / "hipaa_safe_harbor.json"


# The full set of synthetic PHI strings present in the fixture.
PHI_STRINGS = [
    "Doe",
    "Jane",
    "Smith",
    "John",
    "555-0100",
    "555-0101",
    "MRN-12345-67890",
    "MRN-77777-88888",
    "jane.doe@example.com",
    "123 Main St",
    "456 Oak Ave",
    "Hershey",
    "Lancaster",
    "17033",
    "17601",
    "Dr. Robinson",
]


def test_no_phi_leaks_through_native_backend(tmp_path: Path) -> None:
    prepared = tmp_path / "prepared"
    prepared.mkdir()
    n = 0
    for ndjson in FIXTURES.glob("*.ndjson"):
        for line in ndjson.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            (prepared / f"{obj['resourceType']}_{obj['id']}.json").write_text(
                json.dumps(obj), encoding="utf-8"
            )
            n += 1
    assert n > 0, "fixture is empty"

    source_blob = "\n".join(f.read_text("utf-8") for f in prepared.glob("*.json"))
    assert any(
        s in source_blob for s in PHI_STRINGS
    ), "fixture missing PHI strings — test sanity check failed"

    cfg = load_config(json.loads(HIPAA_CONFIG.read_text("utf-8")))
    ctx = NodeContext(
        run_id="phi-leak-test",
        node_id="anonymizer",
        logger=logging.getLogger("test.phi"),
        secrets={},
        artifact_dir=tmp_path / "artifacts",
        db_dsn=None,
    )
    ctx.artifact_dir.mkdir(parents=True, exist_ok=True)
    result = AnonymizerNode().run(
        ctx,
        {
            "backend": "native",
            "input_dir": str(prepared),
            "config": cfg.model_dump(),
        },
    )
    assert result.status.value == "success", result.error_message

    out_dir = ctx.artifact_dir / "anonymized"
    assert out_dir.exists()
    out_blob = "\n".join(f.read_text("utf-8") for f in out_dir.glob("*.json"))

    leaks = [s for s in PHI_STRINGS if s in out_blob]
    assert not leaks, f"PHI strings leaked through HIPAA Safe Harbor anonymization: {leaks!r}"
