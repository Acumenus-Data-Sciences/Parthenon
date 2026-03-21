# AtlanticHealth Data Synthesis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select 3,250 richest patients from AtlanticHealth, prune the rest, synthesize missing MIMIC-standard tables (`procedures_icd`, `microbiologyevents`, `inputevents`, `outputevents`) using pattern-based generation from MIMIC-IV distributions.

**Architecture:** Single Python script with 8 sequential phases. Phase 1 selects/prunes patients. Phase 2 copies dictionary tables. Phase 3 extracts MIMIC distributions into memory. Phases 4-7 generate synthetic data for each missing table. Phase 8 indexes and cleans up. All data operations use psycopg2 with batched inserts.

**Tech Stack:** Python 3.12, psycopg2, numpy, pandas, PostgreSQL 17

**Spec:** `docs/superpowers/specs/2026-03-21-atlantic-health-synthesis-design.md`

**Database:** `parthenon` on `pgsql.acumenus.net:5432` — schemas `atlantic_health` (target) and `mimiciv` (reference)

**CRITICAL:** All MIMIC-IV columns are TEXT type (not int/float/timestamp). The synthesizer must output TEXT values to match. AtlanticHealth follows the same convention.

---

## File Structure

```
scripts/
  synthesize_atlantic_health.py    — Main script (all 8 phases)
```

Single file. No modules, no packages. The script is ~600-800 lines with clear phase functions.

---

### Task 1: Script Skeleton with CLI, DB Connection, and Phase 0

**Files:**
- Create: `scripts/synthesize_atlantic_health.py`

- [ ] **Step 1: Create the script with argument parsing and DB connection**

```python
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


# ─── Phase functions (implemented in subsequent tasks) ───────────────────────


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


def phase_1_select_and_prune(conn, dry_run=False):
    """Select top 3,250 patients by clinical completeness, prune the rest."""
    pass  # Task 2


def phase_2_copy_dictionaries(conn, dry_run=False):
    """Copy d_icd_diagnoses and d_icd_procedures from MIMIC."""
    pass  # Task 3


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
```

- [ ] **Step 2: Verify script runs (Phase 0 only)**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py --phase 0`
Expected: Shows table counts for both schemas, confirms MIMIC reference tables present

- [ ] **Step 3: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add AtlanticHealth synthesis script skeleton with CLI and Phase 0 validation"
```

---

### Task 2: Phase 1 — Patient Selection & Pruning

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_1_select_and_prune`)

- [ ] **Step 1: Implement patient selection and pruning**

Replace the `phase_1_select_and_prune` function:

```python
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
```

- [ ] **Step 2: Test Phase 1 in dry-run mode**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py --phase 1 --dry-run`
Expected: Reports selected patient count and how many would be pruned, no changes made

- [ ] **Step 3: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 1 — patient selection and batched pruning"
```

---

### Task 3: Phase 2 — Copy Dictionary Tables

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_2_copy_dictionaries`)

- [ ] **Step 1: Implement dictionary copying**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 2 — copy MIMIC dictionary tables"
```

---

### Task 4: Phase 3 — Extract MIMIC Distributions

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_3_extract_distributions`)

- [ ] **Step 1: Implement distribution extraction**

```python
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
               avg(i.amount::float) as mean_amount,
               stddev(i.amount::float) as std_amount,
               mode() WITHIN GROUP (ORDER BY i.amountuom) as common_uom,
               avg(i.rate::float) as mean_rate,
               mode() WITHIN GROUP (ORDER BY i.rateuom) as common_rateuom,
               avg(EXTRACT(EPOCH FROM (i.endtime::timestamp - i.starttime::timestamp)) / 3600.0) as mean_duration_hrs,
               mode() WITHIN GROUP (ORDER BY i.ordercategoryname) as common_category,
               mode() WITHIN GROUP (ORDER BY i.statusdescription) as common_status
        FROM {MIMIC}.inputevents i
        JOIN {MIMIC}.d_items d ON i.itemid = d.itemid
        WHERE i.amount IS NOT NULL
        GROUP BY i.itemid, d.label, d.abbreviation
    """, conn)

    dist["input_per_icu_day"] = pd.read_sql(f"""
        SELECT count(*)::float / GREATEST(sum(s.los::float), 1) as events_per_day
        FROM {MIMIC}.inputevents i
        JOIN {MIMIC}.icustays s ON i.stay_id = s.stay_id
    """, conn)

    # ── Output events distributions ───────────────────────────────────────

    log(3, "  outputevents...")
    dist["output_items"] = pd.read_sql(f"""
        SELECT o.itemid, d.label,
               count(*) as freq,
               avg(o.value::float) as mean_value,
               stddev(o.value::float) as std_value,
               mode() WITHIN GROUP (ORDER BY o.valueuom) as common_uom
        FROM {MIMIC}.outputevents o
        JOIN {MIMIC}.d_items d ON o.itemid = d.itemid
        WHERE o.value IS NOT NULL
        GROUP BY o.itemid, d.label
    """, conn)

    dist["output_per_icu_day"] = pd.read_sql(f"""
        SELECT count(*)::float / GREATEST(sum(s.los::float), 1) as events_per_day
        FROM {MIMIC}.outputevents o
        JOIN {MIMIC}.icustays s ON o.stay_id = s.stay_id
    """, conn)

    log(3, f"  Extracted {len(dist)} distribution tables")
    return dist
```

- [ ] **Step 2: Test distribution extraction**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py --phase 3`
Expected: Prints distribution table names and row counts

- [ ] **Step 3: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 3 — extract MIMIC-IV statistical distributions"
```

---

### Task 5: Phase 4 — Generate `procedures_icd`

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_4_generate_procedures`)

- [ ] **Step 1: Implement procedure generation**

```python
def phase_4_generate_procedures(conn, distributions: dict, dry_run=False):
    """Generate procedures_icd for AtlanticHealth patients."""
    proc_by_type = distributions["proc_count_by_adm_type"]
    proc_codes = distributions["proc_codes"]
    day_offsets = distributions["proc_day_offset"]["day_offset"].dropna().values

    with conn.cursor() as cur:
        if not dry_run:
            cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}.procedures_icd")
            cur.execute(f"""
                CREATE TABLE {ATLANTIC}.procedures_icd (
                    subject_id TEXT, hadm_id TEXT, seq_num TEXT,
                    chartdate TEXT, icd_code TEXT, icd_version TEXT
                )
            """)

        # Get all admissions with their primary diagnosis
        cur.execute(f"""
            SELECT a.subject_id, a.hadm_id, a.admission_type, a.admittime, a.dischtime,
                   d.icd_code as primary_dx
            FROM {ATLANTIC}.admissions a
            LEFT JOIN (
                SELECT DISTINCT ON (hadm_id) hadm_id, icd_code
                FROM {ATLANTIC}.diagnoses_icd WHERE seq_num = '1'
                ORDER BY hadm_id
            ) d ON a.hadm_id = d.hadm_id
        """)
        admissions = cur.fetchall()
        log(4, f"Processing {len(admissions):,} admissions...")

        rows = []
        for i, (subj, hadm, adm_type, admittime, dischtime, primary_dx) in enumerate(admissions):
            if not admittime or not dischtime:
                continue

            # Sample procedure count
            type_row = proc_by_type[proc_by_type["admission_type"] == adm_type]
            mean_procs = float(type_row["mean_procs"].iloc[0]) if len(type_row) > 0 else 2.0
            n_procs = max(0, int(np.random.poisson(mean_procs)))
            if n_procs == 0:
                continue

            # Select procedure codes weighted by diagnosis chapter
            dx_chapter = primary_dx[:3] if primary_dx else None
            if dx_chapter:
                relevant = proc_codes[proc_codes["dx_chapter"] == dx_chapter]
            else:
                relevant = proc_codes

            if len(relevant) == 0:
                relevant = proc_codes

            weights = relevant["freq"].values.astype(float)
            weights /= weights.sum()
            chosen_idx = np.random.choice(len(relevant), size=min(n_procs, len(relevant)),
                                          replace=len(relevant) < n_procs, p=weights)

            for seq, idx in enumerate(chosen_idx, 1):
                row = relevant.iloc[idx]
                # Sample chartdate within admission window
                offset = np.random.choice(day_offsets) if len(day_offsets) > 0 else np.random.uniform(0, 3)
                offset = max(0, min(offset, 30))  # clamp
                chartdate = pd.Timestamp(admittime) + pd.Timedelta(days=offset)
                if pd.Timestamp(dischtime) > pd.Timestamp(admittime):
                    los_days = (pd.Timestamp(dischtime) - pd.Timestamp(admittime)).total_seconds() / 86400
                    chartdate = pd.Timestamp(admittime) + pd.Timedelta(days=min(offset, los_days))

                rows.append((
                    subj, hadm, str(seq), chartdate.strftime("%Y-%m-%d"),
                    row["icd_code"], row["icd_version"],
                ))

            if (i + 1) % 5000 == 0:
                log(4, f"  ...processed {i + 1:,} admissions ({len(rows):,} procedures)")

        log(4, f"Generated {len(rows):,} procedures")

        if dry_run:
            log(4, f"DRY RUN: Would insert {len(rows):,} rows")
            return

        # Bulk insert
        execute_values(
            cur,
            f"INSERT INTO {ATLANTIC}.procedures_icd (subject_id, hadm_id, seq_num, chartdate, icd_code, icd_version) VALUES %s",
            rows,
            page_size=5000,
        )
        conn.commit()
        log(4, f"Inserted {len(rows):,} rows")
```

- [ ] **Step 2: Test in dry-run**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py --phase 4 --dry-run`
Expected: Reports how many procedures would be generated (should be ~30K)

- [ ] **Step 3: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 4 — generate procedures_icd from MIMIC distributions"
```

---

### Task 6: Phase 5 — Generate `microbiologyevents`

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_5_generate_microbiology`)

- [ ] **Step 1: Implement microbiology generation**

```python
def phase_5_generate_microbiology(conn, distributions: dict, dry_run=False):
    """Generate microbiologyevents for AtlanticHealth patients."""
    culture_rates = distributions["culture_rate"]
    specimen_df = distributions["specimen_types"]
    growth_df = distributions["organism_growth_by_specimen"]
    organisms_df = distributions["organisms_by_specimen"]
    ab_panels_df = distributions["ab_panels"]
    mic_df = distributions["mic_values"]

    # Build lookup structures
    specimen_types = specimen_df["spec_type_desc"].values
    specimen_weights = specimen_df["freq"].values.astype(float)
    specimen_weights /= specimen_weights.sum()

    with conn.cursor() as cur:
        if not dry_run:
            cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}.microbiologyevents")
            cur.execute(f"""
                CREATE TABLE {ATLANTIC}.microbiologyevents (
                    microevent_id TEXT, subject_id TEXT, hadm_id TEXT,
                    micro_specimen_id TEXT, order_provider_id TEXT,
                    chartdate TEXT, charttime TEXT,
                    spec_itemid TEXT, spec_type_desc TEXT,
                    test_seq TEXT, storedate TEXT, storetime TEXT,
                    test_itemid TEXT, test_name TEXT,
                    org_itemid TEXT, org_name TEXT,
                    isolate_num TEXT, quantity TEXT,
                    ab_itemid TEXT, ab_name TEXT,
                    dilution_text TEXT, dilution_comparison TEXT,
                    dilution_value TEXT, interpretation TEXT, comments TEXT
                )
            """)

        # Get admissions with ICU status and LOS
        cur.execute(f"""
            SELECT a.subject_id, a.hadm_id, a.admittime, a.dischtime,
                   EXTRACT(EPOCH FROM (a.dischtime::timestamp - a.admittime::timestamp)) / 86400.0 as los,
                   CASE WHEN EXISTS (SELECT 1 FROM {ATLANTIC}.icustays i WHERE i.hadm_id = a.hadm_id) THEN true ELSE false END as has_icu
            FROM {ATLANTIC}.admissions a
            WHERE a.admittime IS NOT NULL AND a.dischtime IS NOT NULL
        """)
        admissions = cur.fetchall()
        log(5, f"Processing {len(admissions):,} admissions...")

        rows = []
        event_id = 1
        specimen_id = 1

        for i, (subj, hadm, admittime, dischtime, los, has_icu) in enumerate(admissions):
            # Determine culture probability
            los_bucket = "long" if (los and float(los) > 5) else "short"
            rate_row = culture_rates[
                (culture_rates["has_icu"] == has_icu) &
                (culture_rates["los_bucket"] == los_bucket)
            ]
            culture_prob = float(rate_row["culture_rate"].iloc[0]) if len(rate_row) > 0 else 0.15

            if np.random.random() > culture_prob:
                continue

            n_cultures = np.random.choice([1, 2, 3], p=[0.6, 0.3, 0.1])

            for _ in range(n_cultures):
                spec_type = np.random.choice(specimen_types, p=specimen_weights)

                # Culture date: early in admission (day 0-3)
                offset_days = np.random.uniform(0, min(3, float(los) if los else 1))
                culture_dt = pd.Timestamp(admittime) + pd.Timedelta(days=offset_days)
                chartdate = culture_dt.strftime("%Y-%m-%d")
                charttime = culture_dt.strftime("%H:%M:%S")

                # Determine growth
                growth_row = growth_df[growth_df["spec_type_desc"] == spec_type]
                growth_rate = float(growth_row["growth_rate"].iloc[0]) if len(growth_row) > 0 else 0.2
                has_growth = np.random.random() < growth_rate

                org_name = None
                if has_growth:
                    org_rows = organisms_df[organisms_df["spec_type_desc"] == spec_type]
                    if len(org_rows) > 0:
                        org_weights = org_rows["freq"].values.astype(float)
                        org_weights /= org_weights.sum()
                        org_name = np.random.choice(org_rows["org_name"].values, p=org_weights)

                # Base culture row (no antibiotic)
                base_row = (
                    str(event_id), subj, hadm, str(specimen_id), None,
                    chartdate, charttime, None, spec_type,
                    "1", chartdate, charttime, None, "CULTURE",
                    None, org_name, "1" if org_name else None, None,
                    None, None, None, None, None, None, None,
                )
                rows.append(base_row)
                event_id += 1

                # Generate sensitivity panel for positive cultures
                if org_name:
                    org_abs = ab_panels_df[ab_panels_df["org_name"] == org_name]
                    if len(org_abs) > 0:
                        ab_names = org_abs["ab_name"].unique()
                        for ab_name in ab_names:
                            ab_rows = org_abs[org_abs["ab_name"] == ab_name]
                            interp_weights = ab_rows["freq"].values.astype(float)
                            interp_weights /= interp_weights.sum()
                            interpretation = np.random.choice(ab_rows["interpretation"].values, p=interp_weights)

                            # MIC value
                            mic_rows = mic_df[(mic_df["org_name"] == org_name) & (mic_df["ab_name"] == ab_name)]
                            dil_comp, dil_val = None, None
                            if len(mic_rows) > 0:
                                mic_sample = mic_rows.sample(1).iloc[0]
                                dil_comp = mic_sample["dilution_comparison"]
                                dil_val = mic_sample["dilution_value"]

                            rows.append((
                                str(event_id), subj, hadm, str(specimen_id), None,
                                chartdate, charttime, None, spec_type,
                                "1", chartdate, charttime, None, "SENSITIVITY",
                                None, org_name, "1", None,
                                None, ab_name, None, dil_comp, dil_val, interpretation, None,
                            ))
                            event_id += 1

                specimen_id += 1

            if (i + 1) % 5000 == 0:
                log(5, f"  ...processed {i + 1:,} admissions ({len(rows):,} events)")

        log(5, f"Generated {len(rows):,} microbiology events")

        if dry_run:
            log(5, f"DRY RUN: Would insert {len(rows):,} rows")
            return

        execute_values(
            cur,
            f"INSERT INTO {ATLANTIC}.microbiologyevents VALUES %s",
            rows,
            page_size=5000,
        )
        conn.commit()
        log(5, f"Inserted {len(rows):,} rows")
```

- [ ] **Step 2: Test in dry-run**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py --phase 5 --dry-run`

- [ ] **Step 3: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 5 — generate microbiologyevents with S/I/R panels"
```

---

### Task 7: Phase 6 — Generate `inputevents`

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_6_generate_inputevents`)

- [ ] **Step 1: Implement inputevents generation**

```python
def phase_6_generate_inputevents(conn, distributions: dict, dry_run=False):
    """Generate inputevents for AtlanticHealth ICU patients."""
    input_items = distributions["input_items"]
    events_per_day = float(distributions["input_per_icu_day"]["events_per_day"].iloc[0])

    # Build item sampling weights
    item_weights = input_items["freq"].values.astype(float)
    item_weights /= item_weights.sum()

    with conn.cursor() as cur:
        if not dry_run:
            cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}.inputevents")
            cur.execute(f"""
                CREATE TABLE {ATLANTIC}.inputevents (
                    subject_id TEXT, hadm_id TEXT, stay_id TEXT,
                    caregiver_id TEXT, starttime TEXT, endtime TEXT, storetime TEXT,
                    itemid TEXT, amount TEXT, amountuom TEXT,
                    rate TEXT, rateuom TEXT,
                    orderid TEXT, linkorderid TEXT,
                    ordercategoryname TEXT, secondaryordercategoryname TEXT,
                    ordercomponenttypedescription TEXT, ordercategorydescription TEXT,
                    patientweight TEXT, totalamount TEXT, totalamountuom TEXT,
                    isopenbag TEXT, continueinnextdept TEXT,
                    statusdescription TEXT,
                    originalamount TEXT, originalrate TEXT
                )
            """)

            # Augment d_items with any MIMIC items not already in AtlanticHealth
            log(6, "Augmenting d_items...")
            cur.execute(f"""
                SELECT itemid FROM {ATLANTIC}.d_items
                INTERSECT
                SELECT itemid FROM {MIMIC}.d_items
            """)
            overlap_ids = {row[0] for row in cur.fetchall()}
            log(6, f"  {len(overlap_ids)} overlapping itemids (will preserve AtlanticHealth entries)")

            cur.execute(f"""
                INSERT INTO {ATLANTIC}.d_items
                SELECT * FROM {MIMIC}.d_items
                WHERE itemid NOT IN (SELECT itemid FROM {ATLANTIC}.d_items)
                  AND itemid IN (SELECT DISTINCT itemid FROM {MIMIC}.inputevents
                                 UNION SELECT DISTINCT itemid FROM {MIMIC}.outputevents)
            """)
            log(6, f"  Appended {cur.rowcount} new d_items entries")
            conn.commit()

        # Get ICU stays
        cur.execute(f"""
            SELECT s.subject_id, s.hadm_id, s.stay_id, s.intime, s.outtime, s.los::float as los_days
            FROM {ATLANTIC}.icustays s
            WHERE s.intime IS NOT NULL AND s.outtime IS NOT NULL
        """)
        icu_stays = cur.fetchall()
        log(6, f"Processing {len(icu_stays):,} ICU stays...")

        rows = []
        for i, (subj, hadm, stay, intime, outtime, los_days) in enumerate(icu_stays):
            if not los_days or los_days <= 0:
                continue

            n_events = max(1, int(np.random.poisson(events_per_day * los_days)))
            n_events = min(n_events, 500)  # cap per stay

            chosen_idx = np.random.choice(len(input_items), size=n_events, replace=True, p=item_weights)

            for idx in chosen_idx:
                item = input_items.iloc[idx]
                # Random time within ICU stay
                offset_hrs = np.random.uniform(0, los_days * 24)
                start_dt = pd.Timestamp(intime) + pd.Timedelta(hours=offset_hrs)
                # Duration from distribution
                mean_dur = float(item["mean_duration_hrs"]) if pd.notna(item["mean_duration_hrs"]) else 1.0
                duration_hrs = max(0.1, np.random.exponential(mean_dur))
                end_dt = start_dt + pd.Timedelta(hours=duration_hrs)

                # Clamp to ICU window
                if end_dt > pd.Timestamp(outtime):
                    end_dt = pd.Timestamp(outtime)

                # Sample amount
                mean_amt = float(item["mean_amount"]) if pd.notna(item["mean_amount"]) else 100.0
                std_amt = float(item["std_amount"]) if pd.notna(item["std_amount"]) else mean_amt * 0.3
                amount = max(0.1, np.random.normal(mean_amt, max(std_amt, 0.1)))

                mean_rate = float(item["mean_rate"]) if pd.notna(item["mean_rate"]) else None
                rate_val = str(round(max(0.1, np.random.normal(mean_rate, mean_rate * 0.3)), 1)) if mean_rate else None

                rows.append((
                    subj, hadm, stay, None,
                    start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    item["itemid"],
                    str(round(amount, 1)),
                    item["common_uom"] if pd.notna(item["common_uom"]) else None,
                    rate_val,
                    item["common_rateuom"] if pd.notna(item["common_rateuom"]) else None,
                    None, None,
                    item["common_category"] if pd.notna(item["common_category"]) else None,
                    None, None, None, None, None, None, None, None,
                    item["common_status"] if pd.notna(item["common_status"]) else "FinishedRunning",
                    None, None,
                ))

            if (i + 1) % 200 == 0:
                log(6, f"  ...processed {i + 1:,} ICU stays ({len(rows):,} events)")

        log(6, f"Generated {len(rows):,} input events")

        if dry_run:
            log(6, f"DRY RUN: Would insert {len(rows):,} rows")
            return

        execute_values(
            cur,
            f"INSERT INTO {ATLANTIC}.inputevents VALUES %s",
            rows,
            page_size=5000,
        )
        conn.commit()
        log(6, f"Inserted {len(rows):,} rows")
```

- [ ] **Step 2: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 6 — generate inputevents for ICU patients"
```

---

### Task 8: Phase 7 — Generate `outputevents`

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_7_generate_outputevents`)

- [ ] **Step 1: Implement outputevents generation**

```python
def phase_7_generate_outputevents(conn, distributions: dict, dry_run=False):
    """Generate outputevents for AtlanticHealth ICU patients."""
    output_items = distributions["output_items"]
    events_per_day = float(distributions["output_per_icu_day"]["events_per_day"].iloc[0])

    item_weights = output_items["freq"].values.astype(float)
    item_weights /= item_weights.sum()

    with conn.cursor() as cur:
        if not dry_run:
            cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}.outputevents")
            cur.execute(f"""
                CREATE TABLE {ATLANTIC}.outputevents (
                    subject_id TEXT, hadm_id TEXT, stay_id TEXT,
                    caregiver_id TEXT, charttime TEXT, storetime TEXT,
                    itemid TEXT, value TEXT, valueuom TEXT
                )
            """)

        cur.execute(f"""
            SELECT s.subject_id, s.hadm_id, s.stay_id, s.intime, s.outtime, s.los::float as los_days
            FROM {ATLANTIC}.icustays s
            WHERE s.intime IS NOT NULL AND s.outtime IS NOT NULL
        """)
        icu_stays = cur.fetchall()
        log(7, f"Processing {len(icu_stays):,} ICU stays...")

        rows = []
        for i, (subj, hadm, stay, intime, outtime, los_days) in enumerate(icu_stays):
            if not los_days or los_days <= 0:
                continue

            n_events = max(1, int(np.random.poisson(events_per_day * los_days)))
            n_events = min(n_events, 300)  # cap

            chosen_idx = np.random.choice(len(output_items), size=n_events, replace=True, p=item_weights)

            for idx in chosen_idx:
                item = output_items.iloc[idx]
                # Spread measurements evenly across stay with jitter
                offset_hrs = np.random.uniform(0, los_days * 24)
                chart_dt = pd.Timestamp(intime) + pd.Timedelta(hours=offset_hrs)

                # Sample value
                mean_val = float(item["mean_value"]) if pd.notna(item["mean_value"]) else 150.0
                std_val = float(item["std_value"]) if pd.notna(item["std_value"]) else mean_val * 0.4
                value = max(0, np.random.normal(mean_val, max(std_val, 1)))

                rows.append((
                    subj, hadm, stay, None,
                    chart_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    chart_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    item["itemid"],
                    str(round(value, 1)),
                    item["common_uom"] if pd.notna(item["common_uom"]) else "mL",
                ))

            if (i + 1) % 200 == 0:
                log(7, f"  ...processed {i + 1:,} ICU stays ({len(rows):,} events)")

        log(7, f"Generated {len(rows):,} output events")

        if dry_run:
            log(7, f"DRY RUN: Would insert {len(rows):,} rows")
            return

        execute_values(
            cur,
            f"INSERT INTO {ATLANTIC}.outputevents VALUES %s",
            rows,
            page_size=5000,
        )
        conn.commit()
        log(7, f"Inserted {len(rows):,} rows")
```

- [ ] **Step 2: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 7 — generate outputevents for ICU patients"
```

---

### Task 9: Phase 8 — Indexing, Metadata, Cache Flush

**Files:**
- Modify: `scripts/synthesize_atlantic_health.py` (replace `phase_8_index_and_cleanup`)

- [ ] **Step 1: Implement indexing and cleanup**

```python
def phase_8_index_and_cleanup(conn, dry_run=False):
    """Add indexes, update metadata, flush cache."""
    indexes = [
        (f"{ATLANTIC}.procedures_icd", "subject_id"),
        (f"{ATLANTIC}.procedures_icd", "hadm_id"),
        (f"{ATLANTIC}.microbiologyevents", "subject_id"),
        (f"{ATLANTIC}.microbiologyevents", "hadm_id"),
        (f"{ATLANTIC}.inputevents", "subject_id"),
        (f"{ATLANTIC}.inputevents", "stay_id"),
        (f"{ATLANTIC}.inputevents", "hadm_id"),
        (f"{ATLANTIC}.outputevents", "subject_id"),
        (f"{ATLANTIC}.outputevents", "stay_id"),
        (f"{ATLANTIC}.outputevents", "hadm_id"),
    ]

    with conn.cursor() as cur:
        if dry_run:
            log(8, f"DRY RUN: Would create {len(indexes)} indexes")
            return

        # Create indexes
        for table, col in indexes:
            # Check table exists
            schema, tname = table.split(".")
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (schema, tname),
            )
            if not cur.fetchone()[0]:
                continue

            idx_name = f"idx_{tname}_{col}"
            log(8, f"  Creating index {idx_name}...")
            cur.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({col})")

        conn.commit()

        # Update dataset registry
        log(8, "Updating morpheus_dataset patient_count...")
        cur.execute(f"SELECT count(*) FROM {ATLANTIC}.patients")
        actual_count = cur.fetchone()[0]
        cur.execute(
            "UPDATE inpatient_ext.morpheus_dataset SET patient_count = %s WHERE schema_name = %s",
            (actual_count, ATLANTIC),
        )
        conn.commit()
        log(8, f"  Patient count: {actual_count}")

        # Create metadata marker
        log(8, "Creating synthesis metadata marker...")
        cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}._synthesis_metadata")
        cur.execute(f"""
            CREATE TABLE {ATLANTIC}._synthesis_metadata (
                synthesized_at TIMESTAMPTZ DEFAULT NOW(),
                mimic_source_schema TEXT DEFAULT '{MIMIC}',
                patient_count INT DEFAULT {actual_count},
                script_version TEXT DEFAULT '1.0'
            )
        """)
        cur.execute(f"INSERT INTO {ATLANTIC}._synthesis_metadata DEFAULT VALUES")
        conn.commit()

        # VACUUM ANALYZE all new tables
        log(8, "Running VACUUM ANALYZE...")
        conn.autocommit = True
        for table in ("procedures_icd", "microbiologyevents", "inputevents", "outputevents"):
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (ATLANTIC, table),
            )
            if cur.fetchone()[0]:
                cur.execute(f"VACUUM ANALYZE {ATLANTIC}.{table}")
                log(8, f"  VACUUM ANALYZE {ATLANTIC}.{table}")
        conn.autocommit = False

        # Clean up temp table
        cur.execute(f"DROP TABLE IF EXISTS {ATLANTIC}._selected_subjects")
        conn.commit()

        # Flush SchemaIntrospector cache
        log(8, "Flushing Redis cache for SchemaIntrospector...")
        try:
            import redis
            env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
            env = {}
            for line in env_path.read_text().splitlines():
                m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
                if m:
                    env[m.group(1)] = m.group(2).strip('"').strip("'")

            r = redis.Redis(
                host=env.get("REDIS_HOST", "localhost"),
                port=int(env.get("REDIS_PORT", "6379")),
                password=env.get("REDIS_PASSWORD", None),
            )
            deleted = 0
            for key in r.scan_iter(f"*morpheus_schema*{ATLANTIC}*"):
                r.delete(key)
                deleted += 1
            for key in r.scan_iter(f"*morpheus:atlantic_health*"):
                r.delete(key)
                deleted += 1
            log(8, f"  Flushed {deleted} Redis cache keys")
        except ImportError:
            log(8, "  WARNING: redis not installed — run 'php artisan cache:clear' manually")
        except Exception as e:
            log(8, f"  WARNING: Redis flush failed: {e}")
            log(8, "  Run 'php artisan cache:clear' manually after synthesis")

    # Summary
    log(8, "")
    log(8, "Synthesis complete! Summary:")
    with conn.cursor() as cur:
        for table in ("patients", "admissions", "procedures_icd", "microbiologyevents",
                       "inputevents", "outputevents"):
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (ATLANTIC, table),
            )
            if cur.fetchone()[0]:
                cur.execute(f"SELECT count(*) FROM {ATLANTIC}.{table}")
                count = cur.fetchone()[0]
                log(8, f"  {table}: {count:,} rows")
```

- [ ] **Step 2: Commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: add Phase 8 — indexing, metadata, cache flush, summary"
```

---

### Task 10: Full Integration Test

- [ ] **Step 1: Run full pipeline in dry-run mode**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py --dry-run`
Expected: All 8 phases report what they would do, no data modified

- [ ] **Step 2: Run the actual synthesis**

Run: `cd /home/smudoshi/Github/Parthenon && python scripts/synthesize_atlantic_health.py`
Expected: All phases execute, ~115K synthetic rows generated, summary shows final table counts

- [ ] **Step 3: Verify via Morpheus API**

Run: `docker compose exec php php artisan tinker --execute="
\$svc = app(App\Services\Morpheus\MorpheusPatientService::class);
\$r = \$svc->listPatients(3, 0, [], 'atlantic_health');
echo 'Total patients: ' . \$r['total'] . PHP_EOL;
\$p = \$r['data'][0];
echo 'First patient: ' . \$p->subject_id . ' adm=' . \$p->admission_count . PHP_EOL;

\$counts = \$svc->getEventCounts(\$p->subject_id, null, 'atlantic_health');
print_r(\$counts);
"`
Expected: Shows 3,250 total patients, event counts include procedures, microbiology, input_events, output_events

- [ ] **Step 4: Flush cache and verify frontend**

Run: `docker compose exec php php artisan cache:clear`

- [ ] **Step 5: Final commit**

```bash
git add scripts/synthesize_atlantic_health.py
git commit -m "feat: complete AtlanticHealth synthesis pipeline — 3,250 patients with full MIMIC-standard data"
```
