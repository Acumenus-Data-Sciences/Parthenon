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
    return {}  # Task 4


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
