from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
STG = settings.staging_schema
VOCAB = settings.vocab_schema

EHR_ORDER_TYPE = 38000275  # EHR order list entry


def map_procedures(session: Session, batch_id: int) -> int:
    """Map stg_procedure -> inpatient.procedure_occurrence with vocabulary mapping.

    Uses DISTINCT ON to deduplicate one-to-many vocabulary mappings.
    """
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.procedure_occurrence (
                procedure_occurrence_id, person_id, procedure_concept_id,
                procedure_date, procedure_datetime,
                procedure_type_concept_id,
                procedure_source_value, procedure_source_concept_id,
                visit_occurrence_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY dedup.staging_id) + COALESCE(
                    (SELECT MAX(procedure_occurrence_id)
                     FROM {CDM}.procedure_occurrence), 0
                ),
                dedup.person_id,
                dedup.procedure_concept_id,
                dedup.procedure_date,
                dedup.procedure_datetime,
                {EHR_ORDER_TYPE},
                dedup.procedure_source_value,
                dedup.procedure_source_concept_id,
                dedup.visit_occurrence_id
            FROM (
                SELECT DISTINCT ON (sp.staging_id)
                    sp.staging_id,
                    p.person_id,
                    COALESCE(std.concept_id, 0) AS procedure_concept_id,
                    COALESCE(sp.procedure_date, v.visit_start_date)
                        AS procedure_date,
                    sp.procedure_datetime,
                    LEFT(sp.procedure_source_code, 50) AS procedure_source_value,
                    COALESCE(src.concept_id, 0) AS procedure_source_concept_id,
                    v.visit_occurrence_id
                FROM {STG}.stg_procedure sp
                JOIN {CDM}.person p
                    ON sp.person_source_value = p.person_source_value
                LEFT JOIN {CDM}.visit_occurrence v
                    ON sp.encounter_source_value = v.visit_source_value
                LEFT JOIN {VOCAB}.concept src
                    ON sp.procedure_source_code = src.concept_code
                    AND sp.procedure_source_vocab = src.vocabulary_id
                LEFT JOIN {VOCAB}.concept_relationship cr
                    ON src.concept_id = cr.concept_id_1
                    AND cr.relationship_id = 'Maps to'
                    AND cr.invalid_reason IS NULL
                LEFT JOIN {VOCAB}.concept std
                    ON cr.concept_id_2 = std.concept_id
                    AND std.standard_concept = 'S'
                WHERE sp.load_batch_id = :bid
                ORDER BY sp.staging_id, std.concept_id NULLS LAST
            ) dedup
        """),
        {"bid": batch_id},
    )
    session.flush()
    return result.rowcount
