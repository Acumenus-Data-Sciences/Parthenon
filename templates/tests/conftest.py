"""Shared pytest fixtures for parthenon-templates."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def _isolate_internal_token(
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[None, None, None]:
    monkeypatch.setenv("PARTHENON_INTERNAL_TOKEN", "test-internal-token")
    yield
    if "PARTHENON_INTERNAL_TOKEN" in os.environ:
        # noop: monkeypatch unwinds automatically
        pass
