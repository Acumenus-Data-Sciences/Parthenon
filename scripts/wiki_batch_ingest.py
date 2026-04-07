#!/usr/bin/env python3
"""Batch ingest OHDSI papers into the wiki engine.

Run inside the python-ai container where /data/wiki is mounted:

    docker compose exec python-ai python /app/scripts/wiki_batch_ingest.py --dry-run
    docker compose exec python-ai python /app/scripts/wiki_batch_ingest.py --no-git
    docker compose exec -d python-ai python /app/scripts/wiki_batch_ingest.py --no-git

Or from host (auto-detects paths):

    python scripts/wiki_batch_ingest.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Add the ai/ directory to sys.path so we can import the wiki engine
PROJECT_ROOT = Path(__file__).resolve().parent.parent
AI_DIR = PROJECT_ROOT / "ai"
# Inside the container, /app is the ai/ directory
if not AI_DIR.exists() and Path("/app/app").exists():
    AI_DIR = Path("/app")
sys.path.insert(0, str(AI_DIR))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("wiki-batch")

# ── Manifest ────────────────────────────────────────────────────────────────


def load_manifest(manifest_path: Path) -> dict:
    if manifest_path.exists():
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    return {
        "version": 1,
        "started_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
        "total_files": 0,
        "processed": {},
    }


def save_manifest(manifest: dict, manifest_path: Path) -> None:
    manifest["updated_at"] = datetime.now(UTC).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


# ── Signal handling ─────────────────────────────────────────────────────────

_shutdown_requested = False


def _signal_handler(signum: int, _frame: object) -> None:
    global _shutdown_requested
    _shutdown_requested = True
    log.warning("Shutdown requested (signal %d). Finishing current file...", signum)


# ── PDF discovery ───────────────────────────────────────────────────────────


def discover_pdfs(source_dir: Path, max_size_mb: float) -> list[Path]:
    """Find all PDF files, excluding duplicates and oversized files."""
    max_bytes = int(max_size_mb * 1024 * 1024)
    pdfs: list[Path] = []
    skipped_size = 0
    skipped_dup = 0

    for path in sorted(source_dir.glob("*.pdf")):
        # Skip duplicates (files ending in " (1).pdf", " (2).pdf", etc.)
        if "(" in path.stem and path.stem.rstrip(")").endswith((" 1", " 2", " 3")):
            skipped_dup += 1
            continue
        # Skip oversized files
        if path.stat().st_size > max_bytes:
            skipped_size += 1
            log.debug("Skipping (too large): %s (%.1f MB)", path.name, path.stat().st_size / 1024 / 1024)
            continue
        pdfs.append(path)

    if skipped_dup:
        log.info("Skipped %d duplicate files", skipped_dup)
    if skipped_size:
        log.info("Skipped %d files over %.0f MB", skipped_size, max_size_mb)
    return pdfs


# ── Ingest one PDF ──────────────────────────────────────────────────────────


_QUALITY_JUNK = [
    "untitled", "page ", "10.", "doi:", "http", ".pdf", ".txt",
    "article in press", "elsevier", "springer", "slide ",
]


def _check_quality(result: object) -> list[str]:
    """Validate the quality of an ingested paper. Returns list of issues."""
    issues: list[str] = []
    title = getattr(result, "source_title", "") or ""
    pages = getattr(result, "created_pages", []) or []

    # Title checks
    if len(title) < 15:
        issues.append(f"title too short ({len(title)} chars): '{title}'")
    if any(junk in title.lower() for junk in _QUALITY_JUNK):
        issues.append(f"junk in title: '{title[:60]}'")

    # Page count check
    if len(pages) < 1:
        issues.append("no pages created")

    # Check concept page quality
    for page in pages:
        if getattr(page, "page_type", "") == "concept":
            kw = getattr(page, "keywords", []) or []
            if not kw or kw == ["research"]:
                issues.append("no meaningful keywords")
            break

    return issues


async def ingest_one(engine: object, pdf_path: Path, workspace: str) -> dict:
    """Ingest a single PDF, check quality, and return a manifest entry."""
    content_bytes = pdf_path.read_bytes()
    start = time.monotonic()

    result = await engine.ingest(  # type: ignore[union-attr]
        workspace=workspace,
        filename=pdf_path.name,
        content_bytes=content_bytes,
        raw_content=None,
        title=None,
    )

    elapsed = time.monotonic() - start
    quality_issues = _check_quality(result)

    return {
        "status": "success" if not quality_issues else "quality_warning",
        "slug": result.source_slug,
        "title": result.source_title,
        "pages_created": len(result.created_pages),
        "elapsed_s": round(elapsed, 1),
        "error": None,
        "quality_issues": quality_issues,
        "processed_at": datetime.now(UTC).isoformat(),
    }


# ── Main ────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch ingest OHDSI papers into wiki")
    parser.add_argument(
        "--source-dir",
        default=str(PROJECT_ROOT / "OHDSI-scraper" / "OHDSI Papers"),
        help="Directory containing PDF files",
    )
    parser.add_argument("--workspace", default="platform", help="Wiki workspace name")
    parser.add_argument("--max-size-mb", type=float, default=25.0, help="Skip PDFs larger than N MB")
    parser.add_argument("--wiki-root", default=None, help="Override wiki root dir (default: from settings or /data/wiki)")
    parser.add_argument("--no-git", action="store_true", help="Disable per-ingest git commits")
    parser.add_argument("--dry-run", action="store_true", help="List files and exit")
    parser.add_argument("--retry-errors", action="store_true", help="Re-process previously errored files")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    if not source_dir.is_dir():
        log.error("Source directory not found: %s", source_dir)
        sys.exit(1)

    # Discover PDFs
    pdfs = discover_pdfs(source_dir, args.max_size_mb)
    log.info("Found %d PDFs in %s", len(pdfs), source_dir)

    if args.dry_run:
        print(f"\n=== Dry Run: {len(pdfs)} PDFs to ingest ===\n")
        for i, pdf in enumerate(pdfs[:20], 1):
            size_mb = pdf.stat().st_size / 1024 / 1024
            print(f"  [{i:4d}] {pdf.name[:70]:70s} ({size_mb:.1f} MB)")
        if len(pdfs) > 20:
            print(f"  ... and {len(pdfs) - 20} more")
        print(f"\nTotal: {len(pdfs)} files, {sum(p.stat().st_size for p in pdfs) / 1024 / 1024:.0f} MB")
        return

    # Set up signal handlers
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # Disable git commits if requested
    if args.no_git:
        import app.wiki.git_ops as git_ops
        _original_commit = git_ops.wiki_commit
        git_ops.wiki_commit = lambda *a, **kw: None  # type: ignore[assignment]
        log.info("Git commits disabled (--no-git)")

    # Initialize engine with optional root dir override
    from app.wiki.engine import WikiEngine
    engine = WikiEngine(root_dir=args.wiki_root) if args.wiki_root else WikiEngine()

    # Load manifest
    wiki_data_dir = engine.root_dir / args.workspace
    wiki_data_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = wiki_data_dir / "ingest_manifest.json"
    manifest = load_manifest(manifest_path)
    manifest["total_files"] = len(pdfs)

    # Filter based on manifest
    processed = manifest["processed"]
    to_ingest: list[Path] = []
    for pdf in pdfs:
        entry = processed.get(pdf.name)
        if entry is None:
            to_ingest.append(pdf)
        elif entry["status"] == "error" and args.retry_errors:
            to_ingest.append(pdf)
        # else: already processed successfully, skip

    already_done = len(pdfs) - len(to_ingest)
    if already_done:
        log.info("Skipping %d already-processed files (use --retry-errors to reprocess failures)", already_done)
    log.info("Ingesting %d files", len(to_ingest))

    # Ingest loop
    total = len(to_ingest)
    success_count = 0
    error_count = 0
    batch_start = time.monotonic()

    for i, pdf_path in enumerate(to_ingest, 1):
        if _shutdown_requested:
            log.warning("Shutdown requested. Saving manifest and exiting.")
            break

        try:
            entry = asyncio.run(ingest_one(engine, pdf_path, args.workspace))
            processed[pdf_path.name] = entry
            success_count += 1
            qi = entry.get("quality_issues", [])
            if qi:
                log.warning(
                    "[%d/%d] WARN: \"%s\" (%d pages, %.1fs) — %s",
                    i + already_done, len(pdfs),
                    entry["title"][:55], entry["pages_created"], entry["elapsed_s"],
                    "; ".join(qi),
                )
            else:
                log.info(
                    "[%d/%d] OK: \"%s\" (%d pages, %.1fs)",
                    i + already_done, len(pdfs),
                    entry["title"][:60], entry["pages_created"], entry["elapsed_s"],
                )
        except Exception as exc:
            error_count += 1
            processed[pdf_path.name] = {
                "status": "error",
                "slug": None,
                "title": None,
                "pages_created": 0,
                "elapsed_s": 0,
                "error": str(exc)[:200],
                "processed_at": datetime.now(UTC).isoformat(),
            }
            log.error("[%d/%d] ERROR: %s — %s", i + already_done, len(pdfs), pdf_path.name[:50], str(exc)[:100])

        # Save manifest every 10 files
        if i % 10 == 0 or _shutdown_requested:
            save_manifest(manifest, manifest_path)

    # Final manifest save
    save_manifest(manifest, manifest_path)

    # Final git commit if --no-git was used
    if args.no_git and not args.dry_run:
        log.info("Running final git commit...")
        import subprocess
        wiki_root = str(engine.root_dir)
        subprocess.run(["git", "add", "-A"], cwd=wiki_root, capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", f"wiki: batch ingest {success_count} papers"],
            cwd=wiki_root, capture_output=True,
        )

    # Summary
    elapsed_total = time.monotonic() - batch_start
    hours = int(elapsed_total // 3600)
    minutes = int((elapsed_total % 3600) // 60)

    print(f"\n{'=' * 40}")
    print(f"  Batch Ingest Complete")
    print(f"{'=' * 40}")
    print(f"  Total:     {len(pdfs)}")
    print(f"  Success:   {already_done + success_count}")
    print(f"  Errors:    {error_count}")
    print(f"  Remaining: {total - success_count - error_count}")
    print(f"  Duration:  {hours}h {minutes}m")
    print(f"  Manifest:  {manifest_path}")
    print(f"{'=' * 40}\n")


if __name__ == "__main__":
    main()
