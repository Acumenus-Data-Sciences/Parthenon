"""Phase 3 Plan 4B Task 1 (T-022B): STS column-mapping table."""

from __future__ import annotations

import csv
from pathlib import Path

_MAP_FILE = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "manifests"
    / "registry_to_omop_sts"
    / "column_map.csv"
)


def test_column_map_exists() -> None:
    assert _MAP_FILE.is_file()


def test_column_map_has_required_columns() -> None:
    with _MAP_FILE.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = set(reader.fieldnames or [])
    expected = {
        "sts_field",
        "omop_table",
        "omop_column",
        "vocabulary_id",
        "concept_lookup_rule",
        "description",
    }
    assert expected <= cols


def test_column_map_covers_required_sts_fields() -> None:
    """v0.1 acceptance — must include the fields the model + reader use."""
    with _MAP_FILE.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    sts_fields = {r["sts_field"] for r in rows}
    for required in (
        "RecordID",
        "PatientID",
        "SurgeryDate",
        "PatientAge",
        "Gender",
        "ProcedureID",
        "PrimaryDiagnosis",
        "EjectionFraction",
        "Mortality_30Day",
    ):
        assert required in sts_fields, f"missing column-map row for {required}"


def test_column_map_uses_known_omop_vocabularies() -> None:
    """vocabulary_id must be empty (passthrough) or one of the OMOP-blessed ids."""
    with _MAP_FILE.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    allowed = {"", "SNOMED", "ICD10CM", "CPT4", "HCPCS", "RxNorm", "LOINC"}
    for r in rows:
        assert (
            r["vocabulary_id"] in allowed
        ), f"unknown vocabulary_id {r['vocabulary_id']!r} for {r['sts_field']}"
