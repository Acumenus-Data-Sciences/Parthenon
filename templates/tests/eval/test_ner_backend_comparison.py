"""Plan 3 Task 7: gated NER eval lane.

Marked ``ner_eval``; default ``pytest -q`` skips it. Run explicitly:

    uv run pytest tests/eval/ -v -m ner_eval
"""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.mark.ner_eval
def test_three_backend_report_renders(tmp_path_factory: pytest.TempPathFactory) -> None:
    from runtime.nlp.eval.runner import NerEvalRunner

    out_dir: Path = tmp_path_factory.mktemp("eval_out")
    runner = NerEvalRunner(out_dir=out_dir)
    runner.run_all_backends()
    report = out_dir / "ner_backend_comparison.md"
    assert report.is_file()
    body = report.read_text(encoding="utf-8")
    assert "## NER Backend Comparison" in body
    assert "LlmBackend" in body
    assert "SciSpacyBackend" in body
    assert "LlettuceBackend" in body
    assert "Phase 3 graduation criterion" in body
