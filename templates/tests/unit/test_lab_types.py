"""Phase 3 Plan 5 Task 2 (T-023): OruR01Message + OruObservation types."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from runtime.lab.types import OruObservation, OruR01Message


def _obx() -> OruObservation:
    return OruObservation(
        set_id=1,
        value_type="NM",
        observation_id="GLU",
        observation_id_text="Glucose",
        coding_system="L",
        observation_value="105",
        units="mg/dL",
        observation_date=datetime(2024, 6, 1, 8, 30, tzinfo=UTC),
        abnormal_flag="N",
    )


def test_observation_valid() -> None:
    o = _obx()
    assert o.set_id == 1
    assert o.value_type == "NM"
    assert o.observation_id == "GLU"
    assert o.units == "mg/dL"
    assert o.abnormal_flag == "N"


def test_observation_optional_fields_default_none() -> None:
    o = OruObservation(
        set_id=1,
        value_type="ST",
        observation_id="LAB1",
        observation_id_text="Lab 1",
        coding_system="L",
        observation_value="positive",
        observation_date=datetime(2024, 6, 1, tzinfo=UTC),
    )
    assert o.units is None
    assert o.abnormal_flag is None


def test_observation_frozen() -> None:
    o = _obx()
    with pytest.raises(ValidationError):
        o.observation_value = "200"  # type: ignore[misc]


def test_observation_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        OruObservation(
            set_id=1,
            value_type="NM",
            observation_id="GLU",
            observation_id_text="Glucose",
            coding_system="L",
            observation_value="105",
            observation_date=datetime(2024, 6, 1, tzinfo=UTC),
            extra_field="rejected",  # type: ignore[call-arg]
        )


def test_observation_set_id_must_be_ge_1() -> None:
    with pytest.raises(ValidationError):
        OruObservation(
            set_id=0,
            value_type="NM",
            observation_id="GLU",
            observation_id_text="Glucose",
            coding_system="L",
            observation_value="105",
            observation_date=datetime(2024, 6, 1, tzinfo=UTC),
        )


def test_message_valid_with_observations() -> None:
    m = OruR01Message(
        message_control_id="MSG0001",
        sending_application="LIS",
        sending_facility="HOSP1",
        patient_id="PAT00001",
        encounter_id="ENC00001",
        order_control_code="NW",
        universal_service_id="GLU-PANEL",
        observations=[_obx()],
    )
    assert m.message_control_id == "MSG0001"
    assert len(m.observations) == 1
    assert m.observations[0].observation_id == "GLU"


def test_message_optional_encounter_id_defaults_none() -> None:
    m = OruR01Message(
        message_control_id="MSG0002",
        sending_application="POC",
        sending_facility="HOSP1",
        patient_id="PAT00002",
        order_control_code="NW",
        universal_service_id="GLU",
        observations=[_obx()],
    )
    assert m.encounter_id is None


def test_message_frozen() -> None:
    m = OruR01Message(
        message_control_id="MSG0003",
        sending_application="LIS",
        sending_facility="HOSP1",
        patient_id="PAT00003",
        order_control_code="NW",
        universal_service_id="GLU",
        observations=[_obx()],
    )
    with pytest.raises(ValidationError):
        m.message_control_id = "MSG-OTHER"  # type: ignore[misc]


def test_message_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        OruR01Message(
            message_control_id="MSG0004",
            sending_application="LIS",
            sending_facility="HOSP1",
            patient_id="PAT00004",
            order_control_code="NW",
            universal_service_id="GLU",
            observations=[_obx()],
            unknown_field="rejected",  # type: ignore[call-arg]
        )


def test_message_with_no_observations_is_allowed() -> None:
    m = OruR01Message(
        message_control_id="MSG0005",
        sending_application="LIS",
        sending_facility="HOSP1",
        patient_id="PAT00005",
        order_control_code="NW",
        universal_service_id="EMPTY",
        observations=[],
    )
    assert m.observations == []
