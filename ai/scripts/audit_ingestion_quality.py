"""Dry-run audit for ingestion source cleanliness and relevance.

Usage:
  python ai/scripts/audit_ingestion_quality.py --dataset all
  python ai/scripts/audit_ingestion_quality.py --dataset ohdsi_papers --json
  docker compose exec -T python-ai python /app/scripts/audit_ingestion_quality.py --dataset wiki_pages
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

AI_DIR = Path(__file__).resolve().parents[1]
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from app.chroma.ingestion import _load_harvester_metadata, _load_manifest_metadata
from app.chroma.quality import AuditResult, audit_document
from app.wiki.batch_ingest import _strict_metadata_rejection_reason
from app.wiki.tagging import clean_bibliographic_text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit ingestion sources for junk, noise, and off-topic content.")
    parser.add_argument(
        "--dataset",
        default="all",
        choices=["all", "docs", "ohdsi_papers", "ohdsi_knowledge", "medical_textbooks", "wiki_pages"],
        help="Which source family to audit.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Limit files per dataset.")
    parser.add_argument("--output", type=str, default=None, help="Optional path to write JSON output.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON summary.")
    parser.add_argument("--docs-dir", default=None)
    parser.add_argument("--corpus-dir", default=None)
    parser.add_argument("--textbooks-dir", default=None)
    parser.add_argument("--book-dir", default=None)
    parser.add_argument("--vignettes-dir", default=None)
    parser.add_argument("--forums-dir", default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[2]

    docs_dir = Path(args.docs_dir) if args.docs_dir else repo_root / "docs"
    corpus_dir = Path(args.corpus_dir) if args.corpus_dir else repo_root / "OHDSI-scraper" / "corpus"
    textbooks_dir = Path(args.textbooks_dir) if args.textbooks_dir else repo_root / "ai" / "medical_textbooks"
    book_dir = Path(args.book_dir) if args.book_dir else repo_root / "OHDSI-scraper" / "book_of_ohdsi"
    vignettes_dir = Path(args.vignettes_dir) if args.vignettes_dir else repo_root / "OHDSI-scraper" / "hades_vignettes"
    forums_dir = Path(args.forums_dir) if args.forums_dir else repo_root / "OHDSI-scraper" / "ohdsi_forums"

    datasets = (
        ["docs", "ohdsi_papers", "ohdsi_knowledge", "medical_textbooks", "wiki_pages"]
        if args.dataset == "all"
        else [args.dataset]
    )

    all_results: list[AuditResult] = []
    for dataset in datasets:
        if dataset == "docs":
            all_results.extend(audit_docs(docs_dir, limit=args.limit))
        elif dataset == "ohdsi_papers":
            all_results.extend(audit_ohdsi_papers(corpus_dir, limit=args.limit))
        elif dataset == "ohdsi_knowledge":
            all_results.extend(audit_ohdsi_knowledge(book_dir, vignettes_dir, forums_dir, limit=args.limit))
        elif dataset == "medical_textbooks":
            all_results.extend(audit_medical_textbooks(textbooks_dir, limit=args.limit))
        elif dataset == "wiki_pages":
            all_results.extend(audit_wiki_sources(corpus_dir, limit=args.limit))

    summary = build_summary(all_results)
    payload = {
        "summary": summary,
        "results": [result.as_dict() for result in all_results],
    }

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print_human_summary(summary, all_results)

    return 0


def audit_docs(docs_dir: Path, *, limit: int | None) -> list[AuditResult]:
    results: list[AuditResult] = []
    files = sorted(docs_dir.rglob("*.md"))
    if limit is not None:
        files = files[:limit]

    for path in files:
        text = safe_read_text(path)
        relative_path = str(path.relative_to(docs_dir))
        title = _extract_markdown_title(text, relative_path)
        results.append(
            audit_document(
                target_collection="docs",
                source_kind="markdown",
                source_id=relative_path,
                path=str(path),
                text=text,
                metadata={"title": title, "source_file": relative_path},
            )
        )
    return results


def audit_ohdsi_papers(corpus_dir: Path, *, limit: int | None) -> list[AuditResult]:
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pymupdf is required for PDF auditing") from exc

    pdf_dir = corpus_dir / "pdfs"
    metadata_map = _load_harvester_metadata(corpus_dir / "metadata")
    files = sorted(pdf_dir.glob("*.pdf"))
    if limit is not None:
        files = files[:limit]

    results: list[AuditResult] = []
    for path in files:
        metadata = metadata_map.get(path.name, {})
        text = extract_pdf_text(path, fitz)
        results.append(
            audit_document(
                target_collection="ohdsi_papers",
                source_kind="pdf",
                source_id=path.name,
                path=str(path),
                text=text,
                metadata={
                    "title": clean_bibliographic_text(metadata.get("title")),
                    "doi": clean_bibliographic_text(metadata.get("doi")),
                    "year": clean_bibliographic_text(metadata.get("year")),
                    "journal": clean_bibliographic_text(metadata.get("journal")),
                    "authors": clean_bibliographic_text(metadata.get("authors")),
                },
            )
        )
    return results


def audit_ohdsi_knowledge(
    book_dir: Path,
    vignettes_dir: Path,
    forums_dir: Path,
    *,
    limit: int | None,
) -> list[AuditResult]:
    sources = [
        ("book_of_ohdsi", book_dir, "*.md"),
        ("hades_vignette", vignettes_dir, "**/*.md"),
        ("ohdsi_forums", forums_dir, "topic_*.md"),
    ]
    results: list[AuditResult] = []
    for source_tag, source_dir, pattern in sources:
        manifest_meta = _load_manifest_metadata(source_dir)
        files = sorted(source_dir.glob(pattern))
        if limit is not None:
            files = files[:limit]
        for path in files:
            if path.name == "manifest.json":
                continue
            text = safe_read_text(path)
            relative_path = str(path.relative_to(source_dir))
            file_meta = manifest_meta.get(relative_path, {}) or manifest_meta.get(path.name, {})
            results.append(
                audit_document(
                    target_collection="ohdsi_papers",
                    source_kind="markdown",
                    source_id=f"{source_tag}:{relative_path}",
                    path=str(path),
                    text=text,
                    metadata={
                        "title": file_meta.get("title") or _extract_markdown_title(text, relative_path),
                        "package": file_meta.get("package"),
                        "year": file_meta.get("year"),
                        "quality_score": file_meta.get("quality_score"),
                    },
                )
            )
    return results


def audit_medical_textbooks(textbooks_dir: Path, *, limit: int | None) -> list[AuditResult]:
    files = sorted(textbooks_dir.glob("*.jsonl"))
    if limit is not None:
        files = files[:limit]

    results: list[AuditResult] = []
    for path in files:
        file_text = safe_read_text(path)
        combined_chunks: list[str] = []
        representative_meta: dict[str, Any] = {}
        for line in file_text.splitlines():
            if not line.strip():
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = str(payload.get("text") or "").strip()
            if text:
                combined_chunks.append(text)
            meta = payload.get("metadata") or {}
            for key in ("title", "category", "tier", "priority"):
                if meta.get(key) and key not in representative_meta:
                    representative_meta[key] = meta[key]

        results.append(
            audit_document(
                target_collection="medical_textbooks",
                source_kind="jsonl",
                source_id=path.stem,
                path=str(path),
                text="\n\n".join(combined_chunks[:40]),
                metadata=representative_meta,
            )
        )
    return results


def audit_wiki_sources(corpus_dir: Path, *, limit: int | None) -> list[AuditResult]:
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pymupdf is required for wiki source auditing") from exc

    metadata_csv = corpus_dir / "metadata.csv"
    pdf_dir = corpus_dir / "pdfs"
    rows = read_metadata_rows(metadata_csv)
    if limit is not None:
        rows = rows[:limit]

    results: list[AuditResult] = []
    for row in rows:
        filename = clean_bibliographic_text(row.get("Filename"))
        pdf_path = pdf_dir / filename if filename else None
        text = ""
        if pdf_path and pdf_path.exists():
            text = extract_pdf_text(pdf_path, fitz)
        title = clean_bibliographic_text(row.get("Title")) or clean_bibliographic_text(row.get("PDF Title"))
        metadata = {
            "title": title,
            "doi": clean_bibliographic_text(row.get("DOI")),
            "authors": clean_bibliographic_text(row.get("Authors")),
            "journal": clean_bibliographic_text(row.get("Journal")),
            "publication_year": clean_bibliographic_text(row.get("Publication Year")),
            "pmid": clean_bibliographic_text(row.get("PMID")),
            "pmcid": clean_bibliographic_text(row.get("PMCID")),
        }
        result = audit_document(
            target_collection="wiki_pages",
            source_kind="pdf",
            source_id=filename or title,
            path=str(pdf_path) if pdf_path else "",
            text=text,
            metadata=metadata,
        )
        rejection_reason = _strict_metadata_rejection_reason(row)
        if rejection_reason:
            result.reasons.append(f"wiki_metadata_gate:{rejection_reason}")
            result.disposition = "reject"
            if rejection_reason.startswith("Missing required metadata"):
                result.missing_metadata = [
                    value.strip()
                    for value in rejection_reason.split(":", 1)[1].split(",")
                    if value.strip()
                ]
        results.append(result)
    return results


def extract_pdf_text(path: Path, fitz_module: Any) -> str:
    text_parts: list[str] = []
    with fitz_module.open(str(path)) as document:
        for page in document:
            text_parts.append(page.get_text("text"))
    return "\n".join(text_parts).strip()


def read_metadata_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def safe_read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def build_summary(results: list[AuditResult]) -> dict[str, Any]:
    by_collection: dict[str, dict[str, Any]] = {}
    for result in results:
        bucket = by_collection.setdefault(
            result.target_collection,
            {
                "total": 0,
                "accept": 0,
                "review": 0,
                "reject": 0,
                "top_reasons": Counter(),
            },
        )
        bucket["total"] += 1
        bucket[result.disposition] += 1
        for reason in result.reasons:
            bucket["top_reasons"][reason.split(":", 1)[0]] += 1

    serializable: dict[str, Any] = {}
    for collection, bucket in by_collection.items():
        serializable[collection] = {
            "total": bucket["total"],
            "accept": bucket["accept"],
            "review": bucket["review"],
            "reject": bucket["reject"],
            "top_reasons": dict(bucket["top_reasons"].most_common(8)),
        }

    return {
        "total_documents": len(results),
        "collections": serializable,
    }


def print_human_summary(summary: dict[str, Any], results: list[AuditResult]) -> None:
    print("Ingestion Quality Audit")
    print(f"Total documents: {summary['total_documents']}")
    print("")
    for collection, bucket in summary["collections"].items():
        print(
            f"{collection}: total={bucket['total']} accept={bucket['accept']} "
            f"review={bucket['review']} reject={bucket['reject']}"
        )
        if bucket["top_reasons"]:
            print(f"  top reasons: {', '.join(f'{k}={v}' for k, v in bucket['top_reasons'].items())}")

    flagged = [result for result in results if result.disposition != "accept"]
    if flagged:
        print("")
        print("Most suspicious sources:")
        for result in flagged[:20]:
            print(
                f"- [{result.target_collection}] {result.source_id} -> {result.disposition} "
                f"({'; '.join(result.reasons[:4])})"
            )


def _extract_markdown_title(text: str, fallback_path: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return Path(fallback_path).stem.replace("-", " ").replace("_", " ").strip() or fallback_path


if __name__ == "__main__":
    raise SystemExit(main())
