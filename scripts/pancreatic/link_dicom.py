#!/usr/bin/env python3
"""
link_dicom.py — Map Orthanc DICOM patients to CDM persons and populate app.imaging_studies.

Searches Orthanc for PANCREAS*, C3L*, and C3N* patients, matches them against
pancreas.person.person_source_value, and upserts into app.imaging_studies.

Source ID 58 (PANCREAS) is assumed. Idempotent: clears existing source-58 records first.
"""

from __future__ import annotations

import sys
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
import requests
from requests.auth import HTTPBasicAuth

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DB_HOST = "localhost"
DB_NAME = "parthenon"
DB_USER = "claude_dev"

ORTHANC_URL = "http://localhost:8042"
ORTHANC_USER = "parthenon"
ORTHANC_PASS = "GixsEIl0hpOAeOwKdmmlAMe04SQ0CKih"
ORTHANC_AUTH = HTTPBasicAuth(ORTHANC_USER, ORTHANC_PASS)

SOURCE_ID = 58

# Patterns to search in Orthanc PatientID field
SEARCH_PATTERNS = ["PANCREAS*", "C3L*", "C3N*"]

# Skip per-instance counting for studies with many series (too slow)
SERIES_COUNT_THRESHOLD = 20


# ---------------------------------------------------------------------------
# Orthanc helpers
# ---------------------------------------------------------------------------

def orthanc_get(path: str) -> dict:
    """GET from Orthanc REST API, return parsed JSON."""
    resp = requests.get(f"{ORTHANC_URL}{path}", auth=ORTHANC_AUTH, timeout=30)
    resp.raise_for_status()
    return resp.json()


def orthanc_find_patients(pattern: str) -> list[str]:
    """Return list of Orthanc patient UUIDs matching PatientID glob pattern."""
    resp = requests.post(
        f"{ORTHANC_URL}/tools/find",
        auth=ORTHANC_AUTH,
        json={"Level": "Patient", "Query": {"PatientID": pattern}},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def parse_dicom_date(dicom_date: str) -> Optional[date]:
    """Parse DICOM YYYYMMDD string to Python date, return None if invalid."""
    if not dicom_date or len(dicom_date) < 8:
        return None
    try:
        return datetime.strptime(dicom_date[:8], "%Y%m%d").date()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def load_person_map(conn: psycopg2.extensions.connection) -> dict[str, int]:
    """Return {person_source_value: person_id} from pancreas.person."""
    with conn.cursor() as cur:
        cur.execute("SELECT person_source_value, person_id FROM pancreas.person")
        return {row[0]: row[1] for row in cur.fetchall()}


def clear_source_records(conn: psycopg2.extensions.connection) -> int:
    """Delete all imaging_studies rows for source_id=58, return count deleted."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM app.imaging_studies WHERE source_id = %s", (SOURCE_ID,))
        deleted = cur.rowcount
    conn.commit()
    return deleted


def insert_studies(
    conn: psycopg2.extensions.connection,
    records: list[dict],
) -> int:
    """Bulk-insert imaging study records, return count inserted."""
    if not records:
        return 0

    sql = """
        INSERT INTO app.imaging_studies (
            source_id, person_id, study_instance_uid, accession_number,
            modality, study_description, referring_physician, study_date,
            num_series, num_images, orthanc_study_id, status,
            patient_name_dicom, patient_id_dicom, institution_name,
            created_at, updated_at
        ) VALUES (
            %(source_id)s, %(person_id)s, %(study_instance_uid)s, %(accession_number)s,
            %(modality)s, %(study_description)s, %(referring_physician)s, %(study_date)s,
            %(num_series)s, %(num_images)s, %(orthanc_study_id)s, %(status)s,
            %(patient_name_dicom)s, %(patient_id_dicom)s, %(institution_name)s,
            NOW(), NOW()
        )
        ON CONFLICT (study_instance_uid) DO UPDATE SET
            person_id            = EXCLUDED.person_id,
            accession_number     = EXCLUDED.accession_number,
            modality             = EXCLUDED.modality,
            study_description    = EXCLUDED.study_description,
            referring_physician  = EXCLUDED.referring_physician,
            study_date           = EXCLUDED.study_date,
            num_series           = EXCLUDED.num_series,
            num_images           = EXCLUDED.num_images,
            orthanc_study_id     = EXCLUDED.orthanc_study_id,
            patient_name_dicom   = EXCLUDED.patient_name_dicom,
            patient_id_dicom     = EXCLUDED.patient_id_dicom,
            institution_name     = EXCLUDED.institution_name,
            updated_at           = NOW()
    """

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, records, page_size=100)
    conn.commit()
    return len(records)


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def build_study_record(
    orthanc_patient_id: str,
    patient_dicom: dict,
    orthanc_study_id: str,
    person_id: Optional[int],
) -> Optional[dict]:
    """
    Fetch study + first-series data from Orthanc and build an insert record.
    Returns None if the study cannot be processed.
    """
    study = orthanc_get(f"/studies/{orthanc_study_id}")
    tags = study.get("MainDicomTags", {})
    patient_tags = patient_dicom.get("MainDicomTags", {})

    study_instance_uid = tags.get("StudyInstanceUID", "").strip()
    if not study_instance_uid:
        return None

    series_ids: list[str] = study.get("Series", [])
    num_series = len(series_ids)

    # Determine modality from first series
    modality: Optional[str] = None
    num_images = 0

    if series_ids:
        try:
            first_series = orthanc_get(f"/series/{series_ids[0]}")
            modality = first_series.get("MainDicomTags", {}).get("Modality")

            # Count instances only for studies with manageable series counts
            if num_series <= SERIES_COUNT_THRESHOLD:
                for sid in series_ids:
                    try:
                        s = orthanc_get(f"/series/{sid}")
                        num_images += len(s.get("Instances", []))
                    except Exception:
                        pass
        except Exception:
            pass

    return {
        "source_id": SOURCE_ID,
        "person_id": person_id,
        "study_instance_uid": study_instance_uid,
        "accession_number": tags.get("AccessionNumber") or None,
        "modality": modality,
        "study_description": tags.get("StudyDescription") or None,
        "referring_physician": tags.get("ReferringPhysicianName") or None,
        "study_date": parse_dicom_date(tags.get("StudyDate", "")),
        "num_series": num_series,
        "num_images": num_images,
        "orthanc_study_id": orthanc_study_id,
        "status": "indexed",
        "patient_name_dicom": patient_tags.get("PatientName") or None,
        "patient_id_dicom": patient_tags.get("PatientID") or None,
        "institution_name": tags.get("InstitutionName") or None,
    }


def process_pattern(
    pattern: str,
    person_map: dict[str, int],
) -> list[dict]:
    """
    Find Orthanc patients matching pattern, link to CDM persons, collect study records.
    """
    print(f"\n  Pattern: {pattern}")

    try:
        patient_ids = orthanc_find_patients(pattern)
    except Exception as exc:
        print(f"    ERROR querying Orthanc: {exc}")
        return []

    print(f"    Orthanc patients found: {len(patient_ids)}")

    records: list[dict] = []
    unmatched = 0

    for orthanc_patient_id in patient_ids:
        try:
            patient = orthanc_get(f"/patients/{orthanc_patient_id}")
            patient_id_value: str = patient.get("MainDicomTags", {}).get("PatientID", "")

            # Match to CDM person
            person_id: Optional[int] = person_map.get(patient_id_value)
            if person_id is None:
                unmatched += 1

            study_ids: list[str] = patient.get("Studies", [])

            for orthanc_study_id in study_ids:
                try:
                    record = build_study_record(
                        orthanc_patient_id, patient, orthanc_study_id, person_id
                    )
                    if record:
                        records.append(record)
                except Exception as exc:
                    print(f"    WARN study {orthanc_study_id}: {exc}")

        except Exception as exc:
            print(f"    WARN patient {orthanc_patient_id}: {exc}")

    matched = len(patient_ids) - unmatched
    print(f"    CDM-linked: {matched}/{len(patient_ids)} patients, {len(records)} studies")
    return records


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Parthenon DICOM Linkage — Pancreatic Corpus")
    print(f"Source ID: {SOURCE_ID}")
    print("=" * 60)

    # Connect to database
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            dbname=DB_NAME,
            user=DB_USER,
        )
    except Exception as exc:
        print(f"FATAL: Cannot connect to database: {exc}", file=sys.stderr)
        sys.exit(1)

    # Load person map
    print("\nLoading person map from pancreas.person ...")
    person_map = load_person_map(conn)
    print(f"  {len(person_map)} persons loaded")

    # Clear existing records for this source
    print(f"\nClearing existing imaging_studies for source_id={SOURCE_ID} ...")
    deleted = clear_source_records(conn)
    print(f"  {deleted} records deleted")

    # Process each search pattern
    all_records: list[dict] = []
    for pattern in SEARCH_PATTERNS:
        records = process_pattern(pattern, person_map)
        all_records.extend(records)

    # Insert all records
    print(f"\nInserting {len(all_records)} study records ...")
    inserted = insert_studies(conn, all_records)
    print(f"  {inserted} records inserted")

    conn.close()

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    linked = sum(1 for r in all_records if r["person_id"] is not None)
    unlinked = sum(1 for r in all_records if r["person_id"] is None)
    modalities: dict[str, int] = {}
    for r in all_records:
        m = r["modality"] or "UNKNOWN"
        modalities[m] = modalities.get(m, 0) + 1

    print(f"Total studies inserted : {inserted}")
    print(f"  CDM-linked (person_id set) : {linked}")
    print(f"  No CDM match (person_id NULL): {unlinked}")
    print(f"Modalities: {modalities}")
    print("Done.")


if __name__ == "__main__":
    main()
