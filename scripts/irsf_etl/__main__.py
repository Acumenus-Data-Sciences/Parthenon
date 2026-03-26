"""CLI entry point for the IRSF ETL pipeline.

Usage:
    python -m scripts.irsf_etl [command]

Commands:
    profile              Profile source CSV files and generate data quality reports
    visit-derivation     Derive visit_occurrence from study visits and hospitalizations

Run with --help for full usage information.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with all subcommands."""
    parser = argparse.ArgumentParser(
        prog="irsf-etl",
        description="IRSF Natural History Study ETL pipeline for OMOP CDM conversion",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Profile subcommand
    profile_parser = subparsers.add_parser(
        "profile",
        help="Profile source CSV files and generate data quality reports",
    )
    profile_parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Path to source data directory (overrides config)",
    )
    profile_parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Path to output directory for profile report (overrides config)",
    )
    profile_parser.add_argument(
        "--json-only",
        action="store_true",
        default=False,
        help="Suppress console table output; write JSON report only",
    )

    # Demographics subcommand
    subparsers.add_parser(
        "demographics",
        help="Build person roster and death records as OMOP staging CSVs",
    )

    # Visit derivation subcommand
    subparsers.add_parser(
        "visit-derivation",
        help="Derive visit_occurrence from study visits and hospitalizations",
    )

    return parser


def _run_profile(args: argparse.Namespace) -> int:
    """Execute the profile subcommand."""
    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.profile_sources import profile_all, write_report

    # Build config, optionally overriding source_root and output_dir
    overrides: dict[str, Path] = {}
    if args.source is not None:
        overrides["source_root"] = Path(args.source)

    config = ETLConfig(**overrides)

    output_dir = Path(args.output_dir) if args.output_dir else config.profiles_dir

    profiles = profile_all(config)

    if not profiles:
        print("No CSV files found to profile.")
        return 1

    write_report(profiles, output_dir, json_only=args.json_only)
    return 0


def _run_demographics() -> int:
    """Execute the demographics subcommand — build person.csv and death.csv."""
    import logging

    import pandas as pd

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.lib.csv_utils import read_csv_safe
    from scripts.irsf_etl.lib.death_builder import build_death_records
    from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
    from scripts.irsf_etl.lib.person_builder import build_person_roster
    from scripts.irsf_etl.lib.rejection_log import RejectionLog

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    staging_dir = config.staging_dir
    staging_dir.mkdir(parents=True, exist_ok=True)

    # Load source data
    custom_extracts = config.source_root / "5211_Custom_Extracts" / "csv"
    raw_5211 = config.source_root / "5211" / "csv"

    person_chars = read_csv_safe(custom_extracts / "Person_Characteristics_5201_5211.csv")
    demographics_path = raw_5211 / "Demographics_5211.csv"
    demographics: pd.DataFrame | None = read_csv_safe(demographics_path) if demographics_path.exists() else None

    registry = PersonIdRegistry.from_csv(config.staging_dir / "person_id_map.csv")
    rejection_log = RejectionLog("demographics")

    person_df = build_person_roster(person_chars, demographics, registry, rejection_log)
    person_path = staging_dir / "person.csv"
    person_df.to_csv(person_path, index=False)
    print(f"  person.csv: {len(person_df)} rows -> {person_path}")

    # Death records (in Custom Extracts, not raw 5211)
    death_path_src = custom_extracts / "DeathRecord_5211.csv"
    if death_path_src.exists():
        death_src = read_csv_safe(death_path_src)
        death_rejection = RejectionLog("death")
        death_df = build_death_records(death_src, registry, death_rejection)
        death_path = staging_dir / "death.csv"
        death_df.to_csv(death_path, index=False)
        print(f"  death.csv:  {len(death_df)} rows -> {death_path}")
    else:
        print("  death.csv:  SKIPPED (DeathRecord_5211.csv not found)")

    print(f"\nDemographics Complete")
    print(f"  Gender: {person_df['gender_concept_id'].value_counts().to_dict()}")
    print(f"  Unique persons: {person_df['person_id'].nunique()}")

    return 0


def _run_visit_derivation() -> int:
    """Execute the visit-derivation subcommand."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.visit_derivation import derive_visits

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    visit_occ, visit_map = derive_visits(config)

    print(f"\nVisit Derivation Complete")
    print(f"  visit_occurrence.csv: {len(visit_occ)} rows")
    print(f"  visit_id_map.csv:     {len(visit_map)} rows")

    if not visit_occ.empty:
        concept_counts = visit_occ["visit_concept_id"].value_counts()
        print(f"\nVisit type distribution:")
        for concept_id, count in concept_counts.items():
            label = {9201: "Inpatient", 9202: "Outpatient", 9203: "ER"}.get(
                int(concept_id), f"Unknown ({concept_id})"
            )
            print(f"  {label} ({concept_id}): {count}")

        person_count = visit_occ["person_id"].nunique()
        print(f"\nUnique patients with visits: {person_count}")

    return 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point for the IRSF ETL CLI."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "profile":
        return _run_profile(args)

    if args.command == "demographics":
        return _run_demographics()

    if args.command == "visit-derivation":
        return _run_visit_derivation()

    return 0


if __name__ == "__main__":
    sys.exit(main())
