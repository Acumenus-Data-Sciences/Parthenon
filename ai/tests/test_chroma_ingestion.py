"""Tests for Chroma ingestion helpers."""

import json
from unittest.mock import MagicMock, patch


def test_load_manifest_metadata_maps_converted_markdown_and_package_paths(tmp_path):
    """Manifest metadata should resolve both converted .md names and package/README paths."""
    source_dir = tmp_path / "seed"
    source_dir.mkdir()
    manifest = {
        "chapters": [
            {
                "filename": "CommonDataModel.Rmd",
                "title": "The Common Data Model",
            }
        ],
        "files": [
            {
                "package": "CohortMethod",
                "filename": "README.md",
                "title": "CohortMethod - Overview",
            }
        ],
        "topics": [
            {
                "topic_id": 15782,
                "title": "Concept set save error",
            }
        ],
    }
    (source_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    from app.chroma.ingestion import _load_manifest_metadata

    meta = _load_manifest_metadata(source_dir)

    assert meta["CommonDataModel.md"]["title"] == "The Common Data Model"
    assert meta["CohortMethod/README.md"]["title"] == "CohortMethod - Overview"
    assert meta["topic_15782.md"]["title"] == "Concept set save error"


def test_upsert_resilient_splits_batches_on_failure():
    """Large upserts should retry in smaller chunks until they succeed."""

    class FakeCollection:
        def __init__(self):
            self.calls = []

        def upsert(self, *, ids, documents, metadatas):
            self.calls.append(list(ids))
            if len(ids) > 2:
                raise TimeoutError("timed out in upsert")

    from app.chroma.ingestion import _upsert_resilient

    collection = FakeCollection()
    ids = ["a", "b", "c", "d"]
    docs = ["A", "B", "C", "D"]
    metas = [{"i": 1}, {"i": 2}, {"i": 3}, {"i": 4}]

    _upsert_resilient(collection, ids, docs, metas, 4)

    assert collection.calls == [["a", "b", "c", "d"], ["a", "b"], ["c", "d"]]


def test_ingest_medical_textbooks_uses_dedicated_collection(tmp_path):
    """Textbooks should ingest into the medical_textbooks collection, not ohdsi_papers."""
    textbooks_dir = tmp_path / "textbooks"
    textbooks_dir.mkdir()
    (textbooks_dir / "sample.jsonl").write_text(
        json.dumps(
            {
                "text": "HGVS nomenclature is used to describe sequence variants." * 3,
                "metadata": {
                    "title": "Lewin's GENES XII",
                    "category": "genetics",
                    "priority": "high",
                    "tier": 1,
                    "chunk_index": 0,
                    "total_chunks": 1,
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    mock_collection = MagicMock()
    mock_collection.get.return_value = {"ids": []}

    with patch("app.chroma.ingestion.get_medical_textbooks_collection", return_value=mock_collection):
        from app.chroma.ingestion import ingest_medical_textbooks

        stats = ingest_medical_textbooks(str(textbooks_dir), batch_size=8)

    assert stats["ingested"] == 1
    mock_collection.upsert.assert_called()


def test_ingest_docs_directory_preserves_title_and_heading_metadata(tmp_path):
    """Docs chunks should retain file-level title and section provenance."""
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "hgvs.md").write_text(
        "# HGVS Variant Nomenclature\n\n"
        "HGVS stands for Human Genome Variation Society nomenclature.\n\n"
        "## Practical distinction\n\n"
        "HGVS tells you how the variant is named.\n",
        encoding="utf-8",
    )

    mock_collection = MagicMock()
    mock_collection.get.return_value = {"ids": []}

    with patch("app.chroma.ingestion.get_docs_collection", return_value=mock_collection):
        from app.chroma.ingestion import ingest_docs_directory

        stats = ingest_docs_directory(str(docs_dir))

    assert stats["ingested"] == 1
    upsert_kwargs = mock_collection.upsert.call_args.kwargs
    assert upsert_kwargs["documents"][0].startswith("# HGVS Variant Nomenclature")
    assert upsert_kwargs["metadatas"][0]["source_file"] == "hgvs.md"
    assert upsert_kwargs["metadatas"][0]["title"] == "HGVS Variant Nomenclature"
    assert upsert_kwargs["metadatas"][0]["heading_path"] == "HGVS Variant Nomenclature"
    assert any(meta.get("section") == "Practical distinction" for meta in upsert_kwargs["metadatas"])


def test_ingest_docs_directory_skips_vendor_subtrees(tmp_path):
    """Generated/vendor docs like docs/site/node_modules should not be embedded."""
    docs_dir = tmp_path / "docs"
    vendor_dir = docs_dir / "site" / "node_modules" / "pkg"
    vendor_dir.mkdir(parents=True)
    (vendor_dir / "README.md").write_text("# Vendor package\n\nIgnore me.\n", encoding="utf-8")

    mock_collection = MagicMock()

    with patch("app.chroma.ingestion.get_docs_collection", return_value=mock_collection):
        from app.chroma.ingestion import ingest_docs_directory

        stats = ingest_docs_directory(str(docs_dir))

    assert stats["skipped"] == 1
    mock_collection.upsert.assert_not_called()


def test_load_harvester_metadata_falls_back_to_metadata_csv(tmp_path):
    """Corpus metadata.csv should backfill paper metadata when state files are absent."""
    corpus_dir = tmp_path / "corpus"
    metadata_dir = corpus_dir / "metadata"
    metadata_dir.mkdir(parents=True)
    (corpus_dir / "metadata.csv").write_text(
        "Filename,Title,PDF Title,DOI,Publication Year,Journal,Authors,First Author,PMID,PMCID\n"
        "paper.pdf,Paper title,,10.1000/example,2024,JAMIA,Doe et al.,Doe,12345,PMC12345\n",
        encoding="utf-8",
    )

    from app.chroma.ingestion import _load_harvester_metadata

    metadata = _load_harvester_metadata(metadata_dir)

    assert metadata["paper.pdf"]["title"] == "Paper title"
    assert metadata["paper.pdf"]["doi"] == "10.1000/example"
    assert metadata["paper.pdf"]["year"] == "2024"


def test_chunk_markdown_records_prefers_frontmatter_title_and_skips_frontmatter_content():
    """Docusaurus frontmatter should inform provenance but not become a retrievable chunk."""
    from app.chroma.ingestion import chunk_markdown_records

    records = chunk_markdown_records(
        "---\n"
        "title: \"Abby Gets a Brain\"\n"
        "slug: abby-brain\n"
        "---\n\n"
        "Lead paragraph.\n\n"
        "<!-- truncate -->\n\n"
        "## Details\n\n"
        "Grounded content here.\n",
        fallback_path="blog/abby-brain.md",
    )

    assert records[0]["title"] == "Abby Gets a Brain"
    assert all("slug:" not in record["text"] for record in records)
    assert all("<!-- truncate -->" not in record["text"] for record in records)
