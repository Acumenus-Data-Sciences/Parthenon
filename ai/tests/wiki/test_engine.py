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

