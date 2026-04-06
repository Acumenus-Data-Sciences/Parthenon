"""Tests for ChromaDB management API endpoints."""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


def test_chroma_health_endpoint():
    """Health endpoint returns ChromaDB status."""
    with patch("app.routers.chroma.check_health") as mock_health:
        mock_health.return_value = {"status": "ok", "heartbeat": 123}

        client = TestClient(app)
        resp = client.get("/chroma/health")

    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_ingest_docs_endpoint():
    """Ingest docs endpoint triggers ingestion and returns stats."""
    with patch("app.routers.chroma.ingest_docs_directory") as mock_ingest:
        mock_ingest.return_value = {"ingested": 5, "skipped": 2, "chunks": 30}

        client = TestClient(app)
        resp = client.post("/chroma/ingest-docs")

    assert resp.status_code == 200
    assert resp.json()["ingested"] == 5


def test_query_endpoint_uses_configured_collection_accessor():
    """Semantic query should use app collection accessors, not raw Chroma defaults."""
    mock_collection = MagicMock()
    mock_collection.count.return_value = 1
    mock_collection.query.return_value = {
        "ids": [["doc-1"]],
        "documents": [["ClinVar is a public archive."]],
        "metadatas": [[{"title": "ClinVar"}]],
        "distances": [[0.1]],
    }

    with patch("app.routers.chroma.get_docs_collection", return_value=mock_collection):
        client = TestClient(app)
        resp = client.post("/chroma/query", json={
            "collectionName": "docs",
            "queryText": "What is ClinVar?",
            "nResults": 3,
        })

    assert resp.status_code == 200
    mock_collection.query.assert_called_once()
    assert resp.json()["items"][0]["metadata"]["title"] == "ClinVar"
