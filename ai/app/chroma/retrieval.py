"""RAG retrieval from ChromaDB collections.

Queries relevant collections based on page context, assembles context
for injection into Abby's system prompt. Uses concurrent thread pool queries
and relevance-ranked cross-collection results.
"""
import logging
from pathlib import Path
import re
from concurrent.futures import ThreadPoolExecutor

from chromadb.api.types import QueryResult

from app.chroma.collections import (
    get_conversation_memory_collection,
    get_docs_collection,
    get_faq_collection,
    get_medical_textbooks_collection,
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
    "textbook": "Medical Textbook Reference",
}

STOPWORDS = {
    "a", "an", "and", "are", "at", "be", "by", "can", "could", "does", "for",
    "from", "have", "how", "i", "in", "is", "it", "of", "on", "or", "that",
    "the", "their", "this", "to", "was", "what", "when", "where", "which",
    "who", "why", "with", "you", "your",
}
_UPPERCASE_TITLE_WORDS = {"cdm", "dna", "faq", "fda", "hgvs", "hipaa", "ncbi", "ohdsi", "omop", "rna"}

_TEXTBOOK_TOPIC_PATTERN = re.compile(
    r"\b("
    r"clinvar|hgvs|variant|variants|variantology|genomics|genomic|gene|genes|genetic|genetics|"
    r"molecular|cell biology|cellular|dna|rna|protein|proteins|transcript|transcripts|"
    r"chromosome|chromosomes|allele|alleles|mutation|mutations|pathogenicity|"
    r"clinical trial endpoint|longitudinal data analysis"
    r")\b",
    re.IGNORECASE,
)

_TEXTBOOK_PAGES = {"genomics"}


def _normalize_text(text: str) -> str:
    """Lowercase and normalize punctuation for lexical matching."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _humanize_source_name(path: str) -> str:
    """Turn a filename/path into a readable fallback title."""
    stem = Path(path).stem
    words = re.sub(r"[_-]+", " ", stem).strip().split()
    return " ".join(
        word.upper() if word.lower() in _UPPERCASE_TITLE_WORDS else word.capitalize()
        for word in words
    ) or stem


def _normalize_result_metadata(meta: dict, doc: str) -> tuple[str, str, str, str | None]:
    """Normalize metadata across collections to a stable provenance shape."""
    source_file = str(meta.get("source_file") or meta.get("source") or "").strip()
    title = str(meta.get("title") or "").strip()
    section = str(meta.get("section") or meta.get("heading_path") or "").strip()
    url = str(meta.get("url") or meta.get("doi") or "").strip() or None

    if not title and source_file:
        title = _humanize_source_name(source_file)
    if not section and title:
        first_line = doc.splitlines()[0].strip() if doc else ""
        if first_line.startswith("#"):
            cleaned = first_line.lstrip("#").strip()
            if cleaned and cleaned != title:
                section = cleaned

    return title, source_file, section, url


def _query_terms(query: str) -> list[str]:
    """Extract meaningful query terms for lexical fallback and reranking."""
    return [
        token
        for token in _normalize_text(query).split()
        if len(token) > 1 and token not in STOPWORDS
    ]


def _term_overlap(haystack: str, terms: list[str]) -> float:
    """Fraction of query terms present in the normalized haystack."""
    if not terms:
        return 0.0
    present = sum(1 for term in terms if term in haystack)
    return present / len(terms)


def _convert_distances_to_results(
    query: str,
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
    query_terms = _query_terms(query)
    query_phrase = " ".join(query_terms)
    results = []
    for doc, dist, meta in zip(documents, distances, metadatas):
        title, source_file, section, url = _normalize_result_metadata(meta, doc)
        title_or_source = title if title else source_file

        normalized_title = _normalize_text(title_or_source)
        normalized_doc = _normalize_text(doc)
        title_overlap = _term_overlap(normalized_title, query_terms)
        body_overlap = _term_overlap(normalized_doc, query_terms)
        exact_phrase = bool(query_phrase) and (
            query_phrase in normalized_title or query_phrase in normalized_doc
        )
        lexical_match = exact_phrase or title_overlap >= 0.5 or body_overlap >= 1.0

        if dist > threshold and not lexical_match:
            continue

        lexical_bonus = (0.25 * title_overlap) + (0.15 * body_overlap)
        if exact_phrase:
            lexical_bonus += 0.2

        results.append({
            "text": doc,
            "score": round((1.0 - dist) + lexical_bonus, 3),
            "distance": round(dist, 3),
            "source_tag": source_tag,
            "source_label": SOURCE_LABELS.get(source_tag, source_tag),
            "title": title_or_source,
            "source_file": source_file,
            "section": section,
            "url": url,
        })
    return sorted(  # type: ignore[return-value]
        results,
        key=lambda r: (float(r["score"]), -float(r["distance"])),
        reverse=True,
    )


def _extract_query_results(
    query: str,
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
        query,
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
        return _extract_query_results(query, results, threshold, "docs")
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
        collection = get_conversation_memory_collection()
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where={"user_id": user_id},
        )
        return _extract_query_results(query, results, threshold, "conv")
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
        return _extract_query_results(query, results, threshold, "faq")
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
        return _extract_query_results(query, results, threshold, "clinical")
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
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(query, results, threshold, "ohdsi")
    except Exception as e:
        logger.warning("OHDSI papers query failed: %s", e)
        return []


def query_medical_textbooks(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the foundational medical textbooks collection."""
    try:
        collection = get_medical_textbooks_collection()
        results = collection.query(query_texts=[query], n_results=top_k)
        return _extract_query_results(query, results, threshold, "textbook")
    except Exception as e:
        logger.warning("Medical textbooks query failed: %s", e)
        return []


def _should_query_medical_textbooks(query: str, page_context: str) -> bool:
    """Only consult textbooks for foundational biology/genomics questions."""
    return page_context in _TEXTBOOK_PAGES or bool(_TEXTBOOK_TOPIC_PATTERN.search(query))


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
    top_results = get_ranked_rag_results(query, page_context, user_id)
    if not top_results:
        return ""

    # Format with source attribution
    lines: list[str] = []
    for r in top_results:
        source = r.get("source_label", "Unknown")
        title = r.get("title", "")
        section = r.get("section", "")
        score = r.get("score", 0)
        text = str(r.get("text", ""))
        # Truncate long chunks to keep context window reasonable
        if len(text) > 600:
            text = text[:600] + "..."
        attribution = f"[{source}"
        if title:
            attribution += f" — {title}"
        if section and section != title:
            attribution += f" / {section}"
        attribution += f", relevance: {score}]"
        lines.append(f"{attribution}\n{text}")

    logger.info(
        "RAG: %d ranked results (top score: %.3f)",
        len(top_results),
        top_results[0].get("score", 0) if top_results else 0,
    )

    return (
        "\n\nKNOWLEDGE BASE (retrieved documents ranked by relevance):\n\n"
        + "\n\n---\n\n".join(lines)
    )


def get_ranked_rag_results(
    query: str,
    page_context: str,
    user_id: int | None = None,
) -> list[dict[str, object]]:
    """Return top-ranked RAG results across all relevant collections."""
    is_clinical = page_context in CLINICAL_PAGES

    futures = {
        "docs": _query_pool.submit(query_docs, query),
        "faq": _query_pool.submit(query_faq, query),
    }
    if user_id is not None:
        futures["conv"] = _query_pool.submit(query_user_conversations, query, user_id)
    if is_clinical:
        futures["clinical"] = _query_pool.submit(query_clinical, query)
        futures["ohdsi"] = _query_pool.submit(query_ohdsi_papers, query)
    if _should_query_medical_textbooks(query, page_context):
        futures["textbook"] = _query_pool.submit(query_medical_textbooks, query)

    all_results: list[dict[str, object]] = []
    for key, future in futures.items():
        try:
            all_results.extend(future.result(timeout=10))
        except Exception as e:
            logger.warning("RAG query '%s' failed: %s", key, e)

    if not all_results:
        return []

    def _score(r: dict[str, object]) -> float:
        v = r.get("score", 0)
        return float(v) if isinstance(v, (int, float, str)) else 0.0

    all_results.sort(key=_score, reverse=True)

    seen_prefixes: set[str] = set()
    top_results: list[dict[str, object]] = []
    for r in all_results:
        text = str(r.get("text", ""))
        prefix = text[:100]
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)
        top_results.append(r)
        if len(top_results) >= 8:
            break

    return top_results
