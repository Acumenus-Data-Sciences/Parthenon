"""Tests for KnowledgeGraphService — OMOP concept hierarchy traversal with Redis caching."""

import json
from unittest.mock import MagicMock, patch, call

import pytest

from app.knowledge.graph_service import KnowledgeGraphService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_engine():
    """Provide a mock SQLAlchemy engine."""
    engine = MagicMock()
    conn = MagicMock()
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    engine.connect.return_value = conn
    return engine, conn


@pytest.fixture
def mock_redis():
    """Provide a mock Redis client with no cached values by default."""
    redis = MagicMock()
    redis.get.return_value = None  # cache miss by default
    return redis


@pytest.fixture
def svc(mock_engine, mock_redis):
    """Return a KnowledgeGraphService wired with mocked engine and Redis."""
    engine, _ = mock_engine
    return KnowledgeGraphService(
        engine=engine,
        redis_client=mock_redis,
        vocab_schema="vocab",
        cache_ttl=3600,
        cache_prefix="abby:kg:",
    )


# ---------------------------------------------------------------------------
# Helper row factories
# ---------------------------------------------------------------------------


def _concept_row(concept_id=4329847, name="Myocardial infarction", domain="Condition", vocab="SNOMED"):
    row = MagicMock()
    row._mapping = {
        "concept_id": concept_id,
        "concept_name": name,
        "domain_id": domain,
        "vocabulary_id": vocab,
        "standard_concept": "S",
    }
    row.__getitem__ = lambda self, key: self._mapping[key]
    row.keys = lambda: list(row._mapping.keys())
    return row


# ---------------------------------------------------------------------------
# Test 1: get_ancestors returns hierarchy
# ---------------------------------------------------------------------------


def test_get_ancestors_returns_hierarchy(mock_engine, mock_redis):
    engine, conn = mock_engine
    ancestor_row = _concept_row(concept_id=317009, name="Heart disease")
    conn.execute.return_value = [ancestor_row]

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.get_ancestors(concept_id=4329847)

    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["concept_id"] == 317009
    assert result[0]["concept_name"] == "Heart disease"


# ---------------------------------------------------------------------------
# Test 2: get_descendants returns subtypes
# ---------------------------------------------------------------------------


def test_get_descendants_returns_subtypes(mock_engine, mock_redis):
    engine, conn = mock_engine
    desc_row = _concept_row(concept_id=4059844, name="Acute MI")
    conn.execute.return_value = [desc_row]

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.get_descendants(concept_id=4329847)

    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["concept_id"] == 4059844


# ---------------------------------------------------------------------------
# Test 3: get_siblings returns same-parent concepts
# ---------------------------------------------------------------------------


def test_get_siblings_returns_same_parent_concepts(mock_engine, mock_redis):
    engine, conn = mock_engine
    mock_redis.get.return_value = None

    # First call: get_ancestors(max_levels=1) → parent row
    parent_row = _concept_row(concept_id=317009, name="Heart disease")
    # Second call: get_descendants of parent → siblings
    sibling_row = _concept_row(concept_id=4111234, name="Angina pectoris")

    conn.execute.side_effect = [[parent_row], [sibling_row]]

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.get_siblings(concept_id=4329847)

    assert isinstance(result, list)
    assert any(r["concept_id"] == 4111234 for r in result)


# ---------------------------------------------------------------------------
# Test 4: find_related returns relationships
# ---------------------------------------------------------------------------


def test_find_related_returns_relationships(mock_engine, mock_redis):
    engine, conn = mock_engine
    rel_row = MagicMock()
    rel_row._mapping = {
        "concept_id": 45757366,
        "concept_name": "Aspirin",
        "domain_id": "Drug",
        "vocabulary_id": "RxNorm",
        "standard_concept": "S",
        "relationship_id": "Has associated finding",
    }
    rel_row.__getitem__ = lambda self, key: self._mapping[key]
    rel_row.keys = lambda: list(rel_row._mapping.keys())
    conn.execute.return_value = [rel_row]

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.find_related(concept_id=4329847)

    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["concept_id"] == 45757366


# ---------------------------------------------------------------------------
# Test 5: get_concept returns concept details
# ---------------------------------------------------------------------------


def test_get_concept_returns_concept_details(mock_engine, mock_redis):
    engine, conn = mock_engine
    concept_row = _concept_row(concept_id=4329847, name="Myocardial infarction")
    conn.execute.return_value = MagicMock()
    conn.execute.return_value.fetchone.return_value = concept_row

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.get_concept(concept_id=4329847)

    assert result is not None
    assert result["concept_id"] == 4329847
    assert result["concept_name"] == "Myocardial infarction"


# ---------------------------------------------------------------------------
# Test 6: caches results in Redis (setex called)
# ---------------------------------------------------------------------------


def test_caches_results_in_redis(mock_engine, mock_redis):
    engine, conn = mock_engine
    mock_redis.get.return_value = None  # cache miss

    ancestor_row = _concept_row(concept_id=317009, name="Heart disease")
    conn.execute.return_value = [ancestor_row]

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    svc.get_ancestors(concept_id=4329847)

    mock_redis.setex.assert_called_once()
    call_args = mock_redis.setex.call_args
    # First arg is the key, second is ttl, third is the serialized value
    assert "4329847" in call_args[0][0]
    assert call_args[0][1] == svc.cache_ttl


# ---------------------------------------------------------------------------
# Test 7: returns cached results (doesn't query DB when cache hit)
# ---------------------------------------------------------------------------


def test_returns_cached_results_on_hit(mock_engine, mock_redis):
    engine, conn = mock_engine
    cached_data = [{"concept_id": 317009, "concept_name": "Heart disease (cached)"}]
    mock_redis.get.return_value = json.dumps(cached_data)

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.get_ancestors(concept_id=4329847)

    # DB should NOT have been queried
    conn.execute.assert_not_called()
    assert result == cached_data


# ---------------------------------------------------------------------------
# Test 8: empty result on unknown concept
# ---------------------------------------------------------------------------


def test_empty_result_on_unknown_concept(mock_engine, mock_redis):
    engine, conn = mock_engine
    mock_redis.get.return_value = None
    conn.execute.return_value = []  # no rows

    svc = KnowledgeGraphService(engine=engine, redis_client=mock_redis, vocab_schema="vocab")
    result = svc.get_ancestors(concept_id=99999999)

    assert result == []


# ---------------------------------------------------------------------------
# Test 9: format_hierarchy produces readable text
# ---------------------------------------------------------------------------


def test_format_hierarchy_produces_readable_text(svc):
    concepts = [
        {"concept_id": 317009, "concept_name": "Heart disease", "domain_id": "Condition"},
        {"concept_id": 4329847, "concept_name": "Myocardial infarction", "domain_id": "Condition"},
    ]
    text = svc.format_hierarchy(concepts, direction="ancestors")

    assert "Heart disease" in text
    assert "Myocardial infarction" in text
    assert "ancestors" in text.lower() or "ancestor" in text.lower() or len(text) > 0


# ---------------------------------------------------------------------------
# Test 10: format_related produces readable text
# ---------------------------------------------------------------------------


def test_format_related_produces_readable_text(svc):
    concepts = [
        {
            "concept_id": 45757366,
            "concept_name": "Aspirin",
            "domain_id": "Drug",
            "relationship_id": "Has associated finding",
        }
    ]
    text = svc.format_related(concepts)

    assert "Aspirin" in text
    assert len(text) > 0
