"""Plan 5 Task 10: ARTEMIS E2E shape — recall ≥80% against gold standard.

Drives the matcher in-process against the synthetic cohort fixture and
asserts ≥0.80 recall vs the gold-standard regimens CSV. The full
testcontainers Postgres run is gated until the Phase 0 sql_node gains
the file:// reader (same gating as Plan 4's E2E).
"""

from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

from runtime.oncology.matcher import RegimenMatcher, load_pattern_library

MANIFEST_DIR = Path(__file__).resolve().parents[2] / "manifests" / "artemis_chemo_regimens"


def _load_cohort() -> list[dict]:
    body = json.loads(
        (MANIFEST_DIR / "fixtures" / "synthetic" / "cohort.json").read_text(encoding="utf-8")
    )
    rows = []
    for r in body["drug_exposures"]:
        rows.append(
            {
                "person_id": r["person_id"],
                "drug_concept_id": r["drug_concept_id"],
                "drug_exposure_start_date": date.fromisoformat(r["drug_exposure_start_date"]),
                "drug_exposure_id": r["drug_exposure_id"],
            }
        )
    return rows


def _load_gold() -> list[dict]:
    path = MANIFEST_DIR / "validation" / "expected" / "regimens.csv"
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                {
                    "person_id": int(r["person_id"]),
                    "regimen_name": r["regimen_name"],
                    "episode_start_date": date.fromisoformat(r["episode_start_date"]),
                }
            )
    return rows


def test_artemis_recovers_at_least_80_pct_of_regimens() -> None:
    """≥80% (16 of 20) gold regimens correctly identified."""
    patterns = load_pattern_library()
    matcher = RegimenMatcher(patterns=patterns, window_days=7, min_coverage=0.75)

    matches = matcher.match(_load_cohort())
    by_person = {(m.person_id, m.regimen_name) for m in matches}

    gold = _load_gold()
    hits = sum(1 for g in gold if (g["person_id"], g["regimen_name"]) in by_person)
    recall = hits / len(gold)

    assert recall >= 0.80, f"recall {recall:.2f} below 0.80 threshold (hits={hits}/{len(gold)})"
