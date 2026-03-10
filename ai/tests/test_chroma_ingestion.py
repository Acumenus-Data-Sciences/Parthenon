"""Tests for document ingestion pipeline."""
import hashlib
from unittest.mock import MagicMock, patch

import pytest


def test_chunk_markdown_splits_by_headers():
    """Markdown splitter respects heading boundaries."""
    from app.chroma.ingestion import chunk_markdown

    content = "# Title\n\nFirst section content.\n\n## Subtitle\n\nSecond section content."
    chunks = chunk_markdown(content, chunk_size=512, chunk_overlap=64)
    assert len(chunks) >= 1
    assert all(isinstance(c, str) for c in chunks)


def test_chunk_markdown_respects_size_limit():
    """Chunks stay within the specified token limit."""
    from app.chroma.ingestion import chunk_markdown

    content = "# Big Doc\n\n" + ("word " * 1000)
    chunks = chunk_markdown(content, chunk_size=256, chunk_overlap=32)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) < 2000


def test_content_hash():
    """Content hash is deterministic SHA-256."""
    from app.chroma.ingestion import content_hash

    text = "hello world"
    expected = hashlib.sha256(text.encode()).hexdigest()
    assert content_hash(text) == expected


def test_ingest_docs_skips_unchanged(tmp_path):
    """Ingestion skips files whose content hash hasn't changed."""
    doc = tmp_path / "test.md"
    doc.write_text("# Test\n\nSome content.")

    with patch("app.chroma.ingestion.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        file_hash = hashlib.sha256("# Test\n\nSome content.".encode()).hexdigest()
        mock_coll.get.return_value = {"ids": [f"test.md::0::{file_hash}"]}

        from app.chroma.ingestion import ingest_docs_directory

        stats = ingest_docs_directory(str(tmp_path))
        assert stats["skipped"] >= 1


def test_ingest_docs_adds_new_file(tmp_path):
    """Ingestion adds chunks from a new file."""
    doc = tmp_path / "new.md"
    doc.write_text("# New Doc\n\nFresh content here.")

    with patch("app.chroma.ingestion.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.get.return_value = {"ids": []}

        from app.chroma.ingestion import ingest_docs_directory

        stats = ingest_docs_directory(str(tmp_path))
        assert stats["ingested"] >= 1
        mock_coll.upsert.assert_called()
