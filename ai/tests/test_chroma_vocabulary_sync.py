"""Unit coverage for the versioned OMOP-to-Chroma synchronization policy."""
from unittest.mock import MagicMock


def test_eligibility_query_preserves_irsf_and_excludes_rxnorm_extension():
    from app.chroma.vocabulary_sync import _eligibility_query

    query = _eligibility_query("vocab")

    assert "vocabulary_id = ANY(:required_vocabularies)" in query
    assert "vocabulary_id != ALL(:excluded_vocabularies)" in query
    assert "concept_id > :after_id" in query


def test_eligibility_query_rejects_unsafe_schema():
    import pytest

    from app.chroma.vocabulary_sync import _eligibility_query

    with pytest.raises(ValueError, match="Unsafe vocabulary schema"):
        _eligibility_query("vocab; DROP SCHEMA vocab")


def test_source_embedding_compatibility_requires_matching_semantic_space():
    from app.chroma.vocabulary_sync import source_embedding_is_compatible

    source = MagicMock()
    source.count.return_value = 1
    source.get.return_value = {
        "documents": ["Rett syndrome"],
        "embeddings": [[1.0, 0.0, 0.0]],
    }

    compatible, similarity = source_embedding_is_compatible(
        source,
        lambda documents: [[1.0, 0.0, 0.0]],
    )

    assert compatible is True
    assert similarity == 1.0


def test_source_embedding_compatibility_rejects_same_dimension_wrong_model():
    from app.chroma.vocabulary_sync import source_embedding_is_compatible

    source = MagicMock()
    source.count.return_value = 1
    source.get.return_value = {
        "documents": ["Rett syndrome"],
        "embeddings": [[1.0, 0.0, 0.0]],
    }

    compatible, similarity = source_embedding_is_compatible(
        source,
        lambda documents: [[0.0, 1.0, 0.0]],
    )

    assert compatible is False
    assert similarity == 0.0


def test_embedding_model_must_distinguish_unrelated_short_labels():
    from app.chroma.vocabulary_sync import embedding_model_is_discriminative

    compatible, similarity = embedding_model_is_discriminative(
        lambda documents: [[1.0, 0.0], [0.0, 1.0]]
    )

    assert compatible is True
    assert similarity == 0.0


def test_embedding_model_rejects_collapsed_short_labels():
    from app.chroma.vocabulary_sync import embedding_model_is_discriminative

    compatible, similarity = embedding_model_is_discriminative(
        lambda documents: [[1.0, 0.0], [1.0, 0.0]]
    )

    assert compatible is False
    assert similarity == 1.0


def test_qdrant_vectors_only_reuse_matching_concept_names(monkeypatch):
    from app.chroma.vocabulary_sync import ClinicalConcept, _qdrant_vectors

    concepts = [
        ClinicalConcept(1, "Rett syndrome", "Condition", "SNOMED", "Disorder"),
        ClinicalConcept(2, "Other syndrome", "Condition", "SNOMED", "Disorder"),
    ]

    def fake_request(*args, **kwargs):
        return {
            "result": [
                {
                    "id": "f7ee6bcb-141e-5c03-acb6-203437dac5ab",
                    "payload": {"concept_name": "Rett syndrome"},
                    "vector": [0.0] * 768,
                },
                {
                    "id": "ea9f6705-0281-5378-b975-ef3fbd30aeeb",
                    "payload": {"concept_name": "Stale name"},
                    "vector": [0.0] * 768,
                },
            ]
        }

    monkeypatch.setattr("app.chroma.vocabulary_sync._qdrant_request", fake_request)
    result = _qdrant_vectors(
        base_url="http://qdrant:6333",
        collection="meddra_20260227",
        concepts=concepts,
    )

    assert result == {"concept_1": [0.0] * 768}


def test_target_collection_refuses_incompatible_existing_release():
    import pytest

    from app.chroma.vocabulary_sync import _get_or_create_target

    client = MagicMock()
    target = MagicMock()
    target.metadata = {
        "hnsw:space": "cosine",
        "parthenon:policy": "older-policy",
        "parthenon:release": "old-release",
        "parthenon:embedding_model": "old-model",
    }
    client.get_or_create_collection.return_value = target

    with pytest.raises(RuntimeError, match="incompatible"):
        _get_or_create_target(client, "clinical_reference_20260227", "v5.0", "model", MagicMock())


def test_source_vector_reads_split_after_transient_large_response_failure():
    from app.chroma.vocabulary_sync import ClinicalConcept, _source_vectors

    concepts = [ClinicalConcept(index, f"Concept {index}", "Condition", "SNOMED", "Clinical") for index in range(4)]

    class FakeSource:
        def get(self, *, ids, include):
            if len(ids) > 2:
                raise ConnectionError("response interrupted")
            return {
                "ids": ids,
                "documents": [f"Concept {int(value.split('_')[1])}" for value in ids],
                "embeddings": [[0.0] * 768 for _ in ids],
            }

    result = _source_vectors(FakeSource(), concepts)

    assert sorted(result) == ["concept_0", "concept_1", "concept_2", "concept_3"]
