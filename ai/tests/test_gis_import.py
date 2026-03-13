"""Tests for the GIS Import endpoints (analyze, ask, learn, convert).

All Ollama and ChromaDB dependencies are mocked so tests run without
any external services.
"""

import io
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# ------------------------------------------------------------------ #
#  Shared helpers / fixtures
# ------------------------------------------------------------------ #

_SAMPLE_ANALYZE_REQUEST: dict[str, Any] = {
    "filename": "county_health_2022.csv",
    "headers": ["fips_code", "county_name", "obesity_rate", "smoking_rate"],
    "sample_rows": [
        {"fips_code": "01001", "county_name": "Autauga County", "obesity_rate": 32.1, "smoking_rate": 18.5},
        {"fips_code": "01003", "county_name": "Baldwin County", "obesity_rate": 28.4, "smoking_rate": 16.2},
    ],
    "column_stats": {
        "fips_code": {"distinct": 100, "nulls": 0},
        "county_name": {"distinct": 100, "nulls": 0},
        "obesity_rate": {"min": 15.0, "max": 55.0, "mean": 33.2},
        "smoking_rate": {"min": 8.0, "max": 40.0, "mean": 19.1},
    },
}

_MOCK_OLLAMA_ANALYZE_RESPONSE = {
    "suggestions": [
        {
            "column": "fips_code",
            "purpose": "geography_code",
            "geo_type": "fips_county",
            "exposure_type": None,
            "confidence": 0.97,
            "reasoning": "Five-digit string matching FIPS county format",
        },
        {
            "column": "county_name",
            "purpose": "geography_name",
            "geo_type": None,
            "exposure_type": None,
            "confidence": 0.92,
            "reasoning": "Contains 'county' in values",
        },
        {
            "column": "obesity_rate",
            "purpose": "value",
            "geo_type": None,
            "exposure_type": "obesity",
            "confidence": 0.88,
            "reasoning": "Numeric rate column named obesity",
        },
        {
            "column": "smoking_rate",
            "purpose": "value",
            "geo_type": None,
            "exposure_type": "smoking",
            "confidence": 0.85,
            "reasoning": "Numeric rate column named smoking",
        },
    ]
}


def _make_ollama_response(payload: dict[str, Any]) -> MagicMock:
    """Build a mock httpx Response for Ollama generate."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"response": json.dumps(payload)}
    return mock_resp


# ------------------------------------------------------------------ #
#  1. analyze — returns column suggestions
# ------------------------------------------------------------------ #


def test_analyze_endpoint_returns_column_suggestions() -> None:
    """POST /gis-import/analyze should return column suggestions with purpose,
    confidence, and reasoning for each column."""
    mock_resp = _make_ollama_response(_MOCK_OLLAMA_ANALYZE_RESPONSE)

    with (
        patch("app.services.abby_gis_analyzer._get_chroma_client") as mock_chroma,
        patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp),
    ):
        # ChromaDB returns empty (no prior mappings)
        mock_col = MagicMock()
        mock_col.count.return_value = 0
        mock_chroma.return_value.get_or_create_collection.return_value = mock_col

        response = client.post("/gis-import/analyze", json=_SAMPLE_ANALYZE_REQUEST)

    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    suggestions = data["suggestions"]
    assert isinstance(suggestions, list)
    assert len(suggestions) == 4

    # Verify each suggestion has required fields
    for s in suggestions:
        assert "column" in s
        assert "purpose" in s
        assert "confidence" in s
        assert "reasoning" in s


# ------------------------------------------------------------------ #
#  2. analyze — confidence scores in valid range
# ------------------------------------------------------------------ #


def test_analyze_returns_valid_confidence_range() -> None:
    """All confidence scores returned by /gis-import/analyze must be 0.0–1.0."""
    mock_resp = _make_ollama_response(_MOCK_OLLAMA_ANALYZE_RESPONSE)

    with (
        patch("app.services.abby_gis_analyzer._get_chroma_client") as mock_chroma,
        patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp),
    ):
        mock_col = MagicMock()
        mock_col.count.return_value = 0
        mock_chroma.return_value.get_or_create_collection.return_value = mock_col

        response = client.post("/gis-import/analyze", json=_SAMPLE_ANALYZE_REQUEST)

    assert response.status_code == 200
    suggestions = response.json()["suggestions"]
    for s in suggestions:
        confidence = s["confidence"]
        assert 0.0 <= confidence <= 1.0, f"Confidence {confidence} out of range for column {s['column']}"


# ------------------------------------------------------------------ #
#  3. ask — returns conversational response
# ------------------------------------------------------------------ #


def test_ask_endpoint_returns_response() -> None:
    """POST /gis-import/ask should return an answer string for a column question."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "response": "The fips_code column contains 5-digit FIPS county codes in the format SSCCC."
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        response = client.post(
            "/gis-import/ask",
            json={
                "column_name": "fips_code",
                "sample_values": ["01001", "01003", "01005"],
                "stats": {"distinct": 100, "nulls": 0},
                "question": "What format is this column in?",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert isinstance(data["answer"], str)
    assert len(data["answer"]) > 0


# ------------------------------------------------------------------ #
#  4. learn — stores mappings in ChromaDB
# ------------------------------------------------------------------ #


def test_learn_endpoint_stores_mapping() -> None:
    """POST /gis-import/learn should store confirmed mappings and return count."""
    mappings = [
        {"column_name": "fips_code", "mapped_to": "geography_code", "data_type": "string"},
        {"column_name": "obesity_rate", "mapped_to": "value", "data_type": "float"},
    ]

    mock_col = MagicMock()
    mock_col.upsert = MagicMock()

    with patch("app.services.abby_gis_analyzer._get_chroma_client") as mock_chroma:
        mock_chroma.return_value.get_or_create_collection.return_value = mock_col

        response = client.post("/gis-import/learn", json={"mappings": mappings})

    assert response.status_code == 200
    data = response.json()
    assert "stored" in data
    assert data["stored"] == 2

    # Verify ChromaDB upsert was called
    mock_col.upsert.assert_called_once()
    call_kwargs = mock_col.upsert.call_args
    # ids, documents, metadatas should be lists of length 2
    assert len(call_kwargs.kwargs.get("ids", call_kwargs.args[0] if call_kwargs.args else [])) == 2


# ------------------------------------------------------------------ #
#  5. convert — GeoJSON passthrough
# ------------------------------------------------------------------ #


def test_convert_geojson_passthrough() -> None:
    """POST /gis-import/convert with a GeoJSON file should return a FeatureCollection."""
    geojson_content = json.dumps({
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-87.6298, 41.8781]},
                "properties": {"name": "Chicago"},
            }
        ],
    })

    file_bytes = geojson_content.encode("utf-8")
    response = client.post(
        "/gis-import/convert",
        files={"file": ("test.geojson", io.BytesIO(file_bytes), "application/geo+json")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert "feature_count" in data
    assert data["feature_count"] == 1
    assert data["crs"] == "EPSG:4326"


# ------------------------------------------------------------------ #
#  6. analyze — graceful when Ollama is down
# ------------------------------------------------------------------ #


def test_analyze_graceful_when_ollama_down() -> None:
    """When Ollama is unavailable, /gis-import/analyze should return a
    fallback response (not a 500 error) with source='error'."""
    import httpx

    with (
        patch("app.services.abby_gis_analyzer._get_chroma_client") as mock_chroma,
        patch(
            "httpx.AsyncClient.post",
            new_callable=AsyncMock,
            side_effect=httpx.ConnectError("Connection refused"),
        ),
    ):
        mock_col = MagicMock()
        mock_col.count.return_value = 0
        mock_chroma.return_value.get_or_create_collection.return_value = mock_col

        response = client.post("/gis-import/analyze", json=_SAMPLE_ANALYZE_REQUEST)

    # Endpoint should not return 500 — it handles errors gracefully
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert data["source"] in ("error", "fallback", "abby")
    # Suggestions may be empty list, but the key must be present
    assert isinstance(data["suggestions"], list)


# ------------------------------------------------------------------ #
#  7. convert — unsupported format returns 400
# ------------------------------------------------------------------ #


def test_convert_unsupported_format_returns_400() -> None:
    """POST /gis-import/convert with an unsupported file type should return 400."""
    response = client.post(
        "/gis-import/convert",
        files={"file": ("data.txt", io.BytesIO(b"some,data\n1,2"), "text/plain")},
    )
    assert response.status_code == 400


# ------------------------------------------------------------------ #
#  8. learn — empty mappings returns 0
# ------------------------------------------------------------------ #


def test_learn_empty_mappings_returns_zero() -> None:
    """POST /gis-import/learn with empty mappings list should return stored=0."""
    mock_col = MagicMock()
    mock_col.upsert = MagicMock()

    with patch("app.services.abby_gis_analyzer._get_chroma_client") as mock_chroma:
        mock_chroma.return_value.get_or_create_collection.return_value = mock_col

        response = client.post("/gis-import/learn", json={"mappings": []})

    assert response.status_code == 200
    assert response.json()["stored"] == 0


# ------------------------------------------------------------------ #
#  9. ask — graceful when Ollama is down
# ------------------------------------------------------------------ #


def test_ask_graceful_when_ollama_down() -> None:
    """When Ollama is unavailable, /gis-import/ask should return a fallback
    answer string, not raise a 500."""
    import httpx

    with patch(
        "httpx.AsyncClient.post",
        new_callable=AsyncMock,
        side_effect=httpx.ConnectError("Connection refused"),
    ):
        response = client.post(
            "/gis-import/ask",
            json={
                "column_name": "fips_code",
                "sample_values": ["01001"],
                "stats": {},
                "question": "What is this column?",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    # The service returns a fallback message like "Abby is unavailable: ..."
    assert isinstance(data["answer"], str)
    assert len(data["answer"]) > 0
