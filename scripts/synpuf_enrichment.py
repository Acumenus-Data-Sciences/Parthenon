"""SynPUF OMOP CDM v5.4 Data Enrichment Script.

Fixes 7 data quality gaps in the synpuf schema so the CMS SynPUF 2.3M
dataset passes all OHDSI Achilles and DQD checks.

Usage:
    python scripts/synpuf_enrichment.py              # Run all stages
    python scripts/synpuf_enrichment.py --stage 4    # Run only stage 4
    python scripts/synpuf_enrichment.py --stage 4-7  # Run stages 4-7
    python scripts/synpuf_enrichment.py --dry-run    # Show plan only
    python scripts/synpuf_enrichment.py --stop-on-error
    python scripts/synpuf_enrichment.py --force      # Skip prompts
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

import psycopg2
import psycopg2.extras

from rich.console import Console
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)
from rich.table import Table

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCHEMA = "synpuf"
RESULTS_SCHEMA = "synpuf_results"
VOCAB_SCHEMA = "vocab"

DB_DSN: dict[str, Any] = {
    "host": os.environ.get("SYNPUF_DB_HOST", "localhost"),
    "port": int(os.environ.get("SYNPUF_DB_PORT", "5432")),
    "dbname": os.environ.get("SYNPUF_DB_NAME", "parthenon"),
    "user": os.environ.get("SYNPUF_DB_USER", "claude_dev"),
    "passfile": os.path.expanduser("~/.pgpass"),
}

NUM_WORKERS = min(int(os.environ.get("SYNPUF_WORKERS", "8")), os.cpu_count() or 4)

STAGE_NAMES: dict[int, str] = {
    1: "CDM Source Metadata",
    2: "Empty CDM v5.4 Tables",
    3: "Fix Unmapped Race",
    4: "Derive Observation Periods",
    5: "Reclassify Visit Concepts",
    6: "Remap Non-Standard Concepts",
    7: "Build Drug & Condition Eras",
}

console = Console()


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class StageResult:
    """Result of a single enrichment stage."""
    stage_num: int
    name: str
    rows_affected: int | str = 0
    elapsed_seconds: float = 0.0
    status: str = "pending"  # pending | running | success | skipped | error
    error_message: str = ""


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

@contextmanager
def get_connection(autocommit: bool = False):
    """Yield a psycopg2 connection with retry. Caller manages transactions."""
    conn = None
    for attempt in range(2):
        try:
            conn = psycopg2.connect(**DB_DSN)
            conn.set_session(autocommit=autocommit)
            break
        except psycopg2.OperationalError:
            if attempt == 0:
                console.print("[yellow]Connection failed, retrying in 5s...[/yellow]")
                time.sleep(5)
            else:
                raise
    try:
        yield conn
    finally:
        if conn:
            conn.close()


def make_worker_connection():
    """Create a standalone connection for a worker thread."""
    conn = psycopg2.connect(**DB_DSN)
    conn.set_session(autocommit=False)
    return conn


def query_scalar(conn, sql: str, params=None):
    """Execute SQL and return the first column of the first row."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return row[0] if row else None


def query_all(conn, sql: str, params=None) -> list[tuple]:
    """Execute SQL and return all rows."""
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SynPUF OMOP CDM v5.4 Data Enrichment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--stage",
        type=str,
        default=None,
        help="Run specific stage(s): '4' or '4-7'",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without executing",
    )
    parser.add_argument(
        "--stop-on-error",
        action="store_true",
        help="Halt on first stage failure",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompts (era rebuild)",
    )
    return parser.parse_args()


def parse_stage_range(stage_arg: str | None) -> list[int]:
    """Parse --stage argument into list of stage numbers."""
    if stage_arg is None:
        return list(range(1, 8))
    if "-" in stage_arg:
        start, end = stage_arg.split("-", 1)
        return list(range(int(start), int(end) + 1))
    return [int(stage_arg)]


# ---------------------------------------------------------------------------
# TUI helpers
# ---------------------------------------------------------------------------

def make_progress() -> Progress:
    """Create a Rich Progress bar with standard columns."""
    return Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(bar_width=40),
        MofNCompleteColumn(),
        TextColumn("•"),
        TimeElapsedColumn(),
        TextColumn("•"),
        TimeRemainingColumn(),
        console=console,
    )


def make_spinner_progress() -> Progress:
    """Create a spinner-only Progress (no bar) for indeterminate stages."""
    return Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        TextColumn("•"),
        TimeElapsedColumn(),
        console=console,
    )


def print_stage_header(stage_num: int, total: int, name: str):
    console.print()
    console.rule(
        f"[bold cyan]Stage {stage_num}/7: {name}[/bold cyan]",
        style="cyan",
    )


def print_before_count(description: str, count: int | str):
    console.print(f"  Before: [yellow]{count:,}[/yellow] {description}" if isinstance(count, int) else f"  Before: [yellow]{count}[/yellow] {description}")


def print_after_count(description: str, count: int | str):
    console.print(f"  Result: [green]{count:,}[/green] {description}" if isinstance(count, int) else f"  Result: [green]{count}[/green] {description}")


def print_summary_table(results: list[StageResult]):
    """Print the final summary table."""
    table = Table(
        title="SynPUF Enrichment Summary",
        show_header=True,
        header_style="bold magenta",
        border_style="bright_black",
        pad_edge=True,
    )
    table.add_column("#", style="dim", width=3, justify="right")
    table.add_column("Stage", min_width=30)
    table.add_column("Rows Affected", justify="right", min_width=15)
    table.add_column("Time", justify="right", min_width=10)
    table.add_column("Status", justify="center", min_width=8)

    total_elapsed = 0.0
    for r in results:
        total_elapsed += r.elapsed_seconds
        status_style = {
            "success": "[green]PASS[/green]",
            "skipped": "[yellow]SKIP[/yellow]",
            "error": "[red]FAIL[/red]",
            "pending": "[dim]--[/dim]",
        }.get(r.status, r.status)

        rows_str = f"{r.rows_affected:,}" if isinstance(r.rows_affected, int) else str(r.rows_affected)
        elapsed_str = format_elapsed(r.elapsed_seconds)

        table.add_row(str(r.stage_num), r.name, rows_str, elapsed_str, status_style)

    console.print()
    console.print(table)
    console.print(f"\n  [bold]Total elapsed:[/bold] {format_elapsed(total_elapsed)}")
    console.print()


def print_dry_run_table(stages: list[int], conn):
    """Print the dry-run plan table."""
    table = Table(
        title="SynPUF Enrichment — Dry Run",
        show_header=True,
        header_style="bold magenta",
        border_style="bright_black",
    )
    table.add_column("#", style="dim", width=3, justify="right")
    table.add_column("Stage", min_width=30)
    table.add_column("Estimated Rows", justify="right", min_width=15)
    table.add_column("Action", min_width=20)

    dry_run_info = {
        1: ("1", "CREATE + INSERT"),
        2: ("7 tables", "CREATE TABLE"),
        3: (str(query_scalar(conn, f"SELECT count(*) FROM {SCHEMA}.person WHERE race_concept_id = 0") or 0), "UPDATE"),
        4: (str(query_scalar(conn, f"""
            SELECT count(*) FROM {SCHEMA}.person p
            WHERE NOT EXISTS (SELECT 1 FROM {SCHEMA}.observation_period op WHERE op.person_id = p.person_id)
        """) or 0), "INSERT"),
        5: (str(query_scalar(conn, f"SELECT count(*) FROM {SCHEMA}.visit_occurrence WHERE visit_concept_id = 0") or 0), "UPDATE (batched)"),
        6: ("~46,000,000", "UPDATE (3 tables)"),
        7: ("~15,000,000", "INSERT (derived)"),
    }

    for s in sorted(stages):
        rows, action = dry_run_info.get(s, ("?", "?"))
        table.add_row(str(s), STAGE_NAMES[s], rows, action)

    console.print()
    console.print(table)
    console.print("\n  [dim]No changes made. Run without --dry-run to execute.[/dim]\n")


def format_elapsed(seconds: float) -> str:
    """Format seconds into human-readable elapsed time."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    if minutes < 60:
        return f"{minutes}m {secs:02d}s"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins:02d}m {secs:02d}s"


# ---------------------------------------------------------------------------
# Stage 1: CDM Source Metadata
# ---------------------------------------------------------------------------

def stage_1_cdm_source(conn, dry_run: bool = False) -> StageResult:
    """Create and populate synpuf.cdm_source metadata table."""
    result = StageResult(stage_num=1, name=STAGE_NAMES[1])
    start = time.time()

    # Check if already populated
    exists = False
    try:
        exists = bool(query_scalar(conn, f"SELECT count(*) FROM {SCHEMA}.cdm_source"))
    except psycopg2.errors.UndefinedTable:
        conn.rollback()

    if exists:
        result.status = "skipped"
        result.rows_affected = "already exists"
        result.elapsed_seconds = time.time() - start
        print_after_count("cdm_source already populated", "skipped")
        return result

    if dry_run:
        result.status = "skipped"
        result.rows_affected = 1
        return result

    with make_spinner_progress() as progress:
        task = progress.add_task("Creating cdm_source table...", total=None)

        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {SCHEMA}.cdm_source (
                        id                             BIGSERIAL PRIMARY KEY,
                        cdm_source_name                VARCHAR(255) NOT NULL,
                        cdm_source_abbreviation        VARCHAR(25),
                        cdm_holder                     VARCHAR(255),
                        source_description             TEXT,
                        source_documentation_reference VARCHAR(255),
                        cdm_etl_reference              VARCHAR(255),
                        source_release_date            DATE,
                        cdm_release_date               DATE,
                        cdm_version                    VARCHAR(10),
                        cdm_version_concept_id         INTEGER,
                        vocabulary_version             VARCHAR(20)
                    )
                """)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.cdm_source (
                        cdm_source_name, cdm_source_abbreviation, cdm_holder,
                        source_description, source_documentation_reference,
                        cdm_etl_reference, source_release_date, cdm_release_date,
                        cdm_version, cdm_version_concept_id, vocabulary_version
                    )
                    SELECT
                        'CMS Synthetic Public Use Files (SynPUF)',
                        'CMS SynPUF',
                        'CMS / Acumenus Data Sciences',
                        'CMS 2008-2010 Data Entrepreneurs Synthetic Public Use File (DE-SynPUF), 2.3M beneficiary sample. Converted to OMOP CDM v5.4.',
                        'https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files',
                        'ETL-CMS (OHDSI) + Parthenon v5.4 adaptation',
                        '2024-01-01',
                        CURRENT_DATE,
                        'v5.4',
                        756265,
                        (SELECT vocabulary_version FROM {VOCAB_SCHEMA}.vocabulary WHERE vocabulary_id = 'None' LIMIT 1)
                    WHERE NOT EXISTS (SELECT 1 FROM {SCHEMA}.cdm_source)
                """)
            conn.commit()
            result.status = "success"
            result.rows_affected = 1
        except Exception as e:
            conn.rollback()
            result.status = "error"
            result.error_message = str(e)

    result.elapsed_seconds = time.time() - start
    print_after_count("row inserted into cdm_source", result.rows_affected)
    return result


# ---------------------------------------------------------------------------
# Stage 2: Empty CDM v5.4 Tables
# ---------------------------------------------------------------------------

# DDL for missing CDM v5.4 tables
MISSING_TABLE_DDL: dict[str, str] = {
    "drug_era": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.drug_era (
            drug_era_id             BIGSERIAL PRIMARY KEY,
            person_id               BIGINT NOT NULL,
            drug_concept_id         INTEGER NOT NULL,
            drug_era_start_date     DATE NOT NULL,
            drug_era_end_date       DATE NOT NULL,
            drug_exposure_count     INTEGER,
            gap_days                INTEGER
        )
    """,
    "condition_era": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.condition_era (
            condition_era_id        BIGSERIAL PRIMARY KEY,
            person_id               BIGINT NOT NULL,
            condition_concept_id    INTEGER NOT NULL,
            condition_era_start_date DATE NOT NULL,
            condition_era_end_date  DATE NOT NULL,
            condition_occurrence_count INTEGER
        )
    """,
    "dose_era": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.dose_era (
            dose_era_id             BIGSERIAL PRIMARY KEY,
            person_id               BIGINT NOT NULL,
            drug_concept_id         INTEGER NOT NULL,
            unit_concept_id         INTEGER NOT NULL,
            dose_value              NUMERIC NOT NULL,
            dose_era_start_date     DATE NOT NULL,
            dose_era_end_date       DATE NOT NULL
        )
    """,
    "specimen": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.specimen (
            specimen_id             BIGINT PRIMARY KEY,
            person_id               BIGINT NOT NULL,
            specimen_concept_id     INTEGER NOT NULL,
            specimen_type_concept_id INTEGER NOT NULL,
            specimen_date           DATE NOT NULL,
            specimen_datetime       TIMESTAMP,
            quantity                NUMERIC,
            unit_concept_id         INTEGER DEFAULT 0,
            anatomic_site_concept_id INTEGER DEFAULT 0,
            disease_status_concept_id INTEGER DEFAULT 0,
            specimen_source_id      VARCHAR(50),
            specimen_source_value   VARCHAR(50),
            unit_source_value       VARCHAR(50),
            anatomic_site_source_value VARCHAR(50),
            disease_status_source_value VARCHAR(50)
        )
    """,
    "note": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.note (
            note_id                 BIGINT PRIMARY KEY,
            person_id               BIGINT NOT NULL,
            note_date               DATE NOT NULL,
            note_datetime           TIMESTAMP,
            note_type_concept_id    INTEGER NOT NULL,
            note_class_concept_id   INTEGER NOT NULL,
            note_title              VARCHAR(250),
            note_text               TEXT NOT NULL,
            encoding_concept_id     INTEGER NOT NULL,
            language_concept_id     INTEGER NOT NULL,
            provider_id             BIGINT,
            visit_occurrence_id     BIGINT,
            visit_detail_id         BIGINT,
            note_source_value       VARCHAR(50),
            note_event_id           BIGINT,
            note_event_field_concept_id INTEGER DEFAULT 0
        )
    """,
    "note_nlp": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.note_nlp (
            note_nlp_id             BIGINT PRIMARY KEY,
            note_id                 BIGINT NOT NULL,
            section_concept_id      INTEGER DEFAULT 0,
            snippet                 VARCHAR(250),
            "offset"                VARCHAR(50),
            lexical_variant         VARCHAR(250) NOT NULL,
            note_nlp_concept_id     INTEGER DEFAULT 0,
            note_nlp_source_concept_id INTEGER DEFAULT 0,
            nlp_system              VARCHAR(250),
            nlp_date                DATE NOT NULL,
            nlp_datetime            TIMESTAMP,
            term_exists             VARCHAR(1),
            term_temporal           VARCHAR(50),
            term_modifiers          VARCHAR(2000)
        )
    """,
    "metadata": f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.metadata (
            metadata_id             BIGINT PRIMARY KEY,
            metadata_concept_id     INTEGER NOT NULL,
            metadata_type_concept_id INTEGER NOT NULL,
            name                    VARCHAR(250) NOT NULL,
            value_as_string         TEXT,
            value_as_concept_id     INTEGER,
            value_as_number         NUMERIC,
            metadata_date           DATE,
            metadata_datetime       TIMESTAMP
        )
    """,
}


def stage_2_empty_tables(conn, dry_run: bool = False) -> StageResult:
    """Create missing CDM v5.4 tables as empty structures."""
    result = StageResult(stage_num=2, name=STAGE_NAMES[2])
    start = time.time()

    if dry_run:
        result.status = "skipped"
        result.rows_affected = f"{len(MISSING_TABLE_DDL)} tables"
        return result

    created = 0
    with make_spinner_progress() as progress:
        task = progress.add_task("Creating CDM v5.4 tables...", total=len(MISSING_TABLE_DDL))

        try:
            with conn.cursor() as cur:
                for table_name, ddl in MISSING_TABLE_DDL.items():
                    progress.update(task, description=f"Creating {table_name}...")
                    cur.execute(ddl)
                    created += 1
                    progress.advance(task)
            conn.commit()
            result.status = "success"
        except Exception as e:
            conn.rollback()
            result.status = "error"
            result.error_message = str(e)

    result.rows_affected = f"{created} tables"
    result.elapsed_seconds = time.time() - start
    print_after_count("CDM v5.4 tables created", result.rows_affected)
    return result


# ---------------------------------------------------------------------------
# Stage 3: Fix Unmapped Race
# ---------------------------------------------------------------------------

def stage_3_race(conn, dry_run: bool = False) -> StageResult:
    """Fix unmapped race_concept_id = 0 -> 8551 (Unknown)."""
    result = StageResult(stage_num=3, name=STAGE_NAMES[3])
    start = time.time()

    before_count = query_scalar(
        conn, f"SELECT count(*) FROM {SCHEMA}.person WHERE race_concept_id = 0"
    )
    print_before_count("persons with race_concept_id = 0", before_count)

    if before_count == 0:
        result.status = "skipped"
        result.rows_affected = "already fixed"
        result.elapsed_seconds = time.time() - start
        return result

    if dry_run:
        result.status = "skipped"
        result.rows_affected = before_count
        return result

    with make_spinner_progress() as progress:
        task = progress.add_task(f"Updating {before_count:,} persons...", total=None)

        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {SCHEMA}.person
                    SET race_concept_id = 8551
                    WHERE race_concept_id = 0
                """)
                result.rows_affected = cur.rowcount
            conn.commit()
            result.status = "success"
        except Exception as e:
            conn.rollback()
            result.status = "error"
            result.error_message = str(e)

    result.elapsed_seconds = time.time() - start
    print_after_count("persons updated to race = Unknown (8551)", result.rows_affected)
    return result


# ---------------------------------------------------------------------------
# Stage 4: Derive Observation Periods
# ---------------------------------------------------------------------------

def stage_4_observation_periods(conn, dry_run: bool = False) -> StageResult:
    """Derive observation_periods for orphan persons from event dates."""
    result = StageResult(stage_num=4, name=STAGE_NAMES[4])
    start = time.time()

    orphan_count = query_scalar(conn, f"""
        SELECT count(*) FROM {SCHEMA}.person p
        WHERE NOT EXISTS (
            SELECT 1 FROM {SCHEMA}.observation_period op WHERE op.person_id = p.person_id
        )
    """)
    print_before_count("orphan persons (no observation_period)", orphan_count)

    if orphan_count == 0:
        result.status = "skipped"
        result.rows_affected = "no orphans"
        result.elapsed_seconds = time.time() - start
        return result

    if dry_run:
        result.status = "skipped"
        result.rows_affected = orphan_count
        return result

    with make_spinner_progress() as progress:
        task = progress.add_task(
            f"Deriving obs periods for {orphan_count:,} persons...", total=None
        )

        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.observation_period (
                        observation_period_id, person_id,
                        observation_period_start_date, observation_period_end_date,
                        period_type_concept_id
                    )
                    WITH orphan_persons AS (
                        SELECT p.person_id
                        FROM {SCHEMA}.person p
                        WHERE NOT EXISTS (
                            SELECT 1 FROM {SCHEMA}.observation_period op
                            WHERE op.person_id = p.person_id
                        )
                    ),
                    all_event_dates AS (
                        SELECT person_id, MIN(min_d) as min_date, MAX(max_d) as max_date
                        FROM (
                            SELECT person_id,
                                   MIN(condition_start_date) as min_d,
                                   MAX(COALESCE(condition_end_date, condition_start_date)) as max_d
                            FROM {SCHEMA}.condition_occurrence
                            WHERE person_id IN (SELECT person_id FROM orphan_persons)
                            GROUP BY person_id
                            UNION ALL
                            SELECT person_id,
                                   MIN(drug_exposure_start_date),
                                   MAX(COALESCE(drug_exposure_end_date, drug_exposure_start_date))
                            FROM {SCHEMA}.drug_exposure
                            WHERE person_id IN (SELECT person_id FROM orphan_persons)
                            GROUP BY person_id
                            UNION ALL
                            SELECT person_id,
                                   MIN(procedure_date),
                                   MAX(procedure_date)
                            FROM {SCHEMA}.procedure_occurrence
                            WHERE person_id IN (SELECT person_id FROM orphan_persons)
                            GROUP BY person_id
                            UNION ALL
                            SELECT person_id,
                                   MIN(measurement_date),
                                   MAX(measurement_date)
                            FROM {SCHEMA}.measurement
                            WHERE person_id IN (SELECT person_id FROM orphan_persons)
                            GROUP BY person_id
                            UNION ALL
                            SELECT person_id,
                                   MIN(visit_start_date),
                                   MAX(COALESCE(visit_end_date, visit_start_date))
                            FROM {SCHEMA}.visit_occurrence
                            WHERE person_id IN (SELECT person_id FROM orphan_persons)
                            GROUP BY person_id
                            UNION ALL
                            SELECT person_id,
                                   MIN(observation_date),
                                   MAX(observation_date)
                            FROM {SCHEMA}.observation
                            WHERE person_id IN (SELECT person_id FROM orphan_persons)
                            GROUP BY person_id
                        ) dates
                        GROUP BY person_id
                    )
                    SELECT
                        (SELECT COALESCE(MAX(observation_period_id), 0)
                         FROM {SCHEMA}.observation_period)
                            + ROW_NUMBER() OVER (ORDER BY op.person_id),
                        op.person_id,
                        COALESCE(aed.min_date, '2008-01-01'::date),
                        COALESCE(aed.max_date, '2010-12-31'::date),
                        44814722
                    FROM orphan_persons op
                    LEFT JOIN all_event_dates aed ON aed.person_id = op.person_id
                """)
                result.rows_affected = cur.rowcount
            conn.commit()
            result.status = "success"
        except Exception as e:
            conn.rollback()
            result.status = "error"
            result.error_message = str(e)

    result.elapsed_seconds = time.time() - start
    print_after_count("observation_periods inserted", result.rows_affected)
    return result


# ---------------------------------------------------------------------------
# Stage 5: Reclassify Visit Concepts
# ---------------------------------------------------------------------------

VISIT_BATCH_SIZE = 1_000_000


def _visit_worker(batch_ranges: list[tuple[int, int]]) -> int:
    """Worker thread: update visit_concept_id for a list of ID ranges."""
    worker_conn = make_worker_connection()
    updated = 0
    try:
        for batch_start, batch_end in batch_ranges:
            with worker_conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {SCHEMA}.visit_occurrence
                    SET visit_concept_id = 9202
                    WHERE visit_concept_id = 0
                      AND visit_occurrence_id BETWEEN %s AND %s
                """, (batch_start, batch_end))
                updated += cur.rowcount
            worker_conn.commit()
    except Exception:
        worker_conn.rollback()
        raise
    finally:
        worker_conn.close()
    return updated


def stage_5_visit_concepts(conn, dry_run: bool = False) -> StageResult:
    """Reclassify unmapped visit_concept_id = 0 -> 9202 (Outpatient). Parallel."""
    result = StageResult(stage_num=5, name=STAGE_NAMES[5])
    start = time.time()

    before_count = query_scalar(
        conn, f"SELECT count(*) FROM {SCHEMA}.visit_occurrence WHERE visit_concept_id = 0"
    )
    print_before_count("visits with visit_concept_id = 0", before_count)

    if before_count == 0:
        result.status = "skipped"
        result.rows_affected = "already fixed"
        result.elapsed_seconds = time.time() - start
        return result

    if dry_run:
        result.status = "skipped"
        result.rows_affected = before_count
        return result

    # Get ID range for batching
    id_range = query_all(conn, f"""
        SELECT MIN(visit_occurrence_id), MAX(visit_occurrence_id)
        FROM {SCHEMA}.visit_occurrence WHERE visit_concept_id = 0
    """)[0]
    min_id, max_id = id_range

    # Create partial index for performance
    console.print("  Creating partial index for batch updates...")
    conn.rollback()
    conn.set_session(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_visit_concept_zero
                ON {SCHEMA}.visit_occurrence (visit_occurrence_id)
                WHERE visit_concept_id = 0
            """)
    finally:
        conn.set_session(autocommit=False)

    # Build all batch ranges
    all_batches: list[tuple[int, int]] = []
    batch_start = min_id
    while batch_start <= max_id:
        batch_end = batch_start + VISIT_BATCH_SIZE - 1
        all_batches.append((batch_start, min(batch_end, max_id)))
        batch_start = batch_end + 1

    # Partition batches across workers
    workers = min(NUM_WORKERS, len(all_batches))
    chunks: list[list[tuple[int, int]]] = [[] for _ in range(workers)]
    for i, batch in enumerate(all_batches):
        chunks[i % workers].append(batch)

    console.print(f"  Dispatching {len(all_batches)} batches across {workers} workers...")
    total_updated = 0

    try:
        with make_progress() as progress:
            task = progress.add_task(
                "Updating visits...", total=len(all_batches)
            )

            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {
                    executor.submit(_visit_worker, chunk): i
                    for i, chunk in enumerate(chunks)
                }
                for future in as_completed(futures):
                    try:
                        rows = future.result()
                        total_updated += rows
                        # Advance by the number of batches this worker handled
                        worker_idx = futures[future]
                        progress.advance(task, advance=len(chunks[worker_idx]))
                        progress.update(
                            task,
                            description=f"Updating visits... ({total_updated:,} rows)",
                        )
                    except Exception as e:
                        result.status = "error"
                        result.error_message = f"Worker error: {e}"
    finally:
        # Always drop the temporary partial index, even on error
        console.print("  Dropping partial index...")
        conn.rollback()
        conn.set_session(autocommit=True)
        try:
            with conn.cursor() as cur:
                cur.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {SCHEMA}.idx_synpuf_visit_concept_zero")
        finally:
            conn.set_session(autocommit=False)

    if result.status != "error":
        result.status = "success"
    result.rows_affected = total_updated
    result.elapsed_seconds = time.time() - start
    print_after_count("visits updated to Outpatient (9202)", total_updated)
    return result


# ---------------------------------------------------------------------------
# Stage 6: Remap Non-Standard Concepts
# ---------------------------------------------------------------------------

REMAP_TABLES = [
    ("condition_occurrence", "condition_concept_id", "Condition"),
    ("drug_exposure", "drug_concept_id", "Drug"),
    ("procedure_occurrence", "procedure_concept_id", "Procedure"),
]


def _remap_worker(table_name: str, concept_col: str, domain: str) -> tuple[str, int]:
    """Worker thread: remap non-standard concepts for one table."""
    worker_conn = make_worker_connection()
    try:
        with worker_conn.cursor() as cur:
            # Build best-mapping temp table with domain tiebreaking
            cur.execute(f"""
                CREATE TEMP TABLE best_mapping_{table_name} AS
                SELECT DISTINCT ON (cr.concept_id_1)
                    cr.concept_id_1 AS source_concept_id,
                    cr.concept_id_2 AS standard_concept_id
                FROM {VOCAB_SCHEMA}.concept_relationship cr
                JOIN {VOCAB_SCHEMA}.concept c2
                    ON c2.concept_id = cr.concept_id_2
                    AND c2.standard_concept = 'S'
                WHERE cr.relationship_id = 'Maps to'
                ORDER BY cr.concept_id_1,
                    CASE WHEN c2.domain_id = %s THEN 0 ELSE 1 END,
                    cr.concept_id_2
            """, (domain,))

            cur.execute(f"CREATE INDEX ON best_mapping_{table_name} (source_concept_id)")

            cur.execute(f"""
                UPDATE {SCHEMA}.{table_name} t
                SET {concept_col} = bm.standard_concept_id
                FROM best_mapping_{table_name} bm
                WHERE bm.source_concept_id = t.{concept_col}
            """)
            rows = cur.rowcount
            cur.execute(f"DROP TABLE IF EXISTS best_mapping_{table_name}")
        worker_conn.commit()
        return (table_name, rows)
    except Exception:
        worker_conn.rollback()
        try:
            with worker_conn.cursor() as cur2:
                cur2.execute(f"DROP TABLE IF EXISTS best_mapping_{table_name}")
        except Exception:
            pass
        raise
    finally:
        worker_conn.close()


def stage_6_concept_remap(conn, dry_run: bool = False) -> StageResult:
    """Map non-standard concept_ids to standard equivalents. Parallel (3 tables)."""
    result = StageResult(stage_num=6, name=STAGE_NAMES[6])
    start = time.time()
    total_updated = 0

    if dry_run:
        result.status = "skipped"
        result.rows_affected = "~46,000,000"
        return result

    console.print(f"  Dispatching {len(REMAP_TABLES)} tables across parallel workers...")

    with make_progress() as progress:
        task = progress.add_task("Remapping concepts...", total=len(REMAP_TABLES))

        with ThreadPoolExecutor(max_workers=len(REMAP_TABLES)) as executor:
            futures = {
                executor.submit(_remap_worker, table_name, concept_col, domain): table_name
                for table_name, concept_col, domain in REMAP_TABLES
            }
            errors = []
            for future in as_completed(futures):
                table_name = futures[future]
                try:
                    tbl, rows = future.result()
                    total_updated += rows
                    console.print(f"    {tbl}: [green]{rows:,}[/green] rows remapped")
                except Exception as e:
                    errors.append(f"{table_name}: {e}")
                    console.print(f"    [red]{table_name} ERROR: {e}[/red]")
                progress.advance(task)

    if errors:
        result.status = "error"
        result.error_message = "; ".join(errors)
    else:
        result.status = "success"
    result.rows_affected = total_updated
    result.elapsed_seconds = time.time() - start
    print_after_count("total records remapped to standard concepts", total_updated)
    return result


# ---------------------------------------------------------------------------
# Stage 7: Build Drug & Condition Eras
# ---------------------------------------------------------------------------

def _check_era_table(conn, table_name: str, force: bool) -> str | None:
    """Check era table state. Returns 'skip' if should skip, None if ready to build.

    Does NOT truncate — truncation happens atomically during the swap step.
    """
    existing = query_scalar(conn, f"SELECT count(*) FROM {SCHEMA}.{table_name}")
    if existing and existing > 0 and not force:
        console.print(f"    {table_name} has {existing:,} rows. Use --force to rebuild.")
        return "skip"
    if existing and existing > 0:
        console.print(f"    {table_name} has {existing:,} rows (will be replaced atomically)")
    return None


def _get_person_id_modulo_ranges(num_chunks: int) -> list[int]:
    """Return modulo bucket IDs [0, 1, ..., num_chunks-1] for hash sharding.

    Uses person_id % N to assign chunks — no pre-scan of the source table,
    and naturally balanced since SynPUF person_ids are dense integers.
    """
    return list(range(num_chunks))


def _build_condition_era_chunk(bucket: int, num_buckets: int, staging_table: str, work_mem_mb: int) -> int:
    """Build condition_era for person_id % num_buckets == bucket into staging table."""
    worker_conn = make_worker_connection()
    try:
        with worker_conn.cursor() as cur:
            cur.execute(f"SET work_mem = '{work_mem_mb}MB'")
            cur.execute("SET max_parallel_workers_per_gather = 0")
            cur.execute(f"""
                INSERT INTO {staging_table} (
                    person_id, condition_concept_id,
                    condition_era_start_date, condition_era_end_date,
                    condition_occurrence_count
                )
                WITH cteConditionTarget AS (
                    SELECT co.condition_occurrence_id, co.person_id,
                           co.condition_concept_id, co.condition_start_date,
                           COALESCE(co.condition_end_date,
                                    co.condition_start_date + INTERVAL '1 day')
                               AS condition_end_date
                    FROM {SCHEMA}.condition_occurrence co
                    WHERE co.condition_concept_id != 0
                      AND co.person_id % {num_buckets} = {bucket}
                ),
                cteEndDates AS (
                    SELECT person_id, condition_concept_id,
                           event_date - INTERVAL '30 days' AS end_date
                    FROM (
                        SELECT person_id, condition_concept_id, event_date, event_type,
                            MAX(start_ordinal) OVER (
                                PARTITION BY person_id, condition_concept_id
                                ORDER BY event_date, event_type ROWS UNBOUNDED PRECEDING
                            ) AS start_ordinal,
                            ROW_NUMBER() OVER (
                                PARTITION BY person_id, condition_concept_id
                                ORDER BY event_date, event_type
                            ) AS overall_ord
                        FROM (
                            SELECT person_id, condition_concept_id,
                                   condition_start_date AS event_date, -1 AS event_type,
                                   ROW_NUMBER() OVER (
                                       PARTITION BY person_id, condition_concept_id
                                       ORDER BY condition_start_date
                                   ) AS start_ordinal
                            FROM cteConditionTarget
                            UNION ALL
                            SELECT person_id, condition_concept_id,
                                   condition_end_date + INTERVAL '30 days',
                                   1 AS event_type, NULL
                            FROM cteConditionTarget
                        ) RAWDATA
                    ) e
                    WHERE (2 * e.start_ordinal) - e.overall_ord = 0
                ),
                cteConditionEnds AS (
                    SELECT c.person_id, c.condition_concept_id, c.condition_start_date,
                           MIN(e.end_date) AS era_end_date
                    FROM cteConditionTarget c
                    JOIN cteEndDates e ON c.person_id = e.person_id
                        AND c.condition_concept_id = e.condition_concept_id
                        AND e.end_date >= c.condition_start_date
                    GROUP BY c.condition_occurrence_id, c.person_id,
                             c.condition_concept_id, c.condition_start_date
                )
                SELECT person_id, condition_concept_id,
                       MIN(condition_start_date) AS condition_era_start_date,
                       era_end_date AS condition_era_end_date,
                       COUNT(*) AS condition_occurrence_count
                FROM cteConditionEnds
                GROUP BY person_id, condition_concept_id, era_end_date
            """)
            rows = cur.rowcount
        worker_conn.commit()
        return rows
    except Exception:
        worker_conn.rollback()
        raise
    finally:
        worker_conn.close()


def _build_drug_era_chunk(bucket: int, num_buckets: int, staging_table: str, work_mem_mb: int) -> int:
    """Build drug_era for person_id % num_buckets == bucket into staging table."""
    worker_conn = make_worker_connection()
    try:
        with worker_conn.cursor() as cur:
            cur.execute(f"SET work_mem = '{work_mem_mb}MB'")
            cur.execute("SET max_parallel_workers_per_gather = 0")
            cur.execute(f"""
                INSERT INTO {staging_table} (
                    person_id, drug_concept_id,
                    drug_era_start_date, drug_era_end_date,
                    drug_exposure_count, gap_days
                )
                WITH ctePreDrugTarget AS (
                    SELECT d.drug_exposure_id, d.person_id,
                           c.concept_id AS ingredient_concept_id,
                           d.drug_exposure_start_date, d.days_supply,
                           COALESCE(
                               NULLIF(d.drug_exposure_end_date, NULL),
                               NULLIF(d.drug_exposure_start_date
                                   + (INTERVAL '1 day' * COALESCE(d.days_supply, 0)),
                                   d.drug_exposure_start_date),
                               d.drug_exposure_start_date + INTERVAL '1 day'
                           ) AS drug_exposure_end_date
                    FROM {SCHEMA}.drug_exposure d
                    JOIN {VOCAB_SCHEMA}.concept_ancestor ca
                        ON ca.descendant_concept_id = d.drug_concept_id
                    JOIN {VOCAB_SCHEMA}.concept c ON ca.ancestor_concept_id = c.concept_id
                    WHERE c.vocabulary_id = 'RxNorm'
                      AND c.concept_class_id = 'Ingredient'
                      AND d.drug_concept_id != 0
                      AND d.person_id % {num_buckets} = {bucket}
                ),
                cteSubExposureEndDates AS (
                    SELECT person_id, ingredient_concept_id, event_date AS end_date
                    FROM (
                        SELECT person_id, ingredient_concept_id, event_date, event_type,
                            MAX(start_ordinal) OVER (
                                PARTITION BY person_id, ingredient_concept_id
                                ORDER BY event_date, event_type ROWS UNBOUNDED PRECEDING
                            ) AS start_ordinal,
                            ROW_NUMBER() OVER (
                                PARTITION BY person_id, ingredient_concept_id
                                ORDER BY event_date, event_type
                            ) AS overall_ord
                        FROM (
                            SELECT person_id, ingredient_concept_id,
                                   drug_exposure_start_date AS event_date, -1 AS event_type,
                                   ROW_NUMBER() OVER (
                                       PARTITION BY person_id, ingredient_concept_id
                                       ORDER BY drug_exposure_start_date
                                   ) AS start_ordinal
                            FROM ctePreDrugTarget
                            UNION ALL
                            SELECT person_id, ingredient_concept_id,
                                   drug_exposure_end_date, 1 AS event_type, NULL
                            FROM ctePreDrugTarget
                        ) RAWDATA
                    ) e
                    WHERE (2 * e.start_ordinal) - e.overall_ord = 0
                ),
                cteDrugExposureEnds AS (
                    SELECT dt.person_id, dt.ingredient_concept_id,
                           dt.drug_exposure_start_date,
                           MIN(e.end_date) AS drug_sub_exposure_end_date
                    FROM ctePreDrugTarget dt
                    JOIN cteSubExposureEndDates e ON dt.person_id = e.person_id
                        AND dt.ingredient_concept_id = e.ingredient_concept_id
                        AND e.end_date >= dt.drug_exposure_start_date
                    GROUP BY dt.drug_exposure_id, dt.person_id,
                             dt.ingredient_concept_id, dt.drug_exposure_start_date
                ),
                cteSubExposures AS (
                    SELECT ROW_NUMBER() OVER (
                               PARTITION BY person_id, ingredient_concept_id,
                                            drug_sub_exposure_end_date
                           ) AS row_number,
                           person_id, ingredient_concept_id,
                           MIN(drug_exposure_start_date) AS drug_sub_exposure_start_date,
                           drug_sub_exposure_end_date,
                           COUNT(*) AS drug_exposure_count
                    FROM cteDrugExposureEnds
                    GROUP BY person_id, ingredient_concept_id, drug_sub_exposure_end_date
                ),
                cteFinalTarget AS (
                    SELECT row_number, person_id, ingredient_concept_id,
                           drug_sub_exposure_start_date, drug_sub_exposure_end_date,
                           drug_exposure_count,
                           drug_sub_exposure_end_date - drug_sub_exposure_start_date AS days_exposed
                    FROM cteSubExposures
                ),
                cteEndDates AS (
                    SELECT person_id, ingredient_concept_id,
                           event_date - INTERVAL '30 days' AS end_date
                    FROM (
                        SELECT person_id, ingredient_concept_id, event_date, event_type,
                            MAX(start_ordinal) OVER (
                                PARTITION BY person_id, ingredient_concept_id
                                ORDER BY event_date, event_type ROWS UNBOUNDED PRECEDING
                            ) AS start_ordinal,
                            ROW_NUMBER() OVER (
                                PARTITION BY person_id, ingredient_concept_id
                                ORDER BY event_date, event_type
                            ) AS overall_ord
                        FROM (
                            SELECT person_id, ingredient_concept_id,
                                   drug_sub_exposure_start_date AS event_date, -1 AS event_type,
                                   ROW_NUMBER() OVER (
                                       PARTITION BY person_id, ingredient_concept_id
                                       ORDER BY drug_sub_exposure_start_date
                                   ) AS start_ordinal
                            FROM cteFinalTarget
                            UNION ALL
                            SELECT person_id, ingredient_concept_id,
                                   drug_sub_exposure_end_date + INTERVAL '30 days',
                                   1 AS event_type, NULL
                            FROM cteFinalTarget
                        ) RAWDATA
                    ) e
                    WHERE (2 * e.start_ordinal) - e.overall_ord = 0
                ),
                cteDrugEraEnds AS (
                    SELECT ft.person_id, ft.ingredient_concept_id,
                           ft.drug_sub_exposure_start_date,
                           MIN(e.end_date) AS era_end_date,
                           ft.drug_exposure_count, ft.days_exposed
                    FROM cteFinalTarget ft
                    JOIN cteEndDates e ON ft.person_id = e.person_id
                        AND ft.ingredient_concept_id = e.ingredient_concept_id
                        AND e.end_date >= ft.drug_sub_exposure_start_date
                    GROUP BY ft.person_id, ft.ingredient_concept_id,
                             ft.drug_sub_exposure_start_date,
                             ft.drug_exposure_count, ft.days_exposed
                )
                SELECT person_id, ingredient_concept_id,
                       MIN(drug_sub_exposure_start_date) AS drug_era_start_date,
                       era_end_date AS drug_era_end_date,
                       SUM(drug_exposure_count) AS drug_exposure_count,
                       EXTRACT(EPOCH FROM
                           era_end_date - MIN(drug_sub_exposure_start_date)
                           - SUM(days_exposed)
                       )::integer / 86400 AS gap_days
                FROM cteDrugEraEnds
                GROUP BY person_id, ingredient_concept_id, era_end_date
            """)
            rows = cur.rowcount
        worker_conn.commit()
        return rows
    except Exception:
        worker_conn.rollback()
        raise
    finally:
        worker_conn.close()


_ERA_CHUNK_BUILDER: dict[str, Any] = {
    "condition_era": _build_condition_era_chunk,
    "drug_era": _build_drug_era_chunk,
}

# Staging table DDL (unlogged for speed — data is ephemeral)
_STAGING_DDL: dict[str, str] = {
    "condition_era": f"""
        CREATE UNLOGGED TABLE IF NOT EXISTS {{staging}} (
            person_id               BIGINT NOT NULL,
            condition_concept_id    INTEGER NOT NULL,
            condition_era_start_date DATE NOT NULL,
            condition_era_end_date  DATE NOT NULL,
            condition_occurrence_count INTEGER
        )
    """,
    "drug_era": f"""
        CREATE UNLOGGED TABLE IF NOT EXISTS {{staging}} (
            person_id               BIGINT NOT NULL,
            drug_concept_id         INTEGER NOT NULL,
            drug_era_start_date     DATE NOT NULL,
            drug_era_end_date       DATE NOT NULL,
            drug_exposure_count     INTEGER,
            gap_days                INTEGER
        )
    """,
}

_FINAL_INSERT_COLUMNS: dict[str, str] = {
    "condition_era": """
        person_id,
        condition_concept_id,
        condition_era_start_date,
        condition_era_end_date,
        condition_occurrence_count
    """,
    "drug_era": """
        person_id,
        drug_concept_id,
        drug_era_start_date,
        drug_era_end_date,
        drug_exposure_count,
        gap_days
    """,
}

# Memory budget: cap total work_mem across all workers to ~8GB.
# work_mem is per-sort-node, NOT per-query — a drug_era query has ~6 sort/window
# ops, so actual peak = work_mem × 6 × num_workers. 8GB / 8 workers = 1GB each,
# × 6 nodes = ~6GB peak per worker, × 8 = ~48GB theoretical max — but PG reclaims
# between nodes so real peak is ~24GB. With shared_buffers (16GB) + OS + Docker,
# this fits within 128GB.
_TOTAL_WORK_MEM_MB = int(os.environ.get("SYNPUF_TOTAL_WORK_MEM_MB", "8192"))


def _build_era_parallel(
    table_name: str,
    num_workers: int,
    progress: Progress,
) -> tuple[str, int]:
    """Build an era table using N parallel workers with staging-then-swap.

    Pattern:
      1. CREATE UNLOGGED staging table (no WAL overhead)
      2. N workers INSERT into staging via person_id % N hash sharding
      3. If ALL succeed: TRUNCATE final + INSERT INTO final SELECT FROM staging
      4. If ANY fail: DROP staging, raise — final table untouched
    """
    chunk_builder = _ERA_CHUNK_BUILDER[table_name]
    staging = f"{SCHEMA}._staging_{table_name}"
    work_mem_per_worker = max(64, _TOTAL_WORK_MEM_MB // num_workers)

    # Create staging table (use a dedicated connection to avoid autocommit toggling)
    setup_conn = make_worker_connection()
    setup_conn.set_session(autocommit=True)
    try:
        with setup_conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {staging}")
            cur.execute(_STAGING_DDL[table_name].format(staging=staging))
    finally:
        setup_conn.close()

    buckets = _get_person_id_modulo_ranges(num_workers)
    task = progress.add_task(
        f"  {table_name} [0/{len(buckets)} chunks]", total=len(buckets)
    )
    total_rows = 0
    completed = 0
    failed = False
    first_error: Exception | None = None

    try:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(chunk_builder, b, num_workers, staging, work_mem_per_worker): b
                for b in buckets
            }
            for future in as_completed(futures):
                try:
                    rows = future.result()
                    total_rows += rows
                    completed += 1
                    progress.update(
                        task,
                        advance=1,
                        description=(
                            f"  {table_name} [{completed}/{len(buckets)} chunks, "
                            f"{total_rows:,} rows]"
                        ),
                    )
                except Exception as e:
                    failed = True
                    if first_error is None:
                        first_error = e
                    console.print(f"    [red]chunk failed: {e}[/red]")

        if failed:
            # All-or-nothing: drop staging, leave final table untouched
            try:
                cleanup_conn = make_worker_connection()
                cleanup_conn.set_session(autocommit=True)
                with cleanup_conn.cursor() as cur:
                    cur.execute(f"DROP TABLE IF EXISTS {staging}")
                cleanup_conn.close()
            except Exception:
                pass
            raise first_error  # type: ignore[misc]

        # Atomic swap: TRUNCATE + INSERT + DROP in one explicit transaction.
        # If any step fails, the entire transaction rolls back and the
        # final table retains its previous contents.
        console.print(f"    Swapping staging → {table_name} (single transaction)...")
        swap_conn = make_worker_connection()
        try:
            with swap_conn.cursor() as cur:
                cur.execute(f"TRUNCATE {SCHEMA}.{table_name}")
                cur.execute(
                    f"""
                    INSERT INTO {SCHEMA}.{table_name} (
                        {_FINAL_INSERT_COLUMNS[table_name]}
                    )
                    SELECT * FROM {staging}
                    """
                )
                swap_rows = cur.rowcount
                cur.execute(f"DROP TABLE {staging}")
            swap_conn.commit()
        except Exception:
            swap_conn.rollback()
            # Staging table may still exist — clean it up outside the failed txn
            try:
                cleanup_conn = make_worker_connection()
                cleanup_conn.set_session(autocommit=True)
                with cleanup_conn.cursor() as cur:
                    cur.execute(f"DROP TABLE IF EXISTS {staging}")
                cleanup_conn.close()
            except Exception:
                pass
            raise
        finally:
            swap_conn.close()

        console.print(f"    Swap complete: {swap_rows:,} rows")
        return (table_name, swap_rows)

    except Exception:
        # Cleanup staging on any unexpected error
        try:
            cleanup_conn = make_worker_connection()
            cleanup_conn.set_session(autocommit=True)
            with cleanup_conn.cursor() as cur:
                cur.execute(f"DROP TABLE IF EXISTS {staging}")
            cleanup_conn.close()
        except Exception:
            pass
        raise


def stage_7_era_build(conn, dry_run: bool = False, force: bool = False) -> StageResult:
    """Build drug_era and condition_era using chunked parallel workers.

    Uses staging-then-swap pattern for atomicity: all chunks write to an
    UNLOGGED staging table, then a single INSERT INTO ... SELECT swaps
    the data into the final table. If any chunk fails, the final table
    is untouched.

    Splits work by person_id % N (hash sharding) — no pre-scan needed.
    Memory budget is capped at SYNPUF_TOTAL_WORK_MEM_MB (default 24GB)
    divided evenly across workers.
    """
    result = StageResult(stage_num=7, name=STAGE_NAMES[7])
    start = time.time()

    if dry_run:
        result.status = "skipped"
        result.rows_affected = "~15,000,000"
        return result

    total_inserted = 0
    skipped_tables = []
    errored_tables = []

    # Check era tables on a short-lived connection to avoid holding locks
    # that block the parallel workers' TRUNCATE during the swap phase.
    tables_to_build = []
    check_conn = make_worker_connection()
    try:
        for table_name in ["condition_era", "drug_era"]:
            console.print(f"\n  Checking {table_name}...")
            skip = _check_era_table(check_conn, table_name, force)
            if skip:
                skipped_tables.append(table_name)
            else:
                tables_to_build.append(table_name)
    finally:
        check_conn.close()  # Close immediately — no lingering locks

    if not tables_to_build:
        result.status = "skipped"
        result.rows_affected = "both tables skipped (use --force)"
        result.elapsed_seconds = time.time() - start
        return result

    num_workers = NUM_WORKERS  # default 16, capped to cpu_count
    work_mem_per = max(64, _TOTAL_WORK_MEM_MB // num_workers)
    console.print(
        f"\n  Building {len(tables_to_build)} era table(s) "
        f"with [bold]{num_workers}[/bold] parallel workers "
        f"([bold]{work_mem_per}MB[/bold] work_mem each)..."
    )

    # Build each era table sequentially (each uses N parallel workers internally)
    # Sequential to avoid WAL contention between two heavy write streams
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("•"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        for table_name in tables_to_build:
            try:
                name, rows = _build_era_parallel(table_name, num_workers, progress)
                total_inserted += rows
                console.print(f"    {name}: [green]{rows:,}[/green] rows")
            except Exception as e:
                errored_tables.append(table_name)
                console.print(f"    [red]{table_name} ERROR: {e}[/red]")
                if result.error_message:
                    result.error_message += f"; {table_name}: {e}"
                else:
                    result.error_message = f"{table_name}: {e}"

    # Final status
    if errored_tables and not total_inserted:
        result.status = "error"
        result.rows_affected = f"FAILED: {', '.join(errored_tables)}"
    elif errored_tables:
        result.status = "error"
        result.rows_affected = f"{total_inserted:,} ({', '.join(errored_tables)} failed)"
    elif skipped_tables:
        result.status = "success"
        result.rows_affected = f"{total_inserted:,} ({', '.join(skipped_tables)} skipped)"
    else:
        result.status = "success"
        result.rows_affected = total_inserted

    result.elapsed_seconds = time.time() - start
    print_after_count("total era rows built", total_inserted)
    return result


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

STAGE_FUNCTIONS = {
    1: stage_1_cdm_source,
    2: stage_2_empty_tables,
    3: stage_3_race,
    4: stage_4_observation_periods,
    5: stage_5_visit_concepts,
    6: stage_6_concept_remap,
    7: stage_7_era_build,
}


def run_stage(stage_num: int, conn, dry_run: bool, force: bool) -> StageResult:
    """Run a single enrichment stage with error handling."""
    func = STAGE_FUNCTIONS[stage_num]

    print_stage_header(stage_num, 7, STAGE_NAMES[stage_num])

    try:
        if stage_num == 7:
            return func(conn, dry_run=dry_run, force=force)
        else:
            return func(conn, dry_run=dry_run)
    except Exception as e:
        console.print(f"  [red]Unexpected error: {e}[/red]")
        return StageResult(
            stage_num=stage_num,
            name=STAGE_NAMES[stage_num],
            status="error",
            error_message=str(e),
        )


def main():
    args = parse_args()
    stages = parse_stage_range(args.stage)

    # Validate stage numbers
    for s in stages:
        if s not in STAGE_NAMES:
            console.print(f"[red]Invalid stage number: {s}. Valid: 1-7[/red]")
            sys.exit(1)

    # Header
    console.print()
    console.print(
        Panel(
            "[bold]SynPUF OMOP CDM v5.4 Data Enrichment[/bold]\n"
            f"Database: {DB_DSN['host']}:{DB_DSN['port']}/{DB_DSN['dbname']}\n"
            f"Schema: {SCHEMA}\n"
            f"Stages: {', '.join(str(s) for s in stages)}"
            + (" [yellow](DRY RUN)[/yellow]" if args.dry_run else ""),
            title="Parthenon",
            border_style="cyan",
        )
    )

    # Dry run mode
    if args.dry_run:
        with get_connection() as conn:
            print_dry_run_table(stages, conn)
        return

    # Run stages
    results: list[StageResult] = []

    with get_connection() as conn:
        for stage_num in stages:
            result = run_stage(stage_num, conn, dry_run=False, force=args.force)
            results.append(result)

            if result.status == "error" and args.stop_on_error:
                console.print(f"\n[red]Stopping due to error in stage {stage_num}:[/red] {result.error_message}")
                break

    # Summary
    print_summary_table(results)

    # Exit code: 1 if any stage failed
    if any(r.status == "error" for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
