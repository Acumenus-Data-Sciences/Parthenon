"""ADR documents for Phase 0 must exist and follow MADR shape.

This guards three Architecture Decision Records that anchor Phase 0 of the
parthenon-templates milestone:

* 0001 — Node SDK design (T-001).
* 0002 — Orchestration backend (Task 23).
* 0003 — Template manifest format (Task 31).
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
ADR_DIR = REPO / "docs" / "adr"

# Each entry: (filename, title_keyword). Add the next ADR with a one-line
# extension when it lands.
EXPECTED_ADRS = [
    pytest.param("0001-node-sdk-design.md", "Node SDK", id="0001"),
    pytest.param("0002-orchestration-backend.md", "Orchestration", id="0002"),
    pytest.param("0003-template-manifest-format.md", "Manifest", id="0003"),
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
