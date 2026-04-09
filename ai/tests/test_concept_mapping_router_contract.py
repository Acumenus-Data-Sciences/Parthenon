"""Contract tests for the concept_mapping router.

Verifies the HTTP contract for the /concept-mapping/map-term and
/concept-mapping/map-batch endpoints. All strategy singletons are patched
so these tests exercise the endpoint wiring, request validation, and
response shape — not the actual SapBERT / LLM pipelines.

See `ai/app/routers/concept_mapping.py` for the live router source.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import ConceptCandidate, RankedCandidate

client = TestClient(app)


def _candidate(concept_id: int = 1001) -> ConceptCandidate:
    return ConceptCandidate(
        concept_id=concept_id,
        concept_name="Hypertension",
        domain_id="Condition",
        vocabulary_id="SNOMED",
        score=0.92,
        strategy="sapbert_cosine",
    )


def _ranked(concept_id: int = 1001) -> RankedCandidate:
    return RankedCandidate(
        concept_id=concept_id,
        concept_name="Hypertension",
        domain_id="Condition",
        vocabulary_id="SNOMED",
        standard_concept="S",
        final_score=0.88,
        strategy_scores={"sapbert_cosine": 0.92},
        primary_strategy="sapbert_cosine",
    )


@patch("app.routers.concept_mapping._ranker")
@patch("app.routers.concept_mapping._llm")
@patch("app.routers.concept_mapping._sapbert")
@patch("app.routers.concept_mapping._exact")
@patch("app.routers.concept_mapping._cache")
def test_map_term_contract_returns_term_candidates_and_timing(
    mock_cache: MagicMock,
    mock_exact: MagicMock,
    mock_sapbert: MagicMock,
    mock_llm: MagicMock,
    mock_ranker: MagicMock,
) -> None:
    """POST /concept-mapping/map-term returns {term, candidates, mapping_time_ms}."""
    mock_cache.match = AsyncMock(return_value=[])
    mock_exact.match = AsyncMock(return_value=[_candidate(2000)])
    mock_sapbert.match = AsyncMock(return_value=[_candidate(3000)])
    mock_llm.match = AsyncMock(return_value=[])
    mock_ranker.rank = MagicMock(return_value=[_ranked(2000)])

    response = client.post(
        "/concept-mapping/map-term",
        json={
            "source_code": "I10",
            "source_description": "Essential hypertension",
            "source_vocabulary_id": "ICD10CM",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) >= {"term", "candidates", "mapping_time_ms"}
    assert isinstance(body["candidates"], list)
    assert len(body["candidates"]) >= 1
    first = body["candidates"][0]
    # RankedCandidate contract shape
    assert set(first.keys()) >= {
        "concept_id",
        "concept_name",
        "domain_id",
        "vocabulary_id",
        "final_score",
        "strategy_scores",
        "primary_strategy",
    }
    assert isinstance(body["mapping_time_ms"], int)


def test_map_term_contract_missing_source_code_returns_422() -> None:
    """POST /concept-mapping/map-term with missing source_code returns 422."""
    response = client.post(
        "/concept-mapping/map-term",
        json={"source_description": "no code provided"},
    )
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body


@patch("app.routers.concept_mapping._ranker")
@patch("app.routers.concept_mapping._llm")
@patch("app.routers.concept_mapping._sapbert")
@patch("app.routers.concept_mapping._exact")
@patch("app.routers.concept_mapping._cache")
def test_map_batch_contract_returns_results_and_strategies(
    mock_cache: MagicMock,
    mock_exact: MagicMock,
    mock_sapbert: MagicMock,
    mock_llm: MagicMock,
    mock_ranker: MagicMock,
) -> None:
    """POST /concept-mapping/map-batch returns {results, total_time_ms, strategies_used}."""
    mock_cache.match = AsyncMock(return_value=[])
    mock_exact.match = AsyncMock(return_value=[_candidate()])
    mock_sapbert.match = AsyncMock(return_value=[])
    mock_llm.match = AsyncMock(return_value=[])
    mock_ranker.rank = MagicMock(return_value=[_ranked()])

    with patch(
        "app.services.sapbert.get_sapbert_service"
    ) as mock_get_sapbert:
        stub = MagicMock()
        stub.encode.return_value = [[0.01] * 768]
        mock_get_sapbert.return_value = stub
        response = client.post(
            "/concept-mapping/map-batch",
            json={
                "terms": [
                    {
                        "source_code": "I10",
                        "source_description": "Essential hypertension",
                        "source_vocabulary_id": "ICD10CM",
                    }
                ]
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) >= {"results", "total_time_ms", "strategies_used"}
    assert isinstance(body["results"], list)
    assert isinstance(body["strategies_used"], dict)
