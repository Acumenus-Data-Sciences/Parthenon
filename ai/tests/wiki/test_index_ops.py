from app.wiki.index_ops import IndexEntry, read_index, remove_index_entry, search_index, upsert_index_entry


def test_upsert_and_search_index(tmp_path):
    workspace_dir = tmp_path / "platform"
    workspace_dir.mkdir()

    upsert_index_entry(
        workspace_dir,
        IndexEntry(
            page_type="concept",
            title="Clinical Trials",
            slug="clinical-trials",
            path="wiki/concepts/clinical-trials.md",
            keywords=["research", "trials"],
            links=["protocols"],
            updated_at="2026-04-06T00:00:00+00:00",
        ),
    )

    entries = read_index(workspace_dir)
    assert len(entries) == 1
    assert search_index(workspace_dir, "research")[0].slug == "clinical-trials"
    assert search_index(workspace_dir, "protocols")[0].slug == "clinical-trials"


def test_remove_index_entry(tmp_path):
    workspace_dir = tmp_path / "platform"
    workspace_dir.mkdir()
    upsert_index_entry(
        workspace_dir,
        IndexEntry(
            page_type="entity",
            title="Abby",
            slug="abby",
            path="wiki/entities/abby.md",
            updated_at="2026-04-06T00:00:00+00:00",
        ),
    )

    entries = remove_index_entry(workspace_dir, "abby")
    assert entries == []


def test_ingested_at_round_trip(tmp_path):
    """ingested_at survives write → read round-trip."""
    workspace_dir = tmp_path / "platform"
    workspace_dir.mkdir()

    upsert_index_entry(
        workspace_dir,
        IndexEntry(
            page_type="concept",
            title="Round Trip",
            slug="round-trip",
            path="wiki/concepts/round-trip.md",
            updated_at="2026-04-07T12:00:00+00:00",
            ingested_at="2026-04-01T08:00:00+00:00",
        ),
    )

    entries = read_index(workspace_dir)
    assert len(entries) == 1
    assert entries[0].ingested_at == "2026-04-01T08:00:00+00:00"
    assert entries[0].updated_at == "2026-04-07T12:00:00+00:00"


def test_ingested_at_preserved_on_upsert(tmp_path):
    """Re-upserting a slug replaces the entry but caller controls ingested_at."""
    workspace_dir = tmp_path / "platform"
    workspace_dir.mkdir()

    upsert_index_entry(
        workspace_dir,
        IndexEntry(
            page_type="concept",
            title="Paper X",
            slug="paper-x",
            path="wiki/concepts/paper-x.md",
            updated_at="2026-04-01T00:00:00+00:00",
            ingested_at="2026-04-01T00:00:00+00:00",
        ),
    )

    # Re-upsert with same ingested_at but newer updated_at
    upsert_index_entry(
        workspace_dir,
        IndexEntry(
            page_type="concept",
            title="Paper X (revised)",
            slug="paper-x",
            path="wiki/concepts/paper-x.md",
            updated_at="2026-04-07T00:00:00+00:00",
            ingested_at="2026-04-01T00:00:00+00:00",
        ),
    )

    entries = read_index(workspace_dir)
    assert len(entries) == 1
    assert entries[0].title == "Paper X (revised)"
    assert entries[0].ingested_at == "2026-04-01T00:00:00+00:00"
    assert entries[0].updated_at == "2026-04-07T00:00:00+00:00"


def test_legacy_index_without_ingested_at(tmp_path):
    """Old index files without ingested_at column parse gracefully."""
    workspace_dir = tmp_path / "platform"
    workspace_dir.mkdir()

    # Write an index in the old 9-column format (no ingested_at)
    old_format = """# Wiki Index

| type | title | slug | path | keywords | links | updated_at | source_slug | source_type |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| concept | Old Paper | old-paper | wiki/concepts/old-paper.md | research | | 2026-03-01T00:00:00+00:00 | old-paper | pdf |
"""
    (workspace_dir / "index.md").write_text(old_format, encoding="utf-8")

    entries = read_index(workspace_dir)
    assert len(entries) == 1
    assert entries[0].slug == "old-paper"
    assert entries[0].ingested_at == ""  # graceful default

