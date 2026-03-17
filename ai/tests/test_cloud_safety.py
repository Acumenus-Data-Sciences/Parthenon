"""Tests for Cloud Safety Filter — allowlist-based protection of individual-level data."""
import pytest
from app.memory.context_assembler import ContextPiece, ContextTier
from app.routing.cloud_safety import CloudSafetyFilter


@pytest.fixture
def filter_() -> CloudSafetyFilter:
    return CloudSafetyFilter()


def _piece(
    tier: ContextTier,
    content: str = "generic content",
    source: str = "",
) -> ContextPiece:
    return ContextPiece(tier=tier, content=content, relevance=1.0, tokens=50, source=source)


# ── Always-safe tiers ────────────────────────────────────────────────────────

def test_allows_working_memory(filter_: CloudSafetyFilter) -> None:
    piece = _piece(ContextTier.WORKING, "current task context")
    assert filter_.is_cloud_safe(piece) is True


def test_allows_page_context(filter_: CloudSafetyFilter) -> None:
    piece = _piece(ContextTier.PAGE, "user is on the cohort definition page")
    assert filter_.is_cloud_safe(piece) is True


def test_allows_semantic_knowledge(filter_: CloudSafetyFilter) -> None:
    piece = _piece(ContextTier.SEMANTIC, "Type 2 diabetes has SNOMED code 201826")
    assert filter_.is_cloud_safe(piece) is True


# ── LIVE tier — aggregate sources are safe ───────────────────────────────────

def test_allows_aggregate_live_context(filter_: CloudSafetyFilter) -> None:
    piece = _piece(ContextTier.LIVE, "HbA1c > 9: 847 patients (12.3%)", source="achilles_stats")
    assert filter_.is_cloud_safe(piece) is True


# ── LIVE tier — individual-level sources are blocked ─────────────────────────

def test_blocks_individual_patient_data(filter_: CloudSafetyFilter) -> None:
    piece = _piece(
        ContextTier.LIVE,
        "person_id=12345, gender_concept_id=8507",
        source="cdm.person",
    )
    assert filter_.is_cloud_safe(piece) is False


def test_blocks_visit_level_data(filter_: CloudSafetyFilter) -> None:
    piece = _piece(
        ContextTier.LIVE,
        "visit_occurrence_id=9988 for person 12345",
        source="cdm.visit_occurrence",
    )
    assert filter_.is_cloud_safe(piece) is False


# ── filter_for_cloud removes unsafe, keeps safe ──────────────────────────────

def test_filter_pieces_removes_unsafe(filter_: CloudSafetyFilter) -> None:
    pieces = [
        _piece(ContextTier.WORKING, "task context"),
        _piece(ContextTier.LIVE, "person_id=1", source="cdm.person"),
        _piece(ContextTier.SEMANTIC, "SNOMED concept description"),
        _piece(ContextTier.LIVE, "visit_occurrence_id=2", source="cdm.visit_occurrence"),
    ]
    safe = filter_.filter_for_cloud(pieces)
    assert len(safe) == 2
    sources = [p.source for p in safe]
    assert "cdm.person" not in sources
    assert "cdm.visit_occurrence" not in sources
