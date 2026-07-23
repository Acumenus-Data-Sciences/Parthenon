"""Unit coverage for the durable BGE vocabulary synchronization policy."""

import pytest

from scripts.bge_vocabulary_sync import eligibility_predicate, validate_identifier, vector_literal


def test_bge_policy_is_explicitly_standard_and_valid():
    predicate = eligibility_predicate("concept")
    assert "invalid_reason IS NULL" in predicate
    assert "standard_concept = 'S'" in predicate
    assert "vocabulary_id = ANY(%s)" in predicate


def test_bge_schema_identifier_is_fail_closed():
    with pytest.raises(ValueError, match="Unsafe schema"):
        validate_identifier("vocab; DROP SCHEMA vocab", "schema")


def test_vector_literal_requires_pinned_dimension():
    with pytest.raises(ValueError, match="768-dimensional"):
        vector_literal([0.1, 0.2])
    value = vector_literal([0.0] * 768)
    assert value.startswith("[") and value.endswith("]")
