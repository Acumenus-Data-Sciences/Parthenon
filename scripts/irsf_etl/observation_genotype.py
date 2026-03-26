"""Genotype boolean-to-observation transformer.

Transforms ~48 mutation boolean columns from Person_Characteristics_5201_5211.csv
into OMOP observation rows, emitting ONLY rows where the boolean value is 1
(mutation present). This prevents ~87K meaningless "mutation absent" rows.

Each patient's MECP2/CDKL5/FOXG1 mutation profile is stored as structured
observations with custom IRSF vocabulary concepts (2,000,003,000 range).

Exports:
    transform_genotype_observations: Main transformer producing observation staging CSV.
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
from scripts.irsf_etl.schemas.observation import observation_schema

logger = logging.getLogger(__name__)

# OMOP constants for genotype observations
_OBS_TYPE_REGISTRY = 32879  # Registry
_VALUE_AS_CONCEPT_PRESENT = 4181412  # Present

# Mutation column heuristic: columns containing these substrings are mutation booleans
_MUTATION_PREFIXES = (
    "CommonMECP2Mutations_",
    "CommonMECP2Deletions_",
    "MECP2LargeDeletions_",
    "OtherMCP2",
    "OtherMECP2",
    "MCP2Duplications",
    "CDKL5Mutations",
    "CDKL5MutationsOther",
    "FOXG1Mutations",
    "FOXG1MutationsOther",
)


def _build_mutation_column_map() -> dict[str, ConceptDefinition]:
    """Build source_column -> ConceptDefinition lookup from IrsfVocabulary.

    Returns:
        Dict mapping CSV column names to their IRSF mutation concept definitions.
    """
    return {
        c.source_column: c
        for c in IrsfVocabulary.mutation_concepts()
        if c.source_column is not None
    }


def _is_mutation_column(col: str) -> bool:
    """Return True if column name looks like a mutation boolean column."""
    return any(col.startswith(prefix) for prefix in _MUTATION_PREFIXES)


def _coerce_to_int(value: object) -> int | None:
    """Coerce a value to int, returning None for non-numeric/NaN/empty values.

    Handles: NaN, None, pd.NA, empty string, "0", 0, "1", 1, float values.
    """
    if value is None or value is pd.NA:
        return None
    s = str(value).strip()
    if s == "" or s.lower() == "nan" or s.lower() == "none":
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _build_dob_lookup(person_csv_path: Path) -> dict[int, str]:
    """Build person_id -> DOB date string lookup from person.csv.

    Args:
        person_csv_path: Path to staging/person.csv with year/month/day_of_birth.

    Returns:
        Dict mapping person_id to ISO date string (YYYY-MM-DD).
    """
    dob_map: dict[int, str] = {}

    if not person_csv_path.exists():
        logger.warning("person.csv not found at %s -- using fallback DOB", person_csv_path)
        return dob_map

    person_df = pd.read_csv(person_csv_path)

    for _, row in person_df.iterrows():
        pid = _coerce_to_int(row.get("person_id"))
        if pid is None:
            continue

        year = _coerce_to_int(row.get("year_of_birth"))
        month = _coerce_to_int(row.get("month_of_birth"))
        day = _coerce_to_int(row.get("day_of_birth"))

        if year is not None:
            # Default month/day if missing
            m = month if month is not None else 1
            d = day if day is not None else 1
            dob_map[pid] = f"{year:04d}-{m:02d}-{d:02d}"

    logger.info("Built DOB lookup for %d persons", len(dob_map))
    return dob_map


def transform_genotype_observations(
    config: ETLConfig,
    *,
    observation_id_offset: int = 0,
) -> pd.DataFrame:
    """Transform genotype boolean columns to OMOP observation rows.

    Only emits rows where the boolean value is 1 (mutation present).
    Uses DOB as observation_date (genotype is innate/atemporal).
    visit_occurrence_id is always NULL for genotype observations.

    Pipeline:
    1. Load Person_Characteristics_5201_5211.csv
    2. Resolve person_ids via PersonIdRegistry
    3. Load DOB data from person.csv
    4. Build mutation column -> concept lookup
    5. Melt boolean columns to long format
    6. Filter to value == 1 only (critical optimization)
    7. Map concept_ids and build observation columns
    8. Assign sequential observation_ids
    9. Validate against pandera schema
    10. Write staging CSV

    Args:
        config: ETL configuration with source and output paths.
        observation_id_offset: Starting observation_id (to avoid collisions with MBA).

    Returns:
        DataFrame of OMOP observation rows.
    """
    rejection_log = RejectionLog("observation_genotype")

    # 1. Load source data
    source_path = (
        config.source_custom_extracts / "csv" / "Person_Characteristics_5201_5211.csv"
    )
    logger.info("Loading Person_Characteristics from %s", source_path)
    raw = read_csv_safe(source_path)
    rejection_log.set_processed_count(len(raw))
    logger.info("Loaded %d Person_Characteristics rows", len(raw))

    # 2. Load person registry
    registry = PersonIdRegistry.from_csv(config.staging_dir / "person_id_map.csv")

    # 3. Load DOB lookup from person.csv
    dob_map = _build_dob_lookup(config.staging_dir / "person.csv")
    fallback_dob = "1900-01-01"

    # 4. Build column-to-concept map
    mutation_map = _build_mutation_column_map()
    mapped_columns = [col for col in mutation_map if col in raw.columns]
    missing_vocab_cols = [col for col in mutation_map if col not in raw.columns]

    if missing_vocab_cols:
        logger.warning(
            "Vocabulary defines %d mutation columns not in source CSV: %s",
            len(missing_vocab_cols),
            missing_vocab_cols,
        )

    # 5. Detect unmapped mutation columns in CSV (like C916TR306C)
    csv_mutation_cols = [col for col in raw.columns if _is_mutation_column(col)]
    unmapped_csv_cols = [col for col in csv_mutation_cols if col not in mutation_map]
    if unmapped_csv_cols:
        logger.warning(
            "Source CSV has %d mutation-like columns not in vocabulary (skipping): %s",
            len(unmapped_csv_cols),
            unmapped_csv_cols,
        )

    logger.info(
        "Found %d/%d mutation columns in source data",
        len(mapped_columns),
        len(mutation_map),
    )

    # 6. Resolve person_id and DOB for each row
    person_ids: list[int | None] = []
    dob_dates: list[str] = []
    valid_mask: list[bool] = []

    for idx, row in raw.iterrows():
        raw_pid = row.get("participant_id")
        if pd.isna(raw_pid):
            rejection_log.log(
                int(idx),
                "participant_id",
                str(raw_pid),
                RejectionCategory.MISSING_REQUIRED,
                "NULL participant_id in Person_Characteristics row",
            )
            person_ids.append(None)
            dob_dates.append(fallback_dob)
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
            dob_dates.append(fallback_dob)
            valid_mask.append(False)
            continue

        person_ids.append(resolved)
        valid_mask.append(True)

        # Get DOB for this person
        dob = dob_map.get(resolved)
        if dob is None:
            logger.warning("No DOB found for person_id %d -- using fallback %s", resolved, fallback_dob)
            dob_dates.append(fallback_dob)
        else:
            dob_dates.append(dob)

    # Build working dataframe with person_id, dob, and mutation columns
    df_work = raw[mapped_columns].copy()
    df_work["person_id"] = person_ids
    df_work["observation_date"] = dob_dates
    df_work["_valid"] = valid_mask

    # Filter to valid rows only
    df_valid = df_work[df_work["_valid"]].copy()
    logger.info(
        "After person resolution: %d/%d rows valid",
        len(df_valid),
        len(df_work),
    )

    if df_valid.empty:
        logger.warning("No valid Person_Characteristics rows after person resolution")
        return pd.DataFrame(columns=[c for c in observation_schema.columns])

    # 7. Melt mutation boolean columns to long format
    melted = df_valid.melt(
        id_vars=["person_id", "observation_date"],
        value_vars=mapped_columns,
        var_name="source_column",
        value_name="raw_value",
    )

    pre_filter_count = len(melted)

    # 8. Coerce values to int and filter to value == 1 ONLY
    melted["int_value"] = melted["raw_value"].apply(_coerce_to_int)

    # CRITICAL FILTER: Only emit rows where value == 1 (mutation present)
    melted = melted[melted["int_value"] == 1].copy()

    logger.info(
        "After value==1 filter: %d/%d rows (filtered out %d non-mutation rows)",
        len(melted),
        pre_filter_count,
        pre_filter_count - len(melted),
    )

    if melted.empty:
        logger.warning("No mutation-present (value=1) rows found")
        return pd.DataFrame(columns=[c for c in observation_schema.columns])

    # 9. Map concept_ids and build observation columns
    melted["observation_concept_id"] = melted["source_column"].map(
        lambda col: mutation_map[col].concept_id
    )
    melted["observation_source_concept_id"] = melted["observation_concept_id"]
    melted["observation_source_value"] = melted["source_column"]
    melted["observation_type_concept_id"] = _OBS_TYPE_REGISTRY
    melted["value_as_number"] = 1.0
    melted["value_as_string"] = pd.NA
    melted["value_as_concept_id"] = pd.array(
        [_VALUE_AS_CONCEPT_PRESENT] * len(melted), dtype=pd.Int64Dtype()
    )
    melted["qualifier_source_value"] = pd.NA

    # visit_occurrence_id is NULL for genotype observations (atemporal)
    melted["visit_occurrence_id"] = pd.array(
        [pd.NA] * len(melted), dtype=pd.Int64Dtype()
    )

    # 10. Assign sequential observation_id
    melted = melted.reset_index(drop=True)
    melted["observation_id"] = range(
        observation_id_offset + 1,
        observation_id_offset + len(melted) + 1,
    )

    # 11. Select and order final columns
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

    # 12. Validate against pandera schema
    result = observation_schema.validate(result)
    logger.info("Schema validation passed: %d observation rows", len(result))

    # 13. Write staging CSV
    output_path = config.staging_dir / "observation_genotype.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(output_path, index=False)
    logger.info("Wrote %d genotype observation rows to %s", len(result), output_path)

    # 14. Log statistics
    unique_persons = result["person_id"].nunique()
    unique_concepts = result["observation_concept_id"].nunique()
    mutations_per_person = result.groupby("person_id").size()

    logger.info(
        "Genotype stats: %d persons, %d unique mutations, %.1f avg mutations/person",
        unique_persons,
        unique_concepts,
        mutations_per_person.mean() if not mutations_per_person.empty else 0,
    )
    logger.info(
        "Mutations per person distribution: min=%d, median=%.0f, max=%d",
        mutations_per_person.min() if not mutations_per_person.empty else 0,
        mutations_per_person.median() if not mutations_per_person.empty else 0,
        mutations_per_person.max() if not mutations_per_person.empty else 0,
    )

    # 15. Log rejection summary
    summary = rejection_log.summary()
    if summary.total_rejected > 0 or summary.total_warnings > 0:
        logger.info(
            "Rejection summary: %d errors, %d warnings (rate: %.2f%%)",
            summary.total_rejected,
            summary.total_warnings,
            summary.rejection_rate * 100,
        )
        reject_path = config.reports_dir / "observation_genotype_rejections.csv"
        reject_path.parent.mkdir(parents=True, exist_ok=True)
        rejection_log.to_csv(reject_path)
        logger.info("Wrote rejection report to %s", reject_path)

    return result
