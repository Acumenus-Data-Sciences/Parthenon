"""Plan 6 Task 2: Makefile fetch-fixtures target shape (Q10)."""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_makefile_has_fetch_fixtures_target() -> None:
    body = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
    assert re.search(r"^fetch-fixtures\s*:", body, re.M)


def test_makefile_target_documents_cdisc_url() -> None:
    body = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
    assert "cdisc" in body.lower()


def test_makefile_target_unzips_xpt_files() -> None:
    body = (REPO_ROOT / "Makefile").read_text(encoding="utf-8")
    assert "*.xpt" in body or ".xpt" in body
    assert "unzip" in body


def test_lzzt_fixture_dir_gitignored() -> None:
    gitignore = REPO_ROOT / "templates" / "tests" / "fixtures" / "lzzt" / ".gitignore"
    body = gitignore.read_text(encoding="utf-8")
    assert "*" in body
    assert "!README.md" in body
    assert "!.gitignore" in body


def test_lzzt_fixture_readme_explains_offline_fallback() -> None:
    readme = REPO_ROOT / "templates" / "tests" / "fixtures" / "lzzt" / "README.md"
    body = readme.read_text(encoding="utf-8")
    assert "LZZT_BASE_URL" in body
    assert "offline" in body.lower() or "mirror" in body.lower()
