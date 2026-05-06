"""Per-backend NER metrics: span F1 + concept-mapping accuracy."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from runtime.nlp.types import NerInferenceResult


@dataclass(frozen=True)
class BackendMetrics:
    """Aggregated metrics for one backend across the gold-standard benchmark."""

    span_precision: float
    span_recall: float
    span_f1: float
    # Fraction of matched gold spans where the predicted concept_id matches.
    concept_match_rate: float
    # Per-vocabulary concept_match_rate (e.g. {"SNOMED": 0.81, "RxNorm": 0.62}).
    concept_match_rate_by_vocab: dict[str, float] = field(default_factory=dict)
    n_gold_spans: int = 0
    n_pred_spans: int = 0
    n_matched_spans: int = 0


def _overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    return max(0, min(a_end, b_end) - max(a_start, b_start))


def _match_span(gold: dict[str, Any], pred_spans: list[Any]) -> int | None:
    """Return index into pred_spans of the best-matching predicted span, or None."""
    best_i: int | None = None
    best_overlap = 0
    for i, s in enumerate(pred_spans):
        ov = _overlap(int(gold["start"]), int(gold["end"]), s.start, s.end)
        if ov > best_overlap:
            best_overlap = ov
            best_i = i
    if best_overlap == 0:
        return None
    return best_i


def compute_metrics(
    gold: Iterable[dict[str, Any]],
    pred: NerInferenceResult,
) -> BackendMetrics:
    """Compute span-level P/R/F1 + concept_match_rate vs a gold list of dicts."""
    gold_list = list(gold)
    n_gold = len(gold_list)
    n_pred = len(pred.spans)

    matched = 0
    concept_correct = 0
    by_vocab_total: dict[str, int] = {}
    by_vocab_correct: dict[str, int] = {}

    pred_taken: set[int] = set()
    for g in gold_list:
        idx = _match_span(g, pred.spans)
        if idx is None or idx in pred_taken:
            continue
        pred_taken.add(idx)
        matched += 1

        # concept-level: did the prediction map this span to the right concept?
        gold_vocab = str(g["vocabulary_id"])
        gold_cid = int(g["concept_id"])
        by_vocab_total[gold_vocab] = by_vocab_total.get(gold_vocab, 0) + 1
        for m in pred.mappings:
            if m.span_index == idx and m.concept_id == gold_cid:
                concept_correct += 1
                by_vocab_correct[gold_vocab] = by_vocab_correct.get(gold_vocab, 0) + 1
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
