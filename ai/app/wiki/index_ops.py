"""Index file helpers for workspace wiki pages."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


INDEX_HEADER = """# Wiki Index

| type | title | slug | path | keywords | links | updated_at | source_slug | source_type | ingested_at | doi | authors | first_author | journal | publication_year | pmid | pmcid | primary_domain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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
    source_slug: str = ""
    source_type: str = ""
    ingested_at: str = ""
    doi: str = ""
    authors: str = ""
    first_author: str = ""
    journal: str = ""
    publication_year: str = ""
    pmid: str = ""
    pmcid: str = ""
    primary_domain: str = ""


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
        if not stripped.startswith("|"):
            continue
        if stripped.startswith("| type |") or stripped.startswith("| --- |"):
            continue
        columns = [part.strip() for part in stripped.split("|")[1:-1]]
        if len(columns) < 7:
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
                source_slug=columns[7] if len(columns) > 7 else "",
                source_type=columns[8] if len(columns) > 8 else "",
                ingested_at=columns[9] if len(columns) > 9 else "",
                doi=columns[10] if len(columns) > 10 else "",
                authors=columns[11] if len(columns) > 11 else "",
                first_author=columns[12] if len(columns) > 12 else "",
                journal=columns[13] if len(columns) > 13 else "",
                publication_year=columns[14] if len(columns) > 14 else "",
                pmid=columns[15] if len(columns) > 15 else "",
                pmcid=columns[16] if len(columns) > 16 else "",
                primary_domain=columns[17] if len(columns) > 17 else "",
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
                    _sanitize_cell(entry.source_slug),
                    _sanitize_cell(entry.source_type),
                    _sanitize_cell(entry.ingested_at),
                    _sanitize_cell(entry.doi),
                    _sanitize_cell(entry.authors),
                    _sanitize_cell(entry.first_author),
                    _sanitize_cell(entry.journal),
                    _sanitize_cell(entry.publication_year),
                    _sanitize_cell(entry.pmid),
                    _sanitize_cell(entry.pmcid),
                    _sanitize_cell(entry.primary_domain),
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


_STOP_WORDS = frozenset(
    "a an and are as at be by for from has have how in is it of on or "
    "that the this to was what when where which who will with".split()
)


def search_index(
    workspace_dir: str | Path,
    query: str,
    entries: list[IndexEntry] | None = None,
) -> list[IndexEntry]:
    normalized = query.strip().lower()
    if not normalized:
        return list(entries) if entries is not None else read_index(workspace_dir)

    tokens = [
        token for token in normalized.split()
        if token not in _STOP_WORDS and len(token) > 1
    ]
    if not tokens:
        return list(entries) if entries is not None else read_index(workspace_dir)

    results: list[tuple[int, IndexEntry]] = []
    for entry in entries if entries is not None else read_index(workspace_dir):
        haystack = " ".join([
            entry.title.lower(),
            entry.slug.lower(),
            entry.page_type.lower(),
            " ".join(keyword.lower() for keyword in entry.keywords),
            " ".join(link.lower() for link in entry.links),
            entry.doi.lower(),
            entry.authors.lower(),
            entry.first_author.lower(),
            entry.journal.lower(),
            entry.publication_year.lower(),
            entry.pmid.lower(),
            entry.pmcid.lower(),
            entry.primary_domain.lower(),
        ])
        score = sum(1 for token in tokens if token in haystack)
        if score:
            results.append((score, entry))
    results.sort(key=lambda item: (-item[0], item[1].title.lower()))
    return [entry for _, entry in results]


def _sanitize_cell(value: str) -> str:
    return value.replace("|", "/").strip()
