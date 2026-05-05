"""Plan 7 Task 11: Phase 1 ops runbook update — extends Phase 0 runbook."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RUNBOOK = REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-0-runbook.md"

PHASE_1_SECTION_MARKERS = [
    "Phase 1 surfaces",
    "Anonymizer sidecar operations",
    "DICOM ETL operations",
    "PRO instrument operations",
    "fhir_to_omop operations",
    "Performance characteristics",
    "Phase 1 runbook checklist",
]


def test_phase_0_runbook_exists() -> None:
    assert RUNBOOK.exists(), f"missing {RUNBOOK}"


def test_phase_0_runbook_extended_with_phase_1_sections() -> None:
    text = RUNBOOK.read_text(encoding="utf-8")
    for marker in PHASE_1_SECTION_MARKERS:
        assert marker in text, f"runbook missing Phase 1 section: {marker}"


def test_phase_1_runbook_documents_consent_filter() -> None:
    text = RUNBOOK.read_text(encoding="utf-8")
    assert "app.consent_decisions" in text
    assert "decision = 'deny'" in text


def test_phase_1_runbook_pixel_absence_check_present() -> None:
    text = RUNBOOK.read_text(encoding="utf-8")
    assert "ILIKE '%pixel%'" in text
