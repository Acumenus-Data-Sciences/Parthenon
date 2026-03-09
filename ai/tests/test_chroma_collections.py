"""Tests for ChromaDB collection management."""
from unittest.mock import MagicMock, patch


def test_get_docs_collection():
    """Docs collection uses general embedder."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        from app.chroma.collections import get_docs_collection

        result = get_docs_collection()
        assert result is mock_coll
        mock_client.return_value.get_or_create_collection.assert_called_once()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "docs"


def test_get_user_conversation_collection():
    """User conversation collection is namespaced by user_id."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        from app.chroma.collections import get_user_conversation_collection

        result = get_user_conversation_collection(user_id=42)
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "conversations_user_42"


def test_get_faq_collection():
    """FAQ collection uses general embedder."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder"):
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll

        from app.chroma.collections import get_faq_collection

        result = get_faq_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "faq_shared"


def test_get_clinical_collection():
    """Clinical collection uses SapBERT embedder."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_clinical_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        from app.chroma.collections import get_clinical_collection

        result = get_clinical_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "clinical_reference"
