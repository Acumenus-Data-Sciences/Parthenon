"""OMOP death record builder for the IRSF ETL pipeline.

Transforms DeathRecord_5211.csv into an OMOP CDM death staging DataFrame.
Only the 5211 file is loaded -- research confirms it is a strict superset
of 5201 (92 vs 71 rows, all 71 present in 5211).

Exports:
    DEATH_TYPE_CONCEPT_ID: Constant 32879 (Registry).
    DEATH_COLUMNS: List of OMOP death table column names.
    build_death_records: Main builder function.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pandas as pd

from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEATH_TYPE_CONCEPT_ID: int = 32879  # Registry

DEATH_COLUMNS: list[str] = [
    "person_id",
    "death_date",
    "death_datetime",
    "death_type_concept_id",
    "cause_concept_id",
    "cause_source_value",
    "cause_source_concept_id",
]


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


def _parse_snomed_code(value: Any) -> int:
    """Parse a SNOMED code to int, returning 0 for non-numeric/empty values."""
    if value is None or (isinstance(value, type(pd.NA)) and value is pd.NA):
        return 0
    if isinstance(value, float):
        if pd.isna(value):
            return 0
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped == "":
            return 0
        try:
            return int(float(stripped))
        except (ValueError, OverflowError):
            return 0
    return 0


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


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------


def build_death_records(
    death_df: pd.DataFrame,
    registry: PersonIdRegistry,
    rejection_log: RejectionLog,
) -> pd.DataFrame:
    """Build OMOP death staging DataFrame from DeathRecord_5211 data.

    For each row:
        1. Resolve person_id from participant_id via registry.
        2. Assemble death_date from DeathDateMonth/Day/Year.
        3. Extract cause fields from CauseofDeathImmediateCause* columns.
        4. Deduplicate by person_id (first valid record kept).

    Args:
        death_df: Raw DeathRecord_5211 DataFrame (loaded via csv_utils).
        registry: PersonIdRegistry for person_id resolution.
        rejection_log: RejectionLog for tracking errors/warnings.

    Returns:
        New DataFrame with OMOP death columns. Input is NOT mutated.
    """
    df = death_df.copy()
    rejection_log.set_processed_count(len(df))

    # Phase 1: Build candidate records, skipping invalid rows
    candidates: list[dict[str, Any]] = []
    seen_person_ids: dict[int, int] = {}  # person_id -> index of first valid record

    for idx, row in df.iterrows():
        row_idx = int(idx)

        # Resolve person_id
        participant_id = _to_int(row.get("participant_id"))
        if participant_id is None:
            rejection_log.log(
                record_index=row_idx,
                column="participant_id",
                value="",
                category=RejectionCategory.MISSING_REQUIRED,
                message="participant_id is null",
            )
            continue

        person_id = registry.resolve(participant_id)
        if person_id is None:
            rejection_log.log(
                record_index=row_idx,
                column="participant_id",
                value=str(participant_id),
                category=RejectionCategory.MISSING_REQUIRED,
                message=f"Unresolvable participant_id={participant_id} in registry",
            )
            continue

        # Assemble death_date from split columns
        month_text = _get_str(row, "DeathDateMonth")
        day_val = row.get("DeathDateDay")
        year_val = row.get("DeathDateYear")

        death_date = assemble_date(
            month_text if month_text else None,
            day_val,
            year_val,
        )

        if death_date is None:
            rejection_log.log(
                record_index=row_idx,
                column="DeathDate",
                value=f"{month_text}/{day_val}/{year_val}",
                category=RejectionCategory.DATE_ASSEMBLY_FAILED,
                message=f"Cannot assemble death date for person_id={person_id}",
            )
            continue

        # death_datetime at midnight ISO
        death_datetime = datetime(
            death_date.year, death_date.month, death_date.day
        ).isoformat()

        # Cause fields
        cause_source_value = _get_str(row, "CauseofDeathImmediateCauseDesc")
        cause_source_concept_id = _parse_snomed_code(
            row.get("CauseofDeathImmediateCauseSNOM")
        )

        # Deduplication check
        if person_id in seen_person_ids:
            rejection_log.log(
                record_index=row_idx,
                column="person_id",
                value=str(person_id),
                category=RejectionCategory.DUPLICATE_RECORD,
                message=f"Duplicate person_id={person_id}, keeping first record",
            )
            continue

        seen_person_ids[person_id] = len(candidates)
        candidates.append({
            "person_id": person_id,
            "death_date": str(death_date),
            "death_datetime": death_datetime,
            "death_type_concept_id": DEATH_TYPE_CONCEPT_ID,
            "cause_concept_id": 0,
            "cause_source_value": cause_source_value,
            "cause_source_concept_id": cause_source_concept_id,
        })

    if not candidates:
        logger.info("No valid death records produced")
        return pd.DataFrame(columns=DEATH_COLUMNS)

    result = pd.DataFrame(candidates, columns=DEATH_COLUMNS)
    logger.info("Built death records: %d rows (from %d input)", len(result), len(df))
    return result
