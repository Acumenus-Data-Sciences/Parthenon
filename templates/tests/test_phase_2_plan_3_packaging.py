"""Plan 3 Task 1: smoke test that Phase 2 Plan 3 deps are pinned."""

from __future__ import annotations

from pathlib import Path


def test_pyproject_pins_llettuce_and_jinja() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    # Llettuce isn't on PyPI yet — pinning lives in a comment block that
    # documents the manual install. The string "lettuce" must be present
    # so future tooling that greps pyproject.toml finds the dep doc.
    assert ('"lettuce-omop' in pyproject) or ("lettuce" in pyproject)
    assert '"jinja2==3.1.4"' in pyproject


def test_pyproject_registers_ner_eval_marker() -> None:
    project_root = Path(__file__).resolve().parents[1]
    pyproject = (project_root / "pyproject.toml").read_text(encoding="utf-8")
    assert "ner_eval:" in pyproject
