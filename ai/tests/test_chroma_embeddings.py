"""Tests for dual embedding provider."""
import sys
import threading
import time
from unittest.mock import MagicMock, patch
from types import ModuleType

import pytest


@pytest.fixture(autouse=True)
def _mock_sentence_transformers():
    """Ensure sentence_transformers is available as a mock module."""
    mock_module = ModuleType("sentence_transformers")
    mock_module.SentenceTransformer = MagicMock()  # type: ignore[attr-defined]
    already_present = "sentence_transformers" in sys.modules
    if not already_present:
        sys.modules["sentence_transformers"] = mock_module
    yield mock_module
    if not already_present:
        sys.modules.pop("sentence_transformers", None)


def test_general_embedder_returns_384_dims():
    """Sentence-transformers model produces 384-dim vectors."""
    import numpy as np
    from app.chroma.embeddings import GeneralEmbedder

    mock_model = MagicMock()
    mock_model.encode.return_value = np.random.rand(1, 384).astype(np.float32)

    embedder = GeneralEmbedder.__new__(GeneralEmbedder)
    embedder._model = mock_model

    result = embedder(["test text"])
    assert len(result) == 1
    assert len(result[0]) == 384


def test_clinical_embedder_returns_768_dims():
    """SapBERT model produces 768-dim vectors."""
    mock_service = MagicMock()
    mock_service.encode.return_value = [[0.1] * 768]

    with patch("app.services.sapbert.get_sapbert_service", return_value=mock_service):
        from app.chroma.embeddings import ClinicalEmbedder

        embedder = ClinicalEmbedder()
        result = embedder(["hypertension"])
        assert len(result) == 1
        assert len(result[0]) == 768


def test_general_embedder_is_chromadb_compatible():
    """GeneralEmbedder implements ChromaDB's EmbeddingFunction protocol."""
    from app.chroma.embeddings import GeneralEmbedder

    embedder = GeneralEmbedder.__new__(GeneralEmbedder)
    assert callable(embedder)


def test_general_embedder_uses_local_files_only(monkeypatch):
    """General embedder should load from the local cache without Hub calls."""
    monkeypatch.setenv("SENTENCE_TRANSFORMERS_HOME", "/tmp/st-cache")

    with (
        patch("app.chroma.embeddings._ensure_sentence_transformer_cached"),
        patch("sentence_transformers.SentenceTransformer") as mock_st,
    ):
        from app.chroma.embeddings import GeneralEmbedder

        GeneralEmbedder(model_name="all-MiniLM-L6-v2")

    _, kwargs = mock_st.call_args
    assert kwargs["local_files_only"] is True
    assert kwargs["cache_folder"].endswith("/sentence-transformers")


def test_general_embedder_fails_fast_when_local_cache_is_missing():
    """Cache-only mode should raise a clear error if the sentence model is absent."""
    with patch("app.chroma.embeddings._ensure_sentence_transformer_cached", side_effect=RuntimeError("missing cache")):
        from app.chroma.embeddings import GeneralEmbedder

        try:
            GeneralEmbedder(model_name="all-MiniLM-L6-v2")
        except RuntimeError as exc:
            assert "missing cache" in str(exc)
        else:
            raise AssertionError("Expected RuntimeError for missing local cache")



def test_sapbert_service_loads_model_only_once_across_threads():
    """Concurrent first-use calls should share one SapBERT load."""
    tokenizer_calls = 0
    model_calls = 0

    def _load_tokenizer(*args, **kwargs):
        nonlocal tokenizer_calls
        tokenizer_calls += 1
        time.sleep(0.05)
        return MagicMock()

    def _load_model(*args, **kwargs):
        nonlocal model_calls
        model_calls += 1
        time.sleep(0.05)
        mock_model = MagicMock()
        mock_model.eval.return_value = None
        return mock_model

    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False

    with (
        patch("app.services.sapbert._HAS_TORCH", True),
        patch("app.services.sapbert.torch", mock_torch),
        patch("app.services.sapbert.AutoTokenizer") as mock_tokenizer_cls,
        patch("app.services.sapbert.AutoModel") as mock_model_cls,
        patch("app.services.sapbert.SapBERTService._ensure_local_model_cache"),
    ):
        mock_tokenizer_cls.from_pretrained.side_effect = _load_tokenizer
        mock_model_cls.from_pretrained.side_effect = _load_model

        from app.services.sapbert import SapBERTService

        service = SapBERTService()
        threads = [threading.Thread(target=service._load_model) for _ in range(3)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

    assert tokenizer_calls == 1
    assert model_calls == 1


def test_sapbert_service_uses_local_files_only():
    """SapBERT should load from the local cache without Hub calls."""
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False

    with (
        patch("app.services.sapbert._HAS_TORCH", True),
        patch("app.services.sapbert.torch", mock_torch),
        patch("app.services.sapbert.AutoTokenizer") as mock_tokenizer_cls,
        patch("app.services.sapbert.AutoModel") as mock_model_cls,
        patch("app.services.sapbert.SapBERTService._ensure_local_model_cache"),
    ):
        mock_model = MagicMock()
        mock_model.eval.return_value = None
        mock_tokenizer_cls.from_pretrained.return_value = MagicMock()
        mock_model_cls.from_pretrained.return_value = mock_model

        from app.services.sapbert import SapBERTService

        SapBERTService()._load_model()

    assert mock_tokenizer_cls.from_pretrained.call_args.kwargs["local_files_only"] is True
    assert mock_model_cls.from_pretrained.call_args.kwargs["local_files_only"] is True


def test_sapbert_service_fails_fast_when_local_cache_is_missing():
    """SapBERT cache misses should raise a clear startup-time error."""
    mock_torch = MagicMock()
    mock_torch.cuda.is_available.return_value = False

    with (
        patch("app.services.sapbert._HAS_TORCH", True),
        patch("app.services.sapbert.torch", mock_torch),
        patch("app.services.sapbert.AutoTokenizer"),
        patch("app.services.sapbert.AutoModel"),
        patch("app.services.sapbert.SapBERTService._ensure_local_model_cache", side_effect=RuntimeError("sapbert cache missing")),
    ):
        from app.services.sapbert import SapBERTService

        try:
            SapBERTService()._load_model()
        except RuntimeError as exc:
            assert "sapbert cache missing" in str(exc)
        else:
            raise AssertionError("Expected RuntimeError for missing SapBERT cache")
