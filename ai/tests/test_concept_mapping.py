"""Tests for the concept mapping endpoints.

All strategy dependencies are mocked so these tests verify the endpoint
routing, request/response schema, and pipeline wiring -- not the actual
strategy implementations.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import ConceptCandidate, RankedCandidate

client = TestClient(app)


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #


def _fake_candidate(concept_id: int = 1, score: float = 0.9) -> ConceptCandidate:
    return ConceptCandidate(
        concept_id=concept_id,
        concept_name="Hypertension",
        domain_id="Condition",
        vocabulary_id="SNOMED",
        score=score,
        strategy="sapbert_cosine",
    )


def _fake_ranked(concept_id: int = 1, final_score: float = 0.85) -> RankedCandidate:
    return RankedCandidate(
        concept_id=concept_id,
        concept_name="Hypertension",
        domain_id="Condition",
        vocabulary_id="SNOMED",
        standard_concept=None,
        final_score=final_score,
        strategy_scores={"sapbert_cosine": final_score},
        primary_strategy="sapbert_cosine",
    )


def _patch_strategies():
    """Return a dict of patches for all five strategy singletons in the
    concept_mapping router module."""
    cache_mock = AsyncMock(return_value=[])
    exact_mock = AsyncMock(return_value=[])
    sapbert_mock = AsyncMock(return_value=[_fake_candidate()])
    llm_mock = AsyncMock(return_value=[])

    ranker_mock = MagicMock()
    ranker_mock.rank.return_value = [_fake_ranked()]

    return {
        "app.routers.concept_mapping._cache": MagicMock(match=cache_mock),
        "app.routers.concept_mapping._exact": MagicMock(match=exact_mock),
        "app.routers.concept_mapping._sapbert": MagicMock(match=sapbert_mock),
        "app.routers.concept_mapping._llm": MagicMock(match=llm_mock),
        "app.routers.concept_mapping._ranker": ranker_mock,
    }


# ------------------------------------------------------------------ #
#  map-term returns ranked candidates
# ------------------------------------------------------------------ #


def test_map_term_returns_ranked_candidates() -> None:
    """POST /concept-mapping/map-term should return ranked candidates."""
    patches = _patch_strategies()
    with (
        patch.dict("app.routers.concept_mapping.__dict__", {
            "_cache": patches["app.routers.concept_mapping._cache"],
            "_exact": patches["app.routers.concept_mapping._exact"],
            "_sapbert": patches["app.routers.concept_mapping._sapbert"],
            "_llm": patches["app.routers.concept_mapping._llm"],
            "_ranker": patches["app.routers.concept_mapping._ranker"],
        }),
    ):
        response = client.post(
            "/concept-mapping/map-term",
            json={
                "source_code": "401.9",
                "source_description": "Hypertension",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "term" in data
    assert "candidates" in data
    assert isinstance(data["candidates"], list)
    assert len(data["candidates"]) >= 1
    assert "mapping_time_ms" in data
    cand = data["candidates"][0]
    assert "concept_id" in cand
    assert "final_score" in cand
    assert "strategy_scores" in cand
    assert "primary_strategy" in cand


# ------------------------------------------------------------------ #
#  map-batch returns results for multiple terms
# ------------------------------------------------------------------ #


def test_map_batch_returns_results_for_multiple_terms() -> None:
    """POST /concept-mapping/map-batch should return one result per term."""
    ranker_mock = MagicMock()
    ranker_mock.rank.return_value = [_fake_ranked()]

    with (
        patch.dict("app.routers.concept_mapping.__dict__", {
            "_cache": MagicMock(match=AsyncMock(return_value=[])),
            "_exact": MagicMock(match=AsyncMock(return_value=[])),
            "_sapbert": MagicMock(match=AsyncMock(return_value=[])),
            "_llm": MagicMock(match=AsyncMock(return_value=[])),
            "_ranker": ranker_mock,
        }),
        patch("app.services.sapbert.get_sapbert_service") as mock_sapbert_svc,
        patch("app.db.search_nearest") as mock_search,
    ):
        mock_sapbert_svc.return_value = MagicMock(
            encode=MagicMock(return_value=[[0.1] * 768, [0.2] * 768])
        )
        mock_search.return_value = []

        response = client.post(
            "/concept-mapping/map-batch",
            json={
                "terms": [
                    {"source_code": "401.9", "source_description": "Hypertension"},
                    {"source_code": "250.00", "source_description": "Diabetes"},
                ]
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 2
    assert "total_time_ms" in data
    assert "strategies_used" in data
    for result in data["results"]:
        assert "term" in result
        assert "source_code" in result
        assert "candidates" in result


# ------------------------------------------------------------------ #
#  map-batch rejects >200 terms
# ------------------------------------------------------------------ #


def test_map_batch_rejects_over_200_terms() -> None:
    """POST /concept-mapping/map-batch should reject batches with >200 terms."""
    terms = [{"source_code": f"CODE{i}"} for i in range(201)]
    response = client.post(
        "/concept-mapping/map-batch",
        json={"terms": terms},
    )
    assert response.status_code == 422  # Pydantic validation error


# ------------------------------------------------------------------ #
#  Single term maps through strategy pipeline
# ------------------------------------------------------------------ #


def test_map_term_pipeline_calls_strategies() -> None:
    """map-term should call cache, exact, sapbert strategies in order."""
    cache_mock = AsyncMock(return_value=[])
    exact_mock = AsyncMock(return_value=[])
    sapbert_mock = AsyncMock(return_value=[_fake_candidate(score=0.5)])
    llm_mock = AsyncMock(return_value=[])

    ranker_mock = MagicMock()
    ranker_mock.rank.return_value = [_fake_ranked()]

    with patch.dict("app.routers.concept_mapping.__dict__", {
        "_cache": MagicMock(match=cache_mock),
        "_exact": MagicMock(match=exact_mock),
        "_sapbert": MagicMock(match=sapbert_mock),
        "_llm": MagicMock(match=llm_mock),
        "_ranker": ranker_mock,
    }):
        response = client.post(
            "/concept-mapping/map-term",
            json={
                "source_code": "401.9",
                "source_description": "Hypertension",
            },
        )

    assert response.status_code == 200

    # Verify each strategy was called
    cache_mock.assert_called_once()
    exact_mock.assert_called_once()
    sapbert_mock.assert_called_once()

    # LLM should NOT be called because sapbert score (0.5) is below _LLM_LOWER (0.70)
    llm_mock.assert_not_called()

    # Ranker should always be called
    ranker_mock.rank.assert_called_once()
