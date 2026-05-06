"""Generate a synthetic 10-patient MIMIC-shaped CSV corpus.

Seeds with a fixed RNG so reruns are byte-identical. Output goes into
``fixtures/synthetic/csv/`` with the same hosp/icu/note layout MIMIC-IV
ships, so the manifest's COPY commands work against it without parameter
overrides (just ``csv_root`` set to this directory).

Run:
    uv run python build_fixtures.py [--count 10]
"""

from __future__ import annotations

import argparse
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "csv"

# (subject_id range, gender, race, age range, year)
GENDERS = ["M", "F"]
RACES = ["WHITE", "BLACK OR AFRICAN AMERICAN", "ASIAN", "HISPANIC", "OTHER"]
ADMISSION_TYPES = ["EW EMER.", "ELECTIVE", "URGENT", "OBSERVATION ADMIT"]

# Real ICD-10-CM codes
ICD10_DIAGNOSES = ["I10", "E11.9", "J45.909", "I25.10", "N18.6", "F32.9"]
# Real ICD-10-PCS codes
ICD10_PROCEDURES = ["0DTJ4ZZ", "0BH17EZ", "5A1955Z", "30233N1"]
# Real LOINC codes
LOINC_LABS = [
    ("718-7", "Hgb", "g/dL", 13.0, 17.0),
    ("33747-0", "WBC", "10*3/uL", 4.5, 11.0),
    ("2160-0", "Cr", "mg/dL", 0.6, 1.3),
    ("2345-7", "Glucose", "mg/dL", 70, 110),
]
# Real RxCUIs
RXNORM_CODES = [
    ("314076", "Lisinopril 10 MG"),
    ("860975", "Metformin 500 MG"),
    ("197591", "Atorvastatin 10 MG"),
    ("309362", "Aspirin 81 MG"),
]
NOTE_CATEGORIES = ["Discharge summary", "Nursing", "Physician", "Radiology"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)

    hosp = OUT_DIR / "hosp"
    icu = OUT_DIR / "icu"
    note = OUT_DIR / "note"
    for d in (hosp, icu, note):
        d.mkdir(parents=True, exist_ok=True)

    patients_rows = []
    admissions_rows = []
    transfers_rows = []
    diagnoses_rows = []
    procedures_rows = []
    labevents_rows = []
    prescriptions_rows = []
    chartevents_rows = []
    noteevents_rows = []
    drgcodes_rows = []
    icustays_rows = []

    transfer_id = 1
    icustay_id = 30000000

    base_date = datetime(2026, 1, 1)

    for i in range(args.count):
        subject_id = 10000000 + i
        gender = rng.choice(GENDERS)
        anchor_age = rng.randint(25, 85)
        anchor_year = 2026
        dod = ""
        if rng.random() < 0.1:
            dod = (base_date + timedelta(days=rng.randint(60, 720))).strftime("%Y-%m-%d")
        patients_rows.append(
            [subject_id, gender, anchor_age, anchor_year, "2020 - 2022", dod]
        )

        # 2-5 admissions per patient
        num_admits = rng.randint(2, 5)
        for j in range(num_admits):
            hadm_id = 20000000 + i * 10 + j
            admittime = base_date + timedelta(days=rng.randint(0, 365))
            dischtime = admittime + timedelta(days=rng.randint(1, 14))
            adm_type = rng.choice(ADMISSION_TYPES)
            race = rng.choice(RACES)
            admissions_rows.append([
                hadm_id, subject_id,
                admittime.strftime("%Y-%m-%d %H:%M:%S"),
                dischtime.strftime("%Y-%m-%d %H:%M:%S"),
                "", adm_type, "EMERGENCY ROOM", "HOME", "Medicare",
                "ENGLISH", "MARRIED", race, "", "", 0,
            ])

            # transfers
            transfers_rows.append([
                transfer_id, subject_id, hadm_id, "admit", "Med ICU",
                admittime.strftime("%Y-%m-%d %H:%M:%S"),
                (admittime + timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S"),
            ])
            transfer_id += 1

            # ICU stay
            icustay_id += 1
            icustays_rows.append([
                icustay_id, subject_id, hadm_id, "MICU", "MICU",
                admittime.strftime("%Y-%m-%d %H:%M:%S"),
                (admittime + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
                2.0,
            ])

            # 3-5 diagnoses
            for seq, dx in enumerate(rng.sample(ICD10_DIAGNOSES, k=rng.randint(3, 5)), 1):
                diagnoses_rows.append([subject_id, hadm_id, seq, dx, 10])

            # 1-2 procedures
            for seq, pc in enumerate(rng.sample(ICD10_PROCEDURES, k=rng.randint(1, 2)), 1):
                procedures_rows.append([
                    subject_id, hadm_id, seq, admittime.strftime("%Y-%m-%d"), pc, 10,
                ])

            # 5-15 labevents
            for k in range(rng.randint(5, 15)):
                loinc, name, unit, low, high = rng.choice(LOINC_LABS)
                value = round(rng.uniform(low, high), 2)
                labtime = admittime + timedelta(hours=rng.randint(1, 48))
                labevents_rows.append([
                    subject_id, hadm_id, 0, 50000 + k, labtime.strftime("%Y-%m-%d %H:%M:%S"),
                    "", str(value), value, unit, low, high, "", "ROUTINE", "", loinc,
                ])

            # 2-5 prescriptions
            for rx in rng.sample(RXNORM_CODES, k=rng.randint(2, 4)):
                rxcui, drug = rx
                stoptime = admittime + timedelta(days=rng.randint(1, 7))
                prescriptions_rows.append([
                    subject_id, hadm_id,
                    admittime.strftime("%Y-%m-%d %H:%M:%S"),
                    stoptime.strftime("%Y-%m-%d %H:%M:%S"),
                    "MAIN", drug, "", "", "00378180005", drug,
                    "10", "mg", "PO", rxcui,
                ])

            # 1-3 chartevents (GCS Total etc.)
            for _ in range(rng.randint(1, 3)):
                chartevents_rows.append([
                    subject_id, hadm_id, icustay_id,
                    admittime.strftime("%Y-%m-%d %H:%M:%S"),
                    220739, "15", 15.0, "score", 0,
                ])

            # 1-2 notes
            for _ in range(rng.randint(1, 2)):
                noteevents_rows.append([
                    subject_id, hadm_id, admittime.strftime("%Y-%m-%d"),
                    admittime.strftime("%Y-%m-%d %H:%M:%S"),
                    admittime.strftime("%Y-%m-%d %H:%M:%S"),
                    rng.choice(NOTE_CATEGORIES), "Progress note", 0, 0,
                    f"Patient {subject_id} reports chest pain. Started lisinopril 10mg.",
                ])

            # 1 DRG code
            drgcodes_rows.append([
                subject_id, hadm_id, "MS-DRG", "291", "HEART FAILURE & SHOCK W MCC", 4, 3,
            ])

    def _write(path: Path, header: list[str], rows: list[list]) -> None:
        with path.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)

    _write(hosp / "patients.csv",
           ["subject_id", "gender", "anchor_age", "anchor_year", "anchor_year_group", "dod"],
           patients_rows)
    _write(hosp / "admissions.csv",
           ["hadm_id", "subject_id", "admittime", "dischtime", "deathtime",
            "admission_type", "admission_location", "discharge_location",
            "insurance", "language", "marital_status", "race",
            "edregtime", "edouttime", "hospital_expire_flag"],
           admissions_rows)
    _write(hosp / "transfers.csv",
           ["transfer_id", "subject_id", "hadm_id", "eventtype", "careunit",
            "intime", "outtime"],
           transfers_rows)
    _write(hosp / "diagnoses_icd.csv",
           ["subject_id", "hadm_id", "seq_num", "icd_code", "icd_version"],
           diagnoses_rows)
    _write(hosp / "procedures_icd.csv",
           ["subject_id", "hadm_id", "seq_num", "chartdate", "icd_code", "icd_version"],
           procedures_rows)
    _write(hosp / "labevents.csv",
           ["subject_id", "hadm_id", "specimen_id", "itemid", "charttime",
            "storetime", "value", "valuenum", "valueuom",
            "ref_range_lower", "ref_range_upper", "flag", "priority",
            "comments", "loinc_code"],
           labevents_rows)
    _write(hosp / "prescriptions.csv",
           ["subject_id", "hadm_id", "starttime", "stoptime", "drug_type",
            "drug", "formulary_drug_cd", "gsn", "ndc", "prod_strength",
            "dose_val_rx", "dose_unit_rx", "route", "rxnorm_code"],
           prescriptions_rows)
    _write(hosp / "drgcodes.csv",
           ["subject_id", "hadm_id", "drg_type", "drg_code", "description",
            "drg_severity", "drg_mortality"],
           drgcodes_rows)
    _write(icu / "chartevents.csv",
           ["subject_id", "hadm_id", "stay_id", "charttime", "itemid",
            "value", "valuenum", "valueuom", "warning"],
           chartevents_rows)
    _write(icu / "icustays.csv",
           ["stay_id", "subject_id", "hadm_id", "first_careunit", "last_careunit",
            "intime", "outtime", "los"],
           icustays_rows)
    _write(note / "noteevents.csv",
           ["subject_id", "hadm_id", "chartdate", "charttime", "storetime",
            "category", "description", "cgid", "iserror", "text"],
           noteevents_rows)

    print(
        f"wrote {len(patients_rows)} patients, "
        f"{len(admissions_rows)} admissions, "
        f"{len(diagnoses_rows)} diagnoses, "
        f"{len(prescriptions_rows)} prescriptions, "
        f"{len(noteevents_rows)} noteevents into {OUT_DIR}"
    )


if __name__ == "__main__":
    main()
