"""Tests for ChromaDB client singleton and health check."""
from unittest.mock import MagicMock, patch

import pytest


def test_get_client_returns_chromadb_client():
    """Client factory returns a working ChromaDB HttpClient."""
    with patch("chromadb.HttpClient") as mock_http:
        mock_instance = MagicMock()
        mock_http.return_value = mock_instance

        from app.chroma.client import get_chroma_client

        # Reset singleton
        import app.chroma.client as mod
        mod._client = None

        client = get_chroma_client()
        assert client is mock_instance
        mock_http.assert_called_once()

        # Reset for other tests
        mod._client = None


def test_get_client_is_singleton():
    """Repeated calls return the same client instance."""
    with patch("chromadb.HttpClient") as mock_http:
        mock_instance = MagicMock()
        mock_http.return_value = mock_instance

        import app.chroma.client as mod
        mod._client = None

        c1 = mod.get_chroma_client()
        c2 = mod.get_chroma_client()
        assert c1 is c2
        assert mock_http.call_count == 1

        mod._client = None


def test_check_health_returns_status():
    """Health check returns heartbeat nanosecond value."""
    with patch("app.chroma.client.get_chroma_client") as mock_get:
        mock_client = MagicMock()
        mock_client.heartbeat.return_value = 1234567890
        mock_get.return_value = mock_client

        from app.chroma.client import check_health

        result = check_health()
        assert result == {"status": "ok", "heartbeat": 1234567890}


def test_check_health_returns_error_on_failure():
    """Health check returns error status when ChromaDB is unreachable."""
    with patch("app.chroma.client.get_chroma_client") as mock_get:
        mock_client = MagicMock()
        mock_client.heartbeat.side_effect = Exception("Connection refused")
        mock_get.return_value = mock_client

        from app.chroma.client import check_health

        result = check_health()
        assert result["status"] == "error"
        assert "Connection refused" in result["error"]
