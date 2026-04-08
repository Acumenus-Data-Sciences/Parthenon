#!/usr/bin/env python3
"""Backfill missing required corpus metadata from Crossref.

This repair pass is intentionally narrow: it only updates records that are
already eligible for the merged corpus and are missing strict wiki gating
fields (`Authors`, `Journal`, `Publication Year`).

It also writes a report describing what was filled and which records still
need explicit exclusion because the authoritative DOI record remains
authorless (for example cover matter or correction notices).
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable

BASE_DIR = Path(__file__).parent
OHDSI_META = BASE_DIR / "ohdsi_papers_metadata.csv"
VALIDATED_META = BASE_DIR / "validated_oa_corpus" / "metadata" / "downloaded_paper_metadata.csv"
CACHE_DIR = BASE_DIR / ".cache" / "crossref"
REPORT_COLUMNS = [
    "dataset",
    "doi",
    "title",
    "missing_before",
    "fields_filled",
    "remaining_missing",
    "crossref_type",
    "crossref_subtype",
    "recommended_action",
    "note",
    "doi_url",
]
USER_AGENT = "Parthenon-OHDSI-Scraper/1.0 (mailto:sanjay@acumenus.net)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill missing metadata from Crossref.")
    parser.add_argument("--write", action="store_true", help="Write updates back to the source CSVs.")
    parser.add_argument(
        "--report-dir",
        default=str(BASE_DIR.parent / "output" / "ingestion-quality" / "2026-04-08" / "wiki_pages"),
        help="Directory for CSV backfill reports.",
    )
    parser.add_argument("--sleep-seconds", type=float, default=1.1, help="Delay between uncached Crossref requests.")
    return parser.parse_args()


def normalize_text(value: Any) -> str:
    text = html.unescape(str(value or ""))
    text = text.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_doi(doi: str) -> str:
    return normalize_text(doi).lower()


def cache_path_for_doi(doi: str) -> Path:
    safe = re.sub(r"[^a-z0-9._-]+", "_", doi.lower())
    return CACHE_DIR / f"{safe}.json"


def fetch_crossref(doi: str, *, sleep_seconds: float) -> dict[str, Any] | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = cache_path_for_doi(doi)
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    url = "https://api.crossref.org/works/" + urllib.parse.quote(doi, safe="")
    headers = {"User-Agent": USER_AGENT}
    context = ssl.create_default_context()
    last_error: Exception | None = None

    for attempt in range(5):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, context=context, timeout=30) as response:
                payload = json.load(response).get("message", {})
            cache_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
            time.sleep(sleep_seconds)
            return payload
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {429, 500, 502, 503, 504}:
                break
            time.sleep(max(sleep_seconds, 2**attempt))
        except Exception as exc:  # pragma: no cover - network edge cases
            last_error = exc
            time.sleep(max(sleep_seconds, 2**attempt))

    print(f"WARNING: Crossref lookup failed for {doi}: {last_error}", file=sys.stderr)
    return None


def extract_first_date_part(message: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        date_info = message.get(key) or {}
        parts = date_info.get("date-parts") or []
        if not parts or not parts[0]:
            continue
        year = parts[0][0]
        if isinstance(year, int) and 1000 <= year <= 9999:
            return str(year)
    return ""


def format_authors(authors: list[dict[str, Any]]) -> tuple[str, str]:
    formatted: list[str] = []
    for author in authors or []:
        family = normalize_text(author.get("family"))
        given = normalize_text(author.get("given"))
        if family and given:
            formatted.append(f"{family} {given[0]}")
        elif family:
            formatted.append(family)
        elif given:
            formatted.append(given)
    if not formatted:
        return ("", "")
    return (", ".join(formatted), formatted[0])


def iter_text_values(value: Any) -> list[str]:
    if isinstance(value, list):
        return [normalize_text(item) for item in value]
    candidate = normalize_text(value)
    return [candidate] if candidate else []


def extract_journal(doi: str, message: dict[str, Any]) -> str:
    for key in ("container-title", "short-container-title", "group-title"):
        for candidate in iter_text_values(message.get(key)):
            if candidate:
                return candidate

    if normalize_text(message.get("type")) == "posted-content":
        institutions = message.get("institution") or []
        for institution in institutions:
            candidate = normalize_text((institution or {}).get("name"))
            if candidate:
                return candidate
        if doi.lower().startswith("10.7554/elife."):
            return "eLife"
        publisher = normalize_text(message.get("publisher"))
        if publisher:
            return publisher

    return ""


def journal_needs_repair(row: dict[str, str], journal_field: str) -> bool:
    journal = normalize_text(row.get(journal_field))
    doi = normalize_doi(row.get("DOI", ""))
    if len(journal) != 1:
        return False
    return doi.startswith(("10.1101/", "10.64898/", "10.7554/elife."))


def missing_fields(row: dict[str, str], journal_field: str) -> list[str]:
    fields = []
    for field in ("Authors", journal_field, "Publication Year"):
        if not normalize_text(row.get(field)):
            fields.append(field)
    if journal_needs_repair(row, journal_field) and journal_field not in fields:
        fields.append(journal_field)
    return fields


def classify_unresolved(title: str) -> tuple[str, str]:
    lowered = title.lower()
    if lowered.startswith("correction to:"):
        return ("exclude_from_corpus", "Correction notice remains authorless in authoritative metadata")
    if "cover and back matter" in lowered:
        return ("exclude_from_corpus", "Cover/back matter remains authorless in authoritative metadata")
    if "publication information" in lowered:
        return ("exclude_from_corpus", "Publication information page remains authorless in authoritative metadata")
    if "notes on contributors" in lowered and "back matter" in lowered:
        return ("exclude_from_corpus", "Back matter record remains authorless in authoritative metadata")
    if lowered == "officers/committee":
        return ("exclude_from_corpus", "Committee notice remains authorless in authoritative metadata")
    if "ieee power" in lowered and "society" in lowered:
        return ("exclude_from_corpus", "Society notice remains authorless in authoritative metadata")
    return ("manual_review", "Missing required metadata remains unresolved after Crossref lookup")


def backfill_rows(
    rows: list[dict[str, str]],
    *,
    dataset: str,
    journal_field: str,
    should_process: Callable[[dict[str, str]], bool],
    sleep_seconds: float,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    report_rows: list[dict[str, str]] = []

    for row in rows:
        if not should_process(row):
            continue
        doi = normalize_doi(row.get("DOI", ""))
        if not doi:
            continue

        missing_before = missing_fields(row, journal_field)
        if not missing_before:
            continue

        message = fetch_crossref(doi, sleep_seconds=sleep_seconds)
        if message is None:
            recommended_action, note = classify_unresolved(normalize_text(row.get("Title")))
            report_rows.append(
                {
                    "dataset": dataset,
                    "doi": doi,
                    "title": normalize_text(row.get("Title")),
                    "missing_before": ", ".join(missing_before),
                    "fields_filled": "",
                    "remaining_missing": ", ".join(missing_before),
                    "crossref_type": "",
                    "crossref_subtype": "",
                    "recommended_action": recommended_action,
                    "note": f"{note}; Crossref lookup failed",
                    "doi_url": f"https://doi.org/{doi}",
                }
            )
            continue

        fields_filled: list[str] = []

        if "Authors" in missing_before:
            authors, first_author = format_authors(message.get("author") or [])
            if authors:
                row["Authors"] = authors
                fields_filled.append("Authors")
                if not normalize_text(row.get("First Author")) and first_author:
                    row["First Author"] = first_author

        if journal_field in missing_before:
            journal = extract_journal(doi, message)
            if journal:
                row[journal_field] = journal
                fields_filled.append(journal_field)

        if "Publication Year" in missing_before:
            year = extract_first_date_part(
                message,
                ["issued", "published-print", "published-online", "posted", "created"],
            )
            if year:
                row["Publication Year"] = year
                fields_filled.append("Publication Year")

        remaining_missing = missing_fields(row, journal_field)
        if remaining_missing:
            recommended_action, note = classify_unresolved(normalize_text(row.get("Title")))
        else:
            recommended_action = "keep"
            note = "Required metadata fully populated from authoritative DOI record"

        report_rows.append(
            {
                "dataset": dataset,
                "doi": doi,
                "title": normalize_text(row.get("Title")),
                "missing_before": ", ".join(missing_before),
                "fields_filled": ", ".join(fields_filled),
                "remaining_missing": ", ".join(remaining_missing),
                "crossref_type": normalize_text(message.get("type")),
                "crossref_subtype": normalize_text(message.get("subtype")),
                "recommended_action": recommended_action,
                "note": note,
                "doi_url": f"https://doi.org/{doi}",
            }
        )

    return (rows, report_rows)


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)

    ohdsi_rows = list(csv.DictReader(OHDSI_META.open("r", encoding="utf-8", newline="")))
    validated_rows = list(csv.DictReader(VALIDATED_META.open("r", encoding="utf-8", newline="")))
    ohdsi_fields = ohdsi_rows[0].keys() if ohdsi_rows else []
    validated_fields = validated_rows[0].keys() if validated_rows else []

    ohdsi_rows, ohdsi_report = backfill_rows(
        ohdsi_rows,
        dataset="ohdsi_papers_metadata",
        journal_field="Journal",
        should_process=lambda row: normalize_text(row.get("Metadata Source")) in {"crossref", "existing_csv"},
        sleep_seconds=args.sleep_seconds,
    )
    validated_rows, validated_report = backfill_rows(
        validated_rows,
        dataset="validated_oa_corpus",
        journal_field="Journal/Book",
        should_process=lambda row: True,
        sleep_seconds=args.sleep_seconds,
    )

    if args.write:
        write_csv(OHDSI_META, ohdsi_rows, list(ohdsi_fields))
        write_csv(VALIDATED_META, validated_rows, list(validated_fields))

    all_report_rows = ohdsi_report + validated_report
    write_csv(report_dir / "metadata_backfill_report.csv", all_report_rows, REPORT_COLUMNS)
    unresolved = [row for row in all_report_rows if row["remaining_missing"]]
    write_csv(report_dir / "metadata_backfill_unresolved.csv", unresolved, REPORT_COLUMNS)

    filled = sum(1 for row in all_report_rows if row["fields_filled"])
    print(
        json.dumps(
            {
                "report_rows": len(all_report_rows),
                "filled_rows": filled,
                "unresolved_rows": len(unresolved),
                "wrote_updates": args.write,
                "report_dir": str(report_dir),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
