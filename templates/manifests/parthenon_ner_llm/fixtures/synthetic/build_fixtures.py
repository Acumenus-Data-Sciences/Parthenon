"""Generate synthetic FHIR DocumentReference + companion gold-standard CSV.

Produces a deterministic corpus of clinical-note fixtures keyed off a fixed
RNG seed so reruns are byte-identical. Defaults to 10 notes for fast
test runs; the Phase 2 spec §6 acceptance criterion of 100 notes is
opt-in via ``--count 100``.

Outputs (written next to this script):
    DocumentReference.ndjson         FHIR R4 DocumentReference resources
    gold_standard.csv                One row per expected NER span +
                                     concept mapping. Schema:
                                     note_id, start, end, text, label,
                                     concept_id, vocabulary_id

Each note is composed from a small set of clinical-phrase templates
parameterized over (condition, drug, measurement, procedure) tuples. The
gold standard rows are computed at generation time from the template
parameters, so the recall metric in Task 13 / the live-LLM lane is
mechanically verifiable.

Run:
    uv run python build_fixtures.py [--count 10]
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import random
from dataclasses import dataclass
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent

# (display_text, OMOP concept_id, vocabulary, NER label)
CONDITIONS: list[tuple[str, int, str]] = [
    ("chest pain", 4030518, "SNOMED"),
    ("hypertension", 4267416, "SNOMED"),
    ("type 2 diabetes mellitus", 201826, "SNOMED"),
    ("asthma", 4112343, "SNOMED"),
    ("acute pharyngitis", 4029798, "SNOMED"),
    ("urinary tract infection", 4053838, "SNOMED"),
]

DRUGS: list[tuple[str, int, str]] = [
    ("lisinopril", 1308216, "RxNorm"),
    ("metformin", 1503297, "RxNorm"),
    ("amoxicillin", 1713332, "RxNorm"),
    ("albuterol", 1154343, "RxNorm"),
    ("atorvastatin", 1545958, "RxNorm"),
]

MEASUREMENTS: list[tuple[str, int, str]] = [
    ("systolic blood pressure", 3004249, "LOINC"),
    ("body weight", 3025315, "LOINC"),
    ("hemoglobin A1c", 3004410, "LOINC"),
    ("white blood cells", 3010813, "LOINC"),
]

PROCEDURES: list[tuple[str, int, str]] = [
    ("appendectomy", 4181995, "SNOMED"),
    ("mri brain", 4087933, "SNOMED"),
    ("electrocardiogram", 4019823, "SNOMED"),
]


@dataclass(frozen=True)
class GoldRow:
    note_id: str
    start: int
    end: int
    text: str
    label: str
    concept_id: int
    vocabulary_id: str


def _build_note(rng: random.Random, note_id: str) -> tuple[str, list[GoldRow]]:
    """Compose a single clinical note from 2-4 randomly chosen entities."""
    rows: list[GoldRow] = []
    parts: list[str] = []
    cursor = 0

    def add(prefix: str, kind: str, choices: list[tuple[str, int, str]]) -> None:
        nonlocal cursor
        text, cid, vocab = rng.choice(choices)
        parts.append(prefix)
        cursor += len(prefix)
        rows.append(
            GoldRow(
                note_id=note_id,
                start=cursor,
                end=cursor + len(text),
                text=text,
                label=kind,
                concept_id=cid,
                vocabulary_id=vocab,
            )
        )
        parts.append(text)
        cursor += len(text)

    # Always include at least one condition + one drug.
    add("Patient reports ", "condition", CONDITIONS)
    add(". Started ", "drug", DRUGS)
    parts.append(" 10 mg daily.")
    cursor += len(" 10 mg daily.")

    if rng.random() < 0.6:
        add(" Vital sign: ", "measurement", MEASUREMENTS)
        parts.append(" elevated.")
        cursor += len(" elevated.")
    if rng.random() < 0.4:
        add(" Procedure: ", "procedure", PROCEDURES)
        parts.append(".")
        cursor += 1

    return "".join(parts), rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--count",
        type=int,
        default=10,
        help="Number of notes (default 10; spec §6 benchmark = 100).",
    )
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)

    ndjson_lines: list[str] = []
    gold_rows: list[GoldRow] = []

    for i in range(args.count):
        patient_id = f"p{i + 1:04d}"
        note_id = f"doc-{i + 1:04d}"
        body, rows = _build_note(rng, note_id)
        gold_rows.extend(rows)

        encoded = base64.standard_b64encode(body.encode("utf-8")).decode("ascii")
        doc = {
            "resourceType": "DocumentReference",
            "id": note_id,
            "status": "current",
            "type": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "11506-3",
                        "display": "Progress note",
                    }
                ]
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "date": "2026-04-01T10:00:00Z",
            "content": [
                {
                    "attachment": {
                        "contentType": "text/plain",
                        "data": encoded,
                        "size": len(body),
                        "hash": hashlib.sha1(body.encode("utf-8")).hexdigest(),
                    }
                }
            ],
        }
        ndjson_lines.append(json.dumps(doc, separators=(",", ":")))

    (OUT_DIR / "DocumentReference.ndjson").write_text(
        "\n".join(ndjson_lines) + "\n", encoding="utf-8"
    )

    # Companion gold standard — used by Task 13 and the live-LLM lane.
    gold_path = OUT_DIR.parent.parent / "validation" / "expected" / "gold_standard.csv"
    gold_path.parent.mkdir(parents=True, exist_ok=True)
    with gold_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["note_id", "start", "end", "text", "label", "concept_id", "vocabulary_id"],
        )
        w.writeheader()
        for row in gold_rows:
            w.writerow(
                {
                    "note_id": row.note_id,
                    "start": row.start,
                    "end": row.end,
                    "text": row.text,
                    "label": row.label,
                    "concept_id": row.concept_id,
                    "vocabulary_id": row.vocabulary_id,
                }
            )

    print(
        f"wrote {args.count} DocumentReference resources + " f"{len(gold_rows)} gold-standard rows"
    )


if __name__ == "__main__":
    main()
