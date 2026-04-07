from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routers import wiki as wiki_router
from app.wiki.models import WikiPageSummary, WikiQueryRequest, WikiWorkspace


def test_list_workspaces(monkeypatch):
    fake_engine = type(
        "FakeEngine",
        (),
        {
            "list_workspaces": lambda self: [WikiWorkspace(name="platform", branch="main", page_count=2)],
        },
    )()
    monkeypatch.setattr(wiki_router, "_get_engine", lambda: fake_engine)

    response = wiki_router.list_workspaces()
    assert response.workspaces[0].name == "platform"


def test_get_page_returns_404_for_missing_page(monkeypatch):
    class FakeEngine:
        def get_page(self, workspace, slug):
            raise FileNotFoundError("missing")

    monkeypatch.setattr(wiki_router, "_get_engine", lambda: FakeEngine())

    with pytest.raises(HTTPException) as exc:
        wiki_router.get_page("missing", workspace="platform")

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_query_endpoint(monkeypatch):
    query_mock = AsyncMock(
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

    fake_engine = type("FakeEngine", (), {"query": query_mock})()
    monkeypatch.setattr(wiki_router, "_get_engine", lambda: fake_engine)

    response = await wiki_router.query(
        WikiQueryRequest(
            workspace="platform",
            question="What?",
            page_slug="paper-a-findings",
            source_slug="paper-a",
        )
    )

    assert response["answer"] == "Answer"
    query_mock.assert_awaited_once_with(
        "platform",
        "What?",
        page_slug="paper-a-findings",
        source_slug="paper-a",
    )


@pytest.mark.asyncio
async def test_ingest_requires_file_or_raw_content():
    with pytest.raises(HTTPException) as exc:
        await wiki_router.ingest(workspace="platform", title=None, raw_content=None, file=None)

    assert exc.value.status_code == 422
