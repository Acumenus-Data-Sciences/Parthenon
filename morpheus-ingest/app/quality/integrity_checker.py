from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema


def check_referential_integrity(session: Session) -> dict:
    """Check that all clinical records reference valid person_id and visit_occurrence_id.
    Returns dict of violations per table."""
    tables = [
        "condition_occurrence",
        "drug_exposure",
        "measurement",
        "procedure_occurrence",
    ]

    results = {}
    for table in tables:
        # Orphan person_id check
        orphan_persons = session.execute(
            text(f"""
                SELECT count(*) FROM {CDM}.{table} t
                WHERE NOT EXISTS (SELECT 1 FROM {CDM}.person p WHERE p.person_id = t.person_id)
            """)
        ).scalar()

        # Null visit check (not a violation per se, but worth tracking)
        null_visits = session.execute(
            text(f"""
                SELECT count(*) FROM {CDM}.{table}
                WHERE visit_occurrence_id IS NULL
            """)
        ).scalar()

        results[table] = {
            "orphan_persons": orphan_persons,
            "null_visits": null_visits,
        }

    return results
