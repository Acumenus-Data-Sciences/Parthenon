#!/usr/bin/env python3
"""Extract metadata for all PDFs in OHDSI Papers/ into a CSV.

For each PDF:
  1. Parse DOI (or OpenAlex ID) from filename
  2. Look up metadata in the existing csv-*.csv files
  3. Extract PDF-embedded metadata via PyMuPDF
  4. For papers not in existing CSVs, query CrossRef API
  5. Write consolidated CSV
"""
from __future__ import annotations

import csv
import hashlib
import re
import sys
import time
from pathlib import Path
from typing import Any

import fitz
import requests

PAPERS_DIR = Path(__file__).parent / "OHDSI Papers"
OUTPUT_CSV = Path(__file__).parent / "ohdsi_papers_metadata.csv"
EXISTING_CSVS = [
    Path(__file__).parent / "csv-OHDSI-set.csv",
    Path(__file__).parent / "csv-ohdsiomop-set.csv",
    Path(__file__).parent / "csv-omop-set.csv",
]

OUTPUT_COLUMNS = [
    "Filename",
    "DOI",
    "OpenAlex ID",
    "PMID",
    "PMCID",
    "Title",
    "Authors",
    "First Author",
    "Journal",
    "Publication Year",
    "Create Date",
    "Citation",
    "Metadata Source",
    "File Size Bytes",
    "Page Count",
    "SHA256",
    "PDF Title",
    "PDF Author",
    "PDF Subject",
    "PDF Keywords",
    "PDF Creator",
    "PDF Producer",
]

CROSSREF_API = "https://api.crossref.org/works/"
CROSSREF_HEADERS = {
    "User-Agent": "Parthenon-OHDSI-Scraper/1.0 (mailto:sanjay@acumenus.net)",
}


def parse_filename(filename: str) -> tuple[str, str]:
    """Return (doi, openalex_id) parsed from filename."""
    stem = Path(filename).stem
    # Remove the trailing __<hash> suffix
    stem = re.sub(r"__[0-9a-f]{12}$", "", stem)

    if stem.startswith("https_openalex.org_"):
        openalex_id = stem.replace("https_openalex.org_", "")
        return ("", openalex_id)

    # DOI: replace _ with / for the first segment, rest stays as-is
    # Filename pattern: 10.XXXX_rest__hash.pdf  (underscore = /)
    # But DOIs can have multiple slashes, so we reconstruct carefully
    # The first _ after 10.XXXX is the slash separator
    doi = re.sub(r"^(10\.\d{4,5})_", r"\1/", stem, count=1)
    return (doi, "")


def load_existing_metadata() -> dict[str, dict[str, str]]:
    """Load metadata from existing CSVs, keyed by lowercase DOI."""
    lookup: dict[str, dict[str, str]] = {}
    for csv_path in EXISTING_CSVS:
        if not csv_path.exists():
            continue
        with csv_path.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                doi = (row.get("DOI") or "").strip().lower()
                if doi:
                    lookup[doi] = row
    return lookup


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_pdf_metadata(path: Path) -> dict[str, str]:
    """Extract embedded metadata and page count from a PDF."""
    try:
        with fitz.open(path) as doc:
            meta = doc.metadata or {}
            return {
                "Page Count": str(doc.page_count),
                "PDF Title": (meta.get("title") or "").strip(),
                "PDF Author": (meta.get("author") or "").strip(),
                "PDF Subject": (meta.get("subject") or "").strip(),
                "PDF Keywords": (meta.get("keywords") or "").strip(),
                "PDF Creator": (meta.get("creator") or "").strip(),
                "PDF Producer": (meta.get("producer") or "").strip(),
            }
    except Exception as exc:
        print(f"  WARNING: Could not read PDF metadata for {path.name}: {exc}", file=sys.stderr)
        return {
            "Page Count": "",
            "PDF Title": "",
            "PDF Author": "",
            "PDF Subject": "",
            "PDF Keywords": "",
            "PDF Creator": "",
            "PDF Producer": "",
        }


def query_crossref(doi: str) -> dict[str, Any] | None:
    """Query CrossRef for metadata by DOI. Returns None on failure."""
    try:
        resp = requests.get(
            f"{CROSSREF_API}{doi}",
            headers=CROSSREF_HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json().get("message", {})
        return None
    except Exception:
        return None


def format_crossref_authors(authors: list[dict[str, str]]) -> tuple[str, str]:
    """Return (all_authors_str, first_author_str) from CrossRef author list."""
    if not authors:
        return ("", "")
    parts = []
    for a in authors:
        family = a.get("family", "")
        given = a.get("given", "")
        if family and given:
            parts.append(f"{family} {given[0]}")
        elif family:
            parts.append(family)
    first = parts[0] if parts else ""
    return (", ".join(parts), first)


def main() -> int:
    if not PAPERS_DIR.exists():
        print(f"ERROR: {PAPERS_DIR} not found", file=sys.stderr)
        return 1

    pdfs = sorted(PAPERS_DIR.glob("*.pdf"))
    print(f"Found {len(pdfs)} PDFs in {PAPERS_DIR}")

    # Load existing metadata
    existing = load_existing_metadata()
    print(f"Loaded {len(existing)} existing metadata records from CSVs")

    rows: list[dict[str, str]] = []
    crossref_hits = 0
    crossref_misses = 0
    existing_hits = 0

    for i, pdf_path in enumerate(pdfs, 1):
        if i % 50 == 0:
            print(f"  Processing {i}/{len(pdfs)}...")

        doi, openalex_id = parse_filename(pdf_path.name)
        doi_lower = doi.lower()

        record: dict[str, str] = {col: "" for col in OUTPUT_COLUMNS}
        record["Filename"] = pdf_path.name
        record["DOI"] = doi
        record["OpenAlex ID"] = openalex_id
        record["File Size Bytes"] = str(pdf_path.stat().st_size)
        record["SHA256"] = sha256_file(pdf_path)

        # PDF metadata
        pdf_meta = extract_pdf_metadata(pdf_path)
        record.update(pdf_meta)

        # Try existing CSV metadata
        if doi_lower and doi_lower in existing:
            ex = existing[doi_lower]
            record["PMID"] = ex.get("PMID", "")
            record["PMCID"] = ex.get("PMCID", "")
            record["Title"] = ex.get("Title", "")
            record["Authors"] = ex.get("Authors", "")
            record["First Author"] = ex.get("First Author", "")
            record["Journal"] = ex.get("Journal/Book", "")
            record["Publication Year"] = ex.get("Publication Year", "")
            record["Create Date"] = ex.get("Create Date", "")
            record["Citation"] = ex.get("Citation", "")
            record["Metadata Source"] = "existing_csv"
            existing_hits += 1
        elif doi:
            # Query CrossRef
            cr = query_crossref(doi)
            if cr:
                title_parts = cr.get("title", [])
                record["Title"] = title_parts[0] if title_parts else ""
                authors_list = cr.get("author", [])
                record["Authors"], record["First Author"] = format_crossref_authors(authors_list)
                container = cr.get("container-title", [])
                record["Journal"] = container[0] if container else ""
                # Publication year
                issued = cr.get("issued", {}).get("date-parts", [[]])
                if issued and issued[0]:
                    record["Publication Year"] = str(issued[0][0]) if issued[0][0] else ""
                record["Metadata Source"] = "crossref"
                crossref_hits += 1
                # Be polite to CrossRef
                time.sleep(0.1)
            else:
                # Fall back to PDF title
                record["Title"] = record["PDF Title"]
                record["Metadata Source"] = "pdf_only"
                crossref_misses += 1
                time.sleep(0.1)
        else:
            # OpenAlex ID only — use PDF title
            record["Title"] = record["PDF Title"]
            record["Metadata Source"] = "pdf_only"

        rows.append(record)

    # Write output
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDone! Wrote {len(rows)} rows to {OUTPUT_CSV}")
    print(f"  Existing CSV matches: {existing_hits}")
    print(f"  CrossRef lookups: {crossref_hits}")
    print(f"  PDF-only (no external metadata): {crossref_misses + (len(pdfs) - existing_hits - crossref_hits - crossref_misses)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
