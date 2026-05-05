"""E2E for parthenon_ner_llm against the synthetic fixture (Task 13).

Uses an in-process stub LLM that returns the gold-standard rows as the
NER output. This validates the recall-harness shape and the integration
between the FHIR ingest output and the NoteNlpNode-equivalent batch
inference path.

The real ≥90% recall benchmark against MedGemma runs in the live-LLM CI
lane added by Task 14 (gated to schedule + workflow_dispatch). This test
runs in the regular CI gate.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import pytest

from runtime.nlp.eval import compute_recall, load_gold_standard
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan

REPO = Path(__file__).resolve().parents[2]
MANIFEST_DIR = REPO / "manifests" / "parthenon_ner_llm"
FIXTURE = MANIFEST_DIR / "fixtures" / "synthetic" / "DocumentReference.ndjson"
GOLD = MANIFEST_DIR / "validation" / "expected" / "gold_standard.csv"


def _decode_note(doc_ref: dict) -> str:
    """Pull the plain-text body out of a DocumentReference fixture."""
    attachment = doc_ref["content"][0]["attachment"]
    return base64.standard_b64decode(attachment["data"]).decode("utf-8")


def _stub_inference_for_note(note_id: str, gold_path: Path) -> NerInferenceResult:
    """Build the NerInferenceResult that a perfect backend would emit for a note."""
    rows = [g for g in load_gold_standard(gold_path) if g.note_id == note_id]
    spans = [
        NerSpan(start=g.start, end=g.end, text="x" * (g.end - g.start), label=g.label) for g in rows
    ]
    mappings = [
        NerConceptMapping(
            span_index=i,
            concept_id=g.concept_id,
            vocabulary_id=g.vocabulary_id,
            confidence=0.99,
        )
        for i, g in enumerate(rows)
    ]
    return NerInferenceResult(
        spans=spans, mappings=mappings, model_name="stub", prompt_version="v0.1.0"
    )


def test_recall_harness_against_gold_standard() -> None:
    """A backend that emits the gold rows must score 1.0 recall on both metrics."""
    assert FIXTURE.is_file(), "run build_fixtures.py to materialize the synthetic corpus"
    assert GOLD.is_file()

    predictions: list[tuple[str, NerInferenceResult]] = []
    for line in FIXTURE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        doc = json.loads(line)
        note_id = doc["id"]
        # _decode_note is exercised here to confirm the fixture is wire-compatible
        # with the FhirResourceNode + downstream attachment-decoder flow.
        _decode_note(doc)
        predictions.append((note_id, _stub_inference_for_note(note_id, GOLD)))

    gold = load_gold_standard(GOLD)
    report = compute_recall(gold=gold, predictions=predictions)

    assert report.span_recall == pytest.approx(1.0)
    assert report.concept_match_rate == pytest.approx(1.0)
    assert report.gold_total >= 30  # 10-note default corpus produces ~30 gold rows


def test_partial_backend_meets_90_pct_threshold() -> None:
    """Drop one prediction per 10 notes → ~90% recall — meets the spec §6 threshold."""
    gold = load_gold_standard(GOLD)
    predictions: list[tuple[str, NerInferenceResult]] = []

    # Construct stub predictions, dropping the first span on every 10th note
    # to simulate a real-LLM imperfect-recall scenario.
    by_note: dict[str, list] = {}
    for g in gold:
        by_note.setdefault(g.note_id, []).append(g)

    for idx, (note_id, rows) in enumerate(sorted(by_note.items())):
        if idx % 10 == 0 and rows:
            rows = rows[1:]  # drop one
        spans = [
            NerSpan(start=g.start, end=g.end, text="x" * (g.end - g.start), label=g.label)
            for g in rows
        ]
        mappings = [
            NerConceptMapping(
                span_index=i,
                concept_id=g.concept_id,
                vocabulary_id=g.vocabulary_id,
                confidence=0.95,
            )
            for i, g in enumerate(rows)
        ]
        predictions.append(
            (
                note_id,
                NerInferenceResult(
                    spans=spans, mappings=mappings, model_name="stub", prompt_version="v0.1.0"
                ),
            )
        )

    report = compute_recall(gold=gold, predictions=predictions)
    # Spec §6 threshold: ≥0.90.
    assert report.span_recall >= 0.90
