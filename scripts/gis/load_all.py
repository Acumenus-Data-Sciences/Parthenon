#!/usr/bin/env python3
"""Orchestrate all GIS data loading steps.

Runs steps in order with validation gates between each step.
Generates geography_summary pre-aggregated table at the end.

Usage:
    python scripts/gis/load_all.py              # Run all steps (expects data in GIS/data/)
    python scripts/gis/load_all.py --fetch       # Download data first, then load
    python scripts/gis/load_all.py --step 3a     # Run only a specific step
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import psycopg2

SCRIPTS_DIR = Path(__file__).resolve().parent
DB_DSN = "host=localhost port=5432 dbname=ohdsi user=smudoshi password=acumenus options='-c search_path=gis,public,app,topology'"


def emit(event: str, **kwargs):
    print(json.dumps({"event": event, **kwargs}), flush=True)


def run_step(script_name: str, step_label: str):
    """Run an ETL script, streaming its output."""
    emit("step_start", step=step_label, script=script_name)
    script = SCRIPTS_DIR / script_name
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=False,
        text=True,
    )
    if result.returncode != 0:
        emit("step_failed", step=step_label, returncode=result.returncode)
        sys.exit(1)
    emit("step_done", step=step_label)


def verify_postgis():
    """Step 0: Verify PostGIS is available."""
    emit("step_start", step="0_postgis_check")
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT PostGIS_Version()")
            version = cur.fetchone()[0]
            emit("postgis_version", version=version)
    except Exception as e:
        emit("error", message=f"PostGIS not available: {e}")
        print("\nPostGIS is required. Install with:")
        print("  sudo apt install postgresql-17-postgis-3")
        print("  psql -c 'CREATE EXTENSION postgis;' ohdsi")
        sys.exit(1)
    finally:
        conn.close()
    emit("step_done", step="0_postgis_check")


def run_schema():
    """Step 0.5: Create schema if not exists."""
    emit("step_start", step="0.5_schema")
    schema_sql = SCRIPTS_DIR / "create_schema.sql"
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "smudoshi", "-d", "ohdsi", "-f", str(schema_sql)],
        capture_output=True,
        text=True,
        env={**__import__("os").environ, "PGPASSWORD": "acumenus"},
    )
    if result.returncode != 0:
        emit("error", message=f"Schema creation failed: {result.stderr}")
        sys.exit(1)
    emit("step_done", step="0.5_schema")


def build_summary():
    """Final step: Build geography_summary pre-aggregated table."""
    emit("step_start", step="summary")
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gis.geography_summary")
            cur.execute("""
                INSERT INTO gis.geography_summary
                  (geographic_location_id, exposure_type, patient_count, avg_value, min_value, max_value)
                SELECT
                  ee.geographic_location_id,
                  ee.exposure_type,
                  COUNT(DISTINCT ee.person_id),
                  AVG(ee.value_as_number),
                  MIN(ee.value_as_number),
                  MAX(ee.value_as_number)
                FROM gis.external_exposure ee
                WHERE ee.geographic_location_id IS NOT NULL
                GROUP BY ee.geographic_location_id, ee.exposure_type
            """)
            cur.execute("SELECT COUNT(*) FROM gis.geography_summary")
            count = cur.fetchone()[0]
        conn.commit()
        emit("summary_built", rows=count)
    finally:
        conn.close()
    emit("step_done", step="summary")


def validate():
    """Run validation checks."""
    emit("step_start", step="validation")
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            checks = {}
            cur.execute("SELECT location_type, COUNT(*) FROM gis.geographic_location GROUP BY location_type")
            checks["geographic_location"] = dict(cur.fetchall())

            cur.execute("SELECT COUNT(*) FROM gis.location_geography")
            checks["crosswalk_rows"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM gis.patient_geography")
            checks["patient_geography_rows"] = cur.fetchone()[0]

            cur.execute("SELECT exposure_type, COUNT(*) FROM gis.external_exposure GROUP BY exposure_type ORDER BY exposure_type")
            checks["external_exposure"] = dict(cur.fetchall())

            cur.execute("SELECT COUNT(*) FROM gis.gis_hospital")
            checks["hospitals"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM gis.geography_summary")
            checks["summary_rows"] = cur.fetchone()[0]

        emit("validation_report", **checks)
    finally:
        conn.close()
    emit("step_done", step="validation")


STEPS = {
    "0": ("PostGIS check", verify_postgis),
    "0.5": ("Schema creation", run_schema),
    "1": ("Geography (tracts/counties)", lambda: run_step("load_geography.py", "1_geography")),
    "2": ("ZIP-Tract crosswalk", lambda: run_step("load_crosswalk.py", "2_crosswalk")),
    "3a": ("CDC SVI data", lambda: run_step("load_svi.py", "3a_svi")),
    "3b": ("USDA RUCC data", lambda: run_step("load_rucc.py", "3b_rucc")),
    "3c": ("EPA Air Quality data", lambda: run_step("load_air_quality.py", "3c_air_quality")),
    "3d": ("CMS Hospital data", lambda: run_step("load_hospitals.py", "3d_hospitals")),
    "4": ("Summary aggregation", build_summary),
    "5": ("Validation", validate),
}


def main():
    parser = argparse.ArgumentParser(description="Run all GIS ETL steps")
    parser.add_argument("--fetch", action="store_true", help="Download data before loading")
    parser.add_argument("--step", type=str, help="Run only this step")
    args = parser.parse_args()

    if args.fetch:
        emit("fetching_data")
        subprocess.run([sys.executable, str(SCRIPTS_DIR / "fetch_data.py"), "--fetch"], check=True)

    if args.step:
        if args.step not in STEPS:
            print(f"Unknown step: {args.step}. Valid: {list(STEPS.keys())}")
            sys.exit(1)
        label, fn = STEPS[args.step]
        emit("running_single_step", step=args.step, label=label)
        fn()
    else:
        emit("start_all", steps=len(STEPS))
        for step_key, (label, fn) in STEPS.items():
            emit("running_step", step=step_key, label=label)
            fn()
        emit("all_complete")


if __name__ == "__main__":
    main()
