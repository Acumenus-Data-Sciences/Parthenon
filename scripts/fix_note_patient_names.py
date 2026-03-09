#!/usr/bin/env python3
"""
fix_note_patient_names.py

Fixes clinical note text so that the embedded patient name matches
the person_source_value from omop.person (e.g., "MBU-UDOSHI-499504")
instead of a randomly generated synthetic name like "Brandon Carter".

Updates two patterns in note_text:
  1. "Patient: <FirstName> <LastName>"  →  "Patient: <person_source_value>"
  2. "Patient is a <age>-year-old <gender>"  stays the same (no name there)

Strategy:
  - Regenerate the same deterministic name per person_id (same RNG seed)
  - Build a mapping: person_id → (old_name, person_source_value)
  - Batch UPDATE note_text using REPLACE() for each person

Requirements:
    pip install psycopg2-binary python-dotenv tqdm

Usage:
    python fix_note_patient_names.py                  # Full run
    python fix_note_patient_names.py --dry-run        # Preview only
    python fix_note_patient_names.py --limit 100      # Test on N patients
    python fix_note_patient_names.py --batch-size 500 # Adjust batch size
"""

import argparse
import os
import random
import sys
import time

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

# Same name lists as the generator script — must match exactly
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


def generate_name(person_id: int, gender_concept_id: int) -> str:
    """Reproduce the exact same deterministic name the generator used."""
    name_rng = random.Random(person_id)
    if gender_concept_id == 8532:  # Female
        first = name_rng.choice(FIRST_NAMES_F)
    else:
        first = name_rng.choice(FIRST_NAMES_M)
    last = name_rng.choice(LAST_NAMES)
    return f"{first} {last}"


def get_connection(args):
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


def main():
    parser = argparse.ArgumentParser(description="Fix patient names in clinical notes")
    parser.add_argument("--pg-host", default=os.getenv("PG_HOST", "localhost"))
    parser.add_argument("--pg-port", default=os.getenv("PG_PORT", "5432"))
    parser.add_argument("--pg-database", default=os.getenv("PG_DATABASE", "ohdsi"))
    parser.add_argument("--pg-user", default=os.getenv("PG_USER", "smudoshi"))
    parser.add_argument("--pg-password", default=os.getenv("PG_PASSWORD", ""))
    parser.add_argument("--schema", default=os.getenv("PG_CDM_SCHEMA", "omop"))
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without updating")
    parser.add_argument("--limit", type=int, default=0, help="Limit to N patients (0=all)")
    parser.add_argument("--batch-size", type=int, default=200, help="Patients per batch")
    args = parser.parse_args()

    schema = args.schema
    conn = get_connection(args)
    conn.autocommit = False

    print(f"Connected to {args.pg_database} on {args.pg_host}:{args.pg_port}")
    print(f"Schema: {schema}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE UPDATE'}")
    print()

    cur = conn.cursor()

    # Step 1: Get all distinct person_ids that have notes, with their gender
    print("Fetching persons with notes...")
    limit_clause = f"LIMIT {args.limit}" if args.limit else ""
    cur.execute(f"""
        SELECT DISTINCT n.person_id, p.gender_concept_id, p.person_source_value
        FROM {schema}.note n
        JOIN {schema}.person p ON p.person_id = n.person_id
        ORDER BY n.person_id
        {limit_clause}
    """)
    persons = cur.fetchall()
    total_persons = len(persons)
    print(f"  Found {total_persons:,} persons with notes")

    # Step 2: Build mapping of old_name → new_name (person_source_value)
    updates = []
    skipped = 0
    for person_id, gender_concept_id, psv in persons:
        old_name = generate_name(person_id, gender_concept_id)
        new_name = psv or f"Patient #{person_id}"

        if old_name == new_name:
            skipped += 1
            continue

        updates.append((person_id, old_name, new_name))

    print(f"  Updates needed: {len(updates):,} (skipped {skipped:,} — name already matches)")
    print()

    if args.dry_run:
        print("DRY RUN — showing first 10 changes:")
        for pid, old, new in updates[:10]:
            print(f"  person_id={pid}: '{old}' → '{new}'")
        print(f"\nWould update notes for {len(updates):,} patients")
        conn.close()
        return

    # Step 3: Batch UPDATE
    total_notes_updated = 0
    batch_size = args.batch_size
    start_time = time.time()

    batches = [updates[i:i + batch_size] for i in range(0, len(updates), batch_size)]

    for batch in tqdm(batches, desc="Updating notes", total=len(batches)):
        # Use a single UPDATE with CASE for each batch
        # More efficient: update per-person since each has a unique replacement
        for person_id, old_name, new_name in batch:
            cur.execute(f"""
                UPDATE {schema}.note
                SET note_text = REPLACE(note_text, %s, %s)
                WHERE person_id = %s
                  AND note_text LIKE %s
            """, (
                f"Patient: {old_name}",
                f"Patient: {new_name}",
                person_id,
                f"%Patient: {old_name}%",
            ))
            total_notes_updated += cur.rowcount

        conn.commit()

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Persons processed: {len(updates):,}")
    print(f"  Note rows updated: {total_notes_updated:,}")

    conn.close()


if __name__ == "__main__":
    main()
