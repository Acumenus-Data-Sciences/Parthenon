"""Generate the 100-note gold-standard NER benchmark.

Deterministic via fixed RNG seed. Produces:
- ``notes.ndjson`` — 100 synthetic clinical notes (one JSON object per line:
  ``{"note_id": int, "text": str}``).
- ``gold_standard.csv`` — ~400 rows of (note_id, start, end, text, label,
  concept_id, vocabulary_id) tuples. Concept_ids are real OMOP standard
  concepts taken from the SNOMED / RxNorm / LOINC vocabularies; labels
  use Plan 1's coarse domain set (condition/drug/procedure/measurement).

Run:
    python -m runtime.nlp.eval.build_gold_standard

Output goes next to this module (``runtime/nlp/eval/``).
"""

from __future__ import annotations

import csv
import json
import random
from pathlib import Path

# Curated OMOP standard concepts (concept_id, vocabulary_id, label, surface).
# These are real concept_ids from omop.concept where standard_concept='S'.
_CONCEPTS: list[tuple[int, str, str, str]] = [
    # SNOMED conditions
    (4030518, "SNOMED", "condition", "chest pain"),
    (4344158, "SNOMED", "condition", "headache"),
    (4145356, "SNOMED", "condition", "shortness of breath"),
    (4329847, "SNOMED", "condition", "myocardial infarction"),
    (201826, "SNOMED", "condition", "type 2 diabetes mellitus"),
    (320128, "SNOMED", "condition", "essential hypertension"),
    (255848, "SNOMED", "condition", "pneumonia"),
    (4329041, "SNOMED", "condition", "atrial fibrillation"),
    (132797, "SNOMED", "condition", "sepsis"),
    (192671, "SNOMED", "condition", "gastroesophageal reflux disease"),
    # RxNorm drugs
    (1308216, "RxNorm", "drug", "lisinopril"),
    (1503297, "RxNorm", "drug", "metformin"),
    (1112807, "RxNorm", "drug", "aspirin"),
    (1551860, "RxNorm", "drug", "atorvastatin"),
    (40213227, "RxNorm", "drug", "metoprolol"),
    (1734104, "RxNorm", "drug", "warfarin"),
    (19078461, "RxNorm", "drug", "amoxicillin"),
    (1326303, "RxNorm", "drug", "furosemide"),
    # SNOMED procedures
    (4337027, "SNOMED", "procedure", "echocardiogram"),
    (4279553, "SNOMED", "procedure", "coronary angiography"),
    (4133138, "SNOMED", "procedure", "appendectomy"),
    (4180938, "SNOMED", "procedure", "colonoscopy"),
    # LOINC measurements
    (3027018, "LOINC", "measurement", "heart rate"),
    (3004249, "LOINC", "measurement", "systolic blood pressure"),
    (3013682, "LOINC", "measurement", "blood urea nitrogen"),
    (3000963, "LOINC", "measurement", "hemoglobin"),
    (3013721, "LOINC", "measurement", "creatinine"),
    (3019550, "LOINC", "measurement", "sodium"),
]

_FRAMES = [
    "Patient reports {x}.",
    "History significant for {x}.",
    "Started on {x} this morning.",
    "Workup ordered: {x}.",
    "Persistent {x} since admission.",
    "Improvement noted in {x}.",
    "No further evidence of {x}.",
    "Differential includes {x} and other conditions.",
    "Plan: continue {x} as inpatient.",
    "Daily monitoring of {x} ongoing.",
]


def build(out_dir: Path, n_notes: int = 100, seed: int = 42) -> tuple[Path, Path]:
    rng = random.Random(seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    notes_path = out_dir / "notes.ndjson"
    gold_path = out_dir / "gold_standard.csv"

    notes: list[dict[str, object]] = []
    rows: list[dict[str, object]] = []

    for note_id in range(1, n_notes + 1):
        # 3-5 spans per note.
        n_spans = rng.randint(3, 5)
        chosen = rng.sample(_CONCEPTS, k=n_spans)
        sentences: list[str] = []
        for _cid, _vocab, _label, surface in chosen:
            frame = rng.choice(_FRAMES)
            sentence = frame.format(x=surface)
            sentences.append(sentence)
        text = " ".join(sentences)

        # Re-find each surface to record exact char offsets.
        cursor = 0
        for cid, vocab, label, surface in chosen:
            idx = text.find(surface, cursor)
            if idx < 0:
                # Should not happen — surface came from the assembled text.
                continue
            rows.append(
                {
                    "note_id": note_id,
                    "start": idx,
                    "end": idx + len(surface),
                    "text": surface,
                    "label": label,
                    "concept_id": cid,
                    "vocabulary_id": vocab,
                }
            )
            cursor = idx + len(surface)
        notes.append({"note_id": note_id, "text": text})

    # Write notes (NDJSON).
    with notes_path.open("w", encoding="utf-8") as f:
        for n in notes:
            f.write(json.dumps(n) + "\n")

    # Write gold standard (CSV).
    fieldnames = ["note_id", "start", "end", "text", "label", "concept_id", "vocabulary_id"]
    with gold_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    return notes_path, gold_path


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    notes, gold = build(here, n_notes=100, seed=42)
    print(f"Wrote {notes} and {gold}")
