"""NAACCR fixed-width layout — column positions for the curated subset.

Phase 3 Plan 4A Task 3 (T-022A). Maps the NAACCR Item Names we ingest
to (start_column, length) tuples per the NAACCR Layout (v23). The
NAACCR Layout document defines column positions for all 700+ items;
we pick the subset NAACCRRecord declares.

Column positions are 0-indexed character offsets inside one line.
``length`` includes any spec-defined padding; the reader strips trailing
spaces before materializing the value.

NOTE: For v0.1 we use a compact, plausible layout that fits the curated
80-column subset. The full NAACCR Layout has 22824 columns; the diff
workflow (Task 9) tracks upstream movement so we can re-align to spec
positions once the upstream-diff lands.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class _Column:
    start: int
    length: int


# Curated layout for the v0.1 fields. Compact positions chosen so the
# fixture builder + tests produce readable lines (~150 chars).
COLUMNS: Final[dict[str, _Column]] = {
    # Patient identity ---------------------------------------------------
    "patient_id_number": _Column(0, 8),  # PAT00001
    "tumor_record_number": _Column(8, 2),  # 01
    "name_last": _Column(10, 12),
    "name_first": _Column(22, 12),
    "date_of_birth": _Column(34, 8),  # CCYYMMDD
    "sex": _Column(42, 1),
    "race_1": _Column(43, 2),
    "spanish_hispanic_origin": _Column(45, 1),
    # Tumor diagnosis ----------------------------------------------------
    "primary_site": _Column(46, 4),  # ICD-O-3 topography (e.g. C509)
    "histologic_type_icdo3": _Column(50, 4),  # ICD-O-3 morphology
    "behavior_code_icdo3": _Column(54, 1),
    "grade": _Column(55, 1),
    "date_of_diagnosis": _Column(56, 8),
    "diagnostic_confirmation": _Column(64, 1),
    # AJCC staging -------------------------------------------------------
    "ajcc_stage_group": _Column(65, 4),
    "ajcc_t": _Column(69, 4),
    "ajcc_n": _Column(73, 4),
    "ajcc_m": _Column(77, 4),
    # Treatment summary --------------------------------------------------
    "rx_summary_surgery": _Column(81, 2),
    "rx_summary_chemo": _Column(83, 2),
    "rx_summary_radiation": _Column(85, 2),
    "rx_summary_hormone": _Column(87, 2),
    # Vital status / follow-up -------------------------------------------
    "vital_status": _Column(89, 1),
    "date_of_last_contact": _Column(90, 8),
    "cause_of_death": _Column(98, 4),
}


def total_line_length() -> int:
    """The shortest line that can contain every declared column.

    Use this to right-pad fixture lines so column extraction always
    succeeds even when trailing fields are blank-filled.
    """
    return max(c.start + c.length for c in COLUMNS.values())


__all__ = ["COLUMNS", "total_line_length"]
