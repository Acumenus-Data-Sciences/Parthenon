"""RAG retrieval from ChromaDB collections.

Queries relevant collections based on page context, assembles context
for injection into Abby's system prompt. Uses concurrent thread pool queries.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from chromadb.api.types import QueryResult

from app.chroma.collections import (
    get_docs_collection,
    get_faq_collection,
    get_user_conversation_collection,
)

logger = logging.getLogger(__name__)

# Shared thread pool for parallel ChromaDB queries
_query_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="chroma-rag")

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

    Queries relevant collections IN PARALLEL via thread pool and assembles
    a formatted context block. Returns empty string if no relevant results found.
    """
    is_clinical = page_context in CLINICAL_PAGES

    # Submit all queries concurrently to thread pool
    futures = {
        "docs": _query_pool.submit(query_docs, query),
        "faq": _query_pool.submit(query_faq, query),
    }
    if user_id is not None:
        futures["conv"] = _query_pool.submit(query_user_conversations, query, user_id)
    if is_clinical:
        futures["clinical"] = _query_pool.submit(query_clinical, query)
        futures["ohdsi"] = _query_pool.submit(query_ohdsi_papers, query)

    # Collect all results (blocks until all done, but they run in parallel)
    results: dict[str, list] = {}
    for key, future in futures.items():
        try:
            results[key] = future.result(timeout=10)
        except Exception as e:
            logger.warning("RAG query '%s' failed: %s", key, e)
            results[key] = []

    # Assemble context from results
    sections: list[str] = []

    if results.get("docs"):
        doc_texts = "\n".join(f"- {r['text']}" for r in results["docs"][:3])
        sections.append(f"Documentation:\n{doc_texts}")

    if results.get("conv"):
        conv_texts = "\n".join(f"- {r['text']}" for r in results["conv"][:3])
        sections.append(f"Previous conversations:\n{conv_texts}")

    if results.get("faq"):
        faq_texts = "\n".join(f"- {r['text']}" for r in results["faq"][:3])
        sections.append(f"Common questions:\n{faq_texts}")

    if results.get("clinical"):
        clin_texts = "\n".join(f"- {r['text']}" for r in results["clinical"][:3])
        sections.append(f"Clinical reference:\n{clin_texts}")

    if results.get("ohdsi"):
        paper_texts = [f"- {r['text']}" for r in results["ohdsi"][:3] if isinstance(r.get("text"), str)]
        if paper_texts:
            sections.append(f"OHDSI research literature:\n" + "\n".join(paper_texts))

    if not sections:
        return ""

    return "\n\nKNOWLEDGE BASE (use this context to inform your response):\n\n" + "\n\n".join(sections)
