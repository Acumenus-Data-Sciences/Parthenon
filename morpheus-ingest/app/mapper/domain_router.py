from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

CDM = settings.cdm_schema
VOCAB = settings.vocab_schema
EXT = settings.ext_schema


def log_concept_gaps(session: Session, batch_id: int) -> int:
    """Find unmapped source codes (concept_id=0) and log to concept_gap table.

    For Phase A we log domain mismatches but don't re-route records whose
    standard concept has a different domain_id than the target table.
    That optimization is planned for a later phase.

    Returns number of distinct gaps found.
    """
    # Collect unmapped conditions
    session.execute(
        text(f"""
            INSERT INTO {EXT}.concept_gap (source_code, source_vocabulary, frequency)
            SELECT condition_source_value, 'ICD', count(*)
            FROM {CDM}.condition_occurrence
            WHERE condition_concept_id = 0
              AND condition_source_value IS NOT NULL
            GROUP BY condition_source_value
            ON CONFLICT (source_code, source_vocabulary) DO UPDATE
                SET frequency = concept_gap.frequency + EXCLUDED.frequency
        """)
    )

    # Collect unmapped drugs
    session.execute(
        text(f"""
            INSERT INTO {EXT}.concept_gap (source_code, source_vocabulary, frequency)
            SELECT drug_source_value, 'Drug', count(*)
            FROM {CDM}.drug_exposure
            WHERE drug_concept_id = 0
              AND drug_source_value IS NOT NULL
            GROUP BY drug_source_value
            ON CONFLICT (source_code, source_vocabulary) DO UPDATE
                SET frequency = concept_gap.frequency + EXCLUDED.frequency
        """)
    )

    # Collect unmapped measurements
    session.execute(
        text(f"""
            INSERT INTO {EXT}.concept_gap (source_code, source_vocabulary, frequency)
            SELECT measurement_source_value, 'Measurement', count(*)
            FROM {CDM}.measurement
            WHERE measurement_concept_id = 0
              AND measurement_source_value IS NOT NULL
            GROUP BY measurement_source_value
            ON CONFLICT (source_code, source_vocabulary) DO UPDATE
                SET frequency = concept_gap.frequency + EXCLUDED.frequency
        """)
    )

    # Collect unmapped procedures
    session.execute(
        text(f"""
            INSERT INTO {EXT}.concept_gap (source_code, source_vocabulary, frequency)
            SELECT procedure_source_value, 'Procedure', count(*)
            FROM {CDM}.procedure_occurrence
            WHERE procedure_concept_id = 0
              AND procedure_source_value IS NOT NULL
            GROUP BY procedure_source_value
            ON CONFLICT (source_code, source_vocabulary) DO UPDATE
                SET frequency = concept_gap.frequency + EXCLUDED.frequency
        """)
    )

    session.flush()
    result = session.execute(text(f"SELECT count(*) FROM {EXT}.concept_gap"))
    return result.scalar()
