"""Plan 3 Task 4: gold-standard benchmark fixture shape."""

from __future__ import annotations

import csv
import json
from pathlib import Path

_BASE = Path(__file__).resolve().parents[2] / "runtime" / "nlp" / "eval"


def test_gold_standard_csv_exists() -> None:
    assert (_BASE / "gold_standard.csv").is_file()


def test_gold_standard_has_required_columns() -> None:
    with (_BASE / "gold_standard.csv").open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = set(reader.fieldnames or [])
        expected = {
            "note_id",
            "start",
            "end",
            "text",
            "label",
            "concept_id",
            "vocabulary_id",
        }
        assert expected <= cols


def test_notes_ndjson_has_100_entries() -> None:
    lines = [
        ln for ln in (_BASE / "notes.ndjson").read_text(encoding="utf-8").splitlines() if ln.strip()
    ]
    assert len(lines) == 100
    one = json.loads(lines[0])
    assert {"note_id", "text"} <= set(one.keys())


def test_gold_offsets_are_correct() -> None:
    """Gold offsets must point at the recorded surface in the corresponding note."""
    notes = {
        json.loads(ln)["note_id"]: json.loads(ln)["text"]
        for ln in (_BASE / "notes.ndjson").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    }
    with (_BASE / "gold_standard.csv").open("r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            text = notes[int(r["note_id"])]
            assert text[int(r["start"]) : int(r["end"])] == r["text"]


def test_gold_includes_all_three_target_vocabularies() -> None:
    vocabs = set()
    with (_BASE / "gold_standard.csv").open("r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            vocabs.add(r["vocabulary_id"])
    assert {"SNOMED", "RxNorm", "LOINC"} <= vocabs
