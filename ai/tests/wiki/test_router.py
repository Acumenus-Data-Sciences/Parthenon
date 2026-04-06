from unittest.mock import AsyncMock

from app.wiki.models import WikiActivityItem, WikiPageSummary, WikiWorkspace


def test_list_workspaces(client, monkeypatch):
    fake_engine = type(
        "FakeEngine",
        (),
        {
            "list_workspaces": lambda self: [WikiWorkspace(name="platform", branch="main", page_count=2)],
        },
    )()
    monkeypatch.setattr("app.routers.wiki._get_engine", lambda: fake_engine)

    response = client.get("/wiki/workspaces")
    assert response.status_code == 200
    assert response.json()["workspaces"][0]["name"] == "platform"


def test_get_page_returns_404_for_missing_page(client, monkeypatch):
    class FakeEngine:
        def get_page(self, workspace, slug):
            raise FileNotFoundError("missing")

    monkeypatch.setattr("app.routers.wiki._get_engine", lambda: FakeEngine())
    response = client.get("/wiki/pages/missing", params={"workspace": "platform"})
    assert response.status_code == 404


def test_query_endpoint(client, monkeypatch):
    class FakeEngine:
        query = AsyncMock(
            return_value={
                "workspace": "platform",
                "answer": "Answer",
                "citations": [
                    WikiPageSummary(
                        workspace="platform",
                        title="Page",
                        slug="page",
                        page_type="concept",
                        path="wiki/concepts/page.md",
                        updated_at="2026-04-06T00:00:00+00:00",
                    ).model_dump()
                ],
            }
        )

    monkeypatch.setattr("app.routers.wiki._get_engine", lambda: FakeEngine())
    response = client.post("/wiki/query", json={"workspace": "platform", "question": "What?"})
    assert response.status_code == 200
    assert response.json()["answer"] == "Answer"


def test_ingest_requires_file_or_raw_content(client):
    response = client.post("/wiki/ingest", data={"workspace": "platform"})
    assert response.status_code == 422
