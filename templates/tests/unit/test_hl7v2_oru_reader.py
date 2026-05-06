"""Phase 3 Plan 5 Task 3 (T-023): Hl7v2OruReader core (R01)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from runtime.lab.types import OruObservation, OruR01Message
from runtime.nodes.hl7v2_oru_reader import Hl7v2OruReader, Hl7v2ParseError

_R01_BASIC = (
    "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0001|P|2.5\r"
    "PID|||PAT00001\r"
    "PV1||O|||||||||||||||||ENC00001\r"
    "ORC|RE|ORD0001\r"
    "OBR|1|ORD0001||GLU-PANEL^Glucose Panel^L|||20240601082000\r"
    "OBX|1|NM|GLU^Glucose^L||105|mg/dL|70-110|N|||F|||20240601083000\r"
    "OBX|2|NM|BUN^Blood urea nitrogen^L||14|mg/dL|7-20|N|||F|||20240601083000\r"
)


def test_reads_one_r01_message() -> None:
    msgs = list(Hl7v2OruReader().read(_R01_BASIC))
    assert len(msgs) == 1
    m = msgs[0]
    assert isinstance(m, OruR01Message)
    assert m.message_control_id == "MSG0001"
    assert m.sending_application == "LIS"
    assert m.sending_facility == "HOSP1"
    assert m.patient_id == "PAT00001"
    assert m.encounter_id == "ENC00001"
    assert m.universal_service_id.startswith("GLU-PANEL")


def test_reads_multiple_obx_per_message() -> None:
    msgs = list(Hl7v2OruReader().read(_R01_BASIC))
    obs = msgs[0].observations
    assert len(obs) == 2
    assert obs[0].observation_id == "GLU"
    assert obs[0].observation_id_text == "Glucose"
    assert obs[0].coding_system == "L"
    assert obs[0].observation_value == "105"
    assert obs[0].units == "mg/dL"
    assert obs[0].abnormal_flag == "N"
    assert obs[0].observation_date == datetime(2024, 6, 1, 8, 30, 0, tzinfo=UTC)
    assert obs[1].observation_id == "BUN"
    assert obs[1].set_id == 2


def test_reads_multiple_messages() -> None:
    text = _R01_BASIC + _R01_BASIC.replace("MSG0001", "MSG0002").replace("PAT00001", "PAT00002")
    msgs = list(Hl7v2OruReader().read(text))
    assert len(msgs) == 2
    assert msgs[0].message_control_id == "MSG0001"
    assert msgs[1].message_control_id == "MSG0002"
    assert msgs[1].patient_id == "PAT00002"


def test_handles_missing_pv1() -> None:
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0010|P|2.5\r"
        "PID|||PAT00010\r"
        "OBR|1|ORD0010||GLU^Glucose^L|||20240601082000\r"
        "OBX|1|NM|GLU^Glucose^L||110|mg/dL||N|||F|||20240601083000\r"
    )
    msgs = list(Hl7v2OruReader().read(text))
    assert msgs[0].encounter_id is None


def test_handles_missing_optional_obx_fields() -> None:
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0011|P|2.5\r"
        "PID|||PAT00011\r"
        "OBR|1|ORD0011||GLU^Glucose^L|||20240601082000\r"
        "OBX|1|ST|FREE^Free text^L||abnormal value\r"
    )
    msgs = list(Hl7v2OruReader().read(text))
    o = msgs[0].observations[0]
    assert o.units is None
    assert o.abnormal_flag is None


def test_normalizes_crlf_and_lf_line_endings() -> None:
    crlf_text = _R01_BASIC.replace("\r", "\r\n")
    lf_text = _R01_BASIC.replace("\r", "\n")
    cr = list(Hl7v2OruReader().read(_R01_BASIC))
    crlf = list(Hl7v2OruReader().read(crlf_text))
    lf = list(Hl7v2OruReader().read(lf_text))
    assert cr[0].message_control_id == crlf[0].message_control_id == lf[0].message_control_id
    assert len(cr[0].observations) == len(crlf[0].observations) == len(lf[0].observations) == 2


def test_raises_on_missing_msh() -> None:
    text = "PID|||PAT0001\rOBR|1\rOBX|1|NM|GLU^Glucose^L||105\r"
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))


def test_raises_on_missing_pid() -> None:
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0020|P|2.5\r"
        "OBR|1|ORD0020||GLU^Glucose^L|||20240601082000\r"
        "OBX|1|NM|GLU^Glucose^L||105\r"
    )
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))


def test_raises_on_missing_obr() -> None:
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0021|P|2.5\r"
        "PID|||PAT00021\r"
        "OBX|1|NM|GLU^Glucose^L||105\r"
    )
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))


def test_message_with_zero_obx_is_allowed() -> None:
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0022|P|2.5\r"
        "PID|||PAT00022\r"
        "OBR|1|ORD0022||GLU^Glucose^L|||20240601082000\r"
    )
    msgs = list(Hl7v2OruReader().read(text))
    assert msgs[0].observations == []


def test_error_message_does_not_leak_patient_id() -> None:
    """HIGHSEC §7: parse errors must not surface PHI tokens."""
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R01|MSG0023|P|2.5\r"
        "OBR|1|ORD0023||GLU^Glucose^L|||20240601082000\r"
        "OBX|1|NM|GLU^Glucose^L||105\r"
    )  # PAT00023 not present (no PID); should still not leak any token
    try:
        list(Hl7v2OruReader().read(text))
    except Hl7v2ParseError as exc:
        assert "PAT" not in str(exc)
        assert "MSG0023" not in str(exc)


def test_observation_returns_pydantic_typed() -> None:
    msgs = list(Hl7v2OruReader().read(_R01_BASIC))
    assert isinstance(msgs[0].observations[0], OruObservation)


# ---------- Task 4: R30/R31 trigger-event variants ----------

_R30_BASIC = (
    "MSH|^~\\&|POC|HOSP1|EHR|HOSP1|20240601083000||ORU^R30|MSG3001|P|2.5\r"
    "PID|||PAT00301\r"
    "PV1||I|||||||||||||||||ENC00301\r"
    "OBR|1|POC0001||GLU^Glucose POC^L|||20240601082000\r"
    "OBX|1|NM|GLU^Glucose POC^L||92|mg/dL||N|||F|||20240601083000\r"
)

_R31_BASIC = (
    "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R31|MSG3101|P|2.5\r"
    "PID|||PAT00310\r"
    "PV1||O|||||||||||||||||ENC00310\r"
    "ORC|RE|ORD3101\r"
    "OBR|1|ORD3101||GLU-PANEL^Glucose Panel^L|||20240601082000\r"
    "OBX|1|NM|GLU^Glucose^L||108|mg/dL|70-110|N|||F|||20240601083000\r"
)


def test_reads_r30_unsolicited_poc_message() -> None:
    msgs = list(Hl7v2OruReader().read(_R30_BASIC))
    assert len(msgs) == 1
    assert msgs[0].encounter_id == "ENC00301"
    assert msgs[0].observations[0].observation_value == "92"


def test_reads_r31_encounter_tied_message() -> None:
    msgs = list(Hl7v2OruReader().read(_R31_BASIC))
    assert len(msgs) == 1
    assert msgs[0].encounter_id == "ENC00310"
    assert msgs[0].observations[0].set_id == 1


def test_r30_without_pv1_raises() -> None:
    """R30 (unsolicited POC) requires PV1; R01 does not."""
    text = (
        "MSH|^~\\&|POC|HOSP1|EHR|HOSP1|20240601083000||ORU^R30|MSG3002|P|2.5\r"
        "PID|||PAT00302\r"
        "OBR|1|POC0002||GLU^Glucose POC^L|||20240601082000\r"
        "OBX|1|NM|GLU^Glucose POC^L||95|mg/dL||N|||F|||20240601083000\r"
    )
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))


def test_r31_without_pv1_raises() -> None:
    """R31 (encounter-tied) requires PV1."""
    text = (
        "MSH|^~\\&|LIS|HOSP1|EHR|HOSP1|20240601083000||ORU^R31|MSG3102|P|2.5\r"
        "PID|||PAT00311\r"
        "OBR|1|ORD3102||GLU^Glucose^L|||20240601082000\r"
        "OBX|1|NM|GLU^Glucose^L||100|mg/dL||N|||F|||20240601083000\r"
    )
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))


def test_unsupported_trigger_event_raises() -> None:
    """ORU^R32 is not a supported trigger; reject explicitly."""
    text = _R01_BASIC.replace("ORU^R01", "ORU^R32")
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))


def test_msh9_missing_trigger_event_raises() -> None:
    """MSH-9 must include a trigger event component (after the message type)."""
    text = _R01_BASIC.replace("ORU^R01", "ORU")
    with pytest.raises(Hl7v2ParseError):
        list(Hl7v2OruReader().read(text))
