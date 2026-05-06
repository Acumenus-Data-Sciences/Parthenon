"""Phase 3 Plan 1 Task 4: X12_837_Reader walks segment loops correctly.

Drives the reader against tiny in-memory 837P / 837I / 837D transactions —
no fixture files. Asserts:
- One ``X12_837_Claim`` per CLM-rooted loop.
- One ``X12_837_ClaimLine`` per SV1 / SV2 / SV3 loop.
- ICD-10 diagnosis codes parsed from HI segments.
- Service dates from DTP*472.
- Claim type inferred from the SV* segment used (P / I / D).
"""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

import pytest

from runtime.commercial.claims.exceptions import X12ParseError
from runtime.commercial.claims.readers.x12_837 import X12_837_Reader
from runtime.commercial.claims.types import X12_837_Claim, X12_837_ClaimLine

# The fixtures below are tiny synthetic 837 transactions. NM109 values use
# the public CMS test NPI 1234567893; subscriber/member IDs are obviously
# fake. HIGHSEC §7 still applies: the reader's logger MUST never include
# them — Task 11 adds a regression test for that.

_SAMPLE_837P = (
    "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
    "*260101*1200*^*00501*000000001*0*P*:~"
    "GS*HC*SUBMITTERID*RECEIVERID*20260101*1200*1*X*005010X222A1~"
    "ST*837*0001*005010X222A1~"
    "BHT*0019*00*0123*20260101*1200*CH~"
    "NM1*41*2*ACME CLINIC*****46*SUBID~"
    "PER*IC*JANE DOE*TE*5555550100~"
    "NM1*40*2*PAYER NAME*****46*PAYERID~"
    "HL*1**20*1~"
    "NM1*85*2*PROVIDER ORG*****XX*1234567893~"
    "N3*123 MAIN ST~"
    "N4*ANYTOWN*PA*17000~"
    "REF*EI*112233445~"
    "HL*2*1*22*0~"
    "SBR*P*18*GROUP01******CI~"
    "NM1*IL*1*DOE*JOHN****MI*MEMBERID01~"
    "N3*456 PATIENT LANE~"
    "N4*PHILA*PA*19000~"
    "DMG*D8*19500101*M~"
    "NM1*PR*2*PAYER NAME*****PI*PAYERID~"
    "CLM*CLAIM-1*250.00***11:B:1*Y*A*Y*Y~"
    "DTP*434*D8*20260115~"
    "HI*ABK:R51~"
    "LX*1~"
    "SV1*HC:99213*125.00*UN*1***1~"
    "DTP*472*D8*20260110~"
    "LX*2~"
    "SV1*HC:99214*125.00*UN*1***1~"
    "DTP*472*D8*20260110~"
    "SE*22*0001~"
    "GE*1*1~"
    "IEA*1*000000001~"
)

_SAMPLE_837I = (
    "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
    "*260201*1200*^*00501*000000002*0*P*:~"
    "GS*HC*SUBMITTERID*RECEIVERID*20260201*1200*2*X*005010X223A2~"
    "ST*837*0001*005010X223A2~"
    "BHT*0019*00*0123*20260201*1200*CH~"
    "NM1*85*2*HOSPITAL ORG*****XX*1234567893~"
    "NM1*PR*2*PAYER NAME*****PI*PAYERID~"
    "CLM*INST-1*5000.00***11:A:1*Y*A*Y*Y~"
    "DTP*434*RD8*20260115-20260118~"
    "HI*ABK:I50.9~"
    "LX*1~"
    "SV2*0260*HC:99231*2500.00*UN*1~"
    "DTP*472*D8*20260115~"
    "LX*2~"
    "SV2*0270*HC:99232*2500.00*UN*1~"
    "DTP*472*D8*20260116~"
    "SE*15*0001~"
    "GE*1*2~"
    "IEA*1*000000002~"
)

_SAMPLE_837D = (
    "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
    "*260301*1200*^*00501*000000003*0*P*:~"
    "GS*HC*SUBMITTERID*RECEIVERID*20260301*1200*3*X*005010X224A2~"
    "ST*837*0001*005010X224A2~"
    "BHT*0019*00*0123*20260301*1200*CH~"
    "NM1*85*2*DENTAL OFFICE*****XX*1234567893~"
    "NM1*PR*2*PAYER NAME*****PI*PAYERID~"
    "CLM*DEN-1*200.00***11:B:1*Y*A*Y*Y~"
    "DTP*434*D8*20260301~"
    "HI*ABK:K02.9~"
    "LX*1~"
    "SV3*AD:D1110*100.00**1*1~"
    "DTP*472*D8*20260301~"
    "LX*2~"
    "SV3*AD:D0120*100.00**1*1~"
    "DTP*472*D8*20260301~"
    "SE*14*0001~"
    "GE*1*3~"
    "IEA*1*000000003~"
)


def _read(payload: str) -> tuple[list[X12_837_Claim], list[X12_837_ClaimLine]]:
    reader = X12_837_Reader()
    return reader.read(io.StringIO(payload))


class TestReader837P:
    def test_yields_one_claim_with_two_lines(self) -> None:
        claims, lines = _read(_SAMPLE_837P)
        assert len(claims) == 1
        assert len(lines) == 2

    def test_claim_header_fields(self) -> None:
        claims, _ = _read(_SAMPLE_837P)
        claim = claims[0]
        assert claim.claim_id == "CLAIM-1"
        assert claim.claim_type == "P"
        assert claim.total_charged == Decimal("250.00")
        assert claim.statement_date == date(2026, 1, 15)
        assert "R51" in claim.diagnosis_codes

    def test_claim_lines_have_correct_procedure_codes(self) -> None:
        _, lines = _read(_SAMPLE_837P)
        codes = sorted(line.procedure_code for line in lines)
        assert codes == ["99213", "99214"]
        for line in lines:
            assert line.charged_amount == Decimal("125.00")
            assert line.units == Decimal("1")
            assert line.service_date_from == date(2026, 1, 10)
            assert line.service_date_to == date(2026, 1, 10)


class TestReader837I:
    def test_yields_institutional_claim(self) -> None:
        claims, lines = _read(_SAMPLE_837I)
        assert len(claims) == 1
        assert claims[0].claim_type == "I"
        assert claims[0].total_charged == Decimal("5000.00")
        assert len(lines) == 2
        assert {line.procedure_code for line in lines} == {"99231", "99232"}

    def test_institutional_uses_sv2_amounts(self) -> None:
        _, lines = _read(_SAMPLE_837I)
        for line in lines:
            assert line.charged_amount == Decimal("2500.00")


class TestReader837D:
    def test_yields_dental_claim(self) -> None:
        claims, lines = _read(_SAMPLE_837D)
        assert len(claims) == 1
        assert claims[0].claim_type == "D"
        assert claims[0].total_charged == Decimal("200.00")
        assert len(lines) == 2

    def test_dental_uses_sv3_codes(self) -> None:
        _, lines = _read(_SAMPLE_837D)
        codes = sorted(line.procedure_code for line in lines)
        assert codes == ["D0120", "D1110"]


class TestReaderErrors:
    def test_empty_input_raises(self) -> None:
        with pytest.raises(X12ParseError):
            X12_837_Reader().read(io.StringIO(""))

    def test_missing_clm_segment_yields_no_claims(self) -> None:
        # Valid envelope but no CLM — the reader returns an empty list,
        # not an exception (this is "0 claims" not "broken file").
        envelope_only = (
            "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
            "*260101*1200*^*00501*000000001*0*P*:~"
            "GS*HC*SUBMITTERID*RECEIVERID*20260101*1200*1*X*005010X222A1~"
            "ST*837*0001*005010X222A1~"
            "BHT*0019*00*0123*20260101*1200*CH~"
            "SE*3*0001~GE*1*1~IEA*1*000000001~"
        )
        claims, lines = _read(envelope_only)
        assert claims == []
        assert lines == []
