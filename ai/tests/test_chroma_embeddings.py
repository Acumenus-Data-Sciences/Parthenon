"""Tests for dual embedding provider."""
import sys
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
