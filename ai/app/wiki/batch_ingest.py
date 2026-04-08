"""Batch rebuild the wiki from the curated OHDSI corpus."""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

from app.chroma.client import get_chroma_client
from app.chroma.collections import clear_cached_collection
from app.wiki.engine import WikiEngine, _utc_now
from app.wiki.git_ops import WORKSPACE_PAGE_DIRS, ensure_workspace_structure, init_wiki_repo, wiki_commit
from app.wiki.index_ops import INDEX_HEADER
from app.wiki.log_ops import LOG_HEADER
from app.wiki.tagging import clean_bibliographic_text


@dataclass(slots=True)
class BatchStats:
    total: int = 0
    processed: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped_missing_pdf: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rebuild the wiki from OHDSI-scraper/corpus.")
    parser.add_argument("--workspace", default="platform")
    parser.add_argument("--limit", type=int, default=None, help="Only ingest the first N corpus rows.")
    parser.add_argument("--offset", type=int, default=0, help="Skip the first N corpus rows.")
    parser.add_argument("--commit-every", type=int, default=50, help="Create a git commit every N processed rows.")
    parser.add_argument("--skip-clear", action="store_true", help="Do not reset the wiki workspace before ingest.")
    parser.add_argument("--skip-chroma-clear", action="store_true", help="Do not delete the wiki_pages Chroma collection.")
    parser.add_argument("--no-commit", action="store_true", help="Write files without creating git commits.")
    parser.add_argument("--corpus-dir", default=None, help="Override the OHDSI corpus directory.")
    return parser.parse_args()


async def rebuild_wiki(args: argparse.Namespace) -> int:
    repo_root = Path(__file__).resolve().parents[3]
    wiki_root = repo_root / "data" / "wiki"
    corpus_dir = Path(args.corpus_dir) if args.corpus_dir else repo_root / "OHDSI-scraper" / "corpus"
    metadata_csv = corpus_dir / "metadata.csv"
    pdf_dir = corpus_dir / "pdfs"

    if not metadata_csv.exists():
        raise FileNotFoundError(f"Metadata CSV not found: {metadata_csv}")
    if not pdf_dir.exists():
        raise FileNotFoundError(f"PDF directory not found: {pdf_dir}")

    engine = WikiEngine(root_dir=str(wiki_root))
    workspace_dir = wiki_root / args.workspace
    init_wiki_repo(wiki_root)
    ensure_workspace_structure(wiki_root, args.workspace)

    if not args.skip_chroma_clear:
        _clear_wiki_collection()

    if not args.skip_clear:
        _reset_workspace(workspace_dir)
        if not args.no_commit:
            wiki_commit(wiki_root, "chore(wiki): clear all wiki content for corpus rebuild", [workspace_dir])

    rows = _read_rows(metadata_csv, offset=args.offset, limit=args.limit)
    stats = BatchStats(total=len(rows))
    failures_path = workspace_dir / "rebuild_failures.jsonl"
    manifest_path = workspace_dir / "ingest_manifest.json"
    _write_manifest(manifest_path, stats, workspace=args.workspace, status="running")
    failures_path.write_text("", encoding="utf-8")

    last_commit_marker = 0

    try:
        for index, row in enumerate(rows, start=1):
            stats.processed = index
            filename = clean_bibliographic_text(row.get("Filename"))
            pdf_path = pdf_dir / filename
            title = clean_bibliographic_text(row.get("Title")) or clean_bibliographic_text(row.get("PDF Title")) or pdf_path.stem

            if not filename or not pdf_path.exists():
                stats.failed += 1
                stats.skipped_missing_pdf += 1
                _append_failure(
                    failures_path,
                    {
                        "index": index,
                        "title": title,
                        "filename": filename,
                        "error": "PDF file not found",
                    },
                )
                print(f"[{index}/{stats.total}] missing PDF: {filename or title}")
                continue

            try:
                await engine.ingest(
                    workspace=args.workspace,
                    filename=filename,
                    content_bytes=pdf_path.read_bytes(),
                    raw_content=None,
                    title=title,
                    doi=clean_bibliographic_text(row.get("DOI")),
                    authors=clean_bibliographic_text(row.get("Authors")),
                    first_author=clean_bibliographic_text(row.get("First Author")),
                    journal=clean_bibliographic_text(row.get("Journal")),
                    publication_year=clean_bibliographic_text(row.get("Publication Year")),
                    pmid=clean_bibliographic_text(row.get("PMID")),
                    pmcid=clean_bibliographic_text(row.get("PMCID")),
                    pdf_keywords=clean_bibliographic_text(row.get("PDF Keywords")),
                    commit=False,
                )
                stats.succeeded += 1
                print(f"[{index}/{stats.total}] ingested: {title}")
            except Exception as exc:  # pragma: no cover - exercised in live rebuilds
                stats.failed += 1
                _append_failure(
                    failures_path,
                    {
                        "index": index,
                        "title": title,
                        "filename": filename,
                        "error": str(exc),
                    },
                )
                print(f"[{index}/{stats.total}] FAILED: {title} :: {exc}")

            if not args.no_commit and args.commit_every > 0 and index % args.commit_every == 0:
                last_commit_marker = index
                wiki_commit(wiki_root, f"wiki: corpus rebuild batch {index - args.commit_every + 1}-{index}", [workspace_dir])
                _write_manifest(manifest_path, stats, workspace=args.workspace, status="running")
                print(f"Committed batch through row {index}")
    except KeyboardInterrupt:  # pragma: no cover - operator interrupt
        if not args.no_commit and stats.processed > last_commit_marker:
            wiki_commit(wiki_root, f"wiki: corpus rebuild partial through row {stats.processed}", [workspace_dir])
        _write_manifest(manifest_path, stats, workspace=args.workspace, status="interrupted")
        raise

    if not args.no_commit:
        wiki_commit(wiki_root, f"wiki: corpus rebuild final ({stats.succeeded} papers)", [workspace_dir])
    _write_manifest(manifest_path, stats, workspace=args.workspace, status="completed")
    print(
        "Done:",
        json.dumps(
            {
                "total": stats.total,
                "processed": stats.processed,
                "succeeded": stats.succeeded,
                "failed": stats.failed,
                "missing_pdf": stats.skipped_missing_pdf,
            },
            sort_keys=True,
        ),
    )
    return 0 if stats.failed == 0 else 1


def _read_rows(metadata_csv: Path, *, offset: int, limit: int | None) -> list[dict[str, str]]:
    with metadata_csv.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if offset:
        rows = rows[offset:]
    if limit is not None:
        rows = rows[:limit]
    return rows


def _clear_wiki_collection() -> None:
    client = get_chroma_client()
    try:
        client.delete_collection("wiki_pages")
    except Exception:
        pass
    clear_cached_collection("wiki_pages")


def _reset_workspace(workspace_dir: Path) -> None:
    ensure_workspace_structure(workspace_dir.parent, workspace_dir.name)
    for relative_dir in WORKSPACE_PAGE_DIRS.values():
        target = workspace_dir / relative_dir
        shutil.rmtree(target, ignore_errors=True)
        target.mkdir(parents=True, exist_ok=True)

    shutil.rmtree(workspace_dir / "sources", ignore_errors=True)
    (workspace_dir / "sources").mkdir(parents=True, exist_ok=True)
    (workspace_dir / "index.md").write_text(INDEX_HEADER, encoding="utf-8")
    (workspace_dir / "log.md").write_text(LOG_HEADER, encoding="utf-8")
    (workspace_dir / "ingest_manifest.json").write_text(json.dumps({"version": 1}, indent=2) + "\n", encoding="utf-8")


def _append_failure(path: Path, payload: dict[str, object]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")


def _write_manifest(path: Path, stats: BatchStats, *, workspace: str, status: str) -> None:
    payload = {
        "version": 1,
        "workspace": workspace,
        "status": status,
        "updated_at": _utc_now(),
        **asdict(stats),
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    raise SystemExit(asyncio.run(rebuild_wiki(parse_args())))


if __name__ == "__main__":
    main()
