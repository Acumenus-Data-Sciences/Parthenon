"""Dual embedding providers for ChromaDB collections.

- GeneralEmbedder: sentence-transformers/all-MiniLM-L6-v2 (384-dim) for docs/conversations/FAQ
- ClinicalEmbedder: SapBERT (768-dim) for clinical reference content
"""
import logging
from functools import lru_cache

import numpy as np
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

logger = logging.getLogger(__name__)


class GeneralEmbedder(EmbeddingFunction[Documents]):
    """Sentence-transformers embedding for general text (384 dimensions)."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)
        logger.info("Loaded general embedder: %s", model_name)

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = self._model.encode(input, convert_to_numpy=True)
        if isinstance(embeddings, np.ndarray):
            return embeddings.tolist()
        return [e.tolist() if hasattr(e, "tolist") else list(e) for e in embeddings]


class ClinicalEmbedder(EmbeddingFunction[Documents]):
    """SapBERT embedding for clinical/medical content (768 dimensions)."""

    def __init__(self) -> None:
        from app.services.sapbert import get_sapbert_service

        self._service = get_sapbert_service()
        logger.info("Clinical embedder using SapBERT service")

    def __call__(self, input: Documents) -> Embeddings:
        return self._service.encode(list(input))


@lru_cache(maxsize=1)
def get_general_embedder() -> GeneralEmbedder:
    """Singleton general embedder."""
    return GeneralEmbedder()


@lru_cache(maxsize=1)
def get_clinical_embedder() -> ClinicalEmbedder:
    """Singleton clinical embedder."""
    return ClinicalEmbedder()
