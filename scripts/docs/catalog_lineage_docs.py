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

REQUIRED_CONTRACT_KEYS = (
    "doc_type",
    "status",
    "date",
    "owner",
    "module",
    "lineage_anchor",
    "supersedes",
    "superseded_by",
    "related_code",
    "related_prs",
)

VALID_DOC_TYPES = {
    "lineage",
    "plan",
    "spec",
    "adr",
    "runbook",
    "handoff",
    "public-doc",
    "blog",
    "compliance",
    "research",
    "reference",
    "demo",
}

VALID_STATUSES = {
    "open",
    "active",
    "accepted",
    "shipped",
    "superseded",
    "historical",
    "archived",
}

APPROVED_DOC_PREFIXES = (
    "docs/site/",
    "docs/blog/",
    "docs/lineage/",
    "docs/ops/",
    "docs/compliance/",
    "docs/research/",
    "docs/reference/",
    "docs/demo/",
    "docs/superpowers/",  # design/plan working docs for in-flight phases
)

APPROVED_DOC_PATHS = {
    "docs/README.md",
    "docs/devlog/README.md",
}

CONTRACT_REQUIRED_PREFIXES = (
    "docs/lineage/",
    "docs/ops/",
    "docs/compliance/",
    "docs/research/",
    "docs/reference/",
    "docs/demo/",
)

HISTORICAL_STATUSES = {"archived", "historical"}
STALE_ORG_REFERENCE_RE = re.compile(
    r"github\.com/sudoshi/Parthenon|ghcr\.io/sudoshi/parthenon"
)


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
    meta: dict[str, str]


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
    if raw == "docs/devlog/README.md":
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
    if raw.startswith("docs/architecture/adr-"):
        return "adr", "docs/lineage/decisions/adr/"
    if raw.startswith("docs/architecture/"):
        return "architecture", "docs/lineage/design/architecture/"
    if raw.startswith("docs/devlog/"):
        return "transition-pointer", raw

    if raw.startswith("docs/ops/"):
        return "operations", raw
    if raw.startswith("docs/compliance/"):
        return "compliance", raw
    if raw.startswith("docs/research/"):
        return "research", raw
    if raw.startswith("docs/reference/"):
        return "reference", raw
    if raw.startswith("docs/abby-seed/"):
        return "seed-duplicate-or-reference", "docs/reference/abby-seed/"
    if raw.startswith("docs/demo/"):
        return "demo", raw
    if raw.startswith("docs/commons/"):
        return "commons", "docs/lineage/modules/commons/"
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
                meta=meta,
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
    placement_violations = check_placement(records, baseline)
    contract_violations = check_contract(records, baseline)
    stale_org_violations = check_active_org_references(records)

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

    if placement_violations:
        print("Markdown/MDX files outside approved documentation homes:", file=sys.stderr)
        for path, reason in placement_violations:
            print(f"  {path}: {reason}", file=sys.stderr)
    if contract_violations:
        print("Markdown/MDX files with invalid lineage metadata:", file=sys.stderr)
        for path, reason in contract_violations:
            print(f"  {path}: {reason}", file=sys.stderr)
    if stale_org_violations:
        print("Active developer docs with stale sudoshi/Parthenon references:", file=sys.stderr)
        for path, reason in stale_org_violations:
            print(f"  {path}: {reason}", file=sys.stderr)

    if (
        new_missing
        or stale_baseline
        or placement_violations
        or contract_violations
        or stale_org_violations
    ):
        return 1

    print(
        f"Docs lineage contract OK: {len(missing)} existing baseline file(s), "
        f"{len(records) - len(missing)} classified file(s)."
    )
    return 0


def is_approved_doc_home(path: str) -> bool:
    if path in APPROVED_DOC_PATHS:
        return True
    return path.startswith(APPROVED_DOC_PREFIXES)


def requires_lineage_contract(record: DocRecord, baseline: set[str]) -> bool:
    if record.path in baseline:
        return False
    if record.path in APPROVED_DOC_PATHS:
        return True
    return record.path.startswith(CONTRACT_REQUIRED_PREFIXES)


def has_metadata_value(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip() not in {"", "null", "NULL", "[]", "~"}


def check_placement(
    records: list[DocRecord], baseline: set[str]
) -> list[tuple[str, str]]:
    violations: list[tuple[str, str]] = []
    for record in records:
        if is_approved_doc_home(record.path):
            continue
        if record.path in baseline:
            continue
        if record.status in HISTORICAL_STATUSES:
            continue
        violations.append(
            (
                record.path,
                "new docs must live in docs/site, docs/blog, docs/lineage, "
                "docs/ops, docs/compliance, docs/research, docs/reference, or docs/demo",
            )
        )
    return violations


def check_contract(
    records: list[DocRecord], baseline: set[str]
) -> list[tuple[str, str]]:
    violations: list[tuple[str, str]] = []
    for record in records:
        if requires_lineage_contract(record, baseline):
            missing_keys = [
                key for key in REQUIRED_CONTRACT_KEYS if key not in record.meta
            ]
            if missing_keys:
                violations.append(
                    (
                        record.path,
                        "missing required metadata keys: " + ", ".join(missing_keys),
                    )
                )

        if record.doc_type and record.doc_type not in VALID_DOC_TYPES:
            violations.append(
                (
                    record.path,
                    f"doc_type '{record.doc_type}' is not in the allowed lineage taxonomy",
                )
            )
        if record.status and record.status not in VALID_STATUSES:
            violations.append(
                (
                    record.path,
                    f"status '{record.status}' is not in the allowed lifecycle taxonomy",
                )
            )
        if (
            requires_lineage_contract(record, baseline)
            and record.meta.get("date")
            and not re.fullmatch(
                r"\d{4}-\d{2}-\d{2}", record.meta["date"]
            )
        ):
            violations.append((record.path, "date must use YYYY-MM-DD"))
        if record.status == "superseded" and not has_metadata_value(
            record.meta.get("superseded_by")
        ):
            violations.append(
                (
                    record.path,
                    "status superseded requires superseded_by to name the successor",
                )
            )
        if record.doc_type == "public-doc" and not record.path.startswith("docs/site/"):
            violations.append(
                (
                    record.path,
                    "doc_type public-doc is reserved for Docusaurus source under docs/site",
                )
            )
    return violations


def check_active_org_references(records: list[DocRecord]) -> list[tuple[str, str]]:
    violations: list[tuple[str, str]] = []
    for record in records:
        if record.status != "active":
            continue
        if record.path.startswith(("docs/site/", "docs/blog/", "docs/lineage/")):
            continue
        text = (ROOT / record.path).read_text(encoding="utf-8", errors="replace")
        if STALE_ORG_REFERENCE_RE.search(text):
            violations.append(
                (
                    record.path,
                    "use Acumenus-Data-Sciences/Parthenon unless the doc is historical",
                )
            )
    return violations


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
