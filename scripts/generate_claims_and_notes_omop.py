#!/usr/bin/env python3
"""
generate_claims_and_notes_omop.py

Adapted from generate_claims_and_notes_pg.py to read from OMOP CDM tables
(omop schema) instead of Synthea native tables.

Generates claims, claims_transactions, and clinical notes by reading existing
OMOP CDM data from PostgreSQL and writing results back.

Reads from:
    omop.visit_occurrence   (encounters)
    omop.person             (patients)
    omop.condition_occurrence (conditions)
    omop.procedure_occurrence (procedures)
    omop.drug_exposure      (medications)
    omop.payer_plan_period   (payer info)
    omop.provider           (providers)
    omop.care_site          (organizations)
    omop.concept            (vocabulary lookups)
    omop.observation        (allergies — concept_id domain)

Writes claims + claims_transactions tables into the target schema, and
clinical notes as .txt files to a local directory.

Requirements:
    pip install psycopg2-binary python-dotenv tqdm

Configuration (via .env file or environment variables):
    PG_HOST=localhost
    PG_PORT=5432
    PG_DATABASE=ohdsi
    PG_USER=smudoshi
    PG_PASSWORD=
    PG_CDM_SCHEMA=omop
    PG_TARGET_SCHEMA=omop
    NOTES_OUTPUT_DIR=./output/notes

Usage:
    # Full run (claims + notes):
    python generate_claims_and_notes_omop.py

    # Claims only:
    python generate_claims_and_notes_omop.py --skip-notes

    # Notes only:
    python generate_claims_and_notes_omop.py --skip-claims

    # Dry run (create tables but don't insert — just count):
    python generate_claims_and_notes_omop.py --dry-run

    # Drop and recreate claims tables first:
    python generate_claims_and_notes_omop.py --recreate-tables

    # Limit to N patients (useful for testing):
    python generate_claims_and_notes_omop.py --limit 1000
"""

import argparse
import hashlib
import os
import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, **kwargs):
        desc = kwargs.get("desc", "")
        total = kwargs.get("total", None)
        for i, item in enumerate(iterable):
            if total and i % max(1, total // 100) == 0:
                print(f"\r{desc}: {(i/total)*100:.0f}%", end="", flush=True)
            yield item
        print()


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BATCH_SIZE = 5000
NOTES_BATCH_SIZE = 500

# OMOP Visit Concept IDs → encounter class mapping
VISIT_CONCEPT_MAP = {
    9201: "inpatient",
    9202: "outpatient",      # ambulatory
    9203: "emergency",
    262:  "emergency",       # ER+inpatient
    9204: "outpatient",      # nonacute institutional
    581477: "outpatient",    # telehealth
    0:    "ambulatory",      # unmapped
}

# Payer adjudication parameters
PAYER_CONFIG = {
    "covered_rate": 0.82,
    "coinsurance_rate": 0.20,
    "copay_ambulatory": 25.0,
    "copay_emergency": 150.0,
    "copay_inpatient": 500.0,
    "denial_rate": 0.05,
    "adjustment_rate": 0.12,
    "secondary_pickup_rate": 0.60,
}

# Cost ranges by encounter class (USD)
ENCOUNTER_BASE_COSTS = {
    "ambulatory":  (80, 350),
    "outpatient":  (150, 800),
    "inpatient":   (3000, 45000),
    "emergency":   (500, 8000),
    "urgentcare":  (150, 600),
    "wellness":    (100, 300),
    "snf":         (500, 2500),
    "hospice":     (300, 1500),
    "home":        (100, 500),
    "virtual":     (50, 200),
}

PROCEDURE_COST_RANGE = (200, 5000)
MEDICATION_COST_RANGE = (10, 2000)
IMMUNIZATION_COST_RANGE = (25, 300)

# Clinical note ROS/Exam templates
ROS_OPTIONS = {
    "Constitutional": [
        "No fever, chills, or unintentional weight loss",
        "Reports fatigue and mild weight gain",
        "Denies fever, night sweats, or weight changes",
    ],
    "Cardiovascular": [
        "No chest pain, palpitations, or edema",
        "Occasional palpitations, no chest pain",
        "Reports intermittent chest tightness with exertion",
    ],
    "Respiratory": [
        "No cough, shortness of breath, or wheezing",
        "Mild chronic cough, no hemoptysis",
        "Reports occasional dyspnea on exertion",
    ],
    "Gastrointestinal": [
        "No nausea, vomiting, diarrhea, or constipation",
        "Occasional heartburn, no dysphagia",
        "Reports intermittent abdominal bloating",
    ],
    "Musculoskeletal": [
        "No joint pain, swelling, or stiffness",
        "Chronic lower back pain, managed with exercise",
        "Reports bilateral knee pain with ambulation",
    ],
    "Neurological": [
        "No headaches, dizziness, or numbness",
        "Occasional tension headaches, no focal deficits",
        "Denies syncope, seizures, or focal weakness",
    ],
}

EXAM_OPTIONS = {
    "appearance": [
        "well-nourished, well-developed, in no acute distress",
        "comfortable, alert, and oriented x3",
        "mildly uncomfortable but cooperative",
    ],
    "heent": [
        "Normocephalic, atraumatic. PERRL. Oropharynx clear",
        "PERRL, EOMI. TMs clear bilaterally. Oropharynx without erythema",
    ],
    "lungs": [
        "Clear to auscultation bilaterally, no wheezes or rales",
        "Bilateral breath sounds present and equal, no adventitious sounds",
    ],
    "heart": [
        "Regular rate and rhythm, no murmurs, gallops, or rubs",
        "S1 and S2 normal, no murmur appreciated",
    ],
    "abdomen": [
        "Soft, non-tender, non-distended, normoactive bowel sounds",
        "Soft, mildly tender in epigastric region, no rebound or guarding",
    ],
    "extremities": [
        "No cyanosis, clubbing, or edema. Pulses 2+ bilaterally",
        "Trace bilateral lower extremity edema, pulses intact",
    ],
}

# Synthetic name generation (OMOP CDM strips PHI — we generate deterministic names)
FIRST_NAMES_M = [
    "James", "Robert", "John", "Michael", "David", "William", "Richard",
    "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew",
    "Anthony", "Mark", "Donald", "Steven", "Andrew", "Paul", "Joshua",
    "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Jason",
    "Edward", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric",
    "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon",
]
FIRST_NAMES_F = [
    "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth",
    "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty",
    "Margaret", "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily",
    "Donna", "Michelle", "Carol", "Amanda", "Melissa", "Deborah",
    "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia", "Kathleen",
    "Amy", "Angela", "Shirley", "Anna", "Brenda", "Pamela", "Emma",
    "Nicole", "Helen",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def deterministic_uuid(namespace: str, *parts) -> str:
    seed_str = "|".join(str(p) for p in parts)
    h = hashlib.sha256(f"{namespace}:{seed_str}".encode()).hexdigest()
    return str(uuid.UUID(h[:32]))


def get_connection(args):
    # Support Unix socket (peer auth) when host is empty or "local"
    kwargs = {
        "dbname": args.pg_database,
        "user": args.pg_user,
    }
    if args.pg_host and args.pg_host not in ("local", ""):
        kwargs["host"] = args.pg_host
        kwargs["port"] = args.pg_port
    if args.pg_password:
        kwargs["password"] = args.pg_password
    return psycopg2.connect(**kwargs)


def get_encounter_class(visit_concept_id: int) -> str:
    return VISIT_CONCEPT_MAP.get(visit_concept_id, "ambulatory")


def get_encounter_cost(enc_class: str, rng: random.Random) -> float:
    lo, hi = ENCOUNTER_BASE_COSTS.get(enc_class, ENCOUNTER_BASE_COSTS["ambulatory"])
    return round(rng.uniform(lo, hi), 2)


def get_claim_type(enc_class: str) -> int:
    institutional = {"inpatient", "emergency", "snf", "hospice"}
    return 2 if enc_class in institutional else 1


def fmt_money(val: float) -> float:
    return round(val, 2)


def generate_name(person_id: int, gender_concept_id: int, rng_for_name: random.Random):
    """Generate a deterministic synthetic name from person_id."""
    name_rng = random.Random(person_id)
    if gender_concept_id == 8532:  # Female
        first = name_rng.choice(FIRST_NAMES_F)
    else:
        first = name_rng.choice(FIRST_NAMES_M)
    last = name_rng.choice(LAST_NAMES)
    return first, last


def table_exists(conn, schema: str, table: str) -> bool:
    cur = conn.cursor()
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = %s AND table_name = %s
        )
    """, (schema, table))
    result = cur.fetchone()[0]
    cur.close()
    return result


# ---------------------------------------------------------------------------
# DDL — Create claims tables
# ---------------------------------------------------------------------------

CLAIMS_DDL = """
CREATE TABLE IF NOT EXISTS {schema}.claims (
    id                          VARCHAR(64) PRIMARY KEY,
    patientid                   VARCHAR(64) NOT NULL,
    providerid                  VARCHAR(64),
    primarypatientinsuranceid   VARCHAR(64),
    secondarypatientinsuranceid VARCHAR(64),
    departmentid                INTEGER DEFAULT 1,
    patientdepartmentid         INTEGER DEFAULT 1,
    diagnosis1                  VARCHAR(64),
    diagnosis2                  VARCHAR(64),
    diagnosis3                  VARCHAR(64),
    diagnosis4                  VARCHAR(64),
    diagnosis5                  VARCHAR(64),
    diagnosis6                  VARCHAR(64),
    diagnosis7                  VARCHAR(64),
    diagnosis8                  VARCHAR(64),
    referringproviderid         VARCHAR(64),
    appointmentid               VARCHAR(64),
    currentillnessdate          TIMESTAMP,
    servicedate                 TIMESTAMP,
    supervisingproviderid       VARCHAR(64),
    status1                     VARCHAR(10),
    status2                     VARCHAR(10),
    statusp                     VARCHAR(10),
    outstanding1                NUMERIC(18,2) DEFAULT 0,
    outstanding2                NUMERIC(18,2) DEFAULT 0,
    outstandingp                NUMERIC(18,2) DEFAULT 0,
    lastbilleddate1             TIMESTAMP,
    lastbilleddate2             TIMESTAMP,
    lastbilleddatep             TIMESTAMP,
    healthcareclaimtypeid1      INTEGER,
    healthcareclaimtypeid2      INTEGER
);
"""

CLAIMS_TRANSACTIONS_DDL = """
CREATE TABLE IF NOT EXISTS {schema}.claims_transactions (
    id                      VARCHAR(64) PRIMARY KEY,
    claimid                 VARCHAR(64) NOT NULL REFERENCES {schema}.claims(id),
    chargeid                INTEGER,
    patientid               VARCHAR(64) NOT NULL,
    type                    VARCHAR(20) NOT NULL,
    amount                  NUMERIC(18,2),
    method                  VARCHAR(20),
    fromdate                TIMESTAMP,
    todate                  TIMESTAMP,
    placeofservice          VARCHAR(64),
    procedurecode           VARCHAR(64),
    modifier1               VARCHAR(20),
    modifier2               VARCHAR(20),
    diagnosisref1           INTEGER,
    diagnosisref2           INTEGER,
    diagnosisref3           INTEGER,
    diagnosisref4           INTEGER,
    units                   INTEGER DEFAULT 1,
    departmentid            INTEGER DEFAULT 1,
    notes                   TEXT,
    unitamount              NUMERIC(18,2),
    transferoutid           INTEGER,
    transfertype            VARCHAR(5),
    payments                NUMERIC(18,2),
    adjustments             NUMERIC(18,2),
    transfers               NUMERIC(18,2),
    outstanding             NUMERIC(18,2),
    appointmentid           VARCHAR(64),
    linenote                TEXT,
    patientinsuranceid      VARCHAR(64),
    feescheduleid           INTEGER DEFAULT 1,
    providerid              VARCHAR(64),
    supervisingproviderid   VARCHAR(64)
);
"""

CLAIMS_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_claims_patientid ON {schema}.claims(patientid);",
    "CREATE INDEX IF NOT EXISTS idx_claims_appointmentid ON {schema}.claims(appointmentid);",
    "CREATE INDEX IF NOT EXISTS idx_claims_txn_claimid ON {schema}.claims_transactions(claimid);",
    "CREATE INDEX IF NOT EXISTS idx_claims_txn_patientid ON {schema}.claims_transactions(patientid);",
    "CREATE INDEX IF NOT EXISTS idx_claims_txn_appointmentid ON {schema}.claims_transactions(appointmentid);",
]


def create_claims_tables(conn, schema: str, recreate: bool = False):
    cur = conn.cursor()
    if recreate:
        print("  Dropping existing claims tables...")
        cur.execute(f"DROP TABLE IF EXISTS {schema}.claims_transactions CASCADE;")
        cur.execute(f"DROP TABLE IF EXISTS {schema}.claims CASCADE;")

    print("  Creating claims table...")
    cur.execute(CLAIMS_DDL.format(schema=schema))
    print("  Creating claims_transactions table...")
    cur.execute(CLAIMS_TRANSACTIONS_DDL.format(schema=schema))
    for idx_sql in CLAIMS_INDEXES:
        cur.execute(idx_sql.format(schema=schema))
    conn.commit()
    cur.close()
    print("  Tables and indexes created.")


# ---------------------------------------------------------------------------
# Concept Cache — preload concept names for display
# ---------------------------------------------------------------------------

def load_concept_names(conn, cdm_schema: str, concept_ids: set) -> dict:
    """Batch-load concept names from the vocabulary."""
    if not concept_ids:
        return {}
    cur = conn.cursor()
    # Process in chunks to avoid query parameter limits
    names = {}
    id_list = list(concept_ids)
    for i in range(0, len(id_list), 10000):
        chunk = id_list[i:i + 10000]
        cur.execute(f"""
            SELECT concept_id, concept_name
            FROM {cdm_schema}.concept
            WHERE concept_id = ANY(%s)
        """, (chunk,))
        for row in cur:
            names[row[0]] = row[1]
    cur.close()
    return names


# ---------------------------------------------------------------------------
# Claims Generation — reads from OMOP CDM, writes to target schema
# ---------------------------------------------------------------------------

def generate_claims(conn, cdm_schema: str, target_schema: str,
                    rng: random.Random, dry_run: bool = False,
                    limit: Optional[int] = None):
    """
    Read visit_occurrence + related tables from OMOP CDM,
    generate claims and claims_transactions.
    """

    # Count visits
    cur = conn.cursor()
    limit_clause = f"LIMIT {limit}" if limit else ""
    cur.execute(f"SELECT COUNT(*) FROM {cdm_schema}.visit_occurrence")
    total_visits = cur.fetchone()[0]
    process_count = min(total_visits, limit) if limit else total_visits
    cur.close()

    print(f"  Total visits in CDM: {total_visits:,}")
    print(f"  Processing: {process_count:,}")

    if dry_run:
        print("  DRY RUN — skipping actual insert.")
        return process_count, 0

    import time
    preload_start = time.time()

    # ---- Preload condition_source_value by visit ----
    print("  Loading conditions by visit...")
    cond_map = {}  # visit_occurrence_id → [source_value, ...]
    cond_cur = conn.cursor(name="cond_stream")
    cond_cur.itersize = 50000
    cond_cur.execute(f"""
        SELECT visit_occurrence_id, condition_source_value
        FROM {cdm_schema}.condition_occurrence
        WHERE visit_occurrence_id IS NOT NULL
    """)
    for row in cond_cur:
        cond_map.setdefault(row[0], []).append(row[1])
    cond_cur.close()
    print(f"    {len(cond_map):,} visits with conditions. ({time.time()-preload_start:.0f}s)")

    # ---- Preload procedure_source_value by visit ----
    print("  Loading procedures by visit...")
    proc_map = {}
    proc_cur = conn.cursor(name="proc_stream")
    proc_cur.itersize = 50000
    proc_cur.execute(f"""
        SELECT visit_occurrence_id, procedure_source_value
        FROM {cdm_schema}.procedure_occurrence
        WHERE visit_occurrence_id IS NOT NULL
    """)
    for row in proc_cur:
        proc_map.setdefault(row[0], []).append(row[1])
    proc_cur.close()
    print(f"    {len(proc_map):,} visits with procedures. ({time.time()-preload_start:.0f}s)")

    # ---- Preload drug_source_value by visit ----
    print("  Loading drugs by visit...")
    drug_map = {}
    drug_cur = conn.cursor(name="drug_stream")
    drug_cur.itersize = 50000
    drug_cur.execute(f"""
        SELECT visit_occurrence_id, drug_source_value
        FROM {cdm_schema}.drug_exposure
        WHERE visit_occurrence_id IS NOT NULL
    """)
    for row in drug_cur:
        drug_map.setdefault(row[0], []).append(row[1])
    drug_cur.close()
    print(f"    {len(drug_map):,} visits with drugs. ({time.time()-preload_start:.0f}s)")

    # ---- Preload payer info by person ----
    print("  Loading payer plan periods...")
    payer_map = {}  # person_id → payer_source_value
    payer_cur = conn.cursor(name="payer_stream")
    payer_cur.itersize = 50000
    payer_cur.execute(f"""
        SELECT DISTINCT ON (person_id)
            person_id, payer_source_value
        FROM {cdm_schema}.payer_plan_period
        ORDER BY person_id, payer_plan_period_start_date DESC
    """)
    for row in payer_cur:
        payer_map[row[0]] = row[1] or ""
    payer_cur.close()
    print(f"    {len(payer_map):,} patients with payer info. ({time.time()-preload_start:.0f}s)")
    print(f"  Preload complete in {time.time()-preload_start:.0f}s.")

    # ---- Stream visit_occurrence ----
    # Use a separate connection for the named cursor so commits on the
    # write connection don't invalidate it.
    print(f"\n  Generating claims...")

    claim_count = 0
    txn_count = 0
    claims_batch = []
    txns_batch = []

    read_conn = psycopg2.connect(
        dbname=conn.info.dbname,
        user=conn.info.user,
        host=conn.info.host or None,
        port=conn.info.port or None,
        password=conn.info.password or None,
    )

    visit_cursor = read_conn.cursor(name="visit_stream")
    visit_cursor.itersize = 10000
    visit_cursor.execute(f"""
        SELECT
            v.visit_occurrence_id,
            v.person_id,
            v.visit_concept_id,
            v.visit_start_date,
            v.visit_end_date,
            v.provider_id,
            v.care_site_id,
            v.visit_source_value
        FROM {cdm_schema}.visit_occurrence v
        ORDER BY v.person_id, v.visit_start_date
        {limit_clause}
    """)

    insert_cur = conn.cursor()

    for row in tqdm(visit_cursor, total=process_count, desc="  visits → claims"):
        visit_id, person_id, visit_concept_id, visit_start, visit_end, \
            provider_id, care_site_id, visit_source_value = row

        if visit_start is None:
            continue
        if visit_end is None:
            visit_end = visit_start

        enc_class = get_encounter_class(visit_concept_id or 0)

        # Use visit_source_value (original Synthea UUID) as appointment ID
        enc_id = visit_source_value or str(visit_id)

        # Diagnosis codes (condition_source_value = SNOMED codes)
        dx_codes = cond_map.get(visit_id, [])[:8]
        while len(dx_codes) < 8:
            dx_codes.append(None)

        # Payer
        primary_payer = payer_map.get(person_id, "")

        # Generate claim
        claim_id = deterministic_uuid("claim", visit_id)
        claim_type = get_claim_type(enc_class)
        billed_date = visit_start + timedelta(days=rng.randint(1, 14))

        # Line items — base encounter charge
        base_cost = get_encounter_cost(enc_class, rng)
        line_items = [{"code": str(visit_concept_id), "desc": enc_class, "cost": base_cost, "cid": 1}]
        cid = 2

        for p_code in proc_map.get(visit_id, [])[:10]:
            cost = round(rng.uniform(*PROCEDURE_COST_RANGE), 2)
            line_items.append({"code": p_code or "", "desc": "procedure", "cost": cost, "cid": cid})
            cid += 1

        for d_code in drug_map.get(visit_id, [])[:10]:
            cost = round(rng.uniform(*MEDICATION_COST_RANGE), 2)
            line_items.append({"code": d_code or "", "desc": "medication", "cost": cost, "cid": cid})
            cid += 1

        total_charges = sum(li["cost"] for li in line_items)

        # Adjudication
        denied = rng.random() < PAYER_CONFIG["denial_rate"]
        if denied:
            payer1_paid = 0.0
            adjustment = 0.0
            patient_resp = total_charges
        else:
            adjustment = round(total_charges * PAYER_CONFIG["adjustment_rate"], 2)
            allowed = total_charges - adjustment
            payer1_paid = round(allowed * PAYER_CONFIG["covered_rate"], 2)
            patient_resp = round(allowed - payer1_paid, 2)

        if enc_class == "emergency":
            copay = PAYER_CONFIG["copay_emergency"]
        elif enc_class == "inpatient":
            copay = PAYER_CONFIG["copay_inpatient"]
        else:
            copay = PAYER_CONFIG["copay_ambulatory"]
        patient_resp = max(patient_resp, copay) if not denied else patient_resp

        provider_str = str(provider_id) if provider_id else None
        care_site_str = str(care_site_id) if care_site_id else None

        # Claims row
        claims_batch.append((
            claim_id, str(person_id), provider_str, primary_payer, None,
            1, 1,
            dx_codes[0], dx_codes[1], dx_codes[2], dx_codes[3],
            dx_codes[4], dx_codes[5], dx_codes[6], dx_codes[7],
            None, enc_id,
            datetime.combine(visit_start, datetime.min.time()),
            datetime.combine(visit_start, datetime.min.time()),
            provider_str,
            "CLOSED", "", "CLOSED",
            0.0 if not denied else total_charges, 0.0, 0.0,
            datetime.combine(billed_date, datetime.min.time()),
            None,
            datetime.combine(billed_date, datetime.min.time()),
            claim_type, None,
        ))
        claim_count += 1

        # Transaction rows
        visit_start_ts = datetime.combine(visit_start, datetime.min.time())
        visit_end_ts = datetime.combine(visit_end, datetime.min.time())

        for li in line_items:
            # CHARGE
            txns_batch.append((
                deterministic_uuid("txn", claim_id, li["cid"], "CHARGE"),
                claim_id, li["cid"], str(person_id), "CHARGE",
                fmt_money(li["cost"]), None,
                visit_start_ts, visit_end_ts,
                care_site_str, li["code"],
                None, None,
                1 if dx_codes[0] else None, None, None, None,
                1, 1, li["desc"], fmt_money(li["cost"]),
                None, None, None, None, None, fmt_money(li["cost"]),
                enc_id, None, primary_payer, 1, provider_str, provider_str,
            ))
            txn_count += 1

        if not denied and total_charges > 0:
            for li in line_items:
                proportion = li["cost"] / total_charges
                billed_ts = datetime.combine(billed_date, datetime.min.time())

                # ADJUSTMENT
                li_adj = round(adjustment * proportion, 2)
                if li_adj > 0:
                    txns_batch.append((
                        deterministic_uuid("txn", claim_id, li["cid"], "ADJ"),
                        claim_id, li["cid"], str(person_id), "ADJUSTMENT",
                        None, "SYSTEM",
                        billed_ts, billed_ts,
                        care_site_str, li["code"],
                        None, None,
                        1 if dx_codes[0] else None, None, None, None,
                        1, 1, "Contractual adjustment", None,
                        None, None, None, fmt_money(li_adj), None,
                        fmt_money(li["cost"] - li_adj),
                        enc_id, None, primary_payer, 1, provider_str, provider_str,
                    ))
                    txn_count += 1

                # PAYMENT
                li_pay = round(payer1_paid * proportion, 2)
                if li_pay > 0:
                    pay_date = visit_start + timedelta(days=rng.randint(14, 60))
                    pay_ts = datetime.combine(pay_date, datetime.min.time())
                    txns_batch.append((
                        deterministic_uuid("txn", claim_id, li["cid"], "PAY"),
                        claim_id, li["cid"], str(person_id), "PAYMENT",
                        None, "ECHECK",
                        pay_ts, pay_ts,
                        care_site_str, li["code"],
                        None, None,
                        1 if dx_codes[0] else None, None, None, None,
                        1, 1, "Insurance payment", None,
                        None, None, fmt_money(li_pay), None, None,
                        fmt_money(li["cost"] - li_adj - li_pay),
                        enc_id, None, primary_payer, 1, provider_str, provider_str,
                    ))
                    txn_count += 1

                # TRANSFEROUT → patient
                li_pt = round(patient_resp * proportion, 2)
                if li_pt > 0:
                    xfer_date = visit_start + timedelta(days=rng.randint(30, 90))
                    xfer_ts = datetime.combine(xfer_date, datetime.min.time())
                    txns_batch.append((
                        deterministic_uuid("txn", claim_id, li["cid"], "XOUT"),
                        claim_id, li["cid"], str(person_id), "TRANSFEROUT",
                        None, "SYSTEM",
                        xfer_ts, xfer_ts,
                        care_site_str, li["code"],
                        None, None, None, None, None, None,
                        1, 1, "Transfer to patient", None,
                        None, "p", None, None, fmt_money(li_pt), None,
                        enc_id, None, primary_payer, 1, provider_str, provider_str,
                    ))
                    txn_count += 1

                    txns_batch.append((
                        deterministic_uuid("txn", claim_id, li["cid"], "XIN"),
                        claim_id, li["cid"], str(person_id), "TRANSFERIN",
                        None, "SYSTEM",
                        xfer_ts, xfer_ts,
                        care_site_str, li["code"],
                        None, None, None, None, None, None,
                        1, 1, "Patient responsibility", None,
                        li["cid"], "p", None, None, fmt_money(li_pt), None,
                        enc_id, None, primary_payer, 1, provider_str, provider_str,
                    ))
                    txn_count += 1

        # Flush batches — always flush claims before transactions (FK dependency)
        if len(claims_batch) >= BATCH_SIZE:
            _flush_claims(insert_cur, target_schema, claims_batch)
            claims_batch.clear()
            conn.commit()
        if len(txns_batch) >= BATCH_SIZE * 4:
            if claims_batch:
                _flush_claims(insert_cur, target_schema, claims_batch)
                claims_batch.clear()
            _flush_transactions(insert_cur, target_schema, txns_batch)
            txns_batch.clear()
            conn.commit()

    # Final flush
    if claims_batch:
        _flush_claims(insert_cur, target_schema, claims_batch)
    if txns_batch:
        _flush_transactions(insert_cur, target_schema, txns_batch)
    conn.commit()

    visit_cursor.close()
    read_conn.close()
    insert_cur.close()

    print(f"\n  Claims inserted: {claim_count:,}")
    print(f"  Transactions inserted: {txn_count:,}")
    return claim_count, txn_count


def _flush_claims(cur, schema, batch):
    sql = f"""
        INSERT INTO {schema}.claims (
            id, patientid, providerid, primarypatientinsuranceid,
            secondarypatientinsuranceid, departmentid, patientdepartmentid,
            diagnosis1, diagnosis2, diagnosis3, diagnosis4,
            diagnosis5, diagnosis6, diagnosis7, diagnosis8,
            referringproviderid, appointmentid, currentillnessdate,
            servicedate, supervisingproviderid,
            status1, status2, statusp,
            outstanding1, outstanding2, outstandingp,
            lastbilleddate1, lastbilleddate2, lastbilleddatep,
            healthcareclaimtypeid1, healthcareclaimtypeid2
        ) VALUES %s
        ON CONFLICT (id) DO NOTHING
    """
    psycopg2.extras.execute_values(cur, sql, batch, page_size=BATCH_SIZE)


def _flush_transactions(cur, schema, batch):
    sql = f"""
        INSERT INTO {schema}.claims_transactions (
            id, claimid, chargeid, patientid, type,
            amount, method, fromdate, todate, placeofservice, procedurecode,
            modifier1, modifier2,
            diagnosisref1, diagnosisref2, diagnosisref3, diagnosisref4,
            units, departmentid, notes, unitamount,
            transferoutid, transfertype, payments, adjustments, transfers,
            outstanding, appointmentid, linenote,
            patientinsuranceid, feescheduleid, providerid, supervisingproviderid
        ) VALUES %s
        ON CONFLICT (id) DO NOTHING
    """
    psycopg2.extras.execute_values(cur, sql, batch, page_size=BATCH_SIZE)


# ---------------------------------------------------------------------------
# Clinical Notes Generation — reads from OMOP CDM, writes to disk
# ---------------------------------------------------------------------------

def generate_vitals(rng: random.Random) -> str:
    sys_bp = rng.randint(100, 160)
    dia_bp = rng.randint(60, 100)
    hr = rng.randint(55, 105)
    rr = rng.randint(12, 22)
    temp = round(rng.uniform(97.0, 99.5), 1)
    spo2 = rng.randint(93, 100)
    bmi = round(rng.uniform(18.5, 42.0), 1)
    return f"BP {sys_bp}/{dia_bp}, HR {hr}, RR {rr}, Temp {temp}F, SpO2 {spo2}%, BMI {bmi}"


def generate_notes(conn, cdm_schema: str, target_schema: str,
                   notes_dir: str, rng: random.Random,
                   limit: Optional[int] = None,
                   notes_to_files: bool = False):
    """Generate clinical notes and insert into omop.note table.

    If notes_to_files=True, also writes .txt files to notes_dir.
    """

    if notes_to_files:
        os.makedirs(notes_dir, exist_ok=True)

    # Get distinct person IDs that have visits
    cur = conn.cursor()
    limit_clause = f"LIMIT {limit}" if limit else ""
    cur.execute(f"""
        SELECT DISTINCT person_id
        FROM {cdm_schema}.visit_occurrence
        ORDER BY person_id
        {limit_clause}
    """)
    patient_ids = [row[0] for row in cur.fetchall()]
    cur.close()

    total_patients = len(patient_ids)
    total_notes = 0
    print(f"  Generating notes for {total_patients:,} patients...")

    # Preload concept names for conditions and drugs
    print("  Preloading concept names...")
    concept_ids = set()

    # Collect condition concept IDs
    cur = conn.cursor()
    cur.execute(f"SELECT DISTINCT condition_concept_id FROM {cdm_schema}.condition_occurrence WHERE condition_concept_id != 0")
    for row in cur:
        concept_ids.add(row[0])

    # Collect drug concept IDs
    cur.execute(f"SELECT DISTINCT drug_concept_id FROM {cdm_schema}.drug_exposure WHERE drug_concept_id != 0")
    for row in cur:
        concept_ids.add(row[0])

    # Visit concept IDs
    for cid in VISIT_CONCEPT_MAP:
        concept_ids.add(cid)
    cur.close()

    concept_names = load_concept_names(conn, cdm_schema, concept_ids)
    print(f"    Loaded {len(concept_names):,} concept names.")

    # Precompute allergy concept IDs once (avoids per-batch correlated subquery)
    print("  Preloading allergy concept IDs...")
    cur = conn.cursor()
    cur.execute(f"""
        SELECT concept_id FROM {cdm_schema}.concept
        WHERE concept_name ILIKE '%%allergy%%'
          AND domain_id = 'Observation'
    """)
    allergy_concept_ids = [row[0] for row in cur]
    cur.close()
    print(f"    Found {len(allergy_concept_ids):,} allergy concepts.")

    _ensure_note_indexes(conn, target_schema)

    # Get max existing note_id for auto-increment
    cur = conn.cursor()
    cur.execute(f"SELECT COALESCE(MAX(note_id), 0) FROM {target_schema}.note")
    next_note_id = cur.fetchone()[0] + 1
    cur.close()

    # Note type/class concept IDs
    NOTE_TYPE_EHR = 44814637        # EHR note
    NOTE_CLASS_PROGRESS = 44814638  # Progress note (or 0 if unmapped)
    ENCODING_UTF8 = 32678           # UTF-8
    LANGUAGE_ENGLISH = 4180186      # English

    notes_batch = []
    NOTE_BATCH_SIZE = 2000

    # Process in batches
    for batch_start in range(0, total_patients, NOTES_BATCH_SIZE):
        batch_ids = patient_ids[batch_start:batch_start + NOTES_BATCH_SIZE]
        batch_tuple = tuple(batch_ids)

        cur = conn.cursor()

        # Fetch patients (person table)
        cur.execute(f"""
            SELECT person_id, gender_concept_id, year_of_birth, month_of_birth, day_of_birth
            FROM {cdm_schema}.person
            WHERE person_id IN %s
        """, (batch_tuple,))
        patients = {}
        for r in cur:
            first, last = generate_name(r[0], r[1], rng)
            birth_year = r[2] or 1970
            birth_month = r[3] or 1
            birth_day = r[4] or 1
            patients[r[0]] = {
                "first": first,
                "last": last,
                "gender_concept_id": r[1],
                "gender": "female" if r[1] == 8532 else "male",
                "birth": f"{birth_year}-{birth_month:02d}-{birth_day:02d}",
                "birth_year": birth_year,
            }

        # Fetch visits
        cur.execute(f"""
            SELECT visit_occurrence_id, person_id, visit_start_date,
                   visit_concept_id, visit_source_value
            FROM {cdm_schema}.visit_occurrence
            WHERE person_id IN %s
            ORDER BY person_id, visit_start_date
        """, (batch_tuple,))
        visits_by_patient = {}
        for r in cur:
            visits_by_patient.setdefault(r[1], []).append({
                "id": r[0], "start": r[2],
                "concept_id": r[3],
                "class": get_encounter_class(r[3] or 0),
                "desc": concept_names.get(r[3], "Visit"),
            })

        # Fetch conditions by visit
        cur.execute(f"""
            SELECT person_id, visit_occurrence_id, condition_concept_id
            FROM {cdm_schema}.condition_occurrence
            WHERE person_id IN %s
        """, (batch_tuple,))
        conds_by_visit = {}
        conds_by_patient = {}
        for r in cur:
            name = concept_names.get(r[2], f"Condition {r[2]}")
            if r[1]:
                conds_by_visit.setdefault(r[1], []).append(name)
            conds_by_patient.setdefault(r[0], set()).add(name)

        # Fetch drugs by visit
        cur.execute(f"""
            SELECT visit_occurrence_id, drug_concept_id
            FROM {cdm_schema}.drug_exposure
            WHERE person_id IN %s AND visit_occurrence_id IS NOT NULL
        """, (batch_tuple,))
        drugs_by_visit = {}
        for r in cur:
            name = concept_names.get(r[1], f"Drug {r[1]}")
            drugs_by_visit.setdefault(r[0], []).append(name)

        # Fetch allergies using precomputed allergy concept IDs
        if allergy_concept_ids:
            cur.execute(f"""
                SELECT person_id, observation_source_value
                FROM {cdm_schema}.observation
                WHERE person_id IN %s
                  AND (
                      observation_source_value ILIKE '%%allergy%%'
                      OR observation_concept_id = ANY(%s)
                  )
            """, (batch_tuple, allergy_concept_ids))
        else:
            cur.execute(f"""
                SELECT person_id, observation_source_value
                FROM {cdm_schema}.observation
                WHERE person_id IN %s
                  AND observation_source_value ILIKE '%%allergy%%'
            """, (batch_tuple,))
        allergies_by_patient = {}
        for r in cur:
            if r[1]:
                allergies_by_patient.setdefault(r[0], []).append(r[1])

        cur.close()

        # Generate notes for this batch
        for pid in tqdm(batch_ids,
                        desc=f"  notes batch {batch_start // NOTES_BATCH_SIZE + 1}",
                        total=len(batch_ids)):
            pat = patients.get(pid)
            visits = visits_by_patient.get(pid, [])
            if not pat or not visits:
                continue

            gender = pat["gender"]
            allergies = allergies_by_patient.get(pid, [])
            allergy_str = ", ".join(allergies[:5]) if allergies else "NKDA"
            past_conds = list(conds_by_patient.get(pid, set()))[:10]

            note_parts = []
            for visit in visits:
                visit_start = visit["start"]
                if not visit_start:
                    continue

                if hasattr(visit_start, 'year'):
                    age = visit_start.year - pat["birth_year"]
                    date_str = visit_start.strftime("%B %d, %Y")
                else:
                    age = 50
                    date_str = str(visit_start)

                dx = conds_by_visit.get(visit["id"], [])[:5]
                # Deduplicate
                dx = list(dict.fromkeys(dx))[:5]
                meds = drugs_by_visit.get(visit["id"], [])[:8]
                meds = list(dict.fromkeys(meds))[:8]

                lines = []
                lines.append("=" * 72)
                lines.append("CLINICAL NOTE")
                lines.append(f"Date: {date_str}")
                lines.append(f"Patient: {pat['first']} {pat['last']}")
                lines.append(f"DOB: {pat['birth']}  Age: {age}  Sex: {gender.upper()}")
                lines.append(f"Encounter: {visit['class'].upper()} — {visit['desc']}")
                lines.append("=" * 72)
                lines.append("")
                lines.append("HISTORY OF PRESENT ILLNESS:")
                dx_str = f"Active conditions: {', '.join(dx)}." if dx else "No acute complaints."
                lines.append(f"Patient is a {age}-year-old {gender} presenting for {visit['desc'].lower()}. {dx_str}")
                lines.append("")
                lines.append("PAST MEDICAL HISTORY:")
                lines.append(", ".join(past_conds) if past_conds else "No significant past medical history.")
                lines.append("")
                lines.append("MEDICATIONS:")
                lines.append("\n".join(f"  - {m}" for m in meds) if meds else "  None")
                lines.append("")
                lines.append("ALLERGIES:")
                lines.append(allergy_str)
                lines.append("")
                lines.append("REVIEW OF SYSTEMS:")
                for system, options in ROS_OPTIONS.items():
                    lines.append(f"  {system}: {rng.choice(options)}")
                lines.append("")
                lines.append("PHYSICAL EXAMINATION:")
                lines.append(f"  Vital Signs: {generate_vitals(rng)}")
                for key, options in EXAM_OPTIONS.items():
                    lines.append(f"  {key.title()}: {rng.choice(options)}")
                lines.append("")
                lines.append("ASSESSMENT AND PLAN:")
                if dx:
                    plans = [
                        "Continue current management. Follow up in 3 months.",
                        "Ordered labs. Will reassess at next visit.",
                        "Medication adjustment made. Monitor response.",
                        "Referral placed for specialist consultation.",
                        "Patient educated on condition management.",
                    ]
                    for i, d in enumerate(dx, 1):
                        lines.append(f"  {i}. {d}")
                        lines.append(f"     {rng.choice(plans)}")
                else:
                    lines.append("  Routine encounter. No acute issues. Follow up as scheduled.")
                lines.append("")
                lines.append("—" * 72)
                lines.append("Electronically signed")
                lines.append("")

                note_text = "\n".join(lines)
                note_parts.append(note_text)

                # Build note row for omop.note
                enc_class = visit["class"]
                title = f"{enc_class.upper()} — {visit['desc']}"
                notes_batch.append((
                    next_note_id,
                    pid,
                    visit_start,                    # note_date
                    None,                           # note_datetime
                    NOTE_TYPE_EHR,                  # note_type_concept_id
                    NOTE_CLASS_PROGRESS,            # note_class_concept_id
                    title[:250],                    # note_title
                    note_text,                      # note_text
                    ENCODING_UTF8,                  # encoding_concept_id
                    LANGUAGE_ENGLISH,               # language_concept_id
                    None,                           # provider_id (not tracked per note)
                    visit["id"],                    # visit_occurrence_id
                    None,                           # visit_detail_id
                    None,                           # note_source_value
                    None,                           # note_event_id
                    None,                           # note_event_field_concept_id
                ))
                next_note_id += 1
                total_notes += 1

                # Flush note batch
                if len(notes_batch) >= NOTE_BATCH_SIZE:
                    _flush_notes(conn, target_schema, notes_batch)
                    notes_batch.clear()

            # Optionally write patient file to disk
            if notes_to_files and note_parts:
                filename = f"{pid}_{pat['last']}_{pat['first']}.txt"
                filepath = os.path.join(notes_dir, filename)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write("\n\n".join(note_parts))

    # Final flush
    if notes_batch:
        _flush_notes(conn, target_schema, notes_batch)

    print(f"\n  Clinical notes inserted into {target_schema}.note: {total_notes:,}")
    print(f"  Patients processed: {total_patients:,}")
    if notes_to_files:
        print(f"  Patient files written to: {notes_dir}")
    return total_notes


def _ensure_note_indexes(conn, schema: str):
    """Add PK and indexes to note table if missing."""
    cur = conn.cursor()
    # Check if PK exists
    cur.execute("""
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = %s AND table_name = 'note'
          AND constraint_type = 'PRIMARY KEY'
    """, (schema,))
    if not cur.fetchone():
        print("  Adding primary key to note table...")
        cur.execute(f"ALTER TABLE {schema}.note ADD PRIMARY KEY (note_id);")
    # Indexes
    cur.execute(f"CREATE INDEX IF NOT EXISTS idx_note_person_id ON {schema}.note(person_id);")
    cur.execute(f"CREATE INDEX IF NOT EXISTS idx_note_visit_id ON {schema}.note(visit_occurrence_id);")
    cur.execute(f"CREATE INDEX IF NOT EXISTS idx_note_date ON {schema}.note(note_date);")
    conn.commit()
    cur.close()


def _flush_notes(conn, schema, batch):
    cur = conn.cursor()
    sql = f"""
        INSERT INTO {schema}.note (
            note_id, person_id, note_date, note_datetime,
            note_type_concept_id, note_class_concept_id,
            note_title, note_text,
            encoding_concept_id, language_concept_id,
            provider_id, visit_occurrence_id, visit_detail_id,
            note_source_value, note_event_id, note_event_field_concept_id
        ) VALUES %s
        ON CONFLICT (note_id) DO NOTHING
    """
    psycopg2.extras.execute_values(cur, sql, batch, page_size=2000)
    conn.commit()
    cur.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate claims & clinical notes from OMOP CDM (PostgreSQL).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--pg-host", default=os.getenv("PG_HOST", "localhost"))
    parser.add_argument("--pg-port", type=int, default=int(os.getenv("PG_PORT", "5432")))
    parser.add_argument("--pg-database", default=os.getenv("PG_DATABASE", "ohdsi"))
    parser.add_argument("--pg-user", default=os.getenv("PG_USER", "smudoshi"))
    parser.add_argument("--pg-password", default=os.getenv("PG_PASSWORD", ""))
    parser.add_argument("--cdm-schema", default=os.getenv("PG_CDM_SCHEMA", "omop"))
    parser.add_argument("--target-schema", default=os.getenv("PG_TARGET_SCHEMA", "omop"))
    parser.add_argument("--notes-dir", default=os.getenv("NOTES_OUTPUT_DIR", "./output/notes"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--skip-claims", action="store_true")
    parser.add_argument("--skip-notes", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--recreate-tables", action="store_true",
                        help="DROP and recreate claims tables before inserting")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit to N patients/visits (for testing)")
    parser.add_argument("--notes-to-files", action="store_true",
                        help="Also write notes as .txt files (default: DB only)")

    args = parser.parse_args()
    rng = random.Random(args.seed)

    print("=" * 72)
    print("Synthea Claims & Notes Generator (OMOP CDM Edition)")
    print("=" * 72)
    print(f"  Host:       {args.pg_host}:{args.pg_port}")
    print(f"  Database:   {args.pg_database}")
    print(f"  CDM Schema: {args.cdm_schema}")
    print(f"  Target:     {args.target_schema}")
    print(f"  Notes:      {args.notes_dir}")
    print(f"  Seed:       {args.seed}")
    print(f"  Claims:     {'skip' if args.skip_claims else 'generate'}")
    print(f"  Notes:      {'skip' if args.skip_notes else 'generate'}")
    print(f"  Dry run:    {args.dry_run}")
    print(f"  Limit:      {args.limit or 'none'}")
    print("=" * 72)

    conn = get_connection(args)
    print(f"\n  Connected to {args.pg_database}@{args.pg_host}")

    # Verify CDM schema exists
    cur = conn.cursor()
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.schemata WHERE schema_name = %s
        )
    """, (args.cdm_schema,))
    if not cur.fetchone()[0]:
        print(f"\nERROR: Schema '{args.cdm_schema}' does not exist.")
        sys.exit(1)
    cur.close()

    # Verify required tables
    for tbl in ["visit_occurrence", "person"]:
        if not table_exists(conn, args.cdm_schema, tbl):
            print(f"\nERROR: Table {args.cdm_schema}.{tbl} not found.")
            sys.exit(1)

    if not args.skip_claims:
        print("\nPHASE 1: Claims Generation")
        print("-" * 40)
        if not args.dry_run:
            create_claims_tables(conn, args.target_schema, args.recreate_tables)
        generate_claims(conn, args.cdm_schema, args.target_schema, rng,
                        args.dry_run, args.limit)

    if not args.skip_notes:
        print("\nPHASE 2: Clinical Notes Generation")
        print("-" * 40)
        generate_notes(conn, args.cdm_schema, args.target_schema,
                       args.notes_dir, rng, args.limit, args.notes_to_files)

    conn.close()
    print("\n" + "=" * 72)
    print("COMPLETE")
    print("=" * 72)


if __name__ == "__main__":
    main()
