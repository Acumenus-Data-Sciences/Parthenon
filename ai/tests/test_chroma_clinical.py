"""Tests for clinical reference ingestion."""

from unittest.mock import MagicMock, patch


def test_ingest_clinical_concepts():
    """Ingests OMOP concepts from database into clinical collection."""
    with patch("app.chroma.clinical.get_clinical_collection") as mock_coll_fn, \
         patch("app.chroma.clinical._get_vocab_engine") as mock_engine_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_engine_fn.return_value = mock_engine
        mock_conn.execute.return_value.fetchall.return_value = [
            (12345, "Hypertension", "Condition", "SNOMED", "Clinical Finding"),
            (67890, "Metformin", "Drug", "RxNorm", "Clinical Drug"),
        ]

        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts(batch_size=100)

    assert stats["total"] == 2
    mock_coll.upsert.assert_called()


def test_ingest_clinical_with_limit():
    """Respects the limit parameter."""
    with patch("app.chroma.clinical.get_clinical_collection") as mock_coll_fn, \
         patch("app.chroma.clinical._get_vocab_engine") as mock_engine_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_engine_fn.return_value = mock_engine
        mock_conn.execute.return_value.fetchall.return_value = [
            (11111, "Diabetes", "Condition", "SNOMED", "Clinical Finding"),
        ]

        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts(limit=1)

    assert stats["total"] == 1
    call_args = mock_conn.execute.call_args
    assert "limit" in call_args[0][0].text.lower() or call_args[1].get("limit")


def test_ingest_clinical_empty_result():
    """Handles empty query result gracefully."""
    with patch("app.chroma.clinical.get_clinical_collection") as mock_coll_fn, \
         patch("app.chroma.clinical._get_vocab_engine") as mock_engine_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_engine_fn.return_value = mock_engine
        mock_conn.execute.return_value.fetchall.return_value = []

        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts()

    assert stats["total"] == 0
    assert stats["batches"] == 0
    mock_coll.upsert.assert_not_called()


def test_ingest_clinical_concepts_adds_cluster_metadata():
    """Clinical concepts should be ingested with label-friendly metadata."""
    mock_collection = MagicMock()
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_conn.execute.return_value.fetchall.return_value = [
        (4329847, "Myocardial infarction", "Condition", "SNOMED", "Clinical Finding"),
    ]

    with patch("app.chroma.clinical.get_clinical_collection", return_value=mock_collection), \
         patch("app.chroma.clinical._get_vocab_engine", return_value=mock_engine):
        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts(batch_size=100, limit=1)

    assert stats == {"total": 1, "batches": 1}
    metadata = mock_collection.upsert.call_args.kwargs["metadatas"][0]
    assert metadata["concept_id"] == 4329847
    assert metadata["domain"] == "Condition"
    assert metadata["vocabulary_id"] == "SNOMED"
    assert metadata["concept_class_id"] == "Clinical Finding"
    assert metadata["category"] == "Condition"
    assert metadata["source"] == "clinical_reference"
    assert metadata["source_type"] == "omop_concept"
    assert metadata["type"] == "clinical_concept"


def test_ingest_clinical_concepts_can_resume_from_offset():
    """A resumed ingest should skip already-written leading rows."""
    with patch("app.chroma.clinical.get_clinical_collection") as mock_coll_fn, \
         patch("app.chroma.clinical._get_vocab_engine") as mock_engine_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_engine_fn.return_value = mock_engine
        mock_conn.execute.return_value.fetchall.return_value = [
            (1, "Alpha", "Condition", "SNOMED", "Clinical Finding"),
            (2, "Beta", "Condition", "SNOMED", "Clinical Finding"),
            (3, "Gamma", "Condition", "SNOMED", "Clinical Finding"),
        ]

        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts(batch_size=100, start_offset=2)

    assert stats == {"total": 1, "batches": 1}
    upsert_kwargs = mock_coll.upsert.call_args.kwargs
    assert upsert_kwargs["ids"] == ["concept_3"]


def test_upsert_clinical_batch_resilient_splits_on_failure():
    """Transient Chroma disconnects should fall back to smaller clinical batches."""

    class FakeCollection:
        def __init__(self):
            self.calls = []

        def upsert(self, *, ids, documents, metadatas):
            self.calls.append(list(ids))
            if len(ids) > 2:
                raise TimeoutError("disconnect")

    from app.chroma.clinical import _upsert_clinical_batch_resilient

    collection = FakeCollection()
    _upsert_clinical_batch_resilient(
        collection,
        ["a", "b", "c", "d"],
        ["A", "B", "C", "D"],
        [{"i": 1}, {"i": 2}, {"i": 3}, {"i": 4}],
    )

    assert collection.calls == [["a", "b", "c", "d"], ["a", "b"], ["c", "d"]]


def test_rebuild_clinical_concepts_recreates_collection():
    """A rebuild should drop the stale collection cache and reingest from OMOP."""
    mock_client = MagicMock()

    with patch("app.chroma.clinical.get_chroma_client", return_value=mock_client), \
         patch("app.chroma.clinical.clear_cached_collection") as mock_clear_cache, \
         patch("app.chroma.clinical.ingest_clinical_concepts", return_value={"total": 123, "batches": 2}) as mock_ingest:
        from app.chroma.clinical import rebuild_clinical_concepts

        stats = rebuild_clinical_concepts(batch_size=250, limit=1000)

    mock_client.delete_collection.assert_called_once_with("clinical_reference")
    mock_clear_cache.assert_called_once_with("clinical_reference")
    mock_ingest.assert_called_once_with(batch_size=250, limit=1000, start_offset=0)
    assert stats == {"total": 123, "batches": 2}


def test_rebuild_clinical_concepts_can_resume_without_dropping_collection():
    """Resuming a rebuild should preserve the clean partial collection already written."""
    mock_client = MagicMock()

    with patch("app.chroma.clinical.get_chroma_client", return_value=mock_client), \
         patch("app.chroma.clinical.clear_cached_collection") as mock_clear_cache, \
         patch("app.chroma.clinical.ingest_clinical_concepts", return_value={"total": 77, "batches": 1}) as mock_ingest:
        from app.chroma.clinical import rebuild_clinical_concepts

        stats = rebuild_clinical_concepts(batch_size=250, start_offset=459000)

    mock_client.delete_collection.assert_not_called()
    mock_clear_cache.assert_not_called()
    mock_ingest.assert_called_once_with(batch_size=250, limit=None, start_offset=459000)
    assert stats == {"total": 77, "batches": 1}
