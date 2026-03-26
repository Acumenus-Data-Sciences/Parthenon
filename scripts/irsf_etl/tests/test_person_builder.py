"""Tests for person_builder module -- OMOP person roster builder.

Covers: resolve_gender, parse_mm_dd_yy, parse_mm_dd_yyyy,
resolve_dob, build_person_roster.
"""

from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from scripts.irsf_etl.lib.person_builder import (
    build_person_roster,
    parse_mm_dd_yy,
    parse_mm_dd_yyyy,
    resolve_dob,
    resolve_ethnicity,
    resolve_gender,
    resolve_race,
)


# ---------------------------------------------------------------------------
# resolve_gender
# ---------------------------------------------------------------------------


class TestResolveGender:
    """Gender mapping to OMOP concept_ids."""

    def test_female(self) -> None:
        assert resolve_gender("Female") == (8532, "Female")

    def test_male(self) -> None:
        assert resolve_gender("Male") == (8507, "Male")

    def test_empty_string(self) -> None:
        assert resolve_gender("") == (0, "")

    def test_none(self) -> None:
        assert resolve_gender(None) == (0, "")

    def test_pd_na(self) -> None:
        assert resolve_gender(pd.NA) == (0, "")


# ---------------------------------------------------------------------------
# parse_mm_dd_yy
# ---------------------------------------------------------------------------


class TestParseMmDdYy:
    """2-digit year date parsing with pivot logic."""

    def test_recent_year_2011(self) -> None:
        assert parse_mm_dd_yy("06/16/11") == date(2011, 6, 16)

    def test_old_year_1966(self) -> None:
        # 66 > 25 => 1900s
        assert parse_mm_dd_yy("09/19/66") == date(1966, 9, 19)

    def test_year_1997(self) -> None:
        # 97 > 25 => 1900s
        assert parse_mm_dd_yy("02/19/97") == date(1997, 2, 19)

    def test_year_2003(self) -> None:
        # 03 <= 25 => 2000s
        assert parse_mm_dd_yy("01/04/03") == date(2003, 1, 4)

    def test_empty_string(self) -> None:
        assert parse_mm_dd_yy("") is None

    def test_none(self) -> None:
        assert parse_mm_dd_yy(None) is None

    def test_boundary_year_25(self) -> None:
        # 25 <= 25 => 2025
        assert parse_mm_dd_yy("03/01/25") == date(2025, 3, 1)

    def test_boundary_year_26(self) -> None:
        # 26 > 25 => 1926
        assert parse_mm_dd_yy("03/01/26") == date(1926, 3, 1)


# ---------------------------------------------------------------------------
# parse_mm_dd_yyyy
# ---------------------------------------------------------------------------


class TestParseMmDdYyyy:
    """4-digit year date parsing."""

    def test_1997(self) -> None:
        assert parse_mm_dd_yyyy("02/19/1997") == date(1997, 2, 19)

    def test_1966(self) -> None:
        assert parse_mm_dd_yyyy("09/19/1966") == date(1966, 9, 19)

    def test_empty_string(self) -> None:
        assert parse_mm_dd_yyyy("") is None

    def test_none(self) -> None:
        assert parse_mm_dd_yyyy(None) is None

    def test_invalid_format(self) -> None:
        assert parse_mm_dd_yyyy("not-a-date") is None


# ---------------------------------------------------------------------------
# resolve_dob
# ---------------------------------------------------------------------------


class TestResolveDob:
    """DOB resolution with 3-source priority."""

    def test_priority_1_demographics_5211(self) -> None:
        """Demographics_5211 split columns take priority."""
        person_row = pd.Series({
            "ChildsDOB": "06/16/11",
            "DOB5201": "06/16/2011",
        })
        demo_row = pd.Series({
            "DateofBirthMonth": "Jun",
            "DateofBirthDay": 16,
            "DateofBirthYear": 2011,
        })
        result = resolve_dob(person_row, demo_row)
        assert result == (2011, 6, 16)

    def test_priority_2_dob5201(self) -> None:
        """Falls back to DOB5201 (MM/DD/YYYY) when no Demographics_5211."""
        person_row = pd.Series({
            "ChildsDOB": "06/16/11",
            "DOB5201": "06/16/2011",
        })
        result = resolve_dob(person_row, None)
        assert result == (2011, 6, 16)

    def test_priority_3_childs_dob(self) -> None:
        """Falls back to ChildsDOB (MM/DD/YY) as last resort."""
        person_row = pd.Series({
            "ChildsDOB": "09/19/66",
            "DOB5201": "",
        })
        result = resolve_dob(person_row, None)
        assert result == (1966, 9, 19)

    def test_all_empty(self) -> None:
        """Returns (None, None, None) when all DOB sources are empty."""
        person_row = pd.Series({
            "ChildsDOB": "",
            "DOB5201": "",
        })
        result = resolve_dob(person_row, None)
        assert result == (None, None, None)

    def test_demo_row_empty_columns(self) -> None:
        """Demographics_5211 row with empty columns falls back."""
        person_row = pd.Series({
            "ChildsDOB": "01/04/03",
            "DOB5201": "",
        })
        demo_row = pd.Series({
            "DateofBirthMonth": "",
            "DateofBirthDay": None,
            "DateofBirthYear": None,
        })
        result = resolve_dob(person_row, demo_row)
        assert result == (2003, 1, 4)


# ---------------------------------------------------------------------------
# build_person_roster
# ---------------------------------------------------------------------------


class TestBuildPersonRoster:
    """Full person roster builder tests."""

    @pytest.fixture()
    def sample_person_chars(self) -> pd.DataFrame:
        """5-row DataFrame mimicking Person_Characteristics."""
        return pd.DataFrame({
            "participant_id": [1001, 1002, 1003, 1004, 1005],
            "participant_id5201": [1001, 1002, None, 1004, 1005],
            "participant_id5211": [1001, None, 1003, 1004, None],
            "ChildsDOB": ["06/16/11", "09/19/66", "02/19/97", "", "01/04/03"],
            "ChildsGender": ["Female", "Male", "Female", "", "Female"],
            "DOB5201": ["06/16/2011", "", "02/19/1997", "", "01/04/2003"],
        })

    @pytest.fixture()
    def sample_demographics(self) -> pd.DataFrame:
        """3-row Demographics_5211 for join with race/ethnicity columns."""
        return pd.DataFrame({
            "participant_id": [1001, 1003, 1004],
            "DateofBirthMonth": ["Jun", "Feb", ""],
            "DateofBirthDay": [16, 19, None],
            "DateofBirthYear": [2011, 1997, None],
            "Gender": ["Female", "Female", ""],
            # Race boolean columns
            "Race_White": ["1", pd.NA, "1"],
            "Race_BlackorAfricanAmerican": [pd.NA, pd.NA, pd.NA],
            "Race_Asian": [pd.NA, "1", "1"],
            "Race_AmericanIndianorAlaskaNat": [pd.NA, pd.NA, pd.NA],
            "Race_NativeHawaiianorOtherPaci": [pd.NA, pd.NA, pd.NA],
            "Race_Other": [pd.NA, pd.NA, pd.NA],
            "Race_Refused": [pd.NA, pd.NA, pd.NA],
            "Race_Unknown": [pd.NA, pd.NA, pd.NA],
            "Race_Unknownornotreported": [pd.NA, pd.NA, pd.NA],
            # Ethnicity
            "Ethnicity": [
                "Hispanic, Latino, or Spanish origin",
                "Not Hispanic, Latino, or Spanish origin",
                "Refused",
            ],
        })

    @pytest.fixture()
    def registry(self, sample_person_chars: pd.DataFrame) -> object:
        """PersonIdRegistry built from sample data."""
        from scripts.irsf_etl.lib.id_registry import PersonIdRegistry

        return PersonIdRegistry.from_dataframe(sample_person_chars)

    @pytest.fixture()
    def rejection_log(self) -> object:
        """Fresh RejectionLog for person table."""
        from scripts.irsf_etl.lib.rejection_log import RejectionLog

        return RejectionLog("person")

    def test_returns_dataframe_with_omop_columns(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        expected_cols = {
            "person_id",
            "gender_concept_id",
            "year_of_birth",
            "month_of_birth",
            "day_of_birth",
            "birth_datetime",
            "race_concept_id",
            "ethnicity_concept_id",
            "location_id",
            "provider_id",
            "care_site_id",
            "person_source_value",
            "gender_source_value",
            "gender_source_concept_id",
            "race_source_value",
            "race_source_concept_id",
            "ethnicity_source_value",
            "ethnicity_source_concept_id",
        }
        assert expected_cols.issubset(set(result.columns))

    def test_person_id_equals_participant_id(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        assert list(result["person_id"]) == [1001, 1002, 1003, 1004, 1005]

    def test_no_duplicate_person_ids(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        assert result["person_id"].is_unique

    def test_gender_concept_id_mapping(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        genders = dict(zip(result["person_id"], result["gender_concept_id"]))
        assert genders[1001] == 8532  # Female
        assert genders[1002] == 8507  # Male
        assert genders[1004] == 0  # empty

    def test_dob_populated(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert row_1001["year_of_birth"] == 2011
        assert row_1001["month_of_birth"] == 6
        assert row_1001["day_of_birth"] == 16

    def test_birth_datetime_iso(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert row_1001["birth_datetime"] == "2011-06-16T00:00:00"

    def test_person_source_value(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        assert list(result["person_source_value"]) == [
            "1001", "1002", "1003", "1004", "1005",
        ]

    def test_gender_source_value_preserved(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        sources = dict(zip(result["person_id"], result["gender_source_value"]))
        assert sources[1001] == "Female"
        assert sources[1002] == "Male"
        assert sources[1004] == ""

    def test_missing_dob_logged_as_warning(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """Person 1004 has no DOB from any source -- should be warned."""
        build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        assert rejection_log.has_warnings

    def test_immutability(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """Input DataFrames must not be mutated."""
        orig_person = sample_person_chars.copy()
        orig_demo = sample_demographics.copy()
        build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        pd.testing.assert_frame_equal(sample_person_chars, orig_person)
        pd.testing.assert_frame_equal(sample_demographics, orig_demo)

    def test_race_concept_id_populated_from_demographics(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """race_concept_id populated from Demographics_5211 join."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        races = dict(zip(result["person_id"], result["race_concept_id"]))
        # 1001 has Race_White=1 only -> 8527
        assert races[1001] == 8527
        # 1003 has Race_Asian=1 only -> 8515
        assert races[1003] == 8515

    def test_ethnicity_concept_id_populated_from_demographics(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """ethnicity_concept_id populated from Demographics_5211 join."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        eth = dict(zip(result["person_id"], result["ethnicity_concept_id"]))
        # 1001 Hispanic -> 38003563
        assert eth[1001] == 38003563
        # 1003 Non-Hispanic -> 38003564
        assert eth[1003] == 38003564

    def test_5201_only_patients_race_zero(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """Patients with no Demographics_5211 match get race_concept_id=0."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        races = dict(zip(result["person_id"], result["race_concept_id"]))
        # 1002 and 1005 have no Demographics_5211 row
        assert races[1002] == 0
        assert races[1005] == 0

    def test_5201_only_patients_ethnicity_zero(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """Patients with no Demographics_5211 match get ethnicity_concept_id=0."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        eth = dict(zip(result["person_id"], result["ethnicity_concept_id"]))
        assert eth[1002] == 0
        assert eth[1005] == 0

    def test_race_source_value_comma_separated_multi_race(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """Multi-race patients have comma-separated race_source_value."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        sv = dict(zip(result["person_id"], result["race_source_value"]))
        # 1004 has Race_White=1 and Race_Asian=1 -> multi-race
        assert "White" in sv[1004]
        assert "Asian" in sv[1004]
        assert "," in sv[1004]

    def test_ethnicity_source_value_preserved(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """ethnicity_source_value preserves original text."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        sv = dict(zip(result["person_id"], result["ethnicity_source_value"]))
        assert sv[1001] == "Hispanic, Latino, or Spanish origin"
        assert sv[1003] == "Not Hispanic, Latino, or Spanish origin"

    def test_none_demographics_race_ethnicity_zero(
        self,
        sample_person_chars: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """build_person_roster with demographics=None gives 0 race/ethnicity."""
        result = build_person_roster(
            sample_person_chars, None, registry, rejection_log
        )
        assert len(result) == 5
        assert (result["race_concept_id"] == 0).all()
        assert (result["ethnicity_concept_id"] == 0).all()
        # Should fall back to DOB5201 or ChildsDOB
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert row_1001["year_of_birth"] == 2011


# ---------------------------------------------------------------------------
# resolve_race
# ---------------------------------------------------------------------------


def _race_row(**kwargs: str) -> pd.Series:
    """Build a pd.Series with all race boolean columns.

    Pass column_name="1" for set columns; unmentioned columns get pd.NA.
    """
    all_cols = [
        "Race_White",
        "Race_BlackorAfricanAmerican",
        "Race_Asian",
        "Race_AmericanIndianorAlaskaNat",
        "Race_NativeHawaiianorOtherPaci",
        "Race_Other",
        "Race_Refused",
        "Race_Unknown",
        "Race_Unknownornotreported",
    ]
    data = {col: kwargs.get(col, pd.NA) for col in all_cols}
    return pd.Series(data)


class TestResolveRace:
    """Race boolean mapping to OMOP concept_ids."""

    def test_white_only(self) -> None:
        assert resolve_race(_race_row(Race_White="1")) == (8527, "White")

    def test_black_only(self) -> None:
        assert resolve_race(_race_row(Race_BlackorAfricanAmerican="1")) == (
            8516,
            "Black or African American",
        )

    def test_asian_only(self) -> None:
        assert resolve_race(_race_row(Race_Asian="1")) == (8515, "Asian")

    def test_american_indian_only(self) -> None:
        assert resolve_race(_race_row(Race_AmericanIndianorAlaskaNat="1")) == (
            8657,
            "American Indian or Alaska Native",
        )

    def test_native_hawaiian_only(self) -> None:
        assert resolve_race(_race_row(Race_NativeHawaiianorOtherPaci="1")) == (
            8557,
            "Native Hawaiian or Other Pacific Islander",
        )

    def test_multi_race_white_asian(self) -> None:
        row = _race_row(Race_White="1", Race_Asian="1")
        cid, sv = resolve_race(row)
        assert cid == 0
        assert "White" in sv
        assert "Asian" in sv

    def test_refused(self) -> None:
        assert resolve_race(_race_row(Race_Refused="1")) == (0, "Refused")

    def test_unknown(self) -> None:
        assert resolve_race(_race_row(Race_Unknown="1")) == (0, "Unknown")

    def test_unknown_or_not_reported(self) -> None:
        assert resolve_race(_race_row(Race_Unknownornotreported="1")) == (
            0,
            "Unknown or not reported",
        )

    def test_no_race_set(self) -> None:
        assert resolve_race(_race_row()) == (0, "Unknown")

    def test_other(self) -> None:
        assert resolve_race(_race_row(Race_Other="1")) == (0, "Other")

    def test_pd_na_treated_as_not_set(self) -> None:
        """pd.NA values in boolean columns are treated as not set."""
        row = pd.Series({
            "Race_White": pd.NA,
            "Race_BlackorAfricanAmerican": pd.NA,
            "Race_Asian": pd.NA,
            "Race_AmericanIndianorAlaskaNat": pd.NA,
            "Race_NativeHawaiianorOtherPaci": pd.NA,
            "Race_Other": pd.NA,
            "Race_Refused": pd.NA,
            "Race_Unknown": pd.NA,
            "Race_Unknownornotreported": pd.NA,
        })
        assert resolve_race(row) == (0, "Unknown")


# ---------------------------------------------------------------------------
# resolve_ethnicity
# ---------------------------------------------------------------------------


class TestResolveEthnicity:
    """Ethnicity text mapping to OMOP concept_ids."""

    def test_hispanic(self) -> None:
        assert resolve_ethnicity("Hispanic, Latino, or Spanish origin") == (
            38003563,
            "Hispanic, Latino, or Spanish origin",
        )

    def test_not_hispanic(self) -> None:
        assert resolve_ethnicity("Not Hispanic, Latino, or Spanish origin") == (
            38003564,
            "Not Hispanic, Latino, or Spanish origin",
        )

    def test_refused(self) -> None:
        assert resolve_ethnicity("Refused") == (0, "Refused")

    def test_unknown_or_not_reported(self) -> None:
        assert resolve_ethnicity("Unknown or not reported") == (
            0,
            "Unknown or not reported",
        )

    def test_empty_string(self) -> None:
        assert resolve_ethnicity("") == (0, "")

    def test_none(self) -> None:
        assert resolve_ethnicity(None) == (0, "")

    def test_pd_na(self) -> None:
        assert resolve_ethnicity(pd.NA) == (0, "")
