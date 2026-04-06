"""Git operations for the wiki engine."""

from __future__ import annotations

import subprocess
from pathlib import Path

from app.wiki.index_ops import ensure_index_file
from app.wiki.log_ops import ensure_log_file


SCHEMA_TEMPLATE = """# Wiki Schema

## Page Types

- `source_summary`: immutable summary for one ingested source
- `entity`: durable page for a person, organization, project, or named thing
- `concept`: synthesized topic spanning multiple sources
- `comparison`: side-by-side page comparing alternatives or positions
- `analysis`: focused synthesis for a question, investigation, or conclusion

## Markdown Conventions

- Every page should include frontmatter with `title`, `slug`, `type`, and `updated_at`
- Internal references should use wikilinks like `[[other-page-slug]]`
- `index.md` is the machine-maintained page directory
- `log.md` is the machine-maintained activity feed
"""

WORKSPACE_PAGE_DIRS = {
    "source_summary": "wiki/source_summaries",
    "entity": "wiki/entities",
    "concept": "wiki/concepts",
    "comparison": "wiki/comparisons",
    "analysis": "wiki/analyses",
}


def init_wiki_repo(root_dir: str | Path) -> None:
    root = Path(root_dir)
    root.mkdir(parents=True, exist_ok=True)

    if not (root / ".git").exists():
        _run_git(root, "init", "-b", "main")

    _ensure_local_identity(root)

    schema_path = root / "SCHEMA.md"
    if not schema_path.exists():
        schema_path.write_text(SCHEMA_TEMPLATE, encoding="utf-8")

    ensure_workspace_structure(root, "platform")

    if not _has_commits(root):
        wiki_commit(root, "wiki: initialize repository")


def ensure_workspace_structure(root_dir: str | Path, workspace: str) -> Path:
    root = Path(root_dir)
    workspace_dir = root / workspace
    workspace_dir.mkdir(parents=True, exist_ok=True)
    (workspace_dir / "sources").mkdir(parents=True, exist_ok=True)

    for relative_dir in WORKSPACE_PAGE_DIRS.values():
        (workspace_dir / relative_dir).mkdir(parents=True, exist_ok=True)

    ensure_index_file(workspace_dir)
    ensure_log_file(workspace_dir)
    return workspace_dir


def wiki_commit(root_dir: str | Path, message: str, paths: list[str | Path] | None = None) -> str | None:
    root = Path(root_dir)
    if paths:
        for path in paths:
            _run_git(root, "add", str(Path(path).relative_to(root)))
    else:
        _run_git(root, "add", "-A")

    status = _run_git(root, "status", "--porcelain")
    if not status.strip():
        return None

    _run_git(root, "commit", "-m", message)
    return _run_git(root, "rev-parse", "HEAD").strip()


def create_workspace_branch(root_dir: str | Path, branch_name: str) -> None:
    root = Path(root_dir)
    existing = set(list_branches(root))
    if branch_name in existing:
        return
    _run_git(root, "branch", branch_name)


def delete_workspace_branch(root_dir: str | Path, branch_name: str) -> None:
    root = Path(root_dir)
    if get_current_branch(root) == branch_name:
        switch_branch(root, "main")
    if branch_name in set(list_branches(root)):
        _run_git(root, "branch", "-D", branch_name)


def list_branches(root_dir: str | Path) -> list[str]:
    output = _run_git(Path(root_dir), "branch", "--format=%(refname:short)")
    return [line.strip() for line in output.splitlines() if line.strip()]


def switch_branch(root_dir: str | Path, branch_name: str) -> None:
    _run_git(Path(root_dir), "checkout", branch_name)


def get_current_branch(root_dir: str | Path) -> str:
    return _run_git(Path(root_dir), "branch", "--show-current").strip()


def _ensure_local_identity(root: Path) -> None:
    name = _run_git(root, "config", "--get", "user.name", check=False).strip()
    email = _run_git(root, "config", "--get", "user.email", check=False).strip()
    if not name:
        _run_git(root, "config", "user.name", "Parthenon Wiki")
    if not email:
        _run_git(root, "config", "user.email", "wiki@parthenon.local")


def _has_commits(root: Path) -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--verify", "HEAD"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def _run_git(root: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        capture_output=True,
        text=True,
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"git {' '.join(args)} failed")
    return result.stdout

