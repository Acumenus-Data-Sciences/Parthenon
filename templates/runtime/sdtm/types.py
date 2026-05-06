"""SDTM domain enum (Phase 2 spec Q9 — v1 ships DM/AE/CM/VS/LB).

Other CDISC domains (DS, EX, PE, SU, MH, TR, TU, etc.) are out of scope
for v1 per Q9; adding them is a Phase 3 follow-up scoped per customer pull.
"""

from __future__ import annotations

import enum


class SdtmDomain(str, enum.Enum):
    DM = "DM"  # Demographics
    AE = "AE"  # Adverse Events
    CM = "CM"  # Concomitant Medications
    VS = "VS"  # Vital Signs
    LB = "LB"  # Laboratory Results
