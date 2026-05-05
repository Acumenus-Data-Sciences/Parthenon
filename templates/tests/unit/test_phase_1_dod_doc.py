"""Plan 7 Task 9: Phase 1 DoD verification document presence + content."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DOD_DOC = REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-1-dod.md"


def test_phase_1_dod_doc_exists() -> None:
    assert DOD_DOC.exists(), f"missing {DOD_DOC}"


def test_phase_1_dod_lists_all_plan_evidence() -> None:
    text = DOD_DOC.read_text(encoding="utf-8")
    for marker in (
        "PR-A",
        "PR-B",
        "PR-C",
        "test_fhir_to_omop_pra",
        "test_fhir_to_omop_prb",
        "test_fhir_to_omop_prc",
        "1M Observations",
        "test_no_phi_leaks_through_native_backend",
    ):
        assert marker in text, f"DoD doc missing reference to {marker}"


def test_phase_1_dod_evidence_table_has_commit_column() -> None:
    text = DOD_DOC.read_text(encoding="utf-8")
    # The table uses `<commit>` placeholders pre-sign-off.
    assert "<commit>" in text or "commit:" in text
