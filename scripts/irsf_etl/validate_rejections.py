"""ETL rejection rate validation for IRSF-NHS OMOP CDM data (VAL-06).

Parses all rejection CSVs produced by the ETL pipeline and verifies that
high-priority OMOP tables have a rejection rate below 5%.

Usage:
    python -m scripts.irsf_etl validate-rejections

Rejection CSVs are located in scripts/irsf_etl/output/reports/*_rejections.csv.
Processed counts come from the corresponding staging CSVs.
"""

from __future__ import annotations

import csv
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_REJECTION_RATE_TARGET = 5.0  # percent

# High-priority OMOP tables that must meet the < 5% threshold
_HIGH_PRIORITY_TABLES = frozenset({
    "person",
    "visit_occurrence",
    "condition_occurrence",
    "drug_exposure",
    "measurement",
    "observation",
})

# Map rejection CSV file prefixes to OMOP table names and staging CSVs.
# Multiple rejection files may map to a single OMOP table (e.g. measurement
# has growth, CSS, labs, sf36, etl sub-pipelines).
_REJECTION_FILE_MAP: dict[str, dict[str, str | list[str]]] = {
    "drug_exposure_rejections.csv": {
        "table": "drug_exposure",
        "staging": "drug_exposure.csv",
    },
    "measurement_css_rejections.csv": {
        "table": "measurement",
        "staging": "measurement.csv",
    },
    "measurement_etl_rejections.csv": {
        "table": "measurement",
        "staging": "measurement.csv",
    },
    "measurement_growth_rejections.csv": {
        "table": "measurement",
        "staging": "measurement.csv",
    },
    "measurement_labs_rejections.csv": {
        "table": "measurement",
        "staging": "measurement.csv",
    },
    "measurement_sf36_rejections.csv": {
        "table": "measurement",
        "staging": "measurement.csv",
    },
    "observation_mba_rejections.csv": {
        "table": "observation",
        "staging": ["observation_mba.csv", "observation_genotype.csv", "observation_categorical.csv"],
    },
    "visit_derivation_rejections.csv": {
        "table": "visit_occurrence",
        "staging": "visit_occurrence.csv",
    },
}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RejectionFileResult:
    """Rejection analysis for a single rejection CSV file."""

    file_name: str
    omop_table: str
    rejection_count: int
    error_severity_count: int
    warning_count: int
    categories: dict[str, int]


@dataclass(frozen=True)
class TableRejectionResult:
    """Aggregated rejection rate for an OMOP table."""

    table_name: str
    total_processed: int
    total_rejections: int
    error_rejections: int
    rejection_rate: float
    error_rejection_rate: float
    target_met: bool
    is_high_priority: bool


@dataclass
class RejectionValidationReport:
    """Complete rejection validation report."""

    timestamp: str
    target: float
    all_targets_met: bool
    high_priority_targets_met: bool
    tables: list[TableRejectionResult]
    files: list[RejectionFileResult]

    def to_dict(self) -> dict[str, Any]:
        """Serialize to JSON-compatible dictionary."""
        return {
            "timestamp": self.timestamp,
            "target_rejection_rate": self.target,
            "all_targets_met": self.all_targets_met,
            "high_priority_targets_met": self.high_priority_targets_met,
            "rejection_rates": {
                t.table_name: {
                    "total_processed": t.total_processed,
                    "total_rejections": t.total_rejections,
                    "error_rejections": t.error_rejections,
                    "rejection_rate": t.rejection_rate,
                    "error_rejection_rate": t.error_rejection_rate,
                    "target_met": t.target_met,
                    "is_high_priority": t.is_high_priority,
                }
                for t in self.tables
            },
            "files": [asdict(f) for f in self.files],
        }


# ---------------------------------------------------------------------------
# Rejection CSV parsing
# ---------------------------------------------------------------------------

def _count_csv_rows(path: Path) -> int:
    """Count data rows in a CSV file (excluding header)."""
    if not path.exists():
        return 0
    with open(path, newline="") as f:
        reader = csv.reader(f)
        next(reader, None)  # skip header
        return sum(1 for _ in reader)


def _parse_rejection_csv(path: Path) -> RejectionFileResult:
    """Parse a rejection CSV and categorize entries.

    Rejection CSVs have columns: record_index, column, value, category, message, timestamp
    """
    file_name = path.name
    mapping = _REJECTION_FILE_MAP.get(file_name, {"table": "unknown", "staging": ""})
    omop_table = str(mapping["table"])

    if not path.exists():
        return RejectionFileResult(
            file_name=file_name,
            omop_table=omop_table,
            rejection_count=0,
            error_severity_count=0,
            warning_count=0,
            categories={},
        )

    categories: dict[str, int] = {}
    total = 0
    error_count = 0
    warning_count = 0

    # Categories that are warnings (not hard errors that exclude rows):
    # - unmapped_concept: concept not found in vocabulary; row still loaded with concept_id=0
    # - deprecated_remapped: concept was deprecated and successfully remapped; row loaded
    # - custom: user-defined categories (default severity: warning)
    # These represent data quality issues but the records are still present
    # in the staging output with concept_id=0 or remapped values.
    _WARNING_CATEGORIES = frozenset({
        "custom",
        "unmapped_concept",
        "deprecated_remapped",
    })

    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            cat = row.get("category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1
            if cat in _WARNING_CATEGORIES:
                warning_count += 1
            else:
                error_count += 1

    return RejectionFileResult(
        file_name=file_name,
        omop_table=omop_table,
        rejection_count=total,
        error_severity_count=error_count,
        warning_count=warning_count,
        categories=categories,
    )


def _get_staging_row_count(staging_dir: Path, staging_files: str | list[str]) -> int:
    """Get total row count from staging CSV(s)."""
    if isinstance(staging_files, str):
        staging_files = [staging_files]

    total = 0
    seen: set[str] = set()
    for sf in staging_files:
        if sf in seen:
            continue
        seen.add(sf)
        path = staging_dir / sf
        total += _count_csv_rows(path)

    return total


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def analyze_rejections(
    reports_dir: Path,
    staging_dir: Path,
) -> RejectionValidationReport:
    """Analyze all rejection CSVs and compute per-table rejection rates."""
    now = datetime.now(timezone.utc).isoformat()

    # Parse all rejection files
    file_results: list[RejectionFileResult] = []
    for rej_file in sorted(reports_dir.glob("*_rejections.csv")):
        result = _parse_rejection_csv(rej_file)
        file_results.append(result)

    # Aggregate by OMOP table
    table_rejections: dict[str, int] = {}
    table_error_rejections: dict[str, int] = {}
    table_staging_files: dict[str, str | list[str]] = {}

    for fr in file_results:
        tbl = fr.omop_table
        table_rejections[tbl] = table_rejections.get(tbl, 0) + fr.rejection_count
        table_error_rejections[tbl] = table_error_rejections.get(tbl, 0) + fr.error_severity_count
        # Keep staging file reference
        mapping = _REJECTION_FILE_MAP.get(fr.file_name, {})
        if "staging" in mapping and tbl not in table_staging_files:
            table_staging_files[tbl] = mapping["staging"]

    # Compute rates
    table_results: list[TableRejectionResult] = []
    all_met = True
    hp_met = True

    for tbl in sorted(set(table_rejections.keys())):
        staging_files = table_staging_files.get(tbl, f"{tbl}.csv")
        total_processed = _get_staging_row_count(staging_dir, staging_files)
        total_rej = table_rejections[tbl]
        error_rej = table_error_rejections[tbl]

        # Rejection rate based on error-severity rejections vs total processed
        rej_rate = (total_rej / total_processed * 100) if total_processed > 0 else 0.0
        error_rate = (error_rej / total_processed * 100) if total_processed > 0 else 0.0

        is_hp = tbl in _HIGH_PRIORITY_TABLES
        target_met = error_rate < _REJECTION_RATE_TARGET

        if not target_met:
            all_met = False
            if is_hp:
                hp_met = False

        table_results.append(
            TableRejectionResult(
                table_name=tbl,
                total_processed=total_processed,
                total_rejections=total_rej,
                error_rejections=error_rej,
                rejection_rate=round(rej_rate, 2),
                error_rejection_rate=round(error_rate, 2),
                target_met=target_met,
                is_high_priority=is_hp,
            )
        )

    return RejectionValidationReport(
        timestamp=now,
        target=_REJECTION_RATE_TARGET,
        all_targets_met=all_met,
        high_priority_targets_met=hp_met,
        tables=table_results,
        files=file_results,
    )


# ---------------------------------------------------------------------------
# Report output
# ---------------------------------------------------------------------------

def print_report(report: RejectionValidationReport) -> None:
    """Print a human-readable rejection validation summary."""
    hp_status = "PASS" if report.high_priority_targets_met else "FAIL"
    print(f"\n{'=' * 60}")
    print(f"ETL Rejection Rate Validation  [{hp_status}]")
    print(f"{'=' * 60}")
    print(f"  Target:                    < {report.target:.0f}% error rejection rate")
    print(f"  High-priority targets met: {report.high_priority_targets_met}")
    print(f"  All targets met:           {report.all_targets_met}")

    print(f"\n--- Per-Table Rejection Rates ---")
    for t in report.tables:
        hp_marker = " [HP]" if t.is_high_priority else "     "
        status = "OK" if t.target_met else "FAIL"
        print(
            f"  {t.table_name:30s}{hp_marker}  "
            f"{t.error_rejections:6d}/{t.total_processed:7d}  "
            f"({t.error_rejection_rate:5.2f}%)  [{status}]"
        )

    print(f"\n--- Per-File Breakdown ---")
    for f in report.files:
        print(
            f"  {f.file_name:45s}  "
            f"errors={f.error_severity_count:5d}  "
            f"warnings={f.warning_count:4d}  "
            f"total={f.rejection_count:5d}"
        )
        if f.categories:
            for cat, count in sorted(f.categories.items(), key=lambda x: -x[1]):
                print(f"    {cat}: {count}")

    print(f"{'=' * 60}\n")


def save_report(report: RejectionValidationReport, output_path: Path) -> None:
    """Save the rejection validation report as JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(report.to_dict(), f, indent=2, default=str)
    logger.info("Report saved to %s", output_path)


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def run_validate_rejections(
    output_dir: Path | None = None,
) -> RejectionValidationReport:
    """Run the rejection validation workflow."""
    from scripts.irsf_etl.config import ETLConfig

    config = ETLConfig()
    reports_dir = config.reports_dir
    staging_dir = config.staging_dir

    if output_dir is None:
        output_dir = reports_dir

    report = analyze_rejections(reports_dir, staging_dir)
    print_report(report)
    save_report(report, output_dir / "rejection_validation_report.json")

    return report
