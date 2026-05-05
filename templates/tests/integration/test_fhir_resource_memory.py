"""FhirResourceNode memory profile: streams a 1GB bundle under a 200MB RSS ceiling.

Spec §4.1 acceptance criterion: ingesting a 1GB synthetic NDJSON FHIR bundle
must keep RSS growth under 200 MB. This guards the streaming guarantee — if a
future change re-introduces a cross-file or whole-bundle in-memory buffer, this
test catches it.

Marked ``slow`` because it generates a ~1GB file and reads it. Excluded from the
default ``pytest -q`` run; opt in with ``pytest -m slow``.
"""

from __future__ import annotations

import logging
import resource
from pathlib import Path

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.fhir_resource import FhirResourceNode


def _generate_synthetic_patients(path: Path, target_bytes: int) -> int:
    """Write enough Patient NDJSON to exceed target_bytes. Returns lines written."""
    line_template = (
        '{{"resourceType":"Patient","id":"p{i}","gender":"male","birthDate":"1970-01-01",'
        '"name":[{{"family":"FAM_{i}","given":["Synthetic"]}}],'
        '"address":[{{"city":"Test","state":"PA","postalCode":"00000"}}],'
        '"telecom":[{{"system":"phone","value":"555-0100"}}]}}\n'
    )
    written = 0
    n = 0
    with path.open("w", encoding="utf-8") as f:
        while written < target_bytes:
            line = line_template.format(i=n)
            f.write(line)
            written += len(line)
            n += 1
    return n


@pytest.mark.slow
@pytest.mark.integration
def test_streams_1gb_bundle_under_200mb_rss(tmp_path: Path) -> None:
    """Acceptance criterion: 1GB NDJSON ingested with peak RSS delta <200MB."""
    bulk_dir = tmp_path / "bulk"
    bulk_dir.mkdir()
    target_bytes = 1 * 1024 * 1024 * 1024  # 1 GB
    n_lines = _generate_synthetic_patients(bulk_dir / "Patient.ndjson", target_bytes)
    assert n_lines > 0

    ctx = NodeContext(
        run_id="mem-probe",
        node_id="fhir-mem",
        logger=logging.getLogger("test.fhir.mem"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )

    rss_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss  # KB on Linux
    result = FhirResourceNode().run(
        ctx,
        {
            "source": "ndjson",
            "ndjson_dir": str(bulk_dir),
            "profile": "us-core",
        },
    )
    rss_after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss

    assert result.status == NodeStatus.SUCCESS, result.error_message
    rss_delta_mb = (rss_after - rss_before) / 1024
    assert rss_delta_mb < 200, (
        f"RSS grew by {rss_delta_mb:.1f} MB ingesting 1GB bundle (limit: 200 MB) — "
        f"streaming guarantee broken"
    )
