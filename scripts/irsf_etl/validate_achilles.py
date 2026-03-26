"""Achilles characterization validation for the IRSF-NHS data source.

Dispatches an Achilles run via the Parthenon API, polls for completion,
and verifies results exist in the results schema with expected metrics.

Usage (standalone):
    python -m scripts.irsf_etl.validate_achilles --source-id 57

Usage (as module):
    from scripts.irsf_etl.validate_achilles import run_achilles_validation
    from scripts.irsf_etl.config import ETLConfig

    config = ETLConfig()
    report = run_achilles_validation(config, source_id=57, api_token="...")

NOTE: Achilles can take 10+ minutes for large datasets. If the API times out,
re-run with a longer --timeout or check progress manually:
    GET /api/v1/sources/{sourceId}/achilles/runs/{runId}/progress
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import psycopg2
import requests

from scripts.irsf_etl.config import ETLConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_API_BASE = "http://localhost:8082/api/v1"
_DEFAULT_SOURCE_ID = 57
_DEFAULT_POLL_INTERVAL_SEC = 15
_DEFAULT_TIMEOUT_SEC = 900  # 15 minutes
_MIN_EXPECTED_ANALYSES = 10
_MAX_FAILURE_RATE = 0.10  # 10%

# Key Achilles analysis IDs to verify
_KEY_ANALYSES: dict[int, str] = {
    1: "Person count",
    2: "Gender distribution",
    101: "Age at first observation distribution",
    200: "Visit occurrence counts",
    400: "Condition occurrence counts",
    700: "Drug exposure counts",
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AchillesRunResult:
    """Immutable result of an Achilles run attempt."""

    run_id: str | None
    status: str
    total_analyses: int
    completed_analyses: int
    failed_analyses: int
    error: str | None = None


@dataclass(frozen=True)
class AchillesVerification:
    """Immutable result of Achilles results verification."""

    results_row_count: int
    distinct_analyses: int
    key_metrics: dict[str, Any] = field(default_factory=dict)
    api_endpoints_ok: dict[str, bool] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# API interaction
# ---------------------------------------------------------------------------


def _get_headers(token: str) -> dict[str, str]:
    """Build authorization headers for API requests."""
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def dispatch_achilles_run(
    source_id: int,
    api_base: str,
    token: str,
) -> str:
    """Dispatch an Achilles run and return the run ID.

    Args:
        source_id: Parthenon source ID.
        api_base: Base URL for the Parthenon API.
        token: Bearer token for authentication.

    Returns:
        The run ID string.

    Raises:
        RuntimeError: If the API request fails.
    """
    url = f"{api_base}/sources/{source_id}/achilles/run"
    logger.info("Dispatching Achilles run: POST %s", url)

    resp = requests.post(url, headers=_get_headers(token), timeout=60)

    if resp.status_code not in (200, 201, 202):
        raise RuntimeError(
            f"Failed to dispatch Achilles run: {resp.status_code} {resp.text}"
        )

    data = resp.json()
    run_id = str(data.get("data", {}).get("run_id", data.get("run_id", "")))
    if not run_id:
        raise RuntimeError(f"No run_id in response: {data}")

    logger.info("Achilles run dispatched: run_id=%s", run_id)
    return run_id


def poll_achilles_progress(
    source_id: int,
    run_id: str,
    api_base: str,
    token: str,
    poll_interval: int = _DEFAULT_POLL_INTERVAL_SEC,
    timeout: int = _DEFAULT_TIMEOUT_SEC,
) -> AchillesRunResult:
    """Poll Achilles run progress until completion or timeout.

    Args:
        source_id: Parthenon source ID.
        run_id: The Achilles run ID to monitor.
        api_base: Base URL for the Parthenon API.
        token: Bearer token for authentication.
        poll_interval: Seconds between polls.
        timeout: Maximum seconds to wait.

    Returns:
        AchillesRunResult with final status.
    """
    url = f"{api_base}/sources/{source_id}/achilles/runs/{run_id}/progress"
    start = time.monotonic()
    last_status = "unknown"

    while time.monotonic() - start < timeout:
        try:
            resp = requests.get(url, headers=_get_headers(token), timeout=30)
            if resp.status_code != 200:
                logger.warning("Progress poll returned %d: %s", resp.status_code, resp.text)
                time.sleep(poll_interval)
                continue

            data = resp.json().get("data", resp.json())
            status = str(data.get("status", "unknown"))
            total = int(data.get("total_analyses", 0))
            completed = int(data.get("completed_analyses", 0))
            failed = int(data.get("failed_analyses", 0))
            last_status = status

            elapsed = int(time.monotonic() - start)
            logger.info(
                "Achilles progress [%ds]: status=%s, completed=%d/%d, failed=%d",
                elapsed, status, completed, total, failed,
            )

            if status in ("completed", "failed", "error"):
                return AchillesRunResult(
                    run_id=run_id,
                    status=status,
                    total_analyses=total,
                    completed_analyses=completed,
                    failed_analyses=failed,
                    error=str(data.get("error")) if status in ("failed", "error") else None,
                )

        except requests.RequestException as exc:
            logger.warning("Progress poll error: %s", exc)

        time.sleep(poll_interval)

    return AchillesRunResult(
        run_id=run_id,
        status="timeout",
        total_analyses=0,
        completed_analyses=0,
        failed_analyses=0,
        error=f"Timed out after {timeout}s (last status: {last_status})",
    )


# ---------------------------------------------------------------------------
# Database verification
# ---------------------------------------------------------------------------


def verify_achilles_results(config: ETLConfig) -> AchillesVerification:
    """Verify Achilles results exist in the results schema.

    Connects directly to PostgreSQL and checks results.achilles_results
    for row counts, distinct analyses, and key metrics.

    Args:
        config: ETLConfig with database connection parameters.

    Returns:
        AchillesVerification with result counts and key metrics.
    """
    conn_params = {
        **config.db_connection_params,
        "options": "-c search_path=results,omop",
    }

    with psycopg2.connect(**conn_params) as conn:
        with conn.cursor() as cur:
            # Total results count
            cur.execute("SELECT COUNT(*) FROM results.achilles_results")
            results_row_count = cur.fetchone()[0]

            # Distinct analysis IDs
            cur.execute("SELECT COUNT(DISTINCT analysis_id) FROM results.achilles_results")
            distinct_analyses = cur.fetchone()[0]

            # Key metrics from specific analyses
            key_metrics: dict[str, Any] = {}

            # Analysis 1: Person count
            cur.execute(
                "SELECT count_value FROM results.achilles_results "
                "WHERE analysis_id = 1 LIMIT 1"
            )
            row = cur.fetchone()
            if row:
                key_metrics["person_count"] = int(row[0])

            # Analysis 2: Gender distribution (female percentage)
            cur.execute(
                "SELECT stratum_1, count_value FROM results.achilles_results "
                "WHERE analysis_id = 2"
            )
            gender_rows = cur.fetchall()
            total_gender = sum(int(r[1]) for r in gender_rows)
            if total_gender > 0:
                # Concept 8532 = Female
                female_count = sum(
                    int(r[1]) for r in gender_rows if str(r[0]).strip() == "8532"
                )
                key_metrics["female_percentage"] = round(
                    100.0 * female_count / total_gender, 1
                )

            # Domain counts from analyses 200, 400, 700
            for analysis_id, metric_name in [
                (200, "visit_count"),
                (400, "condition_count"),
                (700, "drug_count"),
                (800, "measurement_count"),
                (900, "observation_count"),
            ]:
                cur.execute(
                    "SELECT SUM(count_value) FROM results.achilles_results "
                    "WHERE analysis_id = %s",
                    (analysis_id,),
                )
                row = cur.fetchone()
                if row and row[0] is not None:
                    key_metrics[metric_name] = int(row[0])

    logger.info(
        "Achilles results: %d rows, %d distinct analyses",
        results_row_count,
        distinct_analyses,
    )
    return AchillesVerification(
        results_row_count=results_row_count,
        distinct_analyses=distinct_analyses,
        key_metrics=key_metrics,
    )


def verify_achilles_api_endpoints(
    source_id: int,
    api_base: str,
    token: str,
) -> dict[str, bool]:
    """Verify Achilles data is retrievable via Parthenon API endpoints.

    Args:
        source_id: Parthenon source ID.
        api_base: Base URL for the Parthenon API.
        token: Bearer token for authentication.

    Returns:
        Dict mapping endpoint name to success boolean.
    """
    endpoints = {
        "record-counts": f"{api_base}/sources/{source_id}/achilles/record-counts",
        "demographics": f"{api_base}/sources/{source_id}/achilles/demographics",
        "observation-periods": f"{api_base}/sources/{source_id}/achilles/observation-periods",
        "domain-condition": f"{api_base}/sources/{source_id}/achilles/domains/condition",
        "domain-drug": f"{api_base}/sources/{source_id}/achilles/domains/drug",
        "domain-measurement": f"{api_base}/sources/{source_id}/achilles/domains/measurement",
        "domain-observation": f"{api_base}/sources/{source_id}/achilles/domains/observation",
    }

    results: dict[str, bool] = {}
    headers = _get_headers(token)

    for name, url in endpoints.items():
        try:
            resp = requests.get(url, headers=headers, timeout=30)
            ok = resp.status_code == 200
            results[name] = ok
            if not ok:
                logger.warning("Endpoint %s returned %d", name, resp.status_code)
            else:
                logger.info("Endpoint %s: OK", name)
        except requests.RequestException as exc:
            logger.warning("Endpoint %s failed: %s", name, exc)
            results[name] = False

    return results


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


def run_achilles_validation(
    config: ETLConfig,
    source_id: int = _DEFAULT_SOURCE_ID,
    api_base: str = _DEFAULT_API_BASE,
    api_token: str = "",
    poll_interval: int = _DEFAULT_POLL_INTERVAL_SEC,
    timeout: int = _DEFAULT_TIMEOUT_SEC,
    skip_dispatch: bool = False,
) -> dict[str, Any]:
    """Run full Achilles validation: dispatch, poll, verify.

    Args:
        config: ETLConfig instance.
        source_id: Parthenon source ID for IRSF-NHS.
        api_base: Base URL for the Parthenon API.
        api_token: Bearer token for authentication.
        poll_interval: Seconds between progress polls.
        timeout: Maximum seconds to wait for Achilles completion.
        skip_dispatch: If True, skip dispatch/poll and only verify results.

    Returns:
        Dict with full validation report.
    """
    report: dict[str, Any] = {"achilles": {}}

    if not skip_dispatch:
        if not api_token:
            raise ValueError(
                "API token required for Achilles dispatch. "
                "Pass --token or set IRSF_ETL_API_TOKEN env var."
            )

        # Step 1: Dispatch
        run_id = dispatch_achilles_run(source_id, api_base, api_token)

        # Step 2: Poll
        run_result = poll_achilles_progress(
            source_id, run_id, api_base, api_token, poll_interval, timeout,
        )

        report["achilles"]["run_id"] = run_result.run_id
        report["achilles"]["status"] = run_result.status
        report["achilles"]["total_analyses"] = run_result.total_analyses
        report["achilles"]["completed"] = run_result.completed_analyses
        report["achilles"]["failed"] = run_result.failed_analyses

        if run_result.error:
            report["achilles"]["error"] = run_result.error

        if run_result.status == "timeout":
            logger.warning(
                "Achilles run timed out after %ds. Results may be incomplete. "
                "Re-run with --skip-dispatch to verify results later, or "
                "increase --timeout.",
                timeout,
            )
        elif run_result.status in ("failed", "error"):
            logger.error("Achilles run failed: %s", run_result.error)

        # Validate failure rate
        if run_result.total_analyses > 0:
            failure_rate = run_result.failed_analyses / run_result.total_analyses
            report["achilles"]["failure_rate"] = round(failure_rate, 4)
            if failure_rate > _MAX_FAILURE_RATE:
                logger.warning(
                    "High Achilles failure rate: %.1f%% (%d/%d)",
                    failure_rate * 100,
                    run_result.failed_analyses,
                    run_result.total_analyses,
                )
    else:
        logger.info("Skipping Achilles dispatch (--skip-dispatch), verifying existing results")
        report["achilles"]["status"] = "skipped_dispatch"

    # Step 3: Verify results in database
    verification = verify_achilles_results(config)
    report["achilles"]["results_row_count"] = verification.results_row_count
    report["achilles"]["distinct_analyses"] = verification.distinct_analyses
    report["achilles"]["key_metrics"] = verification.key_metrics

    # Step 4: Verify API endpoints
    if api_token:
        api_results = verify_achilles_api_endpoints(source_id, api_base, api_token)
        report["achilles"]["api_endpoints"] = api_results
    else:
        logger.info("Skipping API endpoint verification (no token)")

    # Validation assertions
    passed = True
    issues: list[str] = []

    if verification.results_row_count == 0:
        passed = False
        issues.append("No rows in results.achilles_results")

    if verification.distinct_analyses < _MIN_EXPECTED_ANALYSES:
        passed = False
        issues.append(
            f"Only {verification.distinct_analyses} distinct analyses "
            f"(expected >= {_MIN_EXPECTED_ANALYSES})"
        )

    report["achilles"]["validation_passed"] = passed
    if issues:
        report["achilles"]["validation_issues"] = issues

    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    """Build argument parser for standalone execution."""
    parser = argparse.ArgumentParser(
        description="Run Achilles characterization and validate results",
    )
    parser.add_argument(
        "--source-id",
        type=int,
        default=_DEFAULT_SOURCE_ID,
        help=f"Parthenon source ID (default: {_DEFAULT_SOURCE_ID})",
    )
    parser.add_argument(
        "--api-base",
        default=_DEFAULT_API_BASE,
        help=f"Parthenon API base URL (default: {_DEFAULT_API_BASE})",
    )
    parser.add_argument(
        "--token",
        default="",
        help="Bearer token for API authentication (or set IRSF_ETL_API_TOKEN env var)",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=_DEFAULT_POLL_INTERVAL_SEC,
        help=f"Seconds between progress polls (default: {_DEFAULT_POLL_INTERVAL_SEC})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=_DEFAULT_TIMEOUT_SEC,
        help=f"Max seconds to wait for completion (default: {_DEFAULT_TIMEOUT_SEC})",
    )
    parser.add_argument(
        "--skip-dispatch",
        action="store_true",
        help="Skip dispatching a new run; only verify existing results",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path for report JSON (default: output/reports/achilles_report.json)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    return parser


def main() -> None:
    """CLI entry point."""
    import os

    parser = _build_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = ETLConfig()

    # Token from CLI arg or environment variable
    token = args.token or os.environ.get("IRSF_ETL_API_TOKEN", "")

    report = run_achilles_validation(
        config=config,
        source_id=args.source_id,
        api_base=args.api_base,
        api_token=token,
        poll_interval=args.poll_interval,
        timeout=args.timeout,
        skip_dispatch=args.skip_dispatch,
    )

    # Write report
    output_path = args.output or config.reports_dir / "achilles_report.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, default=str))
    logger.info("Achilles report written to %s", output_path)

    # Print summary
    achilles = report.get("achilles", {})
    passed = achilles.get("validation_passed", False)

    print(f"\nAchilles Validation: {'PASSED' if passed else 'FAILED'}")
    print(f"  Status: {achilles.get('status', 'unknown')}")
    print(f"  Results rows: {achilles.get('results_row_count', 0):,}")
    print(f"  Distinct analyses: {achilles.get('distinct_analyses', 0)}")

    metrics = achilles.get("key_metrics", {})
    if metrics:
        print("  Key metrics:")
        for k, v in metrics.items():
            print(f"    {k}: {v}")

    issues = achilles.get("validation_issues", [])
    if issues:
        print("  Issues:")
        for issue in issues:
            print(f"    - {issue}")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
