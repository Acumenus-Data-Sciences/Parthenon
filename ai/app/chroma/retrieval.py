"""RAG retrieval from ChromaDB collections.

Queries relevant collections based on page context, assembles context
for injection into Abby's system prompt. Uses concurrent thread pool queries
and relevance-ranked cross-collection results.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

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

# ChromaDB returns cosine distance in [0, 2] range.
# distance 0 = identical, 1 = orthogonal, 2 = opposite.
# We filter: distance <= threshold means similarity >= (1 - threshold).
# 0.5 means similarity >= 0.5 — reasonable for semantic match.
DEFAULT_DISTANCE_THRESHOLD = 0.5
DEFAULT_TOP_K = 5  # Fetch more candidates for better cross-collection ranking

# Source labels for attribution
SOURCE_LABELS = {
    "docs": "Parthenon Documentation",
    "conv": "Previous Conversation",
    "faq": "FAQ",
    "clinical": "Clinical Reference (OMOP Vocabulary)",
    "ohdsi": "OHDSI Research Literature",
}


def _convert_distances_to_results(
    documents: list[str],
    distances: list[float],
    metadatas: list[dict],
    threshold: float,
    source_tag: str,
) -> list[dict[str, object]]:
    """Convert ChromaDB query results to ranked result dicts with source attribution.

    ChromaDB returns cosine distances (0 = identical, 2 = opposite).
    Filters by distance threshold and adds source tag for attribution.
    """
    results = []
    for doc, dist, meta in zip(documents, distances, metadatas):
        if dist <= threshold:
            title = meta.get("title", "")
            source_file = meta.get("source_file", "")
            results.append({
                "text": doc,
                "score": round(1.0 - dist, 3),
                "distance": round(dist, 3),
                "source_tag": source_tag,
                "source_label": SOURCE_LABELS.get(source_tag, source_tag),
                "title": title if title else source_file,
            })
    return sorted(results, key=lambda r: r["score"], reverse=True)  # type: ignore[return-value]


def _extract_query_results(
    results: QueryResult,
    threshold: float,
    source_tag: str,
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
        source_tag,
    )


def query_docs(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the documentation collection."""
    try:
        collection = get_docs_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold, "docs")
    except Exception as e:
        logger.warning("Docs query failed: %s", e)
        return []


def query_user_conversations(
    query: str,
    user_id: int,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[dict[str, object]]:
    """Query a user's conversation history collection."""
    try:
        collection = get_user_conversation_collection(user_id)
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold, "conv")
    except Exception as e:
        logger.warning("Conversation query failed for user %s: %s", user_id, e)
        return []


def query_faq(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the shared FAQ collection."""
    try:
        collection = get_faq_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold, "faq")
    except Exception as e:
        logger.warning("FAQ query failed: %s", e)
        return []


def query_clinical(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the clinical reference collection (SapBERT embeddings)."""
    try:
        from app.chroma.collections import get_clinical_collection
        collection = get_clinical_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold, "clinical")
    except Exception as e:
        logger.warning("Clinical query failed: %s", e)
        return []


def query_ohdsi_papers(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the OHDSI research papers collection (SapBERT embeddings)."""
    try:
        from app.chroma.collections import get_ohdsi_papers_collection
        collection = get_ohdsi_papers_collection()
        if collection.count() == 0:
            return []
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(results, threshold, "ohdsi")
    except Exception as e:
        logger.warning("OHDSI papers query failed: %s", e)
        return []


def build_rag_context(
    query: str,
    page_context: str,
    user_id: int | None = None,
) -> str:
    """Build RAG context string for injection into Abby's system prompt.

    Queries relevant collections IN PARALLEL via thread pool, merges all
    results, ranks by relevance score across collections, and formats
    with source attribution. Returns empty string if no relevant results found.
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

    # Collect all results
    all_results: list[dict[str, object]] = []
    source_counts: dict[str, int] = {}
    for key, future in futures.items():
        try:
            results = future.result(timeout=10)
            all_results.extend(results)
            source_counts[key] = len(results)
        except Exception as e:
            logger.warning("RAG query '%s' failed: %s", key, e)

    if not all_results:
        return ""

    # Sort ALL results by relevance score (cross-collection ranking)
    def _score(r: dict[str, object]) -> float:
        v = r.get("score", 0)
        return float(v) if isinstance(v, (int, float, str)) else 0.0

    all_results.sort(key=_score, reverse=True)

    # Take top 8 results across all collections (deduplicated by text prefix)
    seen_prefixes: set[str] = set()
    top_results: list[dict[str, object]] = []
    for r in all_results:
        text = str(r.get("text", ""))
        prefix = text[:100]
        if prefix not in seen_prefixes:
            seen_prefixes.add(prefix)
            top_results.append(r)
            if len(top_results) >= 8:
                break

    if not top_results:
        return ""

    # Format with source attribution
    lines: list[str] = []
    for r in top_results:
        source = r.get("source_label", "Unknown")
        title = r.get("title", "")
        score = r.get("score", 0)
        text = str(r.get("text", ""))
        # Truncate long chunks to keep context window reasonable
        if len(text) > 600:
            text = text[:600] + "..."
        attribution = f"[{source}"
        if title:
            attribution += f" — {title}"
        attribution += f", relevance: {score}]"
        lines.append(f"{attribution}\n{text}")

    logger.info(
        "RAG: %d results from %s (top score: %.3f)",
        len(top_results),
        source_counts,
        top_results[0].get("score", 0) if top_results else 0,
    )

    return (
        "\n\nKNOWLEDGE BASE (retrieved documents ranked by relevance):\n\n"
        + "\n\n---\n\n".join(lines)
    )
