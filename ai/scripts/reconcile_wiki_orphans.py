#!/usr/bin/env python3
"""Reconcile orphaned wiki pages against the workspace index.

This script repairs index omissions caused by partial rebuilds while removing
stale duplicate slug variants. Canonical page selection follows the current
WikiEngine slug rules so the result matches how fresh ingests would behave.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "ai"))

from app.wiki.adapters.base import parse_markdown_page, slugify
from app.wiki.engine import WikiEngine
from app.wiki.index_ops import IndexEntry, read_index, write_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Repair orphaned wiki pages and stale source files.")
    parser.add_argument("--workspace", default="platform")
    parser.add_argument(
        "--report-dir",
        default=str(REPO_ROOT / "output" / "ingestion-quality" / "2026-04-08" / "wiki_pages"),
        help="Directory for reconciliation reports.",
    )
    parser.add_argument("--write", action="store_true", help="Apply the reconciliation changes.")
    return parser.parse_args()


def _metadata_str(metadata: dict[str, str | list[str]], key: str) -> str:
    value = metadata.get(key, "")
    if isinstance(value, list):
        return ", ".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def _metadata_list(metadata: dict[str, str | list[str]], key: str) -> list[str]:
    value = metadata.get(key, [])
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _page_type_from_path(path: str, metadata: dict[str, str | list[str]]) -> str:
    page_type = _metadata_str(metadata, "type")
    if page_type:
        return page_type
    return "concept" if "/concepts/" in path else "source_summary"


def _canonical_source_slug(metadata_rows: list[dict[str, str | list[str]]]) -> str:
    sample = metadata_rows[0]
    source_title = next((_metadata_str(row, "source_title") for row in metadata_rows if _metadata_str(row, "source_title")), "")
    source_title = source_title or _metadata_str(sample, "title")
    identifier = (
        _metadata_str(sample, "doi")
        or _metadata_str(sample, "pmid")
        or _metadata_str(sample, "pmcid")
        or source_title
    )
    return WikiEngine._bounded_slug(slugify(source_title), identifier)


def _canonical_summary_slug(source_slug: str, metadata_rows: list[dict[str, str | list[str]]]) -> str:
    sample = metadata_rows[0]
    source_title = next((_metadata_str(row, "source_title") for row in metadata_rows if _metadata_str(row, "source_title")), "")
    source_title = source_title or _metadata_str(sample, "title")
    return WikiEngine._bounded_slug(
        f"source-summary-{source_slug}",
        f"source_summary:{source_slug}:{source_title}",
    )


def _canonical_page_slug(
    *,
    metadata: dict[str, str | list[str]],
    page_type: str,
    source_slug: str,
) -> str:
    identifier = (
        _metadata_str(metadata, "doi")
        or _metadata_str(metadata, "pmid")
        or _metadata_str(metadata, "pmcid")
        or _metadata_str(metadata, "title")
    )
    return WikiEngine._bounded_slug(
        slugify(_metadata_str(metadata, "title")),
        f"{source_slug}:{page_type}:{identifier}",
    )


def build_index_entry(
    *,
    rel_path: str,
    metadata: dict[str, str | list[str]],
    source_slug: str,
) -> IndexEntry:
    page_type = _page_type_from_path(rel_path, metadata)
    return IndexEntry(
        page_type=page_type,
        title=_metadata_str(metadata, "title"),
        slug=_metadata_str(metadata, "slug"),
        path=rel_path,
        keywords=_metadata_list(metadata, "keywords"),
        links=_metadata_list(metadata, "links"),
        updated_at=_metadata_str(metadata, "updated_at"),
        source_slug=source_slug,
        source_type="pdf",
        ingested_at=_metadata_str(metadata, "updated_at"),
        doi=_metadata_str(metadata, "doi"),
        authors=_metadata_str(metadata, "authors"),
        first_author=_metadata_str(metadata, "first_author"),
        journal=_metadata_str(metadata, "journal"),
        publication_year=_metadata_str(metadata, "publication_year"),
        pmid=_metadata_str(metadata, "pmid"),
        pmcid=_metadata_str(metadata, "pmcid"),
        primary_domain=_metadata_str(metadata, "primary_domain"),
    )


def main() -> int:
    args = parse_args()
    workspace_dir = REPO_ROOT / "data" / "wiki" / args.workspace
    wiki_dir = workspace_dir / "wiki"
    sources_dir = workspace_dir / "sources"
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)

    existing_entries = read_index(workspace_dir)
    indexed_paths = {entry.path for entry in existing_entries}
    existing_by_doi: dict[str, list[IndexEntry]] = defaultdict(list)
    for entry in existing_entries:
        if entry.doi:
            existing_by_doi[entry.doi.lower()].append(entry)

    orphan_groups: dict[str, list[tuple[Path, str, dict[str, str | list[str]]]]] = defaultdict(list)
    for path in sorted(wiki_dir.rglob("*.md")):
        rel_path = str(path.relative_to(workspace_dir)).replace("\\", "/")
        if rel_path in indexed_paths:
            continue
        metadata, _ = parse_markdown_page(path)
        doi = _metadata_str(metadata, "doi").lower()
        orphan_groups[doi].append((path, rel_path, metadata))

    report_rows: list[dict[str, str]] = []
    entries_to_add: list[IndexEntry] = []
    markdown_to_delete: list[Path] = []

    for doi, items in sorted(orphan_groups.items()):
        metadata_rows = [metadata for _, _, metadata in items]
        source_slug = _canonical_source_slug(metadata_rows)
        summary_slug = _canonical_summary_slug(source_slug, metadata_rows)
        canonical_paths: set[str] = set()

        for _, rel_path, metadata in items:
            page_type = _page_type_from_path(rel_path, metadata)
            expected_slug = (
                summary_slug
                if page_type == "source_summary"
                else _canonical_page_slug(metadata=metadata, page_type=page_type, source_slug=source_slug)
            )
            if _metadata_str(metadata, "slug") == expected_slug:
                canonical_paths.add(rel_path)

        indexed_already = existing_by_doi.get(doi, [])
        if indexed_already:
            canonical_paths = set()

        expected_kept = 0 if indexed_already else 2
        if len(canonical_paths) != expected_kept:
            raise RuntimeError(
                f"Unexpected canonical selection for DOI {doi}: expected {expected_kept}, got {len(canonical_paths)}"
            )

        for path, rel_path, metadata in items:
            action = "keep_and_index" if rel_path in canonical_paths else "drop_stale"
            if rel_path in canonical_paths:
                entries_to_add.append(build_index_entry(rel_path=rel_path, metadata=metadata, source_slug=source_slug))
            else:
                markdown_to_delete.append(path)
            report_rows.append(
                {
                    "doi": doi,
                    "page_type": _page_type_from_path(rel_path, metadata),
                    "path": rel_path,
                    "slug": _metadata_str(metadata, "slug"),
                    "title": _metadata_str(metadata, "title"),
                    "source_slug": source_slug,
                    "action": action if not indexed_already else "drop_stale_indexed_duplicate",
                }
            )

    final_entries = list(existing_entries)
    existing_slugs = {entry.slug for entry in final_entries}
    for entry in entries_to_add:
        if entry.slug in existing_slugs:
            raise RuntimeError(f"Refusing to add duplicate slug to index: {entry.slug}")
        final_entries.append(entry)
        existing_slugs.add(entry.slug)

    final_source_slugs = {entry.source_slug for entry in final_entries if entry.source_slug}
    source_paths_to_delete = [
        path
        for path in sorted(sources_dir.iterdir())
        if path.is_file() and path.stem not in final_source_slugs
    ]
    for path in source_paths_to_delete:
        report_rows.append(
            {
                "doi": "",
                "page_type": "source_file",
                "path": str(path.relative_to(workspace_dir)).replace("\\", "/"),
                "slug": path.stem,
                "title": "",
                "source_slug": path.stem,
                "action": "drop_unreferenced_source",
            }
        )

    report_path = report_dir / "orphan_reconciliation_report.csv"
    with report_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["doi", "page_type", "path", "slug", "title", "source_slug", "action"],
        )
        writer.writeheader()
        writer.writerows(report_rows)

    if args.write:
        write_index(workspace_dir, final_entries)
        for path in markdown_to_delete:
            path.unlink()
        for path in source_paths_to_delete:
            path.unlink()

    summary = {
        "doi_groups": len(orphan_groups),
        "index_entries_added": len(entries_to_add),
        "markdown_deleted": len(markdown_to_delete),
        "source_files_deleted": len(source_paths_to_delete),
        "report_path": str(report_path),
        "wrote_changes": args.write,
    }
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
