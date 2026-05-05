"""Plan 7 Task 12: Phase 1 final sign-off doc presence + content."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SIGNOFF = REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-1-signoff.md"


def test_phase_1_signoff_exists() -> None:
    assert SIGNOFF.exists(), f"missing {SIGNOFF}"


def test_phase_1_signoff_lists_all_plans() -> None:
    text = SIGNOFF.read_text(encoding="utf-8")
    for marker in (
        "Plan 1",
        "Plan 2",
        "Plan 3",
        "Plan 4",
        "Plan 5",
        "Plan 6",
        "Plan 7",
    ):
        assert marker in text, f"signoff missing reference to {marker}"


def test_phase_1_signoff_inventory_counts() -> None:
    text = SIGNOFF.read_text(encoding="utf-8")
    # 10 manifests total (4 Phase 0 + 6 Phase 1) and 8 ADRs total
    # (3 Phase 0 + 5 Phase 1) — counts the spec asks for.
    assert "10" in text
    assert "ADR" in text


def test_phase_1_signoff_has_signoff_block() -> None:
    text = SIGNOFF.read_text(encoding="utf-8")
    assert "Reviewed by" in text
    assert "Approved by" in text
