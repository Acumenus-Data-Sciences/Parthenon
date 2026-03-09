"""ChromaDB collection accessors.

Each collection has a specific embedding function and metadata schema.
Collections are created lazily on first access via get_or_create_collection.
"""
import logging

from chromadb.api.models.Collection import Collection

from app.chroma.client import get_chroma_client
from app.chroma.embeddings import get_clinical_embedder, get_general_embedder

logger = logging.getLogger(__name__)


def get_docs_collection() -> Collection:
    """Documentation chunks collection (384-dim, sentence-transformers)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="docs",
        embedding_function=get_general_embedder(),
        metadata={"hnsw:space": "cosine"},
    )


def get_user_conversation_collection(user_id: int) -> Collection:
    """Per-user conversation memory (384-dim, sentence-transformers)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=f"conversations_user_{user_id}",
        embedding_function=get_general_embedder(),
        metadata={"hnsw:space": "cosine"},
    )


def get_faq_collection() -> Collection:
    """Shared FAQ collection promoted from common questions (384-dim)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="faq_shared",
        embedding_function=get_general_embedder(),
        metadata={"hnsw:space": "cosine"},
    )


def get_clinical_collection() -> Collection:
    """Clinical reference collection using SapBERT (768-dim)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="clinical_reference",
        embedding_function=get_clinical_embedder(),
        metadata={"hnsw:space": "cosine"},
    )
