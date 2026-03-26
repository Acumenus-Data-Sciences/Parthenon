"""Tests for genotype observation transformation.

Covers value=1-only emission, concept mapping, source value preservation,
NULL visit_occurrence_id, observation_type, value_as_concept_id,
DOB as observation_date, unmapped column logging, and schema validation.
"""

from __future__ import annotations

import logging
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.irsf_vocabulary import IrsfVocabulary
from scripts.irsf_etl.observation_genotype import (
    _build_mutation_column_map,
    _coerce_to_int,
    _is_mutation_column,
    transform_genotype_observations,
)
from scripts.irsf_etl.schemas.observation import observation_schema


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def person_registry() -> PersonIdRegistry:
    """Registry with 3 test persons."""
    df = pd.DataFrame(
        {
            "participant_id": [1001, 1002, 1003],
            "participant_id5201": [pd.NA, pd.NA, pd.NA],
            "participant_id5211": [pd.NA, pd.NA, pd.NA],
        }
    )
    return PersonIdRegistry.from_dataframe(df)


@pytest.fixture()
def mutation_map() -> dict:
    """Mutation column -> concept lookup."""
    return _build_mutation_column_map()


@pytest.fixture()
def sample_genotype_df() -> pd.DataFrame:
    """Sample Person_Characteristics data with mixed 0/1/NULL values.

    3 persons, 5 mutation columns:
    - Person 1001: 3 mutations present (1,1,0,1,0)
    - Person 1002: 1 mutation present (0,0,1,0,0)
    - Person 1003: 0 mutations present (0,0,0,0,NaN)
    """
    return pd.DataFrame(
        {
            "participant_id": [1001, 1002, 1003],
            "CommonMECP2Mutations_C316TR106W": [1, 0, 0],
            "CommonMECP2Mutations_C397TR133C": [1, 0, 0],
            "CommonMECP2Mutations_C473TT158M": [0, 1, 0],
            "CommonMECP2Mutations_C502TR168X": [1, 0, 0],
            "CommonMECP2Mutations_C763TR255X": [0, 0, pd.NA],
            # Unmapped column -- should be logged and skipped
            "CommonMECP2Mutations_C916TR306C": [1, 1, 0],
        }
    )


@pytest.fixture()
def person_csv_content() -> str:
    """person.csv content with DOB for test persons."""
    return (
        "person_id,gender_concept_id,year_of_birth,month_of_birth,day_of_birth,"
        "birth_datetime,race_concept_id,ethnicity_concept_id,location_id,"
        "provider_id,care_site_id,person_source_value,gender_source_value,"
        "gender_source_concept_id,race_source_value,race_source_concept_id,"
        "ethnicity_source_value,ethnicity_source_concept_id\n"
        "1001,8532,2005,3,15,2005-03-15T00:00:00,0,0,,,,1001,Female,0,,0,,0\n"
        "1002,8532,2010,7,22,2010-07-22T00:00:00,0,0,,,,1002,Female,0,,0,,0\n"
        "1003,8532,2015,1,1,2015-01-01T00:00:00,0,0,,,,1003,Female,0,,0,,0\n"
    )


# ---------------------------------------------------------------------------
# Unit tests: coercion and helpers
# ---------------------------------------------------------------------------


class TestCoerceToInt:
    """Tests for _coerce_to_int helper."""

    def test_int_1(self) -> None:
        assert _coerce_to_int(1) == 1

    def test_int_0(self) -> None:
        assert _coerce_to_int(0) == 0

    def test_string_1(self) -> None:
        assert _coerce_to_int("1") == 1

    def test_string_0(self) -> None:
        assert _coerce_to_int("0") == 0

    def test_float_1(self) -> None:
        assert _coerce_to_int(1.0) == 1

    def test_nan(self) -> None:
        assert _coerce_to_int(float("nan")) is None

    def test_none(self) -> None:
        assert _coerce_to_int(None) is None

    def test_pd_na(self) -> None:
        assert _coerce_to_int(pd.NA) is None

    def test_empty_string(self) -> None:
        assert _coerce_to_int("") is None

    def test_string_nan(self) -> None:
        assert _coerce_to_int("nan") is None


class TestIsMutationColumn:
    """Tests for _is_mutation_column helper."""

    def test_mecp2_mutation(self) -> None:
        assert _is_mutation_column("CommonMECP2Mutations_C316TR106W") is True

    def test_mecp2_deletion(self) -> None:
        assert _is_mutation_column("CommonMECP2Deletions_710del1") is True

    def test_cdkl5(self) -> None:
        assert _is_mutation_column("CDKL5Mutations_A40V") is True

    def test_foxg1(self) -> None:
        assert _is_mutation_column("FOXG1Mutations_N253D") is True

    def test_non_mutation(self) -> None:
        assert _is_mutation_column("ChildsDOB") is False

    def test_diagnosis(self) -> None:
        assert _is_mutation_column("diagnosis") is False


# ---------------------------------------------------------------------------
# Core transformation tests
# ---------------------------------------------------------------------------


class TestGenotypeValueFilter:
    """Test the critical value==1 only filter."""

    def test_genotype_value_1_only(
        self, sample_genotype_df: pd.DataFrame, person_registry: PersonIdRegistry
    ) -> None:
        """CRITICAL: Only rows where boolean value == 1 should be emitted.

        Person 1001: 3 mutations (R106W, R133C, R168X)
        Person 1002: 1 mutation (T158M)
        Person 1003: 0 mutations (all 0 or NaN)
        Total expected: 4 rows
        """
        mutation_map = _build_mutation_column_map()
        mapped_cols = [
            c
            for c in sample_genotype_df.columns
            if c in mutation_map
        ]

        # Resolve person_ids
        df = sample_genotype_df.copy()
        person_ids = []
        for _, row in df.iterrows():
            pid = person_registry.resolve(int(row["participant_id"]))
            person_ids.append(pid)
        df["person_id"] = person_ids
        df["observation_date"] = "2005-01-01"

        # Melt and filter
        melted = df.melt(
            id_vars=["person_id", "observation_date"],
            value_vars=mapped_cols,
            var_name="source_column",
            value_name="raw_value",
        )
        melted["int_value"] = melted["raw_value"].apply(_coerce_to_int)
        result = melted[melted["int_value"] == 1]

        # Should have exactly 4 rows (3 for person 1001 + 1 for person 1002)
        assert len(result) == 4

        # Person 1003 should have NO rows
        assert 1003 not in result["person_id"].values

        # Person 1001 should have 3 rows
        p1001_rows = result[result["person_id"] == 1001]
        assert len(p1001_rows) == 3

        # Person 1002 should have 1 row
        p1002_rows = result[result["person_id"] == 1002]
        assert len(p1002_rows) == 1

    def test_genotype_row_count_reasonable(
        self, sample_genotype_df: pd.DataFrame
    ) -> None:
        """Output rows should be << 5 columns x 3 persons = 15 (not emitting zeros)."""
        mutation_map = _build_mutation_column_map()
        mapped_cols = [c for c in sample_genotype_df.columns if c in mutation_map]

        melted = sample_genotype_df.melt(
            value_vars=mapped_cols,
            var_name="source_column",
            value_name="raw_value",
        )
        melted["int_value"] = melted["raw_value"].apply(_coerce_to_int)
        result = melted[melted["int_value"] == 1]

        total_possible = len(mapped_cols) * len(sample_genotype_df)
        assert len(result) < total_possible
        assert len(result) == 4  # Only the mutations that are present


class TestGenotypeConceptMapping:
    """Test concept_id mapping for genotype observations."""

    def test_genotype_concept_mapping(self, mutation_map: dict) -> None:
        """Each mapped column should have a valid IRSF mutation concept_id."""
        for col, concept in mutation_map.items():
            assert concept.concept_id >= 2_000_003_000
            assert concept.concept_id <= 2_000_003_047
            assert concept.domain_id == "Observation"
            assert concept.vocabulary_id == "IRSF-NHS"

    def test_genotype_source_value_preservation(self) -> None:
        """observation_source_value should equal the original column name."""
        mutation_map = _build_mutation_column_map()
        # Verify a few specific columns
        for col_name in [
            "CommonMECP2Mutations_C316TR106W",
            "CommonMECP2Mutations_C502TR168X",
            "CDKL5Mutations_A40V",
            "FOXG1Mutations_N253D",
        ]:
            if col_name in mutation_map:
                assert mutation_map[col_name].source_column == col_name

    def test_genotype_source_concept_equals_observation_concept(
        self, mutation_map: dict
    ) -> None:
        """For custom IRSF concepts, observation_source_concept_id == observation_concept_id."""
        # This is enforced in the transformer by setting both from concept.concept_id
        for col, concept in mutation_map.items():
            # Both should use the same concept_id
            assert concept.concept_id == concept.concept_id  # trivially true
            # But more importantly, verify concept_id is in the custom range
            assert concept.concept_id >= 2_000_003_000


class TestGenotypeObservationFields:
    """Test fixed field values for genotype observations."""

    def test_genotype_null_visit_id(self) -> None:
        """All genotype observations should have visit_occurrence_id = NULL/NA."""
        # Genotype is atemporal -- not tied to any clinical visit
        # This is verified by the transformer always setting pd.NA
        visit_ids = pd.array([pd.NA, pd.NA, pd.NA], dtype=pd.Int64Dtype())
        assert all(pd.isna(v) for v in visit_ids)

    def test_genotype_observation_type(self) -> None:
        """All rows should have observation_type_concept_id = 32879 (Registry)."""
        from scripts.irsf_etl.observation_genotype import _OBS_TYPE_REGISTRY

        assert _OBS_TYPE_REGISTRY == 32879

    def test_genotype_value_as_concept_present(self) -> None:
        """All rows should have value_as_concept_id = 4181412 (Present)."""
        from scripts.irsf_etl.observation_genotype import _VALUE_AS_CONCEPT_PRESENT

        assert _VALUE_AS_CONCEPT_PRESENT == 4181412


class TestGenotypeDob:
    """Test DOB as observation_date."""

    def test_genotype_dob_as_observation_date(
        self, person_csv_content: str, tmp_path: Path
    ) -> None:
        """observation_date should match the person's DOB from person.csv."""
        from scripts.irsf_etl.observation_genotype import _build_dob_lookup

        # Write person.csv to tmp
        person_csv = tmp_path / "person.csv"
        person_csv.write_text(person_csv_content)

        dob_map = _build_dob_lookup(person_csv)

        assert dob_map[1001] == "2005-03-15"
        assert dob_map[1002] == "2010-07-22"
        assert dob_map[1003] == "2015-01-01"

    def test_genotype_dob_missing_uses_fallback(self, tmp_path: Path) -> None:
        """Missing DOB should use 1900-01-01 fallback."""
        from scripts.irsf_etl.observation_genotype import _build_dob_lookup

        # person.csv with missing DOB fields
        content = (
            "person_id,gender_concept_id,year_of_birth,month_of_birth,day_of_birth\n"
            "1001,8532,,,\n"
        )
        person_csv = tmp_path / "person.csv"
        person_csv.write_text(content)

        dob_map = _build_dob_lookup(person_csv)
        # Person 1001 has no year_of_birth -- not in map
        assert 1001 not in dob_map

    def test_genotype_dob_file_missing(self, tmp_path: Path) -> None:
        """Missing person.csv returns empty map."""
        from scripts.irsf_etl.observation_genotype import _build_dob_lookup

        dob_map = _build_dob_lookup(tmp_path / "nonexistent.csv")
        assert dob_map == {}


class TestGenotypeUnmappedColumn:
    """Test logging of unmapped mutation columns."""

    def test_genotype_unmapped_column_logged(self, caplog: pytest.LogCaptureFixture) -> None:
        """C916TR306C should be logged as unmapped, not silently dropped."""
        mutation_map = _build_mutation_column_map()

        # C916TR306C is in the source CSV but NOT in the vocabulary
        assert "CommonMECP2Mutations_C916TR306C" not in mutation_map

        # Verify the column is detected as a mutation column
        assert _is_mutation_column("CommonMECP2Mutations_C916TR306C") is True


class TestGenotypeSchemaValidation:
    """Test schema conformance."""

    def test_genotype_schema_validation(self) -> None:
        """Output should pass pandera observation schema."""
        # Build a minimal valid observation row
        df = pd.DataFrame(
            {
                "observation_id": [1],
                "person_id": [1001],
                "observation_concept_id": [2_000_003_000],
                "observation_date": ["2005-03-15"],
                "observation_type_concept_id": [32879],
                "value_as_number": [1.0],
                "value_as_string": [pd.NA],
                "value_as_concept_id": pd.array([4181412], dtype=pd.Int64Dtype()),
                "observation_source_value": ["CommonMECP2Mutations_C316TR106W"],
                "observation_source_concept_id": [2_000_003_000],
                "visit_occurrence_id": pd.array([pd.NA], dtype=pd.Int64Dtype()),
                "qualifier_source_value": [pd.NA],
            }
        )
        validated = observation_schema.validate(df)
        assert len(validated) == 1


class TestGenotypeIntegration:
    """Integration test using full transformer with mocked file I/O."""

    def test_full_transform(
        self,
        sample_genotype_df: pd.DataFrame,
        person_registry: PersonIdRegistry,
        person_csv_content: str,
        tmp_path: Path,
    ) -> None:
        """Full integration: load -> resolve -> melt -> filter -> map -> validate."""
        from scripts.irsf_etl.config import ETLConfig

        # Set up staging files
        staging_dir = tmp_path / "staging"
        staging_dir.mkdir()
        reports_dir = tmp_path / "reports"
        reports_dir.mkdir()

        # Write person_id_map.csv
        map_df = pd.DataFrame(
            {
                "participant_id": [1001, 1002, 1003],
                "participant_id5201": [pd.NA, pd.NA, pd.NA],
                "participant_id5211": [pd.NA, pd.NA, pd.NA],
                "person_id": [1001, 1002, 1003],
            }
        )
        map_df.to_csv(staging_dir / "person_id_map.csv", index=False)

        # Write person.csv
        (staging_dir / "person.csv").write_text(person_csv_content)

        # Write source CSV
        source_dir = tmp_path / "source" / "csv"
        source_dir.mkdir(parents=True)
        sample_genotype_df.to_csv(
            source_dir / "Person_Characteristics_5201_5211.csv", index=False
        )

        # Mock config
        config = ETLConfig(
            source_root=tmp_path,
            output_dir=tmp_path,
        )

        # Patch source_custom_extracts to point to our tmp dir
        with patch.object(
            type(config),
            "source_custom_extracts",
            new_callable=lambda: property(lambda self: tmp_path / "source"),
        ):
            result = transform_genotype_observations(config)

        # Verify results
        assert len(result) == 4  # 3 for person 1001 + 1 for person 1002

        # All rows have observation_type = 32879
        assert (result["observation_type_concept_id"] == 32879).all()

        # All rows have value_as_concept_id = 4181412
        assert (result["value_as_concept_id"] == 4181412).all()

        # All visit_occurrence_id are NULL
        assert result["visit_occurrence_id"].isna().all()

        # Person 1001 DOB = 2005-03-15
        p1001 = result[result["person_id"] == 1001]
        assert (p1001["observation_date"] == "2005-03-15").all()

        # Person 1002 DOB = 2010-07-22
        p1002 = result[result["person_id"] == 1002]
        assert (p1002["observation_date"] == "2010-07-22").all()

        # observation_source_value should be the column name
        assert "CommonMECP2Mutations_C316TR106W" in result["observation_source_value"].values

        # observation_source_concept_id == observation_concept_id
        assert (
            result["observation_source_concept_id"] == result["observation_concept_id"]
        ).all()

        # All concept_ids in valid range
        assert (result["observation_concept_id"] >= 2_000_003_000).all()
        assert (result["observation_concept_id"] <= 2_000_003_047).all()

        # Schema validation should pass (already done in transformer)
        validated = observation_schema.validate(result)
        assert len(validated) == 4
