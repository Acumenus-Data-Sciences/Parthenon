"""Tests for the clinical NLP endpoints.

The SapBERT concept-linking layer is mocked; regex-based entity extraction
is tested directly by setting link_concepts=false.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.medcat import ClinicalEntity, ClinicalNlpService, NlpResult

client = TestClient(app)


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #


def _make_mock_service(entities: list[ClinicalEntity] | None = None) -> MagicMock:
    """Create a mock ClinicalNlpService that returns the given entities."""
    service = MagicMock(spec=ClinicalNlpService)
    if entities is None:
        entities = []
    result = NlpResult(text="mock", entities=entities)
    service.extract_and_link = AsyncMock(return_value=result)
    return service


# ------------------------------------------------------------------ #
#  Extract entities from clinical text
# ------------------------------------------------------------------ #


@patch("app.routers.clinical_nlp.get_clinical_nlp_service")
def test_extract_returns_entities(mock_get_service: MagicMock) -> None:
    """POST /clinical-nlp/extract should extract entities from clinical text."""
    mock_get_service.return_value = _make_mock_service([
        ClinicalEntity(
            text="hypertension",
            start=0,
            end=12,
            label="DIAGNOSIS",
            confidence=0.9,
        ),
    ])

    response = client.post(
        "/clinical-nlp/extract",
        json={"text": "Patient has hypertension.", "link_concepts": False},
    )

    assert response.status_code == 200
    data = response.json()
    assert "entities" in data
    assert "entity_count" in data
    assert data["entity_count"] >= 1
    ent = data["entities"][0]
    assert ent["text"] == "hypertension"
    assert ent["label"] == "DIAGNOSIS"


# ------------------------------------------------------------------ #
#  Correctly identifies diagnoses (direct regex test)
# ------------------------------------------------------------------ #


def test_extract_identifies_diagnoses() -> None:
    """Regex extraction should find diagnosis terms like 'hypertension' and 'diabetes'."""
    service = ClinicalNlpService()
    result = service.extract_entities(
        "Patient diagnosed with hypertension and type 2 diabetes mellitus."
    )

    entity_texts = [e.text.lower() for e in result.entities]
    # hypertension is in the DIAGNOSIS pattern list
    assert any("hypertension" in t for t in entity_texts)
    # type 2 diabetes should be matched
    assert any("diabetes" in t for t in entity_texts)


# ------------------------------------------------------------------ #
#  Correctly identifies medications (direct regex test)
# ------------------------------------------------------------------ #


def test_extract_identifies_medications() -> None:
    """Regex extraction should find medication terms like 'metformin' and 'lisinopril'."""
    service = ClinicalNlpService()
    result = service.extract_entities(
        "Patient is taking metformin 500mg and lisinopril 10mg daily."
    )

    labels = {e.text.lower(): e.label for e in result.entities}
    assert "metformin" in labels
    assert labels["metformin"] == "MEDICATION"
    assert "lisinopril" in labels
    assert labels["lisinopril"] == "MEDICATION"


# ------------------------------------------------------------------ #
#  Detects negation
# ------------------------------------------------------------------ #


def test_extract_detects_negation() -> None:
    """Regex extraction should flag negated entities (e.g. 'no evidence of pneumonia')."""
    service = ClinicalNlpService()
    result = service.extract_entities(
        "There is no evidence of pneumonia on the chest X-ray."
    )

    pneumonia_entities = [e for e in result.entities if e.text.lower() == "pneumonia"]
    assert len(pneumonia_entities) >= 1
    assert pneumonia_entities[0].negated is True


# ------------------------------------------------------------------ #
#  extract-batch processes multiple texts
# ------------------------------------------------------------------ #


@patch("app.routers.clinical_nlp.get_clinical_nlp_service")
def test_extract_batch_processes_multiple_texts(mock_get_service: MagicMock) -> None:
    """POST /clinical-nlp/extract-batch should process multiple texts."""
    service_mock = _make_mock_service([
        ClinicalEntity(text="hypertension", start=0, end=12, label="DIAGNOSIS"),
    ])
    mock_get_service.return_value = service_mock

    response = client.post(
        "/clinical-nlp/extract-batch",
        json={
            "texts": [
                "Patient has hypertension.",
                "Prescribed metformin.",
            ],
            "link_concepts": False,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 2
    for result in data["results"]:
        assert "entities" in result
        assert "entity_count" in result


# ------------------------------------------------------------------ #
#  Rejects empty text
# ------------------------------------------------------------------ #


def test_extract_rejects_empty_text() -> None:
    """POST /clinical-nlp/extract should reject empty text with 422."""
    response = client.post(
        "/clinical-nlp/extract",
        json={"text": "", "link_concepts": False},
    )
    assert response.status_code == 422
