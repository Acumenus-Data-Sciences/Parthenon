"""Date assembly from split columns for the IRSF ETL pipeline.

The IRSF dataset stores dates across three separate columns (Month/Day/Year)
with month as a 3-letter text abbreviation (e.g., "Jan", "Apr"). This module
ports the date assembly logic from Final_Queries.sql (lines 43-70) to Python,
adding improvements for day clamping beyond month boundaries and NaN handling.

Exports:
    month_text_to_number: Convert 3-letter month abbreviation to integer 1-12.
    assemble_date: Assemble a date from split month/day/year components.
    assemble_dates_from_columns: Apply assemble_date across DataFrame columns.
"""

from __future__ import annotations

import math
from calendar import monthrange
from datetime import date
from typing import Any

import pandas as pd

# Frozen lookup for month abbreviation -> number.
# Using a plain dict (not calendar.month_abbr) to avoid locale sensitivity.
_MONTH_LOOKUP: dict[str, int] = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def _safe_int(value: Any) -> int | None:
    """Convert a value to int, returning None for non-numeric inputs.

    Handles None, pd.NA, float('nan'), empty strings, and float values
    that represent integers (e.g., 15.0 -> 15).
    """
    if value is None:
        return None
    if isinstance(value, pd._libs.missing.NAType):
        return None
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        if not value.strip():
            return None
        try:
            return int(float(value))
        except (ValueError, OverflowError):
            return None
    return None


def month_text_to_number(month: str | None) -> int | None:
    """Convert a 3-letter month abbreviation to its integer (1-12).

    Case-insensitive. Returns None for None, empty string, or unrecognized text.

    Args:
        month: Month abbreviation (e.g., "Jan", "apr", "DEC") or None.

    Returns:
        Integer 1-12, or None if not a recognized month abbreviation.
    """
    if month is None or isinstance(month, pd._libs.missing.NAType):
        return None
    if not isinstance(month, str) or not month.strip():
        return None
    return _MONTH_LOOKUP.get(month.strip().lower())


def assemble_date(
    month: str | None,
    day: int | float | None,
    year: int | float | None,
    *,
    min_year: int = 1900,
    max_year: int = 2025,
) -> date | None:
    """Assemble a date from split month/day/year components.

    Ports the Final_Queries.sql date logic with these cases:
        1. All null -> None
        2. Year only -> date(year, 1, 1)
        3. Year + month (no day) -> date(year, month, 1)
        4. All provided -> validate and clamp day

    Day clamping rules:
        - day < 1 or day > 31 -> clamp to 1
        - day > last day of month -> clamp to last valid day (e.g., Feb 30 -> Feb 28)

    Args:
        month: 3-letter abbreviation (e.g., "Jan") or None.
        day: Day of month as int/float or None.
        year: 4-digit year as int/float or None.
        min_year: Minimum acceptable year (inclusive). Default 1900.
        max_year: Maximum acceptable year (inclusive). Default 2025.

    Returns:
        datetime.date or None if input is all-null or year is out of range.
    """
    year_int = _safe_int(year)
    day_int = _safe_int(day)
    month_num = month_text_to_number(month)

    # Case 1: all null
    if year_int is None and month_num is None and day_int is None:
        return None

    # Year is required for all other cases
    if year_int is None:
        return None

    # Validate year range
    if year_int < min_year or year_int > max_year:
        return None

    # Case 2: year only (month and day both null)
    if month_num is None and day_int is None:
        return date(year_int, 1, 1)

    # Case 3: year + month, no day
    if month_num is not None and day_int is None:
        return date(year_int, month_num, 1)

    # If we have a day but no valid month, treat as year-only
    if month_num is None:
        return date(year_int, 1, 1)

    # Case 4: all provided -- validate and clamp day
    if day_int < 1 or day_int > 31:
        day_int = 1

    # Clamp to last day of the actual month (handles Feb 30, etc.)
    _, last_day = monthrange(year_int, month_num)
    if day_int > last_day:
        day_int = last_day

    return date(year_int, month_num, day_int)


def assemble_dates_from_columns(
    df: pd.DataFrame,
    month_col: str,
    day_col: str,
    year_col: str,
    output_col: str = "assembled_date",
) -> pd.DataFrame:
    """Apply assemble_date row-wise across DataFrame split-date columns.

    Returns a NEW DataFrame with the output column added. The input
    DataFrame is NOT mutated (immutability).

    Args:
        df: Input DataFrame containing the split-date columns.
        month_col: Name of the month column.
        day_col: Name of the day column.
        year_col: Name of the year column.
        output_col: Name for the assembled date column. Default "assembled_date".

    Returns:
        New DataFrame with output_col added.

    Raises:
        ValueError: If any of the required columns are missing from the DataFrame.
    """
    missing = [c for c in (month_col, day_col, year_col) if c not in df.columns]
    if missing:
        msg = f"Missing required column(s): {', '.join(missing)}"
        raise ValueError(msg)

    result = df.copy()
    result[output_col] = result.apply(
        lambda row: assemble_date(row[month_col], row[day_col], row[year_col]),
        axis=1,
    )
    return result
