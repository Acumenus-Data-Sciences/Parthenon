"""NCPDP D.0 reader — parses + materializes one ``NCPDPClaim`` per transaction.

Phase 3 Plan 3 Task 3 (T-021C). Wraps the grammar layer with the
materialization step that produces a typed ``NCPDPClaim``.

Responsibility split:

- ``ncpdp_grammar.parse_ncpdp_transaction(payload)`` returns a dict-of-
  dicts keyed by NCPDP D.0 segment + 2-char field ID. Permissive about
  unknown segments and field-order quirks.
- ``NCPDPReader.read(payload)`` calls the grammar then materializes
  the canonical fields into ``NCPDPClaim``. Pydantic validation errors
  bubble up as ``NCPDPParseError`` with sanitized messages (HIGHSEC §7).

PHI handling: the reader's logger uses ``_RedactingFilter`` mirroring
Plans 1 & 2's pattern. Cardholder ID (NCPDP C2), DOB (C4), and member
ID (C2/CB) are scrubbed from any log records emitted under the reader's
namespace.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Final

from pydantic import ValidationError

from runtime.commercial.claims.exceptions import NCPDPParseError
from runtime.commercial.claims.readers.ncpdp_grammar import (
    NCPDPTransaction,
    parse_ncpdp_transaction,
)
from runtime.commercial.claims.types import NCPDPClaim

_LOGGER = logging.getLogger(__name__)


class _RedactingFilter(logging.Filter):
    """HIGHSEC §7: scrub cardholder IDs / DOBs / NPIs from log records.

    Mirrors Plans 1 & 2's pattern. The filter is broad — false positives
    in log output are acceptable; false negatives violate HIGHSEC §7.
    """

    # 8-15 character alphanumeric tokens — catches NPIs, member IDs,
    # cardholder IDs, prescription reference numbers. CCYYMMDD dates
    # (8 digits) match the same pattern.
    _ID_TOKEN = re.compile(r"\b[A-Z0-9]{8,15}\b")

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        record.msg = self._ID_TOKEN.sub("***REDACTED***", msg)
        record.args = ()
        return True


def _parse_date_field(value: str) -> date:
    """NCPDP D.0 dates are CCYYMMDD strings; raise on malformed."""
    if not value or len(value) != 8 or not value.isdigit():
        raise NCPDPParseError("invalid NCPDP date field length/format")
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError as exc:
        raise NCPDPParseError("invalid NCPDP date value") from exc


def _parse_decimal_field(value: str, *, field_id: str) -> Decimal:
    if value is None or value == "":
        raise NCPDPParseError(f"missing required NCPDP field {field_id}")
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError) as exc:
        raise NCPDPParseError(f"non-numeric NCPDP field {field_id}") from exc


def _parse_int_field(value: str, *, field_id: str) -> int:
    if value is None or value == "":
        raise NCPDPParseError(f"missing required NCPDP field {field_id}")
    try:
        return int(value)
    except ValueError as exc:
        raise NCPDPParseError(f"non-integer NCPDP field {field_id}") from exc


# Field-id constants (NCPDP D.0 §A.4 / §B.1). All IDs are exactly 2 chars.
_FIELD_TXN_CODE: Final[str] = "A4"
_FIELD_BIN: Final[str] = "A1"
_FIELD_PCN: Final[str] = "A3"  # 1Ø3-A3 Processor Control Number
_FIELD_NPI: Final[str] = "N2"
_FIELD_CARDHOLDER: Final[str] = "C2"
_FIELD_DOB: Final[str] = "C4"
_FIELD_NDC: Final[str] = "D7"
_FIELD_DAYS_SUPPLY: Final[str] = "D3"
_FIELD_QUANTITY: Final[str] = "D5"
_FIELD_INGREDIENT_COST: Final[str] = "D9"
_FIELD_DISPENSING_FEE: Final[str] = "DC"
_FIELD_PATIENT_PAY: Final[str] = "F4"


def _require(seg: dict[str, str], field_id: str) -> str:
    value = seg.get(field_id, "")
    if not value:
        raise NCPDPParseError(f"missing required NCPDP field {field_id}")
    return value


class NCPDPReader:
    """Read one NCPDP D.0 pharmacy-claim transaction."""

    type_name = "ncpdp_reader"

    def __init__(self) -> None:
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, payload: str) -> NCPDPClaim:
        """Parse + materialize one ``NCPDPClaim`` from a payload string.

        Raises ``NCPDPParseError`` on malformed input or missing required
        fields. Pydantic ``ValidationError`` is wrapped — the caller
        sees one stable exception type.
        """
        txn: NCPDPTransaction = parse_ncpdp_transaction(payload)

        txn_code = _require(txn.header, _FIELD_TXN_CODE)
        bin_number = _require(txn.header, _FIELD_BIN)
        pcn = _require(txn.header, _FIELD_PCN)
        npi = _require(txn.header, _FIELD_NPI)
        cardholder_id = _require(txn.insurance, _FIELD_CARDHOLDER)
        dob_raw = _require(txn.patient, _FIELD_DOB)
        dos = _parse_date_field(dob_raw)
        ndc = _require(txn.claim, _FIELD_NDC)
        days_supply = _parse_int_field(
            _require(txn.claim, _FIELD_DAYS_SUPPLY),
            field_id=_FIELD_DAYS_SUPPLY,
        )
        quantity = _parse_decimal_field(
            _require(txn.claim, _FIELD_QUANTITY),
            field_id=_FIELD_QUANTITY,
        )
        ingredient_cost = _parse_decimal_field(
            _require(txn.pricing, _FIELD_INGREDIENT_COST),
            field_id=_FIELD_INGREDIENT_COST,
        )
        dispensing_fee = _parse_decimal_field(
            _require(txn.pricing, _FIELD_DISPENSING_FEE),
            field_id=_FIELD_DISPENSING_FEE,
        )
        patient_pay = _parse_decimal_field(
            _require(txn.pricing, _FIELD_PATIENT_PAY),
            field_id=_FIELD_PATIENT_PAY,
        )

        try:
            return NCPDPClaim(
                transaction_code=txn_code,  # type: ignore[arg-type]
                bin_number=bin_number,
                processor_control_number=pcn,
                pharmacy_npi=npi,
                cardholder_id=cardholder_id,
                date_of_service=dos,
                ndc_code=ndc,
                days_supply=days_supply,
                quantity_dispensed=quantity,
                ingredient_cost=ingredient_cost,
                dispensing_fee=dispensing_fee,
                patient_paid_amount=patient_pay,
                is_reversal=txn.is_reversal,
            )
        except ValidationError as exc:
            # Surface a single sanitized exception type — never echo the
            # raw ValidationError because it includes input values, which
            # may include PHI fields like cardholder_id and DOB.
            raise NCPDPParseError("NCPDP claim validation failed") from exc


__all__ = ["NCPDPReader"]
