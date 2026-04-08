#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
from pathlib import Path

import fitz


OUTPUT_COLUMNS = [
    "Group ID",
    "PMID",
    "PMCID",
    "DOI",
    "Title",
    "Authors",
    "First Author",
    "Journal/Book",
    "Publication Year",
    "Create Date",
    "Source Files",
    "Source Row Count",
    "Is OA",
    "OA URL",
    "Download Source",
    "PDF Path",
    "File Size Bytes",
    "SHA256",
    "Page Count",
    "PDF Title",
    "PDF Author",
    "PDF Subject",
    "PDF Keywords",
    "PDF Creator",
    "PDF Producer",
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_pdf_details(path: Path) -> dict[str, str]:
    with fitz.open(path) as document:
        metadata = document.metadata or {}
        return {
            "Page Count": str(document.page_count),
            "PDF Title": metadata.get("title", "") or "",
            "PDF Author": metadata.get("author", "") or "",
            "PDF Subject": metadata.get("subject", "") or "",
            "PDF Keywords": metadata.get("keywords", "") or "",
            "PDF Creator": metadata.get("creator", "") or "",
            "PDF Producer": metadata.get("producer", "") or "",
        }


def build_metadata_rows(manifest_path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with manifest_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            pdf_path_value = (row.get("PDF Path") or "").strip()
            if not pdf_path_value:
                continue

            pdf_path = Path(pdf_path_value)
            if not pdf_path.exists():
                continue

            record = {column: row.get(column, "") for column in OUTPUT_COLUMNS}
            record["PDF Path"] = str(pdf_path.resolve())
            record["File Size Bytes"] = str(pdf_path.stat().st_size)
            record["SHA256"] = sha256_file(pdf_path)
            record.update(extract_pdf_details(pdf_path))
            rows.append(record)
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract downloaded paper metadata into a CSV file.")
    parser.add_argument(
        "--manifest",
        default="OHDSI-scraper/validated_oa_corpus/metadata/deduped_manifest.csv",
        help="Path to the deduped manifest CSV.",
    )
    parser.add_argument(
        "--output",
        default="OHDSI-scraper/validated_oa_corpus/metadata/downloaded_paper_metadata.csv",
        help="Path for the extracted metadata CSV.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()

    rows = build_metadata_rows(manifest_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} metadata rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
