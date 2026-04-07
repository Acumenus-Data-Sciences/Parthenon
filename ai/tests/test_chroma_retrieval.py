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


def test_query_docs_normalizes_source_file_title_and_section():
    """Docs retrieval should return stable provenance fields even from docs metadata."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["# HGVS Variant Nomenclature\nHGVS stands for Human Genome Variation Society nomenclature."]],
            "distances": [[0.15]],
            "metadatas": [[{
                "source": "reference/hgvs.md",
                "title": "HGVS Variant Nomenclature",
                "section": "Definition",
            }]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("What is HGVS nomenclature?", top_k=3)

        assert len(results) == 1
        assert results[0]["source_tag"] == "docs"
        assert results[0]["source_label"] == "Parthenon Documentation"
        assert results[0]["title"] == "HGVS Variant Nomenclature"
        assert results[0]["source_file"] == "reference/hgvs.md"
        assert results[0]["section"] == "Definition"
        assert results[0]["url"] is None


def test_query_docs_falls_back_to_source_for_legacy_metadata():
    """Older docs chunks without explicit title/source_file should still produce provenance."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["HGVS stands for Human Genome Variation Society nomenclature."]],
            "distances": [[0.15]],
            "metadatas": [[{"source": "reference/hgvs.md"}]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("What is HGVS nomenclature?", top_k=3)

        assert len(results) == 1
        assert results[0]["title"] == "HGVS"
        assert results[0]["source_file"] == "reference/hgvs.md"


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


def test_query_docs_keeps_exact_name_match_even_above_distance_threshold():
    """Exact name matches should survive the semantic threshold cutoff."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [[
                "Paul Nagy is part of the OHDSI Medical Imaging Working Group.",
                "Generic unrelated text.",
            ]],
            "distances": [[0.62, 0.2]],
            "metadatas": [[
                {"source": "paul.md"},
                {"source": "other.md"},
            ]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("Who is Paul Nagy?", top_k=3)

        assert any("Paul Nagy" in result["text"] for result in results)


def test_query_ohdsi_papers_boosts_title_overlap():
    """Exact title overlap should outrank generic semantic mentions."""
    with patch("app.chroma.collections.get_ohdsi_papers_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [[
                "This mentions the Observational Medical Outcomes Partnership Common Data Model in passing.",
                "An overview of the OMOP Common Data Model and its tables.",
            ]],
            "distances": [[0.23, 0.35]],
            "metadatas": [[
                {"source_file": "SingleStudies.md", "title": "CohortMethod"},
                {"source_file": "CommonDataModel.md", "title": "The Common Data Model"},
            ]],
        }

        from app.chroma.retrieval import query_ohdsi_papers

        results = query_ohdsi_papers("What is the OMOP Common Data Model?", top_k=3)

        assert len(results) == 2
        assert results[0]["title"] == "The Common Data Model"


def test_query_medical_textbooks_uses_separate_collection():
    """Textbook retrieval should query the dedicated textbook collection."""
    with patch("app.chroma.retrieval.get_medical_textbooks_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["HGVS is a nomenclature standard for sequence variants."]],
            "distances": [[0.1]],
            "metadatas": [[{"title": "Lewin's GENES XII"}]],
        }

        from app.chroma.retrieval import query_medical_textbooks

        results = query_medical_textbooks("What is HGVS?", top_k=2)

        assert len(results) == 1
        assert results[0]["source_tag"] == "textbook"
        mock_coll.query.assert_called_once_with(query_texts=["What is HGVS?"], n_results=2)


def test_query_wiki_uses_wiki_collection():
    """Wiki retrieval should query the dedicated SapBERT wiki collection."""
    with patch("app.chroma.retrieval.get_wiki_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["The paper reports federated oncology results."]],
            "distances": [[0.1]],
            "metadatas": [[{"title": "Federated Oncology Paper", "source_slug": "federated-oncology-paper", "page_type": "concept"}]],
        }

        from app.chroma.retrieval import query_wiki

        results = query_wiki("What does the oncology paper say?", top_k=2)

        assert len(results) == 1
        assert results[0]["source_tag"] == "wiki"
        assert results[0]["source_label"] == "Knowledge Base Paper"
        assert results[0]["title"] == "Federated Oncology Paper"
        mock_coll.query.assert_called_once_with(query_texts=["What does the oncology paper say?"], n_results=2)


def test_get_ranked_rag_results_only_queries_textbooks_for_foundational_topics():
    """Textbooks should be queried selectively, not for every OHDSI request."""
    docs_future = MagicMock()
    docs_future.result.return_value = []
    faq_future = MagicMock()
    faq_future.result.return_value = []
    clinical_future = MagicMock()
    clinical_future.result.return_value = []
    ohdsi_future = MagicMock()
    ohdsi_future.result.return_value = []
    textbook_future = MagicMock()
    textbook_future.result.return_value = [{"text": "HGVS reference", "score": 0.9}]

    with patch("app.chroma.retrieval._query_pool.submit") as mock_submit:
        mock_submit.side_effect = [
            docs_future,
            faq_future,
            clinical_future,
            ohdsi_future,
            textbook_future,
        ]

        from app.chroma.retrieval import get_ranked_rag_results

        results = get_ranked_rag_results("What is HGVS?", page_context="genomics", user_id=None)

        assert results
        submitted_fns = [call.args[0].__name__ for call in mock_submit.call_args_list]
        assert "query_medical_textbooks" in submitted_fns

    docs_future = MagicMock()
    docs_future.result.return_value = []
    faq_future = MagicMock()
    faq_future.result.return_value = []

    with patch("app.chroma.retrieval._query_pool.submit") as mock_submit:
        mock_submit.side_effect = [docs_future, faq_future]

        from app.chroma.retrieval import get_ranked_rag_results

        get_ranked_rag_results("How do I build a cohort?", page_context="general", user_id=None)

        submitted_fns = [call.args[0].__name__ for call in mock_submit.call_args_list]
        assert "query_medical_textbooks" not in submitted_fns


def test_get_ranked_rag_results_queries_wiki_for_commons_abby():
    """Commons Abby should consult the wiki knowledge base for newly ingested papers."""
    docs_future = MagicMock()
    docs_future.result.return_value = []
    faq_future = MagicMock()
    faq_future.result.return_value = []
    wiki_future = MagicMock()
    wiki_future.result.return_value = [{"text": "Wiki paper result", "score": 0.92, "source_tag": "wiki"}]

    with patch("app.chroma.retrieval._query_pool.submit") as mock_submit:
        mock_submit.side_effect = [docs_future, faq_future, wiki_future]

        from app.chroma.retrieval import get_ranked_rag_results

        results = get_ranked_rag_results("Summarize the new paper", page_context="commons_ask_abby", user_id=None)

        assert results
        submitted_fns = [call.args[0].__name__ for call in mock_submit.call_args_list]
        assert "query_wiki" in submitted_fns
