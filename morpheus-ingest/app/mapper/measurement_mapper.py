from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
STG = settings.staging_schema
VOCAB = settings.vocab_schema

LAB_FROM_EHR = 44818702  # Lab result from EHR


def map_measurements(session: Session, batch_id: int) -> int:
    """Map stg_measurement -> inpatient.measurement with vocabulary mapping.

    Note: MIMIC uses local item IDs (source_vocabulary = 'MIMIC-labevents' or
    'MIMIC-chartevents'). These won't match any concept in omop.concept, so
    measurement_concept_id will be 0 for most measurements. This is expected.

    Uses DISTINCT ON to deduplicate one-to-many vocabulary mappings.
    """
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.measurement (
                measurement_id, person_id, measurement_concept_id,
                measurement_date, measurement_datetime,
                measurement_type_concept_id,
                value_as_number, value_as_concept_id,
                unit_source_value, range_low, range_high,
                measurement_source_value, measurement_source_concept_id,
                visit_occurrence_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY dedup.staging_id) + COALESCE(
                    (SELECT MAX(measurement_id)
                     FROM {CDM}.measurement), 0
                ),
                dedup.person_id,
                dedup.measurement_concept_id,
                dedup.measurement_date,
                dedup.measurement_datetime,
                {LAB_FROM_EHR},
                dedup.value_as_number,
                0,
                dedup.unit_source_value,
                dedup.range_low,
                dedup.range_high,
                dedup.source_code,
                dedup.measurement_source_concept_id,
                dedup.visit_occurrence_id
            FROM (
                SELECT DISTINCT ON (sm.staging_id)
                    sm.staging_id,
                    p.person_id,
                    COALESCE(std.concept_id, 0) AS measurement_concept_id,
                    sm.measurement_datetime::date AS measurement_date,
                    sm.measurement_datetime,
                    sm.value_as_number,
                    sm.unit_source_value,
                    sm.range_low,
                    sm.range_high,
                    sm.source_code,
                    COALESCE(src.concept_id, 0) AS measurement_source_concept_id,
                    v.visit_occurrence_id
                FROM {STG}.stg_measurement sm
                JOIN {CDM}.person p
                    ON sm.person_source_value = p.person_source_value
                LEFT JOIN {CDM}.visit_occurrence v
                    ON sm.encounter_source_value = v.visit_source_value
                LEFT JOIN {VOCAB}.concept src
                    ON sm.source_code = src.concept_code
                    AND sm.source_vocabulary = src.vocabulary_id
                LEFT JOIN {VOCAB}.concept_relationship cr
                    ON src.concept_id = cr.concept_id_1
                    AND cr.relationship_id = 'Maps to'
                    AND cr.invalid_reason IS NULL
                LEFT JOIN {VOCAB}.concept std
                    ON cr.concept_id_2 = std.concept_id
                    AND std.standard_concept = 'S'
                WHERE sm.load_batch_id = :bid
                ORDER BY sm.staging_id, std.concept_id NULLS LAST
            ) dedup
        """),
        {"bid": batch_id},
    )
    session.flush()
    return result.rowcount
