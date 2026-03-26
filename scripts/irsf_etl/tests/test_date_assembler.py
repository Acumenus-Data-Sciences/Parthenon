"""Tests for the date_assembler module.

Covers month_text_to_number, assemble_date, and assemble_dates_from_columns
with all edge cases from the IRSF split-date format.
"""

from __future__ import annotations

import math
from datetime import date

import pandas as pd
import pytest

from scripts.irsf_etl.lib.date_assembler import (
    assemble_date,
    assemble_dates_from_columns,
    month_text_to_number,
)


# ---------------------------------------------------------------------------
# month_text_to_number
# ---------------------------------------------------------------------------


class TestMonthTextToNumber:
    """Tests for month abbreviation to number conversion."""

    @pytest.mark.parametrize(
        ("abbr", "expected"),
        [
            ("Jan", 1),
            ("Feb", 2),
            ("Mar", 3),
            ("Apr", 4),
            ("May", 5),
            ("Jun", 6),
            ("Jul", 7),
            ("Aug", 8),
            ("Sep", 9),
            ("Oct", 10),
            ("Nov", 11),
            ("Dec", 12),
        ],
    )
    def test_all_months(self, abbr: str, expected: int) -> None:
        assert month_text_to_number(abbr) == expected

    def test_case_insensitive_lower(self) -> None:
        assert month_text_to_number("jan") == 1

    def test_case_insensitive_upper(self) -> None:
        assert month_text_to_number("JAN") == 1

    def test_case_insensitive_mixed(self) -> None:
        assert month_text_to_number("jAn") == 1

    def test_invalid_text(self) -> None:
        assert month_text_to_number("Invalid") is None

    def test_none(self) -> None:
        assert month_text_to_number(None) is None

    def test_empty_string(self) -> None:
        assert month_text_to_number("") is None

    def test_numeric_string(self) -> None:
        assert month_text_to_number("12") is None


# ---------------------------------------------------------------------------
# assemble_date
# ---------------------------------------------------------------------------


class TestAssembleDate:
    """Tests for date assembly from split components."""

    def test_all_null(self) -> None:
        assert assemble_date(None, None, None) is None

    def test_year_only(self) -> None:
        assert assemble_date(None, None, 2006) == date(2006, 1, 1)

    def test_year_and_month_no_day(self) -> None:
        assert assemble_date("Apr", None, 2006) == date(2006, 4, 1)

    def test_all_provided_valid(self) -> None:
        assert assemble_date("Jan", 15, 2006) == date(2006, 1, 15)

    def test_day_less_than_one_clamped(self) -> None:
        assert assemble_date("Jan", 0, 2006) == date(2006, 1, 1)

    def test_day_greater_than_31_clamped(self) -> None:
        assert assemble_date("Jan", 32, 2006) == date(2006, 1, 1)

    def test_day_is_year_value_clamped(self) -> None:
        """Day column contains a year-like value (common IRSF data issue)."""
        assert assemble_date("Jan", 2006, 2006) == date(2006, 1, 1)

    def test_feb_30_clamped_to_28(self) -> None:
        assert assemble_date("Feb", 30, 2006) == date(2006, 2, 28)

    def test_feb_29_leap_year_valid(self) -> None:
        assert assemble_date("Feb", 29, 2004) == date(2004, 2, 29)

    def test_feb_29_non_leap_year_clamped(self) -> None:
        assert assemble_date("Feb", 29, 2006) == date(2006, 2, 28)

    def test_year_too_small_single_digit(self) -> None:
        assert assemble_date("Jan", 15, 8) is None

    def test_year_too_large(self) -> None:
        assert assemble_date("Jan", 15, 22005) is None

    def test_year_below_default_min(self) -> None:
        assert assemble_date("Jan", 15, 1899) is None

    def test_year_above_default_max(self) -> None:
        assert assemble_date("Jan", 15, 2026) is None

    def test_year_at_boundary_min(self) -> None:
        assert assemble_date("Jan", 1, 1900) == date(1900, 1, 1)

    def test_year_at_boundary_max(self) -> None:
        assert assemble_date("Dec", 31, 2025) == date(2025, 12, 31)

    def test_custom_year_range(self) -> None:
        result = assemble_date("Jan", 1, 2030, min_year=2000, max_year=2040)
        assert result == date(2030, 1, 1)

    def test_float_day(self) -> None:
        assert assemble_date("Jan", 15.0, 2006) == date(2006, 1, 15)

    def test_float_year(self) -> None:
        assert assemble_date("Jan", 15, 2006.0) == date(2006, 1, 15)

    def test_nan_day(self) -> None:
        assert assemble_date("Jan", float("nan"), 2006) == date(2006, 1, 1)

    def test_nan_year(self) -> None:
        assert assemble_date("Jan", 15, float("nan")) is None

    def test_pd_na_day(self) -> None:
        assert assemble_date("Jan", pd.NA, 2006) == date(2006, 1, 1)

    def test_pd_na_month(self) -> None:
        assert assemble_date(pd.NA, None, 2006) == date(2006, 1, 1)

    def test_pd_na_year(self) -> None:
        assert assemble_date("Jan", 15, pd.NA) is None

    def test_invalid_month_with_valid_year(self) -> None:
        """Invalid month text but valid year should use year-only path."""
        assert assemble_date("xyz", None, 2006) == date(2006, 1, 1)


# ---------------------------------------------------------------------------
# assemble_dates_from_columns
# ---------------------------------------------------------------------------


class TestAssembleDatesFromColumns:
    """Tests for DataFrame-level date assembly."""

    def test_adds_assembled_date_column(
        self, medications_with_dates: pd.DataFrame
    ) -> None:
        result = assemble_dates_from_columns(
            medications_with_dates,
            month_col="MedStartDateMonth",
            day_col="MedStartDateDay",
            year_col="MedStartDateYear",
        )
        assert "assembled_date" in result.columns

    def test_mixed_valid_invalid(
        self, medications_with_dates: pd.DataFrame
    ) -> None:
        result = assemble_dates_from_columns(
            medications_with_dates,
            month_col="MedStartDateMonth",
            day_col="MedStartDateDay",
            year_col="MedStartDateYear",
        )
        # Row 0: Jan/15/2006 -> valid date
        assert result.iloc[0]["assembled_date"] == date(2006, 1, 15)
        # Row 1: Apr/None/2008 -> date(2008, 4, 1)
        assert result.iloc[1]["assembled_date"] == date(2008, 4, 1)
        # Row 2: None/None/None -> None
        assert result.iloc[2]["assembled_date"] is None

    def test_preserves_original_columns(
        self, medications_with_dates: pd.DataFrame
    ) -> None:
        original_cols = list(medications_with_dates.columns)
        result = assemble_dates_from_columns(
            medications_with_dates,
            month_col="MedStartDateMonth",
            day_col="MedStartDateDay",
            year_col="MedStartDateYear",
        )
        # Original DataFrame untouched
        assert list(medications_with_dates.columns) == original_cols
        assert "assembled_date" not in medications_with_dates.columns

    def test_custom_output_column_name(
        self, medications_with_dates: pd.DataFrame
    ) -> None:
        result = assemble_dates_from_columns(
            medications_with_dates,
            month_col="MedStartDateMonth",
            day_col="MedStartDateDay",
            year_col="MedStartDateYear",
            output_col="med_start_date",
        )
        assert "med_start_date" in result.columns

    def test_missing_column_raises_value_error(self) -> None:
        df = pd.DataFrame({"a": [1], "b": [2]})
        with pytest.raises(ValueError, match="Missing required column"):
            assemble_dates_from_columns(df, "month", "day", "year")
