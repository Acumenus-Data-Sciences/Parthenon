"""Typed Pydantic models for HL7 v2.x ORU^R01/R30/R31 lab result messages.

Phase 3 Plan 5 Task 2 (T-023). Community-tier (AGPLv3); the
``Hl7v2OruReader`` (Task 3) materializes these and the MEASUREMENT
mapper (Task 6) consumes them.

The shape mirrors the OBR/OBX segment structure of an ORU^R01 message
without leaking HL7 segment text into downstream code: each ``OruR01Message``
groups one or more ``OruObservation`` rows under a single MSH/PID/PV1/OBR
header, and the materializer emits one MEASUREMENT row per observation.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OruObservation(BaseModel):
    """One OBX segment from an ORU message — a single observed value."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    set_id: int = Field(ge=1, description="OBX-1: 1-based ordinal within OBR group")
    value_type: str = Field(description="OBX-2: NM (numeric), CE (coded), ST (string), etc.")
    observation_id: str = Field(description="OBX-3 identifier — the local lab code")
    observation_id_text: str = Field(description="OBX-3 text — human-readable lab name")
    coding_system: str = Field(description="OBX-3 system — typically 'L' (local) or 'LN' (LOINC)")
    observation_value: str = Field(description="OBX-5: raw observation value")
    units: str | None = Field(default=None, description="OBX-6: units string (UCUM-ish)")
    observation_date: datetime = Field(description="OBX-14: observation timestamp")
    abnormal_flag: str | None = Field(
        default=None, description="OBX-8: H/L/N/A flag (None if absent)"
    )


class OruR01Message(BaseModel):
    """One ORU^R01/R30/R31 message — a header plus a list of observations.

    Trigger event (R01 / R30 / R31) is determined by the reader from MSH-9.
    All variants share this OBR-rooted shape; the trigger event only changes
    *which* PV1/OBR fields are required.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    message_control_id: str = Field(description="MSH-10: globally-unique message ID")
    sending_application: str = Field(description="MSH-3")
    sending_facility: str = Field(description="MSH-4")
    patient_id: str = Field(description="PID-3: de-identified per HIGHSEC §7")
    encounter_id: str | None = Field(default=None, description="PV1-19: optional encounter scope")
    order_control_code: str = Field(description="OBR-11: typically 'NW' (new) or 'SC' (correction)")
    universal_service_id: str = Field(description="OBR-4: order-level local code")
    observations: list[OruObservation] = Field(description="One row per OBX segment")


__all__ = ["OruObservation", "OruR01Message"]
