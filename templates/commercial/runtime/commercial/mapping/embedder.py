"""``BgeEmbedder`` — lazy-loaded sentence-transformers wrapper for bge-base.

Phase 3 Plan 6 Task 2 (T-024A). Commercial-tier (proprietary). Wraps
``BAAI/bge-base-en-v1.5`` (768-dim retrieval encoder, MIT-licensed
weights) for the Plan 6 retrieve-then-rerank pipeline.

Lazy load:

- The model is NOT loaded in ``__init__``; the first call to ``embed()``
  triggers ``SentenceTransformer(model_name)``. This keeps test setup
  cheap (no ~430 MB download in unit-test contexts) and lets callers
  hold a long-lived ``BgeEmbedder`` instance without paying the load
  cost until they actually need to embed something.
- ``normalize_embeddings=True`` so the cosine-similarity returned by
  pgvector's ``<=>`` operator is exactly what the encoder intended.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover
    from sentence_transformers import SentenceTransformer


class BgeEmbedder:
    """Lazy-loaded wrapper around ``BAAI/bge-base-en-v1.5``.

    Construction is cheap; the model loads on first ``embed()`` call.
    Pass ``loader`` to inject a fake/mock for testing.
    """

    type_name = "bge_embedder"

    DEFAULT_MODEL = "BAAI/bge-base-en-v1.5"
    EMBEDDING_DIM = 768

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        *,
        loader: Any = None,
    ) -> None:
        self._model_name = model_name
        self._loader = loader  # injectable for tests; None = real loader
        self._model: SentenceTransformer | None = None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def _load(self) -> SentenceTransformer:
        if self._model is None:
            if self._loader is not None:
                self._model = self._loader(self._model_name)
            else:
                # Real load deferred to first call so unit tests don't
                # download the model.
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self._model_name)
        assert self._model is not None
        return self._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of text strings into 768-dim unit vectors."""
        if not texts:
            return []
        model = self._load()
        encoded = model.encode(texts, normalize_embeddings=True)
        # SentenceTransformer.encode returns a numpy array; convert to a
        # list-of-lists for downstream pgvector binding.
        return [list(map(float, row)) for row in encoded]


__all__ = ["BgeEmbedder"]
