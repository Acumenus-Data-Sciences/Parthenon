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
    resolve_gender,
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
        """3-row Demographics_5211 for join."""
        return pd.DataFrame({
            "participant_id": [1001, 1003, 1004],
            "DateofBirthMonth": ["Jun", "Feb", ""],
            "DateofBirthDay": [16, 19, None],
            "DateofBirthYear": [2011, 1997, None],
            "Gender": ["Female", "Female", ""],
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

    def test_race_ethnicity_placeholders(
        self,
        sample_person_chars: pd.DataFrame,
        sample_demographics: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """Race/ethnicity are 0 placeholders (Plan 04-02 fills them)."""
        result = build_person_roster(
            sample_person_chars, sample_demographics, registry, rejection_log
        )
        assert (result["race_concept_id"] == 0).all()
        assert (result["ethnicity_concept_id"] == 0).all()
        assert (result["race_source_value"] == "").all()
        assert (result["ethnicity_source_value"] == "").all()

    def test_none_demographics(
        self,
        sample_person_chars: pd.DataFrame,
        registry: object,
        rejection_log: object,
    ) -> None:
        """build_person_roster works when demographics is None."""
        result = build_person_roster(
            sample_person_chars, None, registry, rejection_log
        )
        assert len(result) == 5
        # Should fall back to DOB5201 or ChildsDOB
        row_1001 = result[result["person_id"] == 1001].iloc[0]
        assert row_1001["year_of_birth"] == 2011
