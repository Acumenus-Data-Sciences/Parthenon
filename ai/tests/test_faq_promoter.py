"""Tests for FAQPromoter — auto-promotion of frequently-asked questions."""
from __future__ import annotations

from unittest.mock import MagicMock

from app.institutional.faq_promoter import FAQPromoter


def _make_engine(fetchone_result: tuple) -> tuple[MagicMock, MagicMock]:
    """Return (mock_engine, mock_conn) configured with a given fetchone result."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    mock_conn.execute.return_value.fetchone.return_value = fetchone_result
    return mock_engine, mock_conn


def test_check_and_promote_returns_true_when_count_meets_threshold():
    """check_and_promote returns True when distinct-user count >= threshold."""
    mock_engine, mock_conn = _make_engine((4,))
    faq = FAQPromoter(engine=mock_engine, threshold=3)

    result = faq.check_and_promote(
        question="How do I create a cohort?",
        answer="Use the cohort builder in Parthenon.",
    )

    assert result is True


def test_check_and_promote_returns_false_when_count_below_threshold():
    """check_and_promote returns False when distinct-user count < threshold."""
    mock_engine, mock_conn = _make_engine((1,))
    faq = FAQPromoter(engine=mock_engine, threshold=3)

    result = faq.check_and_promote(
        question="How do I create a rare cohort?",
        answer="Use the advanced cohort builder.",
    )

    assert result is False


def test_get_faqs_returns_list_of_promoted_faqs():
    """get_faqs returns a list of active FAQ artifacts from the knowledge base."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

    row1 = MagicMock()
    row1._mapping = {
        "id": 10,
        "type": "faq",
        "title": "How do I create a cohort?",
        "summary": "Use the cohort builder.",
        "usage_count": 5,
        "status": "active",
    }
    mock_conn.execute.return_value.fetchall.return_value = [row1]

    faq = FAQPromoter(engine=mock_engine, threshold=3)
    results = faq.get_faqs(limit=10)

    assert isinstance(results, list)
    assert len(results) == 1
    assert results[0]["type"] == "faq"
