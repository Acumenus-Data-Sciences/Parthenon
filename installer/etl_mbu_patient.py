#!/usr/bin/env python3
"""
ETL: Dr. Mallikarjun B. Udoshi — Single Patient Import to OHDSI Acumenus CDM

Imports a complete 9-year oncology record (Stage IV Metastatic Colon Carcinoma)
from unstructured clinical documents into OMOP CDM v5.4 tables.

Usage:
    /home/smudoshi/Github/Parthenon/ai/.venv/bin/python installer/etl_mbu_patient.py
    /home/smudoshi/Github/Parthenon/ai/.venv/bin/python installer/etl_mbu_patient.py --dry-run
    /home/smudoshi/Github/Parthenon/ai/.venv/bin/python installer/etl_mbu_patient.py --rollback
"""

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

def get_connection():
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    password = None
    for line in env_path.read_text().splitlines():
        if line.startswith("DB_PASSWORD="):
            password = line.split("=", 1)[1].strip()
            break
    if not password:
        sys.exit("ERROR: Could not read DB_PASSWORD from backend/.env")
    return psycopg2.connect(
        host="pgsql.acumenus.net",
        dbname="ohdsi",
        user="smudoshi",
        password=password,
    )


# ---------------------------------------------------------------------------
# OMOP Concept IDs (all verified against Acumenus vocabulary)
# ---------------------------------------------------------------------------

# Demographics
MALE = 8507
ASIAN_INDIAN = 38003574
NOT_HISPANIC = 38003564
EHR_TYPE = 32817

# Visit types
INPATIENT = 9201
OUTPATIENT = 9202

# Conditions
MALIGNANT_TUMOR_SIGMOID_COLON = 443381
METASTATIC_NEOPLASM_LUNG = 254591
METASTATIC_NEOPLASM_LIVER = 198700
METASTATIC_NEOPLASM_BONE = 78097
METASTATIC_NEOPLASM_PLEURA = 72266
PLEURAL_EFFUSION = 254061
PLEURISY = 78786
MUCOSITIS_FOLLOWING_THERAPY = 440436
MYELOSUPPRESSION = 4156433

# Procedures
COLONOSCOPY = 4249893
ENDOSCOPIC_POLYPECTOMY = 4103380
CT_ABDOMEN = 4061009
CT_ABDOMEN_PELVIS = 4304092
PET_CT = 4305790
SIGMOID_COLECTOMY = 4225427
CT_CHEST = 4058335
THORACOSCOPY = 4032774
BIOPSY_OF_LUNG = 4303062
RADIOFREQUENCY_ABLATION = 604322
THORACENTESIS = 4240305
PLAIN_CHEST_XRAY = 4163872
EXTERNAL_BEAM_RADIATION = 4141448

# Drug ingredients
OXALIPLATIN = 1318011
FLUOROURACIL = 955632
LEUCOVORIN = 1388796
IRINOTECAN = 1367268
BEVACIZUMAB = 1397141

# Measurements
CEA_MEASUREMENT = 4244721
EGFR_VARIANT = 35962802
KRAS_MUTATIONS = 3012200

# Units
NANOGRAM_PER_ML = 8842

# Observations
WEIGHT_LOSS = 4229881

# Note types (OMOP standard)
RADIOLOGY_REPORT = 44814637
PATHOLOGY_REPORT = 44814638


# ---------------------------------------------------------------------------
# Patient identity
# ---------------------------------------------------------------------------

PERSON_SOURCE_VALUE = "MBU-UDOSHI-499504"
YEAR_OF_BIRTH = 1942
MONTH_OF_BIRTH = 12
DAY_OF_BIRTH = 1


# ---------------------------------------------------------------------------
# ID allocation
# ---------------------------------------------------------------------------

def get_max_ids(cur):
    """Fetch current max IDs from all target tables."""
    tables = {
        "person": "person_id",
        "observation_period": "observation_period_id",
        "visit_occurrence": "visit_occurrence_id",
        "condition_occurrence": "condition_occurrence_id",
        "procedure_occurrence": "procedure_occurrence_id",
        "drug_exposure": "drug_exposure_id",
        "measurement": "measurement_id",
        "observation": "observation_id",
        "note": "note_id",
    }
    max_ids = {}
    for table, col in tables.items():
        cur.execute(f"SELECT COALESCE(MAX({col}), 0) FROM omop.{table}")
        max_ids[table] = cur.fetchone()[0]
    return max_ids


class IdAllocator:
    """Thread-safe incremental ID allocator per table."""

    def __init__(self, max_ids: dict):
        self._counters = {k: v for k, v in max_ids.items()}

    def next(self, table: str) -> int:
        self._counters[table] += 1
        return self._counters[table]


# ---------------------------------------------------------------------------
# Clinical event definitions
# ---------------------------------------------------------------------------

def build_visits(ids: IdAllocator, person_id: int) -> list[dict]:
    """All dated clinical encounters."""
    visits = []

    def add(dt: str, concept_id: int, source: str, visit_type: int = OUTPATIENT):
        visits.append({
            "visit_occurrence_id": ids.next("visit_occurrence"),
            "person_id": person_id,
            "visit_concept_id": visit_type,
            "visit_start_date": dt,
            "visit_end_date": dt,
            "visit_type_concept_id": EHR_TYPE,
            "visit_source_value": source,
        })

    # Colonoscopies
    add("2006-11-30", OUTPATIENT, "Routine colonoscopy - polypectomy")
    add("2007-05-01", OUTPATIENT, "Second colonoscopy - negative")
    add("2009-03-23", OUTPATIENT, "Third colonoscopy - negative")
    add("2011-04-01", OUTPATIENT, "Fourth colonoscopy - negative")
    add("2012-01-02", OUTPATIENT, "Fifth colonoscopy - negative (high CEA)")

    # Diagnostic imaging and procedures 2012
    add("2012-02-08", OUTPATIENT, "CT Abdomen - retroperitoneal mass found")
    add("2012-02-29", OUTPATIENT, "PET/CT @ UPenn - hypermetabolic lesion")
    add("2012-03-06", INPATIENT, "Sigmoid colectomy @ UPenn - Dr. Drebin", INPATIENT)

    # Chemotherapy 2012
    add("2012-05-07", OUTPATIENT, "FOLFOX started")

    # Imaging 2013
    add("2013-02-08", OUTPATIENT, "CT Chest - two small lung nodules")
    add("2013-05-13", OUTPATIENT, "CT Chest - enlarging 4 nodules")
    add("2013-05-15", OUTPATIENT, "PET/CT skull base to mid-thigh")

    # Thoracoscopy + biopsy 2013
    add("2013-08-19", INPATIENT, "Thoracoscopy + right lung biopsy @ HUP", INPATIENT)

    # Second chemo
    add("2013-10-07", OUTPATIENT, "FOLFIRI started")

    # Imaging 2013-2014
    add("2013-12-26", OUTPATIENT, "CT Chest - reduction in nodules")
    add("2014-03-26", OUTPATIENT, "CT Chest - stable")
    add("2014-07-03", OUTPATIENT, "CT Chest + Abdomen - enlarged nodules")
    add("2014-08-25", OUTPATIENT, "CT Chest - enlarging + new nodules")

    # Clinical trial
    add("2014-09-10", OUTPATIENT, "Phase I clinical trial (GSK) @ UPenn")

    # 2015
    add("2015-01-12", OUTPATIENT, "Consultation @ Johns Hopkins - Dr. Luis Diaz")
    add("2015-01-14", OUTPATIENT, "CT Chest + Abdomen - Commonwealth Health")
    add("2015-04-25", OUTPATIENT, "Consultation Dr. Hong - scheduled RFA")
    add("2015-05-18", OUTPATIENT, "CT Chest w/o contrast")
    add("2015-05-19", INPATIENT, "RFA right upper lung nodule", INPATIENT)
    add("2015-06-22", INPATIENT, "RFA left lung nodules x3 + hospitalization", INPATIENT)
    add("2015-06-30", OUTPATIENT, "CXR - left pleural effusion")
    add("2015-07-01", OUTPATIENT, "USG pleural tap - 1000mL")
    add("2015-08-03", OUTPATIENT, "PET/CT - multiple metastases")
    add("2015-08-05", OUTPATIENT, "Consultation radiation oncologist - Dr. Schulman")
    add("2015-08-10", OUTPATIENT, "Regional radiation therapy started (T5 + scapula)")

    return visits


def build_conditions(ids: IdAllocator, person_id: int, visit_map: dict) -> list[dict]:
    """All condition occurrences."""
    conditions = []

    def add(dt: str, concept_id: int, source: str, end_date: str = None):
        conditions.append({
            "condition_occurrence_id": ids.next("condition_occurrence"),
            "person_id": person_id,
            "condition_concept_id": concept_id,
            "condition_start_date": dt,
            "condition_end_date": end_date,
            "condition_type_concept_id": EHR_TYPE,
            "condition_source_value": source[:50],
            "visit_occurrence_id": visit_map.get(dt),
        })

    # Primary diagnosis
    add("2006-11-30", MALIGNANT_TUMOR_SIGMOID_COLON,
        "Adeno CA with slight submucosal invasion - sigmoid colon",
        "2015-08-28")

    # Chemotherapy side effects (FOLFOX)
    add("2012-05-07", MYELOSUPPRESSION, "Bone marrow suppression from FOLFOX", "2012-08-31")
    add("2012-05-07", MUCOSITIS_FOLLOWING_THERAPY, "Severe mucositis from FOLFOX", "2012-08-31")

    # Pulmonary metastases — first documented 2013-02-08
    add("2013-02-08", METASTATIC_NEOPLASM_LUNG,
        "CT: two small lung nodules - pulmonary metastasis", "2015-08-28")

    # Hospitalization complications — pleurisy
    add("2015-06-22", PLEURISY, "Severe chest wall pain - pleurisy post RFA")

    # Pleural effusion
    add("2015-06-30", PLEURAL_EFFUSION, "CXR: left pleural effusion + atelectasis")

    # Metastatic pleural disease
    add("2015-08-03", METASTATIC_NEOPLASM_PLEURA,
        "PET: pleural effusion SUV 3.4 - inflammatory or neoplastic")

    # Hepatic metastases — first documented 08/03/2015 PET
    add("2015-08-03", METASTATIC_NEOPLASM_LIVER,
        "PET: new diffuse metastatic liver disease, SUV 11.8")

    # Bone metastases — T5/T6, left superior scapula
    add("2015-08-03", METASTATIC_NEOPLASM_BONE,
        "PET: new bone mets T6 + left superior scapula, SUV 7.2")

    return conditions


def build_procedures(ids: IdAllocator, person_id: int, visit_map: dict) -> list[dict]:
    """All procedure occurrences."""
    procs = []

    def add(dt: str, concept_id: int, source: str, qty: int = 1):
        procs.append({
            "procedure_occurrence_id": ids.next("procedure_occurrence"),
            "person_id": person_id,
            "procedure_concept_id": concept_id,
            "procedure_date": dt,
            "procedure_type_concept_id": EHR_TYPE,
            "procedure_source_value": source[:50],
            "quantity": qty,
            "visit_occurrence_id": visit_map.get(dt),
        })

    # Colonoscopies
    add("2006-11-30", COLONOSCOPY, "Routine colonoscopy")
    add("2006-11-30", ENDOSCOPIC_POLYPECTOMY, "Single polyp removed - Adeno CA")
    add("2007-05-01", COLONOSCOPY, "Second colonoscopy - negative")
    add("2009-03-23", COLONOSCOPY, "Third colonoscopy - negative")
    add("2011-04-01", COLONOSCOPY, "Fourth colonoscopy - negative")
    add("2012-01-02", COLONOSCOPY, "Fifth colonoscopy - negative (high CEA)")

    # Imaging 2012
    add("2012-02-08", CT_ABDOMEN, "CT Abdomen - retro-peritoneal mass 3.4x3.2x2.7cm")
    add("2012-02-29", PET_CT, "PET/CT @ UPenn HUP - hypermetabolic retroperitoneal mass SUV 4.6")

    # Surgery
    add("2012-03-06", SIGMOID_COLECTOMY,
        "Sigmoid colectomy with end-to-end anastomosis @ UPenn - Dr. Drebin")

    # Imaging 2013
    add("2013-02-08", CT_CHEST, "CT Chest - two small lung nodules")
    add("2013-05-13", CT_CHEST,
        "CT Chest w/o contrast - interval increase, 6 nodules 4-6mm (prior 2-3mm)")
    add("2013-05-15", PET_CT,
        "PET/CT skull-to-thigh - subcentimeter nodules, no significant FDG uptake")

    # Thoracoscopy + biopsy
    add("2013-08-19", THORACOSCOPY, "Bronchoscopy, right VATS/wedge resection")
    add("2013-08-19", BIOPSY_OF_LUNG,
        "Right upper lobe wedge resection - metastatic adenocarcinoma, colorectal origin")

    # Imaging 2013-2014
    add("2013-12-26", CT_CHEST, "CT Chest - reduction of lung nodules, no new nodules")
    add("2014-03-26", CT_CHEST, "CT Chest - stable")
    add("2014-07-03", CT_CHEST, "CT Chest + Abdomen - enlarged lung nodules, no liver mets")
    add("2014-07-03", CT_ABDOMEN, "CT Abdomen - negative for metastasis in liver")
    add("2014-08-25", CT_CHEST, "CT Chest - enlarging lung nodules + new small nodules")

    # Imaging + procedures 2015
    add("2015-01-14", CT_ABDOMEN,
        "CT Abdomen w/wo contrast - no metastasis, improvement in liver density")
    add("2015-01-14", CT_CHEST,
        "CT Chest w contrast - slight interval increase in nodules vs 10/30/2014")
    add("2015-05-18", CT_CHEST,
        "CT Chest w/o contrast - nodules unchanged/minimally larger, no new nodules")
    add("2015-05-19", RADIOFREQUENCY_ABLATION,
        "RFA right upper lung nodule (single)")
    add("2015-06-22", RADIOFREQUENCY_ABLATION,
        "RFA left lung nodules (three)", 3)
    add("2015-06-30", PLAIN_CHEST_XRAY,
        "CXR - left pleural effusion + atelectasis of left lung base")
    add("2015-07-01", THORACENTESIS, "USG pleural tap - 1000mL from left chest")
    add("2015-08-03", PET_CT,
        "PET/CT skull-to-thigh - multiple mets: liver, lung, bone (T6, scapula)")
    add("2015-08-10", EXTERNAL_BEAM_RADIATION,
        "Regional radiation therapy to T5 + left scapula, 12 treatments", 12)

    return procs


def build_drug_exposures(ids: IdAllocator, person_id: int, visit_map: dict) -> list[dict]:
    """All drug exposure records. Multi-drug regimens split into individual ingredients."""
    drugs = []

    def add(start: str, end: str, concept_id: int, source: str, qty: int = None):
        drugs.append({
            "drug_exposure_id": ids.next("drug_exposure"),
            "person_id": person_id,
            "drug_concept_id": concept_id,
            "drug_exposure_start_date": start,
            "drug_exposure_end_date": end,
            "drug_type_concept_id": EHR_TYPE,
            "drug_source_value": source[:50],
            "quantity": qty,
            "visit_occurrence_id": visit_map.get(start),
        })

    # FOLFOX: 4 rounds, stopped due to bone marrow suppression + mucositis
    # May 2012 → ~Aug 2012 (biweekly cycles × 4 = ~2 months)
    add("2012-05-07", "2012-08-31", OXALIPLATIN, "FOLFOX - oxaliplatin (4 rounds)", 4)
    add("2012-05-07", "2012-08-31", FLUOROURACIL, "FOLFOX - fluorouracil (4 rounds)", 4)
    add("2012-05-07", "2012-08-31", LEUCOVORIN, "FOLFOX - leucovorin (4 rounds)", 4)

    # FOLFIRI: 7 rounds
    # Oct 2013 → ~Jan 2014 (biweekly × 7 ≈ 3.5 months)
    add("2013-10-07", "2014-01-31", IRINOTECAN, "FOLFIRI - irinotecan (7 rounds)", 7)
    add("2013-10-07", "2014-01-31", FLUOROURACIL, "FOLFIRI - fluorouracil (7 rounds)", 7)
    add("2013-10-07", "2014-01-31", LEUCOVORIN, "FOLFIRI - leucovorin (7 rounds)", 7)

    # Avastin maintenance: 7 treatments, no effect on lung nodules
    # Jan 2015 → April 2015
    add("2015-01-01", "2015-04-30", BEVACIZUMAB,
        "Avastin (bevacizumab) maintenance - 7 treatments, no effect", 7)

    # Phase I Clinical Trial (GlaxoSmithKline) @ UPenn — unknown investigational drug
    # concept_id = 0 for unknown
    add("2014-09-10", "2014-10-10", 0,
        "Phase I Clinical Trial (GlaxoSmithKline) @ UPenn - ceased for side effects")

    return drugs


def build_measurements(ids: IdAllocator, person_id: int, visit_map: dict) -> list[dict]:
    """CEA levels + molecular testing."""
    measurements = []

    def add_cea(dt: str, value: float):
        measurements.append({
            "measurement_id": ids.next("measurement"),
            "person_id": person_id,
            "measurement_concept_id": CEA_MEASUREMENT,
            "measurement_date": dt,
            "measurement_type_concept_id": EHR_TYPE,
            "value_as_number": value,
            "unit_concept_id": NANOGRAM_PER_ML,
            "measurement_source_value": f"CEA = {value} ng/mL",
            "visit_occurrence_id": visit_map.get(dt),
        })

    def add_mol(dt: str, concept_id: int, source: str, value_source: str):
        measurements.append({
            "measurement_id": ids.next("measurement"),
            "person_id": person_id,
            "measurement_concept_id": concept_id,
            "measurement_date": dt,
            "measurement_type_concept_id": EHR_TYPE,
            "value_as_number": None,
            "unit_concept_id": None,
            "value_source_value": value_source,
            "measurement_source_value": source[:50],
            "visit_occurrence_id": visit_map.get(dt),
        })

    # 16 serial CEA values — the disease arc biomarker
    add_cea("2006-12-15", 5.0)
    add_cea("2007-12-15", 5.1)
    add_cea("2009-03-15", 5.1)
    add_cea("2010-11-15", 6.1)
    add_cea("2011-12-15", 17.0)   # Rising — prompted 5th colonoscopy
    add_cea("2012-02-15", 20.0)   # Rising — led to CT discovery
    add_cea("2012-03-05", 22.0)   # Peak — pre-surgical
    add_cea("2012-03-07", 3.7)    # Post-sigmoid colectomy drop
    add_cea("2012-06-04", 4.5)
    add_cea("2012-10-15", 4.7)
    add_cea("2013-01-15", 4.7)
    add_cea("2013-05-15", 4.9)
    add_cea("2013-10-15", 4.5)
    add_cea("2013-12-15", 4.7)
    add_cea("2015-02-15", 5.7)    # Late rise — metastatic progression

    # EGFR mutation testing (08/19/2013 — HUP Molecular Pathology)
    add_mol("2013-08-19", EGFR_VARIANT,
            "EGFR Exon 19 deletion - Negative", "Negative")
    add_mol("2013-08-19", EGFR_VARIANT,
            "EGFR Leu858Arg (L858R) mutation - Negative", "Negative")

    # KRAS — previously tested positive (referenced in EGFR report)
    add_mol("2013-08-19", KRAS_MUTATIONS,
            "KRAS gene mutation - previously positive (KRAS)", "Positive")

    return measurements


def build_observations(ids: IdAllocator, person_id: int, visit_map: dict) -> list[dict]:
    """Clinical observations."""
    return [{
        "observation_id": ids.next("observation"),
        "person_id": person_id,
        "observation_concept_id": WEIGHT_LOSS,
        "observation_date": "2015-07-15",
        "observation_type_concept_id": EHR_TYPE,
        "observation_source_value":
            "July-Aug 2015: Severe weight loss, constitutional symptoms, debilitation",
        "visit_occurrence_id": visit_map.get("2015-07-01"),
    }]


def build_notes(ids: IdAllocator, person_id: int, visit_map: dict) -> list[dict]:
    """Full radiology and pathology report text stored as notes."""
    notes = []

    def add(dt: str, note_type: int, title: str, text: str):
        notes.append({
            "note_id": ids.next("note"),
            "person_id": person_id,
            "note_date": dt,
            "note_type_concept_id": note_type,
            "note_class_concept_id": 0,
            "note_title": title,
            "note_text": text,
            "encoding_concept_id": 0,
            "language_concept_id": 4180186,  # English
            "visit_occurrence_id": visit_map.get(dt),
        })

    add("2012-02-17", RADIOLOGY_REPORT,
        "CT Abdomen w/wo contrast — CDI Wyoming Valley",
        "Dr. Naresh Shah. 3 cm retroperitoneal process, most likely abscess or inflammatory. "
        "Probable left-sided hydrocele. Prostatomegaly. Mild fatty infiltration of liver. "
        "No retroperitoneal lymphadenopathy. Biopsy strongly recommended.")

    add("2012-02-29", RADIOLOGY_REPORT,
        "PET/CT Skull Base to Mid-Thigh — HUP",
        "Dr. Drebin / Dr. Shah. 2.9x2.6cm ill-defined retroperitoneal mass at level of "
        "bifurcation of common iliac vessels, peripheral rim FDG uptake Max SUV 4.6. "
        "Favored metastatic retroperitoneal lymphadenopathy. Post-surgical CABG changes. "
        "No other abnormal FDG avid foci.")

    add("2013-05-13", RADIOLOGY_REPORT,
        "CT Chest w/o contrast — CDI Commonwealth Health",
        "Dr. Naresh Shah. Interval increase in number and size of pulmonary nodules. "
        "RUL 5x4x5mm (was 3x3x3mm). LUL 5x3x4mm (was 3x2x3mm). New left midlung nodule "
        "5x4x5mm. ~6 nodules total 4-6mm. Pulmonary metastasis strongly considered.")

    add("2013-05-15", RADIOLOGY_REPORT,
        "PET/CT Skull Base to Mid-Thigh — Wilkes-Barre General",
        "Dr. Nobel George. No significant FDG uptake for subcentimeter pulmonary nodules "
        "(may be beyond PET resolution). No recurrence at surgical site. No other FDG avid "
        "lesions. Follow-up 3-6 months recommended.")

    add("2013-08-19", PATHOLOGY_REPORT,
        "Surgical Pathology — Right Lung Biopsy @ HUP",
        "Dr. Joseph Hatem, Dr. Charuhas Deshpande. Lung, right upper lobe, wedge resection: "
        "Metastatic adenocarcinoma, morphologically consistent with colorectal origin. "
        "CDX-2 positive by immunohistochemistry. Parenchymal margin no tumor. "
        "Frozen section: 1A-adenocarcinoma present. Specimen 3.0x3.5x1.5cm.")

    add("2013-08-19", PATHOLOGY_REPORT,
        "EGFR Mutation Analysis — HUP Molecular Pathology",
        "Dr. Pear, Warren. Tissue: Lung right upper lobe. Paraffin-embedded. "
        "EGFR Exon 19 deletion: Negative. EGFR Leu858Arg mutation: Negative. "
        "Diagnosis: Metastatic Adenocarcinoma. Previous molecular tests: KRAS (positive).")

    add("2015-01-14", RADIOLOGY_REPORT,
        "CT Abdomen w/wo contrast — Commonwealth Health",
        "Dr. Naresh Shah. No hepatic metastasis or mass. Improvement in liver density "
        "(51 HU vs prior fatty infiltration). Previous small cyst not appreciated. "
        "No retroperitoneal lymphadenopathy. No renal calculus. No abdominal abnormality.")

    add("2015-01-14", RADIOLOGY_REPORT,
        "CT Chest w contrast — Commonwealth Health",
        "Dr. Naresh Shah. Slight interval increase in size and density of multiple "
        "bilateral pulmonary nodules vs 10/30/2014. RUL apex 20x15x17mm (was 16x14x14mm). "
        "Right midlung hilar region 31x24x28mm. Multiple bilateral nodules. No mediastinal "
        "mass or lymphadenopathy.")

    add("2015-05-18", RADIOLOGY_REPORT,
        "CT Chest w/o contrast — Commonwealth Health",
        "Dr. Naresh Shah. Multiple pulmonary nodules consistent with pulmonary metastasis. "
        "Nodules either unchanged or minimally larger vs prior study. No new nodules. "
        "No hilar or mediastinal lymphadenopathy. No hepatic metastasis. "
        "RUL 19x17mm. Hilar region 27x22mm. Left hilum 24x21mm.")

    add("2015-08-03", RADIOLOGY_REPORT,
        "PET/CT Skull Base to Mid-Thigh — Wilkes-Barre General",
        "Dr. Joan Forgetta. Post RFA + chemo. Majority of pulmonary nodules increased in "
        "size/uptake. Right hilum 2.8x1.6cm SUV 10.3. Left lower lobe 2.4cm SUV 4.2. "
        "New left pleural effusion SUV 3.4. New bilateral hilar + mediastinal "
        "lymphadenopathy SUV 6.8. NEW diffuse metastatic liver disease SUV 11.8. "
        "NEW bone mets T6 + left superior scapula SUV 7.2.")

    return notes


# ---------------------------------------------------------------------------
# SQL insertion helpers
# ---------------------------------------------------------------------------

PERSON_SQL = """
INSERT INTO omop.person (
    person_id, gender_concept_id, year_of_birth, month_of_birth, day_of_birth,
    birth_datetime, race_concept_id, ethnicity_concept_id,
    person_source_value, gender_source_value, race_source_value,
    location_id, provider_id, care_site_id
) VALUES (
    %(person_id)s, %(gender_concept_id)s, %(year_of_birth)s, %(month_of_birth)s,
    %(day_of_birth)s, %(birth_datetime)s, %(race_concept_id)s, %(ethnicity_concept_id)s,
    %(person_source_value)s, %(gender_source_value)s, %(race_source_value)s,
    NULL, NULL, NULL
)
"""

OBS_PERIOD_SQL = """
INSERT INTO omop.observation_period (
    observation_period_id, person_id,
    observation_period_start_date, observation_period_end_date,
    period_type_concept_id
) VALUES (%(id)s, %(person_id)s, %(start)s, %(end)s, %(type)s)
"""

VISIT_SQL = """
INSERT INTO omop.visit_occurrence (
    visit_occurrence_id, person_id, visit_concept_id,
    visit_start_date, visit_end_date, visit_type_concept_id,
    visit_source_value,
    admitted_from_concept_id, discharged_to_concept_id,
    preceding_visit_occurrence_id
) VALUES (
    %(visit_occurrence_id)s, %(person_id)s, %(visit_concept_id)s,
    %(visit_start_date)s, %(visit_end_date)s, %(visit_type_concept_id)s,
    %(visit_source_value)s, 0, 0, NULL
)
"""

CONDITION_SQL = """
INSERT INTO omop.condition_occurrence (
    condition_occurrence_id, person_id, condition_concept_id,
    condition_start_date, condition_end_date, condition_type_concept_id,
    condition_source_value, visit_occurrence_id,
    condition_status_concept_id
) VALUES (
    %(condition_occurrence_id)s, %(person_id)s, %(condition_concept_id)s,
    %(condition_start_date)s, %(condition_end_date)s, %(condition_type_concept_id)s,
    %(condition_source_value)s, %(visit_occurrence_id)s, 0
)
"""

PROCEDURE_SQL = """
INSERT INTO omop.procedure_occurrence (
    procedure_occurrence_id, person_id, procedure_concept_id,
    procedure_date, procedure_type_concept_id,
    procedure_source_value, quantity, visit_occurrence_id,
    modifier_concept_id
) VALUES (
    %(procedure_occurrence_id)s, %(person_id)s, %(procedure_concept_id)s,
    %(procedure_date)s, %(procedure_type_concept_id)s,
    %(procedure_source_value)s, %(quantity)s, %(visit_occurrence_id)s, 0
)
"""

DRUG_SQL = """
INSERT INTO omop.drug_exposure (
    drug_exposure_id, person_id, drug_concept_id,
    drug_exposure_start_date, drug_exposure_end_date,
    drug_type_concept_id, drug_source_value, quantity,
    visit_occurrence_id, route_concept_id, dose_unit_source_value
) VALUES (
    %(drug_exposure_id)s, %(person_id)s, %(drug_concept_id)s,
    %(drug_exposure_start_date)s, %(drug_exposure_end_date)s,
    %(drug_type_concept_id)s, %(drug_source_value)s, %(quantity)s,
    %(visit_occurrence_id)s, 0, NULL
)
"""

MEASUREMENT_SQL = """
INSERT INTO omop.measurement (
    measurement_id, person_id, measurement_concept_id,
    measurement_date, measurement_type_concept_id,
    value_as_number, unit_concept_id,
    measurement_source_value, visit_occurrence_id,
    value_source_value
) VALUES (
    %(measurement_id)s, %(person_id)s, %(measurement_concept_id)s,
    %(measurement_date)s, %(measurement_type_concept_id)s,
    %(value_as_number)s, %(unit_concept_id)s,
    %(measurement_source_value)s, %(visit_occurrence_id)s,
    %(value_source_value)s
)
"""

OBSERVATION_SQL = """
INSERT INTO omop.observation (
    observation_id, person_id, observation_concept_id,
    observation_date, observation_type_concept_id,
    observation_source_value, visit_occurrence_id,
    value_as_string
) VALUES (
    %(observation_id)s, %(person_id)s, %(observation_concept_id)s,
    %(observation_date)s, %(observation_type_concept_id)s,
    %(observation_source_value)s, %(visit_occurrence_id)s, NULL
)
"""

NOTE_SQL = """
INSERT INTO omop.note (
    note_id, person_id, note_date, note_type_concept_id,
    note_class_concept_id, note_title, note_text,
    encoding_concept_id, language_concept_id,
    visit_occurrence_id
) VALUES (
    %(note_id)s, %(person_id)s, %(note_date)s, %(note_type_concept_id)s,
    %(note_class_concept_id)s, %(note_title)s, %(note_text)s,
    %(encoding_concept_id)s, %(language_concept_id)s,
    %(visit_occurrence_id)s
)
"""

DEATH_SQL = """
INSERT INTO omop.death (
    person_id, death_date, death_type_concept_id,
    cause_concept_id, cause_source_value
) VALUES (%(person_id)s, %(death_date)s, %(type)s, %(cause)s, %(cause_source)s)
"""


# ---------------------------------------------------------------------------
# Main ETL
# ---------------------------------------------------------------------------

def check_already_loaded(cur, person_source_value: str) -> bool:
    cur.execute(
        "SELECT person_id FROM omop.person WHERE person_source_value = %s",
        (person_source_value,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def rollback_patient(conn, person_id: int):
    """Remove all records for this patient across all OMOP tables."""
    cur = conn.cursor()
    tables = [
        ("omop.note", "person_id"),
        ("omop.observation", "person_id"),
        ("omop.measurement", "person_id"),
        ("omop.drug_exposure", "person_id"),
        ("omop.procedure_occurrence", "person_id"),
        ("omop.condition_occurrence", "person_id"),
        ("omop.visit_occurrence", "person_id"),
        ("omop.death", "person_id"),
        ("omop.observation_period", "person_id"),
        ("omop.person", "person_id"),
    ]
    for table, col in tables:
        cur.execute(f"DELETE FROM {table} WHERE {col} = %s", (person_id,))
        print(f"  Deleted {cur.rowcount} rows from {table}")
    conn.commit()
    print(f"\nRollback complete for person_id={person_id}")


def run_etl(dry_run: bool = False):
    conn = get_connection()
    cur = conn.cursor()

    # Check for prior load
    existing = check_already_loaded(cur, PERSON_SOURCE_VALUE)
    if existing:
        print(f"Patient already loaded as person_id={existing}")
        print("Use --rollback to remove and re-import, or manually verify.")
        conn.close()
        return

    # Allocate IDs
    max_ids = get_max_ids(cur)
    ids = IdAllocator(max_ids)
    person_id = ids.next("person")

    print(f"{'[DRY RUN] ' if dry_run else ''}ETL: Dr. M.B. Udoshi → person_id={person_id}")
    print(f"  Max existing person_id: {max_ids['person']}")
    print()

    # Build visit map: date → visit_occurrence_id (for FK linkage)
    visits = build_visits(ids, person_id)
    visit_map = {}
    for v in visits:
        visit_map[v["visit_start_date"]] = v["visit_occurrence_id"]

    # Build all domain records
    conditions = build_conditions(ids, person_id, visit_map)
    procedures = build_procedures(ids, person_id, visit_map)
    drugs = build_drug_exposures(ids, person_id, visit_map)
    measurements = build_measurements(ids, person_id, visit_map)
    observations = build_observations(ids, person_id, visit_map)
    notes = build_notes(ids, person_id, visit_map)

    # Summary
    print("  Records to insert:")
    print(f"    person:               1")
    print(f"    observation_period:   1")
    print(f"    visit_occurrence:     {len(visits)}")
    print(f"    condition_occurrence: {len(conditions)}")
    print(f"    procedure_occurrence: {len(procedures)}")
    print(f"    drug_exposure:        {len(drugs)}")
    print(f"    measurement:          {len(measurements)}")
    print(f"    observation:          {len(observations)}")
    print(f"    note:                 {len(notes)}")
    print(f"    death:                1")
    total = 1 + 1 + len(visits) + len(conditions) + len(procedures) + len(drugs) \
        + len(measurements) + len(observations) + len(notes) + 1
    print(f"    ─────────────────────────")
    print(f"    TOTAL:                {total}")
    print()

    if dry_run:
        print("[DRY RUN] No data written. Remove --dry-run to execute.")
        conn.close()
        return

    # Execute in single transaction
    try:
        # 1. Person
        cur.execute(PERSON_SQL, {
            "person_id": person_id,
            "gender_concept_id": MALE,
            "year_of_birth": YEAR_OF_BIRTH,
            "month_of_birth": MONTH_OF_BIRTH,
            "day_of_birth": DAY_OF_BIRTH,
            "birth_datetime": datetime(1942, 12, 1),
            "race_concept_id": ASIAN_INDIAN,
            "ethnicity_concept_id": NOT_HISPANIC,
            "person_source_value": PERSON_SOURCE_VALUE,
            "gender_source_value": "M",
            "race_source_value": "East Indian",
        })
        print("  ✓ person")

        # 2. Observation period
        obs_period_id = ids.next("observation_period")
        cur.execute(OBS_PERIOD_SQL, {
            "id": obs_period_id,
            "person_id": person_id,
            "start": date(2006, 11, 30),
            "end": date(2015, 8, 28),
            "type": EHR_TYPE,
        })
        print("  ✓ observation_period")

        # 3. Visits
        for v in visits:
            cur.execute(VISIT_SQL, v)
        print(f"  ✓ visit_occurrence ({len(visits)})")

        # 4. Conditions
        for c in conditions:
            cur.execute(CONDITION_SQL, c)
        print(f"  ✓ condition_occurrence ({len(conditions)})")

        # 5. Procedures
        for p in procedures:
            cur.execute(PROCEDURE_SQL, p)
        print(f"  ✓ procedure_occurrence ({len(procedures)})")

        # 6. Drug exposures
        for d in drugs:
            cur.execute(DRUG_SQL, d)
        print(f"  ✓ drug_exposure ({len(drugs)})")

        # 7. Measurements
        for m in measurements:
            # Ensure value_source_value key exists
            if "value_source_value" not in m:
                m["value_source_value"] = None
            cur.execute(MEASUREMENT_SQL, m)
        print(f"  ✓ measurement ({len(measurements)})")

        # 8. Observations
        for o in observations:
            cur.execute(OBSERVATION_SQL, o)
        print(f"  ✓ observation ({len(observations)})")

        # 9. Notes
        for n in notes:
            cur.execute(NOTE_SQL, n)
        print(f"  ✓ note ({len(notes)})")

        # 10. Death — date not confirmed; using last documented encounter
        cur.execute(DEATH_SQL, {
            "person_id": person_id,
            "death_date": date(2015, 8, 28),  # Last documented radiation treatment
            "type": EHR_TYPE,
            "cause": MALIGNANT_TUMOR_SIGMOID_COLON,
            "cause_source": "Stage IV Metastatic Colon CA Sigmoid",
        })
        print("  ✓ death")

        conn.commit()
        print(f"\n{'='*60}")
        print(f"ETL COMPLETE: Dr. M.B. Udoshi loaded as person_id={person_id}")
        print(f"  {total} records across 10 OMOP CDM tables")
        print(f"  Observation period: 2006-11-30 → 2015-08-28 (9 years)")
        print(f"{'='*60}")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        print("Transaction rolled back. No data written.")
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="ETL: Dr. M.B. Udoshi → OHDSI Acumenus CDM"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be inserted without writing")
    parser.add_argument("--rollback", action="store_true",
                        help="Remove all records for this patient")
    args = parser.parse_args()

    if args.rollback:
        conn = get_connection()
        cur = conn.cursor()
        existing = check_already_loaded(cur, PERSON_SOURCE_VALUE)
        if not existing:
            print("Patient not found in database. Nothing to rollback.")
            conn.close()
            return
        print(f"Rolling back person_id={existing} ({PERSON_SOURCE_VALUE})...")
        rollback_patient(conn, existing)
        conn.close()
        return

    run_etl(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
