# LLM-Maintained Wiki Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an LLM-maintained persistent wiki engine that ingests sources, synthesizes interlinked markdown pages via local Ollama, and surfaces them through the Commons wiki UI.

**Architecture:** Three-layer filesystem design (raw sources → LLM-generated wiki pages → schema config) with a Python wiki engine in the existing AI FastAPI service, Laravel proxy controller with RBAC, and a revamped Commons wiki subpage in the React frontend.

**Tech Stack:** Python 3.12 / FastAPI (wiki engine), Ollama ii-medical:8b-q8 (LLM), Git (versioning), Laravel 11 / PHP 8.4 (backend proxy), React 19 / TypeScript / TanStack Query / Zustand (frontend)

---

## File Map

### Python AI Service (new files)

| File | Responsibility |
|---|---|
| `ai/app/wiki/__init__.py` | Package init |
| `ai/app/wiki/engine.py` | Core wiki engine — orchestrates ingest, query, lint, maintain operations |
| `ai/app/wiki/prompts.py` | All Ollama prompt templates (extract, update entity, update concept, update overview, update index, query relevance, query answer, lint batch) |
| `ai/app/wiki/git_ops.py` | Git operations — commit, branch create/delete/switch, workspace init |
| `ai/app/wiki/index_ops.py` | index.md parsing, keyword search, entry updates |
| `ai/app/wiki/log_ops.py` | log.md append and read operations |
| `ai/app/wiki/models.py` | Pydantic request/response models for all wiki endpoints |
| `ai/app/wiki/adapters/__init__.py` | Adapter package init |
| `ai/app/wiki/adapters/base.py` | Base adapter class with frontmatter generation |
| `ai/app/wiki/adapters/external.py` | External document adapter (markdown passthrough, PDF extraction, plain text) |
| `ai/app/routers/wiki.py` | FastAPI router — 10 endpoints proxied by Laravel |
| `ai/tests/wiki/__init__.py` | Test package init |
| `ai/tests/wiki/test_index_ops.py` | Tests for index parsing and search |
| `ai/tests/wiki/test_log_ops.py` | Tests for log operations |
| `ai/tests/wiki/test_git_ops.py` | Tests for git operations |
| `ai/tests/wiki/test_prompts.py` | Tests for prompt template generation |
| `ai/tests/wiki/test_engine.py` | Integration tests for wiki engine |
| `ai/tests/wiki/test_router.py` | FastAPI endpoint tests |

### Laravel Backend (new + modified files)

| File | Responsibility |
|---|---|
| `backend/app/Http/Controllers/Api/V1/WikiController.php` | New top-level wiki controller — proxy to AI service with RBAC |
| `backend/database/seeders/RolePermissionSeeder.php` | Modified — add wiki.view, wiki.ingest, wiki.lint, wiki.manage permissions |
| `backend/app/Services/AiService.php` | Modified — add wiki proxy methods |
| `backend/routes/api.php` | Modified — add wiki route group |

### Frontend (new + modified files)

| File | Responsibility |
|---|---|
| `frontend/src/features/commons/types/wiki.ts` | New wiki TypeScript types |
| `frontend/src/features/commons/api/wiki.ts` | New TanStack Query hooks for wiki API |
| `frontend/src/stores/wikiStore.ts` | New Zustand store for wiki state |
| `frontend/src/features/commons/components/wiki/WikiPage.tsx` | Modified — replaced with LLM wiki browser |
| `frontend/src/features/commons/components/wiki/WikiPageTree.tsx` | New — page tree sidebar grouped by type |
| `frontend/src/features/commons/components/wiki/WikiPageView.tsx` | New — markdown renderer with wikilinks |
| `frontend/src/features/commons/components/wiki/WikiWorkspaceSelector.tsx` | New — workspace dropdown |
| `frontend/src/features/commons/components/wiki/WikiIngestPanel.tsx` | New — source ingestion slide-out |
| `frontend/src/features/commons/components/wiki/WikiQueryPanel.tsx` | New — conversational query interface |
| `frontend/src/features/commons/components/wiki/WikiActivityFeed.tsx` | New — log.md timeline |
| `frontend/src/features/commons/components/wiki/MarkdownRenderer.tsx` | New — shared markdown renderer with wikilink support |

### Infrastructure

| File | Responsibility |
|---|---|
| `docker-compose.yml` | Modified — add wiki-data volume to python-ai service |
| `data/wiki/SCHEMA.md` | New — global wiki schema (created at runtime by init) |

---

## Task 1: Wiki Data Volume & Git Repo Init

**Files:**
- Modify: `docker-compose.yml`
- Create: `ai/app/wiki/__init__.py`
- Create: `ai/app/wiki/git_ops.py`
- Create: `ai/tests/wiki/__init__.py`
- Create: `ai/tests/wiki/test_git_ops.py`

- [ ] **Step 1: Add wiki-data volume to docker-compose.yml**

In `docker-compose.yml`, add the named volume and mount it in the python-ai service:

```yaml
# Under python-ai service volumes (around line 163), add:
    - wiki-data:/data/wiki

# Under the top-level volumes section (end of file), add:
  wiki-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${PWD}/data/wiki
```

- [ ] **Step 2: Create the data/wiki directory on host**

```bash
mkdir -p data/wiki
echo "data/wiki/" >> .gitignore  # wiki repo is separate from Parthenon repo
```

- [ ] **Step 3: Write failing tests for git_ops**

```python
# ai/tests/wiki/__init__.py
# (empty)

# ai/tests/wiki/test_git_ops.py
import os
import subprocess
import tempfile
import pytest
from app.wiki.git_ops import (
    init_wiki_repo,
    wiki_commit,
    create_workspace_branch,
    delete_workspace_branch,
    list_branches,
    switch_branch,
    get_current_branch,
)


@pytest.fixture
def wiki_dir():
    """Create a temporary directory for wiki tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


def test_init_wiki_repo_creates_git_repo(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    assert os.path.isdir(os.path.join(wiki_dir, ".git"))


def test_init_wiki_repo_creates_platform_structure(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    assert os.path.isfile(os.path.join(wiki_dir, "SCHEMA.md"))
    assert os.path.isfile(os.path.join(wiki_dir, "platform", "index.md"))
    assert os.path.isfile(os.path.join(wiki_dir, "platform", "log.md"))
    assert os.path.isdir(os.path.join(wiki_dir, "platform", "sources"))
    assert os.path.isdir(os.path.join(wiki_dir, "platform", "wiki", "entities"))
    assert os.path.isdir(os.path.join(wiki_dir, "platform", "wiki", "concepts"))
    assert os.path.isdir(os.path.join(wiki_dir, "platform", "wiki", "comparisons"))
    assert os.path.isdir(os.path.join(wiki_dir, "platform", "wiki", "analyses"))


def test_init_wiki_repo_idempotent(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    init_wiki_repo(wiki_dir)  # second call should not error
    assert os.path.isdir(os.path.join(wiki_dir, ".git"))


def test_wiki_commit(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    test_file = os.path.join(wiki_dir, "platform", "wiki", "entities", "test.md")
    with open(test_file, "w") as f:
        f.write("# Test Entity\n")
    wiki_commit(wiki_dir, "wiki: test commit", [test_file])
    result = subprocess.run(
        ["git", "log", "--oneline", "-1"],
        cwd=wiki_dir,
        capture_output=True,
        text=True,
    )
    assert "wiki: test commit" in result.stdout


def test_create_workspace_branch(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    create_workspace_branch(wiki_dir, "study/123")
    branches = list_branches(wiki_dir)
    assert "study/123" in branches


def test_delete_workspace_branch(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    create_workspace_branch(wiki_dir, "personal/user1")
    delete_workspace_branch(wiki_dir, "personal/user1")
    branches = list_branches(wiki_dir)
    assert "personal/user1" not in branches


def test_get_current_branch(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    assert get_current_branch(wiki_dir) == "main"


def test_switch_branch(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    create_workspace_branch(wiki_dir, "study/456")
    switch_branch(wiki_dir, "study/456")
    assert get_current_branch(wiki_dir) == "study/456"
    switch_branch(wiki_dir, "main")
    assert get_current_branch(wiki_dir) == "main"
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd ai && python -m pytest tests/wiki/test_git_ops.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.wiki'`

- [ ] **Step 5: Implement git_ops.py**

```python
# ai/app/wiki/__init__.py
# (empty)

# ai/app/wiki/git_ops.py
"""Git operations for the wiki engine."""

import os
import subprocess
from pathlib import Path

SCHEMA_TEMPLATE = """# Wiki Schema

## Page Types

### Source Summary
One per ingested source. Immutable after creation.
```yaml
type: source_summary
```

### Entity Page
One per distinct entity. Accumulates facts across sources.
```yaml
type: entity
```

### Concept Page
Abstract themes spanning entities. Synthesized from multiple sources.
```yaml
type: concept
```

### Comparison
Side-by-side analysis of two or more entities/concepts.
```yaml
type: comparison
```

### Overview
Single page synthesizing the entire wiki scope. Updated on every ingest.
```yaml
type: overview
```

### Analysis
Filed query results, investigations, findings worth preserving.
```yaml
type: analysis
```

## Frontmatter Conventions

All pages use YAML frontmatter:
- `type`: one of the page types above
- `tags`: list of keyword tags
- `sources`: list of source slugs that contributed to this page
- `created`: ISO 8601 timestamp
- `updated`: ISO 8601 timestamp
- `source_count`: number of sources referenced

## Cross-Referencing

Use `[[wikilinks]]` for cross-references (Obsidian-native format).
- Entity names: `[[entity-slug]]`
- Concept names: `[[concept-slug]]`
- Source summaries: `[[source-slug]]`

## Callouts

- Contradictions: `> [!contradiction]` — conflicting claims
- Stale content: `> [!stale]` — superseded by newer sources

## Domain Vocabulary

Use OMOP standard concept names and vocabulary codes (SNOMED CT, ICD-10,
RxNorm, LOINC) where applicable. Prefer standard terminology over colloquial.

## Model

Default LLM: ii-medical:8b-q8 (configurable per workspace)
"""

INDEX_TEMPLATE = """# Wiki Index

## Overview
- [Overview](wiki/overview.md) | Wiki synthesis | 0 sources | —

## Entities

_(no entities yet)_

## Concepts

_(no concepts yet)_

## Sources

_(no sources yet)_

## Comparisons

_(no comparisons yet)_

## Analyses

_(no analyses yet)_
"""

LOG_TEMPLATE = """# Wiki Log

"""

OVERVIEW_TEMPLATE = """---
type: overview
tags: []
sources: []
created: "{timestamp}"
updated: "{timestamp}"
source_count: 0
---
# Overview

This wiki has no sources yet. Ingest a source to begin building the knowledge base.
"""


def _run_git(wiki_dir: str, args: list[str]) -> subprocess.CompletedProcess[str]:
    """Run a git command in the wiki directory."""
    return subprocess.run(
        ["git"] + args,
        cwd=wiki_dir,
        capture_output=True,
        text=True,
        check=True,
    )


def init_wiki_repo(wiki_dir: str) -> None:
    """Initialize the wiki git repo with platform workspace structure.

    Idempotent — safe to call multiple times.
    """
    wiki_path = Path(wiki_dir)
    git_dir = wiki_path / ".git"

    if git_dir.is_dir():
        return  # already initialized

    # Init git repo
    _run_git(wiki_dir, ["init", "-b", "main"])
    _run_git(wiki_dir, ["config", "user.email", "wiki-engine@parthenon.local"])
    _run_git(wiki_dir, ["config", "user.name", "Parthenon Wiki Engine"])

    # Create global schema
    schema_path = wiki_path / "SCHEMA.md"
    schema_path.write_text(SCHEMA_TEMPLATE)

    # Create platform workspace structure
    platform = wiki_path / "platform"
    for subdir in [
        "sources",
        "wiki/entities",
        "wiki/concepts",
        "wiki/comparisons",
        "wiki/analyses",
    ]:
        (platform / subdir).mkdir(parents=True, exist_ok=True)

    # Create index, log, overview
    (platform / "index.md").write_text(INDEX_TEMPLATE)
    (platform / "log.md").write_text(LOG_TEMPLATE)

    from datetime import datetime, timezone

    timestamp = datetime.now(timezone.utc).isoformat()
    (platform / "wiki" / "overview.md").write_text(
        OVERVIEW_TEMPLATE.replace("{timestamp}", timestamp)
    )

    # Create placeholder dirs for studies and personal
    (wiki_path / "studies").mkdir(exist_ok=True)
    (wiki_path / "studies" / ".gitkeep").touch()
    (wiki_path / "personal").mkdir(exist_ok=True)
    (wiki_path / "personal" / ".gitkeep").touch()

    # Initial commit
    _run_git(wiki_dir, ["add", "-A"])
    _run_git(wiki_dir, ["commit", "-m", "wiki: initialize wiki repository"])


def wiki_commit(wiki_dir: str, message: str, files: list[str]) -> None:
    """Stage specific files and commit with the given message."""
    for f in files:
        _run_git(wiki_dir, ["add", f])
    _run_git(wiki_dir, ["commit", "-m", message])


def create_workspace_branch(wiki_dir: str, branch_name: str) -> None:
    """Create a new branch from main for a study or personal workspace."""
    _run_git(wiki_dir, ["branch", branch_name, "main"])


def delete_workspace_branch(wiki_dir: str, branch_name: str) -> None:
    """Delete a workspace branch."""
    current = get_current_branch(wiki_dir)
    if current == branch_name:
        _run_git(wiki_dir, ["checkout", "main"])
    _run_git(wiki_dir, ["branch", "-D", branch_name])


def list_branches(wiki_dir: str) -> list[str]:
    """List all branches in the wiki repo."""
    result = _run_git(wiki_dir, ["branch", "--list", "--format=%(refname:short)"])
    return [b.strip() for b in result.stdout.strip().split("\n") if b.strip()]


def get_current_branch(wiki_dir: str) -> str:
    """Get the current branch name."""
    result = _run_git(wiki_dir, ["rev-parse", "--abbrev-ref", "HEAD"])
    return result.stdout.strip()


def switch_branch(wiki_dir: str, branch_name: str) -> None:
    """Switch to a different branch."""
    _run_git(wiki_dir, ["checkout", branch_name])
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd ai && python -m pytest tests/wiki/test_git_ops.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 7: Commit**

```bash
git add ai/app/wiki/__init__.py ai/app/wiki/git_ops.py ai/tests/wiki/__init__.py ai/tests/wiki/test_git_ops.py docker-compose.yml .gitignore
git commit -m "feat: wiki engine git operations and Docker volume setup"
```

---

## Task 2: Index and Log Operations

**Files:**
- Create: `ai/app/wiki/index_ops.py`
- Create: `ai/app/wiki/log_ops.py`
- Create: `ai/tests/wiki/test_index_ops.py`
- Create: `ai/tests/wiki/test_log_ops.py`

- [ ] **Step 1: Write failing tests for index_ops**

```python
# ai/tests/wiki/test_index_ops.py
import os
import tempfile
import pytest
from app.wiki.index_ops import (
    parse_index,
    search_index,
    add_index_entry,
    update_index_entry,
    render_index,
    IndexEntry,
)


@pytest.fixture
def index_content() -> str:
    return """# Wiki Index

## Overview
- [Overview](wiki/overview.md) | Wiki synthesis | 0 sources | —

## Entities
- [SynPUF Source](wiki/entities/synpuf-source.md) | CMS SynPUF 2.3M patient synthetic dataset | 2 sources | 2026-04-05

## Concepts
- [Data Quality Patterns](wiki/concepts/data-quality-patterns.md) | Common DQD failure patterns across CDM sources | 1 source | 2026-04-05

## Sources
- [DQD Report - SynPUF 2026-04-05](sources/dqd-synpuf-2026-04-05.md) | Data quality dashboard results for SynPUF | 2026-04-05

## Comparisons

_(no comparisons yet)_

## Analyses

_(no analyses yet)_
"""


def test_parse_index(index_content: str):
    entries = parse_index(index_content)
    assert len(entries) == 4  # overview + synpuf + dq patterns + dqd source
    entity = next(e for e in entries if e.slug == "wiki/entities/synpuf-source.md")
    assert entity.title == "SynPUF Source"
    assert entity.summary == "CMS SynPUF 2.3M patient synthetic dataset"
    assert entity.category == "entities"


def test_search_index(index_content: str):
    entries = parse_index(index_content)
    results = search_index(entries, "synpuf")
    assert len(results) >= 2  # entity + source both mention synpuf
    results2 = search_index(entries, "data quality")
    assert any(e.slug == "wiki/concepts/data-quality-patterns.md" for e in results2)


def test_search_index_no_results(index_content: str):
    entries = parse_index(index_content)
    results = search_index(entries, "nonexistent-term-xyz")
    assert len(results) == 0


def test_add_index_entry(index_content: str):
    entries = parse_index(index_content)
    new_entry = IndexEntry(
        title="Achilles - Acumenus",
        slug="sources/achilles-acumenus-2026-04-01.md",
        summary="Achilles characterization of Acumenus 1M CDM",
        category="sources",
        date="2026-04-01",
    )
    updated = add_index_entry(entries, new_entry)
    sources = [e for e in updated if e.category == "sources"]
    assert len(sources) == 2


def test_update_index_entry(index_content: str):
    entries = parse_index(index_content)
    updated = update_index_entry(
        entries,
        "wiki/entities/synpuf-source.md",
        summary="Updated summary for SynPUF",
        date="2026-04-06",
    )
    entry = next(e for e in updated if e.slug == "wiki/entities/synpuf-source.md")
    assert entry.summary == "Updated summary for SynPUF"
    assert entry.date == "2026-04-06"


def test_render_index(index_content: str):
    entries = parse_index(index_content)
    rendered = render_index(entries)
    assert "# Wiki Index" in rendered
    assert "## Entities" in rendered
    assert "[SynPUF Source]" in rendered
    assert "_(no comparisons yet)_" in rendered
```

- [ ] **Step 2: Write failing tests for log_ops**

```python
# ai/tests/wiki/test_log_ops.py
import os
import tempfile
from app.wiki.log_ops import append_log_entry, read_log, read_recent_entries, LogEntry


def test_append_log_entry():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("# Wiki Log\n\n")
        log_path = f.name

    try:
        entry = LogEntry(
            operation="ingest",
            title="DQD Report - SynPUF",
            source_path="sources/dqd-synpuf-2026-04-05.md",
            pages_created=["wiki/entities/synpuf-source.md"],
            pages_updated=["wiki/overview.md"],
            summary="SynPUF DQD run shows 12 plausibility failures.",
        )
        append_log_entry(log_path, entry)
        content = open(log_path).read()
        assert "ingest | DQD Report - SynPUF" in content
        assert "pages_created" in content.lower() or "Pages created" in content
    finally:
        os.unlink(log_path)


def test_read_recent_entries():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("""# Wiki Log

## [2026-04-05T10:00:00Z] ingest | First Source
- Source: sources/first.md
- Pages created: wiki/entities/first.md
- Summary: First source ingested.

## [2026-04-05T11:00:00Z] ingest | Second Source
- Source: sources/second.md
- Pages created: wiki/entities/second.md
- Summary: Second source ingested.

## [2026-04-05T12:00:00Z] query | What about drugs?
- Pages read: wiki/entities/first.md, wiki/entities/second.md
- Summary: Answered question about drug exposure.
""")
        log_path = f.name

    try:
        entries = read_recent_entries(log_path, count=2)
        assert len(entries) == 2
        assert "Second Source" in entries[0]
        assert "What about drugs?" in entries[1]
    finally:
        os.unlink(log_path)


def test_read_log():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("# Wiki Log\n\nSome content here.\n")
        log_path = f.name

    try:
        content = read_log(log_path)
        assert "# Wiki Log" in content
    finally:
        os.unlink(log_path)
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ai && python -m pytest tests/wiki/test_index_ops.py tests/wiki/test_log_ops.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: Implement index_ops.py**

```python
# ai/app/wiki/index_ops.py
"""Index operations for the wiki engine — parse, search, update, render."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class IndexEntry:
    """A single entry in the wiki index."""

    title: str
    slug: str
    summary: str
    category: str  # entities, concepts, sources, comparisons, analyses, overview
    date: str = ""

    def matches(self, query: str) -> bool:
        """Case-insensitive keyword match against title and summary."""
        q = query.lower()
        return q in self.title.lower() or q in self.summary.lower()


# Pattern: - [Title](slug) | summary | N sources | date
_ENTRY_RE = re.compile(
    r"^- \[(.+?)\]\((.+?)\)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$"
)

_CATEGORY_MAP = {
    "## Overview": "overview",
    "## Entities": "entities",
    "## Concepts": "concepts",
    "## Sources": "sources",
    "## Comparisons": "comparisons",
    "## Analyses": "analyses",
}


def parse_index(content: str) -> list[IndexEntry]:
    """Parse index.md content into structured entries."""
    entries: list[IndexEntry] = []
    current_category = ""

    for line in content.splitlines():
        stripped = line.strip()

        # Detect category headers
        if stripped in _CATEGORY_MAP:
            current_category = _CATEGORY_MAP[stripped]
            continue

        # Parse entry lines
        match = _ENTRY_RE.match(stripped)
        if match and current_category:
            title, slug, summary, _source_info, date = match.groups()
            entries.append(
                IndexEntry(
                    title=title.strip(),
                    slug=slug.strip(),
                    summary=summary.strip(),
                    category=current_category,
                    date=date.strip(),
                )
            )

    return entries


def search_index(entries: list[IndexEntry], query: str) -> list[IndexEntry]:
    """Search index entries by keyword match on title and summary."""
    return [e for e in entries if e.matches(query)]


def add_index_entry(
    entries: list[IndexEntry], new_entry: IndexEntry
) -> list[IndexEntry]:
    """Add a new entry to the index. Returns updated list."""
    return [*entries, new_entry]


def update_index_entry(
    entries: list[IndexEntry],
    slug: str,
    summary: str | None = None,
    date: str | None = None,
) -> list[IndexEntry]:
    """Update an existing entry's summary and/or date. Returns updated list."""
    updated: list[IndexEntry] = []
    for entry in entries:
        if entry.slug == slug:
            changes: dict[str, str] = {}
            if summary is not None:
                changes["summary"] = summary
            if date is not None:
                changes["date"] = date
            updated.append(replace(entry, **changes))
        else:
            updated.append(entry)
    return updated


def render_index(entries: list[IndexEntry]) -> str:
    """Render the full index.md content from structured entries."""
    sections: dict[str, list[str]] = {
        "overview": [],
        "entities": [],
        "concepts": [],
        "sources": [],
        "comparisons": [],
        "analyses": [],
    }

    for entry in entries:
        # Reconstruct the source_info field (simplified)
        source_info = f"{entry.date}" if entry.date else "—"
        line = f"- [{entry.title}]({entry.slug}) | {entry.summary} | {source_info}"
        sections.setdefault(entry.category, []).append(line)

    lines = ["# Wiki Index", ""]

    category_labels = [
        ("overview", "Overview"),
        ("entities", "Entities"),
        ("concepts", "Concepts"),
        ("sources", "Sources"),
        ("comparisons", "Comparisons"),
        ("analyses", "Analyses"),
    ]

    for key, label in category_labels:
        lines.append(f"## {label}")
        if sections[key]:
            for item in sections[key]:
                lines.append(item)
        else:
            lines.append(f"\n_(no {key} yet)_")
        lines.append("")

    return "\n".join(lines)
```

- [ ] **Step 5: Implement log_ops.py**

```python
# ai/app/wiki/log_ops.py
"""Log operations for the wiki engine — append entries, read history."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class LogEntry:
    """A single log entry for a wiki operation."""

    operation: str  # ingest, query, lint, maintain
    title: str
    source_path: str = ""
    pages_created: list[str] = field(default_factory=list)
    pages_updated: list[str] = field(default_factory=list)
    pages_read: list[str] = field(default_factory=list)
    summary: str = ""
    timestamp: str = ""

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def append_log_entry(log_path: str, entry: LogEntry) -> None:
    """Append a formatted log entry to log.md."""
    lines = [
        f"## [{entry.timestamp}] {entry.operation} | {entry.title}",
    ]
    if entry.source_path:
        lines.append(f"- Source: {entry.source_path}")
    if entry.pages_created:
        lines.append(f"- Pages created: {', '.join(entry.pages_created)}")
    if entry.pages_updated:
        lines.append(f"- Pages updated: {', '.join(entry.pages_updated)}")
    if entry.pages_read:
        lines.append(f"- Pages read: {', '.join(entry.pages_read)}")
    if entry.summary:
        lines.append(f"- Summary: {entry.summary}")
    lines.append("")

    with open(log_path, "a") as f:
        f.write("\n".join(lines) + "\n")


def read_log(log_path: str) -> str:
    """Read the full log file content."""
    with open(log_path) as f:
        return f.read()


_ENTRY_HEADER_RE = re.compile(r"^## \[.+?\] .+$")


def read_recent_entries(log_path: str, count: int = 5) -> list[str]:
    """Read the N most recent log entries as raw text blocks."""
    content = read_log(log_path)
    entries: list[str] = []
    current_lines: list[str] = []

    for line in content.splitlines():
        if _ENTRY_HEADER_RE.match(line):
            if current_lines:
                entries.append("\n".join(current_lines))
            current_lines = [line]
        elif current_lines:
            current_lines.append(line)

    if current_lines:
        entries.append("\n".join(current_lines))

    return entries[-count:]
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd ai && python -m pytest tests/wiki/test_index_ops.py tests/wiki/test_log_ops.py -v
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add ai/app/wiki/index_ops.py ai/app/wiki/log_ops.py ai/tests/wiki/test_index_ops.py ai/tests/wiki/test_log_ops.py
git commit -m "feat: wiki index and log operations with tests"
```

---

## Task 3: Prompt Templates

**Files:**
- Create: `ai/app/wiki/prompts.py`
- Create: `ai/tests/wiki/test_prompts.py`

- [ ] **Step 1: Write failing tests for prompt generation**

```python
# ai/tests/wiki/test_prompts.py
from app.wiki.prompts import (
    build_extract_prompt,
    build_update_entity_prompt,
    build_update_concept_prompt,
    build_update_overview_prompt,
    build_query_relevance_prompt,
    build_query_answer_prompt,
    build_lint_batch_prompt,
)


def test_build_extract_prompt():
    schema = "## Page Types\n### Entity Page\n..."
    source = "# DQD Report\nSynPUF has 12 failures."
    prompt = build_extract_prompt(schema, source)
    assert "entities" in prompt.lower()
    assert "concepts" in prompt.lower()
    assert "JSON" in prompt
    assert "SynPUF" in prompt


def test_build_update_entity_prompt_new():
    schema = "## Frontmatter Conventions\n..."
    facts = "SynPUF is a CMS synthetic dataset with 2.3M patients."
    prompt = build_update_entity_prompt(
        schema=schema,
        entity_name="SynPUF Source",
        existing_page=None,
        new_facts=facts,
        source_slug="dqd-synpuf-2026-04-05",
    )
    assert "SynPUF Source" in prompt
    assert "dqd-synpuf-2026-04-05" in prompt
    assert "new entity page" in prompt.lower() or "create" in prompt.lower()


def test_build_update_entity_prompt_existing():
    schema = "## Frontmatter Conventions\n..."
    existing = "---\ntype: entity\n---\n# SynPUF Source\nOld content."
    facts = "New DQD run found 12 failures."
    prompt = build_update_entity_prompt(
        schema=schema,
        entity_name="SynPUF Source",
        existing_page=existing,
        new_facts=facts,
        source_slug="dqd-synpuf-2026-04-05",
    )
    assert "existing" in prompt.lower() or "update" in prompt.lower()
    assert "Old content" in prompt
    assert "12 failures" in prompt


def test_build_update_overview_prompt():
    schema = "## Page Types\n### Overview\n..."
    current = "# Overview\nOld synthesis."
    changes = "Added SynPUF entity. Added data quality concept."
    prompt = build_update_overview_prompt(schema, current, changes)
    assert "Overview" in prompt
    assert "Old synthesis" in prompt
    assert "SynPUF" in prompt


def test_build_query_relevance_prompt():
    index = "## Entities\n- [SynPUF](wiki/entities/synpuf.md) | Synthetic dataset"
    question = "What data quality issues exist?"
    prompt = build_query_relevance_prompt(index, question)
    assert "data quality" in prompt.lower()
    assert "SynPUF" in prompt
    assert "JSON" in prompt


def test_build_query_answer_prompt():
    pages = {"synpuf.md": "# SynPUF\n12 failures found."}
    question = "What data quality issues exist?"
    prompt = build_query_answer_prompt(pages, question)
    assert "data quality" in prompt.lower()
    assert "12 failures" in prompt
    assert "[[" in prompt or "wikilink" in prompt.lower()


def test_build_lint_batch_prompt():
    pages = {
        "entities/synpuf.md": "# SynPUF\nReferences [[nonexistent-page]].",
        "concepts/dq.md": "# Data Quality\nNo cross-references.",
    }
    prompt = build_lint_batch_prompt(pages)
    assert "contradiction" in prompt.lower() or "orphan" in prompt.lower()
    assert "nonexistent-page" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ai && python -m pytest tests/wiki/test_prompts.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement prompts.py**

```python
# ai/app/wiki/prompts.py
"""Prompt templates for the wiki engine's Ollama calls.

Each function builds a single-task prompt with structured output expectations.
The schema excerpt is included in every prompt so the 8B model follows
conventions from context, not memorized patterns.
"""

from __future__ import annotations


def build_extract_prompt(schema_excerpt: str, source_content: str) -> str:
    """Build prompt to extract entities, concepts, and facts from a source.

    Expected output: JSON with keys 'entities', 'concepts', 'facts'.
    """
    return f"""You are a wiki maintenance assistant. Read the source document below
and extract structured information.

SCHEMA CONVENTIONS:
{schema_excerpt}

SOURCE DOCUMENT:
{source_content}

Extract the following as JSON:
{{
  "entities": [
    {{"name": "Entity Name", "facts": ["fact 1", "fact 2"]}}
  ],
  "concepts": [
    {{"name": "Concept Name", "facts": ["fact 1", "fact 2"]}}
  ],
  "summary": "2-3 sentence summary of the source"
}}

Rules:
- Entities are concrete things: datasets, drugs, conditions, cohorts, studies, tools.
- Concepts are abstract themes: patterns, methodologies, quality issues, research approaches.
- Facts are specific claims from the source, each 1-2 sentences.
- Use precise medical/clinical terminology per the schema conventions.
- Return ONLY valid JSON, no other text."""


def build_update_entity_prompt(
    schema: str,
    entity_name: str,
    existing_page: str | None,
    new_facts: str,
    source_slug: str,
) -> str:
    """Build prompt to create or update an entity page."""
    if existing_page:
        instruction = f"""Update this existing entity page by incorporating the new facts.
Preserve all existing content. Add new facts under ## Key Facts with
[[{source_slug}]] citation. Update the ## Summary if the new facts
change the overall picture. Add any new [[wikilinks]] to related entities
or concepts under ## Cross-References.

EXISTING PAGE:
{existing_page}"""
    else:
        instruction = f"""Create a new entity page for "{entity_name}".
Use [[{source_slug}]] as the citation for all facts."""

    return f"""You are a wiki maintenance assistant. {instruction}

SCHEMA CONVENTIONS:
{schema}

NEW FACTS FROM SOURCE [[{source_slug}]]:
{new_facts}

Produce the complete page in this exact markdown format:
---
type: entity
tags: [relevant, tags]
sources: ["{source_slug}"]
created: "{{current_timestamp}}"
updated: "{{current_timestamp}}"
source_count: 1
---
# {entity_name}

## Summary
2-3 sentence overview of this entity.

## Key Facts
- Fact 1 ([[{source_slug}]])
- Fact 2 ([[{source_slug}]])

## Cross-References
- [[related-entity-or-concept]]

Return ONLY the complete markdown page, nothing else."""


def build_update_concept_prompt(
    schema: str,
    concept_name: str,
    existing_page: str | None,
    new_facts: str,
    source_slug: str,
) -> str:
    """Build prompt to create or update a concept page."""
    if existing_page:
        instruction = f"""Update this existing concept page by incorporating the new facts.
Preserve all existing content. Add new facts with [[{source_slug}]] citation.

EXISTING PAGE:
{existing_page}"""
    else:
        instruction = f"""Create a new concept page for "{concept_name}".
Use [[{source_slug}]] as the citation for all facts."""

    return f"""You are a wiki maintenance assistant. {instruction}

SCHEMA CONVENTIONS:
{schema}

NEW FACTS FROM SOURCE [[{source_slug}]]:
{new_facts}

Produce the complete page in this exact markdown format:
---
type: concept
tags: [relevant, tags]
sources: ["{source_slug}"]
created: "{{current_timestamp}}"
updated: "{{current_timestamp}}"
source_count: 1
---
# {concept_name}

## Summary
2-3 sentence overview of this concept and its significance.

## Key Insights
- Insight 1 ([[{source_slug}]])
- Insight 2 ([[{source_slug}]])

## Cross-References
- [[related-entity-or-concept]]

Return ONLY the complete markdown page, nothing else."""


def build_update_overview_prompt(
    schema: str,
    current_overview: str,
    changes_summary: str,
) -> str:
    """Build prompt to update the overview page after an ingest."""
    return f"""You are a wiki maintenance assistant. Update the overview page to
reflect recent changes to the wiki.

SCHEMA CONVENTIONS:
{schema}

CURRENT OVERVIEW:
{current_overview}

RECENT CHANGES:
{changes_summary}

Produce an updated overview page. Keep the same markdown format with
YAML frontmatter (type: overview). Incorporate the new information into
the synthesis. Update source_count in the frontmatter. Use [[wikilinks]]
to reference entity and concept pages.

Return ONLY the complete markdown page, nothing else."""


def build_query_relevance_prompt(index_content: str, question: str) -> str:
    """Build prompt to identify relevant pages from the index for a query."""
    return f"""You are a wiki search assistant. Given a question and a wiki index,
identify which pages are most relevant to answering the question.

WIKI INDEX:
{index_content}

QUESTION: {question}

Return a JSON array of the most relevant page slugs (up to 5), ordered by
relevance. Example:
["wiki/entities/synpuf-source.md", "wiki/concepts/data-quality-patterns.md"]

Return ONLY valid JSON, no other text."""


def build_query_answer_prompt(
    pages: dict[str, str],
    question: str,
) -> str:
    """Build prompt to answer a question using wiki pages as context."""
    pages_text = ""
    for slug, content in pages.items():
        pages_text += f"\n--- PAGE: {slug} ---\n{content}\n"

    return f"""You are a wiki knowledge assistant. Answer the question using ONLY
the wiki pages provided below. Cite your sources using [[wikilinks]] to
the page slugs.

WIKI PAGES:
{pages_text}

QUESTION: {question}

Rules:
- Use only information from the provided pages.
- Cite every claim with a [[page-slug]] wikilink.
- If the pages don't contain enough information, say so explicitly.
- Format your answer as clean markdown.

ANSWER:"""


def build_lint_batch_prompt(pages: dict[str, str]) -> str:
    """Build prompt to lint a batch of wiki pages for issues."""
    pages_text = ""
    for slug, content in pages.items():
        pages_text += f"\n--- PAGE: {slug} ---\n{content}\n"

    return f"""You are a wiki quality checker. Review the batch of wiki pages below
and identify any issues.

PAGES:
{pages_text}

Check for:
1. Contradictions — conflicting claims across pages
2. Orphan pages — pages with no inbound [[wikilinks]] from other pages
3. Missing pages — [[wikilinks]] that point to pages not in this batch
4. Stale content — claims that appear outdated
5. Gaps — important concepts mentioned but lacking their own page

Return a JSON array of issues. Example:
[
  {{"type": "missing_page", "page": "entities/synpuf.md", "detail": "References [[nonexistent-page]] which does not exist"}},
  {{"type": "orphan", "page": "concepts/old-topic.md", "detail": "No other page links to this page"}}
]

If no issues found, return an empty array: []
Return ONLY valid JSON, no other text."""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ai && python -m pytest tests/wiki/test_prompts.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add ai/app/wiki/prompts.py ai/tests/wiki/test_prompts.py
git commit -m "feat: wiki engine prompt templates for Ollama"
```

---

## Task 4: Pydantic Models & Wiki Engine Core

**Files:**
- Create: `ai/app/wiki/models.py`
- Create: `ai/app/wiki/engine.py`
- Create: `ai/tests/wiki/test_engine.py`

- [ ] **Step 1: Write Pydantic models**

```python
# ai/app/wiki/models.py
"""Pydantic request/response models for wiki API endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WikiWorkspace(BaseModel):
    """A wiki workspace."""

    name: str
    workspace_type: str  # platform, study, personal
    workspace_id: str  # "platform", study UUID, or user ID
    branch: str
    page_count: int = 0
    source_count: int = 0


class WikiPageSummary(BaseModel):
    """Summary of a wiki page from the index."""

    title: str
    slug: str
    summary: str
    category: str
    date: str = ""


class WikiPage(BaseModel):
    """Full wiki page content."""

    title: str
    slug: str
    content: str
    frontmatter: dict[str, object] = Field(default_factory=dict)


class WikiLogEntry(BaseModel):
    """A single log entry."""

    raw: str


class IngestRequest(BaseModel):
    """Request to ingest a source."""

    workspace: str = "platform"  # "platform", "study:{id}", "personal:{id}"
    source_filename: str  # filename in sources/ dir
    source_content: str | None = None  # if provided, write to sources/ first


class IngestResponse(BaseModel):
    """Response from an ingest operation."""

    status: str  # "completed", "pending_review", "error"
    source_slug: str
    pages_created: list[str] = Field(default_factory=list)
    pages_updated: list[str] = Field(default_factory=list)
    summary: str = ""
    error: str | None = None


class QueryRequest(BaseModel):
    """Request to query the wiki."""

    workspace: str = "platform"
    question: str
    top_n: int = 5


class QueryResponse(BaseModel):
    """Response from a query operation."""

    answer: str
    pages_consulted: list[str] = Field(default_factory=list)
    can_file: bool = True


class FileAnswerRequest(BaseModel):
    """Request to file a query answer as a wiki page."""

    workspace: str = "platform"
    title: str
    answer_content: str


class LintRequest(BaseModel):
    """Request to lint a workspace."""

    workspace: str = "platform"
    auto_fix: bool = False
    batch_size: int = 10


class LintIssue(BaseModel):
    """A single lint issue."""

    issue_type: str  # contradiction, orphan, missing_page, stale, gap
    page: str
    detail: str
    fixed: bool = False


class LintResponse(BaseModel):
    """Response from a lint operation."""

    issues: list[LintIssue] = Field(default_factory=list)
    fixed_count: int = 0


class MaintainRequest(BaseModel):
    """Request for maintenance operations."""

    workspace: str = "platform"
    operation: str  # reindex, compact, prune


class MaintainResponse(BaseModel):
    """Response from a maintenance operation."""

    status: str
    detail: str = ""
```

- [ ] **Step 2: Write failing test for engine core**

```python
# ai/tests/wiki/test_engine.py
"""Integration tests for the wiki engine.

These tests use a temporary wiki directory and mock Ollama responses.
"""

import json
import os
import tempfile
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from app.wiki.engine import WikiEngine
from app.wiki.git_ops import init_wiki_repo


@pytest.fixture
def wiki_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        init_wiki_repo(tmpdir)
        yield tmpdir


@pytest.fixture
def engine(wiki_dir: str):
    return WikiEngine(wiki_dir=wiki_dir)


def _mock_ollama_response(content: str):
    """Create a mock httpx response for Ollama."""
    mock = AsyncMock()
    mock.status_code = 200
    mock.json.return_value = {"response": content}
    return mock


@pytest.mark.asyncio
async def test_engine_ingest_creates_source_summary(wiki_dir: str, engine: WikiEngine):
    """Test that ingesting a source creates files in the wiki."""
    # Write a test source
    source_path = os.path.join(wiki_dir, "platform", "sources", "test-source.md")
    with open(source_path, "w") as f:
        f.write("---\nsource_type: external\ntitle: Test Source\n---\n# Test\nSome content about diabetes.\n")

    extract_response = json.dumps({
        "entities": [{"name": "Diabetes", "facts": ["Diabetes is a metabolic condition."]}],
        "concepts": [],
        "summary": "A source about diabetes.",
    })

    entity_page = """---
type: entity
tags: [diabetes]
sources: ["test-source"]
created: "2026-04-06T00:00:00Z"
updated: "2026-04-06T00:00:00Z"
source_count: 1
---
# Diabetes

## Summary
Diabetes is a metabolic condition.

## Key Facts
- Diabetes is a metabolic condition. ([[test-source]])

## Cross-References
"""

    overview_page = """---
type: overview
tags: []
sources: ["test-source"]
created: "2026-04-06T00:00:00Z"
updated: "2026-04-06T00:00:00Z"
source_count: 1
---
# Overview

This wiki covers diabetes.
"""

    with patch("app.wiki.engine.WikiEngine._call_ollama") as mock_ollama:
        mock_ollama.side_effect = [
            extract_response,   # Step 1: extract
            entity_page,        # Step 2: entity page
            overview_page,      # Step 3: overview
        ]

        result = await engine.ingest("platform", "test-source.md")

    assert result.status == "completed"
    assert "test-source" in result.source_slug
    assert len(result.pages_created) >= 1

    # Verify entity page was written
    entity_file = os.path.join(wiki_dir, "platform", "wiki", "entities", "diabetes.md")
    assert os.path.isfile(entity_file)


@pytest.mark.asyncio
async def test_engine_query_returns_answer(wiki_dir: str, engine: WikiEngine):
    """Test that querying the wiki returns an answer."""
    # Pre-populate a wiki page
    entity_dir = os.path.join(wiki_dir, "platform", "wiki", "entities")
    with open(os.path.join(entity_dir, "diabetes.md"), "w") as f:
        f.write("# Diabetes\nDiabetes affects blood sugar levels.\n")

    # Update index to include the page
    index_path = os.path.join(wiki_dir, "platform", "index.md")
    with open(index_path, "w") as f:
        f.write("""# Wiki Index

## Overview
- [Overview](wiki/overview.md) | Wiki synthesis | 0 sources | —

## Entities
- [Diabetes](wiki/entities/diabetes.md) | Metabolic condition | 1 source | 2026-04-06

## Concepts

_(no concepts yet)_

## Sources

_(no sources yet)_

## Comparisons

_(no comparisons yet)_

## Analyses

_(no analyses yet)_
""")

    relevance_response = json.dumps(["wiki/entities/diabetes.md"])
    answer_response = "Diabetes affects blood sugar levels. ([[diabetes]])"

    with patch("app.wiki.engine.WikiEngine._call_ollama") as mock_ollama:
        mock_ollama.side_effect = [
            relevance_response,  # Step 1: relevance
            answer_response,     # Step 2: answer
        ]

        result = await engine.query("platform", "What is diabetes?")

    assert "diabetes" in result.answer.lower() or "blood sugar" in result.answer.lower()
    assert len(result.pages_consulted) >= 1
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ai && python -m pytest tests/wiki/test_engine.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.wiki.engine'`

- [ ] **Step 4: Implement engine.py**

```python
# ai/app/wiki/engine.py
"""Core wiki engine — orchestrates ingest, query, lint, and maintain operations."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.config import settings
from app.wiki.git_ops import init_wiki_repo, switch_branch, wiki_commit
from app.wiki.index_ops import (
    IndexEntry,
    add_index_entry,
    parse_index,
    render_index,
    search_index,
    update_index_entry,
)
from app.wiki.log_ops import LogEntry, append_log_entry
from app.wiki.models import (
    IngestResponse,
    LintIssue,
    LintResponse,
    MaintainResponse,
    QueryResponse,
    WikiLogEntry,
    WikiPage,
    WikiPageSummary,
    WikiWorkspace,
)
from app.wiki.prompts import (
    build_extract_prompt,
    build_lint_batch_prompt,
    build_query_answer_prompt,
    build_query_relevance_prompt,
    build_update_concept_prompt,
    build_update_entity_prompt,
    build_update_overview_prompt,
)

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    """Convert a name to a filesystem-safe slug."""
    return _SLUG_RE.sub("-", name.lower()).strip("-")


class WikiEngine:
    """Orchestrates all wiki operations for a wiki repository."""

    def __init__(self, wiki_dir: str = "/data/wiki") -> None:
        self.wiki_dir = wiki_dir
        init_wiki_repo(wiki_dir)

    def _workspace_path(self, workspace: str) -> str:
        """Resolve workspace string to filesystem path."""
        if workspace == "platform":
            return os.path.join(self.wiki_dir, "platform")
        if workspace.startswith("study:"):
            study_id = workspace.split(":", 1)[1]
            return os.path.join(self.wiki_dir, "studies", study_id)
        if workspace.startswith("personal:"):
            user_id = workspace.split(":", 1)[1]
            return os.path.join(self.wiki_dir, "personal", user_id)
        return os.path.join(self.wiki_dir, "platform")

    def _read_schema(self) -> str:
        """Read the global SCHEMA.md."""
        schema_path = os.path.join(self.wiki_dir, "SCHEMA.md")
        if os.path.isfile(schema_path):
            return Path(schema_path).read_text()
        return ""

    def _read_file(self, path: str) -> str:
        """Read a file, returning empty string if not found."""
        if os.path.isfile(path):
            return Path(path).read_text()
        return ""

    async def _call_ollama(self, prompt: str, json_mode: bool = False) -> str:
        """Call Ollama with a single-task prompt. Returns the response text."""
        payload: dict[str, object] = {
            "model": settings.ollama_model,
            "prompt": prompt,
            "stream": False,
        }
        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")

    # --- Workspace Management ---

    def list_workspaces(self) -> list[WikiWorkspace]:
        """List all wiki workspaces."""
        workspaces: list[WikiWorkspace] = []

        # Platform workspace always exists
        platform_path = os.path.join(self.wiki_dir, "platform")
        if os.path.isdir(platform_path):
            workspaces.append(
                WikiWorkspace(
                    name="Platform",
                    workspace_type="platform",
                    workspace_id="platform",
                    branch="main",
                    page_count=self._count_pages(platform_path),
                    source_count=self._count_sources(platform_path),
                )
            )

        # Study workspaces
        studies_dir = os.path.join(self.wiki_dir, "studies")
        if os.path.isdir(studies_dir):
            for study_id in os.listdir(studies_dir):
                study_path = os.path.join(studies_dir, study_id)
                if os.path.isdir(study_path) and study_id != ".gitkeep":
                    workspaces.append(
                        WikiWorkspace(
                            name=f"Study {study_id}",
                            workspace_type="study",
                            workspace_id=study_id,
                            branch=f"study/{study_id}",
                            page_count=self._count_pages(study_path),
                            source_count=self._count_sources(study_path),
                        )
                    )

        # Personal workspaces
        personal_dir = os.path.join(self.wiki_dir, "personal")
        if os.path.isdir(personal_dir):
            for user_id in os.listdir(personal_dir):
                user_path = os.path.join(personal_dir, user_id)
                if os.path.isdir(user_path) and user_id != ".gitkeep":
                    workspaces.append(
                        WikiWorkspace(
                            name=f"Personal {user_id}",
                            workspace_type="personal",
                            workspace_id=user_id,
                            branch=f"personal/{user_id}",
                            page_count=self._count_pages(user_path),
                            source_count=self._count_sources(user_path),
                        )
                    )

        return workspaces

    def _count_pages(self, workspace_path: str) -> int:
        wiki_dir = os.path.join(workspace_path, "wiki")
        if not os.path.isdir(wiki_dir):
            return 0
        count = 0
        for _root, _dirs, files in os.walk(wiki_dir):
            count += sum(1 for f in files if f.endswith(".md"))
        return count

    def _count_sources(self, workspace_path: str) -> int:
        sources_dir = os.path.join(workspace_path, "sources")
        if not os.path.isdir(sources_dir):
            return 0
        return sum(1 for f in os.listdir(sources_dir) if f.endswith(".md"))

    # --- Page Operations ---

    def list_pages(self, workspace: str) -> list[WikiPageSummary]:
        """List all pages in a workspace from the index."""
        ws_path = self._workspace_path(workspace)
        index_path = os.path.join(ws_path, "index.md")
        content = self._read_file(index_path)
        if not content:
            return []
        entries = parse_index(content)
        return [
            WikiPageSummary(
                title=e.title,
                slug=e.slug,
                summary=e.summary,
                category=e.category,
                date=e.date,
            )
            for e in entries
        ]

    def get_page(self, workspace: str, slug: str) -> WikiPage | None:
        """Read a single wiki page by slug."""
        ws_path = self._workspace_path(workspace)
        page_path = os.path.join(ws_path, slug)
        content = self._read_file(page_path)
        if not content:
            return None

        # Extract frontmatter
        frontmatter: dict[str, object] = {}
        title = slug.rsplit("/", 1)[-1].replace(".md", "").replace("-", " ").title()

        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                import yaml

                try:
                    frontmatter = yaml.safe_load(parts[1]) or {}
                except Exception:
                    pass
                content_body = parts[2].strip()
            else:
                content_body = content
        else:
            content_body = content

        # Extract title from first H1
        for line in content_body.splitlines():
            if line.startswith("# "):
                title = line[2:].strip()
                break

        return WikiPage(
            title=title,
            slug=slug,
            content=content,
            frontmatter=frontmatter,
        )

    def get_log(self, workspace: str) -> list[WikiLogEntry]:
        """Read log entries for a workspace."""
        ws_path = self._workspace_path(workspace)
        log_path = os.path.join(ws_path, "log.md")
        content = self._read_file(log_path)
        if not content:
            return []

        from app.wiki.log_ops import read_recent_entries

        raw_entries = read_recent_entries(log_path, count=50)
        return [WikiLogEntry(raw=e) for e in raw_entries]

    def list_sources(self, workspace: str) -> list[str]:
        """List source filenames in a workspace."""
        ws_path = self._workspace_path(workspace)
        sources_dir = os.path.join(ws_path, "sources")
        if not os.path.isdir(sources_dir):
            return []
        return sorted(f for f in os.listdir(sources_dir) if f.endswith(".md"))

    # --- Ingest ---

    async def ingest(self, workspace: str, source_filename: str) -> IngestResponse:
        """Ingest a source into the wiki. Main orchestration method."""
        ws_path = self._workspace_path(workspace)
        source_path = os.path.join(ws_path, "sources", source_filename)
        source_slug = source_filename.replace(".md", "")

        if not os.path.isfile(source_path):
            return IngestResponse(
                status="error",
                source_slug=source_slug,
                error=f"Source file not found: {source_path}",
            )

        schema = self._read_schema()
        source_content = Path(source_path).read_text()
        index_path = os.path.join(ws_path, "index.md")
        index_content = self._read_file(index_path)
        entries = parse_index(index_content) if index_content else []

        pages_created: list[str] = []
        pages_updated: list[str] = []
        all_touched_files: list[str] = [source_path]

        try:
            # Step 1: Extract entities, concepts, facts
            extract_prompt = build_extract_prompt(schema, source_content)
            extract_raw = await self._call_ollama(extract_prompt, json_mode=True)
            extracted = json.loads(extract_raw)

            # Step 2: Process entities
            for entity_data in extracted.get("entities", []):
                entity_name = entity_data["name"]
                entity_slug = _slugify(entity_name)
                entity_path = os.path.join(
                    ws_path, "wiki", "entities", f"{entity_slug}.md"
                )
                existing = self._read_file(entity_path)
                facts_text = "\n".join(
                    f"- {fact}" for fact in entity_data.get("facts", [])
                )

                prompt = build_update_entity_prompt(
                    schema=schema,
                    entity_name=entity_name,
                    existing_page=existing if existing else None,
                    new_facts=facts_text,
                    source_slug=source_slug,
                )
                page_content = await self._call_ollama(prompt)

                # Write page
                os.makedirs(os.path.dirname(entity_path), exist_ok=True)
                Path(entity_path).write_text(page_content)
                all_touched_files.append(entity_path)

                rel_path = f"wiki/entities/{entity_slug}.md"
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

                if existing:
                    entries = update_index_entry(entries, rel_path, date=now)
                    pages_updated.append(rel_path)
                else:
                    entries = add_index_entry(
                        entries,
                        IndexEntry(
                            title=entity_name,
                            slug=rel_path,
                            summary=facts_text[:80] if facts_text else entity_name,
                            category="entities",
                            date=now,
                        ),
                    )
                    pages_created.append(rel_path)

            # Step 3: Process concepts
            for concept_data in extracted.get("concepts", []):
                concept_name = concept_data["name"]
                concept_slug = _slugify(concept_name)
                concept_path = os.path.join(
                    ws_path, "wiki", "concepts", f"{concept_slug}.md"
                )
                existing = self._read_file(concept_path)
                facts_text = "\n".join(
                    f"- {fact}" for fact in concept_data.get("facts", [])
                )

                prompt = build_update_concept_prompt(
                    schema=schema,
                    concept_name=concept_name,
                    existing_page=existing if existing else None,
                    new_facts=facts_text,
                    source_slug=source_slug,
                )
                page_content = await self._call_ollama(prompt)

                os.makedirs(os.path.dirname(concept_path), exist_ok=True)
                Path(concept_path).write_text(page_content)
                all_touched_files.append(concept_path)

                rel_path = f"wiki/concepts/{concept_slug}.md"
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

                if existing:
                    entries = update_index_entry(entries, rel_path, date=now)
                    pages_updated.append(rel_path)
                else:
                    entries = add_index_entry(
                        entries,
                        IndexEntry(
                            title=concept_name,
                            slug=rel_path,
                            summary=facts_text[:80] if facts_text else concept_name,
                            category="concepts",
                            date=now,
                        ),
                    )
                    pages_created.append(rel_path)

            # Step 4: Update overview
            overview_path = os.path.join(ws_path, "wiki", "overview.md")
            current_overview = self._read_file(overview_path)
            changes = f"Ingested: {source_slug}. Created: {', '.join(pages_created)}. Updated: {', '.join(pages_updated)}."
            overview_prompt = build_update_overview_prompt(
                schema, current_overview, changes
            )
            new_overview = await self._call_ollama(overview_prompt)
            Path(overview_path).write_text(new_overview)
            all_touched_files.append(overview_path)
            pages_updated.append("wiki/overview.md")

            # Step 5: Add source to index
            summary = extracted.get("summary", f"Source: {source_slug}")
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            entries = add_index_entry(
                entries,
                IndexEntry(
                    title=source_slug.replace("-", " ").title(),
                    slug=f"sources/{source_filename}",
                    summary=summary[:80],
                    category="sources",
                    date=now,
                ),
            )

            # Step 6: Write updated index
            Path(index_path).write_text(render_index(entries))
            all_touched_files.append(index_path)

            # Step 7: Append to log
            log_path = os.path.join(ws_path, "log.md")
            log_entry = LogEntry(
                operation="ingest",
                title=source_slug.replace("-", " ").title(),
                source_path=f"sources/{source_filename}",
                pages_created=pages_created,
                pages_updated=pages_updated,
                summary=summary,
            )
            append_log_entry(log_path, log_entry)
            all_touched_files.append(log_path)

            # Step 8: Git commit
            wiki_commit(
                self.wiki_dir,
                f"wiki: ingest {source_slug}",
                all_touched_files,
            )

            return IngestResponse(
                status="completed",
                source_slug=source_slug,
                pages_created=pages_created,
                pages_updated=pages_updated,
                summary=summary,
            )

        except json.JSONDecodeError as e:
            logger.warning("Ollama returned malformed JSON during ingest: %s", e)
            return IngestResponse(
                status="pending_review",
                source_slug=source_slug,
                error=f"LLM returned malformed output: {e}",
            )
        except Exception as e:
            logger.exception("Ingest failed for %s", source_filename)
            return IngestResponse(
                status="error",
                source_slug=source_slug,
                error=str(e),
            )

    # --- Query ---

    async def query(
        self, workspace: str, question: str, top_n: int = 5
    ) -> QueryResponse:
        """Query the wiki and return an answer with citations."""
        ws_path = self._workspace_path(workspace)
        index_path = os.path.join(ws_path, "index.md")
        index_content = self._read_file(index_path)

        if not index_content:
            return QueryResponse(
                answer="This wiki has no content yet. Ingest a source to begin.",
                pages_consulted=[],
            )

        # Step 1: Find relevant pages via Ollama
        relevance_prompt = build_query_relevance_prompt(index_content, question)
        relevance_raw = await self._call_ollama(relevance_prompt, json_mode=True)

        try:
            relevant_slugs = json.loads(relevance_raw)
            if not isinstance(relevant_slugs, list):
                relevant_slugs = []
        except json.JSONDecodeError:
            # Fallback: keyword search
            entries = parse_index(index_content)
            keywords = question.lower().split()
            matched = set()
            for kw in keywords:
                for entry in search_index(entries, kw):
                    matched.add(entry.slug)
            relevant_slugs = list(matched)[:top_n]

        # Step 2: Read relevant pages
        pages: dict[str, str] = {}
        for slug in relevant_slugs[:top_n]:
            page_path = os.path.join(ws_path, slug)
            content = self._read_file(page_path)
            if content:
                pages[slug] = content

        if not pages:
            return QueryResponse(
                answer="No relevant pages found for your question.",
                pages_consulted=[],
            )

        # Step 3: Generate answer
        answer_prompt = build_query_answer_prompt(pages, question)
        answer = await self._call_ollama(answer_prompt)

        return QueryResponse(
            answer=answer,
            pages_consulted=list(pages.keys()),
        )

    # --- Lint ---

    async def lint(
        self, workspace: str, auto_fix: bool = False, batch_size: int = 10
    ) -> LintResponse:
        """Lint the wiki for issues."""
        ws_path = self._workspace_path(workspace)
        wiki_dir = os.path.join(ws_path, "wiki")
        if not os.path.isdir(wiki_dir):
            return LintResponse(issues=[], fixed_count=0)

        # Collect all wiki pages
        all_pages: dict[str, str] = {}
        for root, _dirs, files in os.walk(wiki_dir):
            for f in files:
                if f.endswith(".md"):
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, ws_path)
                    all_pages[rel_path] = Path(full_path).read_text()

        if not all_pages:
            return LintResponse(issues=[], fixed_count=0)

        # Process in batches
        all_issues: list[LintIssue] = []
        page_items = list(all_pages.items())

        for i in range(0, len(page_items), batch_size):
            batch = dict(page_items[i : i + batch_size])
            prompt = build_lint_batch_prompt(batch)
            raw = await self._call_ollama(prompt, json_mode=True)

            try:
                issues_data = json.loads(raw)
                if isinstance(issues_data, list):
                    for issue in issues_data:
                        all_issues.append(
                            LintIssue(
                                issue_type=issue.get("type", "unknown"),
                                page=issue.get("page", ""),
                                detail=issue.get("detail", ""),
                            )
                        )
            except json.JSONDecodeError:
                logger.warning("Lint: Ollama returned malformed JSON for batch")

        return LintResponse(issues=all_issues, fixed_count=0)

    # --- Maintain ---

    def maintain_reindex(self, workspace: str) -> MaintainResponse:
        """Rebuild index.md from filesystem scan."""
        ws_path = self._workspace_path(workspace)
        wiki_dir = os.path.join(ws_path, "wiki")
        entries: list[IndexEntry] = []

        # Scan overview
        overview_path = os.path.join(wiki_dir, "overview.md")
        if os.path.isfile(overview_path):
            entries.append(
                IndexEntry(
                    title="Overview",
                    slug="wiki/overview.md",
                    summary="Wiki synthesis",
                    category="overview",
                )
            )

        # Scan subdirectories
        for category in ["entities", "concepts", "comparisons", "analyses"]:
            cat_dir = os.path.join(wiki_dir, category)
            if not os.path.isdir(cat_dir):
                continue
            for f in sorted(os.listdir(cat_dir)):
                if f.endswith(".md"):
                    slug = f"wiki/{category}/{f}"
                    title = f.replace(".md", "").replace("-", " ").title()
                    entries.append(
                        IndexEntry(
                            title=title,
                            slug=slug,
                            summary=title,
                            category=category,
                        )
                    )

        # Scan sources
        sources_dir = os.path.join(ws_path, "sources")
        if os.path.isdir(sources_dir):
            for f in sorted(os.listdir(sources_dir)):
                if f.endswith(".md"):
                    slug = f"sources/{f}"
                    title = f.replace(".md", "").replace("-", " ").title()
                    entries.append(
                        IndexEntry(
                            title=title,
                            slug=slug,
                            summary=title,
                            category="sources",
                        )
                    )

        # Write index
        index_path = os.path.join(ws_path, "index.md")
        Path(index_path).write_text(render_index(entries))

        return MaintainResponse(
            status="completed",
            detail=f"Reindexed {len(entries)} entries.",
        )
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ai && python -m pytest tests/wiki/test_engine.py -v
```

Expected: All tests PASS (Ollama calls are mocked)

- [ ] **Step 6: Commit**

```bash
git add ai/app/wiki/models.py ai/app/wiki/engine.py ai/tests/wiki/test_engine.py
git commit -m "feat: wiki engine core with ingest, query, lint, maintain"
```

---

## Task 5: FastAPI Wiki Router

**Files:**
- Create: `ai/app/routers/wiki.py`
- Modify: `ai/app/main.py`
- Create: `ai/tests/wiki/test_router.py`

- [ ] **Step 1: Write failing router test**

```python
# ai/tests/wiki/test_router.py
"""Tests for the wiki FastAPI router."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client with wiki router."""
    from app.main import app

    return TestClient(app)


def test_list_workspaces(client: TestClient):
    with patch("app.routers.wiki.get_engine") as mock_engine:
        mock_engine.return_value.list_workspaces.return_value = []
        response = client.get("/wiki/workspaces")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_list_pages(client: TestClient):
    with patch("app.routers.wiki.get_engine") as mock_engine:
        mock_engine.return_value.list_pages.return_value = []
        response = client.get("/wiki/pages?workspace=platform")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_get_page_not_found(client: TestClient):
    with patch("app.routers.wiki.get_engine") as mock_engine:
        mock_engine.return_value.get_page.return_value = None
        response = client.get("/wiki/pages/nonexistent")
        assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ai && python -m pytest tests/wiki/test_router.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement wiki router**

```python
# ai/app/routers/wiki.py
"""FastAPI router for the wiki engine."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.wiki.engine import WikiEngine
from app.wiki.models import (
    FileAnswerRequest,
    IngestRequest,
    IngestResponse,
    LintRequest,
    LintResponse,
    MaintainRequest,
    MaintainResponse,
    QueryRequest,
    QueryResponse,
    WikiLogEntry,
    WikiPage,
    WikiPageSummary,
    WikiWorkspace,
)

router = APIRouter()

_engine: WikiEngine | None = None


def get_engine() -> WikiEngine:
    """Get or create the wiki engine singleton."""
    global _engine
    if _engine is None:
        _engine = WikiEngine()
    return _engine


@router.get("/workspaces", response_model=list[WikiWorkspace])
async def list_workspaces() -> list[WikiWorkspace]:
    """List all wiki workspaces."""
    return get_engine().list_workspaces()


@router.get("/pages", response_model=list[WikiPageSummary])
async def list_pages(
    workspace: str = Query(default="platform"),
) -> list[WikiPageSummary]:
    """List pages in a workspace from the index."""
    return get_engine().list_pages(workspace)


@router.get("/pages/{slug:path}", response_model=WikiPage)
async def get_page(
    slug: str,
    workspace: str = Query(default="platform"),
) -> WikiPage:
    """Read a single wiki page."""
    page = get_engine().get_page(workspace, slug)
    if page is None:
        raise HTTPException(status_code=404, detail=f"Page not found: {slug}")
    return page


@router.get("/log", response_model=list[WikiLogEntry])
async def get_log(
    workspace: str = Query(default="platform"),
) -> list[WikiLogEntry]:
    """Read log entries for a workspace."""
    return get_engine().get_log(workspace)


@router.get("/sources", response_model=list[str])
async def list_sources(
    workspace: str = Query(default="platform"),
) -> list[str]:
    """List source filenames in a workspace."""
    return get_engine().list_sources(workspace)


@router.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest) -> IngestResponse:
    """Ingest a source into a workspace."""
    engine = get_engine()

    # If content provided, write to sources/ first
    if request.source_content is not None:
        import os
        from pathlib import Path

        ws_path = engine._workspace_path(request.workspace)
        source_path = os.path.join(ws_path, "sources", request.source_filename)
        os.makedirs(os.path.dirname(source_path), exist_ok=True)
        Path(source_path).write_text(request.source_content)

    return await engine.ingest(request.workspace, request.source_filename)


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest) -> QueryResponse:
    """Query a workspace."""
    return await get_engine().query(
        request.workspace, request.question, request.top_n
    )


@router.post("/lint", response_model=LintResponse)
async def lint(request: LintRequest) -> LintResponse:
    """Lint a workspace for issues."""
    return await get_engine().lint(
        request.workspace, request.auto_fix, request.batch_size
    )


@router.post("/maintain", response_model=MaintainResponse)
async def maintain(request: MaintainRequest) -> MaintainResponse:
    """Run maintenance operations."""
    engine = get_engine()
    if request.operation == "reindex":
        return engine.maintain_reindex(request.workspace)
    raise HTTPException(
        status_code=400,
        detail=f"Unknown maintenance operation: {request.operation}",
    )


@router.post("/file-answer", response_model=IngestResponse)
async def file_answer(request: FileAnswerRequest) -> IngestResponse:
    """File a query answer as a new analysis page."""
    engine = get_engine()
    import os
    from datetime import datetime, timezone
    from pathlib import Path

    from app.wiki.git_ops import wiki_commit
    from app.wiki.index_ops import IndexEntry, add_index_entry, parse_index, render_index
    from app.wiki.log_ops import LogEntry, append_log_entry

    ws_path = engine._workspace_path(request.workspace)

    # Create slug from title
    from app.wiki.engine import _slugify

    slug = _slugify(request.title)
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    date_str = now.strftime("%Y-%m-%d")

    # Write analysis page
    page_path = os.path.join(ws_path, "wiki", "analyses", f"{slug}.md")
    os.makedirs(os.path.dirname(page_path), exist_ok=True)
    page_content = f"""---
type: analysis
tags: []
sources: []
created: "{timestamp}"
updated: "{timestamp}"
source_count: 0
---
# {request.title}

{request.answer_content}
"""
    Path(page_path).write_text(page_content)

    # Update index
    index_path = os.path.join(ws_path, "index.md")
    index_content = engine._read_file(index_path)
    entries = parse_index(index_content) if index_content else []
    rel_path = f"wiki/analyses/{slug}.md"
    entries = add_index_entry(
        entries,
        IndexEntry(
            title=request.title,
            slug=rel_path,
            summary=request.answer_content[:80],
            category="analyses",
            date=date_str,
        ),
    )
    Path(index_path).write_text(render_index(entries))

    # Log
    log_path = os.path.join(ws_path, "log.md")
    append_log_entry(
        log_path,
        LogEntry(
            operation="file-answer",
            title=request.title,
            pages_created=[rel_path],
            summary=f"Filed query answer: {request.title}",
        ),
    )

    # Commit
    wiki_commit(
        engine.wiki_dir,
        f"wiki: file answer — {request.title}",
        [page_path, index_path, log_path],
    )

    return IngestResponse(
        status="completed",
        source_slug=slug,
        pages_created=[rel_path],
        summary=f"Filed as analysis: {request.title}",
    )
```

- [ ] **Step 4: Register router in main.py**

Add to the `OPTIONAL_ROUTERS` list in `ai/app/main.py`:

```python
    ("app.routers.wiki", {"prefix": "/wiki", "tags": ["wiki"]}),
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ai && python -m pytest tests/wiki/test_router.py -v
```

Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add ai/app/routers/wiki.py ai/app/main.py ai/tests/wiki/test_router.py
git commit -m "feat: wiki FastAPI router with 10 endpoints"
```

---

## Task 6: External Document Adapter

**Files:**
- Create: `ai/app/wiki/adapters/__init__.py`
- Create: `ai/app/wiki/adapters/base.py`
- Create: `ai/app/wiki/adapters/external.py`

- [ ] **Step 1: Implement adapter base and external adapter**

```python
# ai/app/wiki/adapters/__init__.py
# (empty)

# ai/app/wiki/adapters/base.py
"""Base adapter for serializing sources to wiki markdown."""

from __future__ import annotations

from datetime import datetime, timezone


def build_frontmatter(
    source_type: str,
    title: str,
    source_id: str = "",
    tags: list[str] | None = None,
) -> str:
    """Build YAML frontmatter for a source file."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    tag_str = ", ".join(tags) if tags else ""
    lines = [
        "---",
        f"source_type: {source_type}",
    ]
    if source_id:
        lines.append(f'source_id: "{source_id}"')
    lines.extend([
        f'title: "{title}"',
        f'ingested: "{timestamp}"',
        f"tags: [{tag_str}]",
        "---",
    ])
    return "\n".join(lines)


# ai/app/wiki/adapters/external.py
"""Adapter for external documents — markdown passthrough, PDF extraction, plain text."""

from __future__ import annotations

import os
from pathlib import Path

from app.wiki.adapters.base import build_frontmatter


def adapt_external_document(
    file_path: str,
    title: str | None = None,
    tags: list[str] | None = None,
) -> str:
    """Convert an external document to wiki source markdown.

    Supports: .md (passthrough), .txt (wrap), .pdf (extract text).
    """
    ext = os.path.splitext(file_path)[1].lower()
    filename = os.path.basename(file_path)
    doc_title = title or filename.replace(ext, "").replace("-", " ").replace("_", " ").title()

    if ext == ".md":
        content = Path(file_path).read_text()
        # If it already has frontmatter, prepend our frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                body = parts[2].strip()
            else:
                body = content
        else:
            body = content
        frontmatter = build_frontmatter("external", doc_title, tags=tags)
        return f"{frontmatter}\n\n{body}"

    if ext == ".txt":
        content = Path(file_path).read_text()
        frontmatter = build_frontmatter("external", doc_title, tags=tags)
        return f"{frontmatter}\n\n{content}"

    if ext == ".pdf":
        try:
            import pdfplumber

            text_parts: list[str] = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
            body = "\n\n".join(text_parts)
        except ImportError:
            body = f"[PDF text extraction unavailable — install pdfplumber]\n\nFile: {filename}"
        except Exception as e:
            body = f"[PDF extraction failed: {e}]\n\nFile: {filename}"

        frontmatter = build_frontmatter("external", doc_title, tags=tags)
        return f"{frontmatter}\n\n{body}"

    # Unknown format — treat as plain text
    try:
        content = Path(file_path).read_text()
    except UnicodeDecodeError:
        content = f"[Binary file — cannot extract text]\n\nFile: {filename}"

    frontmatter = build_frontmatter("external", doc_title, tags=tags)
    return f"{frontmatter}\n\n{content}"
```

- [ ] **Step 2: Commit**

```bash
git add ai/app/wiki/adapters/__init__.py ai/app/wiki/adapters/base.py ai/app/wiki/adapters/external.py
git commit -m "feat: wiki source adapters with external document support"
```

---

## Task 7: Laravel RBAC Permissions & Wiki Routes

**Files:**
- Modify: `backend/database/seeders/RolePermissionSeeder.php`
- Create: `backend/app/Http/Controllers/Api/V1/WikiController.php` (new top-level, NOT the Commons one)
- Modify: `backend/app/Services/AiService.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add wiki permissions to RolePermissionSeeder**

Add to the `PERMISSIONS` constant array in `backend/database/seeders/RolePermissionSeeder.php`:

```php
'wiki' => ['view', 'ingest', 'lint', 'manage'],
```

Add wiki permissions to the `ROLES` constant array:

```php
// In the 'viewer' role permissions array, add:
'wiki.view',

// In the 'researcher' role permissions array, add:
'wiki.view', 'wiki.ingest', 'wiki.lint',

// In the 'data-steward' role permissions array, add:
'wiki.view', 'wiki.ingest',

// In the 'admin' role permissions array, add:
'wiki.view', 'wiki.ingest', 'wiki.lint', 'wiki.manage',
```

- [ ] **Step 2: Run the permission seeder**

```bash
docker compose exec php php artisan db:seed --class=RolePermissionSeeder
```

- [ ] **Step 3: Add wiki proxy methods to AiService**

Add to `backend/app/Services/AiService.php`:

```php
public function wikiWorkspaces(): array
{
    return $this->get('/wiki/workspaces');
}

public function wikiPages(string $workspace = 'platform'): array
{
    return $this->get('/wiki/pages', ['workspace' => $workspace]);
}

public function wikiPage(string $slug, string $workspace = 'platform'): array
{
    return $this->get("/wiki/pages/{$slug}", ['workspace' => $workspace]);
}

public function wikiLog(string $workspace = 'platform'): array
{
    return $this->get('/wiki/log', ['workspace' => $workspace]);
}

public function wikiSources(string $workspace = 'platform'): array
{
    return $this->get('/wiki/sources', ['workspace' => $workspace]);
}

public function wikiIngest(array $data): array
{
    return $this->post('/wiki/ingest', $data, timeout: 120);
}

public function wikiQuery(array $data): array
{
    return $this->post('/wiki/query', $data, timeout: 60);
}

public function wikiLint(array $data): array
{
    return $this->post('/wiki/lint', $data, timeout: 120);
}

public function wikiMaintain(array $data): array
{
    return $this->post('/wiki/maintain', $data, timeout: 60);
}

public function wikiFileAnswer(array $data): array
{
    return $this->post('/wiki/file-answer', $data, timeout: 60);
}

private function get(string $endpoint, array $query = []): array
{
    $response = Http::timeout($this->timeout)
        ->get($this->baseUrl . $endpoint, $query);

    if ($response->failed()) {
        throw new \RuntimeException("AI service error: {$response->status()}");
    }

    return $response->json();
}
```

- [ ] **Step 4: Create the new top-level WikiController**

```php
<?php
// backend/app/Http/Controllers/Api/V1/WikiController.php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WikiController extends Controller
{
    public function __construct(
        private readonly AiService $aiService,
    ) {}

    public function workspaces(): JsonResponse
    {
        return response()->json($this->aiService->wikiWorkspaces());
    }

    public function pages(Request $request): JsonResponse
    {
        $workspace = $request->query('workspace', 'platform');
        return response()->json($this->aiService->wikiPages($workspace));
    }

    public function page(Request $request, string $slug): JsonResponse
    {
        $workspace = $request->query('workspace', 'platform');
        return response()->json($this->aiService->wikiPage($slug, $workspace));
    }

    public function log(Request $request): JsonResponse
    {
        $workspace = $request->query('workspace', 'platform');
        return response()->json($this->aiService->wikiLog($workspace));
    }

    public function sources(Request $request): JsonResponse
    {
        $workspace = $request->query('workspace', 'platform');
        return response()->json($this->aiService->wikiSources($workspace));
    }

    public function ingest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'sometimes|string',
            'source_filename' => 'required|string',
            'source_content' => 'nullable|string',
        ]);

        return response()->json($this->aiService->wikiIngest($validated));
    }

    public function query(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'sometimes|string',
            'question' => 'required|string|max:2000',
            'top_n' => 'sometimes|integer|min:1|max:20',
        ]);

        return response()->json($this->aiService->wikiQuery($validated));
    }

    public function lint(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'sometimes|string',
            'auto_fix' => 'sometimes|boolean',
            'batch_size' => 'sometimes|integer|min:1|max:50',
        ]);

        return response()->json($this->aiService->wikiLint($validated));
    }

    public function maintain(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'sometimes|string',
            'operation' => 'required|string|in:reindex,compact,prune',
        ]);

        return response()->json($this->aiService->wikiMaintain($validated));
    }

    public function fileAnswer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workspace' => 'sometimes|string',
            'title' => 'required|string|max:255',
            'answer_content' => 'required|string',
        ]);

        return response()->json($this->aiService->wikiFileAnswer($validated));
    }
}
```

- [ ] **Step 5: Add wiki routes to api.php**

Add a new route group in `backend/routes/api.php` (inside the main `auth:sanctum` group):

```php
use App\Http\Controllers\Api\V1\WikiController;

Route::prefix('wiki')->group(function () {
    Route::get('workspaces', [WikiController::class, 'workspaces'])->middleware('permission:wiki.view');
    Route::get('pages', [WikiController::class, 'pages'])->middleware('permission:wiki.view');
    Route::get('pages/{slug}', [WikiController::class, 'page'])->where('slug', '.*')->middleware('permission:wiki.view');
    Route::get('log', [WikiController::class, 'log'])->middleware('permission:wiki.view');
    Route::get('sources', [WikiController::class, 'sources'])->middleware('permission:wiki.view');
    Route::post('ingest', [WikiController::class, 'ingest'])->middleware('permission:wiki.ingest');
    Route::post('query', [WikiController::class, 'query'])->middleware('permission:wiki.view');
    Route::post('lint', [WikiController::class, 'lint'])->middleware('permission:wiki.lint');
    Route::post('maintain', [WikiController::class, 'maintain'])->middleware('permission:wiki.manage');
    Route::post('file-answer', [WikiController::class, 'fileAnswer'])->middleware('permission:wiki.ingest');
});
```

Note: `->where('slug', '.*')` allows the slug to contain slashes (e.g., `wiki/entities/diabetes.md`).

- [ ] **Step 6: Run Pint and verify**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 7: Commit**

```bash
git add backend/database/seeders/RolePermissionSeeder.php backend/app/Http/Controllers/Api/V1/WikiController.php backend/app/Services/AiService.php backend/routes/api.php
git commit -m "feat: Laravel wiki RBAC permissions, controller, and routes"
```

---

## Task 8: Frontend — Types, API Hooks, and Store

**Files:**
- Create: `frontend/src/features/commons/types/wiki.ts`
- Create: `frontend/src/features/commons/api/wiki.ts`
- Create: `frontend/src/stores/wikiStore.ts`

- [ ] **Step 1: Create wiki TypeScript types**

```typescript
// frontend/src/features/commons/types/wiki.ts

export interface WikiWorkspace {
  name: string;
  workspace_type: "platform" | "study" | "personal";
  workspace_id: string;
  branch: string;
  page_count: number;
  source_count: number;
}

export interface WikiPageSummary {
  title: string;
  slug: string;
  summary: string;
  category: "overview" | "entities" | "concepts" | "sources" | "comparisons" | "analyses";
  date: string;
}

export interface WikiPage {
  title: string;
  slug: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

export interface WikiLogEntry {
  raw: string;
}

export interface IngestRequest {
  workspace?: string;
  source_filename: string;
  source_content?: string;
}

export interface IngestResponse {
  status: "completed" | "pending_review" | "error";
  source_slug: string;
  pages_created: string[];
  pages_updated: string[];
  summary: string;
  error?: string;
}

export interface QueryRequest {
  workspace?: string;
  question: string;
  top_n?: number;
}

export interface QueryResponse {
  answer: string;
  pages_consulted: string[];
  can_file: boolean;
}

export interface LintRequest {
  workspace?: string;
  auto_fix?: boolean;
  batch_size?: number;
}

export interface LintIssue {
  issue_type: "contradiction" | "orphan" | "missing_page" | "stale" | "gap";
  page: string;
  detail: string;
  fixed: boolean;
}

export interface LintResponse {
  issues: LintIssue[];
  fixed_count: number;
}

export interface FileAnswerRequest {
  workspace?: string;
  title: string;
  answer_content: string;
}
```

- [ ] **Step 2: Create TanStack Query hooks**

```typescript
// frontend/src/features/commons/api/wiki.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  FileAnswerRequest,
  IngestRequest,
  IngestResponse,
  LintRequest,
  LintResponse,
  QueryRequest,
  QueryResponse,
  WikiLogEntry,
  WikiPage,
  WikiPageSummary,
  WikiWorkspace,
} from "../types/wiki";

const WIKI_KEY = "wiki";

async function fetchWorkspaces(): Promise<WikiWorkspace[]> {
  const { data } = await apiClient.get<WikiWorkspace[]>("/api/v1/wiki/workspaces");
  return data;
}

async function fetchPages(workspace: string): Promise<WikiPageSummary[]> {
  const { data } = await apiClient.get<WikiPageSummary[]>("/api/v1/wiki/pages", {
    params: { workspace },
  });
  return data;
}

async function fetchPage(slug: string, workspace: string): Promise<WikiPage> {
  const { data } = await apiClient.get<WikiPage>(`/api/v1/wiki/pages/${slug}`, {
    params: { workspace },
  });
  return data;
}

async function fetchLog(workspace: string): Promise<WikiLogEntry[]> {
  const { data } = await apiClient.get<WikiLogEntry[]>("/api/v1/wiki/log", {
    params: { workspace },
  });
  return data;
}

async function fetchSources(workspace: string): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/api/v1/wiki/sources", {
    params: { workspace },
  });
  return data;
}

async function postIngest(req: IngestRequest): Promise<IngestResponse> {
  const { data } = await apiClient.post<IngestResponse>("/api/v1/wiki/ingest", req);
  return data;
}

async function postQuery(req: QueryRequest): Promise<QueryResponse> {
  const { data } = await apiClient.post<QueryResponse>("/api/v1/wiki/query", req);
  return data;
}

async function postLint(req: LintRequest): Promise<LintResponse> {
  const { data } = await apiClient.post<LintResponse>("/api/v1/wiki/lint", req);
  return data;
}

async function postFileAnswer(req: FileAnswerRequest): Promise<IngestResponse> {
  const { data } = await apiClient.post<IngestResponse>("/api/v1/wiki/file-answer", req);
  return data;
}

// --- Hooks ---

export function useWikiWorkspaces() {
  return useQuery({
    queryKey: [WIKI_KEY, "workspaces"],
    queryFn: fetchWorkspaces,
  });
}

export function useWikiPages(workspace: string) {
  return useQuery({
    queryKey: [WIKI_KEY, "pages", workspace],
    queryFn: () => fetchPages(workspace),
    enabled: !!workspace,
  });
}

export function useWikiPage(slug: string, workspace: string) {
  return useQuery({
    queryKey: [WIKI_KEY, "page", workspace, slug],
    queryFn: () => fetchPage(slug, workspace),
    enabled: !!slug && !!workspace,
  });
}

export function useWikiLog(workspace: string) {
  return useQuery({
    queryKey: [WIKI_KEY, "log", workspace],
    queryFn: () => fetchLog(workspace),
    enabled: !!workspace,
  });
}

export function useWikiSources(workspace: string) {
  return useQuery({
    queryKey: [WIKI_KEY, "sources", workspace],
    queryFn: () => fetchSources(workspace),
    enabled: !!workspace,
  });
}

export function useWikiIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postIngest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [WIKI_KEY] });
    },
  });
}

export function useWikiQuery() {
  return useMutation({
    mutationFn: postQuery,
  });
}

export function useWikiLint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postLint,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [WIKI_KEY] });
    },
  });
}

export function useWikiFileAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postFileAnswer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [WIKI_KEY] });
    },
  });
}
```

- [ ] **Step 3: Create Zustand store**

```typescript
// frontend/src/stores/wikiStore.ts

import { create } from "zustand";

interface WikiState {
  activeWorkspace: string;
  activePageSlug: string | null;
  searchTerm: string;
  setActiveWorkspace: (workspace: string) => void;
  setActivePageSlug: (slug: string | null) => void;
  setSearchTerm: (term: string) => void;
}

export const useWikiStore = create<WikiState>()((set) => ({
  activeWorkspace: "platform",
  activePageSlug: null,
  searchTerm: "",

  setActiveWorkspace: (workspace) =>
    set({ activeWorkspace: workspace, activePageSlug: null, searchTerm: "" }),
  setActivePageSlug: (slug) => set({ activePageSlug: slug }),
  setSearchTerm: (term) => set({ searchTerm: term }),
}));
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/commons/types/wiki.ts frontend/src/features/commons/api/wiki.ts frontend/src/stores/wikiStore.ts
git commit -m "feat: wiki frontend types, TanStack Query hooks, and Zustand store"
```

---

## Task 9: Frontend — MarkdownRenderer and WikiPageView

**Files:**
- Create: `frontend/src/features/commons/components/wiki/MarkdownRenderer.tsx`
- Create: `frontend/src/features/commons/components/wiki/WikiPageView.tsx`

- [ ] **Step 1: Create MarkdownRenderer with wikilink support**

```typescript
// frontend/src/features/commons/components/wiki/MarkdownRenderer.tsx

import { useMemo } from "react";
import { useWikiStore } from "@/stores/wikiStore";

interface MarkdownRendererProps {
  content: string;
  onWikilinkClick?: (slug: string) => void;
}

export function MarkdownRenderer({ content, onWikilinkClick }: MarkdownRendererProps) {
  const setActivePageSlug = useWikiStore((s) => s.setActivePageSlug);

  const handleClick = (slug: string) => {
    if (onWikilinkClick) {
      onWikilinkClick(slug);
    } else {
      setActivePageSlug(slug);
    }
  };

  const rendered = useMemo(() => {
    // Split content into frontmatter and body
    let body = content;
    let frontmatter = "";

    if (content.startsWith("---")) {
      const parts = content.split("---");
      if (parts.length >= 3) {
        frontmatter = parts[1].trim();
        body = parts.slice(2).join("---").trim();
      }
    }

    // Process markdown line by line
    const lines = body.split("\n");
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const key = `line-${i}`;

      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={key} className="text-2xl font-bold text-white mb-4 mt-6">
            {processInline(line.slice(2), handleClick)}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2 key={key} className="text-xl font-semibold text-gray-200 mb-3 mt-5">
            {processInline(line.slice(3), handleClick)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        elements.push(
          <h3 key={key} className="text-lg font-medium text-gray-300 mb-2 mt-4">
            {processInline(line.slice(4), handleClick)}
          </h3>
        );
      } else if (line.startsWith("> [!contradiction]")) {
        const calloutLines = [lines[i + 1] || ""];
        i++;
        while (i + 1 < lines.length && lines[i + 1].startsWith("> ")) {
          i++;
          calloutLines.push(lines[i].slice(2));
        }
        elements.push(
          <div
            key={key}
            className="border-l-4 border-[#9B1B30] bg-[#9B1B30]/10 px-4 py-2 my-3 rounded-r"
          >
            <span className="text-[#9B1B30] font-semibold text-sm">Contradiction</span>
            <p className="text-gray-300 text-sm mt-1">
              {processInline(calloutLines.join(" "), handleClick)}
            </p>
          </div>
        );
      } else if (line.startsWith("> [!stale]")) {
        const calloutLines = [lines[i + 1] || ""];
        i++;
        while (i + 1 < lines.length && lines[i + 1].startsWith("> ")) {
          i++;
          calloutLines.push(lines[i].slice(2));
        }
        elements.push(
          <div
            key={key}
            className="border-l-4 border-[#C9A227] bg-[#C9A227]/10 px-4 py-2 my-3 rounded-r"
          >
            <span className="text-[#C9A227] font-semibold text-sm">Stale</span>
            <p className="text-gray-300 text-sm mt-1">
              {processInline(calloutLines.join(" "), handleClick)}
            </p>
          </div>
        );
      } else if (line.startsWith("- ")) {
        elements.push(
          <li key={key} className="text-gray-300 ml-4 list-disc">
            {processInline(line.slice(2), handleClick)}
          </li>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={key} className="h-2" />);
      } else {
        elements.push(
          <p key={key} className="text-gray-300 leading-relaxed">
            {processInline(line, handleClick)}
          </p>
        );
      }
    }

    return { frontmatter, elements };
  }, [content, handleClick]);

  return (
    <div className="bg-[#151519] rounded-lg p-6">
      {rendered.frontmatter && (
        <FrontmatterBadges raw={rendered.frontmatter} />
      )}
      <div className="prose prose-invert max-w-none">{rendered.elements}</div>
    </div>
  );
}

function processInline(
  text: string,
  onWikilinkClick: (slug: string) => void
): React.ReactNode {
  // Process [[wikilinks]] and **bold** and `code`
  const parts: React.ReactNode[] = [];
  const wikilinkRe = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = wikilinkRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const slug = match[1];
    parts.push(
      <button
        key={`wl-${match.index}`}
        className="text-[#2DD4BF] hover:text-[#2DD4BF]/80 underline decoration-dotted cursor-pointer"
        onClick={() => onWikilinkClick(slug)}
      >
        {slug.split("/").pop()?.replace(".md", "").replace(/-/g, " ") || slug}
      </button>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function FrontmatterBadges({ raw }: { raw: string }) {
  const pairs = raw.split("\n").filter((l) => l.includes(":"));
  const tags = pairs
    .find((p) => p.startsWith("tags:"))
    ?.replace("tags:", "")
    .replace(/[\[\]]/g, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const sourceCount = pairs
    .find((p) => p.startsWith("source_count:"))
    ?.replace("source_count:", "")
    .trim();

  const pageType = pairs
    .find((p) => p.startsWith("type:"))
    ?.replace("type:", "")
    .trim();

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {pageType && (
        <span className="px-2 py-0.5 bg-[#2DD4BF]/20 text-[#2DD4BF] text-xs rounded">
          {pageType}
        </span>
      )}
      {sourceCount && (
        <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
          {sourceCount} sources
        </span>
      )}
      {tags?.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create WikiPageView**

```typescript
// frontend/src/features/commons/components/wiki/WikiPageView.tsx

import { useWikiPage } from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiPageView() {
  const activeWorkspace = useWikiStore((s) => s.activeWorkspace);
  const activePageSlug = useWikiStore((s) => s.activePageSlug);

  const { data: page, isLoading, error } = useWikiPage(
    activePageSlug ?? "",
    activeWorkspace
  );

  if (!activePageSlug) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a page from the sidebar to view it.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading page...
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        Page not found: {activePageSlug}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <MarkdownRenderer content={page.content} />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/wiki/MarkdownRenderer.tsx frontend/src/features/commons/components/wiki/WikiPageView.tsx
git commit -m "feat: wiki MarkdownRenderer with wikilink support and WikiPageView"
```

---

## Task 10: Frontend — WikiPageTree and WikiWorkspaceSelector

**Files:**
- Create: `frontend/src/features/commons/components/wiki/WikiPageTree.tsx`
- Create: `frontend/src/features/commons/components/wiki/WikiWorkspaceSelector.tsx`

- [ ] **Step 1: Create WikiPageTree**

```typescript
// frontend/src/features/commons/components/wiki/WikiPageTree.tsx

import { useMemo, useState } from "react";
import { useWikiPages } from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";
import type { WikiPageSummary } from "../../types/wiki";

const CATEGORY_LABELS: Record<string, string> = {
  overview: "Overview",
  entities: "Entities",
  concepts: "Concepts",
  sources: "Sources",
  comparisons: "Comparisons",
  analyses: "Analyses",
};

const CATEGORY_ORDER = ["overview", "entities", "concepts", "sources", "comparisons", "analyses"];

export function WikiPageTree() {
  const activeWorkspace = useWikiStore((s) => s.activeWorkspace);
  const activePageSlug = useWikiStore((s) => s.activePageSlug);
  const setActivePageSlug = useWikiStore((s) => s.setActivePageSlug);
  const searchTerm = useWikiStore((s) => s.searchTerm);
  const setSearchTerm = useWikiStore((s) => s.setSearchTerm);

  const { data: pages, isLoading } = useWikiPages(activeWorkspace);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    if (!pages) return {};
    const filtered = searchTerm
      ? pages.filter(
          (p) =>
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.summary.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : pages;

    const groups: Record<string, WikiPageSummary[]> = {};
    for (const page of filtered) {
      const cat = page.category || "entities";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(page);
    }
    return groups;
  }, [pages, searchTerm]);

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (isLoading) {
    return <div className="p-4 text-gray-500 text-sm">Loading pages...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <input
          type="text"
          placeholder="Search pages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#1a1a1f] border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:border-[#2DD4BF] focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items && !searchTerm) return null;
          const count = items?.length ?? 0;
          const isCollapsed = collapsed[cat];

          return (
            <div key={cat} className="mb-1">
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300"
              >
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="text-gray-600">{count}</span>
              </button>

              {!isCollapsed && items?.map((page) => (
                <button
                  key={page.slug}
                  onClick={() => setActivePageSlug(page.slug)}
                  className={`block w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${
                    activePageSlug === page.slug
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                  }`}
                >
                  <div className="truncate">{page.title}</div>
                  <div className="text-xs text-gray-600 truncate">{page.summary}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WikiWorkspaceSelector**

```typescript
// frontend/src/features/commons/components/wiki/WikiWorkspaceSelector.tsx

import { useWikiWorkspaces } from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";

export function WikiWorkspaceSelector() {
  const activeWorkspace = useWikiStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWikiStore((s) => s.setActiveWorkspace);
  const { data: workspaces } = useWikiWorkspaces();

  return (
    <div className="px-3 py-2 border-b border-gray-800">
      <select
        value={activeWorkspace}
        onChange={(e) => setActiveWorkspace(e.target.value)}
        className="w-full bg-[#1a1a1f] border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:border-[#2DD4BF] focus:outline-none"
      >
        <option value="platform">Platform Wiki</option>
        {workspaces
          ?.filter((ws) => ws.workspace_type === "study")
          .map((ws) => (
            <option key={ws.workspace_id} value={`study:${ws.workspace_id}`}>
              {ws.name} ({ws.page_count} pages)
            </option>
          ))}
        {workspaces
          ?.filter((ws) => ws.workspace_type === "personal")
          .map((ws) => (
            <option key={ws.workspace_id} value={`personal:${ws.workspace_id}`}>
              {ws.name} ({ws.page_count} pages)
            </option>
          ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/wiki/WikiPageTree.tsx frontend/src/features/commons/components/wiki/WikiWorkspaceSelector.tsx
git commit -m "feat: wiki page tree sidebar and workspace selector"
```

---

## Task 11: Frontend — WikiIngestPanel, WikiQueryPanel, WikiActivityFeed

**Files:**
- Create: `frontend/src/features/commons/components/wiki/WikiIngestPanel.tsx`
- Create: `frontend/src/features/commons/components/wiki/WikiQueryPanel.tsx`
- Create: `frontend/src/features/commons/components/wiki/WikiActivityFeed.tsx`

- [ ] **Step 1: Create WikiIngestPanel**

```typescript
// frontend/src/features/commons/components/wiki/WikiIngestPanel.tsx

import { useState } from "react";
import { useWikiIngest } from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";

interface WikiIngestPanelProps {
  onClose: () => void;
}

export function WikiIngestPanel({ onClose }: WikiIngestPanelProps) {
  const activeWorkspace = useWikiStore((s) => s.activeWorkspace);
  const ingestMutation = useWikiIngest();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;

    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + ".md";

    const sourceContent = `---\nsource_type: external\ntitle: "${title}"\n---\n\n${content}`;

    ingestMutation.mutate(
      {
        workspace: activeWorkspace,
        source_filename: filename,
        source_content: sourceContent,
      },
      {
        onSuccess: () => {
          setTitle("");
          setContent("");
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#0E0E11] border-l border-gray-800 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">Ingest Source</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Source Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., DQD Report - SynPUF April 2026"
            className="w-full bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-[#2DD4BF] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Content (markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste article content, research notes, or report data..."
            rows={16}
            className="w-full bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 font-mono focus:border-[#2DD4BF] focus:outline-none resize-none"
          />
        </div>
      </div>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !content.trim() || ingestMutation.isPending}
          className="w-full bg-[#2DD4BF] text-black font-medium rounded py-2 text-sm hover:bg-[#2DD4BF]/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ingestMutation.isPending ? "Ingesting..." : "Ingest Source"}
        </button>
        {ingestMutation.isError && (
          <p className="text-red-400 text-xs mt-2">
            Error: {String(ingestMutation.error)}
          </p>
        )}
        {ingestMutation.isSuccess && (
          <p className="text-[#2DD4BF] text-xs mt-2">
            Ingested: {ingestMutation.data.pages_created.length} pages created,{" "}
            {ingestMutation.data.pages_updated.length} updated.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WikiQueryPanel**

```typescript
// frontend/src/features/commons/components/wiki/WikiQueryPanel.tsx

import { useState } from "react";
import { useWikiQuery, useWikiFileAnswer } from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function WikiQueryPanel() {
  const activeWorkspace = useWikiStore((s) => s.activeWorkspace);
  const queryMutation = useWikiQuery();
  const fileAnswerMutation = useWikiFileAnswer();
  const [question, setQuestion] = useState("");
  const [fileTitle, setFileTitle] = useState("");

  const handleQuery = () => {
    if (!question.trim()) return;
    queryMutation.mutate({ workspace: activeWorkspace, question });
  };

  const handleFileAnswer = () => {
    if (!queryMutation.data || !fileTitle.trim()) return;
    fileAnswerMutation.mutate(
      {
        workspace: activeWorkspace,
        title: fileTitle,
        answer_content: queryMutation.data.answer,
      },
      {
        onSuccess: () => setFileTitle(""),
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuery()}
            placeholder="Ask a question about this wiki..."
            className="flex-1 bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-[#2DD4BF] focus:outline-none"
          />
          <button
            onClick={handleQuery}
            disabled={!question.trim() || queryMutation.isPending}
            className="bg-[#2DD4BF] text-black font-medium rounded px-4 py-2 text-sm hover:bg-[#2DD4BF]/90 disabled:opacity-50"
          >
            {queryMutation.isPending ? "..." : "Ask"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {queryMutation.data && (
          <div>
            <MarkdownRenderer content={queryMutation.data.answer} />

            {queryMutation.data.pages_consulted.length > 0 && (
              <div className="mt-4 text-xs text-gray-500">
                Sources: {queryMutation.data.pages_consulted.join(", ")}
              </div>
            )}

            {queryMutation.data.can_file && (
              <div className="mt-4 flex gap-2 items-center">
                <input
                  type="text"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="Title for this analysis..."
                  className="flex-1 bg-[#1a1a1f] border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 focus:border-[#C9A227] focus:outline-none"
                />
                <button
                  onClick={handleFileAnswer}
                  disabled={!fileTitle.trim() || fileAnswerMutation.isPending}
                  className="bg-[#C9A227] text-black font-medium rounded px-3 py-1.5 text-xs hover:bg-[#C9A227]/90 disabled:opacity-50"
                >
                  File This
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WikiActivityFeed**

```typescript
// frontend/src/features/commons/components/wiki/WikiActivityFeed.tsx

import { useWikiLog } from "../../api/wiki";
import { useWikiStore } from "@/stores/wikiStore";

export function WikiActivityFeed() {
  const activeWorkspace = useWikiStore((s) => s.activeWorkspace);
  const { data: entries, isLoading } = useWikiLog(activeWorkspace);

  if (isLoading) {
    return <div className="p-4 text-gray-500 text-sm">Loading log...</div>;
  }

  if (!entries?.length) {
    return <div className="p-4 text-gray-500 text-sm">No activity yet.</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {entries.map((entry, i) => {
        const headerMatch = entry.raw.match(
          /^## \[(.+?)\] (\w+) \| (.+)$/m
        );
        const timestamp = headerMatch?.[1] ?? "";
        const operation = headerMatch?.[2] ?? "unknown";
        const title = headerMatch?.[3] ?? "Unknown";

        const opColors: Record<string, string> = {
          ingest: "text-[#2DD4BF]",
          query: "text-[#C9A227]",
          lint: "text-[#9B1B30]",
          maintain: "text-gray-400",
          "file-answer": "text-[#C9A227]",
        };

        return (
          <div key={i} className="border-l-2 border-gray-700 pl-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={opColors[operation] ?? "text-gray-400"}>
                {operation}
              </span>
              <span className="text-gray-600">
                {timestamp ? new Date(timestamp).toLocaleString() : "—"}
              </span>
            </div>
            <div className="text-sm text-gray-300 mt-0.5">{title}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/commons/components/wiki/WikiIngestPanel.tsx frontend/src/features/commons/components/wiki/WikiQueryPanel.tsx frontend/src/features/commons/components/wiki/WikiActivityFeed.tsx
git commit -m "feat: wiki ingest panel, query panel, and activity feed"
```

---

## Task 12: Frontend — Rewrite WikiPage as LLM Wiki Browser

**Files:**
- Modify: `frontend/src/features/commons/components/wiki/WikiPage.tsx`

- [ ] **Step 1: Replace WikiPage.tsx with the LLM wiki browser**

Replace the entire content of `frontend/src/features/commons/components/wiki/WikiPage.tsx`:

```typescript
// frontend/src/features/commons/components/wiki/WikiPage.tsx

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { WikiWorkspaceSelector } from "./WikiWorkspaceSelector";
import { WikiPageTree } from "./WikiPageTree";
import { WikiPageView } from "./WikiPageView";
import { WikiQueryPanel } from "./WikiQueryPanel";
import { WikiActivityFeed } from "./WikiActivityFeed";
import { WikiIngestPanel } from "./WikiIngestPanel";
import { useWikiStore } from "@/stores/wikiStore";

type RightPanelView = "query" | "activity" | null;

export default function WikiPage() {
  const [showIngest, setShowIngest] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanelView>(null);
  const activePageSlug = useWikiStore((s) => s.activePageSlug);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const canIngest = hasPermission("wiki.ingest");

  return (
    <div className="flex h-full bg-[#0E0E11]">
      {/* Left sidebar — workspace selector + page tree */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <WikiWorkspaceSelector />
        <WikiPageTree />

        {/* Action buttons */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          {canIngest && (
            <button
              onClick={() => setShowIngest(true)}
              className="w-full bg-[#2DD4BF]/10 text-[#2DD4BF] rounded py-1.5 text-xs hover:bg-[#2DD4BF]/20"
            >
              + Ingest Source
            </button>
          )}
          <button
            onClick={() => setRightPanel(rightPanel === "query" ? null : "query")}
            className={`w-full rounded py-1.5 text-xs ${
              rightPanel === "query"
                ? "bg-[#C9A227]/20 text-[#C9A227]"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Query Wiki
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === "activity" ? null : "activity")}
            className={`w-full rounded py-1.5 text-xs ${
              rightPanel === "activity"
                ? "bg-gray-700 text-gray-300"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Activity Log
          </button>
        </div>
      </div>

      {/* Main content — page view */}
      <div className="flex-1 flex flex-col min-w-0">
        {activePageSlug ? (
          <WikiPageView />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <div className="text-lg mb-2">Wiki Knowledge Base</div>
              <div className="text-sm">
                Select a page from the sidebar, or ingest a source to get started.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — query or activity */}
      {rightPanel && (
        <div className="w-96 border-l border-gray-800 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <span className="text-sm font-medium text-gray-300">
              {rightPanel === "query" ? "Query Wiki" : "Activity Log"}
            </span>
            <button
              onClick={() => setRightPanel(null)}
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              &times;
            </button>
          </div>
          {rightPanel === "query" && <WikiQueryPanel />}
          {rightPanel === "activity" && <WikiActivityFeed />}
        </div>
      )}

      {/* Ingest slide-out */}
      {showIngest && <WikiIngestPanel onClose={() => setShowIngest(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Verify Vite build**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/wiki/WikiPage.tsx
git commit -m "feat: replace Commons wiki page with LLM wiki browser"
```

---

## Task 13: Integration Test — End-to-End Verification

**Files:** No new files — verification only.

- [ ] **Step 1: Run all Python tests**

```bash
cd ai && python -m pytest tests/wiki/ -v
```

Expected: All tests pass

- [ ] **Step 2: Run Pint on PHP changes**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Run TypeScript check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Run Vite build**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 5: Verify Docker compose config is valid**

```bash
docker compose config --quiet
```

- [ ] **Step 6: Verify API routes include wiki**

```bash
docker compose exec php php artisan route:list --path=wiki
```

Expected: 10 wiki routes listed with correct middleware

- [ ] **Step 7: Commit any auto-formatted changes**

```bash
git add -A && git status
# If there are Pint-formatted changes:
git commit -m "style: auto-format PHP files via Pint"
```
