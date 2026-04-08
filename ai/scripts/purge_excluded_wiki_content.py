#!/usr/bin/env python3
"""Remove excluded DOI content from a wiki workspace."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "ai"))

from app.wiki.index_ops import read_index, write_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Purge excluded DOI content from a wiki workspace.")
    parser.add_argument("--workspace", default="platform")
    parser.add_argument(
        "--exclusions-csv",
        default=str(REPO_ROOT / "OHDSI-scraper" / "corpus_exclusions.csv"),
        help="CSV containing DOI exclusions.",
    )
    parser.add_argument("--write", action="store_true", help="Apply the purge.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workspace_dir = REPO_ROOT / "data" / "wiki" / args.workspace
    exclusions_path = Path(args.exclusions_csv)

    excluded_dois = {
        (row.get("DOI") or "").strip().lower()
        for row in csv.DictReader(exclusions_path.open("r", encoding="utf-8", newline=""))
        if (row.get("DOI") or "").strip()
    }

    entries = read_index(workspace_dir)
    kept_entries = [entry for entry in entries if entry.doi.lower() not in excluded_dois]
    removed_entries = [entry for entry in entries if entry.doi.lower() in excluded_dois]

    removed_paths = sorted({workspace_dir / entry.path for entry in removed_entries})
    kept_source_slugs = {entry.source_slug for entry in kept_entries if entry.source_slug}
    removed_source_paths = []
    for source_path in sorted((workspace_dir / "sources").iterdir()):
        if not source_path.is_file():
            continue
        if source_path.stem in kept_source_slugs:
            continue
        if source_path.stem not in {entry.source_slug for entry in removed_entries if entry.source_slug}:
            continue
        removed_source_paths.append(source_path)

    if args.write:
        write_index(workspace_dir, kept_entries)
        for page_path in removed_paths:
            if page_path.exists():
                page_path.unlink()
        for source_path in removed_source_paths:
            if source_path.exists():
                source_path.unlink()

    print(
        {
            "excluded_dois": len(excluded_dois),
            "removed_index_entries": len(removed_entries),
            "removed_page_files": len(removed_paths),
            "removed_source_files": len(removed_source_paths),
            "wrote_changes": args.write,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
