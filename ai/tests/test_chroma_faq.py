"""Tests for FAQ promotion logic."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


def test_scan_recent_conversations_reads_shared_conversation_memory():
    """FAQ promotion scans the shared Abby conversation-memory collection."""
    now = datetime.now(timezone.utc)
    with patch("app.chroma.faq.get_conversation_memory_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.get.return_value = {
            "documents": [
                "Q: How do I build a cohort?\nA: Use the builder.",
                "Q: Old question?\nA: Old answer.",
            ],
            "metadatas": [
                {"user_id": 7, "timestamp": now.isoformat()},
                {"user_id": 9, "timestamp": (now - timedelta(days=30)).isoformat()},
            ],
        }

        from app.chroma.faq import _scan_recent_conversations

        pairs = _scan_recent_conversations(days=7)

        mock_coll.get.assert_called_once_with(include=["documents", "metadatas"])
        assert pairs == [{
            "question": "How do I build a cohort?",
            "answer": "Use the builder.",
            "user_id": 7,
        }]


def test_promote_frequent_questions():
    """Questions asked by >= 3 users with >= 5 occurrences get promoted."""
    with patch("app.chroma.faq.get_faq_collection") as mock_faq_fn, \
         patch("app.chroma.faq._scan_recent_conversations") as mock_scan:
        mock_faq = MagicMock()
        mock_faq_fn.return_value = mock_faq
        mock_faq.query.return_value = {"documents": [[]], "distances": [[]], "metadatas": [[]]}

        mock_scan.return_value = [
            {"question": "How do I build a cohort?", "answer": "Use the builder.", "user_id": 1},
            {"question": "How to create a cohort?", "answer": "Open cohort builder.", "user_id": 2},
            {"question": "Building a cohort?", "answer": "Go to cohorts.", "user_id": 3},
            {"question": "How do I make a cohort?", "answer": "Use builder.", "user_id": 4},
            {"question": "Create a cohort how?", "answer": "Builder page.", "user_id": 1},
            {"question": "Cohort building steps?", "answer": "Use the builder.", "user_id": 2},
        ]

        from app.chroma.faq import promote_frequent_questions

        stats = promote_frequent_questions()
        assert stats["scanned"] == 6
        assert stats["promoted"] >= 0


def test_no_promotion_below_threshold():
    """Questions below frequency threshold are not promoted."""
    with patch("app.chroma.faq._scan_recent_conversations") as mock_scan:
        mock_scan.return_value = [
            {"question": "Unique question?", "answer": "Unique answer.", "user_id": 1},
        ]

        from app.chroma.faq import promote_frequent_questions

        stats = promote_frequent_questions()
        assert stats["promoted"] == 0
