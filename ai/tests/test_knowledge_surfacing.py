"""Tests for KnowledgeSurfacer — contextual institutional knowledge suggestions."""
from __future__ import annotations

from unittest.mock import MagicMock

from app.institutional.knowledge_surfacing import KnowledgeSurfacer


def _make_surfacer(search_results: list[dict]) -> KnowledgeSurfacer:
    """Return a KnowledgeSurfacer with a mock KnowledgeCapture."""
    mock_kc = MagicMock()
    mock_kc.search_similar.return_value = search_results
    return KnowledgeSurfacer(knowledge_capture=mock_kc)


def test_suggest_returns_relevant_artifacts():
    """suggest() returns results from search_similar that are within distance threshold."""
    results = [
        {"id": 1, "type": "cohort_pattern", "title": "Diabetes cohort", "summary": "T2DM", "usage_count": 5, "distance": 0.2},
        {"id": 2, "type": "analysis_config", "title": "PSM analysis", "summary": "Propensity", "usage_count": 3, "distance": 0.4},
    ]
    surfacer = _make_surfacer(results)

    suggestions = surfacer.suggest("diabetes cohort analysis")

    assert len(suggestions) == 2
    assert suggestions[0]["id"] == 1
    surfacer._knowledge_capture.search_similar.assert_called_once()


def test_suggest_filters_low_relevance_results():
    """suggest() drops results where distance > max_distance (default 0.5)."""
    results = [
        {"id": 1, "type": "cohort_pattern", "title": "Relevant", "summary": "close match", "usage_count": 2, "distance": 0.3},
        {"id": 2, "type": "faq", "title": "Unrelated", "summary": "far match", "usage_count": 1, "distance": 0.8},
    ]
    surfacer = _make_surfacer(results)

    suggestions = surfacer.suggest("some query", max_distance=0.5)

    assert len(suggestions) == 1
    assert suggestions[0]["id"] == 1


def test_format_for_prompt_includes_header_and_titles():
    """format_for_prompt includes INSTITUTIONAL KNOWLEDGE header and artifact titles."""
    surfacer = _make_surfacer([])

    artifacts = [
        {"id": 1, "type": "cohort_pattern", "title": "T2DM Entry", "summary": "Diabetes entry cohort", "usage_count": 7},
        {"id": 2, "type": "faq", "title": "How to use PSM", "summary": "Propensity score matching FAQ", "usage_count": 2},
    ]
    text = surfacer.format_for_prompt(artifacts)

    assert "INSTITUTIONAL KNOWLEDGE" in text
    assert "T2DM Entry" in text
    assert "How to use PSM" in text


def test_suggest_empty_search_returns_empty_list():
    """suggest() returns an empty list when search_similar returns nothing."""
    surfacer = _make_surfacer([])

    suggestions = surfacer.suggest("unrelated query about nothing")

    assert suggestions == []
