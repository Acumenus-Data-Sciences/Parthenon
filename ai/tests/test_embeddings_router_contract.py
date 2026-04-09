"""Contract tests for the embeddings router.

These tests verify the HTTP contract (endpoint paths, request models, and
response shapes) independently of the underlying SapBERT model. They use
FastAPI's TestClient and mock the embedding service so no GPU / model
weights are needed.

See `ai/app/routers/embeddings.py` for the live router source.
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _stub_sapbert_service() -> MagicMock:
    stub = MagicMock()
    stub.encode_single.return_value = [0.01] * 768
    stub.encode.return_value = [[0.01] * 768]
    stub.embedding_dim = 768
    stub.is_loaded = True
    return stub


@patch("app.routers.embeddings.get_sapbert_service")
def test_encode_contract_returns_embedding_and_model_fields(
    mock_get_service: MagicMock,
) -> None:
    """POST /embeddings/encode returns {embedding, model}."""
    mock_get_service.return_value = _stub_sapbert_service()
    response = client.post(
        "/embeddings/encode",
        json={"text": "diabetes mellitus type 2"},
    )
    assert response.status_code == 200
    body = response.json()
    # Contract: exactly these two top-level keys
    assert set(body.keys()) == {"embedding", "model"}
    assert isinstance(body["embedding"], list)
    assert all(isinstance(v, float) for v in body["embedding"])
    assert isinstance(body["model"], str)


def test_encode_contract_missing_text_returns_422() -> None:
    """POST /embeddings/encode with empty body returns 422 validation error."""
    response = client.post("/embeddings/encode", json={})
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body


@patch("app.routers.embeddings.get_sapbert_service")
def test_encode_batch_contract_returns_embeddings_and_count(
    mock_get_service: MagicMock,
) -> None:
    """POST /embeddings/encode-batch returns {embeddings, model, count}."""
    stub = _stub_sapbert_service()
    stub.encode.return_value = [[0.01] * 768, [0.02] * 768]
    mock_get_service.return_value = stub
    response = client.post(
        "/embeddings/encode-batch",
        json={"texts": ["hypertension", "diabetes"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"embeddings", "model", "count"}
    assert body["count"] == 2
    assert len(body["embeddings"]) == 2


def test_encode_batch_contract_rejects_oversize_batch_with_400() -> None:
    """Batches larger than 256 are rejected with HTTP 400."""
    response = client.post(
        "/embeddings/encode-batch",
        json={"texts": ["text"] * 300},
    )
    assert response.status_code == 400
