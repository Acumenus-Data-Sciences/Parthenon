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


def _build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with all subcommands."""
    parser = argparse.ArgumentParser(
        prog="irsf-etl",
        description="IRSF Natural History Study ETL pipeline for OMOP CDM conversion",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Profile subcommand (placeholder for Plan 02)
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
        "--output",
        type=str,
        default=None,
        help="Path to output directory (overrides config)",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    """Main entry point for the IRSF ETL CLI."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "profile":
        print("Profile command not yet implemented (see Plan 01-02)")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
