"""Index file helpers for workspace wiki pages."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


INDEX_HEADER = """# Wiki Index

| type | title | slug | path | keywords | links | updated_at |
| --- | --- | --- | --- | --- | --- | --- |
"""


@dataclass(slots=True)
class IndexEntry:
    page_type: str
    title: str
    slug: str
    path: str
    keywords: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    updated_at: str = ""


def ensure_index_file(workspace_dir: str | Path) -> Path:
    path = Path(workspace_dir) / "index.md"
    if not path.exists():
        path.write_text(INDEX_HEADER, encoding="utf-8")
    return path


def read_index(workspace_dir: str | Path) -> list[IndexEntry]:
    path = ensure_index_file(workspace_dir)
    entries: list[IndexEntry] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or "type" in stripped or "---" in stripped:
            continue
        columns = [part.strip() for part in stripped.split("|")[1:-1]]
        if len(columns) != 7:
            continue
        keywords = [item.strip() for item in columns[4].split(",") if item.strip()]
        links = [item.strip() for item in columns[5].split(",") if item.strip()]
        entries.append(
            IndexEntry(
                page_type=columns[0],
                title=columns[1],
                slug=columns[2],
                path=columns[3],
                keywords=keywords,
                links=links,
                updated_at=columns[6],
            )
        )
    return entries


def write_index(workspace_dir: str | Path, entries: list[IndexEntry]) -> Path:
    path = ensure_index_file(workspace_dir)
    lines = [INDEX_HEADER.rstrip()]
    for entry in sorted(entries, key=lambda item: (item.page_type, item.title.lower(), item.slug)):
        lines.append(
            "| "
            + " | ".join(
                [
                    _sanitize_cell(entry.page_type),
                    _sanitize_cell(entry.title),
                    _sanitize_cell(entry.slug),
                    _sanitize_cell(entry.path),
                    _sanitize_cell(", ".join(entry.keywords)),
                    _sanitize_cell(", ".join(entry.links)),
                    _sanitize_cell(entry.updated_at),
                ]
            )
            + " |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def upsert_index_entry(workspace_dir: str | Path, entry: IndexEntry) -> list[IndexEntry]:
    entries = [existing for existing in read_index(workspace_dir) if existing.slug != entry.slug]
    entries.append(entry)
    write_index(workspace_dir, entries)
    return entries


def remove_index_entry(workspace_dir: str | Path, slug: str) -> list[IndexEntry]:
    entries = [entry for entry in read_index(workspace_dir) if entry.slug != slug]
    write_index(workspace_dir, entries)
    return entries


def search_index(workspace_dir: str | Path, query: str) -> list[IndexEntry]:
    normalized = query.strip().lower()
    if not normalized:
        return read_index(workspace_dir)

    results: list[tuple[int, IndexEntry]] = []
    for entry in read_index(workspace_dir):
        haystacks = [
            entry.title.lower(),
            entry.slug.lower(),
            entry.page_type.lower(),
            " ".join(keyword.lower() for keyword in entry.keywords),
            " ".join(link.lower() for link in entry.links),
        ]
        score = sum(normalized in haystack for haystack in haystacks)
        if score:
            results.append((score, entry))
    results.sort(key=lambda item: (-item[0], item[1].title.lower()))
    return [entry for _, entry in results]


def _sanitize_cell(value: str) -> str:
    return value.replace("|", "/").strip()

