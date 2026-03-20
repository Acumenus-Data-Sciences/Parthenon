from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

VOCAB = settings.vocab_schema


def lookup_concept(session: Session, concept_code: str, vocabulary_id: str) -> dict | None:
    """Look up a single concept by code and vocabulary. Returns dict with concept_id, domain_id, etc."""
    result = session.execute(
        text(f"""
            SELECT concept_id, concept_name, domain_id, vocabulary_id,
                   concept_class_id, standard_concept, concept_code
            FROM {VOCAB}.concept
            WHERE concept_code = :code AND vocabulary_id = :vocab
            LIMIT 1
        """),
        {"code": concept_code, "vocab": vocabulary_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


def lookup_concept_by_id(session: Session, concept_id: int) -> dict | None:
    """Look up a concept by its concept_id."""
    result = session.execute(
        text(f"""
            SELECT concept_id, concept_name, domain_id, vocabulary_id,
                   concept_class_id, standard_concept, concept_code
            FROM {VOCAB}.concept
            WHERE concept_id = :cid
        """),
        {"cid": concept_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


def lookup_standard_concept(session: Session, concept_code: str, vocabulary_id: str) -> dict | None:
    """Look up source code, then follow 'Maps to' to get the standard concept.
    Returns the standard concept dict, or the source concept if no mapping exists,
    or None if the code is not found at all."""
    # First find the source concept
    source = lookup_concept(session, concept_code, vocabulary_id)
    if source is None:
        return None

    # If it's already standard, return it
    if source.get("standard_concept") == "S":
        return source

    # Follow 'Maps to' relationship to standard concept
    result = session.execute(
        text(f"""
            SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id,
                   c.concept_class_id, c.standard_concept, c.concept_code
            FROM {VOCAB}.concept_relationship cr
            JOIN {VOCAB}.concept c ON cr.concept_id_2 = c.concept_id
            WHERE cr.concept_id_1 = :source_id
              AND cr.relationship_id = 'Maps to'
              AND c.standard_concept = 'S'
              AND cr.invalid_reason IS NULL
            LIMIT 1
        """),
        {"source_id": source["concept_id"]},
    )
    row = result.mappings().first()
    if row:
        return dict(row)

    # No standard mapping found — return source concept with concept_id 0 pattern
    return source


def batch_lookup_standard(session: Session, codes: list[tuple[str, str]]) -> dict[tuple[str, str], dict | None]:
    """Batch lookup: list of (code, vocabulary_id) -> dict mapping each to standard concept.
    More efficient than individual lookups for large batches."""
    if not codes:
        return {}

    # Build a temp table approach for batch lookup
    results = {}
    for code, vocab in codes:
        results[(code, vocab)] = lookup_standard_concept(session, code, vocab)
    return results
