"""BGE concept embedding service for Ariadne vector search.

The `vocab.concept_embedding_bge` table was populated with
``BAAI/bge-base-en-v1.5`` (768-dim, L2-normalised). Ariadne's query vectors
MUST be produced by the *same* model or cosine similarity is meaningless —
this is the same failure mode as Hecate's embedding-alias drift, where matching
dimensions (768) silently mask a model mismatch and every score collapses.

This service is intentionally independent of ``get_sapbert_service()`` (which
prefers Ollama ``nomic-embed-text``) so the encoder is *deterministically* BGE
and stays in lockstep with the stored document vectors.
"""

import logging
import os
import threading
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class BgeEmbeddingService:
    """Lazy-loaded SentenceTransformer wrapper for BAAI/bge-base-en-v1.5.

    Documents (concept names) were embedded without an instruction prefix.
    For bge-*-en-v1.5 the query instruction is only recommended for asymmetric
    short-query → long-passage retrieval; concept-name ↔ concept-name matching
    is symmetric, so the prefix is opt-in via ``ariadne_bge_query_instruction``.
    """

    def __init__(self) -> None:
        self._model: Any = None
        self._load_lock = threading.Lock()
        self._instruction = settings.ariadne_bge_query_instruction

    def _load_model(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            from sentence_transformers import SentenceTransformer  # lazy: heavy import

            device = "cpu"
            try:
                import torch

                if torch.cuda.is_available():
                    device = "cuda"
            except Exception:  # noqa: BLE001 — torch optional / CUDA probe may throw
                device = "cpu"

            cache_dir = settings.ariadne_bge_cache_dir
            os.makedirs(cache_dir, exist_ok=True)
            logger.info(
                "Loading BGE model %s (device=%s, cache=%s)",
                settings.ariadne_bge_model,
                device,
                cache_dir,
            )
            self._model = SentenceTransformer(
                settings.ariadne_bge_model,
                cache_folder=cache_dir,
                device=device,
            )
            logger.info("BGE model loaded successfully")

    def encode_query(self, term: str) -> list[float]:
        """Encode a search term into a 768-dim, L2-normalised query vector."""
        self._load_model()
        assert self._model is not None
        text = f"{self._instruction}{term}" if self._instruction else term
        vec = self._model.encode([text], normalize_embeddings=True)[0]
        return [float(x) for x in vec]

    def encode_documents(self, terms: list[str]) -> list[list[float]]:
        """Encode concept names in batches for the durable vocabulary synchronizer."""
        if not terms:
            return []
        self._load_model()
        assert self._model is not None
        vectors = self._model.encode(terms, normalize_embeddings=True)
        return [[float(value) for value in vector] for vector in vectors]

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def embedding_dim(self) -> int:
        return 768


_bge_service: BgeEmbeddingService | None = None


def get_bge_service() -> BgeEmbeddingService:
    """Return the process-wide BGE embedding service singleton."""
    global _bge_service
    if _bge_service is None:
        _bge_service = BgeEmbeddingService()
    return _bge_service
