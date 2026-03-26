"""MBA (Motor Behavioral Assessment) observation transformer.

Unpivots wide-format MBA score columns into long-format OMOP observation rows,
mapping each of the 41 MBA items (37 individual + 3 subtotals + 1 grand total)
to custom IRSF vocabulary concept_ids (2,000,002,000 through 2,000,002,040).

NULL/NaN score values are filtered out -- no row emitted for blank/missing scores.
Comment columns are excluded from the unpivot.

Exports:
    transform_mba_observations: Main transformer producing observation staging CSV.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.irsf_vocabulary import ConceptDefinition, IrsfVocabulary
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.schemas.observation import observation_schema

logger = logging.getLogger(__name__)

# OMOP observation_type_concept_id for survey-sourced data
_OBS_TYPE_SURVEY = 32883


def _build_mba_column_map() -> dict[str, ConceptDefinition]:
    """Build source_column -> ConceptDefinition lookup from IrsfVocabulary.

    Returns:
        Dict mapping CSV column names to their IRSF MBA concept definitions.
    """
    return {
        c.source_column: c
        for c in IrsfVocabulary.mba_concepts()
        if c.source_column is not None
    }


def _is_comment_column(col: str) -> bool:
    """Return True if column name indicates a comment/free-text field."""
    lower = col.lower()
    return lower.endswith("comments") or lower.endswith("comm") or lower.endswith("comme")


def transform_mba_observations(config: ETLConfig) -> pd.DataFrame:
    """Transform MBA wide-format scores to OMOP observation rows.

    Pipeline:
    1. Load MBA_5201_5211.csv
    2. Resolve person_ids via PersonIdRegistry
    3. Parse visit_date
    4. Melt score columns to long format
    5. Filter NaN/NULL values
    6. Map to IRSF MBA concept_ids
    7. Resolve visit_occurrence_ids
    8. Assign sequential observation_ids
    9. Validate against pandera schema
    10. Write staging CSV

    Args:
        config: ETL configuration with source and output paths.

    Returns:
        DataFrame of OMOP observation rows.
    """
    rejection_log = RejectionLog("observation_mba")

    # 1. Load source data
    mba_path = config.source_custom_extracts / "csv" / "MBA_5201_5211.csv"
    logger.info("Loading MBA data from %s", mba_path)
    raw = read_csv_safe(mba_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d MBA rows", len(raw))

    # 2. Load person registry and visit resolver
    registry = PersonIdRegistry.from_csv(config.staging_dir / "person_id_map.csv")
    visit_resolver = VisitResolver.from_csv(config.staging_dir / "visit_id_map.csv")

    # 3. Build column-to-concept map
    mba_map = _build_mba_column_map()
    score_columns = [col for col in mba_map if col in raw.columns]
    missing_cols = [col for col in mba_map if col not in raw.columns]
    if missing_cols:
        logger.warning(
            "MBA source missing %d expected score columns: %s",
            len(missing_cols),
            missing_cols[:5],
        )

    logger.info(
        "Found %d/%d MBA score columns in source data",
        len(score_columns),
        len(mba_map),
    )

    # 4. Build observation rows via melt approach
    # First, resolve person_id for each row
    id_columns = ["participant_id", "visit_date"]
    keep_cols = id_columns + score_columns
    df_slim = raw[keep_cols].copy()

    # Resolve person_id from participant_id
    person_ids = []
    valid_mask = []
    for idx, row in df_slim.iterrows():
        raw_pid = row["participant_id"]
        if pd.isna(raw_pid):
            rejection_log.log(
                int(idx),
                "participant_id",
                str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                "NULL participant_id in MBA row",
            )
            person_ids.append(None)
            valid_mask.append(False)
            continue

        resolved = registry.resolve(int(float(str(raw_pid))))
        if resolved is None:
            rejection_log.log(
                int(idx),
                "participant_id",
                str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                f"Unresolvable participant_id: {raw_pid}",
            )
            person_ids.append(None)
            valid_mask.append(False)
            continue

        person_ids.append(resolved)
        valid_mask.append(True)

    df_slim["person_id"] = person_ids
    df_slim["_valid"] = valid_mask

    # Parse visit_date
    dates = []
    for idx, row in df_slim.iterrows():
        raw_date = row["visit_date"]
        if pd.isna(raw_date):
            dates.append(None)
            if row["_valid"]:
                rejection_log.log(
                    int(idx),
                    "visit_date",
                    str(raw_date),
                    RejectionCategory.DATE_ASSEMBLY_FAILED,
                    "NULL visit_date in MBA row",
                )
                df_slim.at[idx, "_valid"] = False
            continue

        try:
            parsed = pd.to_datetime(str(raw_date), format="mixed", dayfirst=False)
            dates.append(parsed.strftime("%Y-%m-%d"))
        except (ValueError, TypeError):
            dates.append(None)
            if row["_valid"]:
                rejection_log.log(
                    int(idx),
                    "visit_date",
                    str(raw_date),
                    RejectionCategory.DATE_ASSEMBLY_FAILED,
                    f"Unparseable visit_date: {raw_date}",
                )
                df_slim.at[idx, "_valid"] = False

    df_slim["observation_date"] = dates

    # Filter to valid rows only
    df_valid = df_slim[df_slim["_valid"]].copy()
    logger.info(
        "After person/date resolution: %d/%d rows valid",
        len(df_valid),
        len(df_slim),
    )

    if df_valid.empty:
        logger.warning("No valid MBA rows after person/date resolution")
        return pd.DataFrame(columns=[c for c in observation_schema.columns])

    # 5. Melt score columns to long format
    melted = df_valid.melt(
        id_vars=["person_id", "observation_date"],
        value_vars=score_columns,
        var_name="source_column",
        value_name="score",
    )

    # 6. Filter out NaN/NULL scores
    pre_filter_count = len(melted)
    melted = melted.dropna(subset=["score"])
    # Also filter out empty strings that might have survived
    melted = melted[melted["score"].astype(str).str.strip() != ""]
    logger.info(
        "After NULL filtering: %d/%d observation rows (dropped %d NaN/empty)",
        len(melted),
        pre_filter_count,
        pre_filter_count - len(melted),
    )

    if melted.empty:
        logger.warning("No non-NULL MBA scores found")
        return pd.DataFrame(columns=[c for c in observation_schema.columns])

    # 7. Map concept_ids and build observation columns
    melted["observation_concept_id"] = melted["source_column"].map(
        lambda col: mba_map[col].concept_id
    )
    melted["observation_source_concept_id"] = melted["observation_concept_id"]
    melted["observation_source_value"] = melted["source_column"]
    melted["observation_type_concept_id"] = _OBS_TYPE_SURVEY
    melted["value_as_number"] = pd.to_numeric(melted["score"], errors="coerce")
    melted["value_as_string"] = pd.NA
    melted["value_as_concept_id"] = pd.NA
    melted["qualifier_source_value"] = pd.NA

    # 8. Resolve visit_occurrence_id
    visit_ids = []
    for _, row in melted.iterrows():
        vid = visit_resolver.resolve(
            int(row["person_id"]),
            str(row["observation_date"]),
        )
        visit_ids.append(vid if vid is not None else pd.NA)

    melted["visit_occurrence_id"] = pd.array(visit_ids, dtype=pd.Int64Dtype())

    # 9. Assign sequential observation_id
    melted = melted.reset_index(drop=True)
    melted["observation_id"] = range(1, len(melted) + 1)

    # 10. Select and order final columns
    output_cols = [
        "observation_id",
        "person_id",
        "observation_concept_id",
        "observation_date",
        "observation_type_concept_id",
        "value_as_number",
        "value_as_string",
        "value_as_concept_id",
        "observation_source_value",
        "observation_source_concept_id",
        "visit_occurrence_id",
        "qualifier_source_value",
    ]
    result = melted[output_cols].copy()

    # 11. Validate against pandera schema
    result = observation_schema.validate(result)
    logger.info("Schema validation passed: %d observation rows", len(result))

    # 12. Write staging CSV
    output_path = config.staging_dir / "observation_mba.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output_path, index=False)
    logger.info("Wrote %d MBA observation rows to %s", len(result), output_path)

    # 13. Log rejection summary
    summary = rejection_log.summary()
    if summary.total_rejected > 0 or summary.total_warnings > 0:
        logger.info(
            "Rejection summary: %d errors, %d warnings (rate: %.2f%%)",
            summary.total_rejected,
            summary.total_warnings,
            summary.rejection_rate * 100,
        )
        # Write rejection CSV
        reject_path = config.reports_dir / "observation_mba_rejections.csv"
        reject_path.parent.mkdir(parents=True, exist_ok=True)
        rejection_log.to_csv(reject_path)
        logger.info("Wrote rejection report to %s", reject_path)

    return result
