"""Export actionable review/reject queues from ingestion audit reports.

Usage:
  python ai/scripts/export_ingestion_triage.py /tmp/ingestion-audit-ohdsi.json /tmp/ingestion-audit-wiki.json
  python ai/scripts/export_ingestion_triage.py /tmp/ingestion-audit-*.json --output-dir output/ingestion-quality/2026-04-08
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

AI_DIR = Path(__file__).resolve().parents[1]
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export reject/review queues from ingestion audit JSON.")
    parser.add_argument("audit_files", nargs="+", help="One or more audit JSON files produced by audit_ingestion_quality.py")
    parser.add_argument(
        "--output-dir",
        default="output/ingestion-quality/2026-04-08",
        help="Directory where curated CSV/JSON/Markdown outputs should be written.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    audit_paths = [Path(path) for path in args.audit_files]
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_results: list[dict[str, Any]] = []
    for path in audit_paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for result in payload.get("results", []):
            result = dict(result)
            result["_source_audit_file"] = str(path)
            all_results.append(result)

    by_collection: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in all_results:
        by_collection[result["target_collection"]].append(result)

    summary = build_summary(by_collection)

    (output_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (output_dir / "summary.md").write_text(
        build_markdown_summary(summary),
        encoding="utf-8",
    )

    for collection, rows in sorted(by_collection.items()):
        collection_dir = output_dir / collection
        collection_dir.mkdir(parents=True, exist_ok=True)
        for disposition in ("reject", "review"):
            queue_rows = [normalize_row(row) for row in rows if row["disposition"] == disposition]
            queue_rows.sort(key=sort_key)
            write_csv(collection_dir / f"{disposition}.csv", queue_rows)
            write_json(collection_dir / f"{disposition}.json", queue_rows)

    print(f"Wrote triage outputs to {output_dir}")
    for collection, bucket in sorted(summary["collections"].items()):
        print(
            f"{collection}: reject={bucket['reject']} review={bucket['review']} "
            f"accept={bucket['accept']} top_reasons={bucket['top_reasons']}"
        )
    return 0


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    reasons = list(row.get("reasons") or [])
    missing = list(row.get("missing_metadata") or [])
    scores = row.get("scores") or {}
    return {
        "target_collection": row.get("target_collection", ""),
        "disposition": row.get("disposition", ""),
        "recommended_action": recommended_action(row),
        "source_id": row.get("source_id", ""),
        "title": row.get("title", ""),
        "path": row.get("path", ""),
        "reason_count": len(reasons),
        "reasons": "; ".join(reasons),
        "missing_metadata": ", ".join(missing),
        "metadata_score": scores.get("metadata_score"),
        "relevance_score": scores.get("relevance_score"),
        "boilerplate_score": scores.get("boilerplate_score"),
        "noise_score": scores.get("noise_score"),
        "quality_score": row.get("quality_score"),
        "source_audit_file": row.get("_source_audit_file", ""),
    }


def recommended_action(row: dict[str, Any]) -> str:
    disposition = row.get("disposition")
    reasons = list(row.get("reasons") or [])
    if disposition == "reject":
        return "PURGE"
    if any(reason.startswith("wiki_metadata_gate") for reason in reasons):
        return "BACKFILL_METADATA_OR_EXCLUDE"
    if any(reason.startswith("boilerplate") or reason.startswith("possible_boilerplate") for reason in reasons):
        return "MANUAL_REVIEW_PDF"
    if any(reason.startswith("low_relevance") or reason.startswith("borderline_relevance") for reason in reasons):
        return "DOMAIN_RELEVANCE_REVIEW"
    return "MANUAL_REVIEW"


def sort_key(row: dict[str, Any]) -> tuple[int, float, float, str]:
    return (
        0 if row["recommended_action"] == "PURGE" else 1,
        -(float(row["boilerplate_score"] or 0.0)),
        -(float(row["noise_score"] or 0.0)),
        str(row["source_id"]),
    )


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "target_collection",
        "disposition",
        "recommended_action",
        "source_id",
        "title",
        "path",
        "reason_count",
        "reasons",
        "missing_metadata",
        "metadata_score",
        "relevance_score",
        "boilerplate_score",
        "noise_score",
        "quality_score",
        "source_audit_file",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(rows, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def build_summary(by_collection: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    summary: dict[str, Any] = {"collections": {}}
    for collection, rows in sorted(by_collection.items()):
        counts = Counter(row["disposition"] for row in rows)
        top_reasons = Counter()
        recommended_actions = Counter()
        for row in rows:
            for reason in row.get("reasons") or []:
                top_reasons[reason.split(":", 1)[0]] += 1
            recommended_actions[recommended_action(row)] += 1
        summary["collections"][collection] = {
            "total": len(rows),
            "accept": counts.get("accept", 0),
            "review": counts.get("review", 0),
            "reject": counts.get("reject", 0),
            "top_reasons": dict(top_reasons.most_common(8)),
            "recommended_actions": dict(recommended_actions.most_common()),
        }
    return summary


def build_markdown_summary(summary: dict[str, Any]) -> str:
    lines = [
        "# Ingestion Triage Summary",
        "",
    ]
    for collection, bucket in summary["collections"].items():
        lines.extend(
            [
                f"## {collection}",
                "",
                f"- Total: {bucket['total']}",
                f"- Accept: {bucket['accept']}",
                f"- Review: {bucket['review']}",
                f"- Reject: {bucket['reject']}",
                f"- Recommended Actions: {', '.join(f'{k}={v}' for k, v in bucket['recommended_actions'].items()) or 'None'}",
                f"- Top Reasons: {', '.join(f'{k}={v}' for k, v in bucket['top_reasons'].items()) or 'None'}",
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
