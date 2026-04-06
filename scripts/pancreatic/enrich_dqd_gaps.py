#!/usr/bin/env python3
"""
Enrich the pancreas CDM to pass all Achilles and DQD checks.

Addresses gaps identified in the 2026-04-06 audit:
  1. Source concept IDs — all zero, set to match standard concept IDs
  2. Location table — create cancer center locations, link to persons
  3. Provider table — create oncology providers, link to clinical events
  4. Observation table — smoking status, ECOG PS, family history
  5. Measurement visit linkage — create lab visits for 124K unlinked measurements
  6. INR unit_concept_id — set to 8523 (ratio)
  7. Payer plan period — add insurance records
  8. Device exposure — port-a-caths, biliary stents, CVCs

Non-destructive: does NOT truncate existing data. Additive inserts + targeted UPDATEs.
Idempotent: checks for existing data before inserting.
Deterministic: seeded RNG for reproducibility.

Run: python3 scripts/pancreatic/enrich_dqd_gaps.py
"""

import random
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import psycopg2

# ── Connection ─────────────────────────────────────────────────────────────

DB_DSN = "host=localhost dbname=parthenon user=claude_dev"
SCHEMA = "pancreas"

# ── OMOP Concept IDs ──────────────────────────────────────────────────────

# Observation concepts
TOBACCO_SMOKING_STATUS = 43054909   # Tobacco smoking status (LOINC observation)
ECOG_GRADE_0 = 4175026             # ECOG performance status - grade 0
ECOG_GRADE_1 = 4173614             # ECOG performance status - grade 1
ECOG_GRADE_2 = 4172043             # ECOG performance status - grade 2
ECOG_GRADE_3 = 4174241             # ECOG performance status - grade 3
ECOG_GRADE_4 = 4174251             # ECOG performance status - grade 4
FAMILY_HISTORY_MALIGNANT = 4171594  # Family history of malignant neoplasm

# Smoking value_as_concept_id (LOINC Meas Value answers)
SMOKE_NEVER = 45877994     # Yes → mapped to "Never smoker" in context
SMOKE_FORMER = 45883458    # Former smoker
SMOKE_CURRENT = 45884037   # Current some day smoker

# Visit concepts
INPATIENT = 9201
OUTPATIENT = 9202
OFFICE_VISIT = 581477

# Type concepts
EHR_TYPE = 32817           # EHR
OBS_FROM_EHR = 38000280    # Observation recorded from EHR

# Provider specialty concepts (Medicare Specialty vocabulary)
SPEC_MED_ONCOLOGY = 38004507     # Medical Oncology
SPEC_SURGICAL_ONCOLOGY = 38004508  # Surgical Oncology
SPEC_RADIATION_ONC = 38004509    # Radiation Oncology
SPEC_GASTROENTEROLOGY = 38004455  # Gastroenterology
SPEC_GENERAL_SURGERY = 38004447   # General Surgery
SPEC_PATHOLOGY = 38004466         # Pathology
SPEC_DIAG_RADIOLOGY = 38004675   # Physician / Diagnostic Radiology
SPEC_PALLIATIVE = 38004462        # Hospice And Palliative Care
SPEC_INTERNAL_MED = 38004456      # Internal Medicine
SPEC_HEME_ONC = 38004502          # Hematology / Oncology

# Payer concepts
PAYER_MEDICARE_PPO = 330   # Commercial Managed Care - PPO (as Medicare proxy)
PAYER_MEDICAID = 289       # Medicaid
PAYER_COMMERCIAL_HMO = 329  # Commercial Managed Care - HMO
PAYER_DUAL = 288           # Dual Eligibility Medicare/Medicaid

# Device concepts
DEVICE_PORT_CATHETER = 37018262  # Abdominal and/or thoracic port and catheter
DEVICE_BILIARY_STENT = 4234567   # Biliary stent
DEVICE_CVC = 4179206             # Central venous catheter

# Unit concepts
UNIT_RATIO = 8523  # ratio (for INR)

# Condition concepts (for subgroup inference)
PDAC = 4180793
T2DM = 201826
CACHEXIA = 134765

# Drug concepts (for subgroup inference)
FLUOROURACIL = 955632
GEMCITABINE = 1314924
IRINOTECAN = 1367268

# ── Helpers ────────────────────────────────────────────────────────────────

def sql_str(s: str) -> str:
    return s.replace("'", "''")


def date_str(d: date) -> str:
    return d.isoformat()


def log(msg: str) -> None:
    print(f"  → {msg}", flush=True)


# ── Data loading ───────────────────────────────────────────────────────────

@dataclass
class PersonInfo:
    person_id: int
    year_of_birth: int
    gender_concept_id: int
    obs_start: date
    obs_end: date
    has_diabetes: bool
    has_cachexia: bool
    subgroup: str  # resectable, borderline, metastatic
    chemo_regimen: str  # folfirinox, gem_nabpac, gem_mono
    gets_surgery: bool


def load_persons(cur) -> list[PersonInfo]:
    """Load all persons with their clinical characteristics."""
    cur.execute(f"""
        SELECT p.person_id, p.year_of_birth, p.gender_concept_id,
               op.observation_period_start_date, op.observation_period_end_date
        FROM {SCHEMA}.person p
        JOIN {SCHEMA}.observation_period op ON p.person_id = op.person_id
        ORDER BY p.person_id
    """)
    persons_raw = cur.fetchall()

    # Load conditions per person
    cur.execute(f"""
        SELECT person_id, condition_concept_id
        FROM {SCHEMA}.condition_occurrence
    """)
    conditions: dict[int, set[int]] = {}
    for pid, cid in cur.fetchall():
        conditions.setdefault(pid, set()).add(cid)

    # Load drugs per person
    cur.execute(f"""
        SELECT DISTINCT person_id, drug_concept_id
        FROM {SCHEMA}.drug_exposure
    """)
    drugs: dict[int, set[int]] = {}
    for pid, did in cur.fetchall():
        drugs.setdefault(pid, set()).add(did)

    # Load procedures per person
    cur.execute(f"""
        SELECT DISTINCT person_id, procedure_concept_id
        FROM {SCHEMA}.procedure_occurrence
    """)
    procs: dict[int, set[int]] = {}
    for pid, pcid in cur.fetchall():
        procs.setdefault(pid, set()).add(pcid)

    persons: list[PersonInfo] = []
    for pid, yob, gender, obs_start, obs_end in persons_raw:
        pconds = conditions.get(pid, set())
        pdrugs = drugs.get(pid, set())
        pprocs = procs.get(pid, set())

        has_diabetes = T2DM in pconds
        has_cachexia = CACHEXIA in pconds

        # Infer subgroup from drug/procedure pattern
        has_folfirinox = IRINOTECAN in pdrugs and FLUOROURACIL in pdrugs
        gets_surgery = len(pprocs) > 0  # has any procedure (Whipple or distal panc)

        if gets_surgery:
            subgroup = "resectable"
        elif has_folfirinox and not gets_surgery:
            subgroup = "borderline"
        else:
            subgroup = "metastatic"

        if has_folfirinox:
            chemo = "folfirinox"
        elif GEMCITABINE in pdrugs and len(pdrugs) > 2:
            chemo = "gem_nabpac"
        else:
            chemo = "gem_mono"

        persons.append(PersonInfo(
            person_id=pid,
            year_of_birth=yob,
            gender_concept_id=gender,
            obs_start=obs_start,
            obs_end=obs_end,
            has_diabetes=has_diabetes,
            has_cachexia=has_cachexia,
            subgroup=subgroup,
            chemo_regimen=chemo,
            gets_surgery=gets_surgery,
        ))

    return persons


# ── Step 1: Fix source concept IDs ────────────────────────────────────────

def fix_source_concept_ids(cur) -> None:
    """Set *_source_concept_id = *_concept_id where source_concept_id = 0."""
    print("\n[1/8] Fixing source concept IDs...")

    updates = [
        ("condition_occurrence", "condition_concept_id", "condition_source_concept_id"),
        ("drug_exposure", "drug_concept_id", "drug_source_concept_id"),
        ("procedure_occurrence", "procedure_concept_id", "procedure_source_concept_id"),
        ("measurement", "measurement_concept_id", "measurement_source_concept_id"),
    ]

    for table, concept_col, source_col in updates:
        cur.execute(f"""
            UPDATE {SCHEMA}.{table}
            SET {source_col} = {concept_col}
            WHERE {source_col} = 0 OR {source_col} IS NULL
        """)
        log(f"{table}: {cur.rowcount} rows updated")


# ── Step 2: Populate location and provider ─────────────────────────────────

LOCATIONS = [
    (1, "Acumenus Cancer Center", "100 Oncology Drive", "Philadelphia", "PA", "19104", "US"),
    (2, "Acumenus Surgical Pavilion", "200 Surgical Way", "Philadelphia", "PA", "19104", "US"),
    (3, "Acumenus Outpatient Infusion", "300 Infusion Court", "Philadelphia", "PA", "19106", "US"),
    (4, "Acumenus Radiology Center", "400 Imaging Blvd", "Philadelphia", "PA", "19107", "US"),
    (5, "Acumenus Pathology Lab", "500 Pathology Lane", "Philadelphia", "PA", "19108", "US"),
]

PROVIDERS = [
    # (provider_id, provider_name, specialty_concept_id, care_site_id, specialty_source_value)
    (1, "James Chen, MD", SPEC_MED_ONCOLOGY, 1, "Medical Oncology"),
    (2, "Sarah Martinez, MD", SPEC_MED_ONCOLOGY, 1, "Medical Oncology"),
    (3, "David Park, MD", SPEC_SURGICAL_ONCOLOGY, 2, "Surgical Oncology"),
    (4, "Robert Kim, MD", SPEC_GENERAL_SURGERY, 2, "General Surgery"),
    (5, "Linda Wu, MD", SPEC_GASTROENTEROLOGY, 1, "Gastroenterology"),
    (6, "Michael Patel, MD", SPEC_RADIATION_ONC, 1, "Radiation Oncology"),
    (7, "Jennifer Lee, MD", SPEC_PATHOLOGY, 5, "Pathology"),
    (8, "Thomas Brown, MD", SPEC_DIAG_RADIOLOGY, 4, "Diagnostic Radiology"),
    (9, "Patricia Davis, MD", SPEC_PALLIATIVE, 1, "Palliative Care"),
    (10, "Daniel Wilson, MD", SPEC_INTERNAL_MED, 3, "Internal Medicine"),
    (11, "Emily Johnson, MD", SPEC_HEME_ONC, 1, "Hematology/Oncology"),
    (12, "Richard Zhang, MD", SPEC_HEME_ONC, 1, "Hematology/Oncology"),
]


def populate_locations_providers(cur, persons: list[PersonInfo], rng: random.Random) -> None:
    """Create locations, providers, and link persons to locations."""
    print("\n[2/8] Populating locations and providers...")

    # Check if already populated
    cur.execute(f"SELECT count(*) FROM {SCHEMA}.location")
    if cur.fetchone()[0] > 0:
        log("Locations already populated, skipping")
    else:
        for loc_id, name, addr, city, state, zipcode, country in LOCATIONS:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.location
                    (location_id, address_1, city, state, zip, county, location_source_value, country_concept_id, country_source_value)
                VALUES ({loc_id}, '{sql_str(addr)}', '{city}', '{state}', '{zipcode}',
                        'Philadelphia County', '{sql_str(name)}', 0, '{country}')
            """)
        log(f"Inserted {len(LOCATIONS)} locations")

    cur.execute(f"SELECT count(*) FROM {SCHEMA}.provider")
    if cur.fetchone()[0] > 0:
        log("Providers already populated, skipping")
    else:
        for prov_id, name, spec_id, cs_id, spec_src in PROVIDERS:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.provider
                    (provider_id, provider_name, npi, dea, specialty_concept_id,
                     care_site_id, year_of_birth, gender_concept_id, provider_source_value,
                     specialty_source_value, gender_source_value)
                VALUES ({prov_id}, '{sql_str(name)}', NULL, NULL, {spec_id},
                        {cs_id}, NULL, 0, '{sql_str(name)}',
                        '{sql_str(spec_src)}', NULL)
            """)
        log(f"Inserted {len(PROVIDERS)} providers")

    # Link persons to locations (cancer center catchment area)
    cur.execute(f"SELECT count(*) FROM {SCHEMA}.person WHERE location_id IS NOT NULL AND location_id != 0")
    if cur.fetchone()[0] > 0:
        log("Persons already linked to locations, skipping")
    else:
        for p in persons:
            loc_id = rng.choice([1, 2, 3])  # distribute across 3 main locations
            cur.execute(f"""
                UPDATE {SCHEMA}.person SET location_id = {loc_id} WHERE person_id = {p.person_id}
            """)
        log(f"Linked {len(persons)} persons to locations")

    # Link visits to providers
    cur.execute(f"""
        SELECT count(*) FROM {SCHEMA}.visit_occurrence
        WHERE provider_id IS NOT NULL AND provider_id != 0
    """)
    if cur.fetchone()[0] > 0:
        log("Visits already linked to providers, skipping")
    else:
        # Inpatient visits → surgeons (3, 4), outpatient → oncologists (1, 2, 11, 12)
        cur.execute(f"""
            UPDATE {SCHEMA}.visit_occurrence
            SET provider_id = CASE
                WHEN visit_concept_id = {INPATIENT} THEN
                    (ARRAY[3, 4])[1 + (visit_occurrence_id % 2)]
                ELSE
                    (ARRAY[1, 2, 11, 12])[1 + (visit_occurrence_id % 4)]
            END
        """)
        log(f"Linked {cur.rowcount} visits to providers")

    # Link clinical events to providers
    for table, id_col in [
        ("condition_occurrence", "condition_occurrence_id"),
        ("drug_exposure", "drug_exposure_id"),
        ("procedure_occurrence", "procedure_occurrence_id"),
        ("measurement", "measurement_id"),
    ]:
        cur.execute(f"""
            UPDATE {SCHEMA}.{table} t
            SET provider_id = v.provider_id
            FROM {SCHEMA}.visit_occurrence v
            WHERE t.visit_occurrence_id = v.visit_occurrence_id
            AND (t.provider_id IS NULL OR t.provider_id = 0)
            AND t.visit_occurrence_id IS NOT NULL
        """)
        log(f"{table}: linked {cur.rowcount} rows to providers via visits")


# ── Step 3: Populate observation table ─────────────────────────────────────

def populate_observations(cur, persons: list[PersonInfo], rng: random.Random) -> None:
    """Add smoking status, ECOG performance status, and family history."""
    print("\n[3/8] Populating observation table...")

    cur.execute(f"SELECT count(*) FROM {SCHEMA}.observation")
    if cur.fetchone()[0] > 0:
        log("Observations already populated, skipping")
        return

    obs_id = 1
    sql_parts: list[str] = []

    for p in persons:
        # Diagnosis date ~= observation start + some offset
        dx_date = p.obs_start + timedelta(days=rng.randint(0, 30))

        # ── Smoking status ──
        # Pancreatic cancer: ~25% current/former smoker, ~60% never, ~15% former
        smoke_roll = rng.random()
        if smoke_roll < 0.60:
            smoke_value = SMOKE_NEVER
            smoke_src = "Never smoker"
        elif smoke_roll < 0.80:
            smoke_value = SMOKE_FORMER
            smoke_src = "Former smoker"
        else:
            smoke_value = SMOKE_CURRENT
            smoke_src = "Current smoker"

        sql_parts.append(f"""
            ({obs_id}, {p.person_id}, {TOBACCO_SMOKING_STATUS}, '{date_str(dx_date)}',
             '{date_str(dx_date)} 09:00:00', {OBS_FROM_EHR}, NULL, NULL,
             {smoke_value}, NULL, NULL, NULL, NULL, {TOBACCO_SMOKING_STATUS},
             '{smoke_src}', 'LOINC:72166-2', NULL)
        """)
        obs_id += 1

        # ── ECOG Performance Status ──
        # At diagnosis: resectable → mostly 0-1, borderline → 1-2, metastatic → 1-3
        if p.subgroup == "resectable":
            ecog_weights = [(ECOG_GRADE_0, 0.50), (ECOG_GRADE_1, 0.40), (ECOG_GRADE_2, 0.10)]
        elif p.subgroup == "borderline":
            ecog_weights = [(ECOG_GRADE_0, 0.15), (ECOG_GRADE_1, 0.45), (ECOG_GRADE_2, 0.35), (ECOG_GRADE_3, 0.05)]
        else:  # metastatic
            ecog_weights = [(ECOG_GRADE_0, 0.05), (ECOG_GRADE_1, 0.30), (ECOG_GRADE_2, 0.40), (ECOG_GRADE_3, 0.20), (ECOG_GRADE_4, 0.05)]

        ecog_concept = _weighted_choice(rng, ecog_weights)
        ecog_grade = {ECOG_GRADE_0: 0, ECOG_GRADE_1: 1, ECOG_GRADE_2: 2, ECOG_GRADE_3: 3, ECOG_GRADE_4: 4}[ecog_concept]

        sql_parts.append(f"""
            ({obs_id}, {p.person_id}, {ecog_concept}, '{date_str(dx_date)}',
             '{date_str(dx_date)} 09:00:00', {OBS_FROM_EHR}, {ecog_grade}, NULL,
             0, NULL, NULL, NULL, NULL, {ecog_concept},
             'ECOG PS {ecog_grade}', 'ECOG', NULL)
        """)
        obs_id += 1

        # ── Family history of malignant neoplasm ──
        # ~10% of PDAC patients have positive family history
        if rng.random() < 0.10:
            sql_parts.append(f"""
                ({obs_id}, {p.person_id}, {FAMILY_HISTORY_MALIGNANT}, '{date_str(dx_date)}',
                 '{date_str(dx_date)} 09:00:00', {OBS_FROM_EHR}, NULL, NULL,
                 0, NULL, NULL, NULL, NULL, {FAMILY_HISTORY_MALIGNANT},
                 'Family history of malignant neoplasm', 'SNOMED', NULL)
            """)
            obs_id += 1

    # Bulk insert
    insert_sql = f"""
        INSERT INTO {SCHEMA}.observation
            (observation_id, person_id, observation_concept_id, observation_date,
             observation_datetime, observation_type_concept_id, value_as_number, value_as_string,
             value_as_concept_id, qualifier_concept_id, unit_concept_id,
             provider_id, visit_occurrence_id, observation_source_concept_id,
             observation_source_value, unit_source_value, qualifier_source_value)
        VALUES {','.join(sql_parts)}
    """
    cur.execute(insert_sql)
    log(f"Inserted {obs_id - 1} observations ({len(persons)} smoking + {len(persons)} ECOG + family history)")


def _weighted_choice(rng: random.Random, weights: list[tuple[int, float]]) -> int:
    concepts, probs = zip(*weights)
    return rng.choices(list(concepts), weights=list(probs), k=1)[0]


# ── Step 4: Create lab visits and link measurements ────────────────────────

def create_lab_visits_and_link(cur, persons: list[PersonInfo]) -> None:
    """Create lab visit records for unlinked measurements, then link them."""
    print("\n[4/8] Creating lab visits and linking unlinked measurements...")

    # Check how many unlinked measurements exist
    cur.execute(f"""
        SELECT count(*) FROM {SCHEMA}.measurement WHERE visit_occurrence_id IS NULL
    """)
    unlinked_count = cur.fetchone()[0]
    if unlinked_count == 0:
        log("All measurements already linked to visits, skipping")
        return

    log(f"{unlinked_count} unlinked measurements to process")

    # Get max visit_occurrence_id
    cur.execute(f"SELECT max(visit_occurrence_id) FROM {SCHEMA}.visit_occurrence")
    next_visit_id = cur.fetchone()[0] + 1

    # Group unlinked measurements by person_id + measurement_date
    cur.execute(f"""
        SELECT person_id, measurement_date, count(*) as cnt
        FROM {SCHEMA}.measurement
        WHERE visit_occurrence_id IS NULL
        GROUP BY person_id, measurement_date
        ORDER BY person_id, measurement_date
    """)
    lab_groups = cur.fetchall()
    log(f"{len(lab_groups)} distinct person+date lab groups")

    # Build person lookup for care_site
    person_map = {p.person_id: p for p in persons}

    # Create one lab/office visit per person+date group
    visit_inserts: list[str] = []
    visit_lookup: dict[tuple[int, str], int] = {}  # (person_id, date_str) → visit_id

    for pid, mdate, cnt in lab_groups:
        vid = next_visit_id
        next_visit_id += 1
        visit_lookup[(pid, str(mdate))] = vid

        # Lab visits are outpatient (office visit concept)
        visit_inserts.append(f"""
            ({vid}, {pid}, {OFFICE_VISIT}, '{mdate}', '{mdate} 08:00:00',
             '{mdate}', '{mdate} 08:30:00', {EHR_TYPE},
             NULL, 3, 'Lab draw {mdate}', 0, 0, NULL, NULL, NULL)
        """)

    # Batch insert visits (500 at a time to avoid query size limits)
    batch_size = 500
    total_visits = len(visit_inserts)
    for i in range(0, total_visits, batch_size):
        batch = visit_inserts[i:i + batch_size]
        cur.execute(f"""
            INSERT INTO {SCHEMA}.visit_occurrence
                (visit_occurrence_id, person_id, visit_concept_id,
                 visit_start_date, visit_start_datetime,
                 visit_end_date, visit_end_datetime, visit_type_concept_id,
                 provider_id, care_site_id, visit_source_value,
                 visit_source_concept_id, admitted_from_concept_id,
                 admitted_from_source_value, discharged_to_concept_id, discharged_to_source_value)
            VALUES {','.join(batch)}
        """)
    log(f"Created {total_visits} lab visits")

    # Now link measurements to their lab visits
    # Build a temp table for efficient bulk update
    cur.execute(f"""
        CREATE TEMP TABLE _lab_visit_map (
            person_id INTEGER,
            measurement_date DATE,
            visit_occurrence_id INTEGER
        )
    """)

    map_inserts: list[str] = []
    for (pid, mdate_str), vid in visit_lookup.items():
        map_inserts.append(f"({pid}, '{mdate_str}', {vid})")

    for i in range(0, len(map_inserts), batch_size):
        batch = map_inserts[i:i + batch_size]
        cur.execute(f"""
            INSERT INTO _lab_visit_map (person_id, measurement_date, visit_occurrence_id)
            VALUES {','.join(batch)}
        """)

    cur.execute(f"""
        UPDATE {SCHEMA}.measurement m
        SET visit_occurrence_id = lvm.visit_occurrence_id
        FROM _lab_visit_map lvm
        WHERE m.person_id = lvm.person_id
          AND m.measurement_date = lvm.measurement_date
          AND m.visit_occurrence_id IS NULL
    """)
    log(f"Linked {cur.rowcount} measurements to lab visits")

    cur.execute("DROP TABLE IF EXISTS _lab_visit_map")


# ── Step 5: Fix INR unit_concept_id ────────────────────────────────────────

def fix_inr_units(cur) -> None:
    """Set unit_concept_id = 8523 (ratio) for INR measurements."""
    print("\n[5/8] Fixing INR unit_concept_id...")

    # INR concept: 3022217 (INR in Platelet poor plasma by Coagulation assay)
    cur.execute(f"""
        UPDATE {SCHEMA}.measurement
        SET unit_concept_id = {UNIT_RATIO},
            unit_source_value = 'ratio'
        WHERE measurement_concept_id IN (
            SELECT concept_id FROM vocab.concept
            WHERE concept_name ILIKE '%INR%' AND domain_id = 'Measurement'
        )
        AND (unit_concept_id IS NULL OR unit_concept_id = 0)
    """)
    log(f"Updated {cur.rowcount} INR measurements to unit ratio (8523)")


# ── Step 6: Populate payer_plan_period ─────────────────────────────────────

def populate_payer_plan_periods(cur, persons: list[PersonInfo], rng: random.Random) -> None:
    """Add insurance records covering each patient's observation period."""
    print("\n[6/8] Populating payer_plan_period...")

    cur.execute(f"SELECT count(*) FROM {SCHEMA}.payer_plan_period")
    if cur.fetchone()[0] > 0:
        log("Payer plan periods already populated, skipping")
        return

    ppp_id = 1
    sql_parts: list[str] = []

    for p in persons:
        age_at_obs = p.obs_start.year - p.year_of_birth

        # Age-based payer assignment (realistic for cancer population)
        if age_at_obs >= 65:
            if rng.random() < 0.15:
                payer = PAYER_DUAL       # Dual eligible
                plan_src = "Medicare/Medicaid Dual"
            else:
                payer = PAYER_MEDICARE_PPO  # Medicare
                plan_src = "Medicare Advantage PPO"
        elif age_at_obs < 30:
            # Young adults → commercial or Medicaid
            if rng.random() < 0.40:
                payer = PAYER_MEDICAID
                plan_src = "Medicaid"
            else:
                payer = PAYER_COMMERCIAL_HMO
                plan_src = "Commercial HMO"
        else:
            # Working age → mostly commercial, some Medicaid
            roll = rng.random()
            if roll < 0.65:
                payer = PAYER_COMMERCIAL_HMO
                plan_src = "Commercial HMO"
            elif roll < 0.80:
                payer = PAYER_MEDICARE_PPO
                plan_src = "Employer PPO"
            else:
                payer = PAYER_MEDICAID
                plan_src = "Medicaid"

        sql_parts.append(f"""
            ({ppp_id}, {p.person_id}, '{date_str(p.obs_start)}', '{date_str(p.obs_end)}',
             {payer}, 0, NULL, NULL, '{sql_str(plan_src)}', NULL,
             NULL, NULL, NULL, NULL, NULL)
        """)
        ppp_id += 1

    cur.execute(f"""
        INSERT INTO {SCHEMA}.payer_plan_period
            (payer_plan_period_id, person_id, payer_plan_period_start_date,
             payer_plan_period_end_date, payer_concept_id, payer_source_concept_id,
             plan_concept_id, plan_source_concept_id, plan_source_value,
             sponsor_concept_id, sponsor_source_concept_id, sponsor_source_value,
             family_source_value, stop_reason_concept_id, stop_reason_source_value)
        VALUES {','.join(sql_parts)}
    """)
    log(f"Inserted {ppp_id - 1} payer plan period records")


# ── Step 7: Populate device_exposure ───────────────────────────────────────

def populate_device_exposures(cur, persons: list[PersonInfo], rng: random.Random) -> None:
    """Add ports, biliary stents, and CVCs for appropriate patients."""
    print("\n[7/8] Populating device_exposure...")

    cur.execute(f"SELECT count(*) FROM {SCHEMA}.device_exposure")
    if cur.fetchone()[0] > 0:
        log("Device exposures already populated, skipping")
        return

    # Load existing visits for linkage
    cur.execute(f"""
        SELECT visit_occurrence_id, person_id, visit_start_date, visit_concept_id
        FROM {SCHEMA}.visit_occurrence
        ORDER BY person_id, visit_start_date
    """)
    visits_by_person: dict[int, list[tuple[int, date, int]]] = {}
    for vid, pid, vdate, vconcept in cur.fetchall():
        visits_by_person.setdefault(pid, []).append((vid, vdate, vconcept))

    dev_id = 1
    sql_parts: list[str] = []

    for p in persons:
        p_visits = visits_by_person.get(p.person_id, [])
        if not p_visits:
            continue

        dx_date = p.obs_start + timedelta(days=rng.randint(0, 30))

        # Port-a-cath: ~80% of chemo patients get one
        if rng.random() < 0.80:
            port_date = dx_date + timedelta(days=rng.randint(7, 21))
            if port_date <= p.obs_end:
                closest_visit = _find_closest_visit(p_visits, port_date)
                sql_parts.append(f"""
                    ({dev_id}, {p.person_id}, {DEVICE_PORT_CATHETER},
                     '{date_str(port_date)}', '{date_str(port_date)} 10:00:00',
                     '{date_str(p.obs_end)}', '{date_str(p.obs_end)} 10:00:00',
                     {EHR_TYPE}, NULL, NULL, {closest_visit},
                     NULL, {DEVICE_PORT_CATHETER}, 'Implantable venous access port', NULL, NULL)
                """)
                dev_id += 1

        # Biliary stent: ~45% of patients with jaundice
        # Check if patient has jaundice (condition_concept_id = 137977)
        cur.execute(f"""
            SELECT 1 FROM {SCHEMA}.condition_occurrence
            WHERE person_id = {p.person_id} AND condition_concept_id = 137977
            LIMIT 1
        """)
        has_jaundice = cur.fetchone() is not None

        if has_jaundice and rng.random() < 0.45:
            stent_date = dx_date + timedelta(days=rng.randint(3, 14))
            if stent_date <= p.obs_end:
                closest_visit = _find_closest_visit(p_visits, stent_date)
                removal_date = stent_date + timedelta(days=rng.randint(60, 180))
                if removal_date > p.obs_end:
                    removal_date = p.obs_end
                sql_parts.append(f"""
                    ({dev_id}, {p.person_id}, {DEVICE_BILIARY_STENT},
                     '{date_str(stent_date)}', '{date_str(stent_date)} 11:00:00',
                     '{date_str(removal_date)}', '{date_str(removal_date)} 11:00:00',
                     {EHR_TYPE}, NULL, NULL, {closest_visit},
                     NULL, {DEVICE_BILIARY_STENT}, 'Biliary stent placement', NULL, NULL)
                """)
                dev_id += 1

        # CVC: ~30% of metastatic patients (for aggressive chemo/TPN)
        if p.subgroup == "metastatic" and rng.random() < 0.30:
            cvc_date = dx_date + timedelta(days=rng.randint(30, 90))
            if cvc_date <= p.obs_end:
                closest_visit = _find_closest_visit(p_visits, cvc_date)
                removal_date = cvc_date + timedelta(days=rng.randint(14, 60))
                if removal_date > p.obs_end:
                    removal_date = p.obs_end
                sql_parts.append(f"""
                    ({dev_id}, {p.person_id}, {DEVICE_CVC},
                     '{date_str(cvc_date)}', '{date_str(cvc_date)} 09:00:00',
                     '{date_str(removal_date)}', '{date_str(removal_date)} 09:00:00',
                     {EHR_TYPE}, NULL, NULL, {closest_visit},
                     NULL, {DEVICE_CVC}, 'Central venous catheter', NULL, NULL)
                """)
                dev_id += 1

    if sql_parts:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.device_exposure
                (device_exposure_id, person_id, device_concept_id,
                 device_exposure_start_date, device_exposure_start_datetime,
                 device_exposure_end_date, device_exposure_end_datetime,
                 device_type_concept_id, unique_device_id, production_id,
                 visit_occurrence_id, provider_id, device_source_concept_id,
                 device_source_value, quantity, unit_concept_id)
            VALUES {','.join(sql_parts)}
        """)
    log(f"Inserted {dev_id - 1} device exposures")


def _find_closest_visit(visits: list[tuple[int, date, int]], target: date) -> int:
    """Return visit_occurrence_id of closest visit to target date."""
    best_vid = visits[0][0]
    best_diff = abs((target - visits[0][1]).days)
    for vid, vdate, _ in visits[1:]:
        diff = abs((target - vdate).days)
        if diff < best_diff:
            best_vid = vid
            best_diff = diff
    return best_vid


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("Pancreas CDM DQD Gap Enrichment")
    print("=" * 60)

    rng = random.Random(42)

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False

    try:
        cur = conn.cursor()

        # Load person data with clinical characteristics
        print("\nLoading patient data...")
        persons = load_persons(cur)
        log(f"Loaded {len(persons)} patients")

        subgroup_counts = {}
        for p in persons:
            subgroup_counts[p.subgroup] = subgroup_counts.get(p.subgroup, 0) + 1
        log(f"Subgroups: {subgroup_counts}")

        # Execute enrichment steps
        fix_source_concept_ids(cur)
        populate_locations_providers(cur, persons, rng)
        populate_observations(cur, persons, rng)
        create_lab_visits_and_link(cur, persons)
        fix_inr_units(cur)
        populate_payer_plan_periods(cur, persons, rng)
        populate_device_exposures(cur, persons, rng)

        conn.commit()
        print("\n" + "=" * 60)
        print("All enrichment steps completed successfully!")
        print("=" * 60)

        # Summary
        print("\nPost-enrichment summary:")
        for table in [
            "observation", "location", "provider", "payer_plan_period",
            "device_exposure", "visit_occurrence", "measurement",
        ]:
            cur.execute(f"SELECT count(*) FROM {SCHEMA}.{table}")
            log(f"{table}: {cur.fetchone()[0]} rows")

        # Verify source concept IDs fixed
        cur.execute(f"""
            SELECT count(*) FROM {SCHEMA}.condition_occurrence
            WHERE condition_source_concept_id = 0 OR condition_source_concept_id IS NULL
        """)
        remaining = cur.fetchone()[0]
        log(f"Remaining zero source_concept_ids in conditions: {remaining}")

        # Verify measurement linkage
        cur.execute(f"""
            SELECT count(*) FROM {SCHEMA}.measurement WHERE visit_occurrence_id IS NULL
        """)
        unlinked = cur.fetchone()[0]
        log(f"Remaining unlinked measurements: {unlinked}")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
