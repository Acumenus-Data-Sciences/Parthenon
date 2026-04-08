import pytest

from app.wiki.engine import WikiEngine


@pytest.mark.asyncio
async def test_ingest_creates_source_and_pages(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        assert source_metadata["doi"] == "10.1000/test"
        return [
            {
                "type": "concept",
                "title": "Evidence Overview",
                "body": "See [[source-a]].",
                "primary_domain": "methods-statistics",
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
        doi="10.1000/test",
        authors="Smith J, Jones K",
        first_author="Smith J",
        journal="JAMIA",
        publication_year="2024",
        pmid="12345",
        pmcid="PMC12345",
    )

    assert response.source_slug == "source-a"
    assert any(page.slug == "evidence-overview" for page in response.created_pages)
    assert (tmp_path / "platform" / "sources" / "source-a.md").exists()
    concept = next(page for page in response.created_pages if page.slug == "evidence-overview")
    assert concept.doi == "10.1000/test"
    assert concept.first_author == "Smith J"
    assert concept.primary_domain == "methods-statistics"


@pytest.mark.asyncio
async def test_query_uses_matching_pages(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        return [
            {
                "type": "concept",
                "title": "Clinical Evidence",
                "body": "Outcome trends for diabetes cohorts.",
                "primary_domain": "clinical-applications",
                "keywords": ["diabetes", "outcomes"],
                "links": [],
            }
        ]

    async def fake_answer(question: str, page_context: str, *, focus_title: str | None = None):
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

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        if source_title == "Paper A":
            return [
                {
                    "type": "concept",
                    "title": "Paper A Findings",
                    "body": "Paper A focuses on federated oncology methods.",
                    "primary_domain": "network-studies",
                    "keywords": ["oncology", "federated"],
                    "links": [],
                }
            ]
        return [
            {
                "type": "concept",
                "title": "Paper B Findings",
                "body": "Paper B focuses on diabetes registries.",
                "primary_domain": "clinical-applications",
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
async def test_ingest_sets_ingested_at_and_preserves_on_reingest(tmp_path, monkeypatch):
    """ingested_at is set on first ingest and preserved when the same source is re-ingested."""
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        return [
            {
                "type": "concept",
                "title": "Topic A",
                "body": "Body text.",
                "primary_domain": "methods-statistics",
                "keywords": ["test"],
                "links": [],
            }
        ]

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)

    # First ingest
    response1 = await engine.ingest(
        workspace="platform",
        filename="source-a.md",
        content_bytes=b"# Source A\nFirst version",
        raw_content=None,
        title=None,
    )

    first_ingested_at = response1.created_pages[0].ingested_at
    assert first_ingested_at is not None
    assert first_ingested_at != ""

    # Re-ingest the same source (same slug produced by same title)
    response2 = await engine.ingest(
        workspace="platform",
        filename="source-a.md",
        content_bytes=b"# Source A\nSecond version",
        raw_content=None,
        title=None,
    )

    # ingested_at should be preserved from the first ingest
    for page in response2.created_pages:
        assert page.ingested_at == first_ingested_at, (
            f"Page '{page.slug}' ingested_at changed on re-ingest: "
            f"{page.ingested_at} != {first_ingested_at}"
        )

    # updated_at should be newer than ingested_at
    for page in response2.created_pages:
        assert page.updated_at >= first_ingested_at


@pytest.mark.asyncio
async def test_lint_reports_broken_wikilinks(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        return [
            {
                "type": "concept",
                "title": "Broken Links",
                "body": "Needs [[missing-page]].",
                "primary_domain": "methods-statistics",
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


@pytest.mark.asyncio
async def test_get_page_returns_bibliographic_metadata(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        return [
            {
                "type": "concept",
                "title": "Metadata Study",
                "body": "Summary body.",
                "primary_domain": "network-studies",
                "keywords": ["multi-database", "omop-cdm", "cohort-study"],
                "links": [],
            }
        ]

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)

    await engine.ingest(
        workspace="platform",
        filename="metadata-study.md",
        content_bytes=b"# Metadata Study\nBody",
        raw_content=None,
        title="Metadata Study",
        doi="10.1234/example",
        authors="Schuemie M, Hripcsak G",
        first_author="Schuemie M",
        journal="JAMIA",
        publication_year="2024",
        pmid="321",
        pmcid="PMC321",
    )

    page = engine.get_page("platform", "metadata-study")
    assert page.doi == "10.1234/example"
    assert page.authors == "Schuemie M, Hripcsak G"
    assert page.journal == "JAMIA"
    assert page.publication_year == "2024"
    assert page.primary_domain == "network-studies"


@pytest.mark.asyncio
async def test_ingest_disambiguates_slug_collisions_across_sources(tmp_path, monkeypatch):
    engine = WikiEngine(root_dir=str(tmp_path))

    async def fake_generate_pages(workspace: str, source_title: str, source_text: str, source_metadata: dict[str, str]):
        return [
            {
                "type": "concept",
                "title": "Shared Findings",
                "body": f"Body for {source_title}.",
                "primary_domain": "methods-statistics",
                "keywords": ["cohort-study", "omop-cdm", "negative-controls"],
                "links": [],
            }
        ]

    monkeypatch.setattr(engine, "_generate_pages", fake_generate_pages)

    first = await engine.ingest(
        workspace="platform",
        filename="paper-a.md",
        content_bytes=b"# Paper A\nBody",
        raw_content=None,
        title="Paper A",
        doi="10.1000/a",
    )
    second = await engine.ingest(
        workspace="platform",
        filename="paper-b.md",
        content_bytes=b"# Paper B\nBody",
        raw_content=None,
        title="Paper B",
        doi="10.1000/b",
    )

    first_concept = next(page for page in first.created_pages if page.page_type == "concept")
    second_concept = next(page for page in second.created_pages if page.page_type == "concept")

    assert first_concept.slug == "shared-findings"
    assert second_concept.slug.startswith("shared-findings-")
    assert first_concept.slug != second_concept.slug
