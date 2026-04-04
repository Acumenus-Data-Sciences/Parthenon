"""Concept embedding service.

Primary: Ollama embedding model (GPU-accelerated via nomic-embed-text).
Fallback: SapBERT on CPU (cambridgeltl/SapBERT-from-PubMedBERT-fulltext).

Both produce 768-dimensional embeddings with L2 normalization.
"""

import logging
import os
from typing import Any

import httpx

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


class OllamaEmbeddingService:
    """GPU-accelerated embedding via Ollama's /api/embed endpoint."""

    def __init__(self) -> None:
        self._base_url = settings.ollama_base_url
        self._model = settings.ollama_embedding_model
        self._available: bool | None = None

    def _check_available(self) -> bool:
        """Probe Ollama to confirm the embedding model is loaded."""
        if self._available is not None:
            return self._available
        try:
            resp = httpx.post(
                f"{self._base_url}/api/embed",
                json={"model": self._model, "input": "probe"},
                timeout=10.0,
            )
            self._available = resp.status_code == 200
            if self._available:
                dim = len(resp.json()["embeddings"][0])
                logger.info(
                    "Ollama embedding available: model=%s dim=%d",
                    self._model, dim,
                )
            else:
                logger.warning(
                    "Ollama embedding probe returned %d", resp.status_code,
                )
        except Exception as exc:
            logger.warning("Ollama embedding unavailable: %s", exc)
            self._available = False
        return self._available

    @property
    def is_available(self) -> bool:
        return self._check_available()

    def encode_single(self, text: str) -> list[float]:
        """Encode a single text string into a 768-dim embedding."""
        return self.encode([text])[0]

    def encode(self, texts: list[str]) -> list[list[float]]:
        """Encode texts via Ollama. Raises on failure."""
        resp = httpx.post(
            f"{self._base_url}/api/embed",
            json={"model": self._model, "input": texts},
            timeout=60.0,
        )
        resp.raise_for_status()
        embeddings: list[list[float]] = resp.json()["embeddings"]
        return embeddings

    @property
    def embedding_dim(self) -> int:
        return 768


class SapBERTService:
    """CPU-based SapBERT model for generating concept embeddings."""

    def __init__(self) -> None:
        self._model: Any = None
        self._tokenizer: Any = None
        self._device: str = "cuda" if (_HAS_TORCH and torch.cuda.is_available()) else "cpu"

    def _load_model(self) -> None:
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
            low_cpu_mem_usage=False,
        )
        if self._device != "cpu":
            self._model = self._model.to(self._device)
        self._model.eval()

        logger.info("SapBERT model loaded successfully")

    def encode(self, texts: list[str]) -> list[list[float]]:
        """Encode a batch of texts into 768-dim embeddings."""
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

        attention_mask = tokenized["attention_mask"]
        token_embeddings = output.last_hidden_state
        mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * mask_expanded, dim=1)
        sum_mask = torch.clamp(mask_expanded.sum(dim=1), min=1e-9)
        embeddings = sum_embeddings / sum_mask

        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

        return embeddings.cpu().numpy().tolist()  # type: ignore[no-any-return]

    def encode_single(self, text: str) -> list[float]:
        """Encode a single text string into a 768-dim embedding."""
        return self.encode([text])[0]

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def embedding_dim(self) -> int:
        return 768


# ---------------------------------------------------------------------------
# Singleton accessor — Ollama first, SapBERT fallback
# ---------------------------------------------------------------------------

_ollama_service: OllamaEmbeddingService | None = None
_sapbert_service: SapBERTService | None = None
_sapbert_pid: int = 0


def get_sapbert_service() -> OllamaEmbeddingService | SapBERTService:
    """Return the best available embedding service.

    Prefers Ollama (GPU) over SapBERT (CPU). The returned object has
    the same .encode(texts) interface.
    """
    global _ollama_service, _sapbert_service, _sapbert_pid

    # Try Ollama first
    if _ollama_service is None:
        _ollama_service = OllamaEmbeddingService()

    if _ollama_service.is_available:
        return _ollama_service

    # Fall back to SapBERT
    pid = os.getpid()
    if _sapbert_service is None or _sapbert_pid != pid:
        logger.info("Falling back to SapBERT (CPU) — Ollama unavailable")
        _sapbert_service = SapBERTService()
        _sapbert_pid = pid
    return _sapbert_service
