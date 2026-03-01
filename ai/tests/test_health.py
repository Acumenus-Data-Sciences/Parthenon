from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "parthenon-ai"
    assert "llm" in data
    assert data["llm"]["provider"] == "ollama"
    assert data["llm"]["model"] == "medgemma"
