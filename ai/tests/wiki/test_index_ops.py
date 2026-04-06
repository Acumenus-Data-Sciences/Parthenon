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

