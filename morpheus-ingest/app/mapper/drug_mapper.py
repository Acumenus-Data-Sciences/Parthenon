from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
STG = settings.staging_schema
VOCAB = settings.vocab_schema

PRESCRIPTION_TYPE = 38000177  # Prescription written


def map_drugs(session: Session, batch_id: int) -> int:
    """Map stg_drug -> inpatient.drug_exposure with vocabulary mapping.

    Uses DISTINCT ON to deduplicate one-to-many vocabulary mappings.
    """
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.drug_exposure (
                drug_exposure_id, person_id, drug_concept_id,
                drug_exposure_start_date, drug_exposure_start_datetime,
                drug_exposure_end_date, drug_exposure_end_datetime,
                drug_type_concept_id,
                drug_source_value, drug_source_concept_id,
                route_source_value, dose_unit_source_value,
                quantity, visit_occurrence_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY dedup.staging_id) + COALESCE(
                    (SELECT MAX(drug_exposure_id)
                     FROM {CDM}.drug_exposure), 0
                ),
                dedup.person_id,
                dedup.drug_concept_id,
                dedup.drug_exposure_start_date,
                dedup.start_datetime,
                dedup.drug_exposure_end_date,
                dedup.end_datetime,
                {PRESCRIPTION_TYPE},
                dedup.drug_source_value,
                dedup.drug_source_concept_id,
                dedup.route_source_value,
                dedup.dose_unit,
                dedup.quantity,
                dedup.visit_occurrence_id
            FROM (
                SELECT DISTINCT ON (sd.staging_id)
                    sd.staging_id,
                    p.person_id,
                    COALESCE(std.concept_id, 0) AS drug_concept_id,
                    COALESCE(sd.start_datetime::date, v.visit_start_date)
                        AS drug_exposure_start_date,
                    sd.start_datetime,
                    COALESCE(sd.end_datetime::date, sd.start_datetime::date,
                             v.visit_start_date) AS drug_exposure_end_date,
                    sd.end_datetime,
                    LEFT(sd.drug_source_code, 50) AS drug_source_value,
                    COALESCE(src.concept_id, 0) AS drug_source_concept_id,
                    LEFT(sd.route_source_value, 50) AS route_source_value,
                    LEFT(sd.dose_unit, 50) AS dose_unit,
                    sd.quantity,
                    v.visit_occurrence_id
                FROM {STG}.stg_drug sd
                JOIN {CDM}.person p
                    ON sd.person_source_value = p.person_source_value
                LEFT JOIN {CDM}.visit_occurrence v
                    ON sd.encounter_source_value = v.visit_source_value
                LEFT JOIN {VOCAB}.concept src
                    ON sd.drug_source_code = src.concept_code
                    AND sd.drug_source_vocab = src.vocabulary_id
                LEFT JOIN {VOCAB}.concept_relationship cr
                    ON src.concept_id = cr.concept_id_1
                    AND cr.relationship_id = 'Maps to'
                    AND cr.invalid_reason IS NULL
                LEFT JOIN {VOCAB}.concept std
                    ON cr.concept_id_2 = std.concept_id
                    AND std.standard_concept = 'S'
                WHERE sd.load_batch_id = :bid
                ORDER BY sd.staging_id, std.concept_id NULLS LAST
            ) dedup
        """),
        {"bid": batch_id},
    )
    session.flush()
    return result.rowcount
