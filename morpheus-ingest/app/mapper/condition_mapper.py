from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
STG = settings.staging_schema
VOCAB = settings.vocab_schema

EHR_CONDITION_TYPE = 32817  # EHR problem list entry


def map_conditions(session: Session, batch_id: int) -> int:
    """Map stg_condition -> inpatient.condition_occurrence with vocabulary mapping.

    Uses DISTINCT ON to handle one-to-many vocabulary mappings (one source code
    can map to multiple standard concepts). Picks the lowest standard concept_id
    for deterministic results.
    """
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.condition_occurrence (
                condition_occurrence_id, person_id, condition_concept_id,
                condition_start_date, condition_start_datetime,
                condition_type_concept_id,
                condition_source_value, condition_source_concept_id,
                visit_occurrence_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY dedup.staging_id) + COALESCE(
                    (SELECT MAX(condition_occurrence_id)
                     FROM {CDM}.condition_occurrence), 0
                ),
                dedup.person_id,
                dedup.condition_concept_id,
                dedup.condition_start_date,
                dedup.condition_start_datetime,
                {EHR_CONDITION_TYPE},
                dedup.condition_source_value,
                dedup.condition_source_concept_id,
                dedup.visit_occurrence_id
            FROM (
                SELECT DISTINCT ON (sc.staging_id)
                    sc.staging_id,
                    p.person_id,
                    COALESCE(std.concept_id, 0) AS condition_concept_id,
                    COALESCE(sc.condition_start_date, v.visit_start_date)
                        AS condition_start_date,
                    sc.condition_start_datetime,
                    LEFT(sc.condition_source_code, 50) AS condition_source_value,
                    COALESCE(src.concept_id, 0) AS condition_source_concept_id,
                    v.visit_occurrence_id
                FROM {STG}.stg_condition sc
                JOIN {CDM}.person p
                    ON sc.person_source_value = p.person_source_value
                LEFT JOIN {CDM}.visit_occurrence v
                    ON sc.encounter_source_value = v.visit_source_value
                LEFT JOIN {VOCAB}.concept src
                    ON sc.condition_source_code = src.concept_code
                    AND sc.condition_source_vocab = src.vocabulary_id
                LEFT JOIN {VOCAB}.concept_relationship cr
                    ON src.concept_id = cr.concept_id_1
                    AND cr.relationship_id = 'Maps to'
                    AND cr.invalid_reason IS NULL
                LEFT JOIN {VOCAB}.concept std
                    ON cr.concept_id_2 = std.concept_id
                    AND std.standard_concept = 'S'
                WHERE sc.load_batch_id = :bid
                ORDER BY sc.staging_id, std.concept_id NULLS LAST
            ) dedup
        """),
        {"bid": batch_id},
    )
    session.flush()
    return result.rowcount
