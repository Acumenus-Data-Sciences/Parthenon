"""Synthetic NCDR CathPCI corpus builder — deterministic with seed=42.

Phase 3 Plan 4C Task 6 (T-022C). 50-PCI corpus for the validation E2E.
Mix:

- 10 diagnostic-only caths (lesion_count=0, stent_count=0, empty UDI/type lists)
- 30 single-stent PCIs
- 10 multi-stent PCIs (2-3 stents each)
- Stent type distribution: 70% DES, 20% BMS, 10% BVS
- 20% of records carry at least one postop complication; 5% mortality
"""

from __future__ import annotations

import csv
import io
import random
from dataclasses import dataclass
from typing import Final

_PROCEDURE_CPTS: Final[list[str]] = ["92928", "92933", "92920", "92924"]
_DIAGNOSES: Final[list[str]] = ["I21.4", "I25.10", "I20.0", "I22.9"]
# Stent UDI prefix is 0871472... (publicly used for example UDIs);
# we generate distinct trailing digits per stent.


@dataclass(frozen=True)
class _PCISpec:
    seed_idx: int
    record_id: str
    patient_id: str
    procedure_date: str
    patient_age: int
    gender: str
    hospital_id: str
    operator_npi: str
    preop_diagnosis: str
    ef: str
    cardiac_index: str
    lesion_count: int
    lesion_segments: str
    primary_cpt: str
    stent_count: int
    stent_udis: str
    stent_types: str
    bleeding: str
    aki: str
    stroke: str
    los: int
    mortality: str


def _build_stents(n: int, rng: random.Random, seed_idx: int) -> tuple[str, str]:
    """Returns (udis_str, types_str) — parallel ; -delimited lists."""
    if n == 0:
        return "", ""
    types = []
    udis = []
    for k in range(n):
        roll = rng.random()
        if roll < 0.7:
            stent_type = "DES"
        elif roll < 0.9:
            stent_type = "BMS"
        else:
            stent_type = "BVS"
        types.append(stent_type)
        # UDI: 14-digit numeric per FDA convention
        udis.append(f"08714729{seed_idx:04d}{k:02d}")
    return ";".join(udis), ";".join(types)


def build_corpus(*, seed: int = 42, n_pcis: int = 50) -> str:
    """Build a deterministic NCDR CathPCI CSV corpus."""
    if n_pcis < 1:
        raise ValueError(f"n_pcis must be >= 1; got {n_pcis}")

    rng = random.Random(seed)
    specs: list[_PCISpec] = []
    for i in range(1, n_pcis + 1):
        # Deterministic PCI-shape mix:
        # i 1..10  -> diagnostic only
        # i 11..40 -> single stent
        # i 41..50 -> multi-stent
        if i <= 10:
            lesion_n, stent_n = 0, 0
        elif i <= 40:
            lesion_n, stent_n = 1, 1
        else:
            lesion_n = rng.randint(2, 3)
            stent_n = lesion_n  # one stent per lesion in v0.1 fixture
        udis, types = _build_stents(stent_n, rng, i)
        lesion_segments = ";".join(str(s) for s in rng.sample(range(1, 17), k=lesion_n))
        # Complications spread by mod-N + 5% mortality (mod-20)
        bleeding = "yes" if i % 11 == 0 else "no"
        aki = "yes" if i % 7 == 0 else "no"
        stroke = "yes" if i % 13 == 0 else "no"
        mortality = "yes" if i % 20 == 0 else "no"
        specs.append(
            _PCISpec(
                seed_idx=i,
                record_id=f"PCI-{i:05d}",
                patient_id=f"PAT{i:05d}",
                procedure_date=f"2024{((i - 1) % 12) + 1:02d}{((i - 1) % 28) + 1:02d}",
                patient_age=50 + rng.randint(0, 35),
                gender=rng.choice(("M", "F")),
                hospital_id=f"H{(i % 10) + 1:03d}",
                operator_npi="1234567893",  # public CMS test NPI; same on every row
                preop_diagnosis=rng.choice(_DIAGNOSES),
                ef=f"{30 + rng.randint(0, 40):.1f}",
                cardiac_index=f"{2.0 + rng.uniform(0, 2):.2f}",
                lesion_count=lesion_n,
                lesion_segments=lesion_segments,
                primary_cpt=rng.choice(_PROCEDURE_CPTS),
                stent_count=stent_n,
                stent_udis=udis,
                stent_types=types,
                bleeding=bleeding,
                aki=aki,
                stroke=stroke,
                los=1 + rng.randint(0, 6),
                mortality=mortality,
            )
        )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "PCIRecordID",
            "PatientID",
            "ProcedureDate",
            "PatientAge",
            "Gender",
            "HospitalID",
            "OperatorNPI",
            "PreOpDiagnosis",
            "HemodynamicEjectionFraction",
            "HemodynamicCardiacIndex",
            "LesionCount",
            "LesionSegments",
            "PrimaryProcedureCode",
            "StentCount",
            "StentUDIs",
            "StentTypes",
            "PostOpComplication_Bleeding",
            "PostOpComplication_AKI",
            "PostOpComplication_Stroke",
            "LengthOfStay",
            "Mortality_InHospital",
        ]
    )
    for s in specs:
        writer.writerow(
            [
                s.record_id,
                s.patient_id,
                s.procedure_date,
                str(s.patient_age),
                s.gender,
                s.hospital_id,
                s.operator_npi,
                s.preop_diagnosis,
                s.ef,
                s.cardiac_index,
                str(s.lesion_count),
                s.lesion_segments,
                s.primary_cpt,
                str(s.stent_count),
                s.stent_udis,
                s.stent_types,
                s.bleeding,
                s.aki,
                s.stroke,
                str(s.los),
                s.mortality,
            ]
        )

    return buf.getvalue()


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    print(build_corpus(seed=42, n_pcis=50))
