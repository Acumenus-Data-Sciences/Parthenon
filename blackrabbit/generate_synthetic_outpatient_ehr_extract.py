#!/usr/bin/env python3
"""Generate synthetic outpatient EHR extract inserts for the synthetic_ehr schema.

Produces deterministic PostgreSQL INSERT statements sized for 1,000 patients by
default. The output is intended to load after synthetic_outpatient_ehr_extract_ddl.sql.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import random
from collections import defaultdict
from pathlib import Path


SEED = 20260326


FIRST_NAMES_F = [
    "Ava", "Mia", "Sophia", "Emma", "Olivia", "Isabella", "Charlotte", "Amelia",
    "Harper", "Evelyn", "Abigail", "Ella", "Scarlett", "Grace", "Luna", "Nora",
]
FIRST_NAMES_M = [
    "Liam", "Noah", "Oliver", "Elijah", "James", "William", "Benjamin", "Lucas",
    "Henry", "Alexander", "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
]

STREETS = [
    "Maple", "Oak", "Cedar", "Pine", "Lake", "Hill", "River", "Walnut", "Sunset",
    "Highland", "Cherry", "Elm", "Willow", "Franklin", "Madison", "Lincoln",
]

CITIES = [
    ("Boston", "MA", "02108"),
    ("Worcester", "MA", "01608"),
    ("Hartford", "CT", "06103"),
    ("Providence", "RI", "02903"),
    ("Manchester", "NH", "03101"),
    ("Portland", "ME", "04101"),
]

CARE_SITES = [
    ("CS001", "Beacon Primary Care", "PRIMARY_CARE", "11"),
    ("CS002", "Beacon Endocrinology", "SPECIALTY", "11"),
    ("CS003", "Beacon Cardiology", "SPECIALTY", "11"),
    ("CS004", "Beacon Urgent Care", "URGENT_CARE", "20"),
    ("CS005", "Beacon Telehealth", "TELEHEALTH", "02"),
    ("CS006", "Beacon Lab Services", "LAB", "81"),
]

PROVIDERS = [
    ("PR001", "Nora Patel", "207Q00000X", "Family Medicine", "F", "CS001"),
    ("PR002", "Daniel Kim", "207R00000X", "Internal Medicine", "M", "CS001"),
    ("PR003", "Alicia Brooks", "207RE0101X", "Endocrinology", "F", "CS002"),
    ("PR004", "Marcus Hill", "207RC0000X", "Cardiology", "M", "CS003"),
    ("PR005", "Jenna Alvarez", "261QU0200X", "Urgent Care", "F", "CS004"),
    ("PR006", "Ethan Shah", "207Q00000X", "Telehealth", "M", "CS005"),
    ("PR007", "Lena Morris", "246Q00000X", "Clinical Lab", "F", "CS006"),
    ("PR008", "Samuel Green", "363A00000X", "Nurse Practitioner", "M", "CS001"),
]

PAYERS = [
    ("PY001", "Apex Commercial", "COMMERCIAL", "Apex PPO Gold", "PPO", "GOLD"),
    ("PY002", "Apex Commercial", "COMMERCIAL", "Apex HMO Silver", "HMO", "SILVER"),
    ("PY003", "Federal Medicare", "MEDICARE", "Traditional Medicare", "MEDICARE", None),
    ("PY004", "State Medicaid", "MEDICAID", "State Medicaid Managed Care", "MEDICAID", None),
]

ICD10_CODES = [
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("I10", "Essential (primary) hypertension"),
    ("E78.5", "Hyperlipidemia, unspecified"),
    ("J06.9", "Acute upper respiratory infection, unspecified"),
    ("M54.50", "Low back pain, unspecified"),
    ("F41.1", "Generalized anxiety disorder"),
    ("J30.9", "Allergic rhinitis, unspecified"),
    ("R73.03", "Prediabetes"),
    ("Z00.00", "Encounter for general adult medical examination without abnormal findings"),
    ("Z23", "Encounter for immunization"),
]

CPT_CODES = [
    ("99213", "Office or other outpatient visit, established patient"),
    ("99214", "Office or other outpatient visit, established patient, moderate"),
    ("93000", "Electrocardiogram complete"),
    ("36415", "Collection of venous blood"),
    ("90471", "Immunization administration"),
    ("81003", "Urinalysis automated"),
    ("82962", "Glucose blood by glucose monitoring device"),
]

HCPCS_DEVICE_CODES = [
    ("A4670", "Automatic blood pressure monitor"),
    ("A4253", "Blood glucose test strips"),
]

RXNORM_DRUGS = [
    ("860975", "metformin 500 MG Oral Tablet", "00093-1048-01"),
    ("617314", "lisinopril 10 MG Oral Tablet", "68180-513-01"),
    ("617320", "atorvastatin 20 MG Oral Tablet", "65862-159-90"),
    ("197361", "albuterol 0.09 MG/ACTUAT inhaler", "00173-0682-20"),
    ("314077", "levothyroxine 50 MCG Oral Tablet", "00093-5075-01"),
]

LOINC_LABS = [
    ("4548-4", "Hemoglobin A1c/Hemoglobin.total in Blood", "%"),
    ("2093-3", "Cholesterol [Mass/volume] in Serum or Plasma", "mg/dL"),
    ("2085-9", "HDL Cholesterol [Mass/volume] in Serum or Plasma", "mg/dL"),
    ("13457-7", "LDL Cholesterol [Mass/volume] in Serum or Plasma", "mg/dL"),
    ("2951-2", "Sodium [Moles/volume] in Serum or Plasma", "mmol/L"),
    ("2823-3", "Potassium [Moles/volume] in Serum or Plasma", "mmol/L"),
]

VITAL_CODES = [
    ("8302-2", "Body height", "cm"),
    ("29463-7", "Body weight", "kg"),
    ("8480-6", "Systolic blood pressure", "mmHg"),
    ("8462-4", "Diastolic blood pressure", "mmHg"),
    ("8867-4", "Heart rate", "beats/min"),
    ("8310-5", "Body temperature", "degF"),
]

CVX_CODES = [
    ("140", "Influenza, seasonal, injectable"),
    ("207", "COVID-19 mRNA vaccine"),
    ("08", "Hepatitis B, adolescent or pediatric"),
    ("113", "Tdap"),
]

OBS_CODES = [
    ("72166-2", "Tobacco smoking status"),
    ("74013-4", "Alcohol use"),
    ("68516-4", "Patient Health Questionnaire 9 total score"),
]

ALLERGY_CODES = [
    ("7982", "Penicillin"),
    ("227493005", "Cashew nut"),
    ("91936005", "Latex"),
]

NOTE_TEMPLATES = [
    "Follow-up visit for chronic disease management. Symptoms stable. Medication adherence discussed.",
    "Routine preventive visit. Lifestyle counseling provided. Screening needs reviewed.",
    "Urgent outpatient evaluation for minor acute symptoms. Conservative treatment recommended.",
    "Telehealth follow-up completed. Home vitals reviewed and treatment plan updated.",
]


def sql_quote(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dt.datetime):
        return "'" + value.strftime("%Y-%m-%d %H:%M:%S") + "'"
    if isinstance(value, dt.date):
        return "'" + value.isoformat() + "'"
    text = str(value).replace("'", "''")
    return f"'{text}'"


class TableBuffer:
    def __init__(self):
        self.rows = defaultdict(list)

    def add(self, table, row):
        self.rows[table].append(row)

    def emit(self) -> str:
        ordered_tables = [
            "extract_batch",
            "location",
            "care_site",
            "provider",
            "payer",
            "patient",
            "patient_identifier",
            "patient_coverage",
            "visit",
            "encounter_diagnosis",
            "problem_list",
            "procedure_order",
            "procedure_result",
            "device_use",
            "medication_order",
            "medication_dispense",
            "medication_administration",
            "immunization",
            "lab_order",
            "specimen",
            "lab_result",
            "vital_sign",
            "clinical_observation",
            "allergy",
            "smoking_and_social_history",
            "family_history",
            "referral",
            "encounter_charge",
            "encounter_note",
            "source_to_omop_map_hint",
        ]

        sections = [
            "-- Synthetic outpatient EHR extract data",
            "-- Generated by generate_synthetic_outpatient_ehr_extract.py",
            "set search_path to synthetic_ehr;",
            "",
        ]
        for table in ordered_tables:
            rows = self.rows.get(table)
            if not rows:
                continue
            columns = list(rows[0].keys())
            values_sql = []
            for row in rows:
                values_sql.append(
                    "(" + ", ".join(sql_quote(row[col]) for col in columns) + ")"
                )
            sections.append(
                f"insert into {table} ({', '.join(columns)}) values\n  "
                + ",\n  ".join(values_sql)
                + ";"
            )
            sections.append("")
        return "\n".join(sections)


def make_datetime(rng: random.Random, start: dt.date, end: dt.date, hour_low=8, hour_high=17) -> dt.datetime:
    days = (end - start).days
    base = start + dt.timedelta(days=rng.randint(0, max(days, 0)))
    hour = rng.randint(hour_low, hour_high)
    minute = rng.choice([0, 10, 15, 20, 30, 40, 45, 50])
    return dt.datetime.combine(base, dt.time(hour, minute))


def npi_for(index: int) -> str:
    return f"{1000000000 + index:010d}"


def build_reference_data(buf: TableBuffer):
    buf.add(
        "extract_batch",
        {
            "batch_name": "SYNTH_OUTPATIENT_1000_20260326",
            "target_patient_count": 1000,
            "outpatient_only_flag": True,
            "extract_start_date": dt.date(2023, 1, 1),
            "extract_end_date": dt.date(2025, 12, 31),
            "source_ehr_name": "Synthetic Standard EHR",
            "source_ehr_version": "1.0",
        },
    )

    for idx, (city, state, zip_code) in enumerate(CITIES, start=1):
        buf.add(
            "location",
            {
                "source_location_id": f"LOC{idx:03d}",
                "address_1": f"{100 + idx} {STREETS[idx % len(STREETS)]} St",
                "address_2": None,
                "city": city,
                "state": state,
                "zip": zip_code,
                "county": f"{city} County",
                "country": "USA",
                "latitude": round(41.5 + idx * 0.1, 6),
                "longitude": round(-71.2 - idx * 0.1, 6),
            },
        )

    for source_care_site_id, name, care_site_type, pos in CARE_SITES:
        numeric_site = int(source_care_site_id[-3:])
        buf.add(
            "care_site",
            {
                "source_care_site_id": source_care_site_id,
                "care_site_name": name,
                "care_site_type": care_site_type,
                "location_id": min(numeric_site, len(CITIES)),
                "place_of_service_code": pos,
                "npi_organization": npi_for(500 + numeric_site),
                "active_flag": True,
            },
        )

    for idx, (source_provider_id, name, specialty_code, specialty_value, gender, site_id) in enumerate(PROVIDERS, start=1):
        buf.add(
            "provider",
            {
                "source_provider_id": source_provider_id,
                "npi": npi_for(idx),
                "provider_name": name,
                "specialty_source_code": specialty_code,
                "specialty_source_value": specialty_value,
                "gender_source_value": gender,
                "care_site_id": int(site_id[-3:]),
                "active_flag": True,
            },
        )

    for idx, (source_payer_id, payer_name, payer_type, plan_name, plan_type, metal_level) in enumerate(PAYERS, start=1):
        buf.add(
            "payer",
            {
                "source_payer_id": source_payer_id,
                "payer_name": payer_name,
                "payer_type": payer_type,
                "plan_name": plan_name,
                "plan_type": plan_type,
                "metal_level": metal_level,
            },
        )

    domain_entries = []
    for code, desc in ICD10_CODES:
        domain_entries.append(("Condition", "ICD10CM", code, desc, "Condition"))
    for code, desc in CPT_CODES:
        domain_entries.append(("Procedure", "CPT4", code, desc, "Procedure"))
    for code, desc, _unit in LOINC_LABS:
        domain_entries.append(("Measurement", "LOINC", code, desc, "Measurement"))
    for code, desc in CVX_CODES:
        domain_entries.append(("Drug", "CVX", code, desc, "Drug"))

    for idx, (domain, vocab, code, desc, omop_domain) in enumerate(domain_entries, start=1):
        buf.add(
            "source_to_omop_map_hint",
            {
                "domain_name": domain,
                "source_code_system": vocab,
                "source_code": code,
                "source_description": desc,
                "target_omop_domain": omop_domain,
                "target_standard_concept_id": 100000 + idx,
                "target_standard_concept_name": desc,
                "target_vocabulary_id": vocab,
                "mapping_status": "SYNTHETIC_HINT",
            },
        )


def patient_demographics(rng: random.Random, patient_num: int):
    sex = rng.choice(["F", "M"])
    first = rng.choice(FIRST_NAMES_F if sex == "F" else FIRST_NAMES_M)
    last = rng.choice(LAST_NAMES)
    birth_year = rng.randint(1945, 2018)
    birth_month = rng.randint(1, 12)
    birth_day = rng.randint(1, 28)
    birth_date = dt.date(birth_year, birth_month, birth_day)
    race = rng.choice(["White", "Black or African American", "Asian", "Other", "Unknown"])
    ethnicity = rng.choice(["Not Hispanic or Latino", "Hispanic or Latino", "Unknown"])
    language = rng.choice(["English", "Spanish", "Portuguese", "French", "Chinese"])
    city_idx = rng.randint(1, len(CITIES))
    deceased = rng.random() < 0.015
    death_dt = None
    if deceased:
        death_dt = make_datetime(rng, dt.date(2023, 1, 1), dt.date(2025, 12, 31))
    return {
        "name": f"{first} {last}",
        "birth_date": birth_date,
        "sex_source_value": sex,
        "gender_identity_value": "Woman" if sex == "F" else "Man",
        "sexual_orientation_value": rng.choice(["Straight or heterosexual", "Bisexual", "Gay or lesbian", "Unknown"]),
        "race_source_value": race,
        "ethnicity_source_value": ethnicity,
        "language_source_value": language,
        "marital_status_value": rng.choice(["Single", "Married", "Divorced", "Widowed"]),
        "religion_value": rng.choice(["None", "Christian", "Jewish", "Muslim", "Other", "Unknown"]),
        "location_id": city_idx,
        "primary_care_provider_id": rng.choice([1, 2, 8]),
        "deceased_flag": deceased,
        "death_datetime": death_dt,
        "enterprise_mrn": f"MRN{patient_num:06d}",
    }


def add_patient(buf: TableBuffer, rng: random.Random, patient_num: int):
    demo = patient_demographics(rng, patient_num)
    patient_id = patient_num
    source_patient_id = f"PAT{patient_num:06d}"
    buf.add(
        "patient",
        {
            "batch_id": 1,
            "source_patient_id": source_patient_id,
            "enterprise_mrn": demo["enterprise_mrn"],
            "birth_date": demo["birth_date"],
            "sex_source_value": demo["sex_source_value"],
            "gender_identity_value": demo["gender_identity_value"],
            "sexual_orientation_value": demo["sexual_orientation_value"],
            "race_source_value": demo["race_source_value"],
            "ethnicity_source_value": demo["ethnicity_source_value"],
            "language_source_value": demo["language_source_value"],
            "marital_status_value": demo["marital_status_value"],
            "religion_value": demo["religion_value"],
            "location_id": demo["location_id"],
            "primary_care_provider_id": demo["primary_care_provider_id"],
            "deceased_flag": demo["deceased_flag"],
            "death_datetime": demo["death_datetime"],
            "active_flag": True,
            "create_datetime": dt.datetime(2023, 1, 1, 8, 0),
            "update_datetime": dt.datetime(2025, 12, 31, 17, 0),
        },
    )
    buf.add(
        "patient_identifier",
        {
            "patient_id": patient_id,
            "identifier_type": "MRN",
            "identifier_value": demo["enterprise_mrn"],
            "assigning_authority": "Synthetic Standard EHR",
            "start_date": dt.date(2023, 1, 1),
            "end_date": None,
        },
    )
    payer_id = rng.choices([1, 2, 3, 4], weights=[40, 20, 25, 15])[0]
    coverage_start = dt.date(2023, 1, 1)
    buf.add(
        "patient_coverage",
        {
            "patient_id": patient_id,
            "payer_id": payer_id,
            "member_id": f"M{patient_num:08d}",
            "subscriber_id": f"S{patient_num:08d}",
            "relationship_to_subscriber": rng.choice(["Self", "Spouse", "Child"]),
            "coverage_start_date": coverage_start,
            "coverage_end_date": None,
            "product_line": rng.choice(["Commercial", "Government", "Exchange"]),
            "pharmacy_benefit_flag": True,
            "medical_benefit_flag": True,
        },
    )
    return demo


def generate_visits_and_facts(buf: TableBuffer, rng: random.Random, patient_num: int, demo: dict, counters: dict):
    patient_id = patient_num
    visits = rng.randint(2, 6)
    chronic_pool = rng.sample(ICD10_CODES[:8], k=rng.randint(1, 3))

    for problem_rank, (code, desc) in enumerate(chronic_pool, start=1):
        buf.add(
            "problem_list",
            {
                "patient_id": patient_id,
                "source_problem_id": f"PL{patient_num:06d}{problem_rank:02d}",
                "problem_name": desc,
                "source_code": code,
                "source_code_system": "ICD10CM",
                "source_description": desc,
                "status": rng.choice(["Active", "Active", "Inactive", "Resolved"]),
                "recorded_date": dt.date(2023, rng.randint(1, 12), rng.randint(1, 28)),
                "onset_date": dt.date(max(demo["birth_date"].year + 18, 2010), rng.randint(1, 12), rng.randint(1, 28)),
                "resolved_date": None if rng.random() < 0.8 else dt.date(2025, rng.randint(1, 12), rng.randint(1, 28)),
                "last_reviewed_date": dt.date(2025, rng.randint(1, 12), rng.randint(1, 28)),
                "ranking": problem_rank,
                "provider_id": rng.choice([1, 2, 3, 4, 8]),
            },
        )

    if rng.random() < 0.65:
        allergen_code, allergen_name = rng.choice(ALLERGY_CODES)
        buf.add(
            "allergy",
            {
                "patient_id": patient_id,
                "visit_id": None,
                "source_allergy_id": f"ALG{patient_num:06d}",
                "recorded_datetime": make_datetime(rng, dt.date(2023, 1, 1), dt.date(2025, 12, 31)),
                "recorder_provider_id": rng.choice([1, 2, 8]),
                "allergen_type": rng.choice(["Drug", "Food", "Environmental"]),
                "source_code": allergen_code,
                "source_code_system": "SNOMED",
                "allergen_name": allergen_name,
                "reaction_text": rng.choice(["Rash", "Hives", "Shortness of breath", "Swelling"]),
                "severity": rng.choice(["Mild", "Moderate", "Severe"]),
                "status": "Active",
                "onset_date": dt.date(2023, rng.randint(1, 12), rng.randint(1, 28)),
            },
        )

    if rng.random() < 0.8:
        buf.add(
            "family_history",
            {
                "patient_id": patient_id,
                "visit_id": None,
                "recorded_datetime": make_datetime(rng, dt.date(2023, 1, 1), dt.date(2025, 12, 31)),
                "provider_id": rng.choice([1, 2, 8]),
                "relationship_source_value": rng.choice(["Mother", "Father", "Brother", "Sister"]),
                "source_code": rng.choice(["44054006", "59621000", "73211009"]),
                "source_code_system": "SNOMED",
                "source_description": rng.choice(["Diabetes mellitus", "Hypertensive disorder", "Coronary arteriosclerosis"]),
                "note_text": "Family history recorded during outpatient intake.",
                "status": "Reported",
            },
        )

    for history_type, code, description in [
        ("SMOKING", "72166-2", "Tobacco smoking status"),
        ("ALCOHOL", "74013-4", "Alcohol use"),
    ]:
        buf.add(
            "smoking_and_social_history",
            {
                "patient_id": patient_id,
                "visit_id": None,
                "recorded_datetime": make_datetime(rng, dt.date(2023, 1, 1), dt.date(2025, 12, 31)),
                "provider_id": rng.choice([1, 2, 8]),
                "history_type": history_type,
                "source_code": code,
                "source_code_system": "LOINC",
                "source_description": description,
                "value_text": rng.choice(
                    ["Never smoker", "Former smoker", "Current some day smoker"]
                    if history_type == "SMOKING"
                    else ["No current alcohol use", "Social alcohol use", "Moderate alcohol use"]
                ),
                "value_numeric": None,
                "value_unit": None,
                "status": "Final",
            },
        )

    for _ in range(visits):
        visit_id = counters["visit_id"]
        counters["visit_id"] += 1
        visit_start = make_datetime(rng, dt.date(2023, 1, 1), dt.date(2025, 12, 31))
        visit_len = rng.choice([20, 30, 40, 45, 60, 90])
        visit_end = visit_start + dt.timedelta(minutes=visit_len)
        visit_type = rng.choices(
            ["OFFICE", "OFFICE", "OFFICE", "URGENT_CARE", "TELEHEALTH", "LAB_ONLY"],
            weights=[35, 20, 15, 10, 10, 10],
        )[0]
        care_site_id = {
            "OFFICE": rng.choice([1, 2, 3]),
            "URGENT_CARE": 4,
            "TELEHEALTH": 5,
            "LAB_ONLY": 6,
        }[visit_type]
        rendering_provider = {
            1: rng.choice([1, 2, 8]),
            2: 3,
            3: 4,
            4: 5,
            5: 6,
            6: 7,
        }[care_site_id]
        buf.add(
            "visit",
            {
                "patient_id": patient_id,
                "source_visit_id": f"VIS{visit_id:07d}",
                "source_encounter_number": f"ENC{visit_id:07d}",
                "visit_start_datetime": visit_start,
                "visit_end_datetime": visit_end,
                "visit_type": visit_type,
                "visit_class": "OUTPATIENT",
                "place_of_service_code": CARE_SITES[care_site_id - 1][3],
                "telehealth_flag": visit_type == "TELEHEALTH",
                "care_site_id": care_site_id,
                "attending_provider_id": rendering_provider,
                "referring_provider_id": rng.choice([None, 1, 2, 3, 4]),
                "rendering_provider_id": rendering_provider,
                "patient_coverage_id": patient_id,
                "discharge_disposition": "Home",
                "chief_complaint": rng.choice([
                    "Routine follow-up",
                    "Medication refill",
                    "Annual wellness",
                    "Cough and congestion",
                    "Blood pressure follow-up",
                    "Lab draw",
                ]),
                "reason_for_visit": rng.choice([
                    "Chronic disease management",
                    "Preventive care",
                    "Acute issue",
                    "Results review",
                ]),
                "appointment_type": rng.choice(["Established", "New", "Follow-up", "Same day"]),
                "appointment_status": "Completed",
                "source_system": "Synthetic Standard EHR",
            },
        )

        dx_count = rng.randint(1, 3)
        visit_dx = rng.sample(ICD10_CODES, k=dx_count)
        for rank, (code, desc) in enumerate(visit_dx, start=1):
            buf.add(
                "encounter_diagnosis",
                {
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "diagnosis_datetime": visit_start,
                    "diagnosis_rank": rank,
                    "diagnosis_type": "Encounter Diagnosis",
                    "present_on_arrival_flag": None,
                    "source_code": code,
                    "source_code_system": "ICD10CM",
                    "source_description": desc,
                    "source_value": desc,
                    "clinical_status": "active",
                    "verification_status": "confirmed",
                    "onset_date": visit_start.date(),
                    "abatement_date": None,
                    "recorded_by_provider_id": rendering_provider,
                },
            )

        proc_order_id = counters["procedure_order_id"]
        counters["procedure_order_id"] += 1
        proc_code, proc_desc = rng.choice(CPT_CODES)
        buf.add(
            "procedure_order",
            {
                "visit_id": visit_id,
                "patient_id": patient_id,
                "source_order_id": f"PO{proc_order_id:07d}",
                "order_datetime": visit_start,
                "ordering_provider_id": rendering_provider,
                "source_code": proc_code,
                "source_code_system": "CPT4",
                "source_description": proc_desc,
                "priority": rng.choice(["Routine", "Routine", "Urgent"]),
                "status": "Completed",
                "reason_text": "Ordered during outpatient evaluation.",
                "scheduled_datetime": visit_start,
            },
        )
        proc_result_id = counters["procedure_result_id"]
        counters["procedure_result_id"] += 1
        buf.add(
            "procedure_result",
            {
                "procedure_order_id": proc_order_id,
                "visit_id": visit_id,
                "patient_id": patient_id,
                "procedure_datetime": visit_start + dt.timedelta(minutes=10),
                "performer_provider_id": rendering_provider,
                "source_code": proc_code,
                "source_code_system": "CPT4",
                "source_description": proc_desc,
                "modifier_code": None,
                "modifier_description": None,
                "result_status": "Completed",
                "body_site": None,
                "laterality": None,
            },
        )

        if rng.random() < 0.25:
            device_code, device_desc = rng.choice(HCPCS_DEVICE_CODES)
            buf.add(
                "device_use",
                {
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "device_datetime": visit_start + dt.timedelta(minutes=15),
                    "provider_id": rendering_provider,
                    "source_device_id": f"DV{visit_id:07d}",
                    "source_code": device_code,
                    "source_code_system": "HCPCS",
                    "source_description": device_desc,
                    "device_name": device_desc,
                    "unique_device_identifier": f"UDI-{patient_id:06d}-{visit_id:07d}",
                    "quantity": 1,
                    "quantity_unit": "EA",
                    "body_site": None,
                    "laterality": None,
                    "status": "Completed",
                },
            )

        if visit_type != "LAB_ONLY":
            med_order_id = counters["medication_order_id"]
            counters["medication_order_id"] += 1
            rx_code, drug_name, ndc_code = rng.choice(RXNORM_DRUGS)
            med_start = visit_start + dt.timedelta(minutes=5)
            buf.add(
                "medication_order",
                {
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "source_medication_order_id": f"MO{med_order_id:07d}",
                    "order_datetime": med_start,
                    "ordering_provider_id": rendering_provider,
                    "source_drug_code": rx_code,
                    "source_drug_code_system": "RXNORM",
                    "source_drug_name": drug_name,
                    "rxnorm_text": drug_name,
                    "dose_quantity": rng.choice([1, 1, 1, 2]),
                    "dose_unit": "tablet",
                    "route_source_value": rng.choice(["Oral", "Inhalation"]),
                    "frequency_source_value": rng.choice(["Daily", "BID", "PRN"]),
                    "sig_text": "Take as directed.",
                    "quantity": rng.choice([30, 60, 90]),
                    "quantity_unit": "tablet",
                    "refills": rng.choice([0, 1, 2, 3]),
                    "days_supply": rng.choice([30, 60, 90]),
                    "intended_start_datetime": med_start,
                    "intended_end_datetime": med_start + dt.timedelta(days=90),
                    "status": "Active",
                    "order_class": "Outpatient",
                    "prn_flag": False,
                    "indication_text": "Outpatient treatment",
                },
            )
            if rng.random() < 0.85:
                buf.add(
                    "medication_dispense",
                    {
                        "medication_order_id": med_order_id,
                        "patient_id": patient_id,
                        "dispense_datetime": med_start + dt.timedelta(days=rng.randint(0, 3)),
                        "dispensing_provider_id": rendering_provider,
                        "pharmacy_name": rng.choice(["Beacon Pharmacy", "Community Pharmacy", "Main Street Pharmacy"]),
                        "ndc_code": ndc_code,
                        "source_drug_name": drug_name,
                        "quantity_dispensed": rng.choice([30, 60, 90]),
                        "quantity_unit": "tablet",
                        "days_supply": rng.choice([30, 60, 90]),
                        "refill_number": 0,
                        "dispense_status": "Dispensed",
                    },
                )
            if rng.random() < 0.18:
                buf.add(
                    "medication_administration",
                    {
                        "visit_id": visit_id,
                        "medication_order_id": med_order_id,
                        "patient_id": patient_id,
                        "administration_datetime": med_start + dt.timedelta(minutes=20),
                        "administering_provider_id": rendering_provider,
                        "source_drug_code": rx_code,
                        "source_drug_code_system": "RXNORM",
                        "source_drug_name": drug_name,
                        "dose_quantity": 1,
                        "dose_unit": "dose",
                        "route_source_value": rng.choice(["Intramuscular", "Subcutaneous"]),
                        "administration_site": rng.choice(["Left arm", "Right arm", "Abdomen"]),
                        "status": "Completed",
                    },
                )

        if rng.random() < 0.45:
            cvx_code, vaccine_name = rng.choice(CVX_CODES)
            buf.add(
                "immunization",
                {
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "immunization_datetime": visit_start + dt.timedelta(minutes=25),
                    "provider_id": rendering_provider,
                    "cvx_code": cvx_code,
                    "source_code": cvx_code,
                    "source_code_system": "CVX",
                    "vaccine_name": vaccine_name,
                    "lot_number": f"LOT{visit_id:06d}",
                    "manufacturer": rng.choice(["Pfizer", "Moderna", "GSK", "Sanofi"]),
                    "dose_quantity": 0.5,
                    "dose_unit": "mL",
                    "route_source_value": "Intramuscular",
                    "body_site": rng.choice(["Left deltoid", "Right deltoid"]),
                    "status": "Completed",
                },
            )

        lab_order_id = counters["lab_order_id"]
        counters["lab_order_id"] += 1
        specimen_id = counters["specimen_id"]
        counters["specimen_id"] += 1
        loinc_code, loinc_desc, loinc_unit = rng.choice(LOINC_LABS)
        specimen_time = visit_start + dt.timedelta(minutes=10)
        buf.add(
            "lab_order",
            {
                "visit_id": visit_id,
                "patient_id": patient_id,
                "source_lab_order_id": f"LO{lab_order_id:07d}",
                "order_datetime": visit_start,
                "ordering_provider_id": rendering_provider,
                "source_code": loinc_code,
                "source_code_system": "LOINC",
                "source_description": loinc_desc,
                "priority": "Routine",
                "status": "Final",
                "specimen_type": "Blood",
            },
        )
        buf.add(
            "specimen",
            {
                "patient_id": patient_id,
                "visit_id": visit_id,
                "lab_order_id": lab_order_id,
                "source_specimen_id": f"SP{specimen_id:07d}",
                "specimen_datetime": specimen_time,
                "specimen_type": "Blood",
                "source_code": "119297000",
                "source_code_system": "SNOMED",
                "source_description": "Blood specimen",
                "body_site": "Venous blood",
                "laterality": None,
                "collection_method": "Venipuncture",
            },
        )
        for code, desc, unit in rng.sample(LOINC_LABS, k=rng.randint(1, 3)):
            if code == "4548-4":
                low, high = 4.0, 6.0
                numeric = round(rng.uniform(4.8, 10.2), 1)
            elif unit == "mg/dL":
                low, high = 30.0, 190.0
                numeric = round(rng.uniform(35, 220), 1)
            else:
                low, high = 3.5, 145.0
                numeric = round(rng.uniform(3.2, 146.5), 1)
            abnormal = "H" if numeric > high else "L" if numeric < low else "N"
            buf.add(
                "lab_result",
                {
                    "lab_order_id": lab_order_id,
                    "specimen_id": specimen_id,
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "result_datetime": specimen_time + dt.timedelta(hours=4),
                    "performing_provider_id": 7,
                    "source_code": code,
                    "source_code_system": "LOINC",
                    "source_description": desc,
                    "result_value_text": None,
                    "result_value_numeric": numeric,
                    "result_unit": unit,
                    "reference_range_low": low,
                    "reference_range_high": high,
                    "abnormal_flag": abnormal,
                    "result_status": "Final",
                    "specimen_source_value": "Blood",
                },
            )

        vital_time = visit_start + dt.timedelta(minutes=3)
        vitals = [
            ("8302-2", "Body height", "cm", round(rng.uniform(150, 195), 1)),
            ("29463-7", "Body weight", "kg", round(rng.uniform(48, 130), 1)),
            ("8480-6", "Systolic blood pressure", "mmHg", rng.randint(100, 165)),
            ("8462-4", "Diastolic blood pressure", "mmHg", rng.randint(60, 100)),
            ("8867-4", "Heart rate", "beats/min", rng.randint(58, 110)),
            ("8310-5", "Body temperature", "degF", round(rng.uniform(97.0, 100.4), 1)),
        ]
        for code, desc, unit, value in vitals:
            buf.add(
                "vital_sign",
                {
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "measured_datetime": vital_time,
                    "taken_by_provider_id": rng.choice([1, 2, 8]),
                    "vital_type": desc,
                    "source_code": code,
                    "source_code_system": "LOINC",
                    "source_description": desc,
                    "value_numeric": value,
                    "value_text": None,
                    "unit": unit,
                    "position_source_value": rng.choice(["Sitting", "Standing"]),
                    "body_site": None,
                },
            )

        phq9_score = rng.randint(0, 20)
        buf.add(
            "clinical_observation",
            {
                "visit_id": visit_id,
                "patient_id": patient_id,
                "observation_datetime": visit_start + dt.timedelta(minutes=8),
                "observer_provider_id": rendering_provider,
                "observation_type": "SCREENING",
                "source_code": "68516-4",
                "source_code_system": "LOINC",
                "source_description": "Patient Health Questionnaire 9 total score",
                "value_text": None,
                "value_numeric": phq9_score,
                "value_unit": "score",
                "value_date": visit_start.date(),
                "status": "Final",
            },
        )

        if rng.random() < 0.22:
            buf.add(
                "referral",
                {
                    "visit_id": visit_id,
                    "patient_id": patient_id,
                    "referral_datetime": visit_start + dt.timedelta(minutes=18),
                    "referring_provider_id": rendering_provider,
                    "referred_to_provider_id": rng.choice([3, 4, 5, 6]),
                    "referred_to_care_site_id": rng.choice([2, 3, 4, 5]),
                    "referral_reason": rng.choice(["Specialty evaluation", "Persistent symptoms", "Follow-up management"]),
                    "referral_priority": rng.choice(["Routine", "Urgent"]),
                    "referral_status": "Placed",
                },
            )

        charge_code, charge_desc = proc_code, proc_desc
        buf.add(
            "encounter_charge",
            {
                "visit_id": visit_id,
                "patient_id": patient_id,
                "charge_datetime": visit_end,
                "source_charge_id": f"CH{visit_id:07d}",
                "source_code": charge_code,
                "source_code_system": "CPT4",
                "source_description": charge_desc,
                "revenue_code": rng.choice(["0510", "0521", "0300"]),
                "cpt_hcpcs_code": charge_code,
                "diagnosis_pointer": "1",
                "units": 1,
                "charge_amount": round(rng.uniform(80, 450), 2),
                "allowed_amount": round(rng.uniform(60, 320), 2),
                "paid_amount": round(rng.uniform(40, 280), 2),
                "patient_responsibility_amount": round(rng.uniform(0, 80), 2),
                "billing_provider_id": rendering_provider,
                "status": "Posted",
            },
        )

        buf.add(
            "encounter_note",
            {
                "visit_id": visit_id,
                "patient_id": patient_id,
                "note_datetime": visit_end,
                "author_provider_id": rendering_provider,
                "note_type": rng.choice(["PROGRESS", "SOAP", "ANNUAL", "URGENT_CARE"]),
                "note_title": "Outpatient follow-up note",
                "note_text": rng.choice(NOTE_TEMPLATES),
                "signed_datetime": visit_end + dt.timedelta(minutes=15),
                "cosigned_datetime": None,
                "status": "Signed",
            },
        )


def generate(patient_count: int, output_path: Path):
    rng = random.Random(SEED)
    buf = TableBuffer()
    counters = {
        "visit_id": 1,
        "procedure_order_id": 1,
        "procedure_result_id": 1,
        "medication_order_id": 1,
        "lab_order_id": 1,
        "specimen_id": 1,
    }
    build_reference_data(buf)
    for patient_num in range(1, patient_count + 1):
        demo = add_patient(buf, rng, patient_num)
        generate_visits_and_facts(buf, rng, patient_num, demo, counters)
    output_path.write_text(buf.emit(), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--patients", type=int, default=1000, help="Number of synthetic patients.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("synthetic_outpatient_ehr_extract_inserts.sql"),
        help="Path to the generated SQL file.",
    )
    args = parser.parse_args()
    generate(args.patients, args.output)


if __name__ == "__main__":
    main()
