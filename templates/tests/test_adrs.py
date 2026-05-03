"""ADR documents for Phase 0 must exist and follow MADR shape.

This guards three Architecture Decision Records that anchor Phase 0 of the
parthenon-templates milestone:

* 0001 — Node SDK design (this task; T-001).
* 0002 — Orchestration backend (Task 23).
* 0003 — Template manifest format (Task 31).

Until tasks 23 and 31 land, the latter two parametrized cases are expected
to fail. The matrix is asserted as one parametrized test so adding the next
ADR is a one-line update here.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
ADR_DIR = REPO / "docs" / "adr"

# Each entry: (filename, title_keyword, pending_task). ``pending_task`` is the
# Phase 0 task number that will write the ADR; ``None`` means the ADR is in
# the tree right now. Pending entries are marked xfail(strict=True) so the
# suite is green today and automatically goes red when the file lands without
# the marker being removed — forcing a one-line cleanup at that moment.
EXPECTED_ADRS = [
    pytest.param("0001-node-sdk-design.md", "Node SDK", id="0001"),
    pytest.param(
        "0002-orchestration-backend.md",
        "Orchestration",
        id="0002",
        marks=pytest.mark.xfail(
            reason="ADR 0002 is written in Task 23; remove this xfail when it lands.",
            strict=True,
        ),
    ),
    pytest.param(
        "0003-template-manifest-format.md",
        "Manifest",
        id="0003",
        marks=pytest.mark.xfail(
            reason="ADR 0003 is written in Task 31; remove this xfail when it lands.",
            strict=True,
        ),
    ),
]


@pytest.mark.parametrize("filename,title_keyword", EXPECTED_ADRS)
def test_adr_exists_and_uses_madr(filename: str, title_keyword: str) -> None:
    path = ADR_DIR / filename
    assert path.exists(), f"missing ADR: {path}"
    text = path.read_text(encoding="utf-8")
    for required_section in (
        "## Status",
        "## Context",
        "## Decision",
        "## Consequences",
    ):
        assert required_section in text, f"{filename} missing {required_section}"
    assert title_keyword.lower() in text.lower()
