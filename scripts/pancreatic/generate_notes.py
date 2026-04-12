#!/usr/bin/env python3
"""
Generate clinical notes for pancreatic cancer patients using MedGemma via Ollama.

Creates 4 note types per patient (3 for non-surgical):
  - Initial Oncology Consultation (all patients)
  - Surgical Pathology Report (all patients)
  - Operative Note (surgical patients only)
  - Treatment Progress Note (all patients)

Total: ~1,230 notes for 361 patients.

Idempotent: skips (person_id, note_class_concept_id) pairs that already exist.
Resume-safe: commits every 10 notes.

Run: python3 scripts/pancreatic/generate_notes.py [--force]
"""

import argparse
import logging
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
import requests

# ── Configuration ──────────────────────────────────────────────────────────

DB_CONN = "host=localhost dbname=parthenon user=claude_dev"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "MedAIBase/MedGemma1.5:4b"

# OMOP Concept IDs
ENGLISH = 4180186
ENCODING_CONCEPT = 0
INPATIENT = 9201
OUTPATIENT = 9202

# Note type concept IDs
EHR_NOTE = 32831
EHR_PATHOLOGY_REPORT = 32835
EHR_OUTPATIENT_NOTE = 32834

# Note class concept IDs
OUTPATIENT_NOTE_CLASS = 44814640
PATHOLOGY_REPORT_CLASS = 44814642
INPATIENT_NOTE_CLASS = 44814639

# Procedure concepts for subgroup inference
WHIPPLE = 4020329
DISTAL_PANCREATECTOMY = 4144850

# Genomic measurement concepts
GENOMIC_CONCEPTS = (3012200, 3009106, 1988360, 3026497)
PRESENT_CONCEPT = 4181412   # mutated
ABSENT_CONCEPT = 4132135    # wild-type

# Drug concepts to exclude from context
ONDANSETRON = 1000560

NOTE_SOURCE_VALUE = "medgemma-generated"
COMMIT_INTERVAL = 10
MIN_WORD_COUNT = 50
PROGRESS_INTERVAL = 10

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
log = logging.getLogger(__name__)

# Ensure output is flushed immediately
sys.stdout.reconfigure(line_buffering=True)

# ── Note type definitions ──────────────────────────────────────────────────


@dataclass(frozen=True)
class NoteType:
    key: str
    title: str
    note_type_concept_id: int
    note_class_concept_id: int
    system_prompt: str
    surgical_only: bool = False


NOTE_TYPES = [
    NoteType(
        key="consultation",
        title="Initial Oncology Consultation",
        note_type_concept_id=EHR_NOTE,
        note_class_concept_id=OUTPATIENT_NOTE_CLASS,
        system_prompt=(
            "You are a medical oncologist writing an initial consultation note for a "
            "patient newly diagnosed with pancreatic ductal adenocarcinoma. Write a "
            "realistic clinical note with sections: CHIEF COMPLAINT, HISTORY OF PRESENT "
            "ILLNESS, PAST MEDICAL HISTORY, MEDICATIONS, REVIEW OF SYSTEMS, PHYSICAL "
            "EXAMINATION, ASSESSMENT AND PLAN. Use the provided patient data. Write in "
            "standard clinical documentation style -- concise, professional, use medical "
            "abbreviations. Do not include patient name or MRN. Do not add disclaimers."
        ),
    ),
    NoteType(
        key="pathology",
        title="Surgical Pathology Report",
        note_type_concept_id=EHR_PATHOLOGY_REPORT,
        note_class_concept_id=PATHOLOGY_REPORT_CLASS,
        system_prompt=(
            "You are a pathologist writing a surgical pathology report for a pancreatic "
            "specimen. Write a realistic pathology report with sections: SPECIMEN, GROSS "
            "DESCRIPTION, MICROSCOPIC DESCRIPTION, DIAGNOSIS, PATHOLOGIC STAGING (if "
            "surgical specimen). Use the provided patient data. Be specific about margins, "
            "lymph nodes, differentiation grade. Write in standard pathology report style."
        ),
    ),
    NoteType(
        key="operative",
        title="Operative Note",
        note_type_concept_id=EHR_NOTE,
        note_class_concept_id=INPATIENT_NOTE_CLASS,
        system_prompt=(
            "You are a hepatobiliary surgeon writing an operative note. Write a realistic "
            "operative note with sections: PREOPERATIVE DIAGNOSIS, POSTOPERATIVE DIAGNOSIS, "
            "PROCEDURE PERFORMED, SURGEON, ANESTHESIA, FINDINGS, TECHNIQUE, ESTIMATED "
            "BLOOD LOSS, SPECIMENS, COMPLICATIONS, DISPOSITION. Use the provided patient "
            "data. Be specific about anatomy and technique."
        ),
        surgical_only=True,
    ),
    NoteType(
        key="progress",
        title="Treatment Progress Note",
        note_type_concept_id=EHR_OUTPATIENT_NOTE,
        note_class_concept_id=OUTPATIENT_NOTE_CLASS,
        system_prompt=(
            "You are a medical oncologist writing a progress note during chemotherapy "
            "treatment. Write a realistic progress note with sections: INTERVAL HISTORY, "
            "CURRENT REGIMEN AND CYCLE, TOXICITIES, LABORATORY REVIEW, PHYSICAL "
            "EXAMINATION, ASSESSMENT AND PLAN. Use the provided patient data. Include "
            "specific lab values and toxicity grading."
        ),
    ),
]


# ── Patient data retrieval ─────────────────────────────────────────────────


@dataclass
class PatientContext:
    person_id: int
    age: int
    sex: str
    diagnosis_date: date
    comorbidities: list[str]
    medications: list[str]
    procedures: list[str]
    genomics: dict[str, str]
    labs: list[str]
    outcome: str
    subgroup: str
    tumor_location: str
    first_visit_id: Optional[int]
    first_visit_date: Optional[date]
    surgery_visit_id: Optional[int]
    surgery_visit_date: Optional[date]
    chemo_visit_id: Optional[int]
    chemo_visit_date: Optional[date]
    first_specimen_date: Optional[date]


def get_all_patients(cur: psycopg2.extensions.cursor) -> list[int]:
    """Get all person_ids from the pancreas schema."""
    cur.execute("SELECT person_id FROM pancreas.person ORDER BY person_id")
    return [row[0] for row in cur.fetchall()]


def get_patient_context(cur: psycopg2.extensions.cursor, person_id: int) -> PatientContext:
    """Build the full clinical context for a patient from CDM tables."""

    # Demographics
    cur.execute(
        "SELECT year_of_birth, gender_concept_id FROM pancreas.person WHERE person_id = %s",
        (person_id,),
    )
    row = cur.fetchone()
    year_of_birth = row[0]
    sex = "Male" if row[1] == 8507 else "Female"
    current_year = 2024
    age = current_year - year_of_birth

    # Conditions
    cur.execute(
        """
        SELECT DISTINCT c.concept_name
        FROM pancreas.condition_occurrence co
        JOIN vocab.concept c ON c.concept_id = co.condition_concept_id
        WHERE co.person_id = %s
        """,
        (person_id,),
    )
    comorbidities = [r[0] for r in cur.fetchall()]

    # Drugs (exclude Ondansetron)
    cur.execute(
        """
        SELECT DISTINCT de.drug_source_value
        FROM pancreas.drug_exposure de
        WHERE de.person_id = %s
          AND de.drug_concept_id != %s
          AND de.drug_source_value IS NOT NULL
          AND de.drug_source_value != ''
        """,
        (person_id, ONDANSETRON),
    )
    medications = [r[0] for r in cur.fetchall()]

    # Procedures
    cur.execute(
        """
        SELECT DISTINCT c.concept_name
        FROM pancreas.procedure_occurrence po
        JOIN vocab.concept c ON c.concept_id = po.procedure_concept_id
        WHERE po.person_id = %s
        """,
        (person_id,),
    )
    procedures = [r[0] for r in cur.fetchall()]

    # Genomics
    genomics: dict[str, str] = {}
    gene_names = {3012200: "KRAS", 3009106: "TP53", 1988360: "SMAD4", 3026497: "CDKN2A"}
    cur.execute(
        """
        SELECT measurement_concept_id, value_as_concept_id, value_source_value
        FROM pancreas.measurement
        WHERE person_id = %s AND measurement_concept_id IN %s
        """,
        (person_id, GENOMIC_CONCEPTS),
    )
    for mrow in cur.fetchall():
        gene = gene_names.get(mrow[0], f"gene_{mrow[0]}")
        if mrow[1] == PRESENT_CONCEPT:
            variant = mrow[2] if mrow[2] else "mutated"
            genomics[gene] = variant
        elif mrow[1] == ABSENT_CONCEPT:
            genomics[gene] = "wild-type"

    # Visits (ordered by date)
    cur.execute(
        """
        SELECT visit_occurrence_id, visit_concept_id, visit_start_date, visit_source_value
        FROM pancreas.visit_occurrence
        WHERE person_id = %s
        ORDER BY visit_start_date
        """,
        (person_id,),
    )
    visits = cur.fetchall()

    first_visit_id: Optional[int] = None
    first_visit_date: Optional[date] = None
    surgery_visit_id: Optional[int] = None
    surgery_visit_date: Optional[date] = None
    chemo_visit_id: Optional[int] = None
    chemo_visit_date: Optional[date] = None

    if visits:
        first_visit_id = visits[0][0]
        first_visit_date = visits[0][2]

    for v in visits:
        vid, vconcept, vdate, vsource = v
        # Surgery visit: first inpatient visit
        if vconcept == INPATIENT and surgery_visit_id is None:
            surgery_visit_id = vid
            surgery_visit_date = vdate
        # Chemo visit: first visit with chemo-related source value
        if chemo_visit_id is None and vsource:
            source_lower = vsource.lower()
            if any(kw in source_lower for kw in ("chemo", "1st-line", "induction", "adjuvant")):
                chemo_visit_id = vid
                chemo_visit_date = vdate

    # Labs at first visit (exclude genomic concepts)
    labs: list[str] = []
    if first_visit_id:
        cur.execute(
            """
            SELECT c.concept_name, m.value_as_number, m.unit_source_value
            FROM pancreas.measurement m
            JOIN vocab.concept c ON c.concept_id = m.measurement_concept_id
            WHERE m.person_id = %s
              AND m.visit_occurrence_id = %s
              AND m.measurement_concept_id NOT IN %s
              AND m.value_as_number IS NOT NULL
            """,
            (person_id, first_visit_id, GENOMIC_CONCEPTS),
        )
        for lr in cur.fetchall():
            unit = lr[2] if lr[2] else ""
            labs.append(f"{lr[0]}: {lr[1]} {unit}".strip())

    # Death
    cur.execute("SELECT death_date FROM pancreas.death WHERE person_id = %s", (person_id,))
    death_row = cur.fetchone()
    outcome = "Deceased" if death_row else "Alive at last follow-up"

    # Diagnosis date (first condition occurrence)
    cur.execute(
        "SELECT MIN(condition_start_date) FROM pancreas.condition_occurrence WHERE person_id = %s",
        (person_id,),
    )
    dx_row = cur.fetchone()
    diagnosis_date = dx_row[0] if dx_row and dx_row[0] else (first_visit_date or date(2020, 6, 1))

    # First specimen date
    cur.execute(
        "SELECT MIN(specimen_date) FROM pancreas.specimen WHERE person_id = %s",
        (person_id,),
    )
    spec_row = cur.fetchone()
    first_specimen_date = spec_row[0] if spec_row and spec_row[0] else diagnosis_date

    # Infer subgroup and tumor location from procedures and visits
    subgroup, tumor_location = _infer_subgroup(procedures, visits)

    return PatientContext(
        person_id=person_id,
        age=age,
        sex=sex,
        diagnosis_date=diagnosis_date,
        comorbidities=comorbidities,
        medications=medications,
        procedures=procedures,
        genomics=genomics,
        labs=labs,
        outcome=outcome,
        subgroup=subgroup,
        tumor_location=tumor_location,
        first_visit_id=first_visit_id,
        first_visit_date=first_visit_date,
        surgery_visit_id=surgery_visit_id,
        surgery_visit_date=surgery_visit_date,
        chemo_visit_id=chemo_visit_id,
        chemo_visit_date=chemo_visit_date,
        first_specimen_date=first_specimen_date,
    )


def _infer_subgroup(
    procedures: list[str], visits: list[tuple]
) -> tuple[str, str]:
    """Infer clinical subgroup and tumor location from CDM data."""
    proc_lower = [p.lower() for p in procedures]
    has_whipple = any("pancreaticoduodenectomy" in p or "pancreatoduodenectomy" in p for p in proc_lower)
    has_distal = any("distal pancreatectomy" in p for p in proc_lower)
    has_inpatient = any(v[1] == INPATIENT for v in visits)
    has_second_line = any(
        v[3] and "2nd-line" in v[3].lower() for v in visits if v[3]
    )

    if has_whipple:
        return "resectable", "head of pancreas"
    if has_distal:
        return "resectable", "body/tail of pancreas"
    if has_inpatient and not has_second_line:
        return "borderline resectable", "head of pancreas"
    if has_second_line:
        return "metastatic", "body/tail of pancreas"
    return "metastatic", "body/tail of pancreas"


def build_context_string(ctx: PatientContext) -> str:
    """Format patient data as a context string for the LLM prompt."""
    lines = [
        f"Age: {ctx.age}, Sex: {ctx.sex}",
        f"Diagnosis: Pancreatic ductal adenocarcinoma, {ctx.tumor_location}",
        f"Clinical stage: {ctx.subgroup}",
        f"Diagnosis date: {ctx.diagnosis_date.isoformat()}",
    ]

    if ctx.comorbidities:
        lines.append(f"Comorbidities: {', '.join(ctx.comorbidities)}")
    if ctx.medications:
        lines.append(f"Medications: {', '.join(ctx.medications)}")
    if ctx.labs:
        lines.append(f"Laboratory values: {'; '.join(ctx.labs)}")
    if ctx.genomics:
        profile = ", ".join(f"{g}: {v}" for g, v in ctx.genomics.items())
        lines.append(f"Molecular profile: {profile}")
    if ctx.procedures:
        lines.append(f"Procedures: {', '.join(ctx.procedures)}")
    lines.append(f"Outcome: {ctx.outcome}")

    return "\n".join(lines)


# ── MedGemma integration ──────────────────────────────────────────────────


def generate_note_text(
    system_prompt: str, patient_data: str, retry: bool = True
) -> Optional[str]:
    """Generate a clinical note via MedGemma through Ollama."""
    prompt = f"{system_prompt}\n\nPatient Data:\n{patient_data}\n\nWrite the clinical note now:"

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.7, "num_predict": 1024},
            },
            timeout=120,
        )
        resp.raise_for_status()
        text = resp.json().get("response", "").strip()

        # Check minimum word count
        if len(text.split()) < MIN_WORD_COUNT:
            if retry:
                log.warning(
                    "Note too short (%d words), retrying...", len(text.split())
                )
                return generate_note_text(system_prompt, patient_data, retry=False)
            log.warning("Note still too short after retry (%d words), skipping", len(text.split()))
            return None

        return text

    except requests.exceptions.RequestException as e:
        log.error("MedGemma request failed: %s", e)
        return None
    except (KeyError, ValueError) as e:
        log.error("MedGemma response parse error: %s", e)
        return None


# ── Note insertion ─────────────────────────────────────────────────────────


def get_existing_notes(cur: psycopg2.extensions.cursor) -> set[tuple[int, int]]:
    """Get (person_id, note_class_concept_id) pairs already generated."""
    cur.execute(
        """
        SELECT person_id, note_class_concept_id
        FROM pancreas.note
        WHERE note_source_value = %s
        """,
        (NOTE_SOURCE_VALUE,),
    )
    return {(r[0], r[1]) for r in cur.fetchall()}


def get_next_note_id(cur: psycopg2.extensions.cursor) -> int:
    """Get the next available note_id."""
    cur.execute("SELECT COALESCE(MAX(note_id), 0) FROM pancreas.note")
    return cur.fetchone()[0] + 1


def insert_note(
    cur: psycopg2.extensions.cursor,
    note_id: int,
    person_id: int,
    note_date: date,
    note_type: NoteType,
    note_text: str,
    visit_occurrence_id: Optional[int],
) -> None:
    """Insert a single note into pancreas.note."""
    cur.execute(
        """
        INSERT INTO pancreas.note (
            note_id, person_id, note_date, note_datetime,
            note_type_concept_id, note_class_concept_id,
            note_title, note_text,
            encoding_concept_id, language_concept_id,
            provider_id, visit_occurrence_id, visit_detail_id,
            note_source_value, note_event_id, note_event_field_concept_id
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s, %s, %s,
            %s, %s, %s
        )
        """,
        (
            note_id,
            person_id,
            note_date,
            datetime.combine(note_date, datetime.min.time()),
            note_type.note_type_concept_id,
            note_type.note_class_concept_id,
            note_type.title,
            note_text,
            ENCODING_CONCEPT,
            ENGLISH,
            None,  # provider_id
            visit_occurrence_id,
            None,  # visit_detail_id
            NOTE_SOURCE_VALUE,
            None,  # note_event_id
            None,  # note_event_field_concept_id
        ),
    )


# ── Main ───────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate clinical notes for pancreatic cancer patients using MedGemma."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete all existing generated notes and regenerate from scratch.",
    )
    args = parser.parse_args()

    log.info("Connecting to database...")
    conn = psycopg2.connect(DB_CONN)
    conn.autocommit = False
    cur = conn.cursor()

    # Verify MedGemma availability
    log.info("Verifying MedGemma availability...")
    try:
        test_resp = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": "Say OK",
                "stream": False,
                "options": {"num_predict": 5},
            },
            timeout=60,
        )
        test_resp.raise_for_status()
        log.info("MedGemma is available.")
    except Exception as e:
        log.error("MedGemma not available at %s: %s", OLLAMA_URL, e)
        sys.exit(1)

    # Handle --force flag
    if args.force:
        log.info("--force: deleting all existing generated notes...")
        cur.execute(
            "DELETE FROM pancreas.note WHERE note_source_value = %s",
            (NOTE_SOURCE_VALUE,),
        )
        deleted = cur.rowcount
        conn.commit()
        log.info("Deleted %d existing notes.", deleted)

    # Get existing notes for resume support
    existing = get_existing_notes(cur)
    log.info("Found %d existing generated note entries.", len(existing))

    # Get all patients
    patient_ids = get_all_patients(cur)
    total_patients = len(patient_ids)
    log.info("Found %d patients.", total_patients)

    # Get starting note_id
    next_note_id = get_next_note_id(cur)
    log.info("Starting note_id: %d", next_note_id)

    # Counters
    notes_generated = 0
    notes_skipped = 0
    notes_failed = 0
    notes_by_type: dict[str, int] = {nt.key: 0 for nt in NOTE_TYPES}
    uncommitted = 0
    start_time = time.time()

    for idx, person_id in enumerate(patient_ids):
        ctx = get_patient_context(cur, person_id)
        patient_data = build_context_string(ctx)
        is_surgical = ctx.surgery_visit_id is not None

        for nt in NOTE_TYPES:
            # Skip operative notes for non-surgical patients
            if nt.surgical_only and not is_surgical:
                continue

            # Skip if already exists (resume support)
            if (person_id, nt.note_class_concept_id) in existing:
                notes_skipped += 1
                continue

            # Determine note date and visit
            if nt.key == "consultation":
                note_date = ctx.first_visit_date or ctx.diagnosis_date
                visit_id = ctx.first_visit_id
            elif nt.key == "pathology":
                note_date = ctx.first_specimen_date or ctx.diagnosis_date
                visit_id = ctx.first_visit_id
            elif nt.key == "operative":
                note_date = ctx.surgery_visit_date or ctx.diagnosis_date
                visit_id = ctx.surgery_visit_id
            elif nt.key == "progress":
                note_date = ctx.chemo_visit_date or ctx.first_visit_date or ctx.diagnosis_date
                visit_id = ctx.chemo_visit_id or ctx.first_visit_id
            else:
                note_date = ctx.diagnosis_date
                visit_id = ctx.first_visit_id

            # Generate the note
            gen_start = time.time()
            text = generate_note_text(nt.system_prompt, patient_data)
            gen_elapsed = time.time() - gen_start
            if text is not None:
                log.info(
                    "  person=%d %s: %d words in %.1fs",
                    person_id, nt.key, len(text.split()), gen_elapsed,
                )
            if text is None:
                notes_failed += 1
                log.warning(
                    "Failed to generate %s note for person %d", nt.key, person_id
                )
                continue

            # Insert
            insert_note(cur, next_note_id, person_id, note_date, nt, text, visit_id)
            next_note_id += 1
            notes_generated += 1
            notes_by_type[nt.key] += 1
            uncommitted += 1

            # Commit periodically
            if uncommitted >= COMMIT_INTERVAL:
                conn.commit()
                uncommitted = 0

        # Progress report
        if (idx + 1) % PROGRESS_INTERVAL == 0 or idx == total_patients - 1:
            elapsed = time.time() - start_time
            rate = notes_generated / elapsed if elapsed > 0 else 0
            remaining_patients = total_patients - (idx + 1)
            # Estimate ~3.5 notes per remaining patient (avg of surgical/non-surgical)
            remaining_notes_est = remaining_patients * 3.5
            eta_seconds = remaining_notes_est / rate if rate > 0 else 0
            eta_min = eta_seconds / 60

            log.info(
                "Progress: %d/%d patients | %d notes generated | %d skipped | %d failed | "
                "%.1f notes/sec | ETA: %.1f min",
                idx + 1,
                total_patients,
                notes_generated,
                notes_skipped,
                notes_failed,
                rate,
                eta_min,
            )

    # Final commit
    if uncommitted > 0:
        conn.commit()

    elapsed = time.time() - start_time
    elapsed_min = elapsed / 60

    log.info("=" * 70)
    log.info("COMPLETE")
    log.info("=" * 70)
    log.info("Total notes generated: %d", notes_generated)
    log.info("Notes skipped (existing): %d", notes_skipped)
    log.info("Notes failed: %d", notes_failed)
    log.info("Time elapsed: %.1f minutes (%.0f seconds)", elapsed_min, elapsed)
    log.info("Notes by type:")
    for key, count in notes_by_type.items():
        log.info("  %-15s %d", key, count)

    # Verification query
    cur.execute(
        """
        SELECT note_class_concept_id, COUNT(*)
        FROM pancreas.note
        WHERE note_source_value = %s
        GROUP BY note_class_concept_id
        ORDER BY note_class_concept_id
        """,
        (NOTE_SOURCE_VALUE,),
    )
    log.info("Verification (note counts in DB by class):")
    for row in cur.fetchall():
        log.info("  class_concept_id=%d: %d notes", row[0], row[1])

    # Sample note excerpt
    cur.execute(
        """
        SELECT note_title, LEFT(note_text, 300)
        FROM pancreas.note
        WHERE note_source_value = %s
        ORDER BY note_id
        LIMIT 1
        """,
        (NOTE_SOURCE_VALUE,),
    )
    sample = cur.fetchone()
    if sample:
        log.info("Sample note (%s):", sample[0])
        log.info("  %s...", sample[1])

    cur.close()
    conn.close()
    log.info("Done.")


if __name__ == "__main__":
    main()
