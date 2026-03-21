"""Tests for conversation memory embedding."""
from unittest.mock import MagicMock, patch


def test_store_conversation_turn():
    """Stores a Q&A pair in the user's conversation collection."""
    with patch("app.chroma.memory.get_user_conversation_collection") as mock_coll_fn, \
         patch("app.chroma.memory._get_unified_collection") as mock_unified_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_unified_fn.return_value = MagicMock()

        from app.chroma.memory import store_conversation_turn

        store_conversation_turn(
            user_id=42,
            question="How do I build a cohort?",
            answer="Use the cohort builder...",
            page_context="cohort_builder",
        )

        mock_coll.add.assert_called_once()
        call_kwargs = mock_coll.add.call_args
        assert len(call_kwargs.kwargs["documents"]) == 1
        assert "cohort" in call_kwargs.kwargs["documents"][0].lower()


def test_store_conversation_combines_qa():
    """Stored document combines question and answer."""
    with patch("app.chroma.memory.get_user_conversation_collection") as mock_coll_fn, \
         patch("app.chroma.memory._get_unified_collection") as mock_unified_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_unified_fn.return_value = MagicMock()

        from app.chroma.memory import store_conversation_turn

        store_conversation_turn(
            user_id=1,
            question="What is OMOP?",
            answer="OMOP is a common data model.",
            page_context="general",
        )

        doc = mock_coll.add.call_args.kwargs["documents"][0]
        assert "What is OMOP?" in doc
        assert "OMOP is a common data model." in doc


def test_prune_old_conversations():
    """Prune removes entries older than TTL days."""
    with patch("app.chroma.memory.get_user_conversation_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.get.return_value = {
            "ids": ["old_1", "old_2"],
            "metadatas": [
                {"timestamp": "2025-01-01T00:00:00"},
                {"timestamp": "2025-01-02T00:00:00"},
            ],
        }

        from app.chroma.memory import prune_old_conversations

        removed = prune_old_conversations(user_id=42, ttl_days=90)
        mock_coll.delete.assert_called_once()
        assert removed == 2
