"""Phase 3 Plan 4C Task 1 (T-022C): NCDR CathPCI column-mapping table."""

from __future__ import annotations

import csv
from pathlib import Path

_MAP_FILE = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "manifests"
    / "registry_to_omop_ncdr"
    / "column_map.csv"
)


def test_column_map_exists() -> None:
    assert _MAP_FILE.is_file()


def test_column_map_has_required_columns() -> None:
    with _MAP_FILE.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = set(reader.fieldnames or [])
    expected = {
        "ncdr_field",
        "omop_table",
        "omop_column",
        "vocabulary_id",
        "concept_lookup_rule",
        "description",
    }
    assert expected <= cols


def test_column_map_covers_required_fields() -> None:
    with _MAP_FILE.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    fields = {r["ncdr_field"] for r in rows}
    for required in (
        "PCIRecordID",
        "ProcedureDate",
        "OperatorNPI",
        "PrimaryProcedureCode",
        "StentUDIs",
        "StentTypes",
        "Mortality_InHospital",
    ):
        assert required in fields, f"missing column-map row for {required}"


def test_column_map_uses_known_vocabularies() -> None:
    with _MAP_FILE.open("r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    allowed = {"", "SNOMED", "ICD10CM", "CPT4", "HCPCS", "RxNorm", "LOINC"}
    for r in rows:
        assert r["vocabulary_id"] in allowed
