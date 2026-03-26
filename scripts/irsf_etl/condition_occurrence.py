"""Condition occurrence extraction for the IRSF ETL pipeline.

Extracts condition records from four IRSF-NHS 5211 tables:
  - Chronic_Diagnoses_5211: chronic medical diagnoses with pre-mapped SNOMED
  - seizures_5211: seizure types with hardcoded SNOMED mapping
  - Bone_Fracture_5211: fracture locations with hardcoded SNOMED mapping
  - Infections_5211: infections with pre-mapped SNOMED

Produces staging/condition_occurrence.csv following OMOP CDM v5.4.

Exports:
    extract_conditions: Main orchestrator producing condition_occurrence.csv.
    validate_condition_concepts: Validate/remap SNOMED concept_ids via VocabularyValidator.
    validate_hardcoded_mappings: Validate hardcoded seizure/fracture SNOMED concept_ids.
    extract_chronic_diagnoses: Extract from Chronic_Diagnoses_5211.
    extract_seizures: Extract from seizures_5211.
    extract_bone_fractures: Extract from Bone_Fracture_5211.
    extract_infections: Extract from Infections_5211.
    parse_snomed_output: Parse SNOMED code from formatted SNOWMEDOutput string.
"""

from __future__ import annotations

import csv
import logging
import re
from typing import TYPE_CHECKING, Optional

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.schemas.condition_occurrence import (
    condition_occurrence_schema,
)

if TYPE_CHECKING:
    from scripts.irsf_etl.lib.vocab_validator import (
        ConceptValidationResult,
        VocabularyValidator,
    )

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CONDITION_TYPE_REGISTRY = 32879  # OMOP: Registry data type

# Regex for SNOWMEDOutput / InfectionSNOMEDOutput formatted strings
# Pattern: "Name (domain) code:NNNNNNN confidence [SNOMED CT]"
_SNOMED_PATTERN = re.compile(r"code:(\d+)\s+[\d.]+\s+\[SNOMED CT\]")

# Intermediate DataFrame columns produced by each extractor
_INTERMEDIATE_COLS = [
    "person_id",
    "condition_concept_id",
    "condition_start_date",
    "condition_end_date",
    "condition_source_value",
    "condition_source_concept_id",
    "condition_status_concept_id",
    "stop_reason",
    "visit_occurrence_id",
    "source_file",
]

# ---------------------------------------------------------------------------
# Seizure type -> SNOMED mapping
# ---------------------------------------------------------------------------

_SEIZURE_SNOMED_MAP: dict[str, int] = {
    "Generalized seizure": 246545002,
    "Complex partial seizure": 4011560,
    "Tonic-clonic seizure": 54200006,
    "Partial seizure": 29753000,
    "Infantile spasm": 230418005,
    "Atonic seizure": 230421003,
    "Myoclonic seizure": 91175000,
    "Absence seizure": 230415008,
    "Rett spell": 0,  # No standard SNOMED concept
}
# "Not a seizure" rows are EXCLUDED entirely
_SEIZURE_EXCLUDE = {"Not a seizure"}

# ---------------------------------------------------------------------------
# Bone fracture location -> SNOMED mapping
# ---------------------------------------------------------------------------

_FRACTURE_SNOMED_MAP: dict[str, int] = {
    "upper leg (femur)": 71620000,
    "foot/toes": 46866001,
    "lower leg - front/inside (tibia)": 31978002,
    "upper arm (humerus)": 65966004,
    "shoulder/clavicle": 58150001,
    "ankle": 16114001,
    "wrist or hand": 263165007,
    "lower arm - thumb side (radius)": 3163003,
    "lower leg - back/outside (fibula)": 83851003,
    "hip": 5913000,
    "finger(s)": 65455003,
    "lower arm - pinky side (ulna)": 37449000,
    "rib(s)": 33737001,
    "spine/neck": 446847008,
    "other": 125605004,
}


# ---------------------------------------------------------------------------
# SNOMED output parser
# ---------------------------------------------------------------------------


def parse_snomed_output(snomed_str: str | None) -> int | None:
    """Extract SNOMED concept code from formatted SNOWMEDOutput string.

    Input format: "Name (domain) code:NNNNNNN confidence [SNOMED CT]"
    Returns the integer code, or None if not parseable.

    Args:
        snomed_str: The formatted SNOMED output string, or None.

    Returns:
        Integer SNOMED code, or None if input is None, empty, or malformed.
    """
    if snomed_str is None:
        return None
    if not isinstance(snomed_str, str) or not snomed_str.strip():
        return None
    match = _SNOMED_PATTERN.search(snomed_str)
    if match:
        return int(match.group(1))
    return None


# ---------------------------------------------------------------------------
# Helper: resolve participant to person_id
# ---------------------------------------------------------------------------


def _resolve_person_id(
    row: pd.Series,
    idx: int,
    registry: PersonIdRegistry,
    log: RejectionLog,
    source_file: str,
) -> int | None:
    """Resolve participant_id to person_id via registry.

    Returns person_id or None (and logs rejection) if unresolvable.
    """
    raw_pid = row.get("participant_id")
    if raw_pid is None or pd.isna(raw_pid):
        log.log(
            idx,
            "participant_id",
            str(raw_pid),
            RejectionCategory.MISSING_REQUIRED,
            f"Missing participant_id in {source_file}",
        )
        return None

    # Convert to int for registry lookup (CSV may read as str or float)
    try:
        pid_int = int(float(str(raw_pid)))
    except (ValueError, OverflowError):
        log.log(
            idx,
            "participant_id",
            str(raw_pid),
            RejectionCategory.INVALID_VALUE,
            f"Non-numeric participant_id '{raw_pid}' in {source_file}",
        )
        return None

    person_id = registry.resolve(pid_int)
    if person_id is None:
        log.log(
            idx,
            "participant_id",
            str(raw_pid),
            RejectionCategory.MISSING_REQUIRED,
            f"Cannot resolve participant_id {pid_int} in {source_file}",
        )
        return None
    return person_id


# ---------------------------------------------------------------------------
# Helper: resolve visit
# ---------------------------------------------------------------------------


def _resolve_visit(
    person_id: int,
    row: pd.Series,
    visit_resolver: VisitResolver,
) -> Optional[int]:
    """Resolve visit_occurrence_id from visit_date and visit label."""
    visit_date = row.get("visit_date")
    if visit_date is None or pd.isna(visit_date):
        return None
    visit_date_str = str(visit_date).strip()
    if not visit_date_str:
        return None

    # Try to get visit label from either column name variant
    visit_label = row.get("VisitTimePoint") or row.get("VisitTimePoint_Entry_Reported")
    if visit_label is not None and pd.isna(visit_label):
        visit_label = None
    if visit_label is not None:
        visit_label = str(visit_label).strip() or None

    return visit_resolver.resolve(person_id, visit_date_str, visit_label)


# ---------------------------------------------------------------------------
# Helper: get visit_date as fallback date string
# ---------------------------------------------------------------------------


def _visit_date_as_iso(row: pd.Series) -> str | None:
    """Extract visit_date from row and return as ISO string if valid.

    Source visit_date is in MM/DD/YY or MM/DD/YYYY format. Converts to
    YYYY-MM-DD ISO format. Two-digit years use pivot: 00-49 -> 2000-2049,
    50-99 -> 1950-1999.
    """
    visit_date = row.get("visit_date")
    if visit_date is None or pd.isna(visit_date):
        return None
    vd = str(visit_date).strip()
    if not vd:
        return None
    from datetime import date as date_cls

    # Try ISO format first (YYYY-MM-DD)
    if len(vd) == 10 and vd[4] == "-" and vd[7] == "-":
        try:
            date_cls.fromisoformat(vd)
            return vd
        except ValueError:
            pass
    # Try MM/DD/YY or MM/DD/YYYY format
    try:
        parts = vd.split("/")
        if len(parts) != 3:
            return None
        month, day, year_str = int(parts[0]), int(parts[1]), parts[2]
        year = int(year_str)
        if year < 100:
            year = year + 2000 if year < 50 else year + 1900
        return date_cls(year, month, day).isoformat()
    except (ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# Extractor: Chronic Diagnoses
# ---------------------------------------------------------------------------


def extract_chronic_diagnoses(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Extract conditions from Chronic_Diagnoses_5211.csv.

    Parses pre-mapped SNOMED codes from SNOWMEDOutput column.
    Skips rows with NotAssessed flag. Falls back to visit_date when
    condition start date is unknown.

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        visit_resolver: Visit resolver for visit_occurrence_id lookup.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with intermediate condition columns.
    """
    source_file = "Chronic_Diagnoses_5211.csv"
    csv_path = config.source_custom_extracts / "csv" / source_file
    df = read_csv_safe(csv_path)
    log.set_processed_count(log._processed_count + len(df))

    rows: list[dict] = []
    for idx, row in df.iterrows():
        idx_int = int(idx)

        # Skip NotAssessed rows
        not_assessed = row.get("NotAssessed")
        if not_assessed is not None and not pd.isna(not_assessed) and str(not_assessed).strip():
            continue

        # Resolve person_id
        person_id = _resolve_person_id(row, idx_int, registry, log, source_file)
        if person_id is None:
            continue

        # Parse SNOMED from SNOWMEDOutput
        snomed_output = row.get("SNOWMEDOutput")
        if snomed_output is not None and pd.isna(snomed_output):
            snomed_output = None
        raw_snomed = parse_snomed_output(
            str(snomed_output) if snomed_output is not None else None
        )

        # Assemble condition start date
        start_date = assemble_date(
            row.get("DateMonthStarted"),
            row.get("DateDayStarted"),
            row.get("DateYearStarted"),
            max_year=2026,
        )

        # Fallback to visit_date if start date unknown
        start_date_str: str | None = None
        if start_date is not None:
            start_date_str = start_date.isoformat()
        else:
            # Check datestartedunknown flag or just fallback
            start_date_str = _visit_date_as_iso(row)

        if start_date_str is None:
            log.log(
                idx_int,
                "condition_start_date",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                f"No start date and no visit_date fallback in {source_file}",
            )
            continue

        # Assemble condition end date
        end_date = assemble_date(
            row.get("DateMonthResolved"),
            row.get("DateDayResolved"),
            row.get("DateYearResolved"),
            max_year=2026,
        )
        end_date_str = end_date.isoformat() if end_date is not None else None

        # Resolve visit
        visit_occ_id = _resolve_visit(person_id, row, visit_resolver)

        # Source value
        diagnosis_text = row.get("ChronicMedicalDiagnosis")
        if diagnosis_text is None or pd.isna(diagnosis_text):
            diagnosis_text = ""
        source_value = str(diagnosis_text).strip()

        concept_id = raw_snomed if raw_snomed is not None else 0
        source_concept_id = raw_snomed if raw_snomed is not None else 0

        rows.append({
            "person_id": person_id,
            "condition_concept_id": concept_id,
            "condition_start_date": start_date_str,
            "condition_end_date": end_date_str,
            "condition_source_value": source_value,
            "condition_source_concept_id": source_concept_id,
            "condition_status_concept_id": 0,
            "stop_reason": None,
            "visit_occurrence_id": visit_occ_id,
            "source_file": source_file,
        })

    logger.info(
        "Chronic diagnoses: %d rows extracted from %d source rows",
        len(rows),
        len(df),
    )
    return pd.DataFrame(rows, columns=_INTERMEDIATE_COLS)


# ---------------------------------------------------------------------------
# Extractor: Seizures
# ---------------------------------------------------------------------------


def extract_seizures(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Extract conditions from seizures_5211.csv.

    Maps InvestigImpress seizure types to SNOMED concept_ids via hardcoded
    lookup. Excludes 'Not a seizure' rows entirely. Falls back to visit_date
    when condition start date is unknown.

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        visit_resolver: Visit resolver for visit_occurrence_id lookup.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with intermediate condition columns.
    """
    source_file = "seizures_5211.csv"
    csv_path = config.source_custom_extracts / "csv" / source_file
    df = read_csv_safe(csv_path)
    log.set_processed_count(log._processed_count + len(df))

    rows: list[dict] = []
    excluded_count = 0
    for idx, row in df.iterrows():
        idx_int = int(idx)

        # Get seizure type
        investig_impress = row.get("InvestigImpress")
        if investig_impress is not None and pd.isna(investig_impress):
            investig_impress = None
        seizure_type = str(investig_impress).strip() if investig_impress is not None else ""

        # Exclude "Not a seizure"
        if seizure_type in _SEIZURE_EXCLUDE:
            excluded_count += 1
            continue

        # Resolve person_id
        person_id = _resolve_person_id(row, idx_int, registry, log, source_file)
        if person_id is None:
            continue

        # Look up SNOMED concept_id
        concept_id = _SEIZURE_SNOMED_MAP.get(seizure_type, 0)

        # Assemble condition start date
        start_date = assemble_date(
            row.get("DateStartedMonth"),
            row.get("DateStartedDay"),
            row.get("DateStartedYear"),
            max_year=2026,
        )

        start_date_str: str | None = None
        if start_date is not None:
            start_date_str = start_date.isoformat()
        else:
            # Check DateStartedUnknown or fallback
            start_date_str = _visit_date_as_iso(row)

        if start_date_str is None:
            log.log(
                idx_int,
                "condition_start_date",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                f"No start date and no visit_date fallback in {source_file}",
            )
            continue

        # Assemble condition end date
        end_date = assemble_date(
            row.get("DateStoppedMonth"),
            row.get("DateStoppedDay"),
            row.get("DateStoppedYear"),
            max_year=2026,
        )
        end_date_str = end_date.isoformat() if end_date is not None else None

        # Resolve visit
        visit_occ_id = _resolve_visit(person_id, row, visit_resolver)

        rows.append({
            "person_id": person_id,
            "condition_concept_id": concept_id,
            "condition_start_date": start_date_str,
            "condition_end_date": end_date_str,
            "condition_source_value": seizure_type,
            "condition_source_concept_id": concept_id,
            "condition_status_concept_id": 0,
            "stop_reason": None,
            "visit_occurrence_id": visit_occ_id,
            "source_file": source_file,
        })

    logger.info(
        "Seizures: %d rows extracted, %d 'Not a seizure' excluded from %d source rows",
        len(rows),
        excluded_count,
        len(df),
    )
    return pd.DataFrame(rows, columns=_INTERMEDIATE_COLS)


# ---------------------------------------------------------------------------
# Extractor: Bone Fractures
# ---------------------------------------------------------------------------


def extract_bone_fractures(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Extract conditions from Bone_Fracture_5211.csv.

    Maps FractureLocation to SNOMED concept_ids via hardcoded lookup.
    Appends OtherFractureLocation detail for 'other' locations.
    No end date for fractures (point-in-time events).

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        visit_resolver: Visit resolver for visit_occurrence_id lookup.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with intermediate condition columns.
    """
    source_file = "Bone_Fracture_5211.csv"
    csv_path = config.source_custom_extracts / "csv" / source_file
    df = read_csv_safe(csv_path)
    log.set_processed_count(log._processed_count + len(df))

    rows: list[dict] = []
    for idx, row in df.iterrows():
        idx_int = int(idx)

        # Resolve person_id
        person_id = _resolve_person_id(row, idx_int, registry, log, source_file)
        if person_id is None:
            continue

        # Get fracture location and SNOMED mapping
        fracture_loc = row.get("FractureLocation")
        if fracture_loc is not None and pd.isna(fracture_loc):
            fracture_loc = None
        loc_str = str(fracture_loc).strip() if fracture_loc is not None else ""

        concept_id = _FRACTURE_SNOMED_MAP.get(loc_str, 0)

        # Build condition_source_value with "other" detail
        source_value = loc_str
        if loc_str.lower() == "other":
            other_detail = row.get("OtherFractureLocation")
            if other_detail is not None and not pd.isna(other_detail):
                detail_str = str(other_detail).strip()
                if detail_str:
                    source_value = f"other: {detail_str}"

        # Assemble condition start date
        start_date = assemble_date(
            row.get("FracturesDateMonth"),
            row.get("FracturesDateDay"),
            row.get("FracturesDateYear"),
            max_year=2026,
        )

        start_date_str: str | None = None
        if start_date is not None:
            start_date_str = start_date.isoformat()
        else:
            # Check FractureDateUnknown or fallback
            start_date_str = _visit_date_as_iso(row)

        if start_date_str is None:
            log.log(
                idx_int,
                "condition_start_date",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                f"No start date and no visit_date fallback in {source_file}",
            )
            continue

        # Resolve visit
        visit_occ_id = _resolve_visit(person_id, row, visit_resolver)

        rows.append({
            "person_id": person_id,
            "condition_concept_id": concept_id,
            "condition_start_date": start_date_str,
            "condition_end_date": None,  # Fractures have no end date
            "condition_source_value": source_value,
            "condition_source_concept_id": concept_id,
            "condition_status_concept_id": 0,
            "stop_reason": None,
            "visit_occurrence_id": visit_occ_id,
            "source_file": source_file,
        })

    logger.info(
        "Bone fractures: %d rows extracted from %d source rows",
        len(rows),
        len(df),
    )
    return pd.DataFrame(rows, columns=_INTERMEDIATE_COLS)


# ---------------------------------------------------------------------------
# Extractor: Infections
# ---------------------------------------------------------------------------


def extract_infections(
    config: ETLConfig,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Extract conditions from Infections_5211.csv.

    Parses pre-mapped SNOMED codes from InfectionSNOMEDOutput column.
    Uses Resolved column as stop_reason metadata. No explicit end date.

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        visit_resolver: Visit resolver for visit_occurrence_id lookup.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with intermediate condition columns.
    """
    source_file = "Infections_5211.csv"
    csv_path = config.source_custom_extracts / "csv" / source_file
    df = read_csv_safe(csv_path)
    log.set_processed_count(log._processed_count + len(df))

    rows: list[dict] = []
    for idx, row in df.iterrows():
        idx_int = int(idx)

        # Resolve person_id
        person_id = _resolve_person_id(row, idx_int, registry, log, source_file)
        if person_id is None:
            continue

        # Parse SNOMED from InfectionSNOMEDOutput
        snomed_output = row.get("InfectionSNOMEDOutput")
        if snomed_output is not None and pd.isna(snomed_output):
            snomed_output = None
        raw_snomed = parse_snomed_output(
            str(snomed_output) if snomed_output is not None else None
        )

        concept_id = raw_snomed if raw_snomed is not None else 0
        source_concept_id = raw_snomed if raw_snomed is not None else 0

        # Assemble condition start date
        start_date = assemble_date(
            row.get("InfectionDateMM"),
            row.get("InfectionDateDD"),
            row.get("InfectionDateYY"),
            max_year=2026,
        )

        start_date_str: str | None = None
        if start_date is not None:
            start_date_str = start_date.isoformat()
        else:
            # Check DateOfInfectionUnknown or fallback
            start_date_str = _visit_date_as_iso(row)

        if start_date_str is None:
            log.log(
                idx_int,
                "condition_start_date",
                "",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                f"No start date and no visit_date fallback in {source_file}",
            )
            continue

        # Build condition_source_value: InfectionType + ": " + InfectionSNOMEDInput
        infection_type = row.get("InfectionType")
        if infection_type is not None and pd.isna(infection_type):
            infection_type = None
        type_str = str(infection_type).strip() if infection_type is not None else ""

        snomed_input = row.get("InfectionSNOMEDInput")
        if snomed_input is not None and pd.isna(snomed_input):
            snomed_input = None
        input_str = str(snomed_input).strip() if snomed_input is not None else ""

        if type_str and input_str:
            source_value = f"{type_str}: {input_str}"
        elif type_str:
            source_value = type_str
        else:
            source_value = input_str or ""

        # Resolved as stop_reason
        resolved = row.get("Resolved")
        if resolved is not None and pd.isna(resolved):
            resolved = None
        stop_reason = str(resolved).strip() if resolved is not None else None
        if stop_reason == "":
            stop_reason = None

        # Resolve visit
        visit_occ_id = _resolve_visit(person_id, row, visit_resolver)

        rows.append({
            "person_id": person_id,
            "condition_concept_id": concept_id,
            "condition_start_date": start_date_str,
            "condition_end_date": None,  # No explicit end date for infections
            "condition_source_value": source_value,
            "condition_source_concept_id": source_concept_id,
            "condition_status_concept_id": 0,
            "stop_reason": stop_reason,
            "visit_occurrence_id": visit_occ_id,
            "source_file": source_file,
        })

    logger.info(
        "Infections: %d rows extracted from %d source rows",
        len(rows),
        len(df),
    )
    return pd.DataFrame(rows, columns=_INTERMEDIATE_COLS)


# ---------------------------------------------------------------------------
# SNOMED vocabulary validation
# ---------------------------------------------------------------------------


def validate_condition_concepts(
    df: pd.DataFrame,
    validator: VocabularyValidator,
    log: RejectionLog,
) -> pd.DataFrame:
    """Validate and remap condition SNOMED concept_ids.

    1. Collect all unique non-zero concept_ids from the DataFrame
    2. Batch-validate via VocabularyValidator.validate_batch()
    3. For each row:
       - Standard -> keep as-is
       - Deprecated_Remapped -> use resolved_id as condition_concept_id
       - Deprecated_No_Replacement -> set condition_concept_id=0, log warning
       - Not_Found -> set condition_concept_id=0, log warning
    4. condition_source_concept_id retains the original pre-validation code

    Returns new DataFrame (immutable pattern) with validated concept_ids.
    """
    from scripts.irsf_etl.lib.vocab_validator import ConceptStatus

    # Collect unique non-zero concept_ids
    all_ids = df["condition_concept_id"].dropna().unique().tolist()
    unique_ids = [int(cid) for cid in all_ids if int(cid) != 0]

    if not unique_ids:
        logger.info("No non-zero concept_ids to validate")
        return df.copy()

    # Batch validate
    results = validator.validate_batch(unique_ids)

    # Build remap dict: original_id -> new concept_id
    remap: dict[int, int] = {}
    for cid, result in results.items():
        if result.status == ConceptStatus.STANDARD:
            remap[cid] = result.resolved_id
        elif result.status == ConceptStatus.DEPRECATED_REMAPPED:
            remap[cid] = result.resolved_id
            log.log(
                0,
                "condition_concept_id",
                str(cid),
                RejectionCategory.DEPRECATED_REMAPPED,
                f"Remapped {cid} -> {result.resolved_id}: {result.message}",
            )
            logger.info("Remapped deprecated SNOMED %d -> %d", cid, result.resolved_id)
        elif result.status == ConceptStatus.DEPRECATED_NO_REPLACEMENT:
            remap[cid] = 0
            log.log(
                0,
                "condition_concept_id",
                str(cid),
                RejectionCategory.DEPRECATED_NO_REPLACEMENT,
                f"Deprecated concept {cid} with no replacement",
            )
            logger.warning("Deprecated SNOMED %d has no replacement", cid)
        elif result.status == ConceptStatus.NOT_FOUND:
            remap[cid] = 0
            log.log(
                0,
                "condition_concept_id",
                str(cid),
                RejectionCategory.UNMAPPED_CONCEPT,
                f"Concept {cid} not found in vocabulary",
            )
            logger.warning("SNOMED concept %d not found in vocabulary", cid)
        elif result.status == ConceptStatus.NON_STANDARD:
            # Non-standard with no Maps-to: keep original id
            remap[cid] = result.resolved_id

    # Apply remap: update condition_concept_id, preserve condition_source_concept_id
    new_df = df.copy()
    new_df["condition_concept_id"] = new_df["condition_concept_id"].apply(
        lambda x: remap.get(int(x), int(x)) if pd.notna(x) and int(x) != 0 else int(x) if pd.notna(x) else 0
    )

    remapped_count = sum(
        1 for r in results.values()
        if r.status == ConceptStatus.DEPRECATED_REMAPPED
    )
    not_found_count = sum(
        1 for r in results.values()
        if r.status in (ConceptStatus.NOT_FOUND, ConceptStatus.DEPRECATED_NO_REPLACEMENT)
    )
    logger.info(
        "Vocabulary validation: %d unique concepts, %d remapped, %d unmapped/not-found",
        len(unique_ids),
        remapped_count,
        not_found_count,
    )

    return new_df


def validate_hardcoded_mappings(validator: VocabularyValidator) -> dict[int, int]:
    """Validate seizure and fracture hardcoded SNOMED concept_ids.

    Returns a remap dict for any deprecated codes in the hardcoded maps.
    Logs warnings for any codes that are not found or have no replacement.
    """
    from scripts.irsf_etl.lib.vocab_validator import ConceptStatus

    all_hardcoded_ids = set()
    for cid in _SEIZURE_SNOMED_MAP.values():
        if cid != 0:
            all_hardcoded_ids.add(cid)
    for cid in _FRACTURE_SNOMED_MAP.values():
        if cid != 0:
            all_hardcoded_ids.add(cid)

    if not all_hardcoded_ids:
        return {}

    results = validator.validate_batch(list(all_hardcoded_ids))

    remap: dict[int, int] = {}
    for cid, result in results.items():
        if result.status == ConceptStatus.DEPRECATED_REMAPPED:
            remap[cid] = result.resolved_id
            logger.warning(
                "Hardcoded SNOMED %d is deprecated, remapped to %d",
                cid,
                result.resolved_id,
            )
        elif result.status == ConceptStatus.DEPRECATED_NO_REPLACEMENT:
            logger.warning(
                "Hardcoded SNOMED %d is deprecated with no replacement",
                cid,
            )
        elif result.status == ConceptStatus.NOT_FOUND:
            logger.warning(
                "Hardcoded SNOMED %d not found in vocabulary",
                cid,
            )
        elif result.status == ConceptStatus.STANDARD:
            logger.debug("Hardcoded SNOMED %d is current/standard", cid)

    if remap:
        logger.info(
            "Hardcoded mapping validation: %d/%d codes need remapping",
            len(remap),
            len(all_hardcoded_ids),
        )
    else:
        logger.info(
            "Hardcoded mapping validation: all %d codes are current",
            len(all_hardcoded_ids),
        )

    return remap


def _write_currency_report(
    df: pd.DataFrame,
    validation_results: dict[int, ConceptValidationResult],
    report_path: object,
) -> None:
    """Write per-source-table SNOMED currency report to CSV.

    Columns: source_table, total_records, mapped_count, unmapped_count,
    remapped_count, coverage_rate. Includes a summary row.
    """
    from pathlib import Path

    from scripts.irsf_etl.lib.vocab_validator import ConceptStatus

    report_path = Path(report_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    # Group by source_file
    source_tables = df["source_file"].unique().tolist() if "source_file" in df.columns else []

    rows: list[dict] = []
    total_all = 0
    mapped_all = 0
    unmapped_all = 0
    remapped_all = 0

    for table in sorted(source_tables):
        table_df = df[df["source_file"] == table]
        total = len(table_df)
        mapped = int((table_df["condition_concept_id"] != 0).sum())
        unmapped = total - mapped

        # Count remapped: rows whose original source_concept_id was remapped
        remapped = 0
        for _, row in table_df.iterrows():
            src_cid = int(row["condition_source_concept_id"]) if pd.notna(row["condition_source_concept_id"]) else 0
            if src_cid != 0 and src_cid in validation_results:
                if validation_results[src_cid].status == ConceptStatus.DEPRECATED_REMAPPED:
                    remapped += 1

        coverage = mapped / total if total > 0 else 0.0

        rows.append({
            "source_table": table.replace(".csv", ""),
            "total_records": total,
            "mapped_count": mapped,
            "unmapped_count": unmapped,
            "remapped_count": remapped,
            "coverage_rate": f"{coverage:.4f}",
        })

        total_all += total
        mapped_all += mapped
        unmapped_all += unmapped
        remapped_all += remapped

    # Summary row
    coverage_all = mapped_all / total_all if total_all > 0 else 0.0
    rows.append({
        "source_table": "TOTAL",
        "total_records": total_all,
        "mapped_count": mapped_all,
        "unmapped_count": unmapped_all,
        "remapped_count": remapped_all,
        "coverage_rate": f"{coverage_all:.4f}",
    })

    # Write CSV using csv module for consistent quoting
    fieldnames = ["source_table", "total_records", "mapped_count", "unmapped_count", "remapped_count", "coverage_rate"]
    with open(report_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    logger.info("Wrote currency report to %s", report_path)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


def extract_conditions(
    config: ETLConfig | None = None,
    validator: VocabularyValidator | None = None,
) -> pd.DataFrame:
    """Main orchestrator: extract conditions from all four 5211 tables.

    Loads PersonIdRegistry and VisitResolver from staging, calls all four
    extractors, deduplicates, optionally validates SNOMED codes via
    VocabularyValidator, assigns deterministic IDs, validates via
    Pandera schema, and writes staging/condition_occurrence.csv.

    Args:
        config: Optional ETL config. Created with defaults if None.
        validator: Optional VocabularyValidator for SNOMED validation.
            If None, validation is skipped (allows testing without DB).

    Returns:
        Final condition_occurrence DataFrame.
    """
    if config is None:
        config = ETLConfig()

    staging_dir = config.staging_dir
    reports_dir = config.reports_dir
    staging_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    # Load dependencies
    registry = PersonIdRegistry.from_csv(staging_dir / "person_id_map.csv")
    visit_resolver = VisitResolver.from_csv(staging_dir / "visit_id_map.csv")
    log = RejectionLog("condition_occurrence")

    # Extract from all four tables
    chronic_df = extract_chronic_diagnoses(config, registry, visit_resolver, log)
    seizures_df = extract_seizures(config, registry, visit_resolver, log)
    fractures_df = extract_bone_fractures(config, registry, visit_resolver, log)
    infections_df = extract_infections(config, registry, visit_resolver, log)

    # Concatenate all results
    all_dfs = [chronic_df, seizures_df, fractures_df, infections_df]
    combined = pd.concat(all_dfs, ignore_index=True)

    logger.info(
        "Combined: %d rows (chronic=%d, seizures=%d, fractures=%d, infections=%d)",
        len(combined),
        len(chronic_df),
        len(seizures_df),
        len(fractures_df),
        len(infections_df),
    )

    if combined.empty:
        logger.warning("No condition records extracted from any source table")
        return combined

    # SNOMED vocabulary validation (if validator provided)
    validation_results: dict[int, ConceptValidationResult] = {}
    if validator is not None:
        # Validate hardcoded seizure/fracture mappings
        hardcoded_remap = validate_hardcoded_mappings(validator)
        if hardcoded_remap:
            logger.info("Applying %d hardcoded remaps", len(hardcoded_remap))
            combined["condition_concept_id"] = combined["condition_concept_id"].apply(
                lambda x: hardcoded_remap.get(int(x), int(x)) if pd.notna(x) else 0
            )

        # Validate all concept_ids in the combined DataFrame
        combined = validate_condition_concepts(combined, validator, log)

        # Collect validation results for currency report
        unique_ids = [int(cid) for cid in combined["condition_source_concept_id"].dropna().unique() if int(cid) != 0]
        if unique_ids:
            validation_results = validator.validate_batch(unique_ids)

        # Write currency report
        currency_path = reports_dir / "condition_snomed_currency.csv"
        _write_currency_report(combined, validation_results, currency_path)

        # Generate and log overall currency report
        currency = validator.generate_currency_report(validation_results)
        logger.info(
            "SNOMED currency: %d current, %d remapped, %d no-replacement, %d not-found (%.1f%% coverage)",
            currency.current_count,
            currency.remapped_count,
            currency.no_replacement_count,
            currency.unmapped_count,
            currency.coverage_rate * 100,
        )

    # Deduplicate on (person_id, condition_concept_id, condition_start_date, condition_source_value)
    dedup_cols = ["person_id", "condition_concept_id", "condition_start_date", "condition_source_value"]
    pre_dedup = len(combined)
    combined = combined.drop_duplicates(subset=dedup_cols, keep="first")
    post_dedup = len(combined)
    if pre_dedup != post_dedup:
        logger.info("Deduplication removed %d rows", pre_dedup - post_dedup)

    # Sort for deterministic ordering
    combined = combined.sort_values(
        ["person_id", "condition_start_date"],
        ignore_index=True,
    )

    # Assign deterministic condition_occurrence_id
    combined["condition_occurrence_id"] = range(1, len(combined) + 1)

    # Set condition_type_concept_id
    combined["condition_type_concept_id"] = _CONDITION_TYPE_REGISTRY

    # Build final output columns in OMOP order
    output_cols = [
        "condition_occurrence_id",
        "person_id",
        "condition_concept_id",
        "condition_start_date",
        "condition_end_date",
        "condition_type_concept_id",
        "condition_status_concept_id",
        "stop_reason",
        "provider_id",
        "visit_occurrence_id",
        "visit_detail_id",
        "condition_source_value",
        "condition_source_concept_id",
    ]

    # Add missing nullable columns
    combined["provider_id"] = None
    combined["visit_detail_id"] = None

    # Ensure visit_occurrence_id is Int64 for proper nullable integer handling
    combined["visit_occurrence_id"] = combined["visit_occurrence_id"].astype(pd.Int64Dtype())

    # Select and reorder
    result = combined[output_cols].copy()

    # Validate against Pandera schema
    result = condition_occurrence_schema.validate(result)

    # Write staging CSV
    output_path = staging_dir / "condition_occurrence.csv"
    result.to_csv(output_path, index=False)
    logger.info("Wrote %d condition_occurrence rows to %s", len(result), output_path)

    # Write rejection report
    rejection_path = reports_dir / "condition_occurrence_rejections.csv"
    log.to_csv(rejection_path)
    summary = log.summary()
    logger.info(
        "Rejections: %d errors, %d warnings out of %d processed (%.1f%% rejection rate)",
        summary.total_rejected,
        summary.total_warnings,
        summary.total_processed,
        summary.rejection_rate * 100,
    )

    # Log mapping coverage rate
    mapped = int((result["condition_concept_id"] != 0).sum())
    total = len(result)
    coverage = mapped / total * 100 if total > 0 else 0.0
    logger.info(
        "Condition mapping coverage: %.1f%% (%d/%d)",
        coverage,
        mapped,
        total,
    )

    return result
