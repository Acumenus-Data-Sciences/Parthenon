"""Phase 3 Plan 5 Task 5 (T-023): bootstrap SQL for lis_lab_to_omop."""

from __future__ import annotations

from pathlib import Path

import pytest

_SQL_DIR = Path(__file__).resolve().parents[3] / "manifests" / "lis_lab_to_omop" / "sql"
_BOOTSTRAP_SQL = _SQL_DIR / "00_bootstrap_source_schema.sql"


def _read_sql() -> str:
    return _BOOTSTRAP_SQL.read_text(encoding="utf-8")


def test_bootstrap_sql_exists() -> None:
    assert _BOOTSTRAP_SQL.is_file()


def test_bootstrap_sql_creates_source_schema() -> None:
    assert "CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema}" in _read_sql()


def test_bootstrap_sql_creates_message_table() -> None:
    sql = _read_sql()
    assert "CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_oru_message" in sql
    assert "message_control_id    TEXT        PRIMARY KEY" in sql


@pytest.mark.parametrize(
    "column",
    [
        "sending_application",
        "sending_facility",
        "patient_id",
        "encounter_id",
        "order_control_code",
        "universal_service_id",
        "received_at",
    ],
)
def test_message_table_has_required_column(column: str) -> None:
    assert column in _read_sql()


def test_bootstrap_sql_creates_observation_table() -> None:
    sql = _read_sql()
    assert "CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_oru_observation" in sql


def test_observation_table_has_fk_to_message_with_cascade() -> None:
    sql = _read_sql()
    assert "REFERENCES ${parameters.source_schema}.fmt_oru_message (message_control_id)" in sql
    assert "ON DELETE CASCADE" in sql


def test_observation_set_id_check_constraint() -> None:
    """OruObservation set_id is ge=1 in Pydantic; mirror it as a DB CHECK."""
    assert "CHECK (set_id >= 1)" in _read_sql()


def test_observation_unique_constraint_on_message_set_id() -> None:
    """Idempotent reload: same message_control_id+set_id must not duplicate."""
    assert "UNIQUE (message_control_id, set_id)" in _read_sql()


@pytest.mark.parametrize(
    "column",
    [
        "set_id",
        "value_type",
        "observation_id",
        "observation_id_text",
        "coding_system",
        "observation_value",
        "units",
        "observation_date",
        "abnormal_flag",
    ],
)
def test_observation_table_has_required_column(column: str) -> None:
    assert column in _read_sql()


def test_indexes_for_query_paths() -> None:
    """Mapper joins fmt_oru_observation on (coding_system, observation_id) to
    vocab.concept; keep that lookup indexed."""
    sql = _read_sql()
    assert "fmt_oru_observation_local_code_idx" in sql
    assert "fmt_oru_observation_message_idx" in sql
    assert "fmt_oru_message_patient_idx" in sql


def test_no_phi_in_default_values_or_seed_rows() -> None:
    """HIGHSEC §7: bootstrap SQL must not embed any patient identifiers."""
    sql = _read_sql()
    # No INSERT statements of any kind
    assert "INSERT INTO" not in sql.upper()
