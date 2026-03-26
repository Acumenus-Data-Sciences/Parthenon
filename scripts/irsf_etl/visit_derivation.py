"""Visit derivation for the IRSF ETL pipeline.

Derives visit_occurrence records from the IRSF-NHS registry dataset by scanning
study visits (LogMasterForm_5211 + 5201 clinical tables) and hospitalization/ER
records (Hospitalizations_5211), classifying by visit type, deduplicating, and
producing staging/visit_occurrence.csv and staging/visit_id_map.csv.

Exports:
    derive_visits: Main orchestrator producing both output CSVs.
    collect_study_visits_5211: Extract study visits from LogMasterForm_5211.
    collect_study_visits_5201: Extract study visits from 5201 clinical tables.
    collect_hospitalization_visits: Extract inpatient/ER visits from Hospitalizations_5211.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog
from scripts.irsf_etl.schemas.visit_occurrence import visit_occurrence_schema

logger = logging.getLogger(__name__)

# OMOP visit concept IDs
_INPATIENT = 9201
_OUTPATIENT = 9202
_ER_VISIT = 9203
_VISIT_TYPE_SURVEY = 32882

# Hospitalization TypeOfVisit mapping
_HOSP_TYPE_MAP: dict[str, int] = {
    "Hospital": _INPATIENT,
    "ER": _ER_VISIT,
}

# Internal column set for intermediate DataFrames
_VISIT_COLS = ["person_id", "visit_date", "visit_label", "visit_concept_id", "source_file"]


def collect_study_visits_5211(
    config: ETLConfig,
    registry: PersonIdRegistry,
    log: RejectionLog,
) -> pd.DataFrame:
    """Collect study visits from LogMasterForm_5211.csv.

    Each row represents a study assessment visit. The visit column contains
    the timepoint label (Baseline, 1 year, etc.) and visit_date has the date.

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with columns: person_id, visit_date, visit_label,
        visit_concept_id, source_file.
    """
    csv_path = config.source_custom_extracts / "csv" / "LogMasterForm_5211.csv"
    df = read_csv_safe(csv_path)
    log.set_processed_count(log._processed_count + len(df))
    source_file = "LogMasterForm_5211.csv"

    rows: list[dict] = []
    for idx, row in df.iterrows():
        # Resolve participant_id to person_id
        raw_pid = row.get("participant_id")
        if raw_pid is None or pd.isna(raw_pid):
            log.log(
                int(idx), "participant_id", str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                "Missing participant_id in LogMasterForm_5211",
            )
            continue

        person_id = registry.resolve(int(float(str(raw_pid))))
        if person_id is None:
            log.log(
                int(idx), "participant_id", str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                "Unresolved participant_id in LogMasterForm_5211",
            )
            continue

        # Parse visit_date
        raw_date = row.get("visit_date")
        if raw_date is None or pd.isna(raw_date):
            log.log(
                int(idx), "visit_date", str(raw_date),
                RejectionCategory.MISSING_REQUIRED,
                "Missing visit_date in LogMasterForm_5211",
            )
            continue

        try:
            visit_date = pd.to_datetime(str(raw_date), format="mixed", dayfirst=False)
        except (ValueError, TypeError):
            log.log(
                int(idx), "visit_date", str(raw_date),
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                f"Unparseable visit_date: {raw_date}",
            )
            continue

        # Handle empty visit labels
        raw_label = row.get("visit")
        if raw_label is None or pd.isna(raw_label) or str(raw_label).strip() == "":
            visit_label = "Unscheduled"
        else:
            visit_label = str(raw_label).strip()

        rows.append({
            "person_id": person_id,
            "visit_date": visit_date.strftime("%Y-%m-%d"),
            "visit_label": visit_label,
            "visit_concept_id": _OUTPATIENT,
            "source_file": source_file,
        })

    result = pd.DataFrame(rows, columns=_VISIT_COLS)
    logger.info(
        "Collected %d study visits from LogMasterForm_5211 (%d rows processed)",
        len(result), len(df),
    )
    return result


def collect_study_visits_5201(
    config: ETLConfig,
    registry: PersonIdRegistry,
    log: RejectionLog,
) -> pd.DataFrame:
    """Collect study visits from 5201 clinical tables for 5201-only patients.

    5201-only patients are those with participant_id5201 but no participant_id5211
    in the registry. We scan ClinicalAssessment.csv and Measurements.csv from
    the 5201 source directory.

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with columns: person_id, visit_date, visit_label,
        visit_concept_id, source_file.
    """
    # Identify 5201-only person_ids: those with participant_id5201 but no participant_id5211
    registry_df = registry.to_dataframe()
    only_5201_mask = registry_df["participant_id5201"].notna() & registry_df["participant_id5211"].isna()
    only_5201_pids = set(registry_df.loc[only_5201_mask, "participant_id5201"].dropna().astype(int))

    if not only_5201_pids:
        logger.info("No 5201-only patients found; skipping 5201 visit collection")
        return pd.DataFrame(columns=_VISIT_COLS)

    logger.info("Found %d 5201-only patients to scan", len(only_5201_pids))

    # Scan representative 5201 clinical tables
    tables_to_scan = ["ClinicalAssessment.csv", "Measurements.csv"]
    all_rows: list[dict] = []

    for table_name in tables_to_scan:
        csv_path = config.source_5201 / "csv" / table_name
        if not csv_path.exists():
            logger.warning("5201 table not found: %s", csv_path)
            continue

        df = read_csv_safe(csv_path)
        log.set_processed_count(log._processed_count + len(df))

        # 5201 tables use Participant_ID (capitalized)
        pid_col = "Participant_ID"
        if pid_col not in df.columns:
            logger.warning("Column %s not found in %s", pid_col, table_name)
            continue

        for idx, row in df.iterrows():
            raw_pid = row.get(pid_col)
            if raw_pid is None or pd.isna(raw_pid):
                continue

            pid_int = int(float(str(raw_pid)))
            if pid_int not in only_5201_pids:
                continue

            person_id = registry.resolve(pid_int, protocol="5201")
            if person_id is None:
                log.log(
                    int(idx), pid_col, str(raw_pid),
                    RejectionCategory.MISSING_REQUIRED,
                    f"Unresolved 5201 participant_id in {table_name}",
                )
                continue

            # Parse Visit_Date
            raw_date = row.get("Visit_Date")
            if raw_date is None or pd.isna(raw_date):
                continue

            try:
                visit_date = pd.to_datetime(str(raw_date), format="mixed", dayfirst=False)
            except (ValueError, TypeError):
                log.log(
                    int(idx), "Visit_Date", str(raw_date),
                    RejectionCategory.DATE_ASSEMBLY_FAILED,
                    f"Unparseable Visit_Date in {table_name}",
                )
                continue

            raw_label = row.get("Visit")
            if raw_label is None or pd.isna(raw_label) or str(raw_label).strip() == "":
                visit_label = "Unscheduled"
            else:
                visit_label = str(raw_label).strip()

            all_rows.append({
                "person_id": person_id,
                "visit_date": visit_date.strftime("%Y-%m-%d"),
                "visit_label": visit_label,
                "visit_concept_id": _OUTPATIENT,
                "source_file": table_name,
            })

    result = pd.DataFrame(all_rows, columns=_VISIT_COLS)

    # Filter out PRN visits that duplicate dates already seen for this person
    if not result.empty:
        non_prn = result[result["visit_label"] != "PRN"]
        prn = result[result["visit_label"] == "PRN"]
        if not prn.empty:
            existing_keys = set(zip(non_prn["person_id"], non_prn["visit_date"]))
            prn_keep = prn[
                ~prn.apply(
                    lambda r: (r["person_id"], r["visit_date"]) in existing_keys,
                    axis=1,
                )
            ]
            result = pd.concat([non_prn, prn_keep], ignore_index=True)

    logger.info("Collected %d study visits from 5201 tables", len(result))
    return result


def collect_hospitalization_visits(
    config: ETLConfig,
    registry: PersonIdRegistry,
    log: RejectionLog,
) -> pd.DataFrame:
    """Collect hospitalization/ER visits from Hospitalizations_5211.csv.

    Each row is an unpivoted hospitalization or ER visit with split-date columns
    (MonthDateVisit, DayDateVisit, YearDateVisit) and TypeOfVisit classification.

    Args:
        config: ETL configuration with source paths.
        registry: Person ID registry for participant_id resolution.
        log: Rejection log for tracking skipped rows.

    Returns:
        DataFrame with columns: person_id, visit_date, visit_label,
        visit_concept_id, source_file.
    """
    csv_path = config.source_custom_extracts / "csv" / "Hospitalizations_5211.csv"
    df = read_csv_safe(csv_path)
    log.set_processed_count(log._processed_count + len(df))
    source_file = "Hospitalizations_5211.csv"

    rows: list[dict] = []
    for idx, row in df.iterrows():
        # Resolve participant_id
        raw_pid = row.get("participant_id")
        if raw_pid is None or pd.isna(raw_pid):
            log.log(
                int(idx), "participant_id", str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                "Missing participant_id in Hospitalizations_5211",
            )
            continue

        person_id = registry.resolve(int(float(str(raw_pid))))
        if person_id is None:
            log.log(
                int(idx), "participant_id", str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                "Unresolved participant_id in Hospitalizations_5211",
            )
            continue

        # Map TypeOfVisit
        type_of_visit = row.get("TypeOfVisit")
        if type_of_visit is None or pd.isna(type_of_visit):
            log.log(
                int(idx), "TypeOfVisit", str(type_of_visit),
                RejectionCategory.MISSING_REQUIRED,
                "Missing TypeOfVisit in Hospitalizations_5211",
            )
            continue

        type_str = str(type_of_visit).strip()
        visit_concept_id = _HOSP_TYPE_MAP.get(type_str)
        if visit_concept_id is None:
            log.log(
                int(idx), "TypeOfVisit", type_str,
                RejectionCategory.INVALID_VALUE,
                f"Unknown TypeOfVisit: {type_str}",
            )
            continue

        # Assemble hospitalization date from split columns
        month_raw = row.get("MonthDateVisit")
        day_raw = row.get("DayDateVisit")
        year_raw = row.get("YearDateVisit")
        date_unknown = row.get("DateUnknown")

        assembled = assemble_date(
            month_raw if not pd.isna(month_raw) else None if month_raw is not None else None,
            day_raw if not pd.isna(day_raw) else None if day_raw is not None else None,
            year_raw if not pd.isna(year_raw) else None if year_raw is not None else None,
            max_year=2026,
        )

        if assembled is None:
            # Check if DateUnknown is set
            if date_unknown is not None and not pd.isna(date_unknown):
                log.log(
                    int(idx), "MonthDateVisit/DayDateVisit/YearDateVisit",
                    f"{month_raw}/{day_raw}/{year_raw}",
                    RejectionCategory.DATE_ASSEMBLY_FAILED,
                    "Hospitalization date unknown (DateUnknown flag set)",
                )
                continue

            log.log(
                int(idx), "MonthDateVisit/DayDateVisit/YearDateVisit",
                f"{month_raw}/{day_raw}/{year_raw}",
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                "Could not assemble hospitalization date",
            )
            continue

        visit_label = type_str  # "Hospital" or "ER"

        rows.append({
            "person_id": person_id,
            "visit_date": assembled.strftime("%Y-%m-%d"),
            "visit_label": visit_label,
            "visit_concept_id": visit_concept_id,
            "source_file": source_file,
        })

    result = pd.DataFrame(rows, columns=_VISIT_COLS)
    logger.info(
        "Collected %d hospitalization/ER visits from Hospitalizations_5211 (%d rows processed)",
        len(result), len(df),
    )
    return result


def derive_visits(config: ETLConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Derive visit_occurrence records from all IRSF sources.

    Orchestrates the full visit derivation pipeline:
    1. Load PersonIdRegistry from staging/person_id_map.csv
    2. Collect study visits (5211 + 5201-only patients)
    3. Collect hospitalization/ER visits
    4. Merge, deduplicate, assign deterministic IDs
    5. Validate against Pandera schema
    6. Write staging CSVs

    Args:
        config: ETL configuration.

    Returns:
        Tuple of (visit_occurrence_df, visit_id_map_df).
    """
    # Load dependencies
    person_id_map_path = config.staging_dir / "person_id_map.csv"
    registry = PersonIdRegistry.from_csv(person_id_map_path)
    logger.info("Loaded PersonIdRegistry with %d entries", len(registry))

    log = RejectionLog("visit_derivation")

    # Collect from all sources
    study_5211 = collect_study_visits_5211(config, registry, log)
    study_5201 = collect_study_visits_5201(config, registry, log)
    hosp_visits = collect_hospitalization_visits(config, registry, log)

    # Concatenate all sources
    all_visits = pd.concat([study_5211, study_5201, hosp_visits], ignore_index=True)
    logger.info("Total visits before dedup: %d", len(all_visits))

    if all_visits.empty:
        logger.warning("No visits collected from any source")
        empty_vo = pd.DataFrame(columns=[
            "visit_occurrence_id", "person_id", "visit_concept_id",
            "visit_start_date", "visit_end_date", "visit_type_concept_id",
            "visit_source_value", "visit_source_concept_id",
            "provider_id", "care_site_id",
            "admitted_from_concept_id", "admitted_from_source_value",
            "discharged_to_concept_id", "discharged_to_source_value",
            "preceding_visit_occurrence_id",
        ])
        empty_map = pd.DataFrame(columns=[
            "visit_occurrence_id", "person_id", "visit_date",
            "visit_label", "visit_concept_id", "source_file",
        ])
        return empty_vo, empty_map

    # Deduplicate on (person_id, visit_date, visit_concept_id), keeping first
    all_visits = all_visits.drop_duplicates(
        subset=["person_id", "visit_date", "visit_concept_id"],
        keep="first",
    )
    logger.info("Visits after dedup: %d", len(all_visits))

    # Sort for deterministic ID assignment
    all_visits = all_visits.sort_values(
        by=["person_id", "visit_date", "visit_concept_id"],
    ).reset_index(drop=True)

    # Assign deterministic visit_occurrence_id starting from 1
    all_visits = all_visits.assign(
        visit_occurrence_id=range(1, len(all_visits) + 1),
    )

    # Build visit_occurrence DataFrame (OMOP CDM format)
    visit_occurrence = pd.DataFrame({
        "visit_occurrence_id": all_visits["visit_occurrence_id"],
        "person_id": all_visits["person_id"],
        "visit_concept_id": all_visits["visit_concept_id"],
        "visit_start_date": all_visits["visit_date"],
        "visit_end_date": all_visits["visit_date"],  # single-day visits
        "visit_type_concept_id": _VISIT_TYPE_SURVEY,
        "visit_source_value": all_visits["visit_label"],
        "visit_source_concept_id": 0,
        "provider_id": None,
        "care_site_id": None,
        "admitted_from_concept_id": None,
        "admitted_from_source_value": None,
        "discharged_to_concept_id": None,
        "discharged_to_source_value": None,
        "preceding_visit_occurrence_id": None,
    })

    # Build visit_id_map for downstream lookup
    visit_id_map = pd.DataFrame({
        "visit_occurrence_id": all_visits["visit_occurrence_id"],
        "person_id": all_visits["person_id"],
        "visit_date": all_visits["visit_date"],
        "visit_label": all_visits["visit_label"],
        "visit_concept_id": all_visits["visit_concept_id"],
        "source_file": all_visits["source_file"],
    })

    # Validate against Pandera schema
    visit_occurrence_schema.validate(visit_occurrence)
    logger.info("visit_occurrence passed Pandera schema validation")

    # Write outputs
    config.staging_dir.mkdir(parents=True, exist_ok=True)
    visit_occurrence.to_csv(config.staging_dir / "visit_occurrence.csv", index=False)
    visit_id_map.to_csv(config.staging_dir / "visit_id_map.csv", index=False)
    logger.info(
        "Wrote staging/visit_occurrence.csv (%d rows) and staging/visit_id_map.csv (%d rows)",
        len(visit_occurrence), len(visit_id_map),
    )

    # Write rejection report
    if log.entries:
        report_dir = config.reports_dir
        report_dir.mkdir(parents=True, exist_ok=True)
        log.to_csv(report_dir / "visit_derivation_rejections.csv")
        summary = log.summary()
        logger.info(
            "Rejection summary: %d errors, %d warnings out of %d processed",
            summary.total_rejected, summary.total_warnings, summary.total_processed,
        )
    else:
        logger.info("No rejections during visit derivation")

    return visit_occurrence, visit_id_map
