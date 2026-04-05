"""Tests for ChromaDB collection management."""
from unittest.mock import MagicMock, patch


def test_get_docs_collection():
    """Docs collection uses general embedder."""
    from app.chroma import collections

    with patch.dict(collections._collection_cache, {}, clear=True), \
         patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        result = collections.get_docs_collection()
        assert result is mock_coll
        mock_client.return_value.get_or_create_collection.assert_called_once()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "docs"


def test_get_conversation_memory_collection():
    """Abby conversation memory uses the shared filtered collection."""
    from app.chroma import collections

    with patch.dict(collections._collection_cache, {}, clear=True), \
         patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        result = collections.get_conversation_memory_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert result is mock_coll
        assert call_kwargs.kwargs["name"] == "conversation_memory"


def test_get_user_conversation_collection_uses_shared_memory_collection():
    """Legacy per-user accessor stays compatible while targeting shared storage."""
    from app.chroma import collections

    with patch.dict(collections._collection_cache, {}, clear=True), \
         patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        result = collections.get_user_conversation_collection(user_id=42)
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert result is mock_coll
        assert call_kwargs.kwargs["name"] == "conversation_memory"


def test_collection_handles_are_cached():
    """Repeated access reuses the same Chroma collection handle."""
    from app.chroma import collections

    with patch.dict(collections._collection_cache, {}, clear=True), \
         patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        first = collections.get_docs_collection()
        second = collections.get_docs_collection()

        assert first is second
        mock_client.return_value.get_or_create_collection.assert_called_once()


def test_get_faq_collection():
    """FAQ collection uses general embedder."""
    from app.chroma import collections

    with patch.dict(collections._collection_cache, {}, clear=True), \
         patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder"):
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll

        result = collections.get_faq_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "faq_shared"


def test_get_clinical_collection():
    """Clinical collection uses SapBERT embedder."""
    from app.chroma import collections

    with patch.dict(collections._collection_cache, {}, clear=True), \
         patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_clinical_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        result = collections.get_clinical_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "clinical_reference"
