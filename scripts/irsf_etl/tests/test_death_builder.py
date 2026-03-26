"""Tests for death record builder."""

from __future__ import annotations

import pandas as pd
import pytest

from scripts.irsf_etl.lib.death_builder import (
    DEATH_COLUMNS,
    DEATH_TYPE_CONCEPT_ID,
    build_death_records,
)
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def registry() -> PersonIdRegistry:
    """Registry with 6 participants (IDs 1001-1006)."""
    df = pd.DataFrame(
        {
            "participant_id": [1001, 1002, 1003, 1004, 1005, 1006],
            "participant_id5201": [None, None, None, None, None, None],
            "participant_id5211": [2001, 2002, 2003, 2004, 2005, 2006],
        }
    )
    return PersonIdRegistry.from_dataframe(df)


@pytest.fixture()
def sample_death_df() -> pd.DataFrame:
    """6-row DataFrame mimicking DeathRecord_5211.

    Rows:
        0: Valid complete death record (participant 1001)
        1: Duplicate person_id 1001 (different date) -- should be deduplicated
        2: Missing death date (all null) -- should be excluded
        3: Invalid year (year=1800) -- should be excluded
        4: Missing cause fields but valid date (participant 1004)
        5: Complete record with SNOMED code (participant 1005)
    """
    return pd.DataFrame(
        {
            "participant_id": [1001, 1001, 1003, 1004, 1004, 1005],
            "participant_id5201": [None, None, None, None, None, None],
            "participant_id5211": [2001, 2001, 2003, 2004, 2004, 2005],
            "DeathDateMonth": ["Jan", "Mar", pd.NA, "Jun", "Aug", "Dec"],
            "DeathDateDay": [15, 20, pd.NA, 10, 5, 25],
            "DeathDateYear": [2020, 2021, pd.NA, 1800, 2019, 2022],
            "CauseofDeathImmediateCauseDesc": [
                "Respiratory failure",
                "Cardiac arrest",
                pd.NA,
                "Seizure complications",
                pd.NA,
                "Aspiration pneumonia",
            ],
            "CauseofDeathImmediateCauseSNOM": [
                "65710008",
                "410429000",
                pd.NA,
                "91175000",
                pd.NA,
                "422588002",
            ],
        }
    )


# ---------------------------------------------------------------------------
# OMOP output structure tests
# ---------------------------------------------------------------------------


class TestDeathRecordOutputStructure:
    """Tests for correct OMOP death table columns."""

    def test_returns_dataframe(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert isinstance(result, pd.DataFrame)

    def test_output_has_omop_columns(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        expected_cols = {
            "person_id",
            "death_date",
            "death_datetime",
            "death_type_concept_id",
            "cause_concept_id",
            "cause_source_value",
            "cause_source_concept_id",
        }
        assert set(result.columns) == expected_cols

    def test_death_type_concept_id_constant(self) -> None:
        assert DEATH_TYPE_CONCEPT_ID == 32879

    def test_death_type_concept_id_all_rows(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert (result["death_type_concept_id"] == 32879).all()


# ---------------------------------------------------------------------------
# Date assembly tests
# ---------------------------------------------------------------------------


class TestDeathDateAssembly:
    """Tests for death_date assembly from split columns."""

    def test_death_date_assembled_correctly(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        # Row 0: participant 1001, Jan/15/2020
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert str(row_1001["death_date"]) == "2020-01-15"

    def test_death_datetime_is_midnight(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert "T00:00:00" in str(row_1001["death_datetime"])


# ---------------------------------------------------------------------------
# Cause fields tests
# ---------------------------------------------------------------------------


class TestCauseFields:
    """Tests for cause_source_value and cause_source_concept_id."""

    def test_cause_source_value_preserved(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert row_1001["cause_source_value"] == "Respiratory failure"

    def test_cause_source_concept_id_snomed(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        row_1005 = result[result["person_id"] == 1005].iloc[0]
        assert row_1005["cause_source_concept_id"] == 422588002

    def test_cause_concept_id_defaults_to_zero(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert (result["cause_concept_id"] == 0).all()

    def test_missing_cause_still_included(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        """Row 4 (participant 1004, Aug/5/2019) has valid date but no cause."""
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        row_1004 = result[result["person_id"] == 1004].iloc[0]
        assert row_1004["cause_source_value"] == ""
        assert row_1004["cause_source_concept_id"] == 0


# ---------------------------------------------------------------------------
# Deduplication tests
# ---------------------------------------------------------------------------


class TestDeduplication:
    """Tests for person_id deduplication."""

    def test_duplicate_person_id_deduplicated(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert result["person_id"].is_unique

    def test_first_valid_record_kept(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        # First row for 1001 is Jan/15/2020
        assert str(row_1001["death_date"]) == "2020-01-15"

    def test_duplicate_logged_as_warning(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        build_death_records(sample_death_df, registry, log)
        dup_entries = log.filter_by_category(RejectionCategory.DUPLICATE_RECORD)
        assert len(dup_entries) >= 1

    def test_deduplication_count(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        """6 input rows -> deduplicated: 1001 dup, 1003 no date, 1004 invalid year.
        Expected unique: 1001 (first), 1004 (Aug/5/2019), 1005 -> 3 rows."""
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert len(result) == 3


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Tests for missing dates, invalid years, unresolvable IDs."""

    def test_missing_date_excluded(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        """Row 2 (participant 1003) has all-null date -- excluded."""
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert 1003 not in result["person_id"].values

    def test_missing_date_logged_as_error(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        build_death_records(sample_death_df, registry, log)
        date_errors = log.filter_by_category(RejectionCategory.DATE_ASSEMBLY_FAILED)
        assert len(date_errors) >= 1

    def test_invalid_year_excluded(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        """Row 3 (participant 1004, Jun/10/1800) has invalid year -- excluded.
        But row 4 (participant 1004, Aug/5/2019) is valid -- that one kept."""
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        row_1004 = result[result["person_id"] == 1004].iloc[0]
        # The kept record is Aug/5/2019 (row 4), not Jun/10/1800 (row 3)
        assert str(row_1004["death_date"]) == "2019-08-05"

    def test_unresolvable_id_logged_as_error(self, registry: PersonIdRegistry) -> None:
        """Person ID 9999 is not in the registry."""
        df = pd.DataFrame(
            {
                "participant_id": [9999],
                "participant_id5201": [None],
                "participant_id5211": [None],
                "DeathDateMonth": ["Jan"],
                "DeathDateDay": [1],
                "DeathDateYear": [2020],
                "CauseofDeathImmediateCauseDesc": ["Unknown"],
                "CauseofDeathImmediateCauseSNOM": [pd.NA],
            }
        )
        log = RejectionLog("death")
        result = build_death_records(df, registry, log)
        assert len(result) == 0
        missing_entries = log.filter_by_category(RejectionCategory.MISSING_REQUIRED)
        assert len(missing_entries) >= 1


# ---------------------------------------------------------------------------
# Immutability tests
# ---------------------------------------------------------------------------


class TestImmutability:
    """Tests that input DataFrame is not mutated."""

    def test_input_not_mutated(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        original = sample_death_df.copy()
        log = RejectionLog("death")
        build_death_records(sample_death_df, registry, log)
        pd.testing.assert_frame_equal(sample_death_df, original)

    def test_returns_new_dataframe(
        self, sample_death_df: pd.DataFrame, registry: PersonIdRegistry
    ) -> None:
        log = RejectionLog("death")
        result = build_death_records(sample_death_df, registry, log)
        assert result is not sample_death_df
