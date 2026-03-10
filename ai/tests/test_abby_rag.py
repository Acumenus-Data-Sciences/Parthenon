"""Tests for RAG integration in Abby chat endpoint."""
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_chat_includes_rag_context_in_system_prompt():
    """Chat endpoint injects RAG context into the system prompt."""
    with patch("app.routers.abby.build_rag_context") as mock_rag, \
         patch("app.routers.abby.call_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_rag.return_value = "\n\nKNOWLEDGE BASE:\n- Some doc content"
        mock_ollama.return_value = "Here's the answer.\nSUGGESTIONS: [\"Next?\"]"

        resp = client.post("/abby/chat", json={
            "message": "How do I build a cohort?",
            "page_context": "cohort_builder",
        })

    assert resp.status_code == 200
    mock_rag.assert_called_once()
    # Verify system prompt passed to Ollama includes RAG content
    call_args = mock_ollama.call_args
    system_prompt = call_args.kwargs.get("system_prompt", "") or (call_args.args[0] if call_args.args else "")
    assert "KNOWLEDGE BASE" in system_prompt


def test_chat_works_without_rag_context():
    """Chat still works when RAG returns no results (graceful degradation)."""
    with patch("app.routers.abby.build_rag_context") as mock_rag, \
         patch("app.routers.abby.call_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_rag.return_value = ""
        mock_ollama.return_value = "I can help.\nSUGGESTIONS: [\"More?\"]"

        resp = client.post("/abby/chat", json={
            "message": "Hello",
            "page_context": "general",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "I can help" in data["reply"]
