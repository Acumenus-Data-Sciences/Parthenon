from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
STG = settings.staging_schema

# OMOP standard gender concepts
GENDER_MAP = {"M": 8507, "F": 8532}


def map_persons(session: Session, batch_id: int) -> int:
    """Map stg_patient -> inpatient.person. Returns number of rows mapped."""
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.person (
                person_id, gender_concept_id, year_of_birth,
                race_concept_id, ethnicity_concept_id,
                person_source_value, gender_source_value,
                gender_source_concept_id, race_source_concept_id,
                ethnicity_source_concept_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY staging_id) + COALESCE(
                    (SELECT MAX(person_id) FROM {CDM}.person), 0
                ),
                CASE WHEN gender_source_value = 'M' THEN 8507
                     WHEN gender_source_value = 'F' THEN 8532
                     ELSE 0 END,
                COALESCE(birth_year, 1900),
                0,  -- race_concept_id (unmapped for MIMIC)
                0,  -- ethnicity_concept_id (unmapped for MIMIC)
                person_source_value,
                gender_source_value,
                0, 0, 0
            FROM {STG}.stg_patient
            WHERE load_batch_id = :bid
        """),
        {"bid": batch_id},
    )
    session.flush()
    return result.rowcount


def get_person_id_map(session: Session, batch_id: int) -> dict[str, int]:
    """Return mapping of person_source_value -> person_id for cross-referencing."""
    result = session.execute(
        text(f"""
            SELECT p.person_source_value, p.person_id
            FROM {CDM}.person p
            WHERE p.person_source_value IN (
                SELECT person_source_value FROM {STG}.stg_patient WHERE load_batch_id = :bid
            )
        """),
        {"bid": batch_id},
    )
    return {row.person_source_value: row.person_id for row in result}
