"""Plan 7 Task 7: enforce that the perf-decision document records the
actual measured numbers and a SHIP/ESCALATE verdict."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DECISION_DOC = (
    REPO.parent / "docs" / "devlog" / "modules" / "ingestion" / "templates-phase-1-perf-decision.md"
)


def test_perf_decision_doc_exists() -> None:
    assert DECISION_DOC.exists(), f"missing {DECISION_DOC}"


def test_perf_decision_records_actual_numbers() -> None:
    text = DECISION_DOC.read_text(encoding="utf-8")
    assert "elapsed_seconds" in text or "elapsed:" in text or "elapsed=" in text
    assert "rss_delta_mb" in text or "RSS delta" in text
    assert "SHIP" in text or "ESCALATE" in text
