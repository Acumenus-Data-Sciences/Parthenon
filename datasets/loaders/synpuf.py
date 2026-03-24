"""Loader for CMS SynPUF datasets (1K subset and full 2.3M).

Loads pre-ETL'd OMOP CDM v5.x CSV shards from a local drive into a dedicated
``synpuf`` schema on the host PostgreSQL 17 instance, with v5.x → v5.4
adaptation (cost consolidation, datetime derivation, column mapping).
"""
from __future__ import annotations

import csv
import io
import multiprocessing as mp
import os
import re
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras

from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)
from rich.table import Table

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SYNPUF_DATA_DIR = Path(
    "/media/smudoshi/DATA/Old Backup Data/ETL-CMS/data/output"
)

SCHEMA = "synpuf"
RESULTS_SCHEMA = "synpuf_results"

# Connection parameters — reads from env or falls back to .env defaults.
DB_DSN: dict[str, Any] = {
    "host": os.environ.get("SYNPUF_DB_HOST", "pgsql.acumenus.net"),
    "port": int(os.environ.get("SYNPUF_DB_PORT", "5432")),
    "dbname": os.environ.get("SYNPUF_DB_NAME", "parthenon"),
    "user": os.environ.get("SYNPUF_DB_USER", "smudoshi"),
    "password": os.environ.get("SYNPUF_DB_PASSWORD", "acumenus"),
}

NUM_SHARDS = 20

# ---------------------------------------------------------------------------
# OMOP CDM v5.4 DDL — matches Laravel migrations exactly
# ---------------------------------------------------------------------------

DDL: dict[str, str] = {
    "location": """
        CREATE TABLE IF NOT EXISTS {schema}.location (
            location_id         BIGINT PRIMARY KEY,
            address_1           VARCHAR(50),
            address_2           VARCHAR(50),
            city                VARCHAR(50),
            state               VARCHAR(2),
            zip                 VARCHAR(9),
            county              VARCHAR(20),
            location_source_value VARCHAR(50),
            country_concept_id  INTEGER,
            latitude            NUMERIC,
            longitude           NUMERIC
        )
    """,
    "care_site": """
        CREATE TABLE IF NOT EXISTS {schema}.care_site (
            care_site_id                BIGINT PRIMARY KEY,
            care_site_name              VARCHAR(255),
            place_of_service_concept_id INTEGER,
            location_id                 BIGINT,
            care_site_source_value      VARCHAR(50),
            place_of_service_source_value VARCHAR(50)
        )
    """,
    "provider": """
        CREATE TABLE IF NOT EXISTS {schema}.provider (
            provider_id                 BIGINT PRIMARY KEY,
            provider_name               VARCHAR(255),
            npi                         VARCHAR(20),
            dea                         VARCHAR(20),
            specialty_concept_id        INTEGER,
            care_site_id                BIGINT,
            year_of_birth               INTEGER,
            gender_concept_id           INTEGER,
            provider_source_value       VARCHAR(50),
            specialty_source_value      VARCHAR(50),
            specialty_source_concept_id INTEGER DEFAULT 0,
            gender_source_value         VARCHAR(50),
            gender_source_concept_id    INTEGER DEFAULT 0
        )
    """,
    "person": """
        CREATE TABLE IF NOT EXISTS {schema}.person (
            person_id                   BIGINT PRIMARY KEY,
            gender_concept_id           INTEGER NOT NULL,
            year_of_birth               INTEGER NOT NULL,
            month_of_birth              INTEGER,
            day_of_birth                INTEGER,
            birth_datetime              TIMESTAMP,
            race_concept_id             INTEGER NOT NULL,
            ethnicity_concept_id        INTEGER NOT NULL,
            location_id                 BIGINT,
            provider_id                 BIGINT,
            care_site_id                BIGINT,
            person_source_value         VARCHAR(50),
            gender_source_value         VARCHAR(50),
            gender_source_concept_id    INTEGER DEFAULT 0,
            race_source_value           VARCHAR(50),
            race_source_concept_id      INTEGER DEFAULT 0,
            ethnicity_source_value      VARCHAR(50),
            ethnicity_source_concept_id INTEGER DEFAULT 0
        )
    """,
    "observation_period": """
        CREATE TABLE IF NOT EXISTS {schema}.observation_period (
            observation_period_id           BIGINT PRIMARY KEY,
            person_id                       BIGINT NOT NULL,
            observation_period_start_date   DATE NOT NULL,
            observation_period_end_date     DATE NOT NULL,
            period_type_concept_id          INTEGER NOT NULL
        )
    """,
    "visit_occurrence": """
        CREATE TABLE IF NOT EXISTS {schema}.visit_occurrence (
            visit_occurrence_id         BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            visit_concept_id            INTEGER NOT NULL,
            visit_start_date            DATE NOT NULL,
            visit_start_datetime        TIMESTAMP,
            visit_end_date              DATE NOT NULL,
            visit_end_datetime          TIMESTAMP,
            visit_type_concept_id       INTEGER NOT NULL,
            provider_id                 BIGINT,
            care_site_id                BIGINT,
            visit_source_value          VARCHAR(50),
            visit_source_concept_id     INTEGER DEFAULT 0,
            admitted_from_concept_id    INTEGER DEFAULT 0,
            admitted_from_source_value  VARCHAR(50),
            discharged_to_concept_id    INTEGER DEFAULT 0,
            discharged_to_source_value  VARCHAR(50),
            preceding_visit_occurrence_id BIGINT
        )
    """,
    "condition_occurrence": """
        CREATE TABLE IF NOT EXISTS {schema}.condition_occurrence (
            condition_occurrence_id     BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            condition_concept_id        INTEGER NOT NULL,
            condition_start_date        DATE NOT NULL,
            condition_start_datetime    TIMESTAMP,
            condition_end_date          DATE,
            condition_end_datetime      TIMESTAMP,
            condition_type_concept_id   INTEGER NOT NULL,
            condition_status_concept_id INTEGER DEFAULT 0,
            stop_reason                 VARCHAR(20),
            provider_id                 BIGINT,
            visit_occurrence_id         BIGINT,
            visit_detail_id             BIGINT,
            condition_source_value      VARCHAR(50),
            condition_source_concept_id INTEGER DEFAULT 0,
            condition_status_source_value VARCHAR(50)
        )
    """,
    "drug_exposure": """
        CREATE TABLE IF NOT EXISTS {schema}.drug_exposure (
            drug_exposure_id            BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            drug_concept_id             INTEGER NOT NULL,
            drug_exposure_start_date    DATE NOT NULL,
            drug_exposure_start_datetime TIMESTAMP,
            drug_exposure_end_date      DATE,
            drug_exposure_end_datetime  TIMESTAMP,
            verbatim_end_date           DATE,
            drug_type_concept_id        INTEGER NOT NULL,
            stop_reason                 VARCHAR(20),
            refills                     INTEGER,
            quantity                    NUMERIC,
            days_supply                 INTEGER,
            sig                         TEXT,
            route_concept_id            INTEGER DEFAULT 0,
            lot_number                  VARCHAR(50),
            provider_id                 BIGINT,
            visit_occurrence_id         BIGINT,
            visit_detail_id             BIGINT,
            drug_source_value           VARCHAR(50),
            drug_source_concept_id      INTEGER DEFAULT 0,
            route_source_value          VARCHAR(50),
            dose_unit_source_value      VARCHAR(50)
        )
    """,
    "procedure_occurrence": """
        CREATE TABLE IF NOT EXISTS {schema}.procedure_occurrence (
            procedure_occurrence_id     BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            procedure_concept_id        INTEGER NOT NULL,
            procedure_date              DATE NOT NULL,
            procedure_datetime          TIMESTAMP,
            procedure_end_date          DATE,
            procedure_end_datetime      TIMESTAMP,
            procedure_type_concept_id   INTEGER NOT NULL,
            modifier_concept_id         INTEGER DEFAULT 0,
            quantity                    INTEGER,
            provider_id                 BIGINT,
            visit_occurrence_id         BIGINT,
            visit_detail_id             BIGINT,
            procedure_source_value      VARCHAR(50),
            procedure_source_concept_id INTEGER DEFAULT 0,
            modifier_source_value       VARCHAR(50)
        )
    """,
    "device_exposure": """
        CREATE TABLE IF NOT EXISTS {schema}.device_exposure (
            device_exposure_id          BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            device_concept_id           INTEGER NOT NULL,
            device_exposure_start_date  DATE NOT NULL,
            device_exposure_start_datetime TIMESTAMP,
            device_exposure_end_date    DATE,
            device_exposure_end_datetime TIMESTAMP,
            device_type_concept_id      INTEGER NOT NULL,
            unique_device_id            VARCHAR(255),
            production_id               VARCHAR(255),
            quantity                    INTEGER,
            provider_id                 BIGINT,
            visit_occurrence_id         BIGINT,
            visit_detail_id             BIGINT,
            device_source_value         VARCHAR(50),
            device_source_concept_id    INTEGER DEFAULT 0,
            unit_concept_id             INTEGER DEFAULT 0,
            unit_source_value           VARCHAR(50),
            unit_source_concept_id      INTEGER DEFAULT 0
        )
    """,
    "measurement": """
        CREATE TABLE IF NOT EXISTS {schema}.measurement (
            measurement_id              BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            measurement_concept_id      INTEGER NOT NULL,
            measurement_date            DATE NOT NULL,
            measurement_datetime        TIMESTAMP,
            measurement_time            VARCHAR(10),
            measurement_type_concept_id INTEGER NOT NULL,
            operator_concept_id         INTEGER DEFAULT 0,
            value_as_number             NUMERIC,
            value_as_concept_id         INTEGER DEFAULT 0,
            unit_concept_id             INTEGER DEFAULT 0,
            range_low                   NUMERIC,
            range_high                  NUMERIC,
            provider_id                 BIGINT,
            visit_occurrence_id         BIGINT,
            visit_detail_id             BIGINT,
            measurement_source_value    VARCHAR(50),
            measurement_source_concept_id INTEGER DEFAULT 0,
            unit_source_value           VARCHAR(50),
            unit_source_concept_id      INTEGER DEFAULT 0,
            value_source_value          VARCHAR(50),
            measurement_event_id        BIGINT,
            meas_event_field_concept_id INTEGER DEFAULT 0
        )
    """,
    "observation": """
        CREATE TABLE IF NOT EXISTS {schema}.observation (
            observation_id              BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            observation_concept_id      INTEGER NOT NULL,
            observation_date            DATE NOT NULL,
            observation_datetime        TIMESTAMP,
            observation_type_concept_id INTEGER NOT NULL,
            value_as_number             NUMERIC,
            value_as_string             VARCHAR(60),
            value_as_concept_id         INTEGER DEFAULT 0,
            qualifier_concept_id        INTEGER DEFAULT 0,
            unit_concept_id             INTEGER DEFAULT 0,
            provider_id                 BIGINT,
            visit_occurrence_id         BIGINT,
            visit_detail_id             BIGINT,
            observation_source_value    VARCHAR(50),
            observation_source_concept_id INTEGER DEFAULT 0,
            unit_source_value           VARCHAR(50),
            qualifier_source_value      VARCHAR(50),
            value_source_value          VARCHAR(50),
            observation_event_id        BIGINT,
            obs_event_field_concept_id  INTEGER DEFAULT 0
        )
    """,
    "death": """
        CREATE TABLE IF NOT EXISTS {schema}.death (
            person_id                   BIGINT NOT NULL,
            death_date                  DATE NOT NULL,
            death_datetime              TIMESTAMP,
            death_type_concept_id       INTEGER NOT NULL,
            cause_concept_id            INTEGER DEFAULT 0,
            cause_source_value          VARCHAR(50),
            cause_source_concept_id     INTEGER DEFAULT 0
        )
    """,
    "payer_plan_period": """
        CREATE TABLE IF NOT EXISTS {schema}.payer_plan_period (
            payer_plan_period_id        BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            payer_plan_period_start_date DATE NOT NULL,
            payer_plan_period_end_date  DATE NOT NULL,
            payer_concept_id            INTEGER DEFAULT 0,
            payer_source_value          VARCHAR(50),
            payer_source_concept_id     INTEGER DEFAULT 0,
            plan_concept_id             INTEGER DEFAULT 0,
            plan_source_value           VARCHAR(50),
            plan_source_concept_id      INTEGER DEFAULT 0,
            sponsor_concept_id          INTEGER DEFAULT 0,
            sponsor_source_value        VARCHAR(50),
            sponsor_source_concept_id   INTEGER DEFAULT 0,
            family_source_value         VARCHAR(50),
            stop_reason_concept_id      INTEGER DEFAULT 0,
            stop_reason_source_value    VARCHAR(50),
            stop_reason_source_concept_id INTEGER DEFAULT 0
        )
    """,
    "cost": """
        CREATE TABLE IF NOT EXISTS {schema}.cost (
            cost_id                     BIGINT PRIMARY KEY,
            person_id                   BIGINT NOT NULL,
            cost_event_id               BIGINT NOT NULL,
            cost_event_field_concept_id INTEGER NOT NULL,
            cost_concept_id             INTEGER NOT NULL,
            cost_type_concept_id        INTEGER NOT NULL,
            currency_concept_id         INTEGER DEFAULT 0,
            cost                        NUMERIC,
            incurred_date               DATE NOT NULL,
            billed_date                 DATE,
            paid_date                   DATE,
            revenue_code_concept_id     INTEGER DEFAULT 0,
            drg_concept_id              INTEGER DEFAULT 0,
            cost_source_value           VARCHAR(50),
            cost_source_concept_id      INTEGER DEFAULT 0,
            revenue_code_source_value   VARCHAR(50),
            drg_source_value            VARCHAR(3)
        )
    """,
}

# Staging tables for legacy v5.x cost tables (loaded as-is, then transformed)
COST_STAGING_DDL: dict[str, str] = {
    "drug_cost_staging": """
        CREATE TABLE IF NOT EXISTS {schema}.drug_cost_staging (
            drug_cost_id                BIGINT,
            drug_exposure_id            BIGINT,
            currency_concept_id         INTEGER,
            paid_copay                  NUMERIC,
            paid_coinsurance            NUMERIC,
            paid_toward_deductible      NUMERIC,
            paid_by_payer               NUMERIC,
            paid_by_coordination_of_benefits NUMERIC,
            total_out_of_pocket         NUMERIC,
            total_paid                  NUMERIC,
            ingredient_cost             NUMERIC,
            dispensing_fee              NUMERIC,
            average_wholesale_price     NUMERIC,
            payer_plan_period_id        BIGINT
        )
    """,
    "visit_cost_staging": """
        CREATE TABLE IF NOT EXISTS {schema}.visit_cost_staging (
            visit_cost_id               BIGINT,
            visit_occurrence_id         BIGINT,
            currency_concept_id         INTEGER,
            paid_copay                  NUMERIC,
            paid_coinsurance            NUMERIC,
            paid_toward_deductible      NUMERIC,
            paid_by_payer               NUMERIC,
            paid_by_coordination_benefits NUMERIC,
            total_out_of_pocket         NUMERIC,
            total_paid                  NUMERIC,
            payer_plan_period_id        BIGINT
        )
    """,
    "procedure_cost_staging": """
        CREATE TABLE IF NOT EXISTS {schema}.procedure_cost_staging (
            procedure_cost_id           BIGINT,
            procedure_occurrence_id     BIGINT,
            currency_concept_id         INTEGER,
            paid_copay                  NUMERIC,
            paid_coinsurance            NUMERIC,
            paid_toward_deductible      NUMERIC,
            paid_by_payer               NUMERIC,
            paid_by_coordination_benefits NUMERIC,
            total_out_of_pocket         NUMERIC,
            total_paid                  NUMERIC,
            revenue_code_concept_id     INTEGER,
            payer_plan_period_id        BIGINT,
            revenue_code_source_value   VARCHAR(50)
        )
    """,
    "device_cost_staging": """
        CREATE TABLE IF NOT EXISTS {schema}.device_cost_staging (
            device_cost_id              BIGINT,
            device_exposure_id          BIGINT,
            currency_concept_id         INTEGER,
            paid_copay                  NUMERIC,
            paid_coinsurance            NUMERIC,
            paid_toward_deductible      NUMERIC,
            paid_by_payer               NUMERIC,
            paid_by_coordination_benefits NUMERIC,
            total_out_of_pocket         NUMERIC,
            total_paid                  NUMERIC,
            payer_plan_period_id        BIGINT
        )
    """,
}

# ---------------------------------------------------------------------------
# Column mapping: CSV header → v5.4 target columns
# Each entry maps csv_table_name → { csv_col: target_col } (only overrides)
# Columns not listed are passed through as-is (lowercased).
# Columns set to None are dropped.
# ---------------------------------------------------------------------------

COLUMN_MAP: dict[str, dict[str, str | None]] = {
    "person": {
        "time_of_birth": None,  # dropped in v5.4
    },
    "visit_occurrence": {
        "visit_start_time": None,  # not in v5.4
        "visit_end_time": None,    # not in v5.4
    },
    "drug_exposure": {
        "effective_drug_dose": None,    # dropped in v5.4
        "dose_unit_concept_id": None,   # dropped in v5.4
    },
    "procedure_occurrence": {
        "qualifier_source_value": "modifier_source_value",  # renamed in v5.4
    },
    "observation": {
        "observation_time": None,  # replaced by observation_datetime
    },
    "measurement": {
        "measurement_time": "measurement_time",  # keep as-is, still in v5.4
    },
}

# Tables that need date→datetime derivation after load
DATETIME_DERIVATIONS: dict[str, list[tuple[str, str]]] = {
    "person": [
        # Special: derive birth_datetime from year/month/day_of_birth
    ],
    "visit_occurrence": [
        ("visit_start_date", "visit_start_datetime"),
        ("visit_end_date", "visit_end_datetime"),
    ],
    "condition_occurrence": [
        ("condition_start_date", "condition_start_datetime"),
        ("condition_end_date", "condition_end_datetime"),
    ],
    "drug_exposure": [
        ("drug_exposure_start_date", "drug_exposure_start_datetime"),
        ("drug_exposure_end_date", "drug_exposure_end_datetime"),
    ],
    "procedure_occurrence": [
        ("procedure_date", "procedure_datetime"),
    ],
    "device_exposure": [
        ("device_exposure_start_date", "device_exposure_start_datetime"),
        ("device_exposure_end_date", "device_exposure_end_datetime"),
    ],
    "measurement": [
        ("measurement_date", "measurement_datetime"),
    ],
    "observation": [
        ("observation_date", "observation_datetime"),
    ],
    "death": [
        ("death_date", "death_datetime"),
    ],
}

# Load order: reference tables first, then person, then clinical, then cost
LOAD_ORDER: list[str] = [
    "location",
    "care_site",
    "provider",
    "person",
    "observation_period",
    "visit_occurrence",
    "condition_occurrence",
    "drug_exposure",
    "procedure_occurrence",
    "device_exposure",
    "measurement",
    "observation",
    "death",
    "payer_plan_period",
]

# Cost staging tables (loaded after clinical tables)
COST_TABLES: list[str] = [
    "drug_cost",
    "visit_cost",
    "procedure_cost",
    "device_cost",
]

# Index definitions: created AFTER all data is loaded
INDEXES: list[str] = [
    "CREATE INDEX IF NOT EXISTS idx_synpuf_person_gender ON {schema}.person (gender_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_person_race ON {schema}.person (race_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_visit_person ON {schema}.visit_occurrence (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_visit_concept ON {schema}.visit_occurrence (visit_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_visit_start ON {schema}.visit_occurrence (visit_start_date)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_cond_person ON {schema}.condition_occurrence (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_cond_concept ON {schema}.condition_occurrence (condition_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_cond_visit ON {schema}.condition_occurrence (visit_occurrence_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_drug_person ON {schema}.drug_exposure (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_drug_concept ON {schema}.drug_exposure (drug_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_drug_visit ON {schema}.drug_exposure (visit_occurrence_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_proc_person ON {schema}.procedure_occurrence (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_proc_concept ON {schema}.procedure_occurrence (procedure_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_proc_visit ON {schema}.procedure_occurrence (visit_occurrence_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_meas_person ON {schema}.measurement (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_meas_concept ON {schema}.measurement (measurement_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_obs_person ON {schema}.observation (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_obs_concept ON {schema}.observation (observation_concept_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_device_person ON {schema}.device_exposure (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_death_person ON {schema}.death (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_ppp_person ON {schema}.payer_plan_period (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_obsp_person ON {schema}.observation_period (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_cost_person ON {schema}.cost (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_synpuf_cost_event ON {schema}.cost (cost_event_id)",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@contextmanager
def _connect():
    """Yield a psycopg2 connection with autocommit for COPY performance."""
    conn = psycopg2.connect(**DB_DSN)
    conn.set_session(autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


def _table_count(conn, table: str, schema: str = SCHEMA) -> int:
    """Return row count for a table, or 0 if it doesn't exist."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) FROM {schema}.{table}"  # noqa: S608
            )
            return cur.fetchone()[0]
    except psycopg2.errors.UndefinedTable:
        conn.rollback()
        return 0
    except Exception:
        conn.rollback()
        return 0


def _normalize_date(val: str) -> str:
    """Convert YYYYMMDD → YYYY-MM-DD if needed. Pass through ISO dates."""
    if not val or val.strip() == "":
        return ""
    val = val.strip()
    if re.match(r"^\d{8}$", val):
        return f"{val[:4]}-{val[4:6]}-{val[6:8]}"
    return val


# CSV filename differs from v5.4 table name for some tables
CSV_FILENAME_MAP: dict[str, str] = {
    "measurement": "measurement_occurrence",  # v5.x name on disk
}


def _find_shard_files(table_name: str, data_dir: Path) -> list[Path]:
    """Find all shard files for a table, sorted by shard number."""
    csv_name = CSV_FILENAME_MAP.get(table_name, table_name)
    files = []
    for i in range(1, NUM_SHARDS + 1):
        f = data_dir / f"{csv_name}_{i}.csv"
        if f.exists():
            files.append(f)
    return files


def _get_csv_columns(csv_path: Path) -> list[str]:
    """Read the header row of a CSV file and return lowercase column names."""
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
    return [c.strip().lower() for c in header]


def _map_columns(
    table_name: str, csv_cols: list[str]
) -> tuple[list[str], list[int]]:
    """Apply column mapping for v5.x → v5.4 adaptation.

    Returns (target_columns, source_indices) where source_indices are the
    CSV column positions to keep (in order).
    """
    col_map = COLUMN_MAP.get(table_name, {})
    target_cols: list[str] = []
    source_indices: list[int] = []

    for i, col in enumerate(csv_cols):
        mapped = col_map.get(col, col)  # default: pass through
        if mapped is None:
            continue  # drop this column
        target_cols.append(mapped)
        source_indices.append(i)

    return target_cols, source_indices


def _has_date_columns(table_name: str) -> bool:
    """Check if any columns in this table need date format normalization."""
    return table_name in (
        "observation_period",  # known YYYYMMDD format
    )


def _copy_shard(
    csv_path: Path,
    table_name: str,
    target_table: str,
    target_cols: list[str],
    source_indices: list[int],
    limit: int | None = None,
) -> int:
    """COPY one CSV shard into PostgreSQL. Returns rows loaded.

    Runs in a subprocess (multiprocessing) so it gets its own connection.
    """
    conn = psycopg2.connect(**DB_DSN)
    conn.set_session(autocommit=True)
    try:
        col_list = ", ".join(target_cols)
        copy_sql = (
            f"COPY {SCHEMA}.{target_table} ({col_list}) "
            f"FROM STDIN WITH (FORMAT csv, HEADER false, NULL '')"
        )
        with conn.cursor() as cur:
            buf = io.StringIO()
            rows = 0
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader)  # skip header
                for row in reader:
                    if limit is not None and rows >= limit:
                        break
                    # Pick only the columns we need
                    selected = [row[i] if i < len(row) else "" for i in source_indices]
                    # Normalize dates if needed
                    if _has_date_columns(table_name):
                        selected = [
                            _normalize_date(v) if "date" in target_cols[j].lower() else v
                            for j, v in enumerate(selected)
                        ]
                    buf.write(",".join(_csv_escape(v) for v in selected) + "\n")
                    rows += 1
                    # Flush in batches to avoid memory bloat
                    if rows % 500_000 == 0:
                        buf.seek(0)
                        cur.copy_expert(
                            f"COPY {SCHEMA}.{target_table} ({col_list}) "
                            f"FROM STDIN WITH (FORMAT csv, NULL '')",
                            buf,
                        )
                        buf = io.StringIO()
                # Flush remainder
                if buf.tell() > 0:
                    buf.seek(0)
                    cur.copy_expert(
                        f"COPY {SCHEMA}.{target_table} ({col_list}) "
                        f"FROM STDIN WITH (FORMAT csv, NULL '')",
                        buf,
                    )
            return rows
    finally:
        conn.close()


def _csv_escape(val: str) -> str:
    """Escape a value for CSV COPY format."""
    if val == "" or val is None:
        return ""
    # If value contains comma, quote, or newline — wrap in quotes
    if "," in val or '"' in val or "\n" in val:
        return '"' + val.replace('"', '""') + '"'
    return val


def _copy_cost_shard(
    csv_path: Path,
    staging_table: str,
    csv_cols: list[str],
) -> int:
    """COPY one cost CSV shard into a staging table."""
    conn = psycopg2.connect(**DB_DSN)
    conn.set_session(autocommit=True)
    try:
        col_list = ", ".join(csv_cols)
        rows = 0
        with conn.cursor() as cur:
            buf = io.StringIO()
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader)  # skip header
                for row in reader:
                    buf.write(",".join(_csv_escape(v) for v in row) + "\n")
                    rows += 1
                    if rows % 500_000 == 0:
                        buf.seek(0)
                        cur.copy_expert(
                            f"COPY {SCHEMA}.{staging_table} ({col_list}) "
                            f"FROM STDIN WITH (FORMAT csv, NULL '')",
                            buf,
                        )
                        buf = io.StringIO()
                if buf.tell() > 0:
                    buf.seek(0)
                    cur.copy_expert(
                        f"COPY {SCHEMA}.{staging_table} ({col_list}) "
                        f"FROM STDIN WITH (FORMAT csv, NULL '')",
                        buf,
                    )
            return rows
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Public API — DatasetLoader protocol
# ---------------------------------------------------------------------------

def is_loaded(dataset_key: str = "synpuf-full", **kwargs: object) -> bool:
    """Check if SynPUF data is already loaded in the synpuf schema."""
    try:
        conn = psycopg2.connect(**DB_DSN)
        conn.set_session(autocommit=True)
        try:
            count = _table_count(conn, "person")
            if dataset_key == "synpuf-1k":
                return count >= 1000
            return count >= 2_000_000
        finally:
            conn.close()
    except Exception:
        return False


def load(
    *,
    console: Console,
    downloads_dir: Path,
    dataset_key: str = "synpuf-full",
    **kwargs: object,
) -> bool:
    """Load SynPUF data from pre-ETL'd CSV shards on local drive."""

    is_1k = dataset_key == "synpuf-1k"
    patient_limit = 1000 if is_1k else None
    label = "SynPUF-1K" if is_1k else "SynPUF-2.3M"

    console.print(f"\n[bold cyan]Loading {label} into schema '{SCHEMA}'[/bold cyan]")

    # ------------------------------------------------------------------
    # 0. Preflight checks
    # ------------------------------------------------------------------
    if not SYNPUF_DATA_DIR.exists():
        console.print(
            f"[red]Data directory not found: {SYNPUF_DATA_DIR}[/red]\n"
            "Mount the DATA drive and try again."
        )
        return False

    # Check that at least person_1.csv exists
    if not (SYNPUF_DATA_DIR / "person_1.csv").exists():
        console.print("[red]person_1.csv not found in data directory.[/red]")
        return False

    # Check vocabulary is loaded
    try:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM omop.concept")
                vocab_count = cur.fetchone()[0]
                if vocab_count < 100_000:
                    console.print(
                        "[red]OMOP vocabulary not loaded (omop.concept has "
                        f"{vocab_count:,} rows). Load vocabulary first.[/red]"
                    )
                    return False
                console.print(
                    f"  [green]✓[/green] Vocabulary loaded ({vocab_count:,} concepts)"
                )
    except Exception as e:
        console.print(f"[red]Cannot connect to database: {e}[/red]")
        return False

    start_time = time.time()

    # ------------------------------------------------------------------
    # 1. Create schemas
    # ------------------------------------------------------------------
    console.print("\n[bold]Step 1:[/bold] Creating schemas...")
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {RESULTS_SCHEMA}")
    console.print(f"  [green]✓[/green] Schemas {SCHEMA}, {RESULTS_SCHEMA} ready")

    # ------------------------------------------------------------------
    # 2. Create CDM v5.4 tables
    # ------------------------------------------------------------------
    console.print("\n[bold]Step 2:[/bold] Creating OMOP CDM v5.4 tables...")
    with _connect() as conn:
        with conn.cursor() as cur:
            for table_name, ddl in DDL.items():
                cur.execute(ddl.format(schema=SCHEMA))
            # Cost staging tables
            for table_name, ddl in COST_STAGING_DDL.items():
                cur.execute(ddl.format(schema=SCHEMA))
    console.print(
        f"  [green]✓[/green] {len(DDL)} CDM tables + "
        f"{len(COST_STAGING_DDL)} staging tables created"
    )

    # ------------------------------------------------------------------
    # 3. Load clinical tables
    # ------------------------------------------------------------------
    console.print(f"\n[bold]Step 3:[/bold] Loading clinical tables ({label})...")

    total_rows = 0
    table_results: dict[str, int] = {}

    # Determine parallelism: for 1K use sequential, for full use parallel
    max_workers = 1 if is_1k else min(4, mp.cpu_count())

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        for table_name in LOAD_ORDER:
            shard_files = _find_shard_files(table_name, SYNPUF_DATA_DIR)
            if not shard_files:
                console.print(
                    f"  [yellow]⚠[/yellow] No shard files for {table_name}, skipping"
                )
                continue

            # Check if already loaded
            with _connect() as conn:
                existing = _table_count(conn, table_name)
                if existing > 0:
                    console.print(
                        f"  [dim]↳ {table_name} already has {existing:,} rows, skipping[/dim]"
                    )
                    table_results[table_name] = existing
                    total_rows += existing
                    continue

            # Get column mapping from first shard
            csv_cols = _get_csv_columns(shard_files[0])
            target_cols, source_indices = _map_columns(table_name, csv_cols)

            task_id = progress.add_task(
                f"  {table_name}",
                total=len(shard_files),
            )

            table_rows = 0

            if is_1k:
                # Sequential, limited to first shard, 1000 rows for person
                # For other tables: load all rows that reference loaded persons
                shard_limit = patient_limit if table_name == "person" else None
                for shard_file in shard_files[:1]:  # first shard only
                    rows = _copy_shard(
                        shard_file,
                        table_name,
                        table_name,
                        target_cols,
                        source_indices,
                        limit=shard_limit,
                    )
                    table_rows += rows
                    progress.advance(task_id)
                # Mark remaining shards as done
                for _ in shard_files[1:]:
                    progress.advance(task_id)
            else:
                # Parallel shard loading
                if max_workers > 1 and len(shard_files) > 1:
                    with mp.Pool(max_workers) as pool:
                        results = []
                        for shard_file in shard_files:
                            r = pool.apply_async(
                                _copy_shard,
                                (
                                    shard_file,
                                    table_name,
                                    table_name,
                                    target_cols,
                                    source_indices,
                                    None,
                                ),
                            )
                            results.append(r)
                        for r in results:
                            rows = r.get()
                            table_rows += rows
                            progress.advance(task_id)
                else:
                    for shard_file in shard_files:
                        rows = _copy_shard(
                            shard_file,
                            table_name,
                            table_name,
                            target_cols,
                            source_indices,
                        )
                        table_rows += rows
                        progress.advance(task_id)

            table_results[table_name] = table_rows
            total_rows += table_rows

    console.print(
        f"\n  [green]✓[/green] Clinical tables loaded: {total_rows:,} total rows"
    )

    # ------------------------------------------------------------------
    # 4. Load cost staging tables
    # ------------------------------------------------------------------
    console.print(f"\n[bold]Step 4:[/bold] Loading cost staging tables...")

    cost_staging_rows: dict[str, int] = {}
    for cost_table in COST_TABLES:
        staging_name = f"{cost_table}_staging"
        shard_files = _find_shard_files(cost_table, SYNPUF_DATA_DIR)
        if not shard_files:
            console.print(
                f"  [yellow]⚠[/yellow] No shard files for {cost_table}, skipping"
            )
            continue

        # Check if staging already loaded
        with _connect() as conn:
            existing = _table_count(conn, staging_name)
            if existing > 0:
                console.print(
                    f"  [dim]↳ {staging_name} already has {existing:,} rows, skipping[/dim]"
                )
                cost_staging_rows[cost_table] = existing
                continue

        csv_cols = _get_csv_columns(shard_files[0])
        table_rows = 0

        if is_1k:
            for shard_file in shard_files[:1]:
                rows = _copy_cost_shard(shard_file, staging_name, csv_cols)
                table_rows += rows
        else:
            if max_workers > 1 and len(shard_files) > 1:
                with mp.Pool(max_workers) as pool:
                    results = []
                    for shard_file in shard_files:
                        r = pool.apply_async(
                            _copy_cost_shard,
                            (shard_file, staging_name, csv_cols),
                        )
                        results.append(r)
                    for r in results:
                        table_rows += r.get()
            else:
                for shard_file in shard_files:
                    rows = _copy_cost_shard(shard_file, staging_name, csv_cols)
                    table_rows += rows

        cost_staging_rows[cost_table] = table_rows
        console.print(f"  [green]✓[/green] {staging_name}: {table_rows:,} rows")

    # ------------------------------------------------------------------
    # 5. Consolidate cost tables → unified cost
    # ------------------------------------------------------------------
    console.print(f"\n[bold]Step 5:[/bold] Consolidating cost tables (v5.x → v5.4)...")

    # cost_event_field_concept_id values:
    # 1147127 = drug_exposure.drug_exposure_id
    # 1147070 = visit_occurrence.visit_occurrence_id
    # 1147082 = procedure_occurrence.procedure_occurrence_id
    # 1147115 = device_exposure.device_exposure_id
    #
    # Note: these are standard OMOP field concept IDs. If they don't exist
    # in this vocabulary, we use 0 as fallback.

    cost_inserts = [
        # drug_cost → cost
        f"""
        INSERT INTO {SCHEMA}.cost (
            cost_id, person_id, cost_event_id, cost_event_field_concept_id,
            cost_concept_id, cost_type_concept_id, currency_concept_id,
            cost, incurred_date, revenue_code_concept_id, revenue_code_source_value
        )
        SELECT
            dc.drug_cost_id,
            de.person_id,
            dc.drug_exposure_id,
            1147127,  -- drug_exposure.drug_exposure_id field concept
            0,        -- cost_concept_id
            0,        -- cost_type_concept_id
            COALESCE(dc.currency_concept_id, 0),
            dc.total_paid,
            de.drug_exposure_start_date,
            0,
            NULL
        FROM {SCHEMA}.drug_cost_staging dc
        JOIN {SCHEMA}.drug_exposure de ON dc.drug_exposure_id = de.drug_exposure_id
        """,
        # visit_cost → cost
        f"""
        INSERT INTO {SCHEMA}.cost (
            cost_id, person_id, cost_event_id, cost_event_field_concept_id,
            cost_concept_id, cost_type_concept_id, currency_concept_id,
            cost, incurred_date, revenue_code_concept_id, revenue_code_source_value
        )
        SELECT
            vc.visit_cost_id + 200000000,
            vo.person_id,
            vc.visit_occurrence_id,
            1147070,  -- visit_occurrence.visit_occurrence_id field concept
            0,
            0,
            COALESCE(vc.currency_concept_id, 0),
            vc.total_paid,
            vo.visit_start_date,
            0,
            NULL
        FROM {SCHEMA}.visit_cost_staging vc
        JOIN {SCHEMA}.visit_occurrence vo ON vc.visit_occurrence_id = vo.visit_occurrence_id
        """,
        # procedure_cost → cost
        f"""
        INSERT INTO {SCHEMA}.cost (
            cost_id, person_id, cost_event_id, cost_event_field_concept_id,
            cost_concept_id, cost_type_concept_id, currency_concept_id,
            cost, incurred_date, revenue_code_concept_id, revenue_code_source_value
        )
        SELECT
            pc.procedure_cost_id + 400000000,
            po.person_id,
            pc.procedure_occurrence_id,
            1147082,  -- procedure_occurrence.procedure_occurrence_id field concept
            0,
            0,
            COALESCE(pc.currency_concept_id, 0),
            pc.total_paid,
            po.procedure_date,
            COALESCE(pc.revenue_code_concept_id, 0),
            pc.revenue_code_source_value
        FROM {SCHEMA}.procedure_cost_staging pc
        JOIN {SCHEMA}.procedure_occurrence po
            ON pc.procedure_occurrence_id = po.procedure_occurrence_id
        """,
        # device_cost → cost
        f"""
        INSERT INTO {SCHEMA}.cost (
            cost_id, person_id, cost_event_id, cost_event_field_concept_id,
            cost_concept_id, cost_type_concept_id, currency_concept_id,
            cost, incurred_date, revenue_code_concept_id, revenue_code_source_value
        )
        SELECT
            dc.device_cost_id + 600000000,
            de.person_id,
            dc.device_exposure_id,
            1147115,  -- device_exposure.device_exposure_id field concept
            0,
            0,
            COALESCE(dc.currency_concept_id, 0),
            dc.total_paid,
            de.device_exposure_start_date,
            0,
            NULL
        FROM {SCHEMA}.device_cost_staging dc
        JOIN {SCHEMA}.device_exposure de ON dc.device_exposure_id = de.device_exposure_id
        """,
    ]

    with _connect() as conn:
        # Check if cost table already has data
        existing_cost = _table_count(conn, "cost")
        if existing_cost > 0:
            console.print(
                f"  [dim]↳ cost table already has {existing_cost:,} rows, skipping[/dim]"
            )
        else:
            with conn.cursor() as cur:
                for i, sql in enumerate(cost_inserts):
                    domain = ["Drug", "Visit", "Procedure", "Device"][i]
                    console.print(f"  Inserting {domain} costs...")
                    cur.execute(sql)
                    console.print(
                        f"  [green]✓[/green] {domain} costs: {cur.rowcount:,} rows"
                    )

            # Drop staging tables
            console.print("  Dropping staging tables...")
            with conn.cursor() as cur:
                for staging in COST_STAGING_DDL:
                    cur.execute(f"DROP TABLE IF EXISTS {SCHEMA}.{staging}")
            console.print("  [green]✓[/green] Staging tables dropped")

    # ------------------------------------------------------------------
    # 6. Derive _datetime columns
    # ------------------------------------------------------------------
    console.print(f"\n[bold]Step 6:[/bold] Deriving datetime columns...")
    with _connect() as conn:
        with conn.cursor() as cur:
            # Special: person.birth_datetime from year/month/day_of_birth
            console.print("  Deriving person.birth_datetime...")
            cur.execute(f"""
                UPDATE {SCHEMA}.person
                SET birth_datetime = make_timestamp(
                    year_of_birth,
                    COALESCE(month_of_birth, 1),
                    COALESCE(day_of_birth, 1),
                    0, 0, 0
                )
                WHERE birth_datetime IS NULL
                  AND year_of_birth IS NOT NULL
            """)
            console.print(
                f"  [green]✓[/green] person.birth_datetime: {cur.rowcount:,} rows"
            )

            # Derive date→datetime for all other tables
            for table_name, derivations in DATETIME_DERIVATIONS.items():
                if table_name == "person":
                    continue
                for date_col, dt_col in derivations:
                    console.print(f"  Deriving {table_name}.{dt_col}...")
                    cur.execute(f"""
                        UPDATE {SCHEMA}.{table_name}
                        SET {dt_col} = {date_col}::timestamp
                        WHERE {dt_col} IS NULL
                          AND {date_col} IS NOT NULL
                    """)
                    console.print(
                        f"  [green]✓[/green] {table_name}.{dt_col}: {cur.rowcount:,} rows"
                    )

    # ------------------------------------------------------------------
    # 7. Build indexes
    # ------------------------------------------------------------------
    console.print(f"\n[bold]Step 7:[/bold] Building indexes...")
    with _connect() as conn:
        with conn.cursor() as cur:
            for idx_sql in INDEXES:
                idx_name = idx_sql.split("EXISTS")[1].split("ON")[0].strip()
                console.print(f"  Creating {idx_name}...")
                cur.execute(idx_sql.format(schema=SCHEMA))
    console.print(f"  [green]✓[/green] {len(INDEXES)} indexes created")

    # ------------------------------------------------------------------
    # 8. ANALYZE
    # ------------------------------------------------------------------
    console.print(f"\n[bold]Step 8:[/bold] Running ANALYZE...")
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(f"ANALYZE {SCHEMA}.person")
            for table_name in LOAD_ORDER:
                cur.execute(f"ANALYZE {SCHEMA}.{table_name}")
            cur.execute(f"ANALYZE {SCHEMA}.cost")
    console.print("  [green]✓[/green] ANALYZE complete")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    console.print(f"\n[bold green]{'=' * 60}[/bold green]")
    console.print(f"[bold green]{label} load complete![/bold green]")
    console.print(f"  Time: {minutes}m {seconds}s")
    console.print(f"  Schema: {SCHEMA}")

    summary = Table(title="Row Counts")
    summary.add_column("Table", style="cyan")
    summary.add_column("Rows", justify="right", style="green")
    for table_name, rows in table_results.items():
        summary.add_row(table_name, f"{rows:,}")
    for cost_table, rows in cost_staging_rows.items():
        summary.add_row(f"{cost_table} → cost", f"{rows:,}")
    console.print(summary)

    console.print(
        f"\n[bold]Next step:[/bold] Register as a data source via the "
        f"frontend AddSourceWizard:"
    )
    console.print(f"  CDM schema: [cyan]{SCHEMA}[/cyan]")
    console.print(f"  Vocabulary schema: [cyan]omop[/cyan]")
    console.print(f"  Results schema: [cyan]{RESULTS_SCHEMA}[/cyan]")

    return True


# ---------------------------------------------------------------------------
# CLI entry point — run directly for testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    console = Console()
    key = sys.argv[1] if len(sys.argv) > 1 else "synpuf-full"
    success = load(
        console=console,
        downloads_dir=Path("."),
        dataset_key=key,
    )
    sys.exit(0 if success else 1)
