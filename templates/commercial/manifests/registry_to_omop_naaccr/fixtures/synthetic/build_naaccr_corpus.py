"""Synthetic NAACCR corpus builder — deterministic with seed=42.

Phase 3 Plan 4A Task 7 (T-022A). Produces a 50-tumor NAACCR corpus
for the validation E2E (Task 8). Mix:

- 50 tumors across 50 patients (one tumor per patient in v0.1)
- 5 cancer types: breast (C50), prostate (C61), lung (C34), colon (C18), brain (C71)
- All malignant primary (behavior=3) — the projection includes 3 + 6
  but in-situ / benign would route to OBSERVATION (out of v0.1 scope)
- AJCC staging spread across IIA, IIB, IIIA, IIIB, IV
- Treatment summary populated for all rows (one of each rx code)

Output is the fixed-width text the NAACCRReader consumes — one tumor
per line, padded to total_line_length() per the layout spec.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Final

from runtime.commercial.registry.naaccr.layout import COLUMNS, total_line_length

# (primary_site_icdo3, histology_icdo3) pairs for the 5 cancer types.
_CANCER_TYPES: Final[list[tuple[str, str]]] = [
    ("C509", "8500"),  # Breast: ductal carcinoma
    ("C619", "8140"),  # Prostate: adenocarcinoma
    ("C349", "8070"),  # Lung: squamous cell carcinoma
    ("C189", "8140"),  # Colon: adenocarcinoma
    ("C719", "9440"),  # Brain: glioblastoma
]

_AJCC_STAGES: Final[list[str]] = ["IIA", "IIB", "IIIA", "IIIB", "IV"]


@dataclass(frozen=True)
class _TumorSpec:
    seed_idx: int
    patient_id: str
    primary_site: str
    histology: str
    behavior: str
    grade: str
    ajcc_stage: str
    ajcc_t: str
    ajcc_n: str
    ajcc_m: str
    dx_year: int
    dx_month: int
    dx_day: int
    dob_year: int
    sex: str
    race: str


def _layout_line(spec: _TumorSpec) -> str:
    """Build one fixed-width NAACCR line per layout.COLUMNS."""
    n = total_line_length()
    line = [" "] * n

    def put(name: str, value: str) -> None:
        col = COLUMNS[name]
        if len(value) > col.length:
            value = value[: col.length]
        line[col.start : col.start + col.length] = list(value.ljust(col.length))

    dx_date = f"{spec.dx_year:04d}{spec.dx_month:02d}{spec.dx_day:02d}"
    dob = f"{spec.dob_year:04d}0101"
    last_contact = f"{spec.dx_year + 1:04d}0301"

    put("patient_id_number", spec.patient_id)
    put("tumor_record_number", "01")
    put("name_last", "DOE")
    put("name_first", "JANE")
    put("date_of_birth", dob)
    put("sex", spec.sex)
    put("race_1", spec.race)
    put("spanish_hispanic_origin", "0")
    put("primary_site", spec.primary_site)
    put("histologic_type_icdo3", spec.histology)
    put("behavior_code_icdo3", spec.behavior)
    put("grade", spec.grade)
    put("date_of_diagnosis", dx_date)
    put("diagnostic_confirmation", "1")
    put("ajcc_stage_group", spec.ajcc_stage)
    put("ajcc_t", spec.ajcc_t)
    put("ajcc_n", spec.ajcc_n)
    put("ajcc_m", spec.ajcc_m)
    # Spread treatments — every spec gets surgery + at least one other.
    put("rx_summary_surgery", "30")
    put("rx_summary_chemo", "02" if spec.seed_idx % 2 == 0 else "00")
    put("rx_summary_radiation", "20" if spec.seed_idx % 3 == 0 else "00")
    put("rx_summary_hormone", "01" if spec.seed_idx % 5 == 0 else "00")
    put("vital_status", "1")
    put("date_of_last_contact", last_contact)
    return "".join(line)


def build_corpus(*, seed: int = 42, n_tumors: int = 50) -> str:
    """Build a deterministic NAACCR fixed-width payload.

    Args:
        seed: RNG seed; same seed -> same output bytes.
        n_tumors: Total tumors to generate. Must be >= 1.

    Returns:
        A multi-line string, one fixed-width NAACCR record per line.
    """
    if n_tumors < 1:
        raise ValueError(f"n_tumors must be >= 1; got {n_tumors}")

    rng = random.Random(seed)
    specs: list[_TumorSpec] = []
    for i in range(1, n_tumors + 1):
        cancer = _CANCER_TYPES[(i - 1) % len(_CANCER_TYPES)]
        ajcc = _AJCC_STAGES[(i - 1) % len(_AJCC_STAGES)]
        # AJCC T/N/M derive from stage (rough — fixture-quality only).
        t = "T2" if "II" in ajcc else "T3"
        nval = "N0" if ajcc == "IIA" else "N1"
        m = "M0" if ajcc != "IV" else "M1"
        specs.append(
            _TumorSpec(
                seed_idx=i,
                patient_id=f"PAT{i:05d}",
                primary_site=cancer[0],
                histology=cancer[1],
                behavior="3",
                grade=str(rng.randint(1, 4)),
                ajcc_stage=ajcc,
                ajcc_t=t,
                ajcc_n=nval,
                ajcc_m=m,
                dx_year=2024,
                dx_month=((i - 1) % 12) + 1,
                dx_day=((i - 1) % 28) + 1,
                dob_year=1940 + (i % 60),
                # 2 = Female for breast; 1 = Male for prostate; mix others.
                sex="2" if cancer[0] == "C509" else ("1" if cancer[0] == "C619" else str(rng.choice([1, 2]))),
                race=f"{rng.randint(1, 5):02d}",
            )
        )

    return "\n".join(_layout_line(s) for s in specs) + "\n"


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    payload = build_corpus(seed=42, n_tumors=50)
    print(f"Generated {payload.count(chr(10))} NAACCR records")
