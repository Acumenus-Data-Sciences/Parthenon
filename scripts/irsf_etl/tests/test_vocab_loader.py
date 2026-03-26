"""Tests for VocabularyLoader -- idempotent DB insertion for IRSF-NHS vocabulary.

All tests use mocked psycopg2 connections -- no live database required.
Verifies transaction lifecycle, parameterized queries, and correct row counts.
"""

from __future__ import annotations

from unittest.mock import MagicMock, call, patch

import pytest

from scripts.irsf_etl.lib.vocab_loader import VocabularyLoader


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------


class TestVocabularyLoaderInit:
    """VocabularyLoader accepts db_connection_params dict."""

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_accepts_connection_params(self, mock_pg: MagicMock) -> None:
        params = {"host": "localhost", "dbname": "parthenon", "user": "test"}
        loader = VocabularyLoader(params)
        assert loader is not None
        mock_pg.connect.assert_called_once_with(**params)

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_sets_autocommit_false(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        mock_pg.connect.return_value = conn
        VocabularyLoader({"host": "localhost"})
        assert conn.autocommit is False


# ---------------------------------------------------------------------------
# Transaction lifecycle
# ---------------------------------------------------------------------------


class TestTransactionLifecycle:
    """load_all() commits on success, rolls back on failure."""

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_commits_on_success(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()
        conn.commit.assert_called_once()
        conn.rollback.assert_not_called()

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_rolls_back_on_failure(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        cursor.execute.side_effect = Exception("DB error")
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        with pytest.raises(Exception, match="DB error"):
            loader.load_all()
        conn.rollback.assert_called_once()
        conn.commit.assert_not_called()

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_cursor_closed_on_success(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()
        cursor.close.assert_called_once()


# ---------------------------------------------------------------------------
# Idempotent DELETE + INSERT
# ---------------------------------------------------------------------------


class TestIdempotentDeleteInsert:
    """load_all() executes DELETE before INSERT within a single transaction."""

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_deletes_before_inserts(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()

        # Collect all SQL executed
        sql_calls = []
        for c in cursor.execute.call_args_list:
            sql_calls.append(c[0][0])
        for c in cursor.executemany.call_args_list:
            sql_calls.append(c[0][0])

        # Find first DELETE and first INSERT positions
        first_delete = next(
            (i for i, s in enumerate(sql_calls) if "DELETE" in s), None
        )
        first_insert = next(
            (i for i, s in enumerate(sql_calls) if "INSERT" in s), None
        )
        assert first_delete is not None, "No DELETE statement found"
        assert first_insert is not None, "No INSERT statement found"
        assert first_delete < first_insert, "DELETE must come before INSERT"

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_deletes_irsf_nhs_entries(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()

        delete_sqls = [
            c[0][0] for c in cursor.execute.call_args_list if "DELETE" in c[0][0]
        ]
        # Should delete from source_to_concept_map, concept, and vocabulary
        assert len(delete_sqls) == 3, f"Expected 3 DELETE statements, got {len(delete_sqls)}"
        tables_deleted = " ".join(delete_sqls)
        assert "source_to_concept_map" in tables_deleted
        assert "concept" in tables_deleted
        assert "vocabulary" in tables_deleted


# ---------------------------------------------------------------------------
# Parameterized queries
# ---------------------------------------------------------------------------


class TestParameterizedQueries:
    """All INSERT statements use %s placeholders, never string formatting."""

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_insert_uses_parameterized_queries(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()

        # Check execute calls for INSERT
        for c in cursor.execute.call_args_list:
            sql = c[0][0]
            if "INSERT" in sql:
                assert "%s" in sql, f"INSERT missing %s placeholder: {sql}"

        # Check executemany calls for INSERT
        for c in cursor.executemany.call_args_list:
            sql = c[0][0]
            if "INSERT" in sql:
                assert "%s" in sql, f"INSERT missing %s placeholder: {sql}"

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_delete_uses_parameterized_queries(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()

        for c in cursor.execute.call_args_list:
            sql = c[0][0]
            if "DELETE" in sql:
                assert "%s" in sql, f"DELETE missing %s placeholder: {sql}"


# ---------------------------------------------------------------------------
# Row counts
# ---------------------------------------------------------------------------


class TestRowCounts:
    """Correct number of rows passed to INSERT statements."""

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_returns_summary_dict(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        result = loader.load_all()
        assert isinstance(result, dict)
        assert "vocabulary" in result
        assert "concepts" in result
        assert "source_to_concept_map" in result

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_vocabulary_count_is_one(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        result = loader.load_all()
        assert result["vocabulary"] == 1

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_concept_count_is_117(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        result = loader.load_all()
        assert result["concepts"] == 117

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_source_to_concept_map_count_at_least_117(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        result = loader.load_all()
        assert result["source_to_concept_map"] >= 117

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_executemany_concept_rows(self, mock_pg: MagicMock) -> None:
        """executemany for concepts receives exactly 117 rows."""
        conn = MagicMock()
        cursor = MagicMock()
        conn.cursor.return_value = cursor
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.load_all()

        # Find the executemany call for concept INSERT
        concept_batches = [
            c for c in cursor.executemany.call_args_list
            if "concept" in c[0][0].lower() and "source_to_concept_map" not in c[0][0].lower()
        ]
        assert len(concept_batches) == 1
        assert len(concept_batches[0][0][1]) == 117


# ---------------------------------------------------------------------------
# Close
# ---------------------------------------------------------------------------


class TestClose:
    """VocabularyLoader.close() closes the connection."""

    @patch("scripts.irsf_etl.lib.vocab_loader.psycopg2")
    def test_close_closes_connection(self, mock_pg: MagicMock) -> None:
        conn = MagicMock()
        mock_pg.connect.return_value = conn
        loader = VocabularyLoader({"host": "localhost"})
        loader.close()
        conn.close.assert_called_once()
