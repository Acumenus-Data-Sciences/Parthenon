"""runtime.instruments.pro_base: shared logic for PRO instrument templates."""

from __future__ import annotations

from runtime.instruments.pro_base import (
    ItemMapping,
    MeasurementRow,
    ProInstrumentDefinition,
    parse_questionnaire_response,
)


def test_item_mapping_validates() -> None:
    m = ItemMapping(
        item_code="MO",
        measurement_concept_id=2000123456,
        value_unit_concept_id=8512,
    )
    assert m.item_code == "MO"


def test_parse_questionnaire_response_yields_one_row_per_item() -> None:
    """A QuestionnaireResponse with 5 EQ-5D-5L items yields 5 rows + 1 VAS row."""
    definition = ProInstrumentDefinition(
        instrument_id="eq5d5l",
        items=[
            ItemMapping(item_code=code, measurement_concept_id=2000_000_000 + i)
            for i, code in enumerate(["MO", "SC", "UA", "PD", "AD"])
        ],
        vas_item_code="VAS",
        vas_measurement_concept_id=2000_000_999,
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "subject": {"reference": "Patient/p1"},
        "authored": "2026-05-03T10:00:00Z",
        "item": [
            {"linkId": "MO", "answer": [{"valueInteger": 1}]},
            {"linkId": "SC", "answer": [{"valueInteger": 2}]},
            {"linkId": "UA", "answer": [{"valueInteger": 1}]},
            {"linkId": "PD", "answer": [{"valueInteger": 3}]},
            {"linkId": "AD", "answer": [{"valueInteger": 2}]},
            {"linkId": "VAS", "answer": [{"valueInteger": 75}]},
        ],
    }

    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 6
    assert all(isinstance(r, MeasurementRow) for r in rows)
    assert all(r.person_source_value == "p1" for r in rows)
    assert all(r.measurement_date == "2026-05-03" for r in rows)
    assert {r.item_code for r in rows} == {"MO", "SC", "UA", "PD", "AD", "VAS"}


def test_parse_skips_unknown_item_codes() -> None:
    """An item not in the instrument definition is skipped (logged, not failed)."""
    definition = ProInstrumentDefinition(
        instrument_id="eq5d5l",
        items=[ItemMapping(item_code="MO", measurement_concept_id=2000_000_001)],
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "subject": {"reference": "Patient/p1"},
        "authored": "2026-05-03T10:00:00Z",
        "item": [
            {"linkId": "MO", "answer": [{"valueInteger": 1}]},
            {"linkId": "MADE_UP", "answer": [{"valueInteger": 99}]},
        ],
    }
    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 1
    assert rows[0].item_code == "MO"


def test_parse_handles_missing_subject_gracefully() -> None:
    """A QR with no subject reference yields rows with person_source_value=None."""
    definition = ProInstrumentDefinition(
        instrument_id="eq5d5l",
        items=[ItemMapping(item_code="MO", measurement_concept_id=2000_000_001)],
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "authored": "2026-05-03T10:00:00Z",
        "item": [{"linkId": "MO", "answer": [{"valueInteger": 1}]}],
    }
    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 1
    assert rows[0].person_source_value is None


def test_parse_handles_decimal_answers() -> None:
    """valueDecimal answers are passed through unchanged."""
    definition = ProInstrumentDefinition(
        instrument_id="custom",
        items=[ItemMapping(item_code="X", measurement_concept_id=2000_000_001)],
    )
    qr = {
        "resourceType": "QuestionnaireResponse",
        "id": "qr1",
        "subject": {"reference": "Patient/p1"},
        "authored": "2026-05-03T10:00:00Z",
        "item": [{"linkId": "X", "answer": [{"valueDecimal": 0.875}]}],
    }
    rows = list(parse_questionnaire_response(qr, definition))
    assert len(rows) == 1
    assert rows[0].value_as_number == 0.875
