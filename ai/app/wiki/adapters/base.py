"""Base helpers for wiki adapters and page serialization."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


@dataclass(slots=True)
class PreparedSource:
    title: str
    slug: str
    source_type: str
    content: str
    original_filename: str
    stored_filename: str
    metadata: dict[str, str] = field(default_factory=dict)


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return normalized or "untitled"


def build_frontmatter(data: dict[str, str | list[str]]) -> str:
    lines = ["---"]
    for key, value in data.items():
        if isinstance(value, list):
            lines.append(f"{key}: [{', '.join(value)}]")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def parse_markdown_page(path: str | Path) -> tuple[dict[str, str | list[str]], str]:
    text = Path(path).read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}, text

    _, rest = text.split("---\n", 1)
    metadata_block, body = rest.split("\n---\n", 1)
    metadata: dict[str, str | list[str]] = {}
    for line in metadata_block.splitlines():
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        value = raw_value.strip()
        if value.startswith("[") and value.endswith("]"):
            items = [item.strip() for item in value[1:-1].split(",") if item.strip()]
            metadata[key.strip()] = items
        else:
            metadata[key.strip()] = value
    return metadata, body.lstrip("\n")


def extract_wikilinks(body: str) -> list[str]:
    return sorted({match.group(1).strip() for match in WIKILINK_RE.finditer(body) if match.group(1).strip()})

