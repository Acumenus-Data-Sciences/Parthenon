from app.vocabulary.concept_lookup import lookup_concept, lookup_standard_concept
from app.vocabulary.relationship_walker import get_standard_concept_id, get_domain_id


def test_lookup_known_gender_concept(db_session):
    """Gender vocabulary has well-known concepts."""
    result = lookup_concept(db_session, "M", "Gender")
    assert result is not None
    assert result["concept_id"] == 8507
    assert result["domain_id"] == "Gender"


def test_lookup_icd10_code(db_session):
    """ICD10CM codes should be findable."""
    result = lookup_concept(db_session, "I10", "ICD10CM")
    assert result is not None
    assert result["vocabulary_id"] == "ICD10CM"


def test_lookup_standard_maps_icd_to_snomed(db_session):
    """ICD10CM I10 (Essential hypertension) should map to a SNOMED standard concept."""
    result = lookup_standard_concept(db_session, "I10", "ICD10CM")
    assert result is not None
    # The standard concept should be SNOMED (or at least standard)
    assert result.get("standard_concept") == "S"


def test_lookup_nonexistent_returns_none(db_session):
    result = lookup_concept(db_session, "ZZZZZZZ", "ICD10CM")
    assert result is None


def test_get_standard_concept_id_for_zero(db_session):
    assert get_standard_concept_id(db_session, 0) == 0


def test_get_domain_id_for_zero(db_session):
    assert get_domain_id(db_session, 0) == "Observation"


def test_get_domain_id_for_known_concept(db_session):
    """Gender concept 8507 (Male) should have domain 'Gender'."""
    domain = get_domain_id(db_session, 8507)
    assert domain == "Gender"
