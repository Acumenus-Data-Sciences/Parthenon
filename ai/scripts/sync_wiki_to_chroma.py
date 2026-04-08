#!/usr/bin/env python3
"""Backfill wiki pages into the Chroma wiki_pages collection."""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT / "ai") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "ai"))

from app.chroma.collections import get_wiki_collection
from app.wiki.adapters.base import parse_markdown_page
from app.wiki.engine import WikiEngine
from app.wiki.index_ops import read_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync an on-disk wiki workspace into Chroma.")
    parser.add_argument("--workspace", default="platform")
    parser.add_argument(
        "--skip-clear",
        action="store_true",
        help="Do not clear existing Chroma chunks for this workspace before re-upserting.",
    )
    return parser.parse_args()


def _clear_workspace_chunks(collection, workspace: str) -> int:
    try:
        existing = collection.get(where={"workspace": workspace})
    except Exception:
        return 0
    ids = list(existing.get("ids") or [])
    if not ids:
        return 0
    collection.delete(ids=ids)
    return len(ids)


def main() -> int:
    args = parse_args()
    workspace_dir = REPO_ROOT / "data" / "wiki" / args.workspace
    engine = WikiEngine(root_dir=str(REPO_ROOT / "data" / "wiki"))
    collection = get_wiki_collection()

    removed_chunks = 0
    if not args.skip_clear:
        removed_chunks = _clear_workspace_chunks(collection, args.workspace)

    entries = read_index(workspace_dir)
    synced_pages = 0
    page_type_counts: Counter[str] = Counter()

    for entry in entries:
        page_path = workspace_dir / entry.path
        if not page_path.exists():
            raise FileNotFoundError(f"Indexed page missing on disk: {page_path}")
        _, body = parse_markdown_page(page_path)
        engine._upsert_page_to_chroma(
            workspace=args.workspace,
            slug=entry.slug,
            title=entry.title,
            page_type=entry.page_type,
            body=body,
            keywords=entry.keywords,
            source_slug=entry.source_slug,
            source_type=entry.source_type,
            metadata={
                "doi": entry.doi,
                "authors": entry.authors,
                "first_author": entry.first_author,
                "journal": entry.journal,
                "publication_year": entry.publication_year,
                "pmid": entry.pmid,
                "pmcid": entry.pmcid,
            },
            primary_domain=entry.primary_domain,
        )
        synced_pages += 1
        page_type_counts[entry.page_type] += 1
        if synced_pages % 100 == 0:
            print(f"Synced {synced_pages}/{len(entries)} pages")

    chunk_total = 0
    try:
        result = collection.get(where={"workspace": args.workspace})
        chunk_total = len(result.get("ids") or [])
    except Exception:
        pass

    print(
        {
            "workspace": args.workspace,
            "removed_chunks": removed_chunks,
            "synced_pages": synced_pages,
            "page_types": dict(page_type_counts),
            "workspace_chunk_count": chunk_total,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
