"""Combined Achilles + Temporal integrity validation runner.

Orchestrates both validate_achilles and validate_temporal modules and
produces a unified report at output/reports/achilles_temporal_report.json.

Usage:
    python -m scripts.irsf_etl.validate_achilles_temporal --source-id 57 --token <token>

    # Skip Achilles dispatch (only verify existing results + temporal checks):
    python -m scripts.irsf_etl.validate_achilles_temporal --skip-dispatch

NOTE: Achilles can take 10+ minutes. If the API times out:
    1. Check run progress manually via the Parthenon UI or API
    2. Re-run with --skip-dispatch once Achilles has completed
    3. Or increase --timeout (default: 900 seconds / 15 minutes)
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.validate_achilles import run_achilles_validation
from scripts.irsf_etl.validate_temporal import run_temporal_validation

logger = logging.getLogger(__name__)


def run_combined_validation(
    config: ETLConfig,
    source_id: int = 57,
    api_base: str = "http://localhost:8082/api/v1",
    api_token: str = "",
    poll_interval: int = 15,
    timeout: int = 900,
    skip_dispatch: bool = False,
) -> dict:
    """Run both Achilles and temporal validations and return unified report.

    Args:
        config: ETLConfig instance.
        source_id: Parthenon source ID.
        api_base: API base URL.
        api_token: Bearer token.
        poll_interval: Seconds between Achilles progress polls.
        timeout: Max seconds to wait for Achilles.
        skip_dispatch: Skip Achilles dispatch, only verify existing results.

    Returns:
        Combined report dict with 'achilles' and 'temporal_integrity' keys.
    """
    # Run Achilles validation
    achilles_report = run_achilles_validation(
        config=config,
        source_id=source_id,
        api_base=api_base,
        api_token=api_token,
        poll_interval=poll_interval,
        timeout=timeout,
        skip_dispatch=skip_dispatch,
    )

    # Run temporal integrity validation
    temporal_report = run_temporal_validation(config)

    # Combine into unified report
    return {
        "achilles": achilles_report.get("achilles", {}),
        "temporal_integrity": temporal_report,
    }


def main() -> None:
    """CLI entry point for combined validation."""
    import os

    parser = argparse.ArgumentParser(
        description="Run Achilles characterization and temporal integrity validation",
    )
    parser.add_argument("--source-id", type=int, default=57)
    parser.add_argument("--api-base", default="http://localhost:8082/api/v1")
    parser.add_argument("--token", default="")
    parser.add_argument("--poll-interval", type=int, default=15)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--skip-dispatch", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    config = ETLConfig()
    token = args.token or os.environ.get("IRSF_ETL_API_TOKEN", "")

    report = run_combined_validation(
        config=config,
        source_id=args.source_id,
        api_base=args.api_base,
        api_token=token,
        poll_interval=args.poll_interval,
        timeout=args.timeout,
        skip_dispatch=args.skip_dispatch,
    )

    # Write unified report
    output_path = args.output or config.reports_dir / "achilles_temporal_report.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, default=str))
    logger.info("Combined report written to %s", output_path)

    # Summary
    achilles_ok = report.get("achilles", {}).get("validation_passed", False)
    temporal_ok = report.get("temporal_integrity", {}).get("all_passed", False)
    all_ok = achilles_ok and temporal_ok

    print(f"\n{'=' * 50}")
    print(f"Achilles:           {'PASSED' if achilles_ok else 'FAILED'}")
    print(f"Temporal Integrity: {'PASSED' if temporal_ok else 'FAILED'}")
    print(f"Overall:            {'PASSED' if all_ok else 'FAILED'}")
    print(f"{'=' * 50}")
    print(f"Report: {output_path}")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
