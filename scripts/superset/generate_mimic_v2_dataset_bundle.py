#!/usr/bin/env python3
"""Generate a Superset v1 datasource bundle for the MIMIC v2 semantic layer."""

from __future__ import annotations

import csv
import shutil
import subprocess
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import yaml


HERE = Path(__file__).resolve()
REPO_ROOT = HERE.parents[2] if len(HERE.parents) > 2 else Path.cwd()
OUTPUT_ROOT = REPO_ROOT / "scripts" / "superset" / "generated" / "mimic_v2_dataset_bundle"
ZIP_PATH = REPO_ROOT / "scripts" / "superset" / "generated" / "mimic_v2_dataset_bundle.zip"

DATABASE_NAME = "Parthenon"
DATABASE_UUID = "8ee6dcf9-6db7-4b96-b4f9-de1e0d2b84b2"
# The importer only uses this file to resolve the UUID to an existing database.
DATABASE_URI_PLACEHOLDER = "postgresql://placeholder:placeholder@host.docker.internal:5432/parthenon"

ROOT_FOLDER = "mimic_v2_dataset_bundle"

COLUMN_QUERY = """
select
    c.relname as table_name,
    a.attname as column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on a.attrelid = c.oid
join pg_catalog.pg_namespace n on c.relnamespace = n.oid
where n.nspname = 'superset_mimic'
  and c.relkind = 'm'
  and a.attnum > 0
  and not a.attisdropped
order by c.relname, a.attnum
"""

DATASET_DESCRIPTIONS = {
    "icu_episode_fact": "One row per ICU stay with demographics, service, LOS, mortality, and APR-DRG enrichment.",
    "admission_readmission_fact": "One row per hospital admission with admission-order features and explicit 7-day and 30-day readmission flags.",
    "admission_diagnosis_summary": "One row per admission summarizing diagnosis burden and primary diagnosis at encounter grain.",
    "lab_daily_summary": "Daily lab aggregates by admission and ICU day for high-value lab tests.",
    "vital_daily_summary": "Daily vital-sign aggregates by stay and ICU day.",
    "micro_resistance_summary": "Organism-antibiotic resistance summary with counts and resistance percentages.",
    "infusion_category_summary": "Infusion and blood-product utilization summarized by category and ICU unit.",
    "unit_daily_census": "Daily ICU census and flow counts by ICU unit.",
    "discharge_outcome_summary": "Outcome and readmission summary by discharge destination, service, age band, and ICU unit.",
    "data_quality_summary": "Row-count, null-rate, time-range, and orphan-rate checks for the semantic layer sources.",
}

MAIN_DTTM_COLS = {
    "icu_episode_fact": "admit_time",
    "admission_readmission_fact": "admit_time",
    "lab_daily_summary": "calendar_day",
    "vital_daily_summary": "calendar_day",
    "unit_daily_census": "calendar_day",
}

TYPE_MAP = {
    "text": "STRING",
    "integer": "INTEGER",
    "bigint": "LONGINTEGER",
    "numeric": "DECIMAL",
    "double precision": "FLOAT",
    "date": "DATE",
    "timestamp without time zone": "DATETIME",
    "timestamp with time zone": "DATETIME",
    "boolean": "BOOLEAN",
}


def run_query() -> list[dict[str, str]]:
    proc = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "parthenon-postgres",
            "psql",
            "-U",
            "parthenon",
            "-d",
            "parthenon",
            "-F",
            "\t",
            "-A",
            "-P",
            "footer=off",
            "-c",
            COLUMN_QUERY,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    reader = csv.DictReader(proc.stdout.splitlines(), delimiter="\t")
    return list(reader)


def dataset_uuid(table_name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"parthenon.superset_mimic.{table_name}"))


def map_type(pg_type: str) -> str:
    return TYPE_MAP.get(pg_type, "STRING")


def is_dttm_type(pg_type: str) -> bool:
    return pg_type in {"date", "timestamp without time zone", "timestamp with time zone"}


def build_dataset(table_name: str, rows: list[dict[str, str]]) -> dict:
    columns = []
    for row in rows:
        pg_type = row["data_type"]
        columns.append(
            {
                "column_name": row["column_name"],
                "verbose_name": None,
                "is_dttm": is_dttm_type(pg_type),
                "is_active": True,
                "type": map_type(pg_type),
                "advanced_data_type": None,
                "groupby": True,
                "filterable": True,
                "expression": "",
                "description": None,
                "python_date_format": None,
                "extra": None,
            }
        )

    return {
        "table_name": table_name,
        "main_dttm_col": MAIN_DTTM_COLS.get(table_name),
        "description": DATASET_DESCRIPTIONS[table_name],
        "default_endpoint": None,
        "offset": 0,
        "cache_timeout": None,
        "catalog": None,
        "schema": "superset_mimic",
        "sql": None,
        "params": None,
        "template_params": None,
        "filter_select_enabled": True,
        "fetch_values_predicate": None,
        "extra": None,
        "normalize_columns": False,
        "always_filter_main_dttm": False,
        "folders": None,
        "uuid": dataset_uuid(table_name),
        "metrics": [
            {
                "metric_name": "count",
                "verbose_name": "COUNT(*)",
                "metric_type": "count",
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "currency": None,
                "extra": None,
                "warning_text": None,
            }
        ],
        "columns": columns,
        "version": "1.0.0",
        "database_uuid": DATABASE_UUID,
    }


def write_yaml(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=False), encoding="utf-8")


def build_bundle() -> tuple[Path, Path]:
    rows = run_query()
    grouped: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        grouped.setdefault(row["table_name"], []).append(row)

    if set(grouped) != set(DATASET_DESCRIPTIONS):
        missing = sorted(set(DATASET_DESCRIPTIONS) - set(grouped))
        extra = sorted(set(grouped) - set(DATASET_DESCRIPTIONS))
        raise SystemExit(f"Unexpected semantic-layer tables. missing={missing} extra={extra}")

    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    metadata = {
        "version": "1.0.0",
        "type": "SqlaTable",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    write_yaml(OUTPUT_ROOT / ROOT_FOLDER / "metadata.yaml", metadata)

    database_payload = {
        "database_name": DATABASE_NAME,
        "sqlalchemy_uri": DATABASE_URI_PLACEHOLDER,
        "cache_timeout": None,
        "expose_in_sqllab": True,
        "allow_run_async": True,
        "allow_ctas": False,
        "allow_cvas": False,
        "allow_dml": False,
        "allow_file_upload": False,
        "extra": {
            "allows_virtual_table_explore": True,
            "schemas_allowed_for_file_upload": [],
        },
        "impersonate_user": False,
        "uuid": DATABASE_UUID,
        "version": "1.0.0",
    }
    write_yaml(OUTPUT_ROOT / ROOT_FOLDER / "databases" / f"{DATABASE_NAME}.yaml", database_payload)

    for table_name in sorted(grouped):
        payload = build_dataset(table_name, grouped[table_name])
        write_yaml(
            OUTPUT_ROOT / ROOT_FOLDER / "datasets" / DATABASE_NAME / f"{table_name}.yaml",
            payload,
        )

    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted((OUTPUT_ROOT / ROOT_FOLDER).rglob("*")):
            if file_path.is_file():
                archive.write(file_path, file_path.relative_to(OUTPUT_ROOT))

    return OUTPUT_ROOT / ROOT_FOLDER, ZIP_PATH


def main() -> None:
    directory, zip_path = build_bundle()
    print(f"bundle_dir={directory}")
    print(f"bundle_zip={zip_path}")


if __name__ == "__main__":
    main()
