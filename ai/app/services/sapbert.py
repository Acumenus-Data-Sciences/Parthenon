"""SapBERT embedding service.

Generates 768-dimensional embeddings for medical concept names using the
cambridgeltl/SapBERT-from-PubMedBERT-fulltext model.
"""

import logging
from functools import lru_cache
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

try:
    import torch
    from transformers import AutoModel, AutoTokenizer  # type: ignore[import-untyped]
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False
    torch = None  # type: ignore[assignment]
    AutoModel = None  # type: ignore[assignment,misc]
    AutoTokenizer = None  # type: ignore[assignment,misc]


class SapBERTService:
    """Lazy-loaded SapBERT model for generating concept embeddings."""

    def __init__(self) -> None:
        self._model: Any = None
        self._tokenizer: Any = None
        self._device: str = "cuda" if (_HAS_TORCH and torch.cuda.is_available()) else "cpu"

    def _load_model(self) -> None:
        """Load model and tokenizer on first use."""
        if self._model is not None:
            return
        if not _HAS_TORCH:
            raise RuntimeError("torch/transformers not installed — SapBERT unavailable")

        logger.info(
            "Loading SapBERT model: %s (device: %s)",
            settings.sapbert_model,
            self._device,
        )

        self._tokenizer = AutoTokenizer.from_pretrained(
            settings.sapbert_model,
            cache_dir=settings.model_cache_dir,
        )
        self._model = AutoModel.from_pretrained(
            settings.sapbert_model,
            cache_dir=settings.model_cache_dir,
        ).to(self._device)
        self._model.eval()  # type: ignore[union-attr, attr-defined]

        logger.info("SapBERT model loaded successfully")

    def encode(self, texts: list[str]) -> list[list[float]]:
        """Encode a batch of texts into 768-dim embeddings.

        Uses mean pooling over token embeddings with attention mask.
        """
        self._load_model()
        assert self._tokenizer is not None
        assert self._model is not None

        tokenized = self._tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=64,
            return_tensors="pt",
        ).to(self._device)

        with torch.no_grad():
            output = self._model(**tokenized)

        # Mean pooling: average token embeddings weighted by attention mask
        attention_mask = tokenized["attention_mask"]
        token_embeddings = output.last_hidden_state
        mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * mask_expanded, dim=1)
        sum_mask = torch.clamp(mask_expanded.sum(dim=1), min=1e-9)
        embeddings = sum_embeddings / sum_mask

        # Normalize to unit vectors for cosine similarity
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

        return embeddings.cpu().numpy().tolist()  # type: ignore[no-any-return]

    def encode_single(self, text: str) -> list[float]:
        """Encode a single text into a 768-dim embedding."""
        return self.encode([text])[0]

    @property
    def is_loaded(self) -> bool:
        """Check if the model is currently loaded."""
        return self._model is not None

    @property
    def embedding_dim(self) -> int:
        """Return the embedding dimension."""
        return 768


@lru_cache(maxsize=1)
def get_sapbert_service() -> SapBERTService:
    """Get or create the singleton SapBERT service."""
    return SapBERTService()
