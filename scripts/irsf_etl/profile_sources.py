"""Source data profiling for the IRSF ETL pipeline.

Reads all source CSVs across multiple directories and produces a JSON report
with row counts, null rates, empty string rates, value distributions,
and date format detection.

Usage:
    from scripts.irsf_etl.profile_sources import profile_all, write_report
    from scripts.irsf_etl.config import ETLConfig

    config = ETLConfig()
    profiles = profile_all(config)
    write_report(profiles, config.profiles_dir)
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

import pandas as pd

from scripts.irsf_etl.lib.date_utils import detect_split_date_columns

logger = logging.getLogger(__name__)


def _is_string_dtype(series: pd.Series) -> bool:
    """Check if a series has a string-like dtype (object or StringDtype)."""
    return pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)

# ---------------------------------------------------------------------------
# Date format detection
# ---------------------------------------------------------------------------

# Regex patterns for common date formats
_DATE_PATTERNS: dict[str, re.Pattern[str]] = {
    "MM/DD/YYYY": re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$"),
    "MM/DD/YY": re.compile(r"^\d{1,2}/\d{1,2}/\d{2}$"),
    "YYYY-MM-DD": re.compile(r"^\d{4}-\d{1,2}-\d{1,2}$"),
    "Mon DD, YYYY": re.compile(
        r"^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$",
        re.IGNORECASE,
    ),
}

# Threshold: if more than this fraction of non-null values match, declare the format
_DATE_MATCH_THRESHOLD = 0.50


def detect_date_format(series: pd.Series, sample_size: int = 100) -> str | None:
    """Detect the date format of a pandas Series by regex matching a sample.

    Args:
        series: Column data to check.
        sample_size: Maximum number of non-null values to sample.

    Returns:
        Format label string (e.g. "MM/DD/YYYY") if detected, else None.
    """
    # Only check object (string) columns
    if not _is_string_dtype(series):
        return None

    non_null = series.dropna()
    if len(non_null) == 0:
        return None

    sample = non_null.head(sample_size).astype(str).str.strip()

    for label, pattern in _DATE_PATTERNS.items():
        matches = sample.apply(lambda v: bool(pattern.match(v)))
        match_rate = matches.mean()
        if match_rate > _DATE_MATCH_THRESHOLD:
            return label

    return None


# ---------------------------------------------------------------------------
# Single-file profiling
# ---------------------------------------------------------------------------


def profile_one_csv(path: Path) -> dict[str, Any]:
    """Profile a single CSV file and return a summary dictionary.

    Reads the raw CSV (without empty-string -> NA replacement) so that
    empty strings and true nulls can be counted separately.

    Args:
        path: Path to the CSV file.

    Returns:
        Dictionary with profiling metrics. On parse failure, returns a dict
        with 'file', 'error', and 'directory' keys.
    """
    file_name = path.name
    directory = path.parent.name

    try:
        # Read raw with keep_default_na=False so empty CSV cells stay as ""
        # instead of being converted to NaN. This lets us count empty strings
        # separately from true nulls (explicit NA/NaN markers in the data).
        df = pd.read_csv(
            path,
            low_memory=False,
            encoding_errors="replace",
            keep_default_na=False,
            na_values=["NA", "NaN", "nan", "null", "NULL", "None"],
        )
    except Exception as exc:
        logger.warning("Failed to parse %s: %s", path, exc)
        return {
            "file": file_name,
            "directory": directory,
            "error": str(exc),
        }

    rows, cols = df.shape
    column_names = list(df.columns)

    # Null rates: actual NaN/NA/None values (not empty strings)
    null_rates: dict[str, float] = {}
    for col in column_names:
        null_rates[col] = float(df[col].isnull().mean())

    # Empty string rates: cells that are literally "" (object columns only)
    empty_string_rates: dict[str, float] = {}
    for col in column_names:
        if _is_string_dtype(df[col]):
            empty_count = int((df[col] == "").sum())
            empty_string_rates[col] = empty_count / rows if rows > 0 else 0.0
        else:
            empty_string_rates[col] = 0.0

    # Date format detection
    date_columns_detected: dict[str, str] = {}
    for col in column_names:
        fmt = detect_date_format(df[col])
        if fmt is not None:
            date_columns_detected[col] = fmt

    # Split-date column detection
    split_date_columns_detected = detect_split_date_columns(column_names)

    # Low-cardinality value distributions (object columns with < 30 unique values)
    low_cardinality_distributions: dict[str, dict[str, int]] = {}
    for col in column_names:
        if _is_string_dtype(df[col]):
            nunique = df[col].nunique(dropna=True)
            if nunique < 30:
                counts = df[col].value_counts(dropna=True)
                low_cardinality_distributions[col] = {
                    str(k): int(v) for k, v in counts.items()
                }

    return {
        "file": file_name,
        "directory": directory,
        "rows": rows,
        "columns": cols,
        "column_names": column_names,
        "null_rates": null_rates,
        "empty_string_rates": empty_string_rates,
        "date_columns_detected": date_columns_detected,
        "split_date_columns_detected": split_date_columns_detected,
        "low_cardinality_distributions": low_cardinality_distributions,
    }


# ---------------------------------------------------------------------------
# Multi-directory profiling
# ---------------------------------------------------------------------------

# Source directory definitions: (group_label, subdirectory_path_relative_to_root)
_SOURCE_DIRS: list[tuple[str, list[str]]] = [
    ("5201", ["5201"]),
    ("5211", ["5211"]),
    ("5211_Custom_Extracts", ["Custom Extracts"]),
    ("DDLs_5211_Lab_Log", ["DDLs", "5211", "Lab_Log output"]),
    ("Notes", ["Notes"]),
]


def profile_all(config: Any) -> list[dict[str, Any]]:
    """Profile all source CSVs across configured directories.

    Args:
        config: ETLConfig instance with source_root and output_dir.

    Returns:
        List of profile dicts, one per CSV file.
    """
    profiles: list[dict[str, Any]] = []

    try:
        from rich.progress import Progress

        use_rich = True
    except ImportError:
        use_rich = False

    # Collect all (group, csv_path) pairs
    work_items: list[tuple[str, Path]] = []

    for group_label, subpath_parts in _SOURCE_DIRS:
        dir_path = config.source_root
        for part in subpath_parts:
            dir_path = dir_path / part

        if not dir_path.exists():
            logger.info("Skipping non-existent directory: %s", dir_path)
            continue

        csv_files = sorted(dir_path.glob("*.csv"))
        for csv_path in csv_files:
            work_items.append((group_label, csv_path))

    if not work_items:
        logger.warning("No CSV files found in any source directory under %s", config.source_root)
        return profiles

    if use_rich:
        with Progress() as progress:
            task = progress.add_task("Profiling CSVs...", total=len(work_items))
            for group_label, csv_path in work_items:
                profile = profile_one_csv(csv_path)
                profile["source_group"] = group_label
                profiles.append(profile)
                progress.advance(task)
    else:
        for group_label, csv_path in work_items:
            profile = profile_one_csv(csv_path)
            profile["source_group"] = group_label
            profiles.append(profile)

    return profiles


# ---------------------------------------------------------------------------
# Report writing
# ---------------------------------------------------------------------------


def write_report(
    profiles: list[dict[str, Any]],
    output_dir: Path,
    *,
    json_only: bool = False,
) -> Path:
    """Write profiling results to a JSON report and optionally print a console summary.

    Args:
        profiles: List of profile dicts from profile_all or profile_one_csv.
        output_dir: Directory to write the report into.
        json_only: If True, suppress console summary table.

    Returns:
        Path to the written JSON report.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "profile_report.json"

    report_path.write_text(json.dumps(profiles, indent=2, default=str))
    logger.info("Profile report written to %s", report_path)

    if not json_only:
        _print_summary(profiles)

    return report_path


def _print_summary(profiles: list[dict[str, Any]]) -> None:
    """Print a console summary of profiling results."""
    total_files = len(profiles)
    error_files = [p for p in profiles if "error" in p]
    success_profiles = [p for p in profiles if "error" not in p]
    total_rows = sum(p.get("rows", 0) for p in success_profiles)
    date_files = [p for p in success_profiles if p.get("date_columns_detected")]
    groups = sorted({p.get("source_group", "unknown") for p in profiles})

    try:
        from rich.console import Console
        from rich.table import Table

        console = Console()

        table = Table(title="IRSF Source Data Profile Summary")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Total files profiled", str(total_files))
        table.add_row("Total rows", f"{total_rows:,}")
        table.add_row("Source groups", ", ".join(groups))
        table.add_row("Files with date columns", str(len(date_files)))
        table.add_row("Files with errors", str(len(error_files)))

        console.print(table)

        if error_files:
            console.print("\n[red]Files with errors:[/red]")
            for p in error_files:
                console.print(f"  - {p['file']}: {p.get('error', 'unknown')}")

    except ImportError:
        print(f"Total files profiled: {total_files}")
        print(f"Total rows: {total_rows:,}")
        print(f"Source groups: {', '.join(groups)}")
        print(f"Files with date columns: {len(date_files)}")
        print(f"Files with errors: {len(error_files)}")
