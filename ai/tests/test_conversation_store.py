"""Tests for PostgreSQL-backed conversation store with vector search."""
import pytest
from unittest.mock import MagicMock
from app.memory.conversation_store import ConversationStore


class TestConversationStore:
    def test_store_message_with_embedding(self):
        mock_engine = MagicMock()
        mock_embedder = MagicMock()
        mock_embedder.encode.return_value = [[0.1] * 384]
        store = ConversationStore(engine=mock_engine, embedder=mock_embedder)
        store.store_message(conversation_id=1, role="user", content="What is diabetes prevalence?")
        mock_embedder.encode.assert_called_once()
        assert mock_engine.connect.called

    def test_search_similar_returns_ranked_results(self):
        mock_engine = MagicMock()
        mock_embedder = MagicMock()
        mock_embedder.encode.return_value = [[0.1] * 384]
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchall.return_value = [
            (1, "user", "diabetes question", 0.15, 1),
            (2, "assistant", "diabetes answer", 0.25, 1),
        ]
        store = ConversationStore(engine=mock_engine, embedder=mock_embedder)
        results = store.search_similar(query="diabetes prevalence", user_id=1, limit=5)
        assert len(results) == 2
        mock_embedder.encode.assert_called_once()

    def test_get_recent_for_user(self):
        mock_engine = MagicMock()
        mock_embedder = MagicMock()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchall.return_value = [
            (1, "user", "recent question", "2026-03-16 20:00:00"),
        ]
        store = ConversationStore(engine=mock_engine, embedder=mock_embedder)
        results = store.get_recent(user_id=1, limit=10)
        assert len(results) == 1
