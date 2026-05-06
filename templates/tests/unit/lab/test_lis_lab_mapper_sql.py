"""Phase 3 Plan 5 Tasks 6 + 7 (T-023): MEASUREMENT mapper + unmapped queue."""

from __future__ import annotations

from pathlib import Path

import pytest

_SQL_DIR = Path(__file__).resolve().parents[3] / "manifests" / "lis_lab_to_omop" / "sql"


def _read(name: str) -> str:
    return (_SQL_DIR / name).read_text(encoding="utf-8")


# ---------- Task 6: MEASUREMENT mapper ----------


def test_mapper_sql_exists() -> None:
    assert (_SQL_DIR / "02_map_measurement.sql").is_file()


def test_mapper_inserts_into_cdm_measurement() -> None:
    sql = _read("02_map_measurement.sql")
    assert "INSERT INTO ${parameters.cdm_schema}.measurement" in sql


def test_mapper_uses_loinc_vocabulary() -> None:
    sql = _read("02_map_measurement.sql")
    assert "vocabulary_id = 'LOINC'" in sql
    assert "o.coding_system IN ('LN', 'LOINC')" in sql


def test_mapper_falls_back_to_zero_concept_id() -> None:
    """Local-coded labs must not be silently dropped — concept_id=0 + queue."""
    sql = _read("02_map_measurement.sql")
    assert "COALESCE(c_std.concept_id, 0)" in sql


def test_mapper_uses_lab_result_type_concept() -> None:
    """OMOP ``measurement_type_concept_id = 32856`` for HL7 v2 lab results."""
    sql = _read("02_map_measurement.sql")
    assert "32856" in sql


def test_mapper_extracts_numeric_value_for_nm_obx() -> None:
    """Numeric OBX (value_type='NM') populates value_as_number."""
    sql = _read("02_map_measurement.sql")
    assert "value_as_number" in sql
    assert "o.value_type = 'NM'" in sql


def test_mapper_resolves_via_concept_relationship_maps_to() -> None:
    """Standard concept resolution: source LOINC -> 'Maps to' -> standard."""
    sql = _read("02_map_measurement.sql")
    assert "relationship_id = 'Maps to'" in sql
    assert "c_std.standard_concept = 'S'" in sql


def test_mapper_uses_person_id_hashtext_stub() -> None:
    """Same person_id derivation as Plan 4A/B/C registries until source-to-person ships."""
    sql = _read("02_map_measurement.sql")
    assert "abs(hashtext(m.patient_id))::BIGINT" in sql


def test_mapper_is_idempotent_via_not_exists() -> None:
    sql = _read("02_map_measurement.sql")
    assert "WHERE NOT EXISTS" in sql


# ---------- Task 7: unmapped_local_lab_code queue ----------


def test_queue_sql_exists() -> None:
    assert (_SQL_DIR / "03_queue_unmapped_local_codes.sql").is_file()


def test_queue_creates_table_in_source_schema() -> None:
    sql = _read("03_queue_unmapped_local_codes.sql")
    assert "${parameters.source_schema}.unmapped_local_lab_code" in sql
    # Best-effort decision: queue lives in source_schema, not app_schema.
    assert "${parameters.app_schema}" not in sql


@pytest.mark.parametrize(
    "column",
    [
        "local_code",
        "local_code_text",
        "coding_system",
        "sending_facility",
        "observation_count",
        "first_seen_at",
        "last_seen_at",
    ],
)
def test_queue_table_has_required_column(column: str) -> None:
    assert column in _read("03_queue_unmapped_local_codes.sql")


def test_queue_unique_constraint() -> None:
    """Per-(facility, local_code, coding_system) aggregate counts."""
    sql = _read("03_queue_unmapped_local_codes.sql")
    assert "UNIQUE (local_code, coding_system, sending_facility)" in sql


def test_queue_aggregates_via_count_min_max() -> None:
    sql = _read("03_queue_unmapped_local_codes.sql")
    assert "COUNT(*)" in sql
    assert "MIN(o.observation_date)" in sql
    assert "MAX(o.observation_date)" in sql


def test_queue_is_idempotent_via_on_conflict_update() -> None:
    sql = _read("03_queue_unmapped_local_codes.sql")
    assert "ON CONFLICT (local_code, coding_system, sending_facility) DO UPDATE" in sql
    assert "GREATEST(" in sql


def test_queue_only_inserts_unresolved_codes() -> None:
    """Anything that resolved to a standard LOINC concept must NOT enter the queue."""
    sql = _read("03_queue_unmapped_local_codes.sql")
    assert "WHERE c_std.concept_id IS NULL" in sql


# ---------- Task 5b: load stub ----------


def test_load_oru_stub_exists() -> None:
    assert (_SQL_DIR / "01_load_oru.sql").is_file()


def test_load_oru_is_a_noop() -> None:
    """The Python reader does the heavy lifting; SQL load is a placeholder."""
    sql = _read("01_load_oru.sql")
    assert "SELECT 1" in sql
    assert "INSERT INTO" not in sql.upper()
