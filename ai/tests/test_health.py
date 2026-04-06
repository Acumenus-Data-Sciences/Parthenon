import asyncio
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.ollama_client import check_ollama_health

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


def test_check_ollama_health_reports_ok_when_model_is_listed() -> None:
    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, object]:
            return {"models": [{"name": "ii-medical:8b-q8"}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            self.timeout = kwargs.get("timeout")

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def get(self, url: str) -> FakeResponse:
            assert url == "http://example.test/api/tags"
            return FakeResponse()

    with patch("app.services.ollama_client.httpx.AsyncClient", FakeAsyncClient):
        status = asyncio.run(
            check_ollama_health(
                base_url="http://example.test",
                model="ii-medical:8b-q8",
            )
        )

    assert status == "ok"
