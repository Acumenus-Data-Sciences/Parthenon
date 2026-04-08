from __future__ import annotations

import csv
import importlib.util
import sys
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[3]
    / "OHDSI-scraper"
    / "download_validated_papers.py"
)
SPEC = importlib.util.spec_from_file_location("download_validated_papers", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
download_validated_papers = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = download_validated_papers
SPEC.loader.exec_module(download_validated_papers)


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=download_validated_papers.CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def test_deduplicate_rows_merges_shared_identifiers_and_prefers_richer_record(tmp_path):
    file_one = tmp_path / "csv-a.csv"
    file_two = tmp_path / "csv-b.csv"

    write_csv(
        file_one,
        [
            {
                "PMID": "1001",
                "Title": "Shared paper title",
                "Authors": "Author A",
                "Citation": "Journal citation",
                "First Author": "Author A",
                "Journal/Book": "Journal",
                "Publication Year": "2024",
                "Create Date": "2024/01/01",
                "PMCID": "",
                "NIHMS ID": "",
                "DOI": "10.1000/example",
            },
            {
                "PMID": "1002",
                "Title": "Unique paper",
                "Authors": "Author B",
                "Citation": "Unique citation",
                "First Author": "Author B",
                "Journal/Book": "Journal",
                "Publication Year": "2023",
                "Create Date": "2023/01/01",
                "PMCID": "PMC2002",
                "NIHMS ID": "",
                "DOI": "10.1000/unique",
            },
        ],
    )
    write_csv(
        file_two,
        [
            {
                "PMID": "1001",
                "Title": "Shared paper title",
                "Authors": "Author A; Author C",
                "Citation": "Journal citation",
                "First Author": "Author A",
                "Journal/Book": "Journal",
                "Publication Year": "2024",
                "Create Date": "2024/01/02",
                "PMCID": "PMC1001",
                "NIHMS ID": "",
                "DOI": "https://doi.org/10.1000/example",
            }
        ],
    )

    rows = download_validated_papers.read_source_rows([file_one, file_two])
    papers = download_validated_papers.deduplicate_rows(rows)

    assert len(papers) == 2
    shared = next(paper for paper in papers if paper.value("PMID") == "1001")
    assert shared.source_row_count == 2
    assert shared.value("PMCID") == "PMC1001"
    assert shared.source_files == ["csv-a.csv", "csv-b.csv"]


def test_write_reports_emits_manifest_duplicate_report_and_summary(tmp_path):
    rows = [
        download_validated_papers.SourceRow(
            source_file="csv-a.csv",
            source_row_number=2,
            values={
                "PMID": "1001",
                "Title": "Shared paper title",
                "Authors": "Author A",
                "Citation": "Citation",
                "First Author": "Author A",
                "Journal/Book": "Journal",
                "Publication Year": "2024",
                "Create Date": "2024/01/01",
                "PMCID": "PMC1001",
                "NIHMS ID": "",
                "DOI": "10.1000/example",
            },
        ),
        download_validated_papers.SourceRow(
            source_file="csv-b.csv",
            source_row_number=2,
            values={
                "PMID": "1001",
                "Title": "Shared paper title",
                "Authors": "Author A",
                "Citation": "Citation",
                "First Author": "Author A",
                "Journal/Book": "Journal",
                "Publication Year": "2024",
                "Create Date": "2024/01/01",
                "PMCID": "PMC1001",
                "NIHMS ID": "",
                "DOI": "10.1000/example",
            },
        ),
    ]

    papers = download_validated_papers.deduplicate_rows(rows)
    papers[0].is_oa = True
    papers[0].pdf_path = "/tmp/example.pdf"
    papers[0].download_status = "downloaded"

    manifest_path, duplicate_groups_path, summary_path = download_validated_papers.write_reports(
        tmp_path,
        papers,
    )

    manifest_rows = list(csv.DictReader(manifest_path.open(encoding="utf-8")))
    duplicate_rows = list(csv.DictReader(duplicate_groups_path.open(encoding="utf-8")))

    assert manifest_rows[0]["Source Row Count"] == "2"
    assert manifest_rows[0]["Download Status"] == "downloaded"
    assert len(duplicate_rows) == 2

    summary = summary_path.read_text(encoding="utf-8")
    assert '"unique_papers": 1' in summary
    assert '"downloaded_pdfs": 1' in summary
