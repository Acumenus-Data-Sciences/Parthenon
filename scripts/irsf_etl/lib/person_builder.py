"""OMOP person roster builder for the IRSF ETL pipeline.

Transforms Person_Characteristics_5201_5211.csv (with optional Demographics_5211
join) into an OMOP CDM person staging DataFrame.

Exports:
    resolve_gender: Map ChildsGender text to OMOP gender_concept_id.
    parse_mm_dd_yy: Parse MM/DD/YY dates with 2-digit year pivot.
    parse_mm_dd_yyyy: Parse MM/DD/YYYY dates.
    resolve_dob: 3-source DOB resolution (Demographics_5211 > DOB5201 > ChildsDOB).
    build_person_roster: Full person roster builder returning OMOP DataFrame.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import pandas as pd

from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GENDER_MAP: dict[str, int] = {
    "Female": 8532,
    "Male": 8507,
}

_DATE_PATTERN = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$")

# 2-digit year pivot: 00-25 -> 2000-2025, 26-99 -> 1926-1999
_PIVOT_YEAR = 25


# ---------------------------------------------------------------------------
# Gender resolution
# ---------------------------------------------------------------------------


def resolve_gender(value: str | None) -> tuple[int, str]:
    """Map a gender string to (OMOP concept_id, source_value).

    Args:
        value: ChildsGender text ("Female", "Male", "", None, or pd.NA).

    Returns:
        Tuple of (concept_id, source_value). Unknown/missing -> (0, "").
    """
    if value is None or (isinstance(value, type(pd.NA)) and value is pd.NA):
        return (0, "")
    if not isinstance(value, str):
        return (0, "")
    if value == "":
        return (0, "")
    concept_id = GENDER_MAP.get(value, 0)
    return (concept_id, value)


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def parse_mm_dd_yy(value: str | None) -> date | None:
    """Parse a date in MM/DD/YY format with 2-digit year pivot.

    Pivot rule: years 00-25 -> 2000-2025, years 26-99 -> 1926-1999.

    Args:
        value: Date string like "06/16/11" or None.

    Returns:
        datetime.date or None for empty/None/invalid.
    """
    if value is None or not isinstance(value, str) or not value.strip():
        return None
    match = _DATE_PATTERN.match(value.strip())
    if match is None:
        return None
    month = int(match.group(1))
    day = int(match.group(2))
    year_raw = int(match.group(3))

    # 4-digit year passed in -- delegate
    if year_raw >= 100:
        return _safe_date(year_raw, month, day)

    # 2-digit pivot
    if year_raw <= _PIVOT_YEAR:
        year = 2000 + year_raw
    else:
        year = 1900 + year_raw

    return _safe_date(year, month, day)


def parse_mm_dd_yyyy(value: str | None) -> date | None:
    """Parse a date in MM/DD/YYYY format (4-digit year).

    Args:
        value: Date string like "02/19/1997" or None.

    Returns:
        datetime.date or None for empty/None/invalid.
    """
    if value is None or not isinstance(value, str) or not value.strip():
        return None
    match = _DATE_PATTERN.match(value.strip())
    if match is None:
        return None
    month = int(match.group(1))
    day = int(match.group(2))
    year = int(match.group(3))
    if year < 100:
        return None  # Reject 2-digit years in this parser
    return _safe_date(year, month, day)


def _safe_date(year: int, month: int, day: int) -> date | None:
    """Create a date, returning None on ValueError."""
    try:
        return date(year, month, day)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# DOB resolution (3-source priority)
# ---------------------------------------------------------------------------


def resolve_dob(
    person_row: pd.Series,
    demo_row: pd.Series | None,
) -> tuple[int | None, int | None, int | None]:
    """Resolve date of birth from up to 3 sources.

    Priority:
        1. Demographics_5211 split columns (DateofBirthMonth/Day/Year)
           via date_assembler.assemble_date.
        2. DOB5201 from Person_Characteristics (MM/DD/YYYY).
        3. ChildsDOB from Person_Characteristics (MM/DD/YY).

    Args:
        person_row: A row from Person_Characteristics DataFrame.
        demo_row: Matching row from Demographics_5211 (or None).

    Returns:
        Tuple of (year, month, day) -- any may be None if unresolved.
    """
    # Priority 1: Demographics_5211 split columns
    if demo_row is not None:
        month_text = _get_str(demo_row, "DateofBirthMonth")
        day_val = demo_row.get("DateofBirthDay")
        year_val = demo_row.get("DateofBirthYear")
        assembled = assemble_date(month_text, day_val, year_val)
        if assembled is not None:
            return (assembled.year, assembled.month, assembled.day)

    # Priority 2: DOB5201 (MM/DD/YYYY)
    dob5201 = _get_str(person_row, "DOB5201")
    if dob5201:
        parsed = parse_mm_dd_yyyy(dob5201)
        if parsed is not None:
            return (parsed.year, parsed.month, parsed.day)

    # Priority 3: ChildsDOB (MM/DD/YY)
    childs_dob = _get_str(person_row, "ChildsDOB")
    if childs_dob:
        parsed = parse_mm_dd_yy(childs_dob)
        if parsed is not None:
            return (parsed.year, parsed.month, parsed.day)

    return (None, None, None)


# ---------------------------------------------------------------------------
# Main roster builder
# ---------------------------------------------------------------------------


def build_person_roster(
    person_chars: pd.DataFrame,
    demographics: pd.DataFrame | None,
    registry: PersonIdRegistry,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Build OMOP person staging DataFrame from IRSF source data.

    Args:
        person_chars: Person_Characteristics DataFrame.
        demographics: Demographics_5211 DataFrame (or None).
        registry: PersonIdRegistry for person_id resolution.
        rejection_log: RejectionLog for tracking warnings/errors.

    Returns:
        New DataFrame with 18 OMOP person columns. Input DataFrames
        are NOT mutated.
    """
    # Work on copies to guarantee immutability
    pc = person_chars.copy()

    # Build demographics lookup by participant_id
    demo_lookup: dict[int, pd.Series] = {}
    if demographics is not None:
        demo = demographics.copy()
        for _, row in demo.iterrows():
            pid = _to_int(row.get("participant_id"))
            if pid is not None:
                demo_lookup[pid] = row

    rows: list[dict] = []
    for idx, row in pc.iterrows():
        participant_id = _to_int(row["participant_id"])
        if participant_id is None:
            continue

        person_id = registry.resolve(participant_id)
        if person_id is None:
            person_id = participant_id  # fallback: identity

        # Gender
        gender_text = _get_str(row, "ChildsGender")
        gender_concept_id, gender_source_value = resolve_gender(gender_text)

        # DOB
        demo_row = demo_lookup.get(participant_id)
        year, month, day = resolve_dob(row, demo_row)

        # Log missing DOB as warning (patient still included)
        if year is None:
            rejection_log.log(
                record_index=int(idx),
                column="DOB",
                value="",
                category=RejectionCategory.CUSTOM,
                message=f"No DOB found for participant_id={participant_id} from any source",
            )

        # birth_datetime ISO string
        birth_datetime: Optional[str] = None
        if year is not None and month is not None and day is not None:
            birth_datetime = datetime(year, month, day).isoformat()

        rows.append({
            "person_id": person_id,
            "gender_concept_id": gender_concept_id,
            "year_of_birth": year,
            "month_of_birth": month,
            "day_of_birth": day,
            "birth_datetime": birth_datetime,
            "race_concept_id": 0,
            "ethnicity_concept_id": 0,
            "location_id": None,
            "provider_id": None,
            "care_site_id": None,
            "person_source_value": str(participant_id),
            "gender_source_value": gender_source_value,
            "gender_source_concept_id": 0,
            "race_source_value": "",
            "race_source_concept_id": 0,
            "ethnicity_source_value": "",
            "ethnicity_source_concept_id": 0,
        })

    rejection_log.set_processed_count(len(pc))

    logger.info("Built person roster: %d rows", len(rows))
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_str(row: pd.Series, col: str) -> str:
    """Safely get a string value from a Series, handling NA/None."""
    val = row.get(col)
    if val is None or (isinstance(val, type(pd.NA)) and val is pd.NA):
        return ""
    if isinstance(val, float) and pd.isna(val):
        return ""
    return str(val).strip()


def _to_int(value: object) -> int | None:
    """Convert a value to int, returning None for NA/NaN/empty."""
    if value is None or (isinstance(value, type(pd.NA)) and value is pd.NA):
        return None
    if isinstance(value, float):
        if pd.isna(value):
            return None
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return None
        return int(float(stripped))
    return int(value)
