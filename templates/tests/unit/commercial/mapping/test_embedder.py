"""Phase 3 Plan 6 Task 2 (T-024A): BgeEmbedder lazy-loader tests."""

from __future__ import annotations

from typing import Any

from runtime.commercial.mapping.embedder import BgeEmbedder


class _FakeModel:
    """Stand-in for sentence_transformers.SentenceTransformer in unit tests."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self.encode_calls: list[list[str]] = []

    def encode(self, texts: list[str], *, normalize_embeddings: bool = True) -> list[list[float]]:
        self.encode_calls.append(list(texts))
        # Deterministic 768-dim vectors keyed off text length so tests can
        # distinguish results without real ML.
        return [[float((len(t) + i) % 7) / 7.0 for i in range(768)] for t in texts]


def _fake_loader(model_name: str) -> _FakeModel:
    return _FakeModel(model_name)


def test_construction_does_not_load_model() -> None:
    """Lazy load: instantiating must NOT pull weights."""
    captured: dict[str, Any] = {"called": False}

    def loader(name: str) -> _FakeModel:
        captured["called"] = True
        return _FakeModel(name)

    embedder = BgeEmbedder(loader=loader)
    assert not embedder.is_loaded
    assert captured["called"] is False


def test_embed_triggers_load_once() -> None:
    captured: dict[str, int] = {"calls": 0}

    def loader(name: str) -> _FakeModel:
        captured["calls"] += 1
        return _FakeModel(name)

    embedder = BgeEmbedder(loader=loader)
    embedder.embed(["glucose"])
    embedder.embed(["potassium"])
    assert captured["calls"] == 1
    assert embedder.is_loaded


def test_embed_returns_768_dim_vectors() -> None:
    embedder = BgeEmbedder(loader=_fake_loader)
    vectors = embedder.embed(["hemoglobin", "creatinine"])
    assert len(vectors) == 2
    assert len(vectors[0]) == 768
    assert len(vectors[1]) == 768
    assert all(isinstance(x, float) for x in vectors[0])


def test_embed_empty_list_returns_empty_list() -> None:
    """Empty input is a valid no-op; must NOT trigger model load."""
    captured: dict[str, int] = {"calls": 0}

    def loader(name: str) -> _FakeModel:
        captured["calls"] += 1
        return _FakeModel(name)

    embedder = BgeEmbedder(loader=loader)
    assert embedder.embed([]) == []
    assert captured["calls"] == 0
    assert not embedder.is_loaded


def test_default_model_name() -> None:
    embedder = BgeEmbedder(loader=_fake_loader)
    assert embedder.model_name == "BAAI/bge-base-en-v1.5"


def test_custom_model_name() -> None:
    embedder = BgeEmbedder("BAAI/bge-large-en-v1.5", loader=_fake_loader)
    assert embedder.model_name == "BAAI/bge-large-en-v1.5"


def test_embedding_dim_constant() -> None:
    """768 is the bge-base output dimension; must match pgvector schema."""
    assert BgeEmbedder.EMBEDDING_DIM == 768


def test_embed_passes_texts_to_model() -> None:
    fake = _FakeModel("test")

    def loader(name: str) -> _FakeModel:
        return fake

    embedder = BgeEmbedder(loader=loader)
    embedder.embed(["a", "b", "c"])
    assert fake.encode_calls == [["a", "b", "c"]]
