from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema

PERIOD_TYPE_EHR = 44814724  # Period covering healthcare encounters


def build_observation_periods(session: Session) -> int:
    """Create one observation_period per person: min visit start to max visit end."""
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.observation_period (
                observation_period_id, person_id,
                observation_period_start_date, observation_period_end_date,
                period_type_concept_id
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY person_id) + COALESCE(
                    (SELECT MAX(observation_period_id) FROM {CDM}.observation_period), 0
                ),
                person_id,
                MIN(visit_start_date),
                MAX(COALESCE(visit_end_date, visit_start_date)),
                {PERIOD_TYPE_EHR}
            FROM {CDM}.visit_occurrence
            GROUP BY person_id
        """)
    )
    session.flush()
    return result.rowcount


def build_condition_eras(session: Session) -> int:
    """Build condition_era by collapsing condition_occurrence per person+concept.
    Simplified: one era per person+concept combination."""
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.condition_era (
                condition_era_id, person_id, condition_concept_id,
                condition_era_start_date, condition_era_end_date,
                condition_occurrence_count
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY person_id, condition_concept_id) + COALESCE(
                    (SELECT MAX(condition_era_id) FROM {CDM}.condition_era), 0
                ),
                person_id,
                condition_concept_id,
                MIN(condition_start_date),
                MAX(COALESCE(condition_end_date, condition_start_date)),
                COUNT(*)
            FROM {CDM}.condition_occurrence
            WHERE condition_concept_id != 0
            GROUP BY person_id, condition_concept_id
        """)
    )
    session.flush()
    return result.rowcount


def build_drug_eras(session: Session) -> int:
    """Build drug_era by collapsing drug_exposure per person+concept.
    Simplified: one era per person+concept combination."""
    result = session.execute(
        text(f"""
            INSERT INTO {CDM}.drug_era (
                drug_era_id, person_id, drug_concept_id,
                drug_era_start_date, drug_era_end_date,
                drug_exposure_count, gap_days
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY person_id, drug_concept_id) + COALESCE(
                    (SELECT MAX(drug_era_id) FROM {CDM}.drug_era), 0
                ),
                person_id,
                drug_concept_id,
                MIN(drug_exposure_start_date),
                MAX(COALESCE(drug_exposure_end_date, drug_exposure_start_date)),
                COUNT(*),
                0
            FROM {CDM}.drug_exposure
            WHERE drug_concept_id != 0
            GROUP BY person_id, drug_concept_id
        """)
    )
    session.flush()
    return result.rowcount
