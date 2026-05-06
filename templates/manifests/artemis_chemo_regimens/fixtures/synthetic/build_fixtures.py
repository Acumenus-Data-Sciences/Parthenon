"""Synthetic 20-patient by 5-regimen chemo cohort.

Deterministic via fixed RNG seed. Output is a JSON document at
``cohort.json`` containing drug_exposure rows ready to load into a
testcontainers Postgres for the Plan 5 E2E.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent

REGIMENS = {
    "FOLFIRINOX": [1153888, 1190795, 1736776, 1736816],
    "FOLFOX": [1153888, 1190795, 1736816],
    "R-CHOP": [1314865, 1310317, 1338512, 1395557, 1551099],
    "AC-T": [1338512, 1310317, 1378382],
    "Carboplatin+Paclitaxel": [1344905, 1378382],
}


def main() -> None:
    rng = random.Random(42)

    drug_exposures = []
    gold_matches = []
    drug_exposure_id = 1
    person_id = 1

    for regimen_name, drug_concept_ids in REGIMENS.items():
        for _ in range(4):  # 4 patients per regimen
            anchor = date(2026, 1, 1) + timedelta(days=rng.randint(0, 365))
            de_ids_for_match = []
            for offset, concept_id in enumerate(drug_concept_ids):
                # All drugs within the 7-day window starting at anchor.
                day = anchor + timedelta(days=offset % 4)
                drug_exposures.append(
                    {
                        "drug_exposure_id": drug_exposure_id,
                        "person_id": person_id,
                        "drug_concept_id": concept_id,
                        "drug_exposure_start_date": day.isoformat(),
                    }
                )
                de_ids_for_match.append(drug_exposure_id)
                drug_exposure_id += 1
            gold_matches.append(
                {
                    "person_id": person_id,
                    "regimen_name": regimen_name,
                    "episode_start_date": anchor.isoformat(),
                }
            )
            person_id += 1

    cohort_path = OUT / "cohort.json"
    cohort_path.write_text(
        json.dumps({"drug_exposures": drug_exposures}, indent=2),
        encoding="utf-8",
    )

    gold_path = OUT.parent.parent / "validation" / "expected" / "regimens.csv"
    gold_path.parent.mkdir(parents=True, exist_ok=True)
    with gold_path.open("w", encoding="utf-8") as f:
        f.write("person_id,regimen_name,episode_start_date\n")
        for g in gold_matches:
            f.write(f"{g['person_id']},{g['regimen_name']},{g['episode_start_date']}\n")

    print(
        f"wrote {len(drug_exposures)} drug_exposure rows "
        f"+ {len(gold_matches)} gold-standard regimens "
        f"into {OUT}"
    )


if __name__ == "__main__":
    main()
