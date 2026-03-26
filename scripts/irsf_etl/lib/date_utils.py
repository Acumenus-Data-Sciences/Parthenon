"""Date utility functions for IRSF ETL.

The IRSF dataset stores dates as split columns (Month/Day/Year)
rather than single date fields. This module detects and will eventually
assemble those split-date groups.

Phase 1: Detection stub only. Full date assembly comes in Phase 2.
"""

from __future__ import annotations

import re

# Known split-date patterns from IRSF research.
# Maps a base label to the suffixes for month, day, year columns.
# The source data uses patterns like: ChildsDOBMonth, ChildsDOBDay, ChildsDOBYear
SPLIT_DATE_SUFFIXES = ("Month", "Day", "Year")

# All 6 known date groups from the IRSF source data research
KNOWN_DATE_LABELS: tuple[str, ...] = (
    "ChildsDOB",
    "DiagnosisDate",
    "DeathDate",
    "MedStartDate",
    "MedEndDate",
    "OnsetDate",
)


def detect_split_date_columns(columns: list[str]) -> dict[str, dict[str, str]]:
    """Detect split-date column groups in a list of column names.

    Scans for columns matching the pattern {Label}{Suffix} where Suffix
    is one of Month, Day, Year. A group is only reported if all three
    components (Month, Day, Year) are present.

    Args:
        columns: List of column names to scan.

    Returns:
        Dictionary mapping label -> {"month": col, "day": col, "year": col}
        for each detected complete split-date group.

    Example:
        >>> detect_split_date_columns(["ChildsDOBMonth", "ChildsDOBDay", "ChildsDOBYear", "name"])
        {"ChildsDOB": {"month": "ChildsDOBMonth", "day": "ChildsDOBDay", "year": "ChildsDOBYear"}}
    """
    col_set = set(columns)
    result: dict[str, dict[str, str]] = {}

    # Check known labels first
    for label in KNOWN_DATE_LABELS:
        month_col = f"{label}Month"
        day_col = f"{label}Day"
        year_col = f"{label}Year"

        if month_col in col_set and day_col in col_set and year_col in col_set:
            result[label] = {
                "month": month_col,
                "day": day_col,
                "year": year_col,
            }

    # Also detect unknown patterns via regex scan
    # Look for columns ending in Month and check for matching Day/Year
    month_pattern = re.compile(r"^(.+)Month$")
    for col in columns:
        match = month_pattern.match(col)
        if match:
            label = match.group(1)
            if label not in result:
                day_col = f"{label}Day"
                year_col = f"{label}Year"
                if day_col in col_set and year_col in col_set:
                    result[label] = {
                        "month": col,
                        "day": day_col,
                        "year": year_col,
                    }

    return result
