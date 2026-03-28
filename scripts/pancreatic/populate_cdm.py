#!/usr/bin/env python3
"""
Populate the pancreas CDM schema with synthetic patients from DICOM metadata.

Sources:
  - PANCREAS-CT: 18 patients (anonymized — no sex/age, generate synthetic)
  - CPTAC-PDA: 168 patients (real demographics from DICOM: sex, age)

Creates: person, observation_period, condition_occurrence, visit_occurrence,
         procedure_occurrence, observation (dataset tracking), specimen (pathology)

Run: python3 scripts/pancreatic/populate_cdm.py
"""

import os
import random
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pydicom

# OMOP Concept IDs
MALE_CONCEPT = 8507
FEMALE_CONCEPT = 8532
UNKNOWN_SEX_CONCEPT = 8551
WHITE_CONCEPT = 8527
UNKNOWN_RACE_CONCEPT = 8552
NOT_HISPANIC_CONCEPT = 38003564
UNKNOWN_ETHNICITY_CONCEPT = 0

# Condition concepts
PANCREATIC_CANCER_CONCEPT = 4180793  # Malignant tumor of pancreas (SNOMED)
CONDITION_TYPE_EHR = 32817  # EHR

# Procedure concepts
CT_ABDOMEN_CONCEPT = 4020329  # Pancreaticoduodenectomy (SNOMED) — legacy, see enrich_cdm.py
SURGICAL_PATHOLOGY_CONCEPT = 4144850  # Distal pancreatectomy (SNOMED) — legacy, see enrich_cdm.py
PROCEDURE_TYPE_EHR = 32817

# Visit concepts
OUTPATIENT_VISIT_CONCEPT = 9202
VISIT_TYPE_EHR = 32817

# Observation concepts
OBSERVATION_TYPE_EHR = 32817

# Period type
PERIOD_TYPE_EHR = 32817

# Dataset observation concept (using 0 = no matching concept, store dataset name in value_as_string)
DATASET_OBS_CONCEPT = 0

# Specimen concepts
PANCREAS_TISSUE_CONCEPT = 4002886  # Pancreas tissue specimen
SPECIMEN_TYPE_TISSUE = 32817

# Base date for synthetic encounters
BASE_DATE = date(2020, 1, 1)

DB_CONN = "host=localhost dbname=parthenon user=claude_dev"


def extract_pancreas_ct_metadata(data_dir: str) -> list[dict]:
    """Extract patient metadata from PANCREAS-CT DICOM files."""
    patients = []
    ct_dir = Path(data_dir) / "ct" / "PANCREAS-CT"

    if not ct_dir.exists():
        print(f"  PANCREAS-CT directory not found: {ct_dir}")
        return patients

    for study_dir in sorted(ct_dir.iterdir()):
        if not study_dir.is_dir():
            continue
        # Find first DCM file
        dcm_files = list(study_dir.glob("*.dcm"))
        if not dcm_files:
            continue
        try:
            ds = pydicom.dcmread(str(dcm_files[0]), stop_before_pixels=True)
            patient_id = getattr(ds, "PatientID", f"PANC_CT_{len(patients):03d}")
            study_uid = getattr(ds, "StudyInstanceUID", "")
            # PANCREAS-CT is anonymized — no real demographics
            patients.append({
                "source_id": patient_id,
                "sex": None,  # Will be randomly assigned
                "age": None,  # Will be randomly assigned
                "study_uid": study_uid,
                "dataset": "PANCREAS-CT",
                "modality": "CT",
            })
        except Exception as e:
            print(f"  Warning: Could not read {dcm_files[0]}: {e}")

    return patients


def extract_cptac_pda_metadata(data_dir: str) -> list[dict]:
    """Extract patient metadata from CPTAC-PDA pathology DICOM files."""
    patients = []
    path_dir = Path(data_dir) / "pathology" / "CPTAC-PDA"

    if not path_dir.exists():
        print(f"  CPTAC-PDA directory not found: {path_dir}")
        return patients

    for patient_dir in sorted(path_dir.iterdir()):
        if not patient_dir.is_dir():
            continue
        # Find first DCM in any subdirectory
        dcm_files = list(patient_dir.rglob("*.dcm"))
        if not dcm_files:
            continue
        try:
            ds = pydicom.dcmread(str(dcm_files[0]), stop_before_pixels=True)
            patient_id = getattr(ds, "PatientID", patient_dir.name)
            sex = getattr(ds, "PatientSex", None)
            age_str = getattr(ds, "PatientAge", None)
            study_uid = getattr(ds, "StudyInstanceUID", "")

            age = None
            if age_str and age_str.endswith("Y"):
                try:
                    age = int(age_str[:-1])
                except ValueError:
                    pass

            patients.append({
                "source_id": patient_id,
                "sex": sex if sex in ("M", "F") else None,
                "age": age,
                "study_uid": study_uid,
                "dataset": "CPTAC-PDA",
                "modality": "SM",
            })
        except Exception as e:
            print(f"  Warning: Could not read {dcm_files[0]}: {e}")

    return patients


def generate_sql(patients: list[dict]) -> str:
    """Generate SQL to populate CDM tables."""
    random.seed(42)  # Reproducible

    sql_parts = []
    sql_parts.append("BEGIN;")
    sql_parts.append("")
    sql_parts.append("-- Clear existing data")
    sql_parts.append("TRUNCATE pancreas.person CASCADE;")
    sql_parts.append("TRUNCATE pancreas.observation_period CASCADE;")
    sql_parts.append("TRUNCATE pancreas.visit_occurrence CASCADE;")
    sql_parts.append("TRUNCATE pancreas.condition_occurrence CASCADE;")
    sql_parts.append("TRUNCATE pancreas.procedure_occurrence CASCADE;")
    sql_parts.append("TRUNCATE pancreas.observation CASCADE;")
    sql_parts.append("TRUNCATE pancreas.specimen CASCADE;")
    sql_parts.append("TRUNCATE pancreas.care_site CASCADE;")
    sql_parts.append("TRUNCATE pancreas.location CASCADE;")
    sql_parts.append("")

    # Create care sites for each dataset source
    sql_parts.append("-- Care sites (research institutions)")
    sql_parts.append("""INSERT INTO pancreas.care_site VALUES
(1, 'NIH Clinical Center (PANCREAS-CT)', 8756, NULL, 'PANCREAS-CT', 'Research Hospital'),
(2, 'NCI CPTAC Clinical Proteomics (CPTAC-PDA)', 8756, NULL, 'CPTAC-PDA', 'Research Hospital');""")
    sql_parts.append("")

    # Generate persons
    sql_parts.append("-- Persons")
    sql_parts.append("INSERT INTO pancreas.person VALUES")

    person_rows = []
    visit_rows = []
    condition_rows = []
    procedure_rows = []
    obs_period_rows = []
    observation_rows = []
    specimen_rows = []

    visit_id = 1
    condition_id = 1
    procedure_id = 1
    obs_period_id = 1
    observation_id = 1
    specimen_id = 1

    for i, p in enumerate(patients):
        person_id = i + 1

        # Demographics
        if p["sex"] == "M":
            gender_concept = MALE_CONCEPT
            gender_source = "M"
        elif p["sex"] == "F":
            gender_concept = FEMALE_CONCEPT
            gender_source = "F"
        else:
            # Randomly assign for anonymized patients
            gender_concept = random.choice([MALE_CONCEPT, FEMALE_CONCEPT])
            gender_source = "M" if gender_concept == MALE_CONCEPT else "F"

        # Age → year of birth
        if p["age"] is not None:
            year_of_birth = BASE_DATE.year - p["age"]
        else:
            # Pancreatic cancer typical age: 55-75
            year_of_birth = BASE_DATE.year - random.randint(55, 75)

        month_of_birth = random.randint(1, 12)
        day_of_birth = random.randint(1, 28)

        care_site_id = 1 if p["dataset"] == "PANCREAS-CT" else 2

        person_rows.append(
            f"({person_id}, {gender_concept}, {year_of_birth}, {month_of_birth}, "
            f"{day_of_birth}, NULL, {WHITE_CONCEPT}, {NOT_HISPANIC_CONCEPT}, "
            f"NULL, NULL, {care_site_id}, "
            f"'{p['source_id']}', '{gender_source}', {gender_concept}, "
            f"'Unknown', {UNKNOWN_RACE_CONCEPT}, 'Not Hispanic', {NOT_HISPANIC_CONCEPT})"
        )

        # Visit — one outpatient visit per patient for the imaging/pathology encounter
        visit_date = BASE_DATE + timedelta(days=random.randint(0, 730))
        visit_rows.append(
            f"({visit_id}, {person_id}, {OUTPATIENT_VISIT_CONCEPT}, "
            f"'{visit_date}', '{visit_date} 09:00:00', "
            f"'{visit_date}', '{visit_date} 17:00:00', "
            f"{VISIT_TYPE_EHR}, NULL, {care_site_id}, "
            f"'{p['dataset']}-visit', NULL, NULL, NULL, NULL, NULL, NULL)"
        )

        # Observation period — spans the visit
        obs_start = visit_date - timedelta(days=30)
        obs_end = visit_date + timedelta(days=30)
        obs_period_rows.append(
            f"({obs_period_id}, {person_id}, '{obs_start}', '{obs_end}', {PERIOD_TYPE_EHR})"
        )

        # Condition — pancreatic cancer diagnosis
        condition_rows.append(
            f"({condition_id}, {person_id}, {PANCREATIC_CANCER_CONCEPT}, "
            f"'{visit_date}', '{visit_date} 09:00:00', NULL, NULL, "
            f"{CONDITION_TYPE_EHR}, NULL, NULL, NULL, {visit_id}, NULL, "
            f"'C25.9', NULL, NULL)"
        )

        # Procedure — imaging or pathology
        if p["modality"] == "CT":
            proc_concept = CT_ABDOMEN_CONCEPT
            proc_source = "CT Abdomen"
        else:
            proc_concept = SURGICAL_PATHOLOGY_CONCEPT
            proc_source = "Surgical Pathology WSI"

        procedure_rows.append(
            f"({procedure_id}, {person_id}, {proc_concept}, "
            f"'{visit_date}', '{visit_date} 10:00:00', "
            f"'{visit_date}', '{visit_date} 11:00:00', "
            f"{PROCEDURE_TYPE_EHR}, NULL, 1, NULL, {visit_id}, NULL, "
            f"'{proc_source}', NULL, NULL)"
        )

        # Observation — dataset source tracking
        observation_rows.append(
            f"({observation_id}, {person_id}, {DATASET_OBS_CONCEPT}, "
            f"'{visit_date}', '{visit_date} 09:00:00', "
            f"{OBSERVATION_TYPE_EHR}, NULL, '{p['dataset']}', NULL, NULL, NULL, "
            f"NULL, {visit_id}, NULL, 'source_dataset', NULL, NULL, NULL, NULL, NULL, NULL)"
        )
        observation_id += 1

        # Second observation — DICOM Study UID link
        if p["study_uid"]:
            # Truncate study_uid to 60 chars for value_as_string
            uid_val = p["study_uid"][:60]
            observation_rows.append(
                f"({observation_id}, {person_id}, {DATASET_OBS_CONCEPT}, "
                f"'{visit_date}', '{visit_date} 09:00:00', "
                f"{OBSERVATION_TYPE_EHR}, NULL, '{uid_val}', NULL, NULL, NULL, "
                f"NULL, {visit_id}, NULL, 'dicom_study_uid', NULL, NULL, NULL, NULL, NULL, NULL)"
            )
            observation_id += 1

        # Specimen — for pathology patients
        if p["modality"] == "SM":
            specimen_rows.append(
                f"({specimen_id}, {person_id}, {PANCREAS_TISSUE_CONCEPT}, "
                f"{SPECIMEN_TYPE_TISSUE}, '{visit_date}', '{visit_date} 10:00:00', "
                f"1, NULL, 4217585, NULL, "  # 4217585 = Pancreas (anatomic site)
                f"'{p['source_id']}', '{p['source_id']}-tissue', NULL, 'Pancreas', NULL)"
            )
            specimen_id += 1

        visit_id += 1
        condition_id += 1
        procedure_id += 1
        obs_period_id += 1

    sql_parts.append(",\n".join(person_rows) + ";")
    sql_parts.append("")

    sql_parts.append("-- Observation periods")
    sql_parts.append("INSERT INTO pancreas.observation_period VALUES")
    sql_parts.append(",\n".join(obs_period_rows) + ";")
    sql_parts.append("")

    sql_parts.append("-- Visit occurrences")
    sql_parts.append("INSERT INTO pancreas.visit_occurrence VALUES")
    sql_parts.append(",\n".join(visit_rows) + ";")
    sql_parts.append("")

    sql_parts.append("-- Condition occurrences (pancreatic cancer)")
    sql_parts.append("INSERT INTO pancreas.condition_occurrence VALUES")
    sql_parts.append(",\n".join(condition_rows) + ";")
    sql_parts.append("")

    sql_parts.append("-- Procedure occurrences (imaging/pathology)")
    sql_parts.append("INSERT INTO pancreas.procedure_occurrence VALUES")
    sql_parts.append(",\n".join(procedure_rows) + ";")
    sql_parts.append("")

    sql_parts.append("-- Observations (dataset + study UID tracking)")
    sql_parts.append("INSERT INTO pancreas.observation VALUES")
    sql_parts.append(",\n".join(observation_rows) + ";")
    sql_parts.append("")

    if specimen_rows:
        sql_parts.append("-- Specimens (pathology tissue)")
        sql_parts.append("INSERT INTO pancreas.specimen VALUES")
        sql_parts.append(",\n".join(specimen_rows) + ";")
        sql_parts.append("")

    sql_parts.append("COMMIT;")

    return "\n".join(sql_parts)


def main():
    data_dir = "/mnt/md0/pancreatic-corpus"

    print("Extracting PANCREAS-CT metadata...")
    ct_patients = extract_pancreas_ct_metadata(data_dir)
    print(f"  Found {len(ct_patients)} PANCREAS-CT patients")

    print("Extracting CPTAC-PDA metadata...")
    pda_patients = extract_cptac_pda_metadata(data_dir)
    print(f"  Found {len(pda_patients)} CPTAC-PDA patients")

    all_patients = ct_patients + pda_patients
    print(f"\nTotal: {len(all_patients)} patients")

    print("Generating SQL...")
    sql = generate_sql(all_patients)

    sql_file = Path(__file__).parent / "populate_cdm.sql"
    sql_file.write_text(sql)
    print(f"  Written to {sql_file}")

    print("Executing SQL...")
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "claude_dev", "-d", "parthenon", "-f", str(sql_file)],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"  ERROR: {result.stderr}")
        sys.exit(1)

    print(result.stdout)

    # Verify
    print("\nVerification:")
    verify_sql = """
SELECT 'person' as tbl, count(*) FROM pancreas.person
UNION ALL SELECT 'observation_period', count(*) FROM pancreas.observation_period
UNION ALL SELECT 'visit_occurrence', count(*) FROM pancreas.visit_occurrence
UNION ALL SELECT 'condition_occurrence', count(*) FROM pancreas.condition_occurrence
UNION ALL SELECT 'procedure_occurrence', count(*) FROM pancreas.procedure_occurrence
UNION ALL SELECT 'observation', count(*) FROM pancreas.observation
UNION ALL SELECT 'specimen', count(*) FROM pancreas.specimen
ORDER BY 1;
"""
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "claude_dev", "-d", "parthenon", "-c", verify_sql],
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    print("Done!")


if __name__ == "__main__":
    main()
