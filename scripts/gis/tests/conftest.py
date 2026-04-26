"""Phase 19 Wave 0 conftest: shared fixtures for UA loader + crosswalk tests."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

import pytest
from _pytest.monkeypatch import MonkeyPatch

REPO_ROOT = Path(__file__).resolve().parents[3]
GIS_DIR = REPO_ROOT / "scripts" / "gis"
UA_XLSX_PATH = REPO_ROOT / "2020_UA_COUNTY.xlsx"


@pytest.fixture(scope="session")
def ua_xlsx_path() -> Path:
    if not UA_XLSX_PATH.exists():
        pytest.skip(f"Required test fixture missing: {UA_XLSX_PATH}")
    return UA_XLSX_PATH


@pytest.fixture(scope="session")
def gis_loader_dir() -> Path:
    return GIS_DIR


@pytest.fixture(scope="session")
def monkeypatch_session() -> Generator[MonkeyPatch, None, None]:
    mp = MonkeyPatch()
    yield mp
    mp.undo()


@pytest.fixture(scope="session")
def env_dsn(monkeypatch_session: MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch_session.setenv("PGHOST", os.environ.get("PGHOST", "localhost"))
    monkeypatch_session.setenv("PGPORT", os.environ.get("PGPORT", "5432"))
    monkeypatch_session.setenv("PGDATABASE", os.environ.get("PGDATABASE", "parthenon"))
    monkeypatch_session.setenv("PGUSER", os.environ.get("PGUSER", "parthenon_migrator"))
    yield
