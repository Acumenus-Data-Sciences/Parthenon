#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import functools
import glob
import importlib.util
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_DIR = SCRIPT_DIR / "validated_oa_corpus"
CSV_COLUMNS = [
    "PMID",
    "Title",
    "Authors",
    "Citation",
    "First Author",
    "Journal/Book",
    "Publication Year",
    "Create Date",
    "PMCID",
    "NIHMS ID",
    "DOI",
]
MANIFEST_COLUMNS = [
    "Group ID",
    *CSV_COLUMNS,
    "Source Files",
    "Source Row Count",
    "Is OA",
    "OA URL",
    "PDF Path",
    "Download Source",
    "Failure Reason",
    "Download Status",
]
GROUP_REPORT_COLUMNS = [
    "Group ID",
    "Source File",
    "Source Row Number",
    "PMID",
    "PMCID",
    "DOI",
    "Title",
]


@dataclass
class SourceRow:
    source_file: str
    source_row_number: int
    values: dict[str, str]

    def value(self, field_name: str) -> str:
        return (self.values.get(field_name) or "").strip()


@dataclass
class DedupedPaper:
    group_id: str
    canonical: SourceRow
    members: list[SourceRow] = field(default_factory=list)
    is_oa: bool = False
    oa_url: str = ""
    pdf_path: str = ""
    download_source: str = ""
    failure_reason: str = ""
    download_status: str = "pending"

    def value(self, field_name: str) -> str:
        return self.canonical.value(field_name)

    @property
    def source_files(self) -> list[str]:
        return sorted({member.source_file for member in self.members})

    @property
    def source_row_count(self) -> int:
        return len(self.members)

    def to_manifest_row(self) -> dict[str, str]:
        row = {
            "Group ID": self.group_id,
            "Source Files": ";".join(self.source_files),
            "Source Row Count": str(self.source_row_count),
            "Is OA": "yes" if self.is_oa else "no",
            "OA URL": self.oa_url,
            "PDF Path": self.pdf_path,
            "Download Source": self.download_source,
            "Failure Reason": self.failure_reason,
            "Download Status": self.download_status,
        }
        for column in CSV_COLUMNS:
            row[column] = self.value(column)
        return row


class DisjointSet:
    def __init__(self, size: int):
        self.parents = list(range(size))

    def find(self, index: int) -> int:
        while self.parents[index] != index:
            self.parents[index] = self.parents[self.parents[index]]
            index = self.parents[index]
        return index

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parents[right_root] = left_root


def normalize_whitespace(value: str) -> str:
    return " ".join(value.split()).strip()


def normalize_doi(value: str) -> str:
    cleaned = normalize_whitespace(value).lower()
    cleaned = cleaned.replace("https://doi.org/", "")
    cleaned = cleaned.replace("http://doi.org/", "")
    cleaned = cleaned.replace("doi:", "")
    return cleaned.strip().rstrip(".")


def normalize_pmcid(value: str) -> str:
    cleaned = normalize_whitespace(value).upper()
    if cleaned and not cleaned.startswith("PMC"):
        cleaned = f"PMC{cleaned}"
    return cleaned


def normalize_title(value: str) -> str:
    return normalize_whitespace(value).lower()


def coerce_year(value: str) -> Optional[int]:
    cleaned = normalize_whitespace(value)
    if not cleaned:
        return None
    try:
        return int(cleaned)
    except ValueError:
        return None


def input_csv_paths(pattern: str) -> list[Path]:
    glob_pattern = pattern
    if not os.path.isabs(pattern):
        glob_pattern = str(SCRIPT_DIR / pattern)
    return sorted(Path(path) for path in glob.glob(glob_pattern))


def read_source_rows(paths: list[Path]) -> list[SourceRow]:
    rows: list[SourceRow] = []
    for path in paths:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            for row_number, row in enumerate(reader, start=2):
                values = {column: normalize_whitespace(row.get(column, "")) for column in CSV_COLUMNS}
                rows.append(
                    SourceRow(
                        source_file=path.name,
                        source_row_number=row_number,
                        values=values,
                    )
                )
    return rows


def dedupe_keys(row: SourceRow) -> list[tuple[str, str]]:
    keys: list[tuple[str, str]] = []
    doi = normalize_doi(row.value("DOI"))
    pmcid = normalize_pmcid(row.value("PMCID"))
    pmid = normalize_whitespace(row.value("PMID"))
    title = normalize_title(row.value("Title"))

    if doi:
        keys.append(("doi", doi))
    if pmcid:
        keys.append(("pmcid", pmcid))
    if pmid:
        keys.append(("pmid", pmid))
    if title:
        keys.append(("title", title))
    return keys


def canonical_sort_key(row: SourceRow, source_priority: dict[str, int]) -> tuple[int, int, int, int, int, int]:
    populated_fields = sum(1 for column in CSV_COLUMNS if row.value(column))
    return (
        1 if normalize_pmcid(row.value("PMCID")) else 0,
        1 if normalize_doi(row.value("DOI")) else 0,
        1 if row.value("PMID") else 0,
        populated_fields,
        len(row.value("Title")),
        -(source_priority[row.source_file] * 100000 + row.source_row_number),
    )


def deduplicate_rows(rows: list[SourceRow]) -> list[DedupedPaper]:
    if not rows:
        return []

    dsu = DisjointSet(len(rows))
    seen_by_key: dict[tuple[str, str], int] = {}
    for index, row in enumerate(rows):
        for key in dedupe_keys(row):
            if key in seen_by_key:
                dsu.union(index, seen_by_key[key])
            else:
                seen_by_key[key] = index

    clusters: dict[int, list[SourceRow]] = {}
    for index, row in enumerate(rows):
        clusters.setdefault(dsu.find(index), []).append(row)

    source_priority = {
        source_file: order
        for order, source_file in enumerate(sorted({row.source_file for row in rows}))
    }

    deduped: list[DedupedPaper] = []
    ordered_groups = sorted(
        clusters.values(),
        key=lambda members: (
            min(source_priority[member.source_file] for member in members),
            min(member.source_row_number for member in members),
        ),
    )

    for group_index, members in enumerate(ordered_groups, start=1):
        canonical = max(members, key=lambda row: canonical_sort_key(row, source_priority))
        deduped.append(
            DedupedPaper(
                group_id=f"paper-{group_index:04d}",
                canonical=canonical,
                members=sorted(
                    members,
                    key=lambda member: (source_priority[member.source_file], member.source_row_number),
                ),
            )
        )

    return deduped


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_reports(output_dir: Path, deduped_papers: list[DedupedPaper]) -> tuple[Path, Path, Path]:
    manifest_path = output_dir / "metadata" / "deduped_manifest.csv"
    duplicate_groups_path = output_dir / "metadata" / "duplicate_groups.csv"
    summary_path = output_dir / "metadata" / "summary.json"

    manifest_rows = [paper.to_manifest_row() for paper in deduped_papers]
    write_csv(manifest_path, MANIFEST_COLUMNS, manifest_rows)

    duplicate_rows: list[dict[str, str]] = []
    for paper in deduped_papers:
        if paper.source_row_count <= 1:
            continue
        for member in paper.members:
            duplicate_rows.append(
                {
                    "Group ID": paper.group_id,
                    "Source File": member.source_file,
                    "Source Row Number": str(member.source_row_number),
                    "PMID": member.value("PMID"),
                    "PMCID": member.value("PMCID"),
                    "DOI": member.value("DOI"),
                    "Title": member.value("Title"),
                }
            )
    write_csv(duplicate_groups_path, GROUP_REPORT_COLUMNS, duplicate_rows)

    summary = summarize_papers(deduped_papers)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return manifest_path, duplicate_groups_path, summary_path


def summarize_papers(deduped_papers: list[DedupedPaper]) -> dict[str, int]:
    return {
        "unique_papers": len(deduped_papers),
        "duplicate_groups": sum(1 for paper in deduped_papers if paper.source_row_count > 1),
        "duplicate_rows_removed": sum(paper.source_row_count - 1 for paper in deduped_papers),
        "papers_with_pmcid": sum(1 for paper in deduped_papers if normalize_pmcid(paper.value("PMCID"))),
        "papers_with_doi": sum(1 for paper in deduped_papers if normalize_doi(paper.value("DOI"))),
        "papers_marked_oa": sum(1 for paper in deduped_papers if paper.is_oa),
        "downloaded_pdfs": sum(1 for paper in deduped_papers if paper.pdf_path),
        "failed_downloads": sum(1 for paper in deduped_papers if paper.download_status == "failed"),
    }


@functools.lru_cache(maxsize=1)
def load_harvester_module():
    harvester_path = SCRIPT_DIR / "harvester.py"
    spec = importlib.util.spec_from_file_location("ohdsi_harvester_runtime", harvester_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load harvester module from {harvester_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def configure_logging(output_dir: Path) -> logging.Logger:
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / "download_validated_papers.log"

    root_logger = logging.getLogger()
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_path, mode="a"),
        ],
    )
    return logging.getLogger("download_validated_papers")


def enrich_and_download(
    papers: list[DedupedPaper],
    *,
    output_dir: Path,
    email: str,
    manifest_only: bool,
    skip_download: bool,
    skip_unpaywall: bool,
    download_workers: Optional[int],
    download_delay: Optional[float],
) -> None:
    if manifest_only:
        for paper in papers:
            paper.download_status = "not_attempted"
        return

    harvester = load_harvester_module()
    harvester.CONFIG["email"] = email
    harvester.CONFIG["output_dir"] = str(output_dir)
    harvester.CONFIG["pdf_dir"] = str(output_dir / "pdfs")
    harvester.CONFIG["metadata_dir"] = str(output_dir / "metadata")
    if download_workers is not None:
        harvester.CONFIG["download_workers"] = download_workers
    if download_delay is not None:
        harvester.CONFIG["download_delay"] = download_delay

    paper_objects = [
        harvester.Paper(
            title=paper.value("Title"),
            doi=normalize_doi(paper.value("DOI")) or None,
            pmid=paper.value("PMID") or None,
            pmcid=normalize_pmcid(paper.value("PMCID")) or None,
            year=coerce_year(paper.value("Publication Year")),
            authors=[],
            source="validated_csv",
        )
        for paper in papers
    ]

    paper_objects = harvester.phase3_enrich_with_pubmed(paper_objects)
    if not skip_unpaywall:
        paper_objects = harvester.phase4_unpaywall_enrichment(paper_objects)

    if skip_download:
        for paper, harvested in zip(papers, paper_objects):
            paper.is_oa = bool(harvested.is_oa or harvested.pmcid or harvested.oa_url)
            paper.oa_url = harvested.oa_url or ""
            paper.download_source = harvested.download_source or ""
            paper.failure_reason = harvested.download_error or ""
            paper.download_status = "skipped" if paper.is_oa else "no_open_copy_found"
        return

    paper_objects = harvester.phase5_download_pdfs(paper_objects)
    for paper, harvested in zip(papers, paper_objects):
        paper.is_oa = bool(harvested.is_oa or harvested.pmcid or harvested.oa_url)
        paper.oa_url = harvested.oa_url or ""
        paper.pdf_path = harvested.pdf_path or ""
        paper.download_source = harvested.download_source or ""
        paper.failure_reason = harvested.download_error or ""
        if paper.pdf_path:
            paper.download_status = "downloaded"
        elif paper.is_oa:
            paper.download_status = "failed"
        else:
            paper.download_status = "no_open_copy_found"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deduplicate the validated OHDSI CSV article lists and download legal OA PDFs."
    )
    parser.add_argument(
        "--input-glob",
        default="csv-*.csv",
        help="Glob for the validated CSV inputs, relative to OHDSI-scraper/ unless absolute.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for metadata, logs, and downloaded PDFs.",
    )
    parser.add_argument(
        "--email",
        default=os.environ.get("HARVESTER_EMAIL", ""),
        help="Email used for NCBI and Unpaywall requests. Defaults to HARVESTER_EMAIL.",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Only write deduplicated metadata and OA resolution info; do not download PDFs.",
    )
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Only merge and deduplicate the CSV files. No PMC, Unpaywall, or PDF requests.",
    )
    parser.add_argument(
        "--skip-unpaywall",
        action="store_true",
        help="Do not query Unpaywall. PMC and existing PMCIDs still work.",
    )
    parser.add_argument(
        "--download-workers",
        type=int,
        default=None,
        help="Override harvester download concurrency.",
    )
    parser.add_argument(
        "--download-delay",
        type=float,
        default=None,
        help="Override delay between PDF downloads in seconds.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    log = configure_logging(output_dir)

    csv_paths = input_csv_paths(args.input_glob)
    if not csv_paths:
        log.error("No input CSV files matched %s", args.input_glob)
        return 1

    if not args.manifest_only and not args.email:
        log.error("--email or HARVESTER_EMAIL is required for PMC/Unpaywall resolution")
        return 1

    source_rows = read_source_rows(csv_paths)
    deduped_papers = deduplicate_rows(source_rows)

    log.info("Loaded %d source rows from %d CSV files", len(source_rows), len(csv_paths))
    log.info("Deduplicated to %d unique papers", len(deduped_papers))

    enrich_and_download(
        deduped_papers,
        output_dir=output_dir,
        email=args.email,
        manifest_only=args.manifest_only,
        skip_download=args.skip_download,
        skip_unpaywall=args.skip_unpaywall,
        download_workers=args.download_workers,
        download_delay=args.download_delay,
    )

    manifest_path, duplicate_groups_path, summary_path = write_reports(output_dir, deduped_papers)
    summary = summarize_papers(deduped_papers)

    log.info("Wrote manifest: %s", manifest_path)
    log.info("Wrote duplicate report: %s", duplicate_groups_path)
    log.info("Wrote summary: %s", summary_path)
    log.info(
        "Summary: %d unique papers, %d duplicate rows removed, %d PDFs downloaded",
        summary["unique_papers"],
        summary["duplicate_rows_removed"],
        summary["downloaded_pdfs"],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
