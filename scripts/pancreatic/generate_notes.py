#!/usr/bin/env python3
"""
Generate clinical notes for pancreatic cancer patients using MedGemma via Ollama.

Creates 4 note types per patient (3 for non-surgical):
  - Initial Oncology Consultation (all patients)
  - Surgical Pathology Report (all patients)
  - Operative Note (surgical patients only)
  - Treatment Progress Note (all patients)

Total: ~1,230 notes for 361 patients.

Idempotent: skips generated notes by person, type, class, and title.
Resume-safe: commits after each note by default.

Run: python3 scripts/pancreatic/generate_notes.py [--force] [--limit N] [--patient-id ID]
"""

import argparse
import logging
import os
import re
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
MODEL_NAME = os.environ.get("PANCREAS_NOTE_MODEL", "MedAIBase/MedGemma1.5:4b")
OLLAMA_TIMEOUT_SECONDS = int(os.environ.get("PANCREAS_NOTE_TIMEOUT_SECONDS", "600"))
OLLAMA_NUM_PREDICT = int(os.environ.get("PANCREAS_NOTE_NUM_PREDICT", "768"))
OLLAMA_NUM_CTX = int(os.environ.get("PANCREAS_NOTE_NUM_CTX", "4096"))
OLLAMA_NUM_GPU = int(os.environ.get("PANCREAS_NOTE_NUM_GPU", "999"))
OLLAMA_TEMPERATURE = float(os.environ.get("PANCREAS_NOTE_TEMPERATURE", "0.25"))
OLLAMA_REPEAT_PENALTY = float(os.environ.get("PANCREAS_NOTE_REPEAT_PENALTY", "1.2"))
REJECTED_NOTES_DIR = os.environ.get("PANCREAS_NOTE_REJECTED_DIR")
DEFAULT_TEMPLATE_NOTE_TYPES = os.environ.get(
    "PANCREAS_NOTE_TEMPLATE_TYPES",
    "consultation,pathology,operative,progress",
)

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
COMMIT_INTERVAL = int(os.environ.get("PANCREAS_NOTE_COMMIT_INTERVAL", "1"))
MIN_WORD_COUNT = 50
MIN_WORDS_BY_NOTE_KEY = {
    "consultation": 130,
    "pathology": 220,
    "operative": 250,
    "progress": 250,
}
PROGRESS_INTERVAL = 10
ExistingNoteKey = tuple[int, int, int, str]

GENERAL_NOTE_GUARDRAILS = (
    "Output only the clinical note body. Do not use Markdown code fences. Do not "
    "include patient name, MRN, date of birth, placeholder bracket text, example "
    "values, or instructions to replace fields. If a detail is not present in the "
    "Patient Data, write 'not documented' rather than inventing it. Do not add "
    "disclaimers. Do not repeat sentences, sections, molecular profiles, or outcomes. "
    "Do not invent vital signs, physical exam findings, review-of-systems negatives, "
    "chemotherapy cycle numbers, regimen schedules, toxicity grades, or new symptoms."
)
PATHOLOGY_GUARDRAILS = (
    " Do not mention immunohistochemistry, stains, tumor dimensions, lymph node "
    "counts, margin distances, or pathologic stage unless explicitly present in "
    "the Patient Data; use 'not documented' for unavailable pathology details. Keep "
    "the pathology report to 180-320 words and stop after the PATHOLOGIC STAGING section."
)
PLACEHOLDER_RE = re.compile(
    r"\[[^\]]*(?:redacted|not provided|current|your name|patient name|mrn|"
    r"insert|replace|assume|identifier|date redacted|e\.g\.|number|specific)"
    r"[^\]]*\]",
    re.IGNORECASE,
)
IDENTIFIER_LINE_RE = re.compile(
    r"^\s*\*{0,2}(?:patient name|patient|mrn|medical record number|date of birth|dob)"
    r"\*{0,2}\s*:\s*not documented\.?\s*$",
    re.IGNORECASE,
)
PATHOLOGY_UNSUPPORTED_DETAIL_RE = re.compile(
    r"\b(?:CK7|CK20|CDX2|MUC\d*|GPC\d*|S100|HMB-?45|TTF-?1|Napsin|"
    r"synaptophysin|chromogranin|PAS-positive|immunohistochem\w*|IHC)\b",
    re.IGNORECASE,
)
PATHOLOGY_UNSUPPORTED_GROSS_DETAIL_RE = re.compile(
    r"\b(?:"
    r"\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?|"
    r"\d+(?:\.\d+)?\s*(?:cm|mm)\b|"
    r"pT\d|pN\d|pM\d|AJCC|"
    r"(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+of\s+\d+\s+"
    r"(?:regional\s+)?lymph\s+nodes?|"
    r"lymph\s+nodes?\s+(?:are|were|is)\s+(?:identified|positive|negative|submitted|involved)|"
    r"lymphovascular\s+invasion\s+is\s+(?:identified|present|not\s+identified|absent)|"
    r"perineural\s+invasion\s+is\s+(?:identified|present|not\s+identified|absent)|"
    r"margins?\s+(?:are|is|appears?|were)\s+(?:negative|positive|involved|clear)|"
    r"(?:gastric|stomach|posterior|anterior|uncinate)\s+margin|"
    r"(?:duodenum|common\s+bile\s+duct|spleen|stomach|gallbladder)\s+"
    r"(?:is|appears|measures|shows|contains|involves|involved)|"
    r"moderately\s+differentiated|poorly\s+differentiated|well\s+differentiated|"
    r"serially\s+sectioned|submitted\s+for\s+microscopic\s+examination|"
    r"desmoplastic\s+stromal\s+reaction\s+is\s+present"
    r")\b",
    re.IGNORECASE,
)
UNSUPPORTED_CLINICAL_DETAIL_RE = re.compile(
    r"\b(?:BP\s*\d|HR\s*\d|RR\s*\d|Temp(?:erature)?\s*\d|"
    r"vital signs are stable|clear to auscultation|regular rate and rhythm|"
    r"denies fever|denies chills|denies chest pain|denies shortness of breath|"
    r"first cycle|cycle\s+\d+|mild nausea|grade\s+\d+)\b",
    re.IGNORECASE,
)

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
            "specimen. Write a concise source-faithful pathology report with exactly these "
            "sections: SPECIMEN, GROSS DESCRIPTION, MICROSCOPIC DESCRIPTION, DIAGNOSIS, "
            "PATHOLOGIC STAGING. Use the provided patient data. Write 1-3 sentences per "
            "section in standard pathology report style. If source fields do not state "
            "gross measurements, margin status, lymph node status, grade, stage, invasion, "
            "immunohistochemistry, or stains, explicitly write not documented for those "
            "items. Do not infer typical findings from the procedure name. Do not include "
            "molecular profile or outcome sections."
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
            "specific lab values. Do not invent cycle numbers or toxicity grades; write "
            "not documented when those details are absent."
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

    return "\n".join(lines)


def build_pathology_note(ctx: PatientContext) -> str:
    """Build an honest pathology note from structured fields only."""
    specimen_type = "Pancreatic specimen"
    procedure_text = ", ".join(ctx.procedures)
    procedure_lower = procedure_text.lower()
    if "pancreaticoduodenectomy" in procedure_lower or "pancreatoduodenectomy" in procedure_lower:
        specimen_type = "Pancreaticoduodenectomy specimen"
    elif "distal pancreatectomy" in procedure_lower:
        specimen_type = "Distal pancreatectomy specimen"
    elif procedure_text:
        specimen_type = f"Pancreatic specimen associated with: {procedure_text}"

    molecular_profile = "not documented"
    if ctx.genomics:
        molecular_profile = ", ".join(f"{gene}: {variant}" for gene, variant in ctx.genomics.items())

    return "\n\n".join(
        [
            (
                "SPECIMEN\n"
                f"{specimen_type}. Primary tumor location from structured data: "
                f"{ctx.tumor_location}. Exact container labeling and specimen dimensions "
                "are not documented in the structured source."
            ),
            (
                "GROSS DESCRIPTION\n"
                "Gross tumor size, margin distances, lymph node count, vascular invasion, "
                "and perineural invasion are not documented in the structured source. "
                "No additional gross measurements are inferred."
            ),
            (
                "MICROSCOPIC DESCRIPTION\n"
                "Structured diagnosis is pancreatic ductal adenocarcinoma. Histologic grade, "
                "lymphovascular invasion, perineural invasion, treatment effect, and regional "
                "lymph node involvement are not documented in the structured source. "
                "No ancillary marker or special stain findings are documented."
            ),
            (
                "DIAGNOSIS\n"
                f"Pancreatic ductal adenocarcinoma, {ctx.tumor_location}. Clinical subgroup "
                f"from structured data: {ctx.subgroup}. Associated structured molecular "
                f"profile: {molecular_profile}."
            ),
            (
                "PATHOLOGIC STAGING\n"
                "Pathologic TNM stage, margin status, and lymph node stage are not documented "
                "in the structured source. Clinical stage/subgroup from structured data is "
                f"{ctx.subgroup}. No pathologic staging values are inferred."
            ),
        ]
    )


def _format_list(values: list[str], fallback: str = "not documented") -> str:
    return ", ".join(values) if values else fallback


def _format_labs(values: list[str], max_items: int = 12) -> str:
    if not values:
        return "not documented"
    selected = values[:max_items]
    suffix = "" if len(values) <= max_items else f"; additional labs documented: {len(values) - max_items}"
    return "; ".join(selected) + suffix


def _format_genomics(values: dict[str, str]) -> str:
    if not values:
        return "not documented"
    return ", ".join(f"{gene}: {variant}" for gene, variant in values.items())


def build_consultation_note(ctx: PatientContext) -> str:
    """Build a source-faithful oncology consultation note."""
    return "\n\n".join(
        [
            "CHIEF COMPLAINT\nPancreatic ductal adenocarcinoma.",
            (
                "HISTORY OF PRESENT ILLNESS\n"
                f"{ctx.age}-year-old {ctx.sex.lower()} with pancreatic ductal adenocarcinoma "
                f"in the {ctx.tumor_location}. Structured diagnosis date is "
                f"{ctx.diagnosis_date.isoformat()}, and clinical subgroup is {ctx.subgroup}. "
                "Presenting symptoms and disease tempo beyond the structured condition list "
                "are not documented."
            ),
            f"PAST MEDICAL HISTORY\n{_format_list(ctx.comorbidities)}.",
            f"MEDICATIONS\n{_format_list(ctx.medications)}.",
            "REVIEW OF SYSTEMS\nNot documented in the structured source.",
            "PHYSICAL EXAMINATION\nNot documented in the structured source.",
            f"LABORATORY REVIEW\n{_format_labs(ctx.labs)}.",
            f"MOLECULAR PROFILE\n{_format_genomics(ctx.genomics)}.",
            (
                "ASSESSMENT AND PLAN\n"
                f"Pancreatic ductal adenocarcinoma, {ctx.tumor_location}, clinical subgroup "
                f"{ctx.subgroup}. Continue oncology evaluation using documented systemic "
                "therapy, laboratory trends, procedure history, and molecular profile. "
                "Specific treatment intent, cycle number, and performance status are not "
                "documented in the structured source."
            ),
        ]
    )


def build_progress_note(ctx: PatientContext) -> str:
    """Build a source-faithful chemotherapy progress note."""
    return "\n\n".join(
        [
            (
                "INTERVAL HISTORY\n"
                f"{ctx.age}-year-old {ctx.sex.lower()} with pancreatic ductal adenocarcinoma "
                f"in the {ctx.tumor_location}. Diagnosis date is {ctx.diagnosis_date.isoformat()}, "
                f"and clinical subgroup is {ctx.subgroup}. Interval symptoms, performance "
                "status, and treatment response are not documented in the structured source."
            ),
            (
                "CURRENT REGIMEN AND CYCLE\n"
                f"Documented antineoplastic and supportive medications: {_format_list(ctx.medications)}. "
                "Cycle number, day in cycle, dose modifications, and treatment intent are not documented "
                "in the structured source."
            ),
            "TOXICITIES\nTreatment-related toxicity grade and attribution are not documented in the structured source.",
            f"LABORATORY REVIEW\n{_format_labs(ctx.labs, max_items=18)}.",
            "PHYSICAL EXAMINATION\nNot documented in the structured source.",
            f"MOLECULAR PROFILE\n{_format_genomics(ctx.genomics)}.",
            (
                "ASSESSMENT AND PLAN\n"
                f"Pancreatic ductal adenocarcinoma, {ctx.tumor_location}, clinical subgroup "
                f"{ctx.subgroup}. Continue structured-data review of documented therapy, "
                "laboratory findings, and procedures. Additional clinical decisions are not "
                "inferred when absent from the source."
            ),
        ]
    )


def build_operative_note(ctx: PatientContext) -> str:
    """Build a source-faithful operative note."""
    procedure_text = _format_list(ctx.procedures)
    return "\n\n".join(
        [
            f"PREOPERATIVE DIAGNOSIS\nPancreatic ductal adenocarcinoma, {ctx.tumor_location}.",
            f"POSTOPERATIVE DIAGNOSIS\nPancreatic ductal adenocarcinoma, {ctx.tumor_location}.",
            f"PROCEDURE PERFORMED\n{procedure_text}.",
            "SURGEON\nNot documented.",
            "ANESTHESIA\nNot documented.",
            "FINDINGS\nNo structured intraoperative finding narrative is available.",
            "TECHNIQUE\nDetailed operative technique is unavailable in the structured extract.",
            "ESTIMATED BLOOD LOSS\nUnavailable.",
            f"SPECIMENS\nPancreatic specimen associated with documented procedures: {procedure_text}.",
            "COMPLICATIONS\nUnavailable.",
            "DISPOSITION\nUnavailable.",
        ]
    )


def build_template_note(ctx: PatientContext, note_key: str) -> Optional[str]:
    if note_key == "consultation":
        return build_consultation_note(ctx)
    if note_key == "pathology":
        return build_pathology_note(ctx)
    if note_key == "operative":
        return build_operative_note(ctx)
    if note_key == "progress":
        return build_progress_note(ctx)
    return None


# ── MedGemma integration ──────────────────────────────────────────────────


def _clean_note_text(text: str) -> str:
    """Remove common small-model formatting artifacts without changing content."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    cleaned = cleaned.replace("```pathology", "").replace("```", "").strip()
    cleaned = PLACEHOLDER_RE.sub("not documented", cleaned)
    cleaned = re.sub(r"\s+\((?:Assum(?:e|ing)|e\.g\.)[^)]*\)", "", cleaned, flags=re.IGNORECASE)

    lines: list[str] = []
    for line in cleaned.splitlines():
        if IDENTIFIER_LINE_RE.match(line):
            continue
        lines.append(line.rstrip())
    return "\n".join(lines).strip()


def _note_quality_issues(text: str, note_key: str) -> list[str]:
    issues: list[str] = []
    if "```" in text:
        issues.append("contains Markdown code fence")
    if PLACEHOLDER_RE.search(text):
        issues.append("contains placeholder bracket text")
    if re.search(r"\bas an ai\b|\blanguage model\b", text, re.IGNORECASE):
        issues.append("contains model disclaimer")
    if note_key == "pathology" and PATHOLOGY_UNSUPPORTED_DETAIL_RE.search(text):
        issues.append("contains unsupported immunohistochemistry/stain detail")
    if note_key == "pathology" and PATHOLOGY_UNSUPPORTED_GROSS_DETAIL_RE.search(text):
        issues.append("contains unsupported pathology gross, margin, staging, or invasion detail")
    if note_key in {"consultation", "progress"} and UNSUPPORTED_CLINICAL_DETAIL_RE.search(text):
        issues.append("contains unsupported vital sign, exam, cycle, or toxicity detail")
    repeated_fragments = _repeated_fragments(text)
    if repeated_fragments:
        issues.append(f"contains repeated text: {', '.join(repeated_fragments[:2])}")
    return issues


def _repeated_fragments(text: str) -> list[str]:
    fragments = re.split(r"[\n.;]+", text)
    counts: dict[str, int] = {}
    for fragment in fragments:
        normalized = re.sub(r"\s+", " ", fragment).strip().lower()
        if len(normalized) < 28:
            continue
        counts[normalized] = counts.get(normalized, 0) + 1
    return [fragment for fragment, count in counts.items() if count >= 3]


def _write_rejected_note_debug(
    text: str,
    note_key: str,
    reason: str,
    person_id: Optional[int] = None,
) -> None:
    """Persist rejected LLM output when PANCREAS_NOTE_REJECTED_DIR is set."""
    if not REJECTED_NOTES_DIR:
        return
    try:
        os.makedirs(REJECTED_NOTES_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        person_fragment = f"person-{person_id}" if person_id is not None else "person-unknown"
        safe_reason = re.sub(r"[^a-zA-Z0-9_.-]+", "-", reason).strip("-")[:80]
        path = os.path.join(
            REJECTED_NOTES_DIR,
            f"{timestamp}-{person_fragment}-{note_key}-{safe_reason}.txt",
        )
        with open(path, "w", encoding="utf-8") as out:
            out.write(f"model: {MODEL_NAME}\n")
            out.write(f"note_key: {note_key}\n")
            out.write(f"person_id: {person_id if person_id is not None else 'not documented'}\n")
            out.write(f"reason: {reason}\n")
            out.write(f"word_count: {len(text.split())}\n")
            out.write("\n--- note text ---\n")
            out.write(text)
            out.write("\n")
        log.info("Rejected note debug written to %s", path)
    except OSError as e:
        log.warning("Could not write rejected note debug output: %s", e)


def generate_note_text(
    system_prompt: str,
    patient_data: str,
    note_key: str,
    person_id: Optional[int] = None,
    retry: bool = True,
    quality_hint: str = "",
) -> Optional[str]:
    """Generate a clinical note via MedGemma through Ollama."""
    guardrails = GENERAL_NOTE_GUARDRAILS
    if note_key == "pathology":
        guardrails += PATHOLOGY_GUARDRAILS
    prompt = (
        f"{system_prompt}\n\nAdditional constraints:\n{guardrails}\n\n"
        f"Patient Data:\n{patient_data}\n\n"
    )
    if quality_hint:
        prompt += f"Quality repair instruction: {quality_hint}\n\n"
    prompt += "Write the clinical note now:"

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": OLLAMA_TEMPERATURE,
                    "num_ctx": OLLAMA_NUM_CTX,
                    "num_gpu": OLLAMA_NUM_GPU,
                    "num_predict": OLLAMA_NUM_PREDICT,
                    "repeat_penalty": OLLAMA_REPEAT_PENALTY,
                },
            },
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        text = _clean_note_text(resp.json().get("response", "").strip())

        # Check minimum word count
        min_words = MIN_WORDS_BY_NOTE_KEY.get(note_key, MIN_WORD_COUNT)
        if len(text.split()) < min_words:
            reason = f"too_short_{len(text.split())}_of_{min_words}"
            _write_rejected_note_debug(text, note_key, reason, person_id)
            if retry:
                log.warning(
                    "Note too short (%d words), retrying...", len(text.split())
                )
                return generate_note_text(
                    system_prompt,
                    patient_data,
                    note_key,
                    person_id=person_id,
                    retry=False,
                    quality_hint=(
                        f"The previous {note_key} note was too short. Write a complete "
                        f"note with at least {min_words} words while staying concise."
                    ),
                )
            log.warning("Note still too short after retry (%d words), skipping", len(text.split()))
            return None

        quality_issues = _note_quality_issues(text, note_key)
        if quality_issues:
            reason = "quality_" + "_".join(re.sub(r"[^a-zA-Z0-9]+", "-", issue) for issue in quality_issues)
            _write_rejected_note_debug(text, note_key, reason, person_id)
            if retry:
                log.warning("Note quality issues (%s), retrying...", "; ".join(quality_issues))
                return generate_note_text(
                    system_prompt,
                    patient_data,
                    note_key,
                    person_id=person_id,
                    retry=False,
                    quality_hint=(
                        "The previous output was rejected because it "
                        f"{'; '.join(quality_issues)}. Regenerate without those defects."
                    ),
                )
            log.warning("Note still has quality issues after retry: %s", "; ".join(quality_issues))
            return None

        return text

    except requests.exceptions.RequestException as e:
        log.error("MedGemma request failed: %s", e)
        return None
    except (KeyError, ValueError) as e:
        log.error("MedGemma response parse error: %s", e)
        return None


# ── Note insertion ─────────────────────────────────────────────────────────


def get_existing_notes(cur: psycopg2.extensions.cursor) -> set[ExistingNoteKey]:
    """Get generated-note keys already present in the CDM.

    Consultation and progress notes both use the outpatient note class, so the
    note key must include type and title as well as class.
    """
    cur.execute(
        """
        SELECT person_id, note_type_concept_id, note_class_concept_id, note_title
        FROM pancreas.note
        WHERE note_source_value = %s
        """,
        (NOTE_SOURCE_VALUE,),
    )
    return {(r[0], r[1], r[2], r[3]) for r in cur.fetchall()}


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
    global COMMIT_INTERVAL, MODEL_NAME, OLLAMA_NUM_CTX, OLLAMA_NUM_GPU, OLLAMA_NUM_PREDICT, OLLAMA_TIMEOUT_SECONDS

    parser = argparse.ArgumentParser(
        description="Generate clinical notes for pancreatic cancer patients using MedGemma."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete all existing generated notes and regenerate from scratch.",
    )
    parser.add_argument(
        "--force-note-types",
        default=None,
        help=(
            "Comma-separated generated note type keys to delete before regenerating; "
            "useful for a pathology-only 27B refresh."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Generate notes for at most this many patients; useful for smoke tests.",
    )
    parser.add_argument(
        "--patient-id",
        type=int,
        default=None,
        help="Generate notes for one patient only.",
    )
    parser.add_argument(
        "--model",
        default=MODEL_NAME,
        help="Ollama model name to use for note generation.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=OLLAMA_TIMEOUT_SECONDS,
        help="Read timeout for each Ollama note generation request.",
    )
    parser.add_argument(
        "--num-predict",
        type=int,
        default=OLLAMA_NUM_PREDICT,
        help="Ollama num_predict value for each generated note.",
    )
    parser.add_argument(
        "--num-ctx",
        type=int,
        default=OLLAMA_NUM_CTX,
        help="Ollama num_ctx value; keep modest for better 27B GPU residency.",
    )
    parser.add_argument(
        "--num-gpu",
        type=int,
        default=OLLAMA_NUM_GPU,
        help="Ollama num_gpu value; high values ask Ollama to place all layers on GPU.",
    )
    parser.add_argument(
        "--commit-interval",
        type=int,
        default=COMMIT_INTERVAL,
        help="Commit after this many inserted notes.",
    )
    parser.add_argument(
        "--note-types",
        default=None,
        help="Comma-separated note type keys to generate, e.g. consultation,progress.",
    )
    parser.add_argument(
        "--template-note-types",
        default=DEFAULT_TEMPLATE_NOTE_TYPES,
        help=(
            "Comma-separated note type keys to build from structured templates instead "
            "of LLM generation. Defaults to all note types for source-faithful output."
        ),
    )
    args = parser.parse_args()
    MODEL_NAME = args.model
    OLLAMA_TIMEOUT_SECONDS = args.timeout_seconds
    OLLAMA_NUM_PREDICT = args.num_predict
    OLLAMA_NUM_CTX = args.num_ctx
    OLLAMA_NUM_GPU = args.num_gpu
    COMMIT_INTERVAL = args.commit_interval
    valid_note_types = {nt.key for nt in NOTE_TYPES}

    force_note_types: set[str] = set()
    if args.force_note_types:
        force_note_types = {key.strip() for key in args.force_note_types.split(",") if key.strip()}
        invalid_force_note_types = sorted(force_note_types - valid_note_types)
        if invalid_force_note_types:
            log.error("Invalid force note type(s): %s", ", ".join(invalid_force_note_types))
            sys.exit(1)

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
    elif force_note_types:
        force_note_titles = [nt.title for nt in NOTE_TYPES if nt.key in force_note_types]
        log.info(
            "--force-note-types: deleting generated %s notes...",
            ", ".join(sorted(force_note_types)),
        )
        cur.execute(
            """
            DELETE FROM pancreas.note
            WHERE note_source_value = %s
              AND note_title = ANY(%s)
            """,
            (NOTE_SOURCE_VALUE, force_note_titles),
        )
        deleted = cur.rowcount
        conn.commit()
        log.info("Deleted %d existing notes for selected note type(s).", deleted)

    # Get existing notes for resume support
    existing = get_existing_notes(cur)
    log.info("Found %d existing generated note entries.", len(existing))

    # Get all patients
    patient_ids = get_all_patients(cur)
    if args.patient_id is not None:
        patient_ids = [pid for pid in patient_ids if pid == args.patient_id]
        if not patient_ids:
            log.error("Patient %d was not found in pancreas.person.", args.patient_id)
            sys.exit(1)
    if args.limit is not None:
        patient_ids = patient_ids[:args.limit]
    allowed_note_types: Optional[set[str]] = None
    if args.note_types:
        allowed_note_types = {key.strip() for key in args.note_types.split(",") if key.strip()}
        invalid_note_types = sorted(allowed_note_types - valid_note_types)
        if invalid_note_types:
            log.error("Invalid note type(s): %s", ", ".join(invalid_note_types))
            sys.exit(1)
    template_note_types = {key.strip() for key in args.template_note_types.split(",") if key.strip()}
    invalid_template_note_types = sorted(template_note_types - valid_note_types)
    if invalid_template_note_types:
        log.error("Invalid template note type(s): %s", ", ".join(invalid_template_note_types))
        sys.exit(1)
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
            if allowed_note_types is not None and nt.key not in allowed_note_types:
                continue

            # Skip operative notes for non-surgical patients
            if nt.surgical_only and not is_surgical:
                continue

            # Skip if already exists (resume support)
            existing_key = (
                person_id,
                nt.note_type_concept_id,
                nt.note_class_concept_id,
                nt.title,
            )
            if existing_key in existing:
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
            if nt.key in template_note_types:
                text = build_pathology_note(ctx)
                if nt.key != "pathology":
                    text = build_template_note(ctx, nt.key)
                quality_issues = _note_quality_issues(text, nt.key)
                if quality_issues:
                    log.warning(
                        "Template quality issues for person %d %s: %s",
                        person_id,
                        nt.key,
                        "; ".join(quality_issues),
                    )
                    text = None
            else:
                text = generate_note_text(nt.system_prompt, patient_data, nt.key, person_id=person_id)
                if text is None:
                    fallback_text = build_template_note(ctx, nt.key)
                    if fallback_text is not None:
                        fallback_issues = _note_quality_issues(fallback_text, nt.key)
                        if fallback_issues:
                            log.warning(
                                "Template fallback quality issues for person %d %s: %s",
                                person_id,
                                nt.key,
                                "; ".join(fallback_issues),
                            )
                        else:
                            log.info("  person=%d %s: using structured template fallback", person_id, nt.key)
                            text = fallback_text
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
            existing.add(existing_key)
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
