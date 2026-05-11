#!/usr/bin/env python3
"""Catalog and validate Parthenon documentation lineage files."""

from __future__ import annotations

import argparse
import collections
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "docs" / "lineage" / "catalog.md"
BASELINE_PATH = ROOT / "docs" / "lineage" / "frontmatter-baseline.txt"

DOC_SUFFIXES = {".md", ".mdx"}


@dataclass(frozen=True)
class DocRecord:
    path: str
    category: str
    target: str
    title: str
    line_count: int
    has_frontmatter: bool
    doc_type: str
    status: str


def git_paths() -> list[Path]:
    result = subprocess.run(
        [
            "git",
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "docs",
        ],
        cwd=ROOT,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )

    paths: list[Path] = []
    for raw in result.stdout.splitlines():
        path = Path(raw)
        if (
            path.suffix.lower() in DOC_SUFFIXES
            and (ROOT / path).exists()
            and is_authored_doc(path)
        ):
            paths.append(path)
    return sorted(paths, key=lambda p: p.as_posix())


def is_authored_doc(path: Path) -> bool:
    raw = path.as_posix()
    excluded_prefixes = (
        "docs/site/build/",
        "docs/site/.docusaurus/",
        "docs/site/node_modules/",
    )
    if raw.startswith(excluded_prefixes):
        return False
    if raw.startswith("docs/site/docs/api/") and raw != "docs/site/docs/api/index.mdx":
        return False
    return True


def frontmatter(lines: list[str]) -> dict[str, str]:
    if not lines or lines[0].strip() != "---":
        return {}

    data: dict[str, str] = {}
    for line in lines[1:120]:
        if line.strip() == "---":
            return data
        match = re.match(r"([A-Za-z0-9_-]+):\s*(.*)", line)
        if match:
            data[match.group(1)] = match.group(2).strip().strip('"')
    return {}


def extract_title(path: Path, lines: list[str], meta: dict[str, str]) -> str:
    if meta.get("title"):
        return meta["title"]
    for line in lines[:160]:
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem


def classify(path: Path) -> tuple[str, str]:
    raw = path.as_posix()

    if raw.startswith("docs/site/docs/"):
        if raw == "docs/site/docs/api/index.mdx":
            return "api-source-index", "docs/site/docs/api/index.mdx"
        return "public-docs-source", raw
    if raw.startswith("docs/site/i18n/"):
        return "translation-source", raw
    if raw.startswith("docs/blog/"):
        return "public-dev-blog", raw
    if raw in {
        "docs/devlog/README.md",
        "docs/superpowers/README.md",
        "docs/handoffs/README.md",
    }:
        return "transition-index", raw
    if raw == "docs/lineage/reorganization-audit-2026-05-10.md":
        return "lineage-index", raw

    # Canonical lineage homes.
    if raw.startswith("docs/lineage/decisions/adr/"):
        return "adr", raw
    if raw.startswith("docs/lineage/modules/"):
        return "module-lineage", raw
    if raw.startswith("docs/lineage/timeline/phases/"):
        return "phase-lineage", raw
    if raw.startswith("docs/lineage/timeline/releases/"):
        return "release-lineage", raw
    if raw.startswith("docs/lineage/timeline/sessions/"):
        return "session-lineage", raw
    if raw.startswith("docs/lineage/plans/open/"):
        return "active-plan", raw
    if raw.startswith("docs/lineage/plans/review/"):
        return "plan-review", raw
    if raw.startswith("docs/lineage/plans/closed/"):
        return "closed-plan", raw
    if raw.startswith("docs/lineage/design/specs/"):
        return "active-spec", raw
    if raw.startswith("docs/lineage/design/strategy/"):
        return "strategy-lineage", raw
    if raw.startswith("docs/lineage/design/architecture/"):
        return "architecture", raw
    if raw.startswith("docs/lineage/archive/plans/"):
        return "legacy-plan", raw
    if raw.startswith("docs/lineage/archive/specs/"):
        return "legacy-spec", raw
    if raw.startswith("docs/lineage/archive/prompts/"):
        return "archived-prompt", raw
    if raw.startswith("docs/lineage/operations/"):
        return "operations-lineage", raw
    if raw.startswith("docs/lineage/handoffs/"):
        return "handoff", raw

    # Old roots retained only as transitional pointers or compatibility fallbacks.
    if raw.startswith("docs/adr/"):
        return "adr", "docs/lineage/decisions/adr/"
    if raw.startswith("docs/architecture/adr-"):
        return "adr", "docs/lineage/decisions/adr/"
    if raw.startswith("docs/architecture/"):
        return "architecture", "docs/lineage/design/architecture/"
    if raw.startswith("docs/devlog/"):
        return "transition-pointer", raw
    if raw.startswith("docs/superpowers/"):
        return "transition-pointer", raw
    if raw.startswith("docs/handoffs/"):
        return "transition-pointer", raw

    if raw.startswith("docs/ops/"):
        return "operations", raw
    if raw.startswith("docs/compliance/"):
        return "compliance", raw
    if raw.startswith("docs/research/"):
        return "research", raw
    if raw.startswith("docs/abby-seed/"):
        return "seed-duplicate-or-reference", "docs/reference/abby-seed/"
    if raw.startswith("docs/demo/"):
        return "demo", raw
    if raw.startswith("docs/data-dictionary/"):
        return "data-dictionary", raw
    if raw.startswith("docs/commons/"):
        return "commons", "docs/lineage/modules/commons/"
    if raw.startswith("docs/irsf-nhs/"):
        return "research-handoff", "docs/research/"
    if raw.startswith("docs/poseidon/"):
        return "poseidon", "docs/lineage/modules/poseidon/"
    if raw.startswith("docs/lineage/") or raw == "docs/README.md":
        return "lineage-index", raw
    if raw.startswith("docs/"):
        return "other", "docs/lineage/archive/"
    return "other", raw


def collect_records() -> list[DocRecord]:
    records: list[DocRecord] = []
    for rel_path in git_paths():
        path = ROOT / rel_path
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        meta = frontmatter(lines)
        category, target = classify(rel_path)
        records.append(
            DocRecord(
                path=rel_path.as_posix(),
                category=category,
                target=target,
                title=extract_title(rel_path, lines, meta),
                line_count=len(lines),
                has_frontmatter=bool(meta),
                doc_type=meta.get("doc_type", ""),
                status=meta.get("status", ""),
            )
        )
    return records


def render_catalog(records: list[DocRecord]) -> str:
    counts = collections.Counter(record.category for record in records)
    total_lines = sum(record.line_count for record in records)
    missing = sum(1 for record in records if not record.has_frontmatter)

    out: list[str] = [
        "---",
        "doc_type: lineage",
        "status: active",
        "date: 2026-05-10",
        "owner: acumenus",
        "module: docs",
        "lineage_anchor: true",
        "supersedes: []",
        "superseded_by: null",
        "related_code:",
        "  - scripts/docs/catalog_lineage_docs.py",
        "related_prs: []",
        "---",
        "",
        "# Documentation Lineage Catalog",
        "",
        "Generated by `python3 scripts/docs/catalog_lineage_docs.py --write-catalog`.",
        "",
        "## Summary",
        "",
        f"- Authored Markdown/MDX files: {len(records)}",
        f"- Total lines: {total_lines:,}",
        f"- Files missing lineage frontmatter: {missing}",
        "",
        "## Category Counts",
        "",
        "| Count | Category |",
        "|---:|---|",
    ]

    for category, count in counts.most_common():
        out.append(f"| {count} | `{category}` |")

    out.extend(["", "## Files", ""])

    for category in sorted(counts):
        out.extend(
            [
                f"### {category}",
                "",
                "| Path | Title | Lines | Frontmatter | Target |",
                "|---|---|---:|---|---|",
            ]
        )
        for record in records:
            if record.category != category:
                continue
            title = record.title.replace("|", "\\|")
            status = "yes" if record.has_frontmatter else "baseline"
            out.append(
                f"| `{record.path}` | {title} | {record.line_count} | {status} | `{record.target}` |"
            )
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def missing_frontmatter_paths(records: list[DocRecord]) -> list[str]:
    return [record.path for record in records if not record.has_frontmatter]


def read_baseline(path: Path = BASELINE_PATH) -> set[str]:
    if not path.exists():
        return set()
    return {
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }


def write_catalog(records: list[DocRecord]) -> None:
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(render_catalog(records), encoding="utf-8")


def write_baseline(records: list[DocRecord]) -> None:
    BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
    paths = missing_frontmatter_paths(records)
    body = [
        "# Existing Markdown/MDX files that predate the lineage frontmatter contract.",
        "# New files should not be added here unless they are intentionally historical.",
        *paths,
    ]
    BASELINE_PATH.write_text("\n".join(body).rstrip() + "\n", encoding="utf-8")


def check_frontmatter(records: list[DocRecord]) -> int:
    baseline = read_baseline()
    missing = set(missing_frontmatter_paths(records))
    new_missing = sorted(missing - baseline)
    stale_baseline = sorted(baseline - {record.path for record in records})

    if new_missing:
        print("New Markdown/MDX files missing lineage frontmatter:", file=sys.stderr)
        for path in new_missing:
            print(f"  {path}", file=sys.stderr)
    if stale_baseline:
        print("Baseline references paths that no longer exist:", file=sys.stderr)
        for path in stale_baseline[:40]:
            print(f"  {path}", file=sys.stderr)
        if len(stale_baseline) > 40:
            print(f"  ... {len(stale_baseline) - 40} more", file=sys.stderr)

    if new_missing or stale_baseline:
        return 1

    print(
        f"Lineage frontmatter OK: {len(missing)} existing baseline file(s), "
        f"{len(records) - len(missing)} classified file(s)."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Catalog and validate Parthenon docs lineage metadata."
    )
    parser.add_argument("--write-catalog", action="store_true")
    parser.add_argument("--write-frontmatter-baseline", action="store_true")
    parser.add_argument("--check-frontmatter", action="store_true")
    args = parser.parse_args()

    records = collect_records()

    if args.write_catalog:
        write_catalog(records)
        print(f"Wrote {CATALOG_PATH.relative_to(ROOT)}")

    if args.write_frontmatter_baseline:
        write_baseline(records)
        print(f"Wrote {BASELINE_PATH.relative_to(ROOT)}")

    if args.check_frontmatter:
        return check_frontmatter(records)

    if not (args.write_catalog or args.write_frontmatter_baseline):
        counts = collections.Counter(record.category for record in records)
        print(f"Authored docs: {len(records)}")
        for category, count in counts.most_common():
            print(f"{count:4} {category}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
