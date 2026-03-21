#!/usr/bin/env python3
"""
AtlanticHealth Data Synthesis Pipeline

Selects the 3,250 richest patients from the atlantic_health schema, prunes
the rest, copies MIMIC-IV dictionary tables, and synthesizes missing tables
(procedures_icd, microbiologyevents, inputevents, outputevents) using
pattern-based generation from MIMIC-IV distributions.

Usage:
    python scripts/synthesize_atlantic_health.py              # full run
    python scripts/synthesize_atlantic_health.py --dry-run    # report only
    python scripts/synthesize_atlantic_health.py --force      # re-run
    python scripts/synthesize_atlantic_health.py --phase 1    # single phase
"""

import argparse
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Deterministic seed for reproducibility
np.random.seed(42)

ATLANTIC = "atlantic_health"
MIMIC = "mimiciv"
TARGET_PATIENTS = 3250


def parse_args():
    p = argparse.ArgumentParser(description="AtlanticHealth Data Synthesis")
    p.add_argument("--dry-run", action="store_true", help="Report what would happen, no writes")
    p.add_argument("--force", action="store_true", help="Re-run even if already synthesized")
    p.add_argument("--phase", type=int, help="Run only this phase (1-8)")
    p.add_argument("--dsn", help="PostgreSQL DSN (overrides .env)")
    return p.parse_args()


def load_dsn_from_env():
    """Read DB credentials from backend/.env"""
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if not env_path.exists():
        print(f"ERROR: {env_path} not found")
        sys.exit(1)

    env = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Z_]+)=(.*)$", line)
        if m:
            env[m.group(1)] = m.group(2).strip('"').strip("'")

    return (
        f"host={env.get('DB_HOST', 'localhost')} "
        f"port={env.get('DB_PORT', '5432')} "
        f"dbname={env.get('DB_DATABASE', 'parthenon')} "
        f"user={env.get('DB_USERNAME', 'parthenon')} "
        f"password={env.get('DB_PASSWORD', '')}"
    )


def connect(dsn: str):
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    return conn


def check_already_run(conn) -> bool:
    """Check if synthesis has already been run."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = %s AND table_name = '_synthesis_metadata')",
            (ATLANTIC,),
        )
        return cur.fetchone()[0]


def log(phase: int, msg: str):
    print(f"[Phase {phase}] {msg}")


# ─── Phase 0: Validation ─────────────────────────────────────────────────────


def phase_0_validate(conn):
    """Validate both schemas exist and have expected tables."""
    with conn.cursor() as cur:
        for schema in (ATLANTIC, MIMIC):
            cur.execute(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = %s",
                (schema,),
            )
            count = cur.fetchone()[0]
            if count == 0:
                print(f"ERROR: Schema '{schema}' has no tables")
                sys.exit(1)
            log(0, f"Schema '{schema}': {count} tables")

        # Verify MIMIC reference tables
        for table in ("procedures_icd", "microbiologyevents", "inputevents", "outputevents",
                       "d_icd_diagnoses", "d_icd_procedures", "d_items"):
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (MIMIC, table),
            )
            if not cur.fetchone()[0]:
                print(f"ERROR: MIMIC table '{table}' not found")
                sys.exit(1)
        log(0, "All MIMIC reference tables present")


# ─── Phase 1: Patient Selection & Pruning ────────────────────────────────────


def phase_1_select_and_prune(conn, dry_run=False):
    """Select top 3,250 patients by clinical completeness, prune the rest."""
    with conn.cursor() as cur:
        # Step 1: Find patients meeting clinical completeness floor
        log(1, "Scoring patients by clinical completeness...")
        cur.execute(f"""
            WITH patient_scores AS (
                SELECT p.subject_id,
                    (SELECT count(*) FROM {ATLANTIC}.admissions WHERE subject_id = p.subject_id) as adm,
                    (SELECT count(*) FROM {ATLANTIC}.labevents WHERE subject_id = p.subject_id) as labs,
                    (SELECT count(*) FROM {ATLANTIC}.chartevents WHERE subject_id = p.subject_id) as vitals,
                    (SELECT count(*) FROM {ATLANTIC}.prescriptions WHERE subject_id = p.subject_id) as rx,
                    (SELECT count(*) FROM {ATLANTIC}.diagnoses_icd WHERE subject_id = p.subject_id) as dx,
                    (SELECT count(*) FROM {ATLANTIC}.icustays WHERE subject_id = p.subject_id) as icu,
                    (SELECT count(*) FROM {ATLANTIC}.transfers WHERE subject_id = p.subject_id) as xfer,
                    (SELECT count(*) FROM {ATLANTIC}.services WHERE subject_id = p.subject_id) as svc
                FROM {ATLANTIC}.patients p
            )
            SELECT subject_id,
                   (adm + labs + vitals + rx + dx + icu + xfer + svc) as total_events
            FROM patient_scores
            WHERE adm >= 1 AND labs >= 10 AND vitals >= 50 AND rx >= 5 AND dx >= 3
            ORDER BY total_events DESC
            LIMIT {TARGET_PATIENTS}
        """)
        selected = cur.fetchall()
        selected_ids = [row[0] for row in selected]

        log(1, f"Selected {len(selected_ids)} patients (min events: {selected[-1][1] if selected else 0}, "
              f"max events: {selected[0][1] if selected else 0})")

        if len(selected_ids) < TARGET_PATIENTS:
            log(1, f"WARNING: Only {len(selected_ids)} patients meet criteria (target: {TARGET_PATIENTS})")

        if dry_run:
            log(1, f"DRY RUN: Would prune {243166 - len(selected_ids)} patients")
            return

        # Step 2: Backup original subject IDs
        log(1, "Backing up subject IDs...")
        cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}._subject_ids_backup")
        cur.execute(f"CREATE TABLE {ATLANTIC}._subject_ids_backup AS SELECT subject_id FROM {ATLANTIC}.patients")

        # Step 3: Create pg_dump backup
        log(1, "Creating full schema backup (pg_dump)...")
        conn.commit()  # commit backup table before pg_dump
        backup_dir = Path(__file__).resolve().parent.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        backup_path = backup_dir / "atlantic_health_pre_synthesis.sql.gz"

        dsn_params = conn.get_dsn_parameters()
        env = os.environ.copy()
        env["PGPASSWORD"] = dsn_params.get("password", "")
        dump_cmd = [
            "pg_dump",
            "-h", dsn_params.get("host", "localhost"),
            "-p", dsn_params.get("port", "5432"),
            "-U", dsn_params.get("user", "parthenon"),
            "-d", dsn_params.get("dbname", "parthenon"),
            "--schema=atlantic_health",
            "--no-owner",
        ]
        try:
            import gzip
            result = subprocess.run(dump_cmd, capture_output=True, env=env, timeout=600)
            if result.returncode == 0:
                with gzip.open(backup_path, "wb") as f:
                    f.write(result.stdout)
                size_mb = backup_path.stat().st_size / 1024 / 1024
                log(1, f"Backup saved: {backup_path} ({size_mb:.1f} MB)")
            else:
                log(1, f"WARNING: pg_dump failed: {result.stderr.decode()[:200]}")
                log(1, "Continuing without backup — subject_ids_backup table is available")
        except Exception as e:
            log(1, f"WARNING: Backup failed: {e}")
            log(1, "Continuing without backup — subject_ids_backup table is available")

        # Step 4: Create selected subjects table
        log(1, "Creating selected subjects table...")
        cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}._selected_subjects")
        cur.execute(f"CREATE TABLE {ATLANTIC}._selected_subjects (subject_id TEXT PRIMARY KEY)")
        execute_values(
            cur,
            f"INSERT INTO {ATLANTIC}._selected_subjects (subject_id) VALUES %s",
            [(sid,) for sid in selected_ids],
        )
        conn.commit()

        # Step 5: Prune each table in batches
        tables_to_prune = [
            "chartevents",    # largest first
            "prescriptions",
            "labevents",
            "transfers",
            "services",
            "admissions",
            "icustays",
            "diagnoses_icd",
            "emar",
            "problem_list",
            "patients",       # last — FK source
        ]

        for table in tables_to_prune:
            # Check table exists
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (ATLANTIC, table),
            )
            if not cur.fetchone()[0]:
                log(1, f"  Skipping {table} (does not exist)")
                continue

            log(1, f"  Pruning {table}...")
            total_deleted = 0
            while True:
                cur.execute(f"""
                    DELETE FROM {ATLANTIC}.{table}
                    WHERE ctid IN (
                        SELECT ctid FROM {ATLANTIC}.{table}
                        WHERE subject_id NOT IN (SELECT subject_id FROM {ATLANTIC}._selected_subjects)
                        LIMIT 100000
                    )
                """)
                deleted = cur.rowcount
                total_deleted += deleted
                conn.commit()
                if deleted == 0:
                    break
                if total_deleted % 500000 == 0:
                    log(1, f"    ...{total_deleted:,} rows deleted so far")

            log(1, f"    Deleted {total_deleted:,} rows from {table}")

            # Vacuum after large deletes
            conn.autocommit = True
            cur.execute(f"VACUUM ANALYZE {ATLANTIC}.{table}")
            conn.autocommit = False

        # Step 6: Verify final count
        cur.execute(f"SELECT count(*) FROM {ATLANTIC}.patients")
        final_count = cur.fetchone()[0]
        log(1, f"Final patient count: {final_count}")
        conn.commit()


# ─── Phase 2: Copy Dictionary Tables ─────────────────────────────────────────


def phase_2_copy_dictionaries(conn, dry_run=False):
    """Copy d_icd_diagnoses and d_icd_procedures from MIMIC."""
    dicts_to_copy = [
        ("d_icd_diagnoses", "(icd_code, icd_version)"),
        ("d_icd_procedures", "(icd_code, icd_version)"),
    ]

    with conn.cursor() as cur:
        for table, idx_cols in dicts_to_copy:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (ATLANTIC, table),
            )
            exists = cur.fetchone()[0]

            cur.execute(f"SELECT count(*) FROM {MIMIC}.{table}")
            source_count = cur.fetchone()[0]

            if dry_run:
                action = "replace" if exists else "create"
                log(2, f"DRY RUN: Would {action} {ATLANTIC}.{table} ({source_count:,} rows)")
                continue

            if exists:
                log(2, f"Dropping existing {ATLANTIC}.{table}")
                cur.execute(f"DROP TABLE {ATLANTIC}.{table}")

            log(2, f"Copying {MIMIC}.{table} → {ATLANTIC}.{table} ({source_count:,} rows)")
            cur.execute(f"CREATE TABLE {ATLANTIC}.{table} AS SELECT * FROM {MIMIC}.{table}")
            cur.execute(f"CREATE INDEX ON {ATLANTIC}.{table} {idx_cols}")
            log(2, f"  Done with index on {idx_cols}")

        conn.commit()


# ─── Phase stubs (Tasks 4-9) ──────────────────────────────────────────────────


def phase_3_extract_distributions(conn) -> dict:
    """Extract MIMIC-IV statistical distributions into memory."""
    dist = {}

    log(3, "Extracting MIMIC-IV distributions...")

    # ── Procedures distributions ──────────────────────────────────────────

    log(3, "  procedures_icd...")
    dist["proc_count_by_adm_type"] = pd.read_sql(f"""
        SELECT a.admission_type,
               count(p.icd_code)::float / count(DISTINCT a.hadm_id) as mean_procs,
               count(DISTINCT a.hadm_id) as n_admissions
        FROM {MIMIC}.admissions a
        LEFT JOIN {MIMIC}.procedures_icd p ON a.hadm_id = p.hadm_id
        GROUP BY a.admission_type
    """, conn)

    dist["proc_codes"] = pd.read_sql(f"""
        SELECT p.icd_code, p.icd_version,
               left(d.icd_code, 3) as dx_chapter,
               count(*) as freq
        FROM {MIMIC}.procedures_icd p
        JOIN {MIMIC}.diagnoses_icd d ON p.hadm_id = d.hadm_id AND d.seq_num = '1'
        GROUP BY p.icd_code, p.icd_version, dx_chapter
    """, conn)

    dist["proc_day_offset"] = pd.read_sql(f"""
        SELECT EXTRACT(EPOCH FROM (p.chartdate::timestamp - a.admittime::timestamp)) / 86400.0 as day_offset
        FROM {MIMIC}.procedures_icd p
        JOIN {MIMIC}.admissions a ON p.hadm_id = a.hadm_id
        WHERE p.chartdate IS NOT NULL AND a.admittime IS NOT NULL
    """, conn)

    # ── Microbiology distributions ────────────────────────────────────────

    log(3, "  microbiologyevents...")

    # Culture rate by ICU status
    dist["culture_rate"] = pd.read_sql(f"""
        WITH adm_icu AS (
            SELECT a.hadm_id,
                   CASE WHEN EXISTS (SELECT 1 FROM {MIMIC}.icustays i WHERE i.hadm_id = a.hadm_id) THEN true ELSE false END as has_icu,
                   EXTRACT(EPOCH FROM (a.dischtime::timestamp - a.admittime::timestamp)) / 86400.0 as los
            FROM {MIMIC}.admissions a
        )
        SELECT has_icu,
               CASE WHEN los > 5 THEN 'long' ELSE 'short' END as los_bucket,
               count(DISTINCT m.hadm_id)::float / GREATEST(count(DISTINCT ai.hadm_id), 1) as culture_rate,
               count(DISTINCT ai.hadm_id) as n_admissions
        FROM adm_icu ai
        LEFT JOIN {MIMIC}.microbiologyevents m ON ai.hadm_id = m.hadm_id
        GROUP BY has_icu, los_bucket
    """, conn)

    dist["specimen_types"] = pd.read_sql(f"""
        SELECT spec_type_desc, count(DISTINCT micro_specimen_id) as freq
        FROM {MIMIC}.microbiologyevents
        WHERE spec_type_desc IS NOT NULL
        GROUP BY spec_type_desc
    """, conn)

    dist["organism_growth_by_specimen"] = pd.read_sql(f"""
        SELECT spec_type_desc,
               count(DISTINCT CASE WHEN org_name IS NOT NULL THEN micro_specimen_id END)::float /
               GREATEST(count(DISTINCT micro_specimen_id), 1) as growth_rate
        FROM {MIMIC}.microbiologyevents
        WHERE spec_type_desc IS NOT NULL
        GROUP BY spec_type_desc
    """, conn)

    dist["organisms_by_specimen"] = pd.read_sql(f"""
        SELECT spec_type_desc, org_name, count(*) as freq
        FROM {MIMIC}.microbiologyevents
        WHERE org_name IS NOT NULL AND spec_type_desc IS NOT NULL
        GROUP BY spec_type_desc, org_name
    """, conn)

    dist["ab_panels"] = pd.read_sql(f"""
        SELECT org_name, ab_name, interpretation, count(*) as freq
        FROM {MIMIC}.microbiologyevents
        WHERE org_name IS NOT NULL AND ab_name IS NOT NULL AND interpretation IS NOT NULL
        GROUP BY org_name, ab_name, interpretation
    """, conn)

    dist["mic_values"] = pd.read_sql(f"""
        SELECT org_name, ab_name, dilution_comparison, dilution_value
        FROM {MIMIC}.microbiologyevents
        WHERE dilution_value IS NOT NULL AND org_name IS NOT NULL AND ab_name IS NOT NULL
    """, conn)

    # ── Input events distributions ────────────────────────────────────────

    log(3, "  inputevents...")
    dist["input_items"] = pd.read_sql(f"""
        SELECT i.itemid, d.label, d.abbreviation,
               count(*) as freq,
               avg(NULLIF(i.amount, '')::float) as mean_amount,
               stddev(NULLIF(i.amount, '')::float) as std_amount,
               mode() WITHIN GROUP (ORDER BY i.amountuom) as common_uom,
               avg(NULLIF(i.rate, '')::float) as mean_rate,
               mode() WITHIN GROUP (ORDER BY i.rateuom) as common_rateuom,
               avg(EXTRACT(EPOCH FROM (NULLIF(i.endtime, '')::timestamp - NULLIF(i.starttime, '')::timestamp)) / 3600.0) as mean_duration_hrs,
               mode() WITHIN GROUP (ORDER BY i.ordercategoryname) as common_category,
               mode() WITHIN GROUP (ORDER BY i.statusdescription) as common_status
        FROM {MIMIC}.inputevents i
        JOIN {MIMIC}.d_items d ON i.itemid::text = d.itemid::text
        WHERE i.amount IS NOT NULL AND i.amount <> ''
        GROUP BY i.itemid, d.label, d.abbreviation
    """, conn)

    dist["input_per_icu_day"] = pd.read_sql(f"""
        SELECT count(*)::float / GREATEST(sum(NULLIF(s.los, '')::float), 1) as events_per_day
        FROM {MIMIC}.inputevents i
        JOIN {MIMIC}.icustays s ON i.stay_id::text = s.stay_id::text
    """, conn)

    # ── Output events distributions ───────────────────────────────────────

    log(3, "  outputevents...")
    dist["output_items"] = pd.read_sql(f"""
        SELECT o.itemid, d.label,
               count(*) as freq,
               avg(NULLIF(o.value, '')::float) as mean_value,
               stddev(NULLIF(o.value, '')::float) as std_value,
               mode() WITHIN GROUP (ORDER BY o.valueuom) as common_uom
        FROM {MIMIC}.outputevents o
        JOIN {MIMIC}.d_items d ON o.itemid::text = d.itemid::text
        WHERE o.value IS NOT NULL AND o.value <> ''
        GROUP BY o.itemid, d.label
    """, conn)

    dist["output_per_icu_day"] = pd.read_sql(f"""
        SELECT count(*)::float / GREATEST(sum(NULLIF(s.los, '')::float), 1) as events_per_day
        FROM {MIMIC}.outputevents o
        JOIN {MIMIC}.icustays s ON o.stay_id::text = s.stay_id::text
    """, conn)

    log(3, f"  Extracted {len(dist)} distribution tables")
    for key, df in dist.items():
        log(3, f"    {key}: {len(df)} rows")
    return dist


def phase_4_generate_procedures(conn, distributions: dict, dry_run=False):
    """Generate procedures_icd for AtlanticHealth patients."""
    pass  # Task 5


def phase_5_generate_microbiology(conn, distributions: dict, dry_run=False):
    """Generate microbiologyevents for AtlanticHealth patients."""
    pass  # Task 6


def phase_6_generate_inputevents(conn, distributions: dict, dry_run=False):
    """Generate inputevents for AtlanticHealth ICU patients."""
    pass  # Task 7


def phase_7_generate_outputevents(conn, distributions: dict, dry_run=False):
    """Generate outputevents for AtlanticHealth ICU patients."""
    pass  # Task 8


def phase_8_index_and_cleanup(conn, dry_run=False):
    """Add indexes, update metadata, flush cache."""
    pass  # Task 9


# ─── Main Orchestrator ────────────────────────────────────────────────────────


def main():
    args = parse_args()
    dsn = args.dsn or load_dsn_from_env()
    conn = connect(dsn)

    print("=" * 60)
    print("AtlanticHealth Data Synthesis Pipeline")
    print("=" * 60)

    if not args.force and check_already_run(conn):
        print("Synthesis already completed. Use --force to re-run.")
        conn.close()
        return

    phases = {
        0: ("Validate schemas", lambda: phase_0_validate(conn)),
        1: ("Select & prune patients", lambda: phase_1_select_and_prune(conn, args.dry_run)),
        2: ("Copy dictionaries", lambda: phase_2_copy_dictionaries(conn, args.dry_run)),
        3: ("Extract MIMIC distributions", lambda: phase_3_extract_distributions(conn)),
        4: ("Generate procedures_icd", None),
        5: ("Generate microbiologyevents", None),
        6: ("Generate inputevents", None),
        7: ("Generate outputevents", None),
        8: ("Index & cleanup", lambda: phase_8_index_and_cleanup(conn, args.dry_run)),
    }

    distributions = {}

    for phase_num, (name, func) in phases.items():
        if args.phase is not None and args.phase != phase_num:
            continue

        start = time.time()
        print(f"\n{'─' * 40}")
        print(f"Phase {phase_num}: {name}")
        print(f"{'─' * 40}")

        if phase_num == 3:
            distributions = phase_3_extract_distributions(conn)
        elif phase_num == 4:
            phase_4_generate_procedures(conn, distributions, args.dry_run)
        elif phase_num == 5:
            phase_5_generate_microbiology(conn, distributions, args.dry_run)
        elif phase_num == 6:
            phase_6_generate_inputevents(conn, distributions, args.dry_run)
        elif phase_num == 7:
            phase_7_generate_outputevents(conn, distributions, args.dry_run)
        elif func:
            func()

        elapsed = time.time() - start
        print(f"  Completed in {elapsed:.1f}s")

    conn.close()
    print(f"\n{'=' * 60}")
    print("Synthesis complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
