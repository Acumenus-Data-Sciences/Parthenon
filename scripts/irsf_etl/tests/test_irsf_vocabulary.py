"""Tests for IRSF custom vocabulary registry.

Verifies concept definitions, uniqueness, ranges, lookups, and CSV generation.
No live database required -- pure Python data structure tests.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
import pytest

from scripts.irsf_etl.lib.irsf_vocabulary import (
    ConceptDefinition,
    IrsfVocabulary,
    generate_concept_csv,
    generate_vocabulary_csv,
)


# ---------------------------------------------------------------------------
# ConceptDefinition dataclass
# ---------------------------------------------------------------------------


class TestConceptDefinition:
    """ConceptDefinition is a frozen dataclass with all required fields."""

    def test_is_frozen(self) -> None:
        cd = ConceptDefinition(
            concept_id=2000000001,
            concept_name="Test",
            domain_id="Measurement",
            vocabulary_id="IRSF-NHS",
            concept_class_id="Clinical Observation",
            standard_concept="S",
            concept_code="TEST-001",
            source_column=None,
            source_value=None,
        )
        with pytest.raises(AttributeError):
            cd.concept_id = 999  # type: ignore[misc]

    def test_required_fields(self) -> None:
        cd = ConceptDefinition(
            concept_id=2000000001,
            concept_name="Test Concept",
            domain_id="Observation",
            vocabulary_id="IRSF-NHS",
            concept_class_id="Observable Entity",
            standard_concept="S",
            concept_code="TEST-002",
            source_column="SomeCol",
            source_value=None,
        )
        assert cd.concept_id == 2000000001
        assert cd.concept_name == "Test Concept"
        assert cd.domain_id == "Observation"
        assert cd.vocabulary_id == "IRSF-NHS"
        assert cd.concept_class_id == "Observable Entity"
        assert cd.standard_concept == "S"
        assert cd.concept_code == "TEST-002"
        assert cd.source_column == "SomeCol"
        assert cd.source_value is None


# ---------------------------------------------------------------------------
# IrsfVocabulary constants
# ---------------------------------------------------------------------------


class TestVocabularyConstants:
    def test_vocabulary_id(self) -> None:
        assert IrsfVocabulary.VOCABULARY_ID == "IRSF-NHS"

    def test_vocabulary_concept_id(self) -> None:
        assert IrsfVocabulary.vocabulary_concept_id == 2000000000


# ---------------------------------------------------------------------------
# Concept ID range and uniqueness
# ---------------------------------------------------------------------------


class TestConceptRangesAndUniqueness:
    def test_all_concept_ids_above_2b(self) -> None:
        for c in IrsfVocabulary.all_concepts():
            assert c.concept_id >= 2_000_000_000, (
                f"{c.concept_code} has concept_id {c.concept_id} < 2B"
            )

    def test_all_concept_ids_unique(self) -> None:
        ids = [c.concept_id for c in IrsfVocabulary.all_concepts()]
        assert len(ids) == len(set(ids)), "Duplicate concept_ids found"

    def test_all_concept_codes_unique(self) -> None:
        codes = [c.concept_code for c in IrsfVocabulary.all_concepts()]
        assert len(codes) == len(set(codes)), "Duplicate concept_codes found"

    def test_all_concepts_returns_tuple(self) -> None:
        result = IrsfVocabulary.all_concepts()
        assert isinstance(result, tuple)


# ---------------------------------------------------------------------------
# Concept counts
# ---------------------------------------------------------------------------


class TestConceptCounts:
    def test_css_count(self) -> None:
        assert len(IrsfVocabulary.css_concepts()) == 14

    def test_mba_count(self) -> None:
        assert len(IrsfVocabulary.mba_concepts()) == 41

    def test_mutation_count(self) -> None:
        assert len(IrsfVocabulary.mutation_concepts()) == 48

    def test_diagnosis_count(self) -> None:
        assert len(IrsfVocabulary.diagnosis_concepts()) == 14

    def test_total_count(self) -> None:
        assert len(IrsfVocabulary.all_concepts()) == 117


# ---------------------------------------------------------------------------
# Vocabulary and domain assignments
# ---------------------------------------------------------------------------


class TestDomainAssignments:
    def test_all_vocabulary_id(self) -> None:
        for c in IrsfVocabulary.all_concepts():
            assert c.vocabulary_id == "IRSF-NHS", (
                f"{c.concept_code} has vocabulary_id={c.vocabulary_id}"
            )

    def test_all_standard_concept(self) -> None:
        for c in IrsfVocabulary.all_concepts():
            assert c.standard_concept == "S", (
                f"{c.concept_code} has standard_concept={c.standard_concept}"
            )

    def test_css_domain(self) -> None:
        for c in IrsfVocabulary.css_concepts():
            assert c.domain_id == "Measurement", (
                f"{c.concept_code} domain_id={c.domain_id}"
            )

    def test_mba_domain(self) -> None:
        for c in IrsfVocabulary.mba_concepts():
            assert c.domain_id == "Observation", (
                f"{c.concept_code} domain_id={c.domain_id}"
            )

    def test_mutation_domain(self) -> None:
        for c in IrsfVocabulary.mutation_concepts():
            assert c.domain_id == "Observation", (
                f"{c.concept_code} domain_id={c.domain_id}"
            )

    def test_diagnosis_domain(self) -> None:
        for c in IrsfVocabulary.diagnosis_concepts():
            assert c.domain_id == "Condition", (
                f"{c.concept_code} domain_id={c.domain_id}"
            )


# ---------------------------------------------------------------------------
# Concept code patterns
# ---------------------------------------------------------------------------


class TestConceptCodePatterns:
    def test_css_codes_pattern(self) -> None:
        for c in IrsfVocabulary.css_concepts():
            assert re.match(r"^IRSF-CSS-", c.concept_code), (
                f"CSS concept code {c.concept_code} doesn't match IRSF-CSS-*"
            )

    def test_mba_codes_pattern(self) -> None:
        for c in IrsfVocabulary.mba_concepts():
            assert re.match(r"^IRSF-MBA-", c.concept_code), (
                f"MBA concept code {c.concept_code} doesn't match IRSF-MBA-*"
            )

    def test_mutation_codes_pattern(self) -> None:
        for c in IrsfVocabulary.mutation_concepts():
            assert re.match(r"^IRSF-MUT-", c.concept_code), (
                f"Mutation concept code {c.concept_code} doesn't match IRSF-MUT-*"
            )

    def test_diagnosis_codes_pattern(self) -> None:
        for c in IrsfVocabulary.diagnosis_concepts():
            assert re.match(r"^IRSF-DX-", c.concept_code), (
                f"Diagnosis concept code {c.concept_code} doesn't match IRSF-DX-*"
            )


# ---------------------------------------------------------------------------
# Source column / source value attributes
# ---------------------------------------------------------------------------


class TestSourceAttributes:
    def test_css_concepts_have_source_column(self) -> None:
        for c in IrsfVocabulary.css_concepts():
            assert c.source_column is not None, (
                f"CSS concept {c.concept_code} missing source_column"
            )

    def test_mba_concepts_have_source_column(self) -> None:
        for c in IrsfVocabulary.mba_concepts():
            assert c.source_column is not None, (
                f"MBA concept {c.concept_code} missing source_column"
            )

    def test_mutation_concepts_have_source_column(self) -> None:
        for c in IrsfVocabulary.mutation_concepts():
            assert c.source_column is not None, (
                f"Mutation concept {c.concept_code} missing source_column"
            )

    def test_diagnosis_concepts_have_source_value(self) -> None:
        for c in IrsfVocabulary.diagnosis_concepts():
            assert c.source_value is not None, (
                f"Diagnosis concept {c.concept_code} missing source_value"
            )


# ---------------------------------------------------------------------------
# Lookup methods
# ---------------------------------------------------------------------------


class TestLookupMethods:
    def test_get_css_total_by_source_column(self) -> None:
        c = IrsfVocabulary.get_concept_by_source_column("TotalScore")
        assert c is not None
        assert c.concept_id == 2000001000

    def test_get_mba_grand_total_by_source_column(self) -> None:
        c = IrsfVocabulary.get_concept_by_source_column("GrandTotal")
        assert c is not None

    def test_get_mutation_by_source_column(self) -> None:
        c = IrsfVocabulary.get_concept_by_source_column(
            "CommonMECP2Mutations_C473TT158M"
        )
        assert c is not None

    def test_get_diagnosis_classic(self) -> None:
        c = IrsfVocabulary.get_diagnosis_concept("Classic")
        assert c is not None
        assert "Classic" in c.concept_name

    def test_get_concept_by_source_column_missing(self) -> None:
        assert IrsfVocabulary.get_concept_by_source_column("NonexistentColumn") is None

    def test_get_diagnosis_concept_missing(self) -> None:
        assert IrsfVocabulary.get_diagnosis_concept("NonexistentDiagnosis") is None

    def test_get_concept_by_id(self) -> None:
        c = IrsfVocabulary.get_concept_by_id(2000001000)
        assert c is not None
        assert c.concept_code == "IRSF-CSS-TOTAL"

    def test_get_concept_by_id_missing(self) -> None:
        assert IrsfVocabulary.get_concept_by_id(9999999999) is None


# ---------------------------------------------------------------------------
# CSV generation
# ---------------------------------------------------------------------------


class TestVocabularyCsvGeneration:
    def test_vocabulary_csv_columns(self, tmp_path: Path) -> None:
        path = generate_vocabulary_csv(tmp_path)
        df = pd.read_csv(path)
        expected = [
            "vocabulary_id",
            "vocabulary_name",
            "vocabulary_reference",
            "vocabulary_version",
            "vocabulary_concept_id",
        ]
        assert list(df.columns) == expected

    def test_vocabulary_csv_row_count(self, tmp_path: Path) -> None:
        path = generate_vocabulary_csv(tmp_path)
        df = pd.read_csv(path)
        assert len(df) == 1

    def test_vocabulary_csv_values(self, tmp_path: Path) -> None:
        path = generate_vocabulary_csv(tmp_path)
        df = pd.read_csv(path)
        row = df.iloc[0]
        assert row["vocabulary_id"] == "IRSF-NHS"
        assert row["vocabulary_name"] == "IRSF Natural History Study Custom Vocabulary"
        assert row["vocabulary_concept_id"] == 2000000000


class TestConceptCsvGeneration:
    def test_concept_csv_columns(self, tmp_path: Path) -> None:
        path = generate_concept_csv(tmp_path)
        df = pd.read_csv(path)
        expected = [
            "concept_id",
            "concept_name",
            "domain_id",
            "vocabulary_id",
            "concept_class_id",
            "standard_concept",
            "concept_code",
            "valid_start_date",
            "valid_end_date",
            "invalid_reason",
        ]
        assert list(df.columns) == expected

    def test_concept_csv_row_count(self, tmp_path: Path) -> None:
        path = generate_concept_csv(tmp_path)
        df = pd.read_csv(path)
        assert len(df) == 117

    def test_concept_csv_valid_start_date(self, tmp_path: Path) -> None:
        path = generate_concept_csv(tmp_path)
        df = pd.read_csv(path)
        assert (df["valid_start_date"] == "1970-01-01").all()

    def test_concept_csv_valid_end_date(self, tmp_path: Path) -> None:
        path = generate_concept_csv(tmp_path)
        df = pd.read_csv(path)
        assert (df["valid_end_date"] == "2099-12-31").all()

    def test_concept_csv_invalid_reason_empty(self, tmp_path: Path) -> None:
        path = generate_concept_csv(tmp_path)
        df = pd.read_csv(path, keep_default_na=False)
        assert (df["invalid_reason"] == "").all()

    def test_concept_csv_written_to_staging(self, tmp_path: Path) -> None:
        path = generate_concept_csv(tmp_path)
        assert path.exists()
        assert path.name == "concept.csv"
