"""Plan 3 Task 5+6: NerEvalRunner end-to-end with stub backends + report render."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from runtime.nlp.eval.runner import NerEvalRunner, _load_gold, _load_notes
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


class _PerfectBackend:
    """Stub that returns the gold standard exactly — yields F1=1.0, CMR=1.0."""

    def __init__(self, gold: list[dict[str, Any]]) -> None:
        self._by_note: dict[int, list[dict[str, Any]]] = {}
        for g in gold:
            self._by_note.setdefault(int(g["note_id"]), []).append(g)
        self._note_lookup: dict[str, int] = {}
        self.model_name = "perfect-stub"

    def index_notes(self, notes: list[dict[str, Any]]) -> None:
        self._note_lookup = {n["text"]: int(n["note_id"]) for n in notes}

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        note_id = self._note_lookup.get(text, 0)
        rows = self._by_note.get(note_id, [])
        spans = [
            NerSpan(start=int(r["start"]), end=int(r["end"]), text=r["text"], label=r["label"])
            for r in rows
        ]
        mappings = [
            NerConceptMapping(
                span_index=i,
                concept_id=int(rows[i]["concept_id"]),
                vocabulary_id=str(rows[i]["vocabulary_id"]),
                confidence=1.0,
            )
            for i in range(len(rows))
        ]
        return NerInferenceResult(
            spans=spans,
            mappings=mappings,
            model_name=self.model_name,
            prompt_version=prompt_version,
        )


class _EmptyBackend:
    """Stub that returns no spans — yields F1=0.0."""

    def __init__(self) -> None:
        self.model_name = "empty-stub"

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        return NerInferenceResult(
            spans=[], mappings=[], model_name=self.model_name, prompt_version=prompt_version
        )


@pytest.fixture
def runner(tmp_path: Path) -> NerEvalRunner:
    return NerEvalRunner(out_dir=tmp_path / "_eval")


def test_runner_aggregates_metrics_with_perfect_backend(runner: NerEvalRunner) -> None:
    notes = _load_notes(runner.notes_path)
    gold = _load_gold(runner.gold_path)
    perfect = _PerfectBackend(gold)
    perfect.index_notes(notes)

    report = runner.run_all_backends(backends=[("perfect", perfect)])
    assert len(report.runs) == 1
    m = report.runs[0].metrics
    assert m.span_f1 == 1.0
    assert m.concept_match_rate == 1.0


def test_runner_aggregates_metrics_with_empty_backend(runner: NerEvalRunner) -> None:
    report = runner.run_all_backends(backends=[("empty", _EmptyBackend())])
    m = report.runs[0].metrics
    assert m.span_f1 == 0.0
    assert m.concept_match_rate == 0.0


def test_report_renders_with_three_backends(tmp_path: Path) -> None:
    runner = NerEvalRunner(out_dir=tmp_path)
    gold = _load_gold(runner.gold_path)
    notes = _load_notes(runner.notes_path)
    perfect = _PerfectBackend(gold)
    perfect.index_notes(notes)
    empty = _EmptyBackend()

    runner.run_all_backends(backends=[("llm", perfect), ("scispacy", empty), ("llettuce", empty)])
    out = tmp_path / "ner_backend_comparison.md"
    assert out.is_file()
    body = out.read_text(encoding="utf-8")
    assert "## NER Backend Comparison" in body
    assert "LlmBackend" in body
    assert "SciSpacyBackend" in body
    assert "LlettuceBackend" in body
    assert "Phase 3 graduation criterion" in body
    assert "GRADUATE" in body or "HOLD" in body


def test_report_marks_failed_backend(tmp_path: Path) -> None:
    runner = NerEvalRunner(out_dir=tmp_path)

    class _Boom:
        model_name = "boom"

        def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
            raise RuntimeError("boom")

    runner.run_all_backends(backends=[("boom", _Boom())])
    body = (tmp_path / "ner_backend_comparison.md").read_text(encoding="utf-8")
    assert "boom" in body.lower()
