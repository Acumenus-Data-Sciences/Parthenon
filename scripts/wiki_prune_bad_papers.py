#!/usr/bin/env python3
"""Remove wiki papers with broken PDFs or unusable titles.

By default this script reports candidates. Pass ``--apply`` to prune them from:

- ``data/wiki/<workspace>/sources``
- ``data/wiki/<workspace>/wiki/**``
- ``data/wiki/<workspace>/index.md``
- ``data/wiki/<workspace>/ingest_manifest.json``
- the wiki Chroma collection (best effort)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import fitz


PROJECT_ROOT = Path(__file__).resolve().parent.parent
AI_DIR = PROJECT_ROOT / "ai"
if not AI_DIR.exists() and Path("/app/app").exists():
    AI_DIR = Path("/app")
sys.path.insert(0, str(AI_DIR))

from app.wiki.index_ops import IndexEntry, read_index, write_index
from app.wiki.log_ops import LogEntry, append_log_entry


SOURCE_SUMMARY_DIR = Path("wiki/source_summaries")
STOP_WORDS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "de",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "without",
}
JUNK_TITLE_PATTERNS = {
    "filename_title": re.compile(r"^(?:[a-z]{3,}[._-]?\d{4,}[^A-Za-z]+.*|[a-z]{3,}-\d{4}-\d+.*)$", re.IGNORECASE),
    "pdf_title": re.compile(r"\.pdf$", re.IGNORECASE),
    "preprint_title": re.compile(r"\bpreprint\b", re.IGNORECASE),
    "received_title": re.compile(r"^(received|accepted|published)[: ]", re.IGNORECASE),
    "main_page_title": re.compile(r'^.?main.?\s*[--]', re.IGNORECASE),
    "mojibake_title": re.compile(r"[Û¦�]"),
}


@dataclass(slots=True)
class PaperRecord:
    slug: str
    title: str
    source_summary_path: Path
    source_path: Path
    index_entries: list[IndexEntry] = field(default_factory=list)


@dataclass(slots=True)
class PaperIssue:
    slug: str
    title: str
    reasons: list[str]
    details: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", default="platform", help="Wiki workspace to evaluate")
    parser.add_argument("--apply", action="store_true", help="Delete flagged papers instead of only reporting")
    parser.add_argument(
        "--skip-chroma",
        action="store_true",
        help="Do not attempt to remove stale Chroma wiki chunks",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workspace_dir = PROJECT_ROOT / "data" / "wiki" / args.workspace
    if not workspace_dir.is_dir():
        raise SystemExit(f"Workspace not found: {workspace_dir}")

    records = load_paper_records(workspace_dir)
    issues = evaluate_papers(records)
    print_report(issues, apply=args.apply)

    if not args.apply or not issues:
        return 0

    apply_prune(workspace_dir, records, issues, skip_chroma=args.skip_chroma)
    print("\nApplied prune.")
    return 0


def load_paper_records(workspace_dir: Path) -> dict[str, PaperRecord]:
    entries_by_source: dict[str, list[IndexEntry]] = defaultdict(list)
    for entry in read_index(workspace_dir):
        if entry.source_slug:
            entries_by_source[entry.source_slug].append(entry)

    records: dict[str, PaperRecord] = {}
    source_summary_root = workspace_dir / SOURCE_SUMMARY_DIR
    for summary_path in sorted(source_summary_root.glob("*.md")):
        title = read_title(summary_path)
        slug = summary_path.stem
        records[slug] = PaperRecord(
            slug=slug,
            title=title,
            source_summary_path=summary_path,
            source_path=workspace_dir / "sources" / f"{slug}.pdf",
            index_entries=entries_by_source.get(slug, []),
        )

    return records


def evaluate_papers(records: dict[str, PaperRecord]) -> list[PaperIssue]:
    issues: list[PaperIssue] = []
    for record in records.values():
        reasons: list[str] = []
        details: list[str] = []

        if not record.source_path.exists():
            reasons.append("missing_pdf")
            details.append("source PDF is missing")
        else:
            magic = read_magic(record.source_path)
            if magic != b"%PDF-":
                reasons.append("invalid_pdf")
                details.append(f"PDF magic bytes are {magic!r}")
            else:
                pdf_error = validate_pdf_load(record.source_path)
                if pdf_error is not None:
                    reasons.append("invalid_pdf")
                    details.append(pdf_error)

        for reason, pattern in JUNK_TITLE_PATTERNS.items():
            if pattern.search(record.title):
                reasons.append(reason)
                details.append(f"title matched {reason}")

        if is_truncated_title(record):
            reasons.append("truncated_title")
            details.append("first-page text continues the stored title")

        if reasons:
            issues.append(
                PaperIssue(
                    slug=record.slug,
                    title=record.title,
                    reasons=sorted(set(reasons)),
                    details=details,
                )
            )

    return sorted(issues, key=lambda item: (item.slug, item.title.lower()))


def print_report(issues: list[PaperIssue], *, apply: bool) -> None:
    if not issues:
        print("No papers matched the prune rules.")
        return

    counter = Counter(reason for issue in issues for reason in issue.reasons)
    print(f"Papers flagged: {len(issues)}")
    for reason, count in sorted(counter.items()):
        print(f"  {reason}: {count}")

    action = "Will prune" if apply else "Would prune"
    print(f"\n{action}:")
    for issue in issues:
        joined = ", ".join(issue.reasons)
        print(f"  {issue.slug} | {joined} | {issue.title}")


def apply_prune(
    workspace_dir: Path,
    records: dict[str, PaperRecord],
    issues: list[PaperIssue],
    *,
    skip_chroma: bool,
) -> None:
    issue_map = {issue.slug: issue for issue in issues}
    slugs = set(issue_map)
    entries = read_index(workspace_dir)
    kept_entries = [entry for entry in entries if entry.source_slug not in slugs]
    removed_entries = [entry for entry in entries if entry.source_slug in slugs]

    for issue in issues:
        record = records[issue.slug]
        if record.source_summary_path.exists():
            record.source_summary_path.unlink()
        if record.source_path.exists():
            record.source_path.unlink()

    removed_paths: set[Path] = set()
    for entry in removed_entries:
        page_path = workspace_dir / entry.path
        if page_path.exists():
            page_path.unlink()
            removed_paths.add(page_path)

    write_index(workspace_dir, kept_entries)
    prune_manifest(workspace_dir, slugs)

    if not skip_chroma:
        prune_chroma(workspace_dir.name, slugs)

    timestamp = utc_now()
    for issue in issues:
        append_log_entry(
            workspace_dir,
            LogEntry(
                timestamp=timestamp,
                action="prune",
                target=issue.slug,
                message=f"Removed paper '{issue.title}' ({', '.join(issue.reasons)}).",
            ),
        )

    print(
        f"Removed {len(issues)} papers, {len(removed_entries)} index rows, and {len(removed_paths)} wiki files."
    )


def prune_manifest(workspace_dir: Path, slugs: set[str]) -> None:
    manifest_path = workspace_dir / "ingest_manifest.json"
    if not manifest_path.exists():
        return

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    processed = manifest.get("processed", {})
    kept = {
        filename: entry
        for filename, entry in processed.items()
        if entry.get("slug") not in slugs
    }
    manifest["processed"] = kept
    manifest["updated_at"] = datetime.now(UTC).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def prune_chroma(workspace: str, slugs: set[str]) -> None:
    try:
        from app.chroma.collections import get_wiki_collection
    except Exception:
        return

    try:
        collection = get_wiki_collection()
    except Exception:
        return

    for slug in slugs:
        try:
            existing = collection.get(where={"$and": [{"workspace": workspace}, {"source_slug": slug}]})
        except Exception:
            continue
        ids = existing.get("ids") if isinstance(existing, dict) else None
        if ids:
            try:
                collection.delete(ids=ids)
            except Exception:
                continue


def read_title(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"^title:\s*(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else path.stem


def read_source_lines(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    _, _, remainder = text.partition("\n---\n")
    return [line.strip() for line in remainder.splitlines() if line.strip()]


def read_magic(path: Path) -> bytes:
    with path.open("rb") as handle:
        return handle.read(5)


def validate_pdf_load(path: Path) -> str | None:
    try:
        document = fitz.open(path)
    except Exception as exc:
        return f"PyMuPDF failed to open PDF: {type(exc).__name__}: {exc}"

    try:
        if document.page_count < 1:
            return "PDF contains no pages"
    finally:
        document.close()

    return None


def is_truncated_title(record: PaperRecord) -> bool:
    if not record.source_path.exists():
        return False
    if read_magic(record.source_path) != b"%PDF-":
        return False

    lines = read_source_lines(record.source_summary_path)
    if not lines:
        return False

    title = simplify_text(record.title)
    tokens = re.findall(r"[A-Za-z0-9']+", title)
    last_token = tokens[-1].lower() if tokens else ""

    matched_rest = matched_preview_rest(title, lines)
    if matched_rest is None:
        return False

    next_word = first_word(matched_rest)
    if not next_word:
        return False

    return (
        next_word[:1].islower()
        or last_token in STOP_WORDS
        or record.title.rstrip().endswith((":", "-", "/"))
    )


def matched_preview_rest(title: str, lines: list[str]) -> str | None:
    best_rest: str | None = None
    for start in range(min(8, len(lines))):
        joined: list[str] = []
        for end in range(start, min(start + 4, len(lines))):
            joined.append(lines[end])
            candidate = simplify_text(" ".join(joined))
            if candidate.lower().startswith(title.lower()):
                rest = candidate[len(title):].lstrip(" -:;,.")
                if best_rest is None or len(rest) > len(best_rest):
                    best_rest = rest
    return best_rest


def simplify_text(value: str) -> str:
    normalized = (
        value.replace("\u00a0", " ")
        .replace("‐", "-")
        .replace("‑", "-")
        .replace("–", "-")
        .replace("—", "-")
        .replace("ﬁ", "fi")
        .replace("ﬂ", "fl")
        .replace("\xad", "")
        .replace("“", '"')
        .replace("”", '"')
        .replace("’", "'")
    )
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def first_word(value: str) -> str:
    match = re.match(r"([A-Za-z][A-Za-z-]*)", value)
    return match.group(1) if match else ""


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


if __name__ == "__main__":
    raise SystemExit(main())
