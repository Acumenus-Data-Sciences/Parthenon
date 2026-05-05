"""Smoke test that Phase 1 deps are pinned in pyproject.toml."""

from __future__ import annotations

from pathlib import Path


def test_pyproject_declares_phase_1_pinned_versions() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    for required in (
        "fhir.resources==8.2.0",
        "pydicom==3.0.2",
    ):
        assert required in pyproject, f"missing pinned dep: {required}"
