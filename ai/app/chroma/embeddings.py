"""Dual embedding providers for ChromaDB collections.

- GeneralEmbedder: sentence-transformers/all-MiniLM-L6-v2 (384-dim) for docs/conversations/FAQ
- ClinicalEmbedder: SapBERT (768-dim) for clinical reference content

Note: uvicorn --workers=N forks the parent process. PyTorch models loaded
in the parent become corrupt in child workers. These embedders use PID-aware
caching to detect forks and reinitialize fresh models per-worker.
"""
import logging
import os
import threading
from pathlib import Path

import numpy as np
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

from app.config import settings

logger = logging.getLogger(__name__)

# Lock to serialize model loading — concurrent SentenceTransformer/torch
# initialization causes meta tensor errors (torch 2.10 race condition).
_embedder_lock = threading.Lock()


def _sanitize_hf_cache_component(value: str) -> str:
    return value.replace("/", "--")


def _resolve_writable_cache_dir() -> Path:
    candidates = [
        Path(settings.model_cache_dir),
        Path("/tmp/parthenon-models"),
    ]
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return candidate
        except Exception as exc:
            logger.warning("Model cache dir '%s' is not writable: %s", candidate, exc)
    raise RuntimeError("No writable model cache directory is available")


def _configure_model_cache_env() -> None:
    cache_dir = _resolve_writable_cache_dir()
    sentence_cache = cache_dir / "sentence-transformers"
    huggingface_cache = cache_dir / "huggingface"
    transformers_cache = huggingface_cache / "transformers"

    sentence_cache.mkdir(parents=True, exist_ok=True)
    transformers_cache.mkdir(parents=True, exist_ok=True)

    home_dir = os.environ.get("HOME", "")
    if not home_dir or home_dir == "/nonexistent":
        os.environ["HOME"] = str(cache_dir)
    os.environ["XDG_CACHE_HOME"] = str(cache_dir)
    os.environ["HF_HOME"] = str(huggingface_cache)
    os.environ["HF_HUB_CACHE"] = str(huggingface_cache / "hub")
    os.environ["TRANSFORMERS_CACHE"] = str(transformers_cache)
    os.environ["SENTENCE_TRANSFORMERS_HOME"] = str(sentence_cache)


def _ensure_sentence_transformer_cached(model_name: str) -> None:
    cache_root = Path(os.environ.get("SENTENCE_TRANSFORMERS_HOME", settings.model_cache_dir))
    model_dir = cache_root / f"models--{_sanitize_hf_cache_component('sentence-transformers/' + model_name)}"
    snapshots_dir = model_dir / "snapshots"
    if snapshots_dir.exists() and any(snapshots_dir.iterdir()):
        return
    raise RuntimeError(
        f"Missing cached sentence-transformers model '{model_name}' under {cache_root}. "
        "Populate /models before starting python-ai."
    )


class GeneralEmbedder(EmbeddingFunction[Documents]):
    """Sentence-transformers embedding for general text (384 dimensions)."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        _configure_model_cache_env()
        _ensure_sentence_transformer_cached(model_name)
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name, device="cpu")
        self._pid = os.getpid()
        logger.info("Loaded general embedder: %s (pid=%d)", model_name, self._pid)

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = self._model.encode(input, convert_to_numpy=True)
        result: Embeddings
        if isinstance(embeddings, np.ndarray):
            result = embeddings.tolist()
        else:
            result = [e.tolist() if hasattr(e, "tolist") else list(e) for e in embeddings]  # type: ignore[misc]
        return result


class ClinicalEmbedder(EmbeddingFunction[Documents]):
    """SapBERT embedding for clinical/medical content (768 dimensions)."""

    def __init__(self) -> None:
        from app.services.sapbert import get_sapbert_service

        self._service = get_sapbert_service()
        self._pid = os.getpid()
        logger.info("Clinical embedder using SapBERT service (pid=%d)", self._pid)

    def __call__(self, input: Documents) -> Embeddings:
        result: Embeddings = self._service.encode(list(input))  # type: ignore[assignment]
        return result


# PID-aware singleton cache: detects fork and re-creates embedders
_general_embedder: GeneralEmbedder | None = None
_general_pid: int = 0
_clinical_embedder: ClinicalEmbedder | None = None
_clinical_pid: int = 0


def get_general_embedder() -> GeneralEmbedder:
    """Get or create general embedder, reinitializing after fork.

    Uses lock to prevent concurrent torch model initialization which
    causes meta tensor errors in torch 2.10.
    """
    global _general_embedder, _general_pid
    pid = os.getpid()
    if _general_embedder is None or _general_pid != pid:
        with _embedder_lock:
            # Double-check after acquiring lock
            if _general_embedder is None or _general_pid != pid:
                _general_embedder = GeneralEmbedder()
                _general_pid = pid
    return _general_embedder


def get_clinical_embedder() -> ClinicalEmbedder:
    """Get or create clinical embedder, reinitializing after fork.

    Uses lock to prevent concurrent torch model initialization.
    """
    global _clinical_embedder, _clinical_pid
    pid = os.getpid()
    if _clinical_embedder is None or _clinical_pid != pid:
        with _embedder_lock:
            if _clinical_embedder is None or _clinical_pid != pid:
                _clinical_embedder = ClinicalEmbedder()
                _clinical_pid = pid
    return _clinical_embedder
