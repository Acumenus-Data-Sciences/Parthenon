"""Tests for VocabularyValidator with mocked database connections."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from scripts.irsf_etl.lib.vocab_validator import (
    ConceptStatus,
    ConceptValidationResult,
    CurrencyReport,
    VocabularyValidator,
)


# ---------------------------------------------------------------------------
# Helpers for building mock cursors
# ---------------------------------------------------------------------------


def _make_mock_connection() -> MagicMock:
    """Create a mock psycopg2 connection with a mock cursor."""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    return conn


def _concept_row(
    concept_id: int,
    name: str,
    vocabulary_id: str = "RxNorm",
    standard: str | None = "S",
    invalid_reason: str | None = None,
    domain_id: str = "Drug",
    concept_code: str = "",
) -> tuple:
    """Build a row tuple matching concept table SELECT columns."""
    return (concept_id, name, domain_id, vocabulary_id, standard, invalid_reason)


def _concept_row_with_code(
    concept_id: int,
    name: str,
    concept_code: str,
    vocabulary_id: str = "RxNorm",
    standard: str | None = "S",
    invalid_reason: str | None = None,
) -> tuple:
    """Build a row tuple for batch code lookup (includes concept_code)."""
    return (concept_id, name, concept_code, vocabulary_id, standard, invalid_reason)


# ---------------------------------------------------------------------------
# ConceptStatus enum
# ---------------------------------------------------------------------------


class TestConceptStatus:
    def test_has_standard(self) -> None:
        assert ConceptStatus.STANDARD.value is not None

    def test_has_non_standard(self) -> None:
        assert ConceptStatus.NON_STANDARD.value is not None

    def test_has_deprecated_remapped(self) -> None:
        assert ConceptStatus.DEPRECATED_REMAPPED.value is not None

    def test_has_deprecated_no_replacement(self) -> None:
        assert ConceptStatus.DEPRECATED_NO_REPLACEMENT.value is not None

    def test_has_not_found(self) -> None:
        assert ConceptStatus.NOT_FOUND.value is not None


# ---------------------------------------------------------------------------
# ConceptValidationResult frozen dataclass
# ---------------------------------------------------------------------------


class TestConceptValidationResult:
    def test_creation(self) -> None:
        result = ConceptValidationResult(
            original_id=123,
            resolved_id=456,
            status=ConceptStatus.STANDARD,
            concept_name="Aspirin",
            vocabulary_id="RxNorm",
            message="Standard concept",
        )
        assert result.original_id == 123
        assert result.resolved_id == 456

    def test_is_frozen(self) -> None:
        result = ConceptValidationResult(
            original_id=1,
            resolved_id=1,
            status=ConceptStatus.STANDARD,
            concept_name="Test",
            vocabulary_id="RxNorm",
            message="OK",
        )
        with pytest.raises(Exception):
            result.resolved_id = 999  # type: ignore[misc]


# ---------------------------------------------------------------------------
# CurrencyReport
# ---------------------------------------------------------------------------


class TestCurrencyReport:
    def test_fields(self) -> None:
        report = CurrencyReport(
            current_count=50,
            remapped_count=10,
            no_replacement_count=5,
            non_standard_count=3,
            unmapped_count=2,
            total=70,
        )
        assert report.current_count == 50
        assert report.remapped_count == 10
        assert report.no_replacement_count == 5
        assert report.non_standard_count == 3
        assert report.unmapped_count == 2
        assert report.total == 70

    def test_coverage_rate(self) -> None:
        report = CurrencyReport(
            current_count=80,
            remapped_count=10,
            no_replacement_count=5,
            non_standard_count=3,
            unmapped_count=2,
            total=100,
        )
        # coverage = (current + remapped) / total
        assert report.coverage_rate == pytest.approx(0.9)

    def test_remapped_rate(self) -> None:
        report = CurrencyReport(
            current_count=80,
            remapped_count=10,
            no_replacement_count=5,
            non_standard_count=3,
            unmapped_count=2,
            total=100,
        )
        assert report.remapped_rate == pytest.approx(0.1)

    def test_is_frozen(self) -> None:
        report = CurrencyReport(
            current_count=1,
            remapped_count=0,
            no_replacement_count=0,
            non_standard_count=0,
            unmapped_count=0,
            total=1,
        )
        with pytest.raises(Exception):
            report.total = 99  # type: ignore[misc]

    def test_zero_total_coverage(self) -> None:
        report = CurrencyReport(
            current_count=0,
            remapped_count=0,
            no_replacement_count=0,
            non_standard_count=0,
            unmapped_count=0,
            total=0,
        )
        assert report.coverage_rate == 0.0
        assert report.remapped_rate == 0.0


# ---------------------------------------------------------------------------
# VocabularyValidator — validate_concept_id
# ---------------------------------------------------------------------------


class TestValidateConceptId:
    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_standard_concept(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # Concept lookup returns a standard concept
        cursor.fetchone.return_value = _concept_row(
            19078461, "Aspirin 81 MG Oral Tablet", "RxNorm", "S", None
        )

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(19078461)

        assert result.status == ConceptStatus.STANDARD
        assert result.resolved_id == 19078461
        assert result.concept_name == "Aspirin 81 MG Oral Tablet"
        validator.close()

    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_not_found(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        cursor.fetchone.return_value = None

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(999999999)

        assert result.status == ConceptStatus.NOT_FOUND
        assert result.resolved_id == 0
        validator.close()

    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_deprecated_remapped(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # First call: concept lookup returns deprecated concept
        # Second call: maps-to returns a standard concept
        cursor.fetchone.side_effect = [
            _concept_row(100, "Old Drug", "RxNorm", None, "D"),
            (200, "New Drug", "S"),  # Maps-to result
        ]

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(100)

        assert result.status == ConceptStatus.DEPRECATED_REMAPPED
        assert result.resolved_id == 200
        assert result.concept_name == "New Drug"
        validator.close()

    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_deprecated_no_replacement(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # Concept lookup returns deprecated, maps-to returns nothing
        cursor.fetchone.side_effect = [
            _concept_row(100, "Old Drug", "RxNorm", None, "D"),
            None,  # No maps-to target
        ]

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(100)

        assert result.status == ConceptStatus.DEPRECATED_NO_REPLACEMENT
        assert result.resolved_id == 0
        validator.close()

    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_non_standard_no_mapping(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # Non-standard concept (no invalid_reason, but standard_concept is not 'S')
        # Maps-to returns nothing
        cursor.fetchone.side_effect = [
            _concept_row(300, "Brand Name Drug", "RxNorm", "C", None),
            None,  # No maps-to
        ]

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(300)

        assert result.status == ConceptStatus.NON_STANDARD
        validator.close()


# ---------------------------------------------------------------------------
# VocabularyValidator — validate_concept_code
# ---------------------------------------------------------------------------


class TestValidateConceptCode:
    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_lookup_by_code(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        cursor.fetchone.return_value = _concept_row(
            19078461, "Aspirin 81 MG Oral Tablet", "RxNorm", "S", None
        )

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_code("1191", "RxNorm")

        assert result.status == ConceptStatus.STANDARD
        assert result.resolved_id == 19078461
        validator.close()


# ---------------------------------------------------------------------------
# VocabularyValidator — batch validation
# ---------------------------------------------------------------------------


class TestBatchValidation:
    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_validate_batch(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # Batch concept lookup returns two standard concepts
        cursor.fetchall.side_effect = [
            [
                (100, "Drug A", "RxNorm", "S", None),
                (200, "Drug B", "RxNorm", "S", None),
            ],
        ]

        validator = VocabularyValidator({"host": "localhost"})
        results = validator.validate_batch([100, 200])

        assert len(results) == 2
        assert results[100].status == ConceptStatus.STANDARD
        assert results[200].status == ConceptStatus.STANDARD
        validator.close()

    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_validate_batch_codes(self, mock_pg: MagicMock) -> None:
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        cursor.fetchall.side_effect = [
            [
                (100, "Drug A", "1191", "RxNorm", "S", None),
                (200, "Drug B", "2002", "RxNorm", "S", None),
            ],
        ]

        validator = VocabularyValidator({"host": "localhost"})
        results = validator.validate_batch_codes(["1191", "2002"], "RxNorm")

        assert len(results) == 2
        assert results["1191"].status == ConceptStatus.STANDARD
        assert results["2002"].status == ConceptStatus.STANDARD
        validator.close()


# ---------------------------------------------------------------------------
# Maps-to chain tests
# ---------------------------------------------------------------------------


class TestMapsToChain:
    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_multi_hop_chain(self, mock_pg: MagicMock) -> None:
        """Maps-to chain follows up to 5 hops."""
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # Concept 100 deprecated -> maps to 200 (also deprecated) -> maps to 300 (standard)
        cursor.fetchone.side_effect = [
            _concept_row(100, "Old Drug v1", "RxNorm", None, "D"),
            (200, "Old Drug v2", None),  # Maps-to hop 1: non-standard
            (300, "Current Drug", "S"),  # Maps-to hop 2: standard
        ]

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(100)

        assert result.status == ConceptStatus.DEPRECATED_REMAPPED
        assert result.resolved_id == 300
        validator.close()

    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_self_mapping_stops(self, mock_pg: MagicMock) -> None:
        """Maps-to chain stops when concept maps to itself."""
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        # Standard concept maps to itself
        cursor.fetchone.side_effect = [
            _concept_row(100, "Standard Drug", "RxNorm", "S", None),
        ]

        validator = VocabularyValidator({"host": "localhost"})
        result = validator.validate_concept_id(100)

        # Standard concept: no need to follow chain
        assert result.status == ConceptStatus.STANDARD
        assert result.resolved_id == 100
        validator.close()


# ---------------------------------------------------------------------------
# Currency report
# ---------------------------------------------------------------------------


class TestCurrencyReportGeneration:
    def test_generate_from_results(self) -> None:
        results = {
            1: ConceptValidationResult(1, 1, ConceptStatus.STANDARD, "A", "RxNorm", "OK"),
            2: ConceptValidationResult(2, 3, ConceptStatus.DEPRECATED_REMAPPED, "B", "RxNorm", "Remapped"),
            3: ConceptValidationResult(3, 0, ConceptStatus.DEPRECATED_NO_REPLACEMENT, "C", "RxNorm", "No replacement"),
            4: ConceptValidationResult(4, 4, ConceptStatus.NON_STANDARD, "D", "RxNorm", "Non-standard"),
            5: ConceptValidationResult(5, 0, ConceptStatus.NOT_FOUND, "", "", "Not found"),
        }

        report = VocabularyValidator.generate_currency_report(results)

        assert report.current_count == 1
        assert report.remapped_count == 1
        assert report.no_replacement_count == 1
        assert report.non_standard_count == 1
        assert report.unmapped_count == 1
        assert report.total == 5


# ---------------------------------------------------------------------------
# SQL parameterization
# ---------------------------------------------------------------------------


class TestSQLParameterization:
    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_queries_use_parameters(self, mock_pg: MagicMock) -> None:
        """Verify execute() is called with parameterized queries, not string interpolation."""
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value

        cursor.fetchone.return_value = _concept_row(
            100, "Drug", "RxNorm", "S", None
        )

        validator = VocabularyValidator({"host": "localhost"})
        validator.validate_concept_id(100)

        # Check that execute was called with a tuple/list of params, not f-string
        call_args = cursor.execute.call_args_list
        for call in call_args:
            args = call[0]
            # The SQL string should contain %s placeholders
            assert "%s" in args[0], f"SQL should use %s placeholders: {args[0]}"
            # The params should be a tuple
            assert isinstance(args[1], (tuple, list)), f"Params should be tuple/list: {args}"
        validator.close()


# ---------------------------------------------------------------------------
# All tests use mocked connection
# ---------------------------------------------------------------------------


class TestMockedConnection:
    @patch("scripts.irsf_etl.lib.vocab_validator.psycopg2")
    def test_no_real_db_call(self, mock_pg: MagicMock) -> None:
        """Confirm psycopg2.connect is mocked, not calling real DB."""
        conn = _make_mock_connection()
        mock_pg.connect.return_value = conn
        cursor = conn.cursor.return_value
        cursor.fetchone.return_value = None

        validator = VocabularyValidator({"host": "localhost"})
        validator.validate_concept_id(1)

        mock_pg.connect.assert_called_once()
        validator.close()
