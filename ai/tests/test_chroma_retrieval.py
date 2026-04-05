"""Tests for RAG retrieval from ChromaDB collections."""
from unittest.mock import MagicMock, patch

import pytest


def test_query_docs_returns_relevant_chunks():
    """Docs query returns documents above similarity threshold."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["chunk about cohort building", "chunk about vocabulary"]],
            "distances": [[0.15, 0.25]],
            "metadatas": [[{"source": "guide.md"}, {"source": "vocab.md"}]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("how do I build a cohort?", top_k=3)
        assert len(results) == 2
        assert results[0]["text"] == "chunk about cohort building"
        assert results[0]["score"] > results[1]["score"]


def test_query_docs_filters_by_threshold():
    """Results below similarity threshold are excluded."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["relevant chunk", "irrelevant chunk"]],
            "distances": [[0.1, 0.8]],
            "metadatas": [[{"source": "a.md"}, {"source": "b.md"}]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("test query", top_k=3, threshold=0.3)
        assert len(results) == 1


def test_build_rag_context_assembles_sections():
    """RAG context builder combines results from multiple collections."""
    with patch("app.chroma.retrieval.query_docs") as mock_docs, \
         patch("app.chroma.retrieval.query_faq") as mock_faq:
        mock_docs.return_value = [
            {"text": "Doc chunk 1", "score": 0.9, "source": "guide.md"}
        ]
        mock_faq.return_value = [
            {"text": "Q: How? A: Like this.", "score": 0.85, "source": "faq"}
        ]

        from app.chroma.retrieval import build_rag_context

        context = build_rag_context(
            query="how do I do this?",
            page_context="general",
            user_id=None,
        )
        assert "KNOWLEDGE BASE" in context
        assert "Doc chunk 1" in context


def test_build_rag_context_returns_empty_on_no_results():
    """Returns empty string when no relevant results found."""
    with patch("app.chroma.retrieval.query_docs") as mock_docs, \
         patch("app.chroma.retrieval.query_faq") as mock_faq:
        mock_docs.return_value = []
        mock_faq.return_value = []

        from app.chroma.retrieval import build_rag_context

        context = build_rag_context(
            query="obscure question",
            page_context="general",
            user_id=None,
        )
        assert context == ""


def test_query_user_conversations_filters_by_user_id():
    """Conversation retrieval uses shared memory with a user_id filter."""
    with patch("app.chroma.retrieval.get_conversation_memory_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["Q: What is OMOP?\nA: Common data model."]],
            "distances": [[0.1]],
            "metadatas": [[{"page_context": "general"}]],
        }

        from app.chroma.retrieval import query_user_conversations

        results = query_user_conversations(user_id=42, query="OMOP", top_k=3)

        assert len(results) == 1
        mock_coll.query.assert_called_once_with(
            query_texts=["OMOP"],
            n_results=3,
            where={"user_id": 42},
        )


def test_query_ohdsi_papers_does_not_probe_count_before_query():
    """OHDSI paper retrieval avoids an extra count round-trip on every request."""
    with patch("app.chroma.collections.get_ohdsi_papers_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["Paper summary"]],
            "distances": [[0.1]],
            "metadatas": [[{"title": "Example Paper"}]],
        }

        from app.chroma.retrieval import query_ohdsi_papers

        results = query_ohdsi_papers("diabetes", top_k=2)

        assert len(results) == 1
        mock_coll.count.assert_not_called()
        mock_coll.query.assert_called_once_with(query_texts=["diabetes"], n_results=2)
