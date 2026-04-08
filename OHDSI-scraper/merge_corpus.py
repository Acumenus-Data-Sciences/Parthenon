#!/usr/bin/env python3
"""Merge high-quality OHDSI Papers + validated_oa_corpus into a single deduplicated directory.

Steps:
  1. Load 679 high-quality papers from ohdsi_papers_metadata.csv (crossref + existing_csv only)
  2. Load 345 papers from validated_oa_corpus/metadata/downloaded_paper_metadata.csv
  3. Deduplicate by DOI (prefer validated_oa_corpus when both exist — richer metadata)
  4. Copy all PDFs into OHDSI-scraper/corpus/pdfs/
  5. Write merged metadata to OHDSI-scraper/corpus/metadata.csv
"""
from __future__ import annotations

import csv
import shutil
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
OHDSI_PAPERS_DIR = BASE_DIR / "OHDSI Papers"
OHDSI_META = BASE_DIR / "ohdsi_papers_metadata.csv"
VALIDATED_DIR = BASE_DIR / "validated_oa_corpus" / "pdfs"
VALIDATED_META = BASE_DIR / "validated_oa_corpus" / "metadata" / "downloaded_paper_metadata.csv"
EXCLUSIONS_CSV = BASE_DIR / "corpus_exclusions.csv"
OUTPUT_DIR = BASE_DIR / "corpus"
OUTPUT_PDFS = OUTPUT_DIR / "pdfs"
OUTPUT_CSV = OUTPUT_DIR / "metadata.csv"

# Unified output columns — superset of both sources
OUTPUT_COLUMNS = [
    "DOI",
    "PMID",
    "PMCID",
    "Title",
    "Authors",
    "First Author",
    "Journal",
    "Publication Year",
    "Create Date",
    "Citation",
    "Source",
    "Filename",
    "File Size Bytes",
    "Page Count",
    "SHA256",
    "PDF Title",
    "PDF Author",
    "PDF Subject",
    "PDF Keywords",
]


def normalize_doi(doi: str) -> str:
    """Lowercase, strip whitespace."""
    return doi.strip().lower()


def load_exclusions() -> set[str]:
    """Load DOI exclusions for records we intentionally keep out of the merged corpus."""
    if not EXCLUSIONS_CSV.exists():
        return set()
    excluded: set[str] = set()
    with EXCLUSIONS_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            doi = normalize_doi(row.get("DOI", ""))
            if doi:
                excluded.add(doi)
    return excluded


def load_ohdsi_papers() -> dict[str, dict[str, str]]:
    """Load high-quality papers from ohdsi_papers_metadata.csv, keyed by DOI."""
    papers: dict[str, dict[str, str]] = {}
    with OHDSI_META.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # Only keep crossref and existing_csv sources
            if row.get("Metadata Source") not in ("crossref", "existing_csv"):
                continue
            doi = normalize_doi(row.get("DOI", ""))
            if not doi:
                continue
            papers[doi] = {
                "DOI": row.get("DOI", ""),
                "PMID": row.get("PMID", ""),
                "PMCID": row.get("PMCID", ""),
                "Title": row.get("Title", ""),
                "Authors": row.get("Authors", ""),
                "First Author": row.get("First Author", ""),
                "Journal": row.get("Journal", ""),
                "Publication Year": row.get("Publication Year", ""),
                "Create Date": row.get("Create Date", ""),
                "Citation": row.get("Citation", ""),
                "Source": f"ohdsi_papers ({row.get('Metadata Source', '')})",
                "Filename": row.get("Filename", ""),
                "File Size Bytes": row.get("File Size Bytes", ""),
                "Page Count": row.get("Page Count", ""),
                "SHA256": row.get("SHA256", ""),
                "PDF Title": row.get("PDF Title", ""),
                "PDF Author": row.get("PDF Author", ""),
                "PDF Subject": row.get("PDF Subject", ""),
                "PDF Keywords": row.get("PDF Keywords", ""),
                "_pdf_path": str(OHDSI_PAPERS_DIR / row.get("Filename", "")),
            }
    return papers


def load_validated_corpus() -> dict[str, dict[str, str]]:
    """Load validated_oa_corpus papers, keyed by DOI."""
    papers: dict[str, dict[str, str]] = {}
    with VALIDATED_META.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            doi = normalize_doi(row.get("DOI", ""))
            if not doi:
                continue
            pdf_path = row.get("PDF Path", "")
            filename = Path(pdf_path).name if pdf_path else ""
            papers[doi] = {
                "DOI": row.get("DOI", ""),
                "PMID": row.get("PMID", ""),
                "PMCID": row.get("PMCID", ""),
                "Title": row.get("Title", ""),
                "Authors": row.get("Authors", ""),
                "First Author": row.get("First Author", ""),
                "Journal": row.get("Journal/Book", ""),
                "Publication Year": row.get("Publication Year", ""),
                "Create Date": row.get("Create Date", ""),
                "Citation": "",
                "Source": "validated_oa_corpus",
                "Filename": filename,
                "File Size Bytes": row.get("File Size Bytes", ""),
                "Page Count": row.get("Page Count", ""),
                "SHA256": row.get("SHA256", ""),
                "PDF Title": row.get("PDF Title", ""),
                "PDF Author": row.get("PDF Author", ""),
                "PDF Subject": row.get("PDF Subject", ""),
                "PDF Keywords": row.get("PDF Keywords", ""),
                "_pdf_path": pdf_path,
            }
    return papers


def main() -> int:
    # Load both sources
    exclusions = load_exclusions()
    ohdsi_all = load_ohdsi_papers()
    validated_all = load_validated_corpus()
    ohdsi = {doi: record for doi, record in ohdsi_all.items() if doi not in exclusions}
    validated = {doi: record for doi, record in validated_all.items() if doi not in exclusions}
    print(f"OHDSI Papers (high-quality): {len(ohdsi)}")
    print(f"Validated OA Corpus: {len(validated)}")
    print(f"Excluded DOIs: {len(exclusions)}")

    # Merge — validated wins on duplicates (richer metadata with PMID/PMCID)
    merged: dict[str, dict[str, str]] = {}

    # Start with OHDSI papers
    for doi, record in ohdsi.items():
        merged[doi] = record

    # Overlay validated corpus — overwrites duplicates, adds new
    dupes = 0
    new_from_validated = 0
    for doi, record in validated.items():
        if doi in merged:
            # Validated has richer metadata — prefer it, but keep OHDSI fields if validated is empty
            ohdsi_rec = merged[doi]
            for col in OUTPUT_COLUMNS:
                if not record.get(col) and ohdsi_rec.get(col):
                    record[col] = ohdsi_rec[col]
            record["Source"] = "both"
            dupes += 1
        else:
            new_from_validated += 1
        merged[doi] = record

    print(f"\nDeduplication:")
    print(f"  Duplicates (same DOI in both): {dupes}")
    print(f"  Unique from OHDSI Papers: {len(ohdsi) - dupes}")
    print(f"  Unique from Validated Corpus: {new_from_validated}")
    print(f"  Total merged: {len(merged)}")

    # Create output directory
    OUTPUT_PDFS.mkdir(parents=True, exist_ok=True)

    expected_filenames = {
        Path(record.get("_pdf_path", "")).name
        for record in merged.values()
        if record.get("_pdf_path")
    }
    removed = 0
    for existing_pdf in OUTPUT_PDFS.glob("*.pdf"):
        if existing_pdf.name in expected_filenames:
            continue
        existing_pdf.unlink()
        removed += 1

    # Copy PDFs and write CSV
    copied = 0
    missing = 0
    rows: list[dict[str, str]] = []

    for doi in sorted(merged.keys()):
        record = merged[doi]
        src_path = Path(record.get("_pdf_path", ""))

        if src_path.exists():
            dest = OUTPUT_PDFS / src_path.name
            if not dest.exists():
                shutil.copy2(src_path, dest)
            record["Filename"] = src_path.name
            copied += 1
        else:
            missing += 1
            print(f"  WARNING: PDF not found: {src_path}", file=sys.stderr)

        # Build output row (exclude internal _pdf_path)
        row = {col: record.get(col, "") for col in OUTPUT_COLUMNS}
        rows.append(row)

    # Write metadata CSV
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nOutput:")
    print(f"  PDFs copied: {copied}")
    print(f"  PDFs removed: {removed}")
    print(f"  PDFs missing: {missing}")
    print(f"  Metadata rows: {len(rows)}")
    print(f"  Directory: {OUTPUT_DIR}")
    print(f"  CSV: {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
