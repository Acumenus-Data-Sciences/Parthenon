"""Plan 7 Task 10: Phase 1 devlog narrative presence + content."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEVLOG = REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-1.md"

REQUIRED_SECTIONS = [
    "## Goal recap",
    "## What shipped",
    "## What we learned",
    "## What's deferred",
    "## Acknowledgments",
]


def test_phase_1_devlog_exists() -> None:
    assert DEVLOG.exists(), f"missing {DEVLOG}"


def test_phase_1_devlog_has_required_sections() -> None:
    text = DEVLOG.read_text(encoding="utf-8")
    for section in REQUIRED_SECTIONS:
        assert section in text, f"devlog missing section: {section}"
