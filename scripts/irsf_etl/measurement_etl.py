"""Measurement ETL module for IRSF Natural History Study.

Transforms wide-format measurement source data into OMOP CDM v5.4
measurement rows. Provides a reusable wide-to-long unpivot helper used
by growth, CSS, lab, and SF-36 measurement transformations.

Exports:
    transform_growth: Growth measurement unpivot (height, weight, BMI, FOC).
    transform_css: CSS (Clinical Severity Scale) measurement unpivot (14 items).
    transform_labs: Lab result transformation with LOINC/SNOMED mapping.
    transform_sf36: SF-36 quality-of-life Likert-encoded measurement transform.
    unpivot_wide_to_long: Reusable wide-to-long helper for any measurement source.
    transform_measurements: Main orchestrator for all measurement sources.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.irsf_vocabulary import _CSS_CONCEPTS
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.schemas.measurement import measurement_schema

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# LOINC concept_ids for growth measurements:
# (source_column, concept_id, unit_concept_id, unit_source_value)
_GROWTH_MEASURES: tuple[tuple[str, int, int, str], ...] = (
    ("HeightCm", 3036277, 8582, "cm"),  # Height, unit=cm
    ("WeightKg", 3025315, 9529, "kg"),  # Weight, unit=kg
    ("BMI", 3038553, 9531, "kg/m2"),  # BMI, unit=kg/m2
    ("FOCCm", 3036832, 8582, "cm"),  # Head circumference, unit=cm
)

_MEASUREMENT_TYPE_SURVEY = 32882
_OPERATOR_EQUALS = 4172703

# ---------------------------------------------------------------------------
# Lab measurement constants
# ---------------------------------------------------------------------------

# LOINC concept_ids for known lab test types
_LAB_TYPE_MAP: dict[str, int] = {
    "CBC": 3000963,
    "WBC": 3010813,
    "Cholesterol": 3027114,
    "Triglycerides": 3022192,
    "Vitamin D": 3049536,
}

# SNOMED code regex for "Other (SNOMED terms)" SNOWMEDOutput
_SNOMED_CODE_RE = re.compile(r"code:(\d+)")

# Regex to extract first numeric value from SpecificResultsKnown
_NUMERIC_RE = re.compile(r"[-+]?\d*\.?\d+")

# GeneralResults -> value_as_concept_id mapping
_RESULT_CONCEPT_MAP: dict[str, int] = {
    "Normal": 4069590,
    "Abnormal": 4135493,
}

# ---------------------------------------------------------------------------
# SF-36 constants
# ---------------------------------------------------------------------------

# SF-36 label/instruction columns to skip during unpivot
_SF36_SKIP_COLUMNS: frozenset[str] = frozenset({
    "labeltypicalActivities",
    "Label4question",
    "Label5question",
    "Label9question",
    "Label11question",
    "PPInstructions",
})

# Likert encoding maps by scale type
_LIKERT_GENERAL_HEALTH: dict[str, int] = {
    "Excellent": 5,
    "Very Good": 4,
    "Good": 3,
    "Fair": 2,
    "Poor": 1,
}
_LIKERT_HEALTH_CHANGE: dict[str, int] = {
    "Much better now than one year ago": 5,
    "Somewhat  better now than one year ago": 4,  # double space in source
    "Somewhat better now than one year ago": 4,
    "About the same as one year ago": 3,
    "Somewhat worse now than one year ago": 2,
    "Much worse now than one year ago": 1,
}
_LIKERT_ACTIVITY_LIMIT: dict[str, int] = {
    "No, not limited at all": 3,
    "Yes, limited a little": 2,
    "Yes, limited a lot": 1,
}
_LIKERT_FREQUENCY: dict[str, int] = {
    "All of the time": 1,
    "Most of the time": 2,
    "A good bit of the time": 3,
    "Some of the time": 4,
    "A little of the time": 5,
    "None of the time": 6,
}
_LIKERT_EXTENT: dict[str, int] = {
    "Not at all": 5,
    "Slightly": 4,
    "Moderately": 3,
    "Quite a bit": 2,
    "Extremely": 1,
}
_LIKERT_PAIN: dict[str, int] = {
    "None": 6,
    "Very Mild": 5,
    "Mild": 4,
    "Moderate": 3,
    "Severe": 2,
    "Very Severe": 1,
}
_LIKERT_TRUTH: dict[str, int] = {
    "Definitely true": 5,
    "Mostly true": 4,
    "Don't know": 3,
    "Mostly false": 2,
    "Definitely false": 1,
}

# Column name -> Likert scale mapping
# Each SF-36 question maps to its response scale type
_SF36_COLUMN_SCALE: dict[str, dict[str, int]] = {
    # Q1: General health
    "_1Ingeneralwouldyousayyourheal": _LIKERT_GENERAL_HEALTH,
    # Q2: Health change
    "_2Comparedtooneyearagohowwould": _LIKERT_HEALTH_CHANGE,
    # Q3a-j: Activity limitations
    "aVigorousactivitiessuchasrunni": _LIKERT_ACTIVITY_LIMIT,
    "bModerateactivitiessuchasmovin": _LIKERT_ACTIVITY_LIMIT,
    "cLiftingorcarryinggroceries": _LIKERT_ACTIVITY_LIMIT,
    "dClimbingseveralflightsofstair": _LIKERT_ACTIVITY_LIMIT,
    "eClimbingoneflightofstairs": _LIKERT_ACTIVITY_LIMIT,
    "fBendingkneelingorstooping": _LIKERT_ACTIVITY_LIMIT,
    "gWalkingmorethanamile": _LIKERT_ACTIVITY_LIMIT,
    "hWalkingseveralhundredyards": _LIKERT_ACTIVITY_LIMIT,
    "iWalkingonehundredyards": _LIKERT_ACTIVITY_LIMIT,
    "jBathingordressingyourself": _LIKERT_ACTIVITY_LIMIT,
    # Q4a-d: Role limitations (physical) -- frequency scale
    "_4aCutDownOnAmountOfTimeSpent": _LIKERT_FREQUENCY,
    "_4bAccomplishedLess": _LIKERT_FREQUENCY,
    "cWerelimitedinthekindofworkoro": _LIKERT_FREQUENCY,
    "dHaddifficultyperformingthewor": _LIKERT_FREQUENCY,
    # Q5a-c: Role limitations (emotional) -- frequency scale
    "_5aCutDownOnAmountOfTimeSpent": _LIKERT_FREQUENCY,
    "_5bAccomplishedLess": _LIKERT_FREQUENCY,
    "cDidworkorotheractivitieslessc": _LIKERT_FREQUENCY,
    # Q6: Social functioning -- extent scale
    "_6Duringthepast4weekstowhatext": _LIKERT_EXTENT,
    # Q7: Bodily pain -- pain scale
    "_7Howmuchbodilypainhaveyouhadd": _LIKERT_PAIN,
    # Q8: Pain interference -- extent scale
    "_8Duringthepast4weekshowmuchdi": _LIKERT_EXTENT,
    # Q9a-i: Vitality/mental health -- frequency scale
    "aDidyoufeelfulloflife": _LIKERT_FREQUENCY,
    "bHaveyoubeenverynervous": _LIKERT_FREQUENCY,
    "cHaveyoufeltsodowninthedumpsth": _LIKERT_FREQUENCY,
    "dHaveyoufeltcalmandpeaceful": _LIKERT_FREQUENCY,
    "eDidyouhavealotofenergy": _LIKERT_FREQUENCY,
    "fHaveyoufeltdownheartedanddepr": _LIKERT_FREQUENCY,
    "gDidyoufeelwornout": _LIKERT_FREQUENCY,
    "hHaveyoubeenhappy": _LIKERT_FREQUENCY,
    "iDidyoufeeltired": _LIKERT_FREQUENCY,
    # Q10: Social functioning -- frequency scale
    "_10Duringthepast4weekshowmucho": _LIKERT_FREQUENCY,
    # Q11a-d: General health perceptions -- truth scale
    "aIseemtogetsickalittleeasierth": _LIKERT_TRUTH,
    "bIamashealthyasanybodyIknow": _LIKERT_TRUTH,
    "cIexpectmyhealthtogetworse": _LIKERT_TRUTH,
    "dMyhealthisexcellent": _LIKERT_TRUTH,
}

# OMOP measurement columns in output order
_MEASUREMENT_COLUMNS = [
    "measurement_id",
    "person_id",
    "measurement_concept_id",
    "measurement_date",
    "measurement_type_concept_id",
    "operator_concept_id",
    "value_as_number",
    "value_as_concept_id",
    "unit_concept_id",
    "range_low",
    "range_high",
    "provider_id",
    "visit_occurrence_id",
    "visit_detail_id",
    "measurement_source_value",
    "measurement_source_concept_id",
    "unit_source_value",
    "unit_source_concept_id",
    "value_source_value",
]


# ---------------------------------------------------------------------------
# Reusable unpivot helper
# ---------------------------------------------------------------------------


def unpivot_wide_to_long(
    df: pd.DataFrame,
    person_ids: pd.Series,
    visit_dates: pd.Series,
    measure_specs: tuple[tuple[str, int, int, str], ...] | list[tuple[str, int, int, str]],
    visit_resolver: VisitResolver,
    log: RejectionLog,
    source_file: str,
    visit_labels: Optional[pd.Series] = None,
) -> list[dict]:
    """Unpivot wide-format measurement columns to long-format OMOP rows.

    For each row in df, for each measure_spec, emits one measurement row
    if the source value is non-null. NULL source values are SKIPPED,
    preventing row inflation (MEAS-06).

    Args:
        df: Source DataFrame with wide measurement columns.
        person_ids: Series of resolved OMOP person_ids (pd.Int64Dtype).
        visit_dates: Series of ISO date strings (YYYY-MM-DD).
        measure_specs: Tuples of (source_column, concept_id, unit_concept_id, unit_source_value).
        visit_resolver: VisitResolver for visit_occurrence_id lookup.
        log: RejectionLog for tracking skipped rows.
        source_file: Source file name for rejection log context.
        visit_labels: Optional Series of visit labels for exact visit resolution.

    Returns:
        List of row dicts with all OMOP measurement columns.
    """
    rows: list[dict] = []

    for idx in range(len(df)):
        pid = person_ids.iloc[idx]
        vdate = visit_dates.iloc[idx]
        vlabel = visit_labels.iloc[idx] if visit_labels is not None else None

        # Skip rows with unresolved person_id
        if pd.isna(pid):
            log.log(
                record_index=idx,
                column="person_id",
                value="NA",
                category=RejectionCategory.MISSING_REQUIRED,
                message=f"Unresolved person_id in {source_file}",
            )
            continue

        # Skip rows with unparseable/missing date
        if pd.isna(vdate) or str(vdate).strip() == "" or str(vdate).strip() == "NaT":
            log.log(
                record_index=idx,
                column="visit_date",
                value=str(vdate),
                category=RejectionCategory.DATE_ASSEMBLY_FAILED,
                message=f"Missing or unparseable date in {source_file}",
            )
            continue

        pid_int = int(pid)
        vdate_str = str(vdate)
        vlabel_str = str(vlabel) if vlabel is not None and not pd.isna(vlabel) else None

        # Resolve visit_occurrence_id
        visit_occ_id = visit_resolver.resolve(pid_int, vdate_str, vlabel_str)

        for source_col, concept_id, unit_concept_id, unit_source in measure_specs:
            raw_value = df.iloc[idx].get(source_col)

            # Critical NULL filter: skip null/NaN values (MEAS-06)
            if raw_value is None or pd.isna(raw_value):
                continue

            # Parse value as float
            try:
                value_as_number = float(raw_value)
            except (ValueError, TypeError):
                log.log(
                    record_index=idx,
                    column=source_col,
                    value=str(raw_value),
                    category=RejectionCategory.INVALID_VALUE,
                    message=f"Cannot parse {source_col} value as float in {source_file}",
                )
                continue

            row = {
                "measurement_id": 0,  # Placeholder, assigned later
                "person_id": pid_int,
                "measurement_concept_id": concept_id,
                "measurement_date": vdate_str,
                "measurement_type_concept_id": _MEASUREMENT_TYPE_SURVEY,
                "operator_concept_id": _OPERATOR_EQUALS,
                "value_as_number": value_as_number,
                "value_as_concept_id": None,
                "unit_concept_id": unit_concept_id,
                "range_low": None,
                "range_high": None,
                "provider_id": None,
                "visit_occurrence_id": visit_occ_id,
                "visit_detail_id": None,
                "measurement_source_value": source_col,
                "measurement_source_concept_id": 0,
                "unit_source_value": unit_source,
                "unit_source_concept_id": 0,
                "value_source_value": str(raw_value),
            }
            rows.append(row)

    return rows


# ---------------------------------------------------------------------------
# Growth measurement transform
# ---------------------------------------------------------------------------


def transform_growth(
    config: ETLConfig,
    registry: PersonIdRegistry,
    resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Transform growth measurements from GROWTH_5201_5211.csv.

    Loads the wide-format growth CSV, resolves person_ids and visit dates,
    then unpivots HeightCm, WeightKg, BMI, FOCCm into long-format OMOP
    measurement rows. Appends HeightMeasurementPosition to height rows'
    measurement_source_value.

    Args:
        config: ETL configuration with source paths.
        registry: PersonIdRegistry for participant_id -> person_id resolution.
        resolver: VisitResolver for visit_occurrence_id lookup.
        log: RejectionLog for tracking rejected rows.

    Returns:
        DataFrame with OMOP measurement columns (measurement_id not yet assigned).
    """
    growth_path = config.source_custom_extracts / "csv" / "GROWTH_5201_5211.csv"
    logger.info("Loading growth data from %s", growth_path)
    df = read_csv_safe(growth_path)
    logger.info("Growth CSV loaded: %d rows", len(df))

    log.set_processed_count(len(df))

    # Resolve person_ids
    person_ids = registry.resolve_series(df["participant_id"])

    # Parse visit dates
    visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
    visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

    # Get visit labels
    visit_labels = df["visit"].astype(str) if "visit" in df.columns else None

    # Unpivot growth measurements
    rows = unpivot_wide_to_long(
        df=df,
        person_ids=person_ids,
        visit_dates=visit_dates_str,
        measure_specs=_GROWTH_MEASURES,
        visit_resolver=resolver,
        log=log,
        source_file="GROWTH_5201_5211.csv",
        visit_labels=visit_labels,
    )

    # Append HeightMeasurementPosition to height measurement_source_value
    if "HeightMeasurementPosition" in df.columns:
        # Build index mapping: for each source row, track the position value
        positions = df["HeightMeasurementPosition"].tolist()

        # Track which source row each measurement row came from
        row_source_idx = 0
        source_row_tracker: list[int] = []
        for idx in range(len(df)):
            pid = person_ids.iloc[idx]
            vdate = visit_dates_str.iloc[idx]
            if pd.isna(pid) or pd.isna(vdate) or str(vdate).strip() == "":
                continue
            for source_col, _, _, _ in _GROWTH_MEASURES:
                raw_val = df.iloc[idx].get(source_col)
                if raw_val is not None and not pd.isna(raw_val):
                    try:
                        float(raw_val)
                        source_row_tracker.append(idx)
                    except (ValueError, TypeError):
                        pass

        # Apply position qualifier to height rows
        for i, row in enumerate(rows):
            if row["measurement_source_value"] == "HeightCm" and i < len(source_row_tracker):
                src_idx = source_row_tracker[i]
                pos = positions[src_idx]
                if pos is not None and not pd.isna(pos) and str(pos).strip():
                    row["measurement_source_value"] = f"HeightCm ({str(pos).strip()})"

    result = pd.DataFrame(rows, columns=_MEASUREMENT_COLUMNS)
    logger.info("Growth measurements: %d rows produced", len(result))

    return result


# ---------------------------------------------------------------------------
# CSS (Clinical Severity Scale) measurement transform
# ---------------------------------------------------------------------------

# Build measure_specs from _CSS_CONCEPTS: data-driven, no hardcoded columns.
# Unit concept_id=0 (scores have no physical unit), unit_source_value=None.
_CSS_MEASURE_SPECS: list[tuple[str, int, int, str | None]] = [
    (c.source_column, c.concept_id, 0, None) for c in _CSS_CONCEPTS
]


def transform_css(
    config: ETLConfig,
    registry: PersonIdRegistry,
    resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Transform CSS (Clinical Severity Scale) measurements from CSS_5201_5211.csv.

    Loads the wide-format CSS CSV, resolves person_ids and visit dates,
    then unpivots 14 score columns (1 TotalScore + 13 individual clinical
    severity items) into long-format OMOP measurement rows. Concept_ids
    are data-driven from irsf_vocabulary._CSS_CONCEPTS.

    Args:
        config: ETL configuration with source paths.
        registry: PersonIdRegistry for participant_id -> person_id resolution.
        resolver: VisitResolver for visit_occurrence_id lookup.
        log: RejectionLog for tracking rejected rows.

    Returns:
        DataFrame with OMOP measurement columns (measurement_id not yet assigned).
    """
    css_path = config.source_custom_extracts / "csv" / "CSS_5201_5211.csv"
    logger.info("Loading CSS data from %s", css_path)
    df = read_csv_safe(css_path)
    logger.info("CSS CSV loaded: %d rows", len(df))

    log.set_processed_count(len(df))

    # Validate that all expected source_columns exist in the CSV
    expected_cols = {c.source_column for c in _CSS_CONCEPTS}
    actual_cols = set(df.columns)
    missing_cols = expected_cols - actual_cols
    if missing_cols:
        raise ValueError(
            f"CSS CSV missing expected columns from _CSS_CONCEPTS: {sorted(missing_cols)}. "
            f"Available columns: {sorted(actual_cols)}"
        )

    # Resolve person_ids
    person_ids = registry.resolve_series(df["participant_id"])

    # Parse visit dates
    visit_dates = pd.to_datetime(df["visit_date"], format="mixed", errors="coerce")
    visit_dates_str = visit_dates.dt.strftime("%Y-%m-%d")

    # Get visit labels
    visit_labels = df["visit"].astype(str) if "visit" in df.columns else None

    # Unpivot CSS measurements
    rows = unpivot_wide_to_long(
        df=df,
        person_ids=person_ids,
        visit_dates=visit_dates_str,
        measure_specs=_CSS_MEASURE_SPECS,
        visit_resolver=resolver,
        log=log,
        source_file="CSS_5201_5211.csv",
        visit_labels=visit_labels,
    )

    result = pd.DataFrame(rows, columns=_MEASUREMENT_COLUMNS)
    logger.info("CSS measurements: %d rows produced", len(result))

    return result


# ---------------------------------------------------------------------------
# Lab measurement transform
# ---------------------------------------------------------------------------


def transform_labs(
    config: ETLConfig,
    registry: PersonIdRegistry,
    resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Transform lab results from Labs_5211.csv into OMOP measurement rows.

    Maps TypeOfTest to LOINC concept_ids for known types (CBC, WBC, Cholesterol,
    Triglycerides, Vitamin D). For "Other (SNOMED terms)" rows, extracts SNOMED
    code from SNOWMEDOutput via regex and stores in measurement_source_concept_id.

    Lab dates are assembled from split DatePerformedDay/Month/Year columns with
    fallback to DatePerformed string, then visit_date.

    Args:
        config: ETL configuration with source paths.
        registry: PersonIdRegistry for participant_id -> person_id resolution.
        resolver: VisitResolver for visit_occurrence_id lookup.
        log: RejectionLog for tracking rejected rows.

    Returns:
        DataFrame with OMOP measurement columns (measurement_id not yet assigned).
    """
    labs_path = config.source_custom_extracts / "csv" / "Labs_5211.csv"
    logger.info("Loading labs data from %s", labs_path)
    df = read_csv_safe(labs_path)
    logger.info("Labs CSV loaded: %d rows", len(df))

    log.set_processed_count(len(df))

    rows: list[dict] = []

    for idx in range(len(df)):
        row_data = df.iloc[idx]

        # Resolve person_id
        pid_raw = row_data.get("participant_id")
        if pid_raw is None or pd.isna(pid_raw):
            log.log(
                record_index=idx,
                column="participant_id",
                value=str(pid_raw),
                category=RejectionCategory.MISSING_REQUIRED,
                message="Missing participant_id in Labs",
            )
            continue

        pid_series = registry.resolve_series(pd.Series([pid_raw]))
        pid = pid_series.iloc[0]
        if pd.isna(pid):
            log.log(
                record_index=idx,
                column="participant_id",
                value=str(pid_raw),
                category=RejectionCategory.MISSING_REQUIRED,
                message="Unresolved participant_id in Labs",
            )
            continue

        pid_int = int(pid)

        # Assemble lab date from split columns, with fallbacks
        lab_date = _assemble_lab_date(row_data)
        if lab_date is None:
            log.log(
                record_index=idx,
                column="DatePerformed",
                value="",
                category=RejectionCategory.DATE_ASSEMBLY_FAILED,
                message="Cannot assemble lab date from any source",
            )
            continue

        lab_date_str = lab_date if isinstance(lab_date, str) else str(lab_date)

        # Parse visit_date for visit_occurrence_id resolution
        visit_date_raw = row_data.get("visit_date")
        visit_date_str = None
        if visit_date_raw is not None and not pd.isna(visit_date_raw):
            vd_parsed = pd.to_datetime(str(visit_date_raw), format="mixed", errors="coerce")
            if pd.notna(vd_parsed):
                visit_date_str = vd_parsed.strftime("%Y-%m-%d")

        # Resolve visit_occurrence_id using visit_date (study visit), not lab date
        visit_occ_id = None
        if visit_date_str is not None:
            visit_label_raw = row_data.get("VisitTimePoint")
            vlabel = str(visit_label_raw) if visit_label_raw is not None and not pd.isna(visit_label_raw) else None
            visit_occ_id = resolver.resolve(pid_int, visit_date_str, vlabel)

        # Map TypeOfTest to concept_id
        test_type = row_data.get("TypeOfTest")
        test_type_str = str(test_type).strip() if test_type is not None and not pd.isna(test_type) else ""

        measurement_concept_id = 0
        measurement_source_concept_id = 0

        if test_type_str in _LAB_TYPE_MAP:
            measurement_concept_id = _LAB_TYPE_MAP[test_type_str]
        elif test_type_str == "Other (SNOMED terms)":
            # Extract SNOMED code from SNOWMEDOutput
            snomed_output = row_data.get("SNOWMEDOutput")
            if snomed_output is not None and not pd.isna(snomed_output):
                match = _SNOMED_CODE_RE.search(str(snomed_output))
                if match:
                    measurement_source_concept_id = int(match.group(1))

        # Parse SpecificResultsKnown for numeric value
        specific_results = row_data.get("SpecificResultsKnown")
        value_as_number = None
        value_source_value = ""
        if specific_results is not None and not pd.isna(specific_results):
            value_source_value = str(specific_results)
            match = _NUMERIC_RE.search(value_source_value)
            if match:
                try:
                    value_as_number = float(match.group(0))
                except (ValueError, TypeError):
                    pass

        # Map GeneralResults to value_as_concept_id
        general_results = row_data.get("GeneralResults")
        value_as_concept_id = None
        if general_results is not None and not pd.isna(general_results):
            value_as_concept_id = _RESULT_CONCEPT_MAP.get(str(general_results).strip())

        measurement_row = {
            "measurement_id": 0,
            "person_id": pid_int,
            "measurement_concept_id": measurement_concept_id,
            "measurement_date": lab_date_str,
            "measurement_type_concept_id": _MEASUREMENT_TYPE_SURVEY,
            "operator_concept_id": _OPERATOR_EQUALS,
            "value_as_number": value_as_number,
            "value_as_concept_id": value_as_concept_id,
            "unit_concept_id": 0,
            "range_low": None,
            "range_high": None,
            "provider_id": None,
            "visit_occurrence_id": visit_occ_id,
            "visit_detail_id": None,
            "measurement_source_value": test_type_str,
            "measurement_source_concept_id": measurement_source_concept_id,
            "unit_source_value": None,
            "unit_source_concept_id": 0,
            "value_source_value": value_source_value,
        }
        rows.append(measurement_row)

    result = pd.DataFrame(rows, columns=_MEASUREMENT_COLUMNS)
    logger.info("Lab measurements: %d rows produced", len(result))

    return result


def _assemble_lab_date(row: pd.Series) -> str | None:
    """Assemble lab date from split columns with fallbacks.

    Priority:
    1. DatePerformedMonth/Day/Year split columns via assemble_date()
    2. DatePerformed string (parsed via pandas)
    3. visit_date string (parsed via pandas)

    Returns:
        ISO date string (YYYY-MM-DD) or None if all fail.
    """
    # Try split columns first
    month_val = row.get("DatePerformedMonth")
    day_val = row.get("DatePerformedDay")
    year_val = row.get("DatePerformedYear")

    month_str = str(month_val) if month_val is not None and not pd.isna(month_val) else None
    assembled = assemble_date(month_str, day_val, year_val, max_year=2026)
    if assembled is not None:
        return str(assembled)

    # Fallback to DatePerformed string
    date_performed = row.get("DatePerformed")
    if date_performed is not None and not pd.isna(date_performed):
        parsed = pd.to_datetime(str(date_performed), format="mixed", errors="coerce")
        if pd.notna(parsed):
            return parsed.strftime("%Y-%m-%d")

    # Fallback to visit_date
    visit_date = row.get("visit_date")
    if visit_date is not None and not pd.isna(visit_date):
        parsed = pd.to_datetime(str(visit_date), format="mixed", errors="coerce")
        if pd.notna(parsed):
            return parsed.strftime("%Y-%m-%d")

    return None


# ---------------------------------------------------------------------------
# SF-36 quality-of-life measurement transform
# ---------------------------------------------------------------------------


def transform_sf36(
    config: ETLConfig,
    registry: PersonIdRegistry,
    resolver: VisitResolver,
    log: RejectionLog,
) -> pd.DataFrame:
    """Transform SF-36 quality-of-life responses from SF36_5201_5211.csv.

    Loads the wide-format SF-36 CSV, identifies response columns (excluding
    label/instruction columns), applies Likert-scale ordinal encoding, and
    emits one measurement row per non-null response per patient visit.

    Args:
        config: ETL configuration with source paths.
        registry: PersonIdRegistry for participant_id -> person_id resolution.
        resolver: VisitResolver for visit_occurrence_id lookup.
        log: RejectionLog for tracking rejected rows.

    Returns:
        DataFrame with OMOP measurement columns (measurement_id not yet assigned).
    """
    sf36_path = config.source_custom_extracts / "csv" / "SF36_5201_5211.csv"
    logger.info("Loading SF-36 data from %s", sf36_path)
    # keep_default_na=False to preserve "None" as text (pain scale value)
    df = read_csv_safe(sf36_path, keep_default_na=False)
    logger.info("SF-36 CSV loaded: %d rows", len(df))

    log.set_processed_count(len(df))

    # Identify response columns: all after age_at_visit, excluding skip columns
    all_cols = list(df.columns)
    age_idx = all_cols.index("age_at_visit") if "age_at_visit" in all_cols else -1
    if age_idx < 0:
        logger.error("SF-36 CSV missing age_at_visit column")
        return pd.DataFrame(columns=_MEASUREMENT_COLUMNS)

    candidate_cols = all_cols[age_idx + 1 :]
    response_cols = [c for c in candidate_cols if c not in _SF36_SKIP_COLUMNS]

    rows: list[dict] = []
    unmapped_values: dict[str, set[str]] = {}

    for idx in range(len(df)):
        row_data = df.iloc[idx]

        # Resolve person_id
        pid_raw = row_data.get("participant_id")
        if pid_raw is None or (isinstance(pid_raw, str) and not pid_raw.strip()):
            log.log(
                record_index=idx,
                column="participant_id",
                value=str(pid_raw),
                category=RejectionCategory.MISSING_REQUIRED,
                message="Missing participant_id in SF-36",
            )
            continue

        pid_series = registry.resolve_series(pd.Series([pid_raw]))
        pid = pid_series.iloc[0]
        if pd.isna(pid):
            log.log(
                record_index=idx,
                column="participant_id",
                value=str(pid_raw),
                category=RejectionCategory.MISSING_REQUIRED,
                message="Unresolved participant_id in SF-36",
            )
            continue

        pid_int = int(pid)

        # Parse visit_date
        visit_date_raw = row_data.get("visit_date")
        if visit_date_raw is None or (isinstance(visit_date_raw, str) and not visit_date_raw.strip()):
            log.log(
                record_index=idx,
                column="visit_date",
                value=str(visit_date_raw),
                category=RejectionCategory.DATE_ASSEMBLY_FAILED,
                message="Missing visit_date in SF-36",
            )
            continue

        vd_parsed = pd.to_datetime(str(visit_date_raw), format="mixed", errors="coerce")
        if pd.isna(vd_parsed):
            log.log(
                record_index=idx,
                column="visit_date",
                value=str(visit_date_raw),
                category=RejectionCategory.DATE_ASSEMBLY_FAILED,
                message="Unparseable visit_date in SF-36",
            )
            continue

        visit_date_str = vd_parsed.strftime("%Y-%m-%d")

        # Resolve visit_occurrence_id
        visit_label_raw = row_data.get("visit")
        vlabel = str(visit_label_raw) if visit_label_raw is not None and str(visit_label_raw).strip() else None
        visit_occ_id = resolver.resolve(pid_int, visit_date_str, vlabel)

        # Process each response column
        for col in response_cols:
            raw_value = row_data.get(col)

            # Skip null/empty values
            if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
                continue
            if not isinstance(raw_value, str):
                # Numeric NaN check
                try:
                    if pd.isna(raw_value):
                        continue
                except (TypeError, ValueError):
                    pass

            text_value = str(raw_value).strip()
            if not text_value:
                continue

            # Look up Likert encoding
            scale = _SF36_COLUMN_SCALE.get(col)
            value_as_number = None
            if scale is not None:
                encoded = scale.get(text_value)
                if encoded is not None:
                    value_as_number = float(encoded)
                else:
                    # Track unmapped values for logging
                    if col not in unmapped_values:
                        unmapped_values[col] = set()
                    unmapped_values[col].add(text_value)
            else:
                # Column not in scale mapping -- still emit with text only
                if col not in unmapped_values:
                    unmapped_values[col] = set()
                unmapped_values[col].add(f"[no scale for column {col}]")

            measurement_row = {
                "measurement_id": 0,
                "person_id": pid_int,
                "measurement_concept_id": 0,  # No LOINC for individual SF-36 items
                "measurement_date": visit_date_str,
                "measurement_type_concept_id": _MEASUREMENT_TYPE_SURVEY,
                "operator_concept_id": _OPERATOR_EQUALS,
                "value_as_number": value_as_number,
                "value_as_concept_id": None,
                "unit_concept_id": 0,
                "range_low": None,
                "range_high": None,
                "provider_id": None,
                "visit_occurrence_id": visit_occ_id,
                "visit_detail_id": None,
                "measurement_source_value": col,
                "measurement_source_concept_id": 0,
                "unit_source_value": None,
                "unit_source_concept_id": 0,
                "value_source_value": text_value,
            }
            rows.append(measurement_row)

    # Log unmapped values summary
    for col, values in unmapped_values.items():
        logger.warning("SF-36 unmapped values in %s: %s", col, sorted(values))

    result = pd.DataFrame(rows, columns=_MEASUREMENT_COLUMNS)
    logger.info("SF-36 measurements: %d rows produced", len(result))

    return result


def _write_combined_rejections(
    path: object,
    logs: list[tuple[str, RejectionLog]],
) -> None:
    """Write multiple rejection logs into a single combined CSV.

    Args:
        path: Output file path (Path or str).
        logs: List of (source_name, RejectionLog) tuples.
    """
    import csv as csv_mod

    headers = ["source", "record_index", "column", "value", "category", "message", "timestamp"]
    with open(path, "w", newline="") as f:  # type: ignore[arg-type]
        writer = csv_mod.writer(f)
        writer.writerow(headers)
        for source_name, log in logs:
            for entry in log.entries:
                writer.writerow([
                    source_name,
                    entry.record_index,
                    entry.column,
                    entry.value,
                    entry.category.value,
                    entry.message,
                    entry.timestamp,
                ])


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


def transform_measurements(config: ETLConfig) -> pd.DataFrame:
    """Transform all measurement sources into OMOP measurement staging CSV.

    Processes growth, CSS, lab, and SF-36 measurement sources. Computes
    and logs mapping coverage rate for growth + labs combined (MEAS-05).

    Args:
        config: ETL configuration.

    Returns:
        DataFrame with all measurement rows, sequential measurement_ids assigned.
    """
    staging_dir = config.staging_dir
    staging_dir.mkdir(parents=True, exist_ok=True)

    # Load dependencies from earlier phases
    registry = PersonIdRegistry.from_csv(staging_dir / "person_id_map.csv")
    resolver = VisitResolver.from_csv(staging_dir / "visit_id_map.csv")

    # Growth measurements
    growth_log = RejectionLog("measurement_growth")
    growth_df = transform_growth(config, registry, resolver, growth_log)

    # CSS measurements
    css_log = RejectionLog("measurement_css")
    css_df = transform_css(config, registry, resolver, css_log)

    # Lab measurements
    labs_log = RejectionLog("measurement_labs")
    labs_df = transform_labs(config, registry, resolver, labs_log)

    # SF-36 measurements
    sf36_log = RejectionLog("measurement_sf36")
    sf36_df = transform_sf36(config, registry, resolver, sf36_log)

    # Mapping coverage rate (MEAS-05): growth + labs combined
    growth_mapped = int((growth_df["measurement_concept_id"] != 0).sum()) if len(growth_df) > 0 else 0
    growth_total = len(growth_df)
    labs_mapped = int((labs_df["measurement_concept_id"] != 0).sum()) if len(labs_df) > 0 else 0
    labs_snomed = int((labs_df["measurement_source_concept_id"] > 0).sum()) if len(labs_df) > 0 else 0
    labs_total = len(labs_df)

    if (growth_total + labs_total) > 0:
        coverage = (growth_mapped + labs_mapped + labs_snomed) / (growth_total + labs_total)
        logger.info(
            "Measurement mapping coverage: %.1f%% (target >= 95%%) "
            "[growth=%d/%d, labs_loinc=%d, labs_snomed=%d, labs_total=%d]",
            coverage * 100,
            growth_mapped,
            growth_total,
            labs_mapped,
            labs_snomed,
            labs_total,
        )
    else:
        coverage = 0.0
        logger.warning("No growth or lab measurements to compute coverage")

    # Combine all measurement sources
    all_measurements = pd.concat(
        [growth_df, css_df, labs_df, sf36_df], ignore_index=True
    )

    # Assign sequential measurement_ids starting from 1
    all_measurements = all_measurements.copy()
    all_measurements["measurement_id"] = range(1, len(all_measurements) + 1)

    # Validate against Pandera schema
    validated = measurement_schema.validate(all_measurements)

    # Write output
    output_path = staging_dir / "measurement.csv"
    validated.to_csv(output_path, index=False)
    logger.info("Wrote measurement.csv: %d rows -> %s", len(validated), output_path)

    # Write rejection reports
    reports_dir = config.reports_dir
    reports_dir.mkdir(parents=True, exist_ok=True)
    growth_log.to_csv(reports_dir / "measurement_growth_rejections.csv")
    css_log.to_csv(reports_dir / "measurement_css_rejections.csv")
    labs_log.to_csv(reports_dir / "measurement_labs_rejections.csv")
    sf36_log.to_csv(reports_dir / "measurement_sf36_rejections.csv")

    # Combined rejection report -- write all logs to a single file
    combined_path = reports_dir / "measurement_etl_rejections.csv"
    _write_combined_rejections(
        combined_path,
        [
            ("growth", growth_log),
            ("css", css_log),
            ("labs", labs_log),
            ("sf36", sf36_log),
        ],
    )

    return validated
