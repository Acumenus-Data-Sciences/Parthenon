from __future__ import annotations

import csv
import importlib.util
import sys
from pathlib import Path

import fitz


SCRIPT_PATH = (
    Path(__file__).resolve().parents[3]
    / "OHDSI-scraper"
    / "extract_downloaded_metadata.py"
)
SPEC = importlib.util.spec_from_file_location("extract_downloaded_metadata", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
extract_downloaded_metadata = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = extract_downloaded_metadata
SPEC.loader.exec_module(extract_downloaded_metadata)


def write_pdf(path: Path) -> None:
    document = fitz.open()
    document.set_metadata(
        {
            "title": "Embedded Title",
            "author": "Embedded Author",
            "creator": "Unit Test",
        }
    )
    page = document.new_page()
    page.insert_text((72, 72), "Example PDF")
    document.save(path)
    document.close()


def test_build_metadata_rows_extracts_pdf_details(tmp_path):
    pdf_path = tmp_path / "example.pdf"
    write_pdf(pdf_path)

    manifest_path = tmp_path / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=extract_downloaded_metadata.OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerow(
            {
                "Group ID": "paper-0001",
                "PMID": "1001",
                "PMCID": "PMC1001",
                "DOI": "10.1000/example",
                "Title": "Example title",
                "Authors": "Author A",
                "First Author": "Author A",
                "Journal/Book": "Journal",
                "Publication Year": "2024",
                "Create Date": "2024/01/01",
                "Source Files": "csv-a.csv",
                "Source Row Count": "1",
                "Is OA": "yes",
                "OA URL": "https://example.org/paper.pdf",
                "Download Source": "oa_url",
                "PDF Path": str(pdf_path),
            }
        )

    rows = extract_downloaded_metadata.build_metadata_rows(manifest_path)
    assert len(rows) == 1
    assert rows[0]["Page Count"] == "1"
    assert rows[0]["PDF Title"] == "Embedded Title"
    assert rows[0]["PDF Author"] == "Embedded Author"
    assert rows[0]["File Size Bytes"].isdigit()
    assert len(rows[0]["SHA256"]) == 64
