"""RAG retrieval from ChromaDB collections.

Queries relevant collections based on page context, assembles context
for injection into Abby's system prompt.
"""
import logging

from chromadb.api.types import QueryResult

from app.chroma.collections import (
    get_docs_collection,
    get_faq_collection,
    get_user_conversation_collection,
)

logger = logging.getLogger(__name__)

CLINICAL_PAGES = {
    "cohort_builder", "vocabulary", "data_explorer", "data_quality",
    "analyses", "incidence_rates", "estimation", "prediction",
    "genomics", "imaging", "patient_profiles", "care_gaps",
}

DEFAULT_THRESHOLD = 0.3
DEFAULT_TOP_K = 3


def _convert_distances_to_results(
    documents: list[str],
    distances: list[float],
    metadatas: list[dict],
    threshold: float,
) -> list[dict[str, object]]:
    """Convert ChromaDB query results to ranked result dicts.

    ChromaDB returns cosine distances (0 = identical, 2 = opposite).
    We convert to similarity scores (1 - distance) and filter by threshold.
    """
    results = []
    for doc, dist, meta in zip(documents, distances, metadatas):
        similarity = 1.0 - dist
        if dist <= threshold:
            results.append({
                "text": doc,
                "score": similarity,
                "source": meta.get("source", "unknown"),
            })
    return sorted(results, key=lambda r: r["score"], reverse=True)


def _extract_query_results(
    results: QueryResult,
    threshold: float,
) -> list[dict[str, object]]:
    """Safely extract query results from ChromaDB response with None checks."""
    documents = results.get("documents")
    distances = results.get("distances")
    metadatas = results.get("metadatas")
    if documents is None or distances is None or metadatas is None:
        return []
    docs_list: list[list[str]] = documents  # type: ignore[assignment]
    dist_list: list[list[float]] = distances  # type: ignore[assignment]
    meta_list: list[list[dict[str, object]]] = metadatas  # type: ignore[assignment]
    if not docs_list or not dist_list or not meta_list:
        return []
    return _convert_distances_to_results(
        docs_list[0],
        dist_list[0],
        meta_list[0],
        threshold,
    )


def query_docs(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the documentation collection."""
    try:
        collection = get_docs_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold)
    except Exception as e:
        logger.warning("Docs query failed: %s", e)
        return []


def query_user_conversations(
    query: str,
    user_id: int,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query a user's conversation history collection."""
    try:
        collection = get_user_conversation_collection(user_id)
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold)
    except Exception as e:
        logger.warning("Conversation query failed for user %s: %s", user_id, e)
        return []


def query_faq(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the shared FAQ collection."""
    try:
        collection = get_faq_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold)
    except Exception as e:
        logger.warning("FAQ query failed: %s", e)
        return []


def query_clinical(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the clinical reference collection (SapBERT embeddings)."""
    try:
        from app.chroma.collections import get_clinical_collection
        collection = get_clinical_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold)
    except Exception as e:
        logger.warning("Clinical query failed: %s", e)
        return []


def query_ohdsi_papers(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the OHDSI research papers collection (SapBERT embeddings)."""
    try:
        from app.chroma.collections import get_ohdsi_papers_collection
        collection = get_ohdsi_papers_collection()
        if collection.count() == 0:
            return []
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold)
    except Exception as e:
        logger.warning("OHDSI papers query failed: %s", e)
        return []


def build_rag_context(
    query: str,
    page_context: str,
    user_id: int | None = None,
) -> str:
    """Build RAG context string for injection into Abby's system prompt.

    Queries relevant collections and assembles a formatted context block.
    Returns empty string if no relevant results found.
    """
    sections: list[str] = []

    doc_results = query_docs(query)
    if doc_results:
        doc_texts = "\n".join(f"- {r['text']}" for r in doc_results[:3])
        sections.append(f"Documentation:\n{doc_texts}")

    if user_id is not None:
        conv_results = query_user_conversations(query, user_id)
        if conv_results:
            conv_texts = "\n".join(f"- {r['text']}" for r in conv_results[:3])
            sections.append(f"Previous conversations:\n{conv_texts}")

    faq_results = query_faq(query)
    if faq_results:
        faq_texts = "\n".join(f"- {r['text']}" for r in faq_results[:3])
        sections.append(f"Common questions:\n{faq_texts}")

    if page_context in CLINICAL_PAGES:
        clinical_results = query_clinical(query)
        if clinical_results:
            clin_texts = "\n".join(f"- {r['text']}" for r in clinical_results[:3])
            sections.append(f"Clinical reference:\n{clin_texts}")

        ohdsi_results = query_ohdsi_papers(query)
        if ohdsi_results:
            paper_texts = []
            for r in ohdsi_results[:3]:
                title = r.get("source", "")
                if isinstance(r.get("text"), str):
                    paper_texts.append(f"- {r['text']}")
            if paper_texts:
                sections.append(f"OHDSI research literature:\n" + "\n".join(paper_texts))

    if not sections:
        return ""

    return "\n\nKNOWLEDGE BASE (use this context to inform your response):\n\n" + "\n\n".join(sections)
