"""Tests for the migration bridge — dual-read from PostgreSQL and ChromaDB."""
import pytest
from unittest.mock import MagicMock
from app.memory.migration_bridge import MigrationBridge


class TestMigrationBridge:
    def test_search_uses_postgres_first(self):
        pg_store = MagicMock()
        chroma_query = MagicMock()
        pg_store.search_similar.return_value = [MagicMock(content="pg result", distance=0.1, role="user")]
        bridge = MigrationBridge(pg_store=pg_store, chroma_query_fn=chroma_query, dual_read=True)
        results = bridge.search(query="diabetes", user_id=1, limit=5)
        pg_store.search_similar.assert_called_once()
        assert len(results) >= 1

    def test_falls_back_to_chroma_when_pg_empty(self):
        pg_store = MagicMock()
        chroma_query = MagicMock()
        pg_store.search_similar.return_value = []
        chroma_query.return_value = [{"content": "chroma result", "distance": 0.2}]
        bridge = MigrationBridge(pg_store=pg_store, chroma_query_fn=chroma_query, dual_read=True)
        results = bridge.search(query="diabetes", user_id=1, limit=5)
        chroma_query.assert_called_once()
        assert len(results) >= 1

    def test_skips_chroma_when_dual_read_disabled(self):
        pg_store = MagicMock()
        chroma_query = MagicMock()
        pg_store.search_similar.return_value = []
        bridge = MigrationBridge(pg_store=pg_store, chroma_query_fn=chroma_query, dual_read=False)
        results = bridge.search(query="diabetes", user_id=1, limit=5)
        chroma_query.assert_not_called()

    def test_deduplicates_across_sources(self):
        pg_store = MagicMock()
        chroma_query = MagicMock()
        pg_result = MagicMock(content="same question about diabetes", distance=0.1, role="user")
        pg_store.search_similar.return_value = [pg_result]
        chroma_query.return_value = [{"content": "same question about diabetes", "distance": 0.15}]
        bridge = MigrationBridge(pg_store=pg_store, chroma_query_fn=chroma_query, dual_read=True)
        results = bridge.search(query="diabetes", user_id=1, limit=5)
        assert len(results) == 1
