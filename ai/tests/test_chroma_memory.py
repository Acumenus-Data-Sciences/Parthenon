"""Tests for conversation memory embedding."""
from unittest.mock import MagicMock, patch


def test_store_conversation_turn():
    """Stores a Q&A pair in Abby's shared conversation-memory collection."""
    with patch("app.chroma.memory.get_conversation_memory_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        from app.chroma.memory import store_conversation_turn

        store_conversation_turn(
            user_id=42,
            question="How do I build a cohort?",
            answer="Use the cohort builder...",
            page_context="cohort_builder",
        )

        mock_coll.upsert.assert_called_once()
        call_kwargs = mock_coll.upsert.call_args
        assert len(call_kwargs.kwargs["documents"]) == 1
        assert "cohort" in call_kwargs.kwargs["documents"][0].lower()


def test_store_conversation_combines_qa():
    """Stored document combines question and answer."""
    with patch("app.chroma.memory.get_conversation_memory_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        from app.chroma.memory import store_conversation_turn

        store_conversation_turn(
            user_id=1,
            question="What is OMOP?",
            answer="OMOP is a common data model.",
            page_context="general",
        )

        doc = mock_coll.upsert.call_args.kwargs["documents"][0]
        assert "What is OMOP?" in doc
        assert "OMOP is a common data model." in doc


def test_prune_old_conversations():
    """Prune removes entries older than TTL days."""
    with patch("app.chroma.memory.get_conversation_memory_collection") as mock_coll_fn:
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
        assert mock_coll.get.call_args.kwargs["where"] == {"user_id": 42}
        assert removed == 2


def test_aggregate_conversations_backfills_legacy_per_user_collections():
    """Legacy conversations_user_* collections migrate into shared Abby memory."""
    mock_source = MagicMock()
    mock_source.name = "conversations_user_42"
    mock_source.get.return_value = {
        "ids": ["conv_42_abc"],
        "documents": ["Q: What is OMOP?\nA: A common data model."],
        "metadatas": [[{"timestamp": "2026-01-01T00:00:00", "page_context": "general"}]][0],
    }

    mock_other = MagicMock()
    mock_other.name = "docs"

    with patch("app.chroma.memory.get_chroma_client") as mock_client_fn, \
         patch("app.chroma.memory.get_conversation_memory_collection") as mock_target_fn:
        mock_target = MagicMock()
        mock_client_fn.return_value.list_collections.return_value = [mock_source, mock_other]
        mock_target_fn.return_value = mock_target

        from app.chroma.memory import aggregate_conversations

        stats = aggregate_conversations()

        mock_target.upsert.assert_called_once()
        upsert_kwargs = mock_target.upsert.call_args.kwargs
        assert upsert_kwargs["ids"] == ["conv_42_abc"]
        assert upsert_kwargs["metadatas"][0]["user_id"] == 42
        assert upsert_kwargs["metadatas"][0]["source"] == "abby_chat"
        assert stats == {"users": 1, "total": 1, "upserted": 1}
