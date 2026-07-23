"""Focused unit tests for production-safe Hecate vocabulary synchronization."""

import pytest

from scripts.hecate_vocabulary_sync import (
    Concept,
    eligibility_sql,
    payload_mismatches,
    point_id_for_concept,
    set_indexing_threshold,
    upsert_points,
    validate_collection_name,
)


def test_point_ids_remain_compatible_with_existing_hecate_collection():
    assert point_id_for_concept(4329847) == "7fb9aa09-87d5-5e94-8112-24ef36d5bb63"


def test_eligibility_is_membership_aware_and_excludes_rxnorm_extension():
    query = eligibility_sql("vocab")

    assert "concept_id > %s" in query
    assert "standard_concept = 'S'" in query
    assert "vocabulary_id != ALL(%s)" in query


def test_unsafe_schema_and_collection_names_are_rejected():
    with pytest.raises(ValueError, match="Unsafe vocabulary schema"):
        eligibility_sql("vocab; DROP SCHEMA vocab")
    with pytest.raises(ValueError, match="Unsafe Qdrant collection"):
        validate_collection_name("meddra/../../bad")


def test_payload_audit_detects_a_renamed_concept():
    concept = Concept(
        4329847,
        "Myocardial infarction",
        "Condition",
        "SNOMED",
        "Disorder",
        "S",
        "22298006",
    )
    expected = concept.payload(release="5.0-2026-02-27", embedding_model="embeddinggemma:300m")
    stale = dict(expected)
    stale["concept_name"] = "Old myocardial infarction name"

    mismatches = payload_mismatches(stale, expected)

    assert mismatches["concept_name"]["expected"] == "Myocardial infarction"


def test_bulk_load_index_threshold_is_explicit(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "scripts.hecate_vocabulary_sync.qdrant_request",
        lambda method, path, body: calls.append((method, path, body)) or {},
    )

    set_indexing_threshold("meddra_20260227", 0)
    set_indexing_threshold("meddra_20260227", 20_000)

    assert calls == [
        ("PATCH", "/collections/meddra_20260227", {"optimizers_config": {"indexing_threshold": 0}}),
        ("PATCH", "/collections/meddra_20260227", {"optimizers_config": {"indexing_threshold": 20_000}}),
    ]


def test_large_upserts_split_after_transport_failure(monkeypatch):
    accepted = []

    def fake_request(method, path, body, **kwargs):
        points = body["points"]
        if len(points) > 2:
            raise ConnectionError("request body too large")
        accepted.extend(point["id"] for point in points)
        return {}

    monkeypatch.setattr("scripts.hecate_vocabulary_sync.qdrant_request", fake_request)

    upsert_points("meddra_20260227", [{"id": value} for value in range(5)])

    assert accepted == [0, 1, 2, 3, 4]
