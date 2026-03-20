from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

VOCAB = settings.vocab_schema


def get_standard_concept_id(session: Session, source_concept_id: int) -> int:
    """Given a source concept_id, follow 'Maps to' to get standard concept_id.
    Returns 0 if no mapping found (OMOP convention for unmapped)."""
    if source_concept_id == 0:
        return 0

    result = session.execute(
        text(f"""
            SELECT c.concept_id
            FROM {VOCAB}.concept_relationship cr
            JOIN {VOCAB}.concept c ON cr.concept_id_2 = c.concept_id
            WHERE cr.concept_id_1 = :src
              AND cr.relationship_id = 'Maps to'
              AND c.standard_concept = 'S'
              AND cr.invalid_reason IS NULL
            LIMIT 1
        """),
        {"src": source_concept_id},
    )
    row = result.scalar()
    return row if row else 0


def get_domain_id(session: Session, concept_id: int) -> str:
    """Get the domain_id for a concept. Used for domain routing.
    Returns 'Observation' as default if concept not found."""
    if concept_id == 0:
        return "Observation"

    result = session.execute(
        text(f"SELECT domain_id FROM {VOCAB}.concept WHERE concept_id = :cid"),
        {"cid": concept_id},
    )
    row = result.scalar()
    return row if row else "Observation"


def get_ancestors(session: Session, concept_id: int, levels_up: int = 0) -> list[dict]:
    """Get ancestor concepts. If levels_up=0, returns all ancestors."""
    query = f"""
        SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id,
               ca.min_levels_of_separation, ca.max_levels_of_separation
        FROM {VOCAB}.concept_ancestor ca
        JOIN {VOCAB}.concept c ON ca.ancestor_concept_id = c.concept_id
        WHERE ca.descendant_concept_id = :cid
          AND ca.ancestor_concept_id != :cid
    """
    params: dict = {"cid": concept_id}
    if levels_up > 0:
        query += " AND ca.min_levels_of_separation <= :levels"
        params["levels"] = levels_up

    query += " ORDER BY ca.min_levels_of_separation"

    result = session.execute(text(query), params)
    return [dict(row) for row in result.mappings()]
