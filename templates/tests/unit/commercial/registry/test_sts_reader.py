"""Phase 3 Plan 4B Task 3 (T-022B): STSReader CSV parser."""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

import pytest

from runtime.commercial.registry.sts.reader import STSReader, STSReadError

_HEADER = (
    "RecordID,PatientID,SurgeryDate,PatientAge,Gender,HospitalID,SurgeonID,"
    "EjectionFraction,NyhaClass,PrimaryDiagnosis,SecondaryDiagnoses,"
    "ProcedureID,ProcedureCode_Primary,ProcedureCode_Secondary,"
    "PostOpComplication_AKI,PostOpComplication_Stroke,"
    "PostOpComplication_Reoperation,PostOpComplication_Sepsis,"
    "LengthOfStay,DischargeDisposition,Mortality_30Day"
)


def _row(**overrides: str) -> str:
    base: dict[str, str] = {
        "RecordID": "STS-0001",
        "PatientID": "PAT00001",
        "SurgeryDate": "20240515",
        "PatientAge": "67",
        "Gender": "M",
        "HospitalID": "H001",
        "SurgeonID": "S001",
        "EjectionFraction": "55.0",
        "NyhaClass": "2",
        "PrimaryDiagnosis": "I25.10",
        "SecondaryDiagnoses": "I50.32;E11.9",
        "ProcedureID": "CABG",
        "ProcedureCode_Primary": "33533",
        "ProcedureCode_Secondary": "33510",
        "PostOpComplication_AKI": "no",
        "PostOpComplication_Stroke": "no",
        "PostOpComplication_Reoperation": "no",
        "PostOpComplication_Sepsis": "no",
        "LengthOfStay": "7",
        "DischargeDisposition": "Home",
        "Mortality_30Day": "no",
    }
    base.update(overrides)
    fields = (
        "RecordID,PatientID,SurgeryDate,PatientAge,Gender,HospitalID,SurgeonID,"
        "EjectionFraction,NyhaClass,PrimaryDiagnosis,SecondaryDiagnoses,"
        "ProcedureID,ProcedureCode_Primary,ProcedureCode_Secondary,"
        "PostOpComplication_AKI,PostOpComplication_Stroke,"
        "PostOpComplication_Reoperation,PostOpComplication_Sepsis,"
        "LengthOfStay,DischargeDisposition,Mortality_30Day"
    ).split(",")
    return ",".join(base[f] for f in fields)


def _payload(*rows: str) -> str:
    return _HEADER + "\n" + "\n".join(rows) + "\n"


def test_reader_parses_one_row() -> None:
    records = STSReader().read(io.StringIO(_payload(_row())))
    assert len(records) == 1
    r = records[0]
    assert r.record_id == "STS-0001"
    assert r.surgery_date == date(2024, 5, 15)
    assert r.ejection_fraction == Decimal("55.0")
    assert r.procedure_category == "CABG"
    assert r.secondary_diagnoses_icd10 == ["I50.32", "E11.9"]
    assert r.secondary_procedure_codes == ["33510"]
    assert r.postop_aki is False


def test_reader_parses_multiple_rows() -> None:
    records = STSReader().read(
        io.StringIO(
            _payload(
                _row(),
                _row(RecordID="STS-0002", ProcedureID="Valve", ProcedureCode_Primary="33405"),
                _row(RecordID="STS-0003", ProcedureID="Aortic", ProcedureCode_Primary="33860"),
            )
        )
    )
    assert len(records) == 3
    assert records[1].procedure_category == "Valve"
    assert records[2].procedure_category == "Aortic"


def test_reader_handles_yes_no_and_numeric_booleans() -> None:
    records = STSReader().read(
        io.StringIO(_payload(_row(PostOpComplication_AKI="yes", Mortality_30Day="1")))
    )
    assert records[0].postop_aki is True
    assert records[0].mortality_30day is True


def test_reader_handles_empty_secondary_lists() -> None:
    records = STSReader().read(
        io.StringIO(_payload(_row(SecondaryDiagnoses="", ProcedureCode_Secondary="")))
    )
    assert records[0].secondary_diagnoses_icd10 == []
    assert records[0].secondary_procedure_codes == []


def test_reader_raises_on_missing_header() -> None:
    with pytest.raises(STSReadError):
        STSReader().read(io.StringIO(""))


def test_reader_raises_on_invalid_date() -> None:
    with pytest.raises(STSReadError):
        STSReader().read(io.StringIO(_payload(_row(SurgeryDate="BADDATE0"))))


def test_reader_raises_on_unknown_procedure_category() -> None:
    with pytest.raises(STSReadError):
        STSReader().read(io.StringIO(_payload(_row(ProcedureID="Brain"))))


def test_reader_raises_on_unparseable_boolean() -> None:
    with pytest.raises(STSReadError):
        STSReader().read(io.StringIO(_payload(_row(PostOpComplication_AKI="maybe"))))


def test_reader_idempotent() -> None:
    payload = _payload(_row(), _row(RecordID="STS-0002"))
    a = STSReader().read(io.StringIO(payload))
    b = STSReader().read(io.StringIO(payload))
    assert a == b
