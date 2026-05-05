"""Synthetic FHIR fixture generator for performance acceptance testing."""

from __future__ import annotations

import json
import random
from pathlib import Path

LOINC_CODES = ["8480-6", "29463-7", "8302-2", "39156-5"]


def generate_observations(out_dir: Path, *, n_observations: int, seed: int = 42) -> int:
    """Write ``n_observations`` + 1 Patient + 1 Encounter to NDJSON files.

    Returns total bytes written for the Observation NDJSON file (the largest
    artifact; useful for size-budget assertions).
    """
    rng = random.Random(seed)
    out_dir.mkdir(parents=True, exist_ok=True)

    patient = {
        "resourceType": "Patient",
        "id": "p1",
        "meta": {
            "tag": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
                    "code": "SYNTHETIC",
                }
            ]
        },
        "gender": "male",
        "birthDate": "1970-06-15",
    }
    (out_dir / "Patient.ndjson").write_text(json.dumps(patient) + "\n", encoding="utf-8")

    encounter = {
        "resourceType": "Encounter",
        "id": "e1",
        "meta": {
            "tag": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
                    "code": "SYNTHETIC",
                }
            ]
        },
        "status": "finished",
        "class": {"code": "AMB"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01T08:00:00Z", "end": "2026-04-01T17:00:00Z"},
    }
    (out_dir / "Encounter.ndjson").write_text(json.dumps(encounter) + "\n", encoding="utf-8")

    obs_path = out_dir / "Observation.ndjson"
    bytes_written = 0
    with obs_path.open("w", encoding="utf-8") as f:
        for i in range(n_observations):
            code = rng.choice(LOINC_CODES)
            obs = {
                "resourceType": "Observation",
                "id": f"o{i}",
                "status": "final",
                "category": [{"coding": [{"code": "vital-signs"}]}],
                "code": {"coding": [{"system": "http://loinc.org", "code": code}]},
                "subject": {"reference": "Patient/p1"},
                "encounter": {"reference": "Encounter/e1"},
                "effectiveDateTime": "2026-04-01T08:30:00Z",
                "valueQuantity": {"value": rng.uniform(70, 180), "unit": "mmHg"},
            }
            line = json.dumps(obs) + "\n"
            f.write(line)
            bytes_written += len(line)
    return bytes_written
