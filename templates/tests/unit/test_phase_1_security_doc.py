"""Plan 7 Task 8: Phase 1 security review document presence + content."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SECURITY_DOC = (
    REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-1-security.md"
)


def test_phase_1_security_doc_exists() -> None:
    assert SECURITY_DOC.exists(), f"missing {SECURITY_DOC}"


def test_phase_1_security_doc_covers_all_plans() -> None:
    text = SECURITY_DOC.read_text(encoding="utf-8")
    for marker in (
        "Plan 1",
        "Plan 2",
        "Plan 3",
        "Plan 4",
        "Plan 5",
        "Plan 6",
        "Plan 7",
    ):
        assert marker in text, f"security doc missing reference to {marker}"


def test_phase_1_security_doc_lists_phi_invariant() -> None:
    text = SECURITY_DOC.read_text(encoding="utf-8")
    assert "test_no_phi_leaks_through_native_backend" in text
    assert "test_artifact_has_no_pixel_columns" in text
    assert "MalformedConsentError" in text
