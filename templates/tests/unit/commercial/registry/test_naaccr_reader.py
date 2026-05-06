"""Phase 3 Plan 4A Task 3 (T-022A): NAACCRReader fixed-width flat-file parser.

NAACCR data is fixed-width: each line is exactly 22824 characters (NAACCR
v23 layout) with each Item occupying a known column range. The reader
extracts the curated 80-column subset declared by NAACCRRecord by
column position and materializes a typed record per line.

For v0.1 we use a compact fixture line shape (~150 chars) covering only
the columns we read — full 22824-char NAACCR Layout test fixtures are
out of scope. The reader works against either shape because it only
seeks the columns it needs.
"""

from __future__ import annotations

import io
from datetime import date

import pytest

from runtime.commercial.registry.naaccr.reader import NAACCRReader, NAACCRReadError


def _build_minimal_line() -> str:
    """Build one fixed-width NAACCR line covering the columns we read.

    Uses the column positions defined in
    ``runtime.commercial.registry.naaccr.layout.COLUMNS``.
    """
    # Build by writing each field at its declared column.
    from runtime.commercial.registry.naaccr.layout import COLUMNS

    line = [" "] * 200  # generous padding
    fields: dict[str, str] = {
        "patient_id_number": "PAT0001",
        "tumor_record_number": "01",
        "name_last": "DOE",
        "name_first": "JANE",
        "date_of_birth": "19550315",  # CCYYMMDD
        "sex": "2",
        "race_1": "01",
        "spanish_hispanic_origin": "0",
        "primary_site": "C509",
        "histologic_type_icdo3": "8500",
        "behavior_code_icdo3": "3",
        "grade": "2",
        "date_of_diagnosis": "20240301",
        "diagnostic_confirmation": "1",
        "ajcc_stage_group": "IIA",
        "ajcc_t": "T2",
        "ajcc_n": "N0",
        "ajcc_m": "M0",
        "rx_summary_surgery": "30",
        "rx_summary_chemo": "02",
        "rx_summary_radiation": "20",
        "rx_summary_hormone": "01",
        "vital_status": "1",
        "date_of_last_contact": "20250301",
        "cause_of_death": "    ",
    }
    for name, value in fields.items():
        col = COLUMNS[name]
        end = col.start + col.length
        # Left-justify in a fixed-width slot, padded with spaces.
        line[col.start : end] = list(value.ljust(col.length))
    return "".join(line).rstrip() + "\n"


def test_reader_parses_one_record() -> None:
    line = _build_minimal_line()
    records = NAACCRReader().read(io.StringIO(line))
    assert len(records) == 1
    rec = records[0]
    assert rec.patient_id_number == "PAT0001"
    assert rec.tumor_record_number == 1
    assert rec.primary_site == "C509"
    assert rec.histologic_type_icdo3 == "8500"
    assert rec.behavior_code_icdo3 == "3"
    assert rec.date_of_diagnosis == date(2024, 3, 1)
    assert rec.date_of_birth == date(1955, 3, 15)
    assert rec.ajcc_stage_group == "IIA"
    assert rec.rx_summary_surgery == "30"


def test_reader_handles_multiple_lines() -> None:
    lines = "".join([_build_minimal_line() for _ in range(3)])
    records = NAACCRReader().read(io.StringIO(lines))
    assert len(records) == 3


def test_reader_skips_blank_lines() -> None:
    line = _build_minimal_line()
    payload = line + "\n" + "\n" + line
    records = NAACCRReader().read(io.StringIO(payload))
    assert len(records) == 2


def test_reader_treats_missing_optional_fields_as_none() -> None:
    """Treatment + outcome columns are optional in v0.1."""
    from runtime.commercial.registry.naaccr.layout import COLUMNS

    line = [" "] * 200
    required: dict[str, str] = {
        "patient_id_number": "PAT0002",
        "tumor_record_number": "01",
        "name_last": "SMITH",
        "name_first": "JOHN",
        "date_of_birth": "19600101",
        "sex": "1",
        "race_1": "02",
        "spanish_hispanic_origin": "0",
        "primary_site": "C619",
        "histologic_type_icdo3": "8140",
        "behavior_code_icdo3": "3",
        "date_of_diagnosis": "20240515",
        "diagnostic_confirmation": "1",
    }
    for name, value in required.items():
        col = COLUMNS[name]
        line[col.start : col.start + col.length] = list(value.ljust(col.length))
    payload = "".join(line) + "\n"
    records = NAACCRReader().read(io.StringIO(payload))
    assert len(records) == 1
    rec = records[0]
    assert rec.rx_summary_chemo is None
    assert rec.vital_status is None


def test_reader_raises_on_malformed_line() -> None:
    """A line missing the required date_of_diagnosis must raise."""
    payload = "X" * 50 + "\n"  # too short to have any required field populated
    with pytest.raises(NAACCRReadError):
        NAACCRReader().read(io.StringIO(payload))


def test_reader_raises_on_invalid_date() -> None:
    from runtime.commercial.registry.naaccr.layout import COLUMNS

    line = [" "] * 200
    bad: dict[str, str] = {
        "patient_id_number": "PAT0003",
        "tumor_record_number": "01",
        "name_last": "X",
        "name_first": "X",
        "date_of_birth": "BADBADBA",  # not CCYYMMDD
        "sex": "1",
        "race_1": "01",
        "spanish_hispanic_origin": "0",
        "primary_site": "C509",
        "histologic_type_icdo3": "8500",
        "behavior_code_icdo3": "3",
        "date_of_diagnosis": "20240301",
        "diagnostic_confirmation": "1",
    }
    for name, value in bad.items():
        col = COLUMNS[name]
        line[col.start : col.start + col.length] = list(value.ljust(col.length))
    payload = "".join(line) + "\n"
    with pytest.raises(NAACCRReadError):
        NAACCRReader().read(io.StringIO(payload))
