from app.wiki.log_ops import LogEntry, append_log_entry, read_log_entries


def test_append_and_read_log_entries(tmp_path):
    workspace_dir = tmp_path / "platform"
    workspace_dir.mkdir()

    append_log_entry(
        workspace_dir,
        LogEntry(
            timestamp="2026-04-06T00:00:00+00:00",
            action="ingest",
            target="source-a",
            message="Ingested a source.",
        ),
    )
    append_log_entry(
        workspace_dir,
        LogEntry(
            timestamp="2026-04-06T01:00:00+00:00",
            action="query",
            target="what-is-new",
            message="Answered a question.",
        ),
    )

    entries = read_log_entries(workspace_dir)
    assert entries[0].action == "query"
    assert entries[1].action == "ingest"

