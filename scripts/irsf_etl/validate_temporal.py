"""Temporal integrity validation for the IRSF-NHS OMOP CDM data.

Verifies zero events occur before birth or after death across all clinical
event tables. This directly validates requirement VAL-03.

Usage (standalone):
    python -m scripts.irsf_etl.validate_temporal

Usage (as module):
    from scripts.irsf_etl.validate_temporal import run_temporal_validation
    from scripts.irsf_etl.config import ETLConfig

    config = ETLConfig()
    report = run_temporal_validation(config)
    assert report["all_passed"] is True
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg2

from scripts.irsf_etl.config import ETLConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Event table definitions
# ---------------------------------------------------------------------------

# Each tuple: (table_name, date_column, display_name)
_EVENT_TABLES: list[tuple[str, str, str]] = [
    ("condition_occurrence", "condition_start_date", "condition_occurrence"),
    ("drug_exposure", "drug_exposure_start_date", "drug_exposure"),
    ("measurement", "measurement_date", "measurement"),
    ("observation", "observation_date", "observation"),
    ("visit_occurrence", "visit_start_date", "visit_occurrence"),
]

# SQL template for events before birth (year comparison since OMOP person
# stores year_of_birth, not full date in all cases)
_BEFORE_BIRTH_SQL = """
SELECT COUNT(*) AS violations
FROM omop.{table} t
JOIN omop.person p ON t.person_id = p.person_id
WHERE p.year_of_birth IS NOT NULL
  AND EXTRACT(YEAR FROM t.{date_col}) < p.year_of_birth
"""

# SQL template for events after death
_AFTER_DEATH_SQL = """
SELECT COUNT(*) AS violations
FROM omop.{table} t
JOIN omop.death d ON t.person_id = d.person_id
WHERE t.{date_col} > d.death_date
"""


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TemporalCheckResult:
    """Result of a single temporal integrity check."""

    table: str
    check_type: str  # "before_birth" or "after_death"
    violations: int
    passed: bool


# ---------------------------------------------------------------------------
# Validation logic
# ---------------------------------------------------------------------------


def _run_check(
    cur: Any,
    sql_template: str,
    table: str,
    date_col: str,
    check_type: str,
) -> TemporalCheckResult:
    """Execute a single temporal check and return the result.

    Args:
        cur: psycopg2 cursor.
        sql_template: SQL template with {table} and {date_col} placeholders.
        table: OMOP event table name.
        date_col: Date column name in the event table.
        check_type: "before_birth" or "after_death".

    Returns:
        TemporalCheckResult with violation count.
    """
    sql = sql_template.format(table=table, date_col=date_col)
    cur.execute(sql)
    row = cur.fetchone()
    violations = int(row[0]) if row else 0

    passed = violations == 0
    status = "PASS" if passed else "FAIL"
    logger.info(
        "  %s | %s.%s (%s): %d violations [%s]",
        check_type, table, date_col, check_type, violations, status,
    )

    return TemporalCheckResult(
        table=table,
        check_type=check_type,
        violations=violations,
        passed=passed,
    )


def run_temporal_checks(config: ETLConfig) -> list[TemporalCheckResult]:
    """Run all temporal integrity checks against the OMOP schema.

    Args:
        config: ETLConfig with database connection parameters.

    Returns:
        List of TemporalCheckResult for each check.
    """
    conn_params = {
        **config.db_connection_params,
        "options": "-c search_path=omop",
    }

    results: list[TemporalCheckResult] = []

    with psycopg2.connect(**conn_params) as conn:
        with conn.cursor() as cur:
            logger.info("Running temporal integrity checks (before birth)...")
            for table, date_col, _display in _EVENT_TABLES:
                result = _run_check(cur, _BEFORE_BIRTH_SQL, table, date_col, "before_birth")
                results.append(result)

            logger.info("Running temporal integrity checks (after death)...")
            for table, date_col, _display in _EVENT_TABLES:
                result = _run_check(cur, _AFTER_DEATH_SQL, table, date_col, "after_death")
                results.append(result)

    return results


def run_temporal_validation(config: ETLConfig) -> dict[str, Any]:
    """Run temporal validation and produce a structured report.

    Args:
        config: ETLConfig with database connection parameters.

    Returns:
        Dict with before_birth, after_death, and all_passed fields.
    """
    checks = run_temporal_checks(config)

    before_birth: dict[str, int] = {}
    after_death: dict[str, int] = {}

    for check in checks:
        if check.check_type == "before_birth":
            before_birth[check.table] = check.violations
        else:
            after_death[check.table] = check.violations

    all_passed = all(c.passed for c in checks)
    total_violations = sum(c.violations for c in checks)

    return {
        "before_birth": before_birth,
        "after_death": after_death,
        "total_violations": total_violations,
        "all_passed": all_passed,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    """Build argument parser for standalone execution."""
    parser = argparse.ArgumentParser(
        description="Verify zero temporal integrity violations in OMOP CDM data",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path for report JSON (default: output/reports/temporal_report.json)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    return parser


def main() -> None:
    """CLI entry point."""
    parser = _build_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = ETLConfig()

    logger.info("Starting temporal integrity validation...")
    report = run_temporal_validation(config)

    # Write report
    output_path = args.output or config.reports_dir / "temporal_report.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, default=str))
    logger.info("Temporal report written to %s", output_path)

    # Print summary
    all_passed = report["all_passed"]
    total_violations = report["total_violations"]

    print(f"\nTemporal Integrity: {'PASSED' if all_passed else 'FAILED'}")
    print(f"  Total violations: {total_violations}")

    print("\n  Before Birth:")
    for table, count in report["before_birth"].items():
        status = "PASS" if count == 0 else "FAIL"
        print(f"    {table}: {count} [{status}]")

    print("\n  After Death:")
    for table, count in report["after_death"].items():
        status = "PASS" if count == 0 else "FAIL"
        print(f"    {table}: {count} [{status}]")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
