"""Smoke test that the package metadata and module tree exist."""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest


def test_runtime_package_imports() -> None:
    mod = importlib.import_module("runtime")
    assert mod is not None


@pytest.mark.parametrize(
    "submodule",
    ["runtime.nodes", "runtime.orchestration", "runtime.registry", "runtime.cdm"],
)
def test_runtime_subpackages_import(submodule: str) -> None:
    mod = importlib.import_module(submodule)
    assert mod is not None


def test_pyproject_declares_pinned_versions() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    for required in (
        "fastapi==0.115.6",
        "pydantic==2.10.3",
        "prefect==3.1.5",
        "sqlalchemy==2.0.36",
        "polars==1.17.1",
        "pandera==0.21.0",
        "pyomop==4.3.0",
    ):
        assert required in pyproject, f"missing pinned dep: {required}"
