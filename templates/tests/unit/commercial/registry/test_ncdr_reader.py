"""Phase 3 Plan 4C Task 3 (T-022C): NCDRReader CSV parser."""

from __future__ import annotations

import io
from datetime import date

import pytest

from runtime.commercial.registry.ncdr.reader import NCDRReader, NCDRReadError

_HEADER = (
    "PCIRecordID,PatientID,ProcedureDate,PatientAge,Gender,HospitalID,OperatorNPI,"
    "PreOpDiagnosis,HemodynamicEjectionFraction,HemodynamicCardiacIndex,"
    "LesionCount,LesionSegments,PrimaryProcedureCode,StentCount,StentUDIs,StentTypes,"
    "PostOpComplication_Bleeding,PostOpComplication_AKI,PostOpComplication_Stroke,"
    "LengthOfStay,Mortality_InHospital"
)


def _row(**overrides: str) -> str:
    base: dict[str, str] = {
        "PCIRecordID": "PCI-0001",
        "PatientID": "PAT00001",
        "ProcedureDate": "20240601",
        "PatientAge": "65",
        "Gender": "M",
        "HospitalID": "NCDR-H001",
        "OperatorNPI": "1234567893",
        "PreOpDiagnosis": "I21.4",
        "HemodynamicEjectionFraction": "45.0",
        "HemodynamicCardiacIndex": "2.4",
        "LesionCount": "1",
        "LesionSegments": "6",
        "PrimaryProcedureCode": "92928",
        "StentCount": "1",
        "StentUDIs": "08714729123456",
        "StentTypes": "DES",
        "PostOpComplication_Bleeding": "no",
        "PostOpComplication_AKI": "no",
        "PostOpComplication_Stroke": "no",
        "LengthOfStay": "2",
        "Mortality_InHospital": "no",
    }
    base.update(overrides)
    fields = _HEADER.split(",")
    return ",".join(base[f] for f in fields)


def _payload(*rows: str) -> str:
    return _HEADER + "\n" + "\n".join(rows) + "\n"


def test_reader_parses_one_pci() -> None:
    records = NCDRReader().read(io.StringIO(_payload(_row())))
    assert len(records) == 1
    r = records[0]
    assert r.record_id == "PCI-0001"
    assert r.procedure_date == date(2024, 6, 1)
    assert r.lesion_count == 1
    assert r.stent_count == 1
    assert r.stent_types == ["DES"]


def test_reader_handles_multi_stent_pci() -> None:
    records = NCDRReader().read(
        io.StringIO(
            _payload(
                _row(
                    LesionCount="2",
                    LesionSegments="6;8",
                    StentCount="2",
                    StentUDIs="08714729111111;08714729222222",
                    StentTypes="DES;BMS",
                )
            )
        )
    )
    assert records[0].lesion_count == 2
    assert len(records[0].stent_udis) == 2
    assert records[0].stent_types == ["DES", "BMS"]


def test_reader_rejects_mismatched_udi_type_lists() -> None:
    """If StentUDIs has 2 entries but StentTypes has 1, fail closed."""
    with pytest.raises(NCDRReadError):
        NCDRReader().read(
            io.StringIO(
                _payload(
                    _row(
                        StentCount="2",
                        StentUDIs="08714729111111;08714729222222",
                        StentTypes="DES",
                    )
                )
            )
        )


def test_reader_handles_diagnostic_cath() -> None:
    """LesionCount=0 + StentCount=0 + empty UDI/type lists."""
    records = NCDRReader().read(
        io.StringIO(
            _payload(
                _row(
                    LesionCount="0",
                    LesionSegments="",
                    StentCount="0",
                    StentUDIs="",
                    StentTypes="",
                )
            )
        )
    )
    assert records[0].stent_count == 0


def test_reader_handles_complications_and_mortality() -> None:
    records = NCDRReader().read(
        io.StringIO(
            _payload(
                _row(
                    PostOpComplication_Bleeding="yes",
                    PostOpComplication_AKI="yes",
                    Mortality_InHospital="yes",
                )
            )
        )
    )
    assert records[0].postop_bleeding
    assert records[0].postop_aki
    assert records[0].mortality_in_hospital


def test_reader_raises_on_invalid_date() -> None:
    with pytest.raises(NCDRReadError):
        NCDRReader().read(io.StringIO(_payload(_row(ProcedureDate="BADBADBA"))))


def test_reader_raises_on_missing_header() -> None:
    with pytest.raises(NCDRReadError):
        NCDRReader().read(io.StringIO(""))


def test_reader_raises_on_invalid_npi_length() -> None:
    """NCDRRecord requires 10-char NPI; reader surfaces the validation."""
    with pytest.raises(NCDRReadError):
        NCDRReader().read(io.StringIO(_payload(_row(OperatorNPI="123"))))


def test_reader_idempotent() -> None:
    payload = _payload(_row(), _row(PCIRecordID="PCI-0002"))
    a = NCDRReader().read(io.StringIO(payload))
    b = NCDRReader().read(io.StringIO(payload))
    assert a == b
