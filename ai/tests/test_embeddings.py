"""Tests for the embeddings endpoints.

These tests mock the SapBERT service to avoid loading the full model in CI.
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _mock_sapbert_service() -> MagicMock:
    """Create a mock SapBERT service that returns fake 768-dim embeddings."""
    mock = MagicMock()
    mock.encode_single.return_value = [0.1] * 768
    mock.encode.return_value = [[0.1] * 768, [0.2] * 768]
    mock.embedding_dim = 768
    mock.is_loaded = True
    return mock


@patch("app.routers.embeddings.get_sapbert_service")
def test_encode_single(mock_get_service: MagicMock) -> None:
    """Test single text encoding returns 768-dim vector."""
    mock_get_service.return_value = _mock_sapbert_service()

    response = client.post("/embeddings/encode", json={"text": "diabetes mellitus"})

    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert len(data["embedding"]) == 768
    assert data["model"] == "cambridgeltl/SapBERT-from-PubMedBERT-fulltext"


@patch("app.routers.embeddings.get_sapbert_service")
def test_encode_batch(mock_get_service: MagicMock) -> None:
    """Test batch encoding returns correct number of embeddings."""
    mock_get_service.return_value = _mock_sapbert_service()

    response = client.post(
        "/embeddings/encode-batch",
        json={"texts": ["diabetes", "hypertension"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert "embeddings" in data
    assert len(data["embeddings"]) == 2
    assert data["count"] == 2
    assert len(data["embeddings"][0]) == 768


@patch("app.routers.embeddings.get_sapbert_service")
def test_encode_batch_size_limit(mock_get_service: MagicMock) -> None:
    """Test that batch size over 256 is rejected."""
    mock_get_service.return_value = _mock_sapbert_service()

    response = client.post(
        "/embeddings/encode-batch",
        json={"texts": ["text"] * 257},
    )

    assert response.status_code == 400


@patch("app.routers.embeddings.search_nearest")
@patch("app.routers.embeddings.get_sapbert_service")
def test_similarity_search(
    mock_get_service: MagicMock, mock_search: MagicMock
) -> None:
    """Test similarity search encodes query and returns candidates."""
    mock_get_service.return_value = _mock_sapbert_service()
    mock_search.return_value = [
        {
            "concept_id": 201826,
            "concept_name": "Type 2 diabetes mellitus",
            "similarity": 0.95,
            "domain_id": "Condition",
            "vocabulary_id": "SNOMED",
            "standard_concept": "S",
        }
    ]

    response = client.post(
        "/embeddings/search",
        json={"query": "sugar disease", "top_k": 5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "sugar disease"
    assert len(data["candidates"]) == 1
    assert data["candidates"][0]["concept_id"] == 201826
    assert data["candidates"][0]["strategy"] == "sapbert_cosine"
