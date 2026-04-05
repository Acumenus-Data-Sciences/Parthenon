from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "parthenon-ai"
    assert "llm" in data
    assert data["llm"]["provider"] == "ollama"
    assert data["llm"]["model"] == settings.abby_llm_model
    assert data["llm"]["base_url"] == settings.abby_llm_base_url
