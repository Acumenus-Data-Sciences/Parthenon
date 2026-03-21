"""Tests for clinical reference ingestion."""
from unittest.mock import MagicMock, patch


def test_ingest_clinical_concepts():
    """Ingests OMOP concepts from database into clinical collection."""
    with patch("app.chroma.clinical.get_clinical_collection") as mock_coll_fn, \
         patch("app.chroma.clinical._get_vocab_engine") as mock_engine_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        # Mock the engine and its connection context manager
        mock_conn = MagicMock()
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_engine_fn.return_value = mock_engine
        mock_conn.execute.return_value.fetchall.return_value = [
            (12345, "Hypertension", "Condition", "SNOMED"),
            (67890, "Metformin", "Drug", "RxNorm"),
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
            (11111, "Diabetes", "Condition", "SNOMED"),
        ]

        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts(limit=1)
        assert stats["total"] == 1
        # Verify the query was called with limit param
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
