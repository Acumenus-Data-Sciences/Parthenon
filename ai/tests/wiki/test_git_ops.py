import os
import subprocess
import tempfile

import pytest

from app.wiki.git_ops import (
    create_workspace_branch,
    delete_workspace_branch,
    get_current_branch,
    init_wiki_repo,
    list_branches,
    switch_branch,
    wiki_commit,
)


@pytest.fixture
def wiki_dir():
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
    assert os.path.isdir(os.path.join(wiki_dir, "platform", "wiki", "source_summaries"))


def test_init_wiki_repo_idempotent(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    init_wiki_repo(wiki_dir)
    assert os.path.isdir(os.path.join(wiki_dir, ".git"))


def test_wiki_commit(wiki_dir: str):
    init_wiki_repo(wiki_dir)
    test_file = os.path.join(wiki_dir, "platform", "wiki", "entities", "test.md")
    with open(test_file, "w", encoding="utf-8") as handle:
        handle.write("# Test Entity\n")
    wiki_commit(wiki_dir, "wiki: test commit", [test_file])
    result = subprocess.run(
        ["git", "log", "--oneline", "-1"],
        cwd=wiki_dir,
        capture_output=True,
        text=True,
        check=True,
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

