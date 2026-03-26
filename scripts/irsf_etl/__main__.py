"""CLI entry point for the IRSF ETL pipeline.

Usage:
    python -m scripts.irsf_etl [command]

Commands:
    profile    Profile source CSV files and generate data quality reports

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


def main(argv: list[str] | None = None) -> int:
    """Main entry point for the IRSF ETL CLI."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "profile":
        return _run_profile(args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
