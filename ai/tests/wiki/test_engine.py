import pytest

from app.wiki.engine import WikiEngine


@pytest.mark.asyncio
async def test_ingest_creates_source_and_pages(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str):
        return [
            {
                "type": "concept",
                "title": "Evidence Overview",
                "body": "See [[source-a]].",
                "keywords": ["evidence"],
                "links": ["source-a"],
            }
        ]

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)

    response = await engine.ingest(
        workspace="platform",
        filename="source-a.md",
        content_bytes=b"# Source A\nBody",
        raw_content=None,
        title=None,
    )

    assert response.source_slug == "source-a"
    assert any(page.slug == "evidence-overview" for page in response.created_pages)
    assert (tmp_path / "platform" / "sources" / "source-a.md").exists()


@pytest.mark.asyncio
async def test_query_uses_matching_pages(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str):
        return [
            {
                "type": "concept",
                "title": "Clinical Evidence",
                "body": "Outcome trends for diabetes cohorts.",
                "keywords": ["diabetes", "outcomes"],
                "links": [],
            }
        ]

    async def fake_answer(question: str, page_context: str):
        return f"Answer for: {question}\n\n{page_context[:60]}"

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)
    monkeypatch.setattr(engine, "_answer_question", fake_answer)

    await engine.ingest(
        workspace="platform",
        filename="evidence.md",
        content_bytes=b"# Evidence\nStudy body",
        raw_content=None,
        title="Evidence",
    )

    response = await engine.query("platform", "diabetes")
    assert response.citations
    assert "Answer for: diabetes" in response.answer


@pytest.mark.asyncio
async def test_query_prefers_selected_paper_scope(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str):
        if source_title == "Paper A":
            return [
                {
                    "type": "concept",
                    "title": "Paper A Findings",
                    "body": "Paper A focuses on federated oncology methods.",
                    "keywords": ["oncology", "federated"],
                    "links": [],
                }
            ]
        return [
            {
                "type": "concept",
                "title": "Paper B Findings",
                "body": "Paper B focuses on diabetes registries.",
                "keywords": ["diabetes", "registry"],
                "links": [],
            }
        ]

    captured: dict[str, str | None] = {"context": None, "focus_title": None}

    async def fake_answer(question: str, page_context: str, *, focus_title: str | None = None):
        captured["context"] = page_context
        captured["focus_title"] = focus_title
        return "Scoped answer"

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)
    monkeypatch.setattr(engine, "_answer_question", fake_answer)
    monkeypatch.setattr(engine, "_query_chroma_slugs", lambda *args, **kwargs: [])

    await engine.ingest(
        workspace="platform",
        filename="paper-a.md",
        content_bytes=b"# Paper A\nBody",
        raw_content=None,
        title="Paper A",
    )
    await engine.ingest(
        workspace="platform",
        filename="paper-b.md",
        content_bytes=b"# Paper B\nBody",
        raw_content=None,
        title="Paper B",
    )

    response = await engine.query(
        "platform",
        "What are the main findings?",
        page_slug="paper-a-findings",
        source_slug="paper-a",
    )

    assert response.answer == "Scoped answer"
    assert response.citations
    assert all(citation.source_slug == "paper-a" for citation in response.citations)
    assert "Paper A focuses on federated oncology methods." in str(captured["context"])
    assert "Paper B focuses on diabetes registries." not in str(captured["context"])
    assert captured["focus_title"] == "Paper A"


@pytest.mark.asyncio
async def test_lint_reports_broken_wikilinks(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str):
        return [
            {
                "type": "concept",
                "title": "Broken Links",
                "body": "Needs [[missing-page]].",
                "keywords": [],
                "links": ["missing-page"],
            }
        ]

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)

    await engine.ingest(
        workspace="platform",
        filename="broken.md",
        content_bytes=b"# Broken\nBody",
        raw_content=None,
        title="Broken",
    )

    lint = await engine.lint("platform")
    assert lint.issues
    assert lint.issues[0].severity == "error"
