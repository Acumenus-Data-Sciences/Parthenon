"""ChromaDB collection accessors.

Each collection has a specific embedding function and metadata schema.
Collections are created lazily on first access via get_or_create_collection.
"""
import logging
from typing import Any

from chromadb.api.models.Collection import Collection

from app.chroma.client import get_chroma_client
from app.chroma.embeddings import get_clinical_embedder, get_general_embedder

logger = logging.getLogger(__name__)
_collection_cache: dict[str, Collection] = {}

CONVERSATION_MEMORY_COLLECTION = "conversation_memory"


def _get_cached_collection(
    cache_key: str,
    *,
    name: str,
    embedding_function: Any,
    metadata: dict[str, str],
) -> Collection:
    cached = _collection_cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=name,
        embedding_function=embedding_function,
        metadata=metadata,
    )
    _collection_cache[cache_key] = collection
    return collection


def get_docs_collection() -> Collection:
    """Documentation chunks collection (384-dim, sentence-transformers)."""
    return _get_cached_collection(
        "docs",
        name="docs",
        embedding_function=get_general_embedder(),  # type: ignore[arg-type]
        metadata={"hnsw:space": "cosine"},
    )


def get_conversation_memory_collection() -> Collection:
    """Shared Abby conversation memory collection filtered by user_id."""
    return _get_cached_collection(
        "conversation_memory",
        name=CONVERSATION_MEMORY_COLLECTION,
        embedding_function=get_general_embedder(),  # type: ignore[arg-type]
        metadata={"hnsw:space": "cosine"},
    )


def get_user_conversation_collection(user_id: int) -> Collection:
    """Backward-compatible wrapper for Abby conversation memory."""
    logger.debug(
        "get_user_conversation_collection(%s) is deprecated; using shared %s collection",
        user_id,
        CONVERSATION_MEMORY_COLLECTION,
    )
    return get_conversation_memory_collection()


def get_faq_collection() -> Collection:
    """Shared FAQ collection promoted from common questions (384-dim)."""
    return _get_cached_collection(
        "faq_shared",
        name="faq_shared",
        embedding_function=get_general_embedder(),  # type: ignore[arg-type]
        metadata={"hnsw:space": "cosine"},
    )


def get_clinical_collection() -> Collection:
    """Clinical reference collection using SapBERT (768-dim)."""
    return _get_cached_collection(
        "clinical_reference",
        name="clinical_reference",
        embedding_function=get_clinical_embedder(),  # type: ignore[arg-type]
        metadata={"hnsw:space": "cosine"},
    )


def get_ohdsi_papers_collection() -> Collection:
    """OHDSI research papers collection using SapBERT (768-dim).

    Contains chunked text from open-access publications by OHDSI community
    members, used to ground Abby's responses in peer-reviewed literature.
    """
    return _get_cached_collection(
        "ohdsi_papers",
        name="ohdsi_papers",
        embedding_function=get_clinical_embedder(),  # type: ignore[arg-type]
        metadata={"hnsw:space": "cosine"},
    )
