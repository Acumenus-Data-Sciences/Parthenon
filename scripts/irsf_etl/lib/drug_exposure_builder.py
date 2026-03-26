"""Drug exposure builder for the IRSF ETL pipeline.

Transforms IRSF medication records into OMOP CDM v5.4 drug_exposure format.
Handles person ID resolution, date assembly from split columns, RxNorm code
extraction + vocabulary validation with Maps-to remapping, stop reason assembly,
visit resolution, and source value preservation.

Exports:
    DrugExposureStats: Frozen dataclass with transformation statistics.
    build_drug_exposures: Main builder function producing OMOP drug_exposure DataFrame.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

import pandas as pd

from scripts.irsf_etl.lib.date_assembler import assemble_date
from scripts.irsf_etl.lib.rejection_log import RejectionCategory, RejectionLog
from scripts.irsf_etl.lib.rxnorm_parser import assemble_stop_reason, parse_rxnorm_code

if TYPE_CHECKING:
    from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
    from scripts.irsf_etl.lib.vocab_validator import ConceptStatus, VocabularyValidator
    from scripts.irsf_etl.lib.visit_resolver import VisitResolver

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# OMOP concept_id for survey/registry data
_DRUG_TYPE_CONCEPT_ID = 32882


# ---------------------------------------------------------------------------
# Stats dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class DrugExposureStats:
    """Immutable statistics from drug exposure transformation."""

    total_input_rows: int
    total_output_rows: int
    mapped_count: int
    unmapped_count: int
    remapped_count: int
    date_fallback_count: int
    coverage_rate: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_str(value: Any) -> str:
    """Convert a value to string, returning '' for None/NaN/NA."""
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).strip()


def _parse_visit_date(visit_date_str: str) -> date | None:
    """Parse visit_date in MM/DD/YY format to a datetime.date.

    Returns None if parsing fails.
    """
    if not visit_date_str:
        return None
    try:
        dt = datetime.strptime(visit_date_str, "%m/%d/%y")
        return dt.date()
    except ValueError:
        pass
    # Try MM/DD/YYYY as fallback
    try:
        dt = datetime.strptime(visit_date_str, "%m/%d/%Y")
        return dt.date()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------


def build_drug_exposures(
    df: pd.DataFrame,
    registry: PersonIdRegistry,
    visit_resolver: VisitResolver,
    vocab_validator: VocabularyValidator | None,
    rejection_log: RejectionLog,
    *,
    max_year: int = 2026,
) -> tuple[pd.DataFrame, DrugExposureStats]:
    """Transform a medications DataFrame into OMOP drug_exposure format.

    Processing steps per row:
      1. Resolve participant_id -> person_id via registry
      2. Extract RxNorm concept_code via parse_rxnorm_code
      3. Assemble start date from split columns (visit_date fallback)
      4. Assemble end date from split columns (NULL when unavailable)
      5. Assemble stop_reason from ReasonForStoppin columns
      6. Preserve drug_source_value from MedRxNormCode or MedRxNormInput
      7. Batch vocabulary validation for extracted concept_codes
      8. Visit resolution via VisitResolver
      9. Assemble output DataFrame and compute stats

    Args:
        df: Source medications DataFrame with IRSF column names.
        registry: PersonIdRegistry for participant_id -> person_id resolution.
        visit_resolver: VisitResolver for visit_occurrence_id resolution.
        vocab_validator: VocabularyValidator for RxNorm code validation.
            Pass None for offline mode (all concept_ids default to 0).
        rejection_log: RejectionLog for tracking skipped/failed records.
        max_year: Maximum year for date assembly validation.

    Returns:
        Tuple of (OMOP drug_exposure DataFrame, DrugExposureStats).
    """
    total_input = len(df)
    rejection_log.set_processed_count(total_input)

    # Phase 1: Row-by-row extraction (person_id, dates, codes, source values)
    intermediate_rows: list[dict[str, Any]] = []
    concept_codes_by_index: dict[int, str] = {}  # output_index -> concept_code
    date_fallback_count = 0

    for idx, row in df.iterrows():
        row_idx = int(idx)  # type: ignore[arg-type]

        # Step 1: Person ID resolution
        participant_id_raw = _safe_str(row.get("participant_id", ""))
        if not participant_id_raw:
            rejection_log.log(
                row_idx,
                "participant_id",
                "",
                RejectionCategory.MISSING_REQUIRED,
                "Missing participant_id",
            )
            continue

        try:
            participant_id_int = int(float(participant_id_raw))
        except (ValueError, OverflowError):
            rejection_log.log(
                row_idx,
                "participant_id",
                participant_id_raw,
                RejectionCategory.MISSING_REQUIRED,
                f"Invalid participant_id: {participant_id_raw}",
            )
            continue

        person_id = registry.resolve(participant_id_int)
        if person_id is None:
            rejection_log.log(
                row_idx,
                "participant_id",
                participant_id_raw,
                RejectionCategory.MISSING_REQUIRED,
                f"Unresolved participant_id: {participant_id_raw}",
            )
            continue

        # Step 2: RxNorm code extraction
        med_rxnorm_code = _safe_str(row.get("MedRxNormCode", ""))
        parse_result = parse_rxnorm_code(med_rxnorm_code)

        # Step 3: Start date assembly
        start_month = row.get("DateStartedMonth")
        start_day = row.get("DateStartedDay")
        start_year = row.get("DateStartedYear")
        start_date = assemble_date(
            start_month, start_day, start_year, max_year=max_year
        )

        used_fallback = False
        if start_date is None:
            # Fallback to visit_date (MM/DD/YY format)
            visit_date_str = _safe_str(row.get("visit_date", ""))
            fallback_date = _parse_visit_date(visit_date_str)
            if fallback_date is not None:
                start_date = fallback_date
                used_fallback = True
                date_fallback_count += 1
                logger.debug(
                    "Row %d: used visit_date fallback %s for start_date",
                    row_idx,
                    fallback_date.isoformat(),
                )

        if start_date is None:
            rejection_log.log(
                row_idx,
                "DateStartedYear",
                _safe_str(start_year),
                RejectionCategory.DATE_ASSEMBLY_FAILED,
                "No start date available (split columns and visit_date all empty)",
            )
            continue

        # Step 4: End date assembly
        end_month = row.get("DateStoppedMonth")
        end_day = row.get("DateStoppedDay")
        end_year = row.get("DateStoppedYear")
        end_date = assemble_date(
            end_month, end_day, end_year, max_year=max_year
        )

        # Step 5: Stop reason assembly
        ineffective = _safe_str(row.get("ReasonForStoppin_Ineffective", ""))
        not_needed = _safe_str(row.get("ReasonForStoppin_Notneeded", ""))
        side_effects = _safe_str(row.get("ReasonForStoppin_Sideeffects", ""))
        stop_reason = assemble_stop_reason(ineffective, not_needed, side_effects)

        # Step 6: Source value preservation
        med_rxnorm_input = _safe_str(row.get("MedRxNormInput", ""))
        drug_source_value = med_rxnorm_code if med_rxnorm_code else med_rxnorm_input

        # Step 9: Visit resolution
        visit_date_raw = _safe_str(row.get("visit_date", ""))
        visit_date_parsed = _parse_visit_date(visit_date_raw)
        visit_occurrence_id: int | None = None
        if visit_date_parsed is not None:
            iso_visit_date = visit_date_parsed.isoformat()
            visit_occurrence_id = visit_resolver.resolve(person_id, iso_visit_date)

        # Build intermediate row
        output_idx = len(intermediate_rows)
        rec: dict[str, Any] = {
            "person_id": person_id,
            "drug_exposure_start_date": start_date.isoformat(),
            "drug_exposure_end_date": (
                end_date.isoformat() if end_date is not None else None
            ),
            "drug_type_concept_id": _DRUG_TYPE_CONCEPT_ID,
            "stop_reason": stop_reason,
            "visit_occurrence_id": visit_occurrence_id,
            "drug_source_value": drug_source_value if drug_source_value else None,
            "drug_source_concept_id": 0,
            "drug_concept_id": 0,
            "_concept_code": parse_result.concept_code,
        }
        intermediate_rows.append(rec)

        # Track concept_code for batch validation
        if parse_result.concept_code is not None:
            concept_codes_by_index[output_idx] = parse_result.concept_code

    # Phase 2: Batch vocabulary validation
    remapped_count = 0
    mapped_count = 0
    unmapped_count = 0

    if vocab_validator is not None and concept_codes_by_index:
        from scripts.irsf_etl.lib.vocab_validator import ConceptStatus

        unique_codes = list(set(concept_codes_by_index.values()))
        validation_results = vocab_validator.validate_batch_codes(
            unique_codes, "RxNorm"
        )

        for output_idx, concept_code in concept_codes_by_index.items():
            result = validation_results.get(concept_code)
            if result is None:
                continue

            rec = intermediate_rows[output_idx]

            if result.status == ConceptStatus.STANDARD:
                rec["drug_concept_id"] = result.resolved_id
                rec["drug_source_concept_id"] = result.original_id

            elif result.status == ConceptStatus.DEPRECATED_REMAPPED:
                rec["drug_concept_id"] = result.resolved_id
                rec["drug_source_concept_id"] = result.original_id
                remapped_count += 1
                rejection_log.log(
                    output_idx,
                    "MedRxNormCode",
                    concept_code,
                    RejectionCategory.DEPRECATED_REMAPPED,
                    result.message,
                )

            elif result.status == ConceptStatus.NON_STANDARD:
                rec["drug_concept_id"] = result.resolved_id
                rec["drug_source_concept_id"] = result.original_id

            elif result.status in (
                ConceptStatus.NOT_FOUND,
                ConceptStatus.DEPRECATED_NO_REPLACEMENT,
            ):
                rec["drug_concept_id"] = 0
                rec["drug_source_concept_id"] = 0
                rejection_log.log(
                    output_idx,
                    "MedRxNormCode",
                    concept_code,
                    RejectionCategory.UNMAPPED_CONCEPT,
                    result.message,
                )

    # Phase 3: Compute stats and build output DataFrame
    output_rows: list[dict[str, Any]] = []
    for i, rec in enumerate(intermediate_rows):
        drug_concept_id = rec["drug_concept_id"]
        if drug_concept_id > 0:
            mapped_count += 1
        else:
            unmapped_count += 1

        output_rows.append({
            "drug_exposure_id": i + 1,
            "person_id": rec["person_id"],
            "drug_concept_id": drug_concept_id,
            "drug_exposure_start_date": rec["drug_exposure_start_date"],
            "drug_exposure_end_date": rec["drug_exposure_end_date"],
            "drug_type_concept_id": rec["drug_type_concept_id"],
            "stop_reason": rec["stop_reason"],
            "visit_occurrence_id": rec["visit_occurrence_id"],
            "drug_source_value": rec["drug_source_value"],
            "drug_source_concept_id": rec["drug_source_concept_id"],
        })

    if output_rows:
        result_df = pd.DataFrame(output_rows)
        # Ensure nullable integer columns use Int64Dtype
        for col in ("visit_occurrence_id", "drug_source_concept_id"):
            result_df[col] = result_df[col].astype(pd.Int64Dtype())
    else:
        result_df = pd.DataFrame(columns=[
            "drug_exposure_id",
            "person_id",
            "drug_concept_id",
            "drug_exposure_start_date",
            "drug_exposure_end_date",
            "drug_type_concept_id",
            "stop_reason",
            "visit_occurrence_id",
            "drug_source_value",
            "drug_source_concept_id",
        ])

    total_output = len(output_rows)
    coverage = mapped_count / total_output if total_output > 0 else 0.0

    stats = DrugExposureStats(
        total_input_rows=total_input,
        total_output_rows=total_output,
        mapped_count=mapped_count,
        unmapped_count=unmapped_count,
        remapped_count=remapped_count,
        date_fallback_count=date_fallback_count,
        coverage_rate=coverage,
    )

    logger.info(
        "Drug exposure build complete: %d input -> %d output "
        "(mapped=%d, unmapped=%d, remapped=%d, fallback=%d, coverage=%.1f%%)",
        total_input,
        total_output,
        mapped_count,
        unmapped_count,
        remapped_count,
        date_fallback_count,
        coverage * 100,
    )

    return result_df, stats
