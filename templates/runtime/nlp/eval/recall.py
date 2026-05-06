"""Recall computation against a gold-standard CSV.

A predicted span counts as a recall hit if there is a gold row with the
same ``(note_id, start, end, label)``. ``concept_match_rate`` is the
fraction of those hits where the predicted ``concept_id`` matches the
gold ``concept_id`` — the metric Plan 3's eval harness uses for the
Llettuce graduation criterion.
"""

from __future__ import annotations

import csv
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from runtime.nlp.types import NerInferenceResult


@dataclass(frozen=True)
class GoldRow:
    note_id: str
    start: int
    end: int
    label: str
    concept_id: int
    vocabulary_id: str


@dataclass(frozen=True)
class RecallReport:
    span_recall: float
    concept_match_rate: float
    gold_total: int
    span_hits: int
    concept_hits: int


def load_gold_standard(path: Path) -> list[GoldRow]:
    rows: list[GoldRow] = []
    with path.open("r", encoding="utf-8") as f:
        for raw in csv.DictReader(f):
            rows.append(
                GoldRow(
                    note_id=raw["note_id"],
                    start=int(raw["start"]),
                    end=int(raw["end"]),
                    label=raw["label"],
                    concept_id=int(raw["concept_id"]),
                    vocabulary_id=raw["vocabulary_id"],
                )
            )
    return rows


def compute_recall(
    *,
    gold: Sequence[GoldRow],
    predictions: Iterable[tuple[str, NerInferenceResult]],
) -> RecallReport:
    """Compute span + concept recall against ``gold``.

    ``predictions`` is an iterable of ``(note_id, NerInferenceResult)``
    pairs — one per ingested clinical note. Span hit = exact offset+label
    match on the same note_id. Concept hit = span hit AND predicted
    concept_id == gold concept_id.
    """
    gold_by_note: dict[str, list[GoldRow]] = {}
    for g in gold:
        gold_by_note.setdefault(g.note_id, []).append(g)

    span_hits = 0
    concept_hits = 0
    for note_id, result in predictions:
        gold_rows = gold_by_note.get(note_id, [])
        if not gold_rows:
            continue
        # Index predicted concept_id by span_index so we can resolve quickly.
        pred_concept_by_idx: dict[int, int] = {m.span_index: m.concept_id for m in result.mappings}
        for span_idx, span in enumerate(result.spans):
            for g in gold_rows:
                if span.start == g.start and span.end == g.end and span.label == g.label:
                    span_hits += 1
                    if pred_concept_by_idx.get(span_idx) == g.concept_id:
                        concept_hits += 1
                    break

    total = len(gold)
    return RecallReport(
        span_recall=span_hits / total if total else 0.0,
        concept_match_rate=concept_hits / total if total else 0.0,
        gold_total=total,
        span_hits=span_hits,
        concept_hits=concept_hits,
    )
