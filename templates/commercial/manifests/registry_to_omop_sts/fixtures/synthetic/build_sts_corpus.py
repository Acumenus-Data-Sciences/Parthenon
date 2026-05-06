"""Synthetic STS corpus builder — deterministic with seed=42.

Phase 3 Plan 4B Task 6 (T-022B). Produces a 50-surgery STS CSV corpus
for the validation E2E. Mix:

- 50 surgeries across 50 patients
- 5 procedure categories (CABG, Valve, Aortic, Combined, Other)
- AKI / stroke / sepsis / reoperation complications spread across rows
  (deterministic mod-N pattern)
- 10% mortality (5 of 50)
"""

from __future__ import annotations

import csv
import io
import random
from dataclasses import dataclass
from typing import Final

# (procedure_category, primary_cpt) pool.
_PROCEDURES: Final[list[tuple[str, str]]] = [
    ("CABG", "33533"),
    ("Valve", "33405"),
    ("Aortic", "33860"),
    ("Combined", "33536"),
    ("Other", "33675"),
]

_DIAGNOSES_PRIMARY: Final[list[str]] = [
    "I25.10",  # ASHD without angina
    "I35.0",  # Aortic stenosis
    "I71.4",  # AAA without rupture
    "I05.0",  # Mitral stenosis
    "I50.32",  # Chronic diastolic HF
]


@dataclass(frozen=True)
class _SurgerySpec:
    seed_idx: int
    record_id: str
    patient_id: str
    surgery_date: str  # CCYYMMDD
    patient_age: int
    gender: str
    hospital_id: str
    surgeon_id: str
    ejection_fraction: str
    nyha_class: int
    primary_diagnosis: str
    secondary_diagnoses: str
    procedure_category: str
    primary_procedure_code: str
    secondary_procedure_codes: str
    postop_aki: str
    postop_stroke: str
    postop_reoperation: str
    postop_sepsis: str
    length_of_stay: int
    discharge_disposition: str
    mortality_30day: str


def build_corpus(*, seed: int = 42, n_surgeries: int = 50) -> str:
    """Build a deterministic STS CSV corpus.

    Args:
        seed: RNG seed; same seed -> same output.
        n_surgeries: Total surgeries to generate. Must be >= 1.

    Returns:
        A CSV string with the 21-column STS header + n_surgeries data rows.
    """
    if n_surgeries < 1:
        raise ValueError(f"n_surgeries must be >= 1; got {n_surgeries}")

    rng = random.Random(seed)
    specs: list[_SurgerySpec] = []
    for i in range(1, n_surgeries + 1):
        proc = _PROCEDURES[(i - 1) % len(_PROCEDURES)]
        primary_dx = _DIAGNOSES_PRIMARY[(i - 1) % len(_DIAGNOSES_PRIMARY)]
        # Vary secondary codes a little.
        secondary_dx = "I50.32;E11.9" if i % 2 == 0 else ""
        secondary_proc = "33510" if proc[0] == "CABG" else ""
        # Complications spread by mod-N so the fixture has variety.
        aki = "yes" if i % 7 == 0 else "no"
        stroke = "yes" if i % 11 == 0 else "no"
        reop = "yes" if i % 13 == 0 else "no"
        sepsis = "yes" if i % 9 == 0 else "no"
        mortality = "yes" if i % 10 == 0 else "no"
        disposition = "Death" if mortality == "yes" else "Home" if i % 3 != 0 else "SNF"
        specs.append(
            _SurgerySpec(
                seed_idx=i,
                record_id=f"STS-{i:05d}",
                patient_id=f"PAT{i:05d}",
                surgery_date=f"2024{((i - 1) % 12) + 1:02d}{((i - 1) % 28) + 1:02d}",
                patient_age=50 + rng.randint(0, 35),
                gender=rng.choice(("M", "F")),
                hospital_id=f"H{(i % 10) + 1:03d}",
                surgeon_id=f"S{(i % 25) + 1:03d}",
                ejection_fraction=f"{30 + rng.randint(0, 40):.1f}",
                nyha_class=rng.randint(1, 4),
                primary_diagnosis=primary_dx,
                secondary_diagnoses=secondary_dx,
                procedure_category=proc[0],
                primary_procedure_code=proc[1],
                secondary_procedure_codes=secondary_proc,
                postop_aki=aki,
                postop_stroke=stroke,
                postop_reoperation=reop,
                postop_sepsis=sepsis,
                length_of_stay=4 + rng.randint(0, 14),
                discharge_disposition=disposition,
                mortality_30day=mortality,
            )
        )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "RecordID",
            "PatientID",
            "SurgeryDate",
            "PatientAge",
            "Gender",
            "HospitalID",
            "SurgeonID",
            "EjectionFraction",
            "NyhaClass",
            "PrimaryDiagnosis",
            "SecondaryDiagnoses",
            "ProcedureID",
            "ProcedureCode_Primary",
            "ProcedureCode_Secondary",
            "PostOpComplication_AKI",
            "PostOpComplication_Stroke",
            "PostOpComplication_Reoperation",
            "PostOpComplication_Sepsis",
            "LengthOfStay",
            "DischargeDisposition",
            "Mortality_30Day",
        ]
    )
    for s in specs:
        writer.writerow(
            [
                s.record_id,
                s.patient_id,
                s.surgery_date,
                str(s.patient_age),
                s.gender,
                s.hospital_id,
                s.surgeon_id,
                s.ejection_fraction,
                str(s.nyha_class),
                s.primary_diagnosis,
                s.secondary_diagnoses,
                s.procedure_category,
                s.primary_procedure_code,
                s.secondary_procedure_codes,
                s.postop_aki,
                s.postop_stroke,
                s.postop_reoperation,
                s.postop_sepsis,
                str(s.length_of_stay),
                s.discharge_disposition,
                s.mortality_30day,
            ]
        )

    return buf.getvalue()


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    print(build_corpus(seed=42, n_surgeries=50))
