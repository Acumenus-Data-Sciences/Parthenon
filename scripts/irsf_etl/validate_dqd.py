"""DQD validation script for IRSF-NHS OMOP CDM data.

Dispatches a Data Quality Dashboard run against the IRSF-NHS source
via the Parthenon API, polls for completion, and verifies that the
pass rate on populated tables meets the >= 80% threshold (VAL-01).

Usage:
    python -m scripts.irsf_etl validate-dqd --source-id 57

If the API is unavailable, the script can also query DQD results
directly from the database for an existing run:
    python -m scripts.irsf_etl validate-dqd --run-id <uuid> --db-only

Environment variables:
    PARTHENON_API_URL   Base API URL (default: http://localhost:8082/api/v1)
    PARTHENON_API_TOKEN Sanctum bearer token for authenticated requests
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DEFAULT_API_URL = "http://localhost:8082/api/v1"
_PASS_RATE_TARGET = 80.0
_POLL_INTERVAL_SECONDS = 10
_POLL_TIMEOUT_SECONDS = 600  # 10 minutes max


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CategoryResult:
    """Pass/fail breakdown for a single DQD category."""

    category: str
    total: int
    passed: int
    rate: float


@dataclass(frozen=True)
class TableResult:
    """Pass/fail breakdown for a single OMOP table."""

    table_name: str
    total: int
    passed: int
    rate: float


@dataclass(frozen=True)
class FailedCheck:
    """A single DQD check that failed."""

    check_name: str
    table_name: str
    column_name: str | None
    category: str
    description: str | None


@dataclass
class DqdValidationReport:
    """Complete DQD validation report."""

    run_id: str
    timestamp: str
    overall_pass_rate: float
    populated_table_pass_rate: float
    target_met: bool
    target: float
    by_category: list[CategoryResult] = field(default_factory=list)
    by_table: list[TableResult] = field(default_factory=list)
    failed_checks: list[FailedCheck] = field(default_factory=list)
    total_checks: int = 0
    passed_checks: int = 0
    populated_checks: int = 0
    populated_passed: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-compatible dictionary."""
        result: dict[str, Any] = {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "overall_pass_rate": self.overall_pass_rate,
            "populated_table_pass_rate": self.populated_table_pass_rate,
            "target_met": self.target_met,
            "target": self.target,
            "total_checks": self.total_checks,
            "passed_checks": self.passed_checks,
            "populated_checks": self.populated_checks,
            "populated_passed": self.populated_passed,
            "by_category": {
                c.category: {"total": c.total, "passed": c.passed, "rate": c.rate}
                for c in self.by_category
            },
            "by_table": {
                t.table_name: {"total": t.total, "passed": t.passed, "rate": t.rate}
                for t in self.by_table
            },
            "failed_checks": [asdict(f) for f in self.failed_checks],
        }
        return result


# ---------------------------------------------------------------------------
# API-based DQD execution
# ---------------------------------------------------------------------------

def _get_api_headers() -> dict[str, str]:
    """Build Authorization headers from environment."""
    token = os.environ.get("PARTHENON_API_TOKEN", "")
    if not token:
        logger.warning(
            "PARTHENON_API_TOKEN not set -- API calls will likely fail with 401"
        )
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def dispatch_dqd_run(source_id: int) -> str | None:
    """Dispatch a DQD run via the Parthenon API. Returns the run_id or None on failure."""
    try:
        import requests
    except ImportError:
        logger.error("requests library not installed. Run: pip install requests")
        return None

    api_url = os.environ.get("PARTHENON_API_URL", _DEFAULT_API_URL).rstrip("/")
    url = f"{api_url}/sources/{source_id}/dqd/run"
    headers = _get_api_headers()

    try:
        response = requests.post(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        run_id = data.get("data", {}).get("run_id") or data.get("run_id")
        if run_id:
            logger.info("DQD run dispatched: run_id=%s", run_id)
            return str(run_id)
        logger.error("No run_id in response: %s", data)
        return None
    except Exception:
        logger.exception("Failed to dispatch DQD run for source %d", source_id)
        return None


def poll_dqd_progress(source_id: int, run_id: str) -> bool:
    """Poll DQD run progress until complete or timeout. Returns True if completed."""
    try:
        import requests
    except ImportError:
        return False

    api_url = os.environ.get("PARTHENON_API_URL", _DEFAULT_API_URL).rstrip("/")
    url = f"{api_url}/sources/{source_id}/dqd/runs/{run_id}/progress"
    headers = _get_api_headers()

    elapsed = 0
    while elapsed < _POLL_TIMEOUT_SECONDS:
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            progress = data.get("data", data)
            status = progress.get("status", "unknown")
            pct = progress.get("progress", 0)
            logger.info("DQD progress: %s (%.0f%%)", status, pct)

            if status in ("completed", "complete", "finished"):
                return True
            if status in ("failed", "error"):
                logger.error("DQD run failed: %s", progress.get("error", "unknown"))
                return False
        except Exception:
            logger.warning("Progress poll error (will retry)")

        time.sleep(_POLL_INTERVAL_SECONDS)
        elapsed += _POLL_INTERVAL_SECONDS

    logger.error("DQD run timed out after %d seconds", _POLL_TIMEOUT_SECONDS)
    return False


def fetch_dqd_results(source_id: int, run_id: str) -> list[dict[str, Any]]:
    """Fetch DQD results from the API."""
    try:
        import requests
    except ImportError:
        return []

    api_url = os.environ.get("PARTHENON_API_URL", _DEFAULT_API_URL).rstrip("/")
    url = f"{api_url}/sources/{source_id}/dqd/runs/{run_id}/results"
    headers = _get_api_headers()

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        results = data.get("data", data)
        if isinstance(results, list):
            return results
        # May be paginated or nested
        if isinstance(results, dict) and "results" in results:
            return results["results"]
        return []
    except Exception:
        logger.exception("Failed to fetch DQD results")
        return []


# ---------------------------------------------------------------------------
# Database-direct DQD result query
# ---------------------------------------------------------------------------

def fetch_dqd_results_from_db(run_id: str) -> list[dict[str, Any]]:
    """Query DQD results directly from the app.dqd_results table."""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        return []

    from scripts.irsf_etl.config import ETLConfig

    config = ETLConfig()
    conn_params = {
        "host": config.db_host,
        "port": config.db_port,
        "dbname": config.db_database,
        "user": config.db_username,
        "password": config.db_password,
        "options": "-c search_path=app",
    }

    try:
        conn = psycopg2.connect(**conn_params)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    check_name,
                    cdm_table_name AS table_name,
                    cdm_field_name AS column_name,
                    category,
                    description,
                    passed,
                    num_violated_rows,
                    num_denominator_rows,
                    threshold_value,
                    execution_time
                FROM app.dqd_results
                WHERE run_id = %s
                """,
                (run_id,),
            )
            rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        logger.exception("Failed to query DQD results from database")
        return []


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def analyze_results(
    results: list[dict[str, Any]],
    run_id: str,
) -> DqdValidationReport:
    """Analyze DQD results and produce a validation report.

    Excludes checks on empty tables (num_denominator_rows == 0 or NULL)
    from the populated-table pass rate calculation per VAL-01.
    """
    now = datetime.now(timezone.utc).isoformat()

    total_checks = len(results)
    passed_all = sum(1 for r in results if r.get("passed"))

    # Populated = checks where denominator rows > 0
    populated = [
        r for r in results
        if (r.get("num_denominator_rows") or 0) > 0
    ]
    populated_count = len(populated)
    populated_passed = sum(1 for r in populated if r.get("passed"))

    overall_rate = (passed_all / total_checks * 100) if total_checks > 0 else 0.0
    populated_rate = (
        (populated_passed / populated_count * 100) if populated_count > 0 else 0.0
    )

    # Per-category breakdown
    categories: dict[str, dict[str, int]] = {}
    for r in populated:
        cat = r.get("category", "unknown")
        if cat not in categories:
            categories[cat] = {"total": 0, "passed": 0}
        categories[cat]["total"] += 1
        if r.get("passed"):
            categories[cat]["passed"] += 1

    cat_results = [
        CategoryResult(
            category=cat,
            total=stats["total"],
            passed=stats["passed"],
            rate=round(stats["passed"] / stats["total"] * 100, 2) if stats["total"] > 0 else 0.0,
        )
        for cat, stats in sorted(categories.items())
    ]

    # Per-table breakdown
    tables: dict[str, dict[str, int]] = {}
    for r in populated:
        tbl = r.get("table_name", "unknown")
        if tbl not in tables:
            tables[tbl] = {"total": 0, "passed": 0}
        tables[tbl]["total"] += 1
        if r.get("passed"):
            tables[tbl]["passed"] += 1

    tbl_results = [
        TableResult(
            table_name=tbl,
            total=stats["total"],
            passed=stats["passed"],
            rate=round(stats["passed"] / stats["total"] * 100, 2) if stats["total"] > 0 else 0.0,
        )
        for tbl, stats in sorted(tables.items())
    ]

    # Failed checks
    failed = [
        FailedCheck(
            check_name=r.get("check_name", ""),
            table_name=r.get("table_name", ""),
            column_name=r.get("column_name"),
            category=r.get("category", ""),
            description=r.get("description"),
        )
        for r in populated
        if not r.get("passed")
    ]

    return DqdValidationReport(
        run_id=run_id,
        timestamp=now,
        overall_pass_rate=round(overall_rate, 2),
        populated_table_pass_rate=round(populated_rate, 2),
        target_met=populated_rate >= _PASS_RATE_TARGET,
        target=_PASS_RATE_TARGET,
        by_category=cat_results,
        by_table=tbl_results,
        failed_checks=failed,
        total_checks=total_checks,
        passed_checks=passed_all,
        populated_checks=populated_count,
        populated_passed=populated_passed,
    )


# ---------------------------------------------------------------------------
# Report output
# ---------------------------------------------------------------------------

def print_report(report: DqdValidationReport) -> None:
    """Print a human-readable DQD validation summary to stdout."""
    status = "PASS" if report.target_met else "FAIL"
    print(f"\n{'=' * 60}")
    print(f"DQD Validation Report  [{status}]")
    print(f"{'=' * 60}")
    print(f"  Run ID:                    {report.run_id}")
    print(f"  Timestamp:                 {report.timestamp}")
    print(f"  Total checks:              {report.total_checks}")
    print(f"  Passed (all):              {report.passed_checks}")
    print(f"  Overall pass rate:         {report.overall_pass_rate:.1f}%")
    print(f"  Populated checks:          {report.populated_checks}")
    print(f"  Populated passed:          {report.populated_passed}")
    print(f"  Populated pass rate:       {report.populated_table_pass_rate:.1f}%")
    print(f"  Target:                    >= {report.target:.0f}%")
    print(f"  Target met:                {report.target_met}")

    if report.by_category:
        print(f"\n--- Per-Category Breakdown ---")
        for cat in report.by_category:
            print(f"  {cat.category:20s}  {cat.passed}/{cat.total}  ({cat.rate:.1f}%)")

    if report.by_table:
        print(f"\n--- Per-Table Breakdown ---")
        for tbl in report.by_table:
            print(f"  {tbl.table_name:30s}  {tbl.passed}/{tbl.total}  ({tbl.rate:.1f}%)")

    if report.failed_checks:
        print(f"\n--- Failed Checks ({len(report.failed_checks)}) ---")
        for fc in report.failed_checks[:20]:  # Show first 20
            col = f".{fc.column_name}" if fc.column_name else ""
            print(f"  [{fc.category}] {fc.check_name} on {fc.table_name}{col}")
            if fc.description:
                print(f"    {fc.description}")
        if len(report.failed_checks) > 20:
            print(f"  ... and {len(report.failed_checks) - 20} more (see JSON report)")

    print(f"{'=' * 60}\n")


def save_report(report: DqdValidationReport, output_path: Path) -> None:
    """Save the validation report as JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(report.to_dict(), f, indent=2, default=str)
    logger.info("Report saved to %s", output_path)


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def run_validate_dqd(
    source_id: int | None = None,
    run_id: str | None = None,
    db_only: bool = False,
    output_dir: Path | None = None,
) -> DqdValidationReport | None:
    """Run the DQD validation workflow.

    Modes:
    1. source_id provided, no run_id: Dispatch new DQD run via API, poll, analyze.
    2. run_id provided with db_only: Query results directly from database.
    3. source_id + run_id: Fetch existing run results via API.
    """
    from scripts.irsf_etl.config import ETLConfig

    config = ETLConfig()
    if output_dir is None:
        output_dir = config.reports_dir

    results: list[dict[str, Any]] = []

    if run_id and db_only:
        # Mode 2: Direct DB query
        logger.info("Querying DQD results from database for run_id=%s", run_id)
        results = fetch_dqd_results_from_db(run_id)
    elif source_id and not run_id:
        # Mode 1: Dispatch new run
        logger.info("Dispatching DQD run for source_id=%d", source_id)
        run_id = dispatch_dqd_run(source_id)
        if not run_id:
            logger.error("Failed to dispatch DQD run. See instructions below.")
            _print_manual_instructions(source_id)
            return None

        completed = poll_dqd_progress(source_id, run_id)
        if not completed:
            logger.error("DQD run did not complete. Try --db-only with the run_id later.")
            return None

        results = fetch_dqd_results(source_id, run_id)
    elif source_id and run_id:
        # Mode 3: Fetch existing run via API
        logger.info("Fetching existing DQD run results: source=%d, run=%s", source_id, run_id)
        results = fetch_dqd_results(source_id, run_id)
    else:
        logger.error("Must provide --source-id or --run-id (with --db-only)")
        return None

    if not results:
        logger.error("No DQD results found. The DQD run may not have completed.")
        _print_manual_instructions(source_id or 0)
        return None

    assert run_id is not None
    report = analyze_results(results, run_id)
    print_report(report)
    save_report(report, output_dir / "dqd_validation_report.json")

    return report


def _print_manual_instructions(source_id: int) -> None:
    """Print instructions for manually running DQD."""
    print(
        "\n"
        "MANUAL DQD EXECUTION INSTRUCTIONS\n"
        "==================================\n"
        "If the API is unavailable, run DQD manually:\n"
        "\n"
        "  1. Start Horizon queue worker:\n"
        "     docker compose exec php php artisan horizon\n"
        "\n"
        f"  2. Dispatch DQD via tinker:\n"
        f"     docker compose exec php php artisan tinker --execute=\"\n"
        f"       \\App\\Jobs\\Dqd\\RunDqdJob::dispatch({source_id});\"\n"
        "\n"
        "  3. Monitor progress in Horizon dashboard:\n"
        "     http://localhost:8082/horizon\n"
        "\n"
        "  4. Once complete, re-run this script with --db-only:\n"
        "     python -m scripts.irsf_etl validate-dqd --run-id <UUID> --db-only\n"
        "\n"
        "  5. Find the run_id from the dqd_runs table:\n"
        "     docker compose exec postgres psql -U parthenon -c \n"
        "       \"SELECT id, status, created_at FROM app.dqd_runs ORDER BY created_at DESC LIMIT 5;\"\n"
    )
