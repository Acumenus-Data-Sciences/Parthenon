from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
STG = settings.staging_schema

# Standard OMOP concepts for visit type
INPATIENT_VISIT_CONCEPT = 9201      # Inpatient Visit
EHR_VISIT_TYPE_CONCEPT = 44818518   # Visit derived from EHR encounter record


def map_visits(session: Session, batch_id: int) -> int:
    """Map stg_encounter -> inpatient.visit_occurrence. Returns row count."""
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.visit_occurrence (
                visit_occurrence_id, person_id, visit_concept_id,
                visit_start_date, visit_start_datetime,
                visit_end_date, visit_end_datetime,
                visit_type_concept_id,
                visit_source_value, visit_source_concept_id,
                admitted_from_source_value, discharged_to_source_value,
                admitted_from_concept_id, discharged_to_concept_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY e.staging_id) + COALESCE(
                    (SELECT MAX(visit_occurrence_id) FROM {CDM}.visit_occurrence), 0
                ),
                p.person_id,
                {INPATIENT_VISIT_CONCEPT},
                e.admit_datetime::date,
                e.admit_datetime,
                COALESCE(e.discharge_datetime::date, e.admit_datetime::date),
                e.discharge_datetime,
                {EHR_VISIT_TYPE_CONCEPT},
                e.encounter_source_value,
                0,
                e.admit_source,
                e.discharge_disposition,
                0, 0
            FROM {STG}.stg_encounter e
            JOIN {CDM}.person p ON e.person_source_value = p.person_source_value
            WHERE e.load_batch_id = :bid
        """),
        {"bid": batch_id},
    )
    session.flush()
    return result.rowcount


def get_visit_id_map(session: Session, batch_id: int) -> dict[str, int]:
    """Return mapping of encounter_source_value -> visit_occurrence_id."""
    result = session.execute(
        text(f"""
            SELECT v.visit_source_value, v.visit_occurrence_id
            FROM {CDM}.visit_occurrence v
            WHERE v.visit_source_value IN (
                SELECT encounter_source_value FROM {STG}.stg_encounter WHERE load_batch_id = :bid
            )
        """),
        {"bid": batch_id},
    )
    return {row.visit_source_value: row.visit_occurrence_id for row in result}
