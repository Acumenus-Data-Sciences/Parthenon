"""Measurement ETL module for IRSF Natural History Study.

Transforms wide-format measurement source data into OMOP CDM v5.4
measurement rows. Provides a reusable wide-to-long unpivot helper used
by growth, CSS, lab, and SF-36 measurement transformations.

Exports:
    transform_growth: Growth measurement unpivot (height, weight, BMI, FOC).
    transform_css: CSS (Clinical Severity Scale) measurement unpivot (14 items).
    unpivot_wide_to_long: Reusable wide-to-long helper for any measurement source.
    transform_measurements: Main orchestrator for all measurement sources.
"""

from __future__ import annotations

import logging
from typing import Optional

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
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
# Main orchestrator
# ---------------------------------------------------------------------------


def transform_measurements(config: ETLConfig) -> pd.DataFrame:
    """Transform all measurement sources into OMOP measurement staging CSV.

    Processes growth and CSS (Clinical Severity Scale) measurements.
    Plans 09-03 will add lab and SF-36 measurement sources.

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

    # Combine all measurement sources
    all_measurements = pd.concat([growth_df, css_df], ignore_index=True)

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

    return validated
