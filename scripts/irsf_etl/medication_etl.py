"""Medication ETL orchestrator for the IRSF pipeline.

Ties together person ID registry, visit resolver, vocabulary validator, and
drug exposure builder to produce the final staging/drug_exposure.csv. Follows
the same orchestration pattern as visit_derivation.py and measurement_etl.py.

Exports:
    run_medication_etl: Main orchestrator producing staging CSV and stats.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import pandas as pd

from scripts.irsf_etl.config import ETLConfig
from scripts.irsf_etl.lib.csv_utils import read_csv_safe
from scripts.irsf_etl.lib.drug_exposure_builder import (
    DrugExposureStats,
    build_drug_exposures,
)
from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
from scripts.irsf_etl.lib.rejection_log import RejectionLog
from scripts.irsf_etl.lib.visit_resolver import VisitResolver
from scripts.irsf_etl.schemas.drug_exposure import drug_exposure_schema

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def run_medication_etl(
    config: ETLConfig,
    *,
    skip_vocab: bool = False,
) -> tuple[pd.DataFrame, DrugExposureStats]:
    """Run the full medication ETL pipeline.

    Orchestration steps:
      1. Load PersonIdRegistry from staging/person_id_map.csv
      2. Load VisitResolver from staging/visit_id_map.csv
      3. Initialize VocabularyValidator (skip if skip_vocab=True)
      4. Load source Medications_5201_5211.csv
      5. Create RejectionLog for drug_exposure
      6. Call build_drug_exposures()
      7. Validate output against drug_exposure_schema
      8. Write staging/drug_exposure.csv
      9. Write rejection report to reports/drug_exposure_rejections.csv
     10. Close VocabularyValidator connection
     11. Return (drug_exposure_df, stats)

    Args:
        config: ETL configuration with source/output paths.
        skip_vocab: If True, skip vocabulary validation (all concept_ids = 0).

    Returns:
        Tuple of (OMOP drug_exposure DataFrame, DrugExposureStats).
    """
    # Step 1: Load PersonIdRegistry
    person_id_map_path = config.staging_dir / "person_id_map.csv"
    registry = PersonIdRegistry.from_csv(person_id_map_path)
    logger.info("Loaded PersonIdRegistry with %d entries", len(registry))

    # Step 2: Load VisitResolver
    visit_id_map_path = config.staging_dir / "visit_id_map.csv"
    visit_resolver = VisitResolver.from_csv(visit_id_map_path)
    logger.info("Loaded VisitResolver")

    # Step 3: Initialize VocabularyValidator
    vocab_validator = None
    if not skip_vocab:
        from scripts.irsf_etl.lib.vocab_validator import VocabularyValidator

        try:
            vocab_validator = VocabularyValidator(config.db_connection_params)
            logger.info("VocabularyValidator initialized (DB connection)")
        except Exception:
            logger.warning(
                "Failed to connect to vocabulary DB; falling back to skip_vocab mode"
            )
            vocab_validator = None

    # Step 4: Load source medications CSV
    medications_path = (
        config.source_custom_extracts / "csv" / "Medications_5201_5211.csv"
    )
    logger.info("Loading medications from %s", medications_path)
    medications_df = read_csv_safe(
        medications_path, keep_default_na=False, low_memory=False
    )
    logger.info("Loaded %d medication rows from source", len(medications_df))

    # Step 5: Create RejectionLog
    rejection_log = RejectionLog("drug_exposure")

    # Step 6: Call build_drug_exposures
    drug_exposure_df, stats = build_drug_exposures(
        medications_df,
        registry,
        visit_resolver,
        vocab_validator,
        rejection_log,
        max_year=2026,
    )

    # Step 7: Validate output against Pandera schema
    if not drug_exposure_df.empty:
        drug_exposure_schema.validate(drug_exposure_df)
        logger.info("drug_exposure passed Pandera schema validation")

    # Step 8: Write staging/drug_exposure.csv
    staging_dir = config.staging_dir
    staging_dir.mkdir(parents=True, exist_ok=True)
    staging_path = staging_dir / "drug_exposure.csv"
    drug_exposure_df.to_csv(staging_path, index=False)
    logger.info("Wrote %s (%d rows)", staging_path, len(drug_exposure_df))

    # Step 9: Write rejection report
    reports_dir = config.reports_dir
    reports_dir.mkdir(parents=True, exist_ok=True)
    rejection_path = reports_dir / "drug_exposure_rejections.csv"
    if rejection_log.entries:
        rejection_log.to_csv(rejection_path)
        summary = rejection_log.summary()
        logger.info(
            "Rejection summary: %d errors, %d warnings out of %d processed",
            summary.total_rejected,
            summary.total_warnings,
            summary.total_processed,
        )
    else:
        # Write empty rejection CSV with headers only
        pd.DataFrame(
            columns=["row_index", "field", "value", "category", "message"]
        ).to_csv(rejection_path, index=False)
        logger.info("No rejections during medication ETL")

    # Step 10: Close VocabularyValidator connection
    if vocab_validator is not None:
        vocab_validator.close()
        logger.info("VocabularyValidator connection closed")

    # Step 11: Return results
    return drug_exposure_df, stats
