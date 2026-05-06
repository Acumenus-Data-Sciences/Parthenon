"""NerEvalRunner — drives all NER backends through the gold standard.

Loads the 100-note benchmark, runs each backend on every note, aggregates
metrics, and renders the markdown comparison report. Phase 3 reads the
report's ``concept_match_rate`` table to decide whether to graduate
LlettuceBackend to a production backend (Q4).
"""

from __future__ import annotations

import csv
import json
import logging
import time
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from runtime.nlp.backend import NlpBackend
from runtime.nlp.eval.metrics import BackendMetrics, compute_metrics
from runtime.nlp.types import NerInferenceResult

logger = logging.getLogger(__name__)

_HERE = Path(__file__).resolve().parent


@dataclass
class _BackendRun:
    name: str
    metrics: BackendMetrics
    runtime_seconds: float
    n_notes: int
    error: str | None = None


@dataclass
class NerEvalReport:
    runs: list[_BackendRun] = field(default_factory=list)
    n_notes: int = 0
    n_gold_spans: int = 0


def _load_notes(path: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            out.append(json.loads(line))
    return out


def _load_gold(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                {
                    "note_id": int(r["note_id"]),
                    "start": int(r["start"]),
                    "end": int(r["end"]),
                    "text": r["text"],
                    "label": r["label"],
                    "concept_id": int(r["concept_id"]),
                    "vocabulary_id": r["vocabulary_id"],
                }
            )
    return rows


def _gold_for_note(gold: list[dict[str, Any]], note_id: int) -> list[dict[str, Any]]:
    return [g for g in gold if g["note_id"] == note_id]


def _aggregate_corpus(
    gold: list[dict[str, Any]], preds: list[tuple[int, NerInferenceResult]]
) -> BackendMetrics:
    """Compute corpus-level metrics by accumulating raw counts."""
    n_gold = len(gold)
    n_pred = sum(len(p.spans) for _, p in preds)

    matched = 0
    concept_correct = 0
    by_vocab_total: dict[str, int] = {}
    by_vocab_correct: dict[str, int] = {}

    pred_by_note = {nid: pred for nid, pred in preds}
    for note_id in {g["note_id"] for g in gold}:
        note_gold = _gold_for_note(gold, note_id)
        note_pred = pred_by_note.get(note_id)
        if note_pred is None:
            continue
        m = compute_metrics(note_gold, note_pred)
        matched += m.n_matched_spans
        concept_correct += int(m.concept_match_rate * m.n_matched_spans)
        for v, rate in m.concept_match_rate_by_vocab.items():
            note_vocab_count = sum(1 for g in note_gold if g["vocabulary_id"] == v)
            by_vocab_total[v] = by_vocab_total.get(v, 0) + note_vocab_count
            by_vocab_correct[v] = by_vocab_correct.get(v, 0) + int(rate * note_vocab_count)
        # Vocab denominators must reflect *matched* spans of that vocab, not
        # gold count. Recompute below from raw matches.

    # The above is approximate; do a second pass for precise per-vocab.
    by_vocab_total = {}
    by_vocab_correct = {}
    for note_id in {g["note_id"] for g in gold}:
        note_gold = _gold_for_note(gold, note_id)
        note_pred = pred_by_note.get(note_id)
        if note_pred is None:
            continue
        # mimic compute_metrics matching to attribute concept correctness
        # to the gold span's vocabulary precisely.
        pred_taken: set[int] = set()
        for g in note_gold:
            best_i: int | None = None
            best_overlap = 0
            for i, s in enumerate(note_pred.spans):
                ov = max(
                    0,
                    min(int(g["end"]), s.end) - max(int(g["start"]), s.start),
                )
                if ov > best_overlap:
                    best_overlap = ov
                    best_i = i
            if best_i is None or best_i in pred_taken or best_overlap == 0:
                continue
            pred_taken.add(best_i)
            v = str(g["vocabulary_id"])
            by_vocab_total[v] = by_vocab_total.get(v, 0) + 1
            for mp in note_pred.mappings:
                if mp.span_index == best_i and mp.concept_id == int(g["concept_id"]):
                    by_vocab_correct[v] = by_vocab_correct.get(v, 0) + 1
                    break

    precision = matched / n_pred if n_pred else 0.0
    recall = matched / n_gold if n_gold else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    cmr = concept_correct / matched if matched else 0.0
    by_vocab = {v: by_vocab_correct.get(v, 0) / by_vocab_total[v] for v in by_vocab_total}
    return BackendMetrics(
        span_precision=precision,
        span_recall=recall,
        span_f1=f1,
        concept_match_rate=cmr,
        concept_match_rate_by_vocab=by_vocab,
        n_gold_spans=n_gold,
        n_pred_spans=n_pred,
        n_matched_spans=matched,
    )


class NerEvalRunner:
    """Run every configured NER backend over the gold standard and report."""

    def __init__(
        self,
        out_dir: Path | None = None,
        notes_path: Path | None = None,
        gold_path: Path | None = None,
    ) -> None:
        self.out_dir = out_dir or (Path.cwd() / "_eval")
        self.notes_path = notes_path or (_HERE / "notes.ndjson")
        self.gold_path = gold_path or (_HERE / "gold_standard.csv")

    def run_one_backend(
        self,
        name: str,
        backend: NlpBackend,
        notes: list[dict[str, Any]],
        gold: list[dict[str, Any]],
        prompt_version: str = "v0.1.0",
    ) -> _BackendRun:
        preds: list[tuple[int, NerInferenceResult]] = []
        t0 = time.perf_counter()
        err: str | None = None
        try:
            for n in notes:
                preds.append((int(n["note_id"]), backend.infer(n["text"], prompt_version)))
        except Exception as exc:
            err = f"{type(exc).__name__}: {exc}"
            logger.warning("backend %s failed: %s", name, err)
        runtime = time.perf_counter() - t0
        metrics = _aggregate_corpus(gold, preds) if not err else BackendMetrics(0.0, 0.0, 0.0, 0.0)
        return _BackendRun(
            name=name,
            metrics=metrics,
            runtime_seconds=runtime,
            n_notes=len(notes),
            error=err,
        )

    def run_all_backends(
        self,
        backends: Iterable[tuple[str, NlpBackend]] | None = None,
    ) -> NerEvalReport:
        notes = _load_notes(self.notes_path)
        gold = _load_gold(self.gold_path)
        report = NerEvalReport(n_notes=len(notes), n_gold_spans=len(gold))

        bs = list(backends) if backends is not None else _default_backends()
        for name, backend in bs:
            report.runs.append(self.run_one_backend(name, backend, notes, gold))
        # Render
        from runtime.nlp.eval.report import render_report

        self.out_dir.mkdir(parents=True, exist_ok=True)
        out = render_report(report, out_dir=self.out_dir)
        logger.info("eval report written: %s", out)
        return report


def _default_backends() -> list[tuple[str, NlpBackend]]:
    """Construct the three real backends (LLM / SciSpaCy / Llettuce).

    Imports are lazy so the runner can be exercised in CI even when one of
    the upstream packages is unavailable — the failing backend records its
    error in the report rather than crashing the run.
    """
    from runtime.nlp.backends.llm import LlmBackend
    from runtime.nlp.backends.scispacy import SciSpacyBackend

    out: list[tuple[str, NlpBackend]] = [
        ("llm", LlmBackend(provider="ollama")),
        ("scispacy", SciSpacyBackend()),
    ]
    try:
        from runtime.nlp.backends.llettuce import LlettuceBackend

        out.append(("llettuce", LlettuceBackend()))
    except Exception as exc:
        logger.warning("LlettuceBackend unavailable: %s", exc)
    return out
