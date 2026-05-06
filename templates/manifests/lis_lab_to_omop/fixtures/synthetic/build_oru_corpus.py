"""Synthetic HL7 v2 ORU corpus builder — deterministic with seed=42.

Phase 3 Plan 5 Task 8 (T-023). 50-message corpus for the validation E2E.

Plan-driven mix:

- 30 messages with OBX rows whose ``coding_system='LN'`` and codes drawn
  from a real LOINC sample (mapper resolves these to standard concepts).
- 20 messages where ~50% of OBX rows are facility-local coded
  (``coding_system='L'`` with codes like ``FAC-GLU``); these populate
  the unmapped_local_lab_code queue.
- Mostly ORU^R01 with a sprinkling of R30 (point-of-care) and R31
  (encounter-tied) so the trigger-event variants get exercised.

PHI-free: patient_id / message_control_id / encounter_id are
deterministic synthetic tokens (``PAT00001``, ``MSG00001``, ``ENC00001``).
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Final

# Real LOINC short-name pairs — chosen for representative lab volume.
_LOINC_CODES: Final[list[tuple[str, str, str]]] = [
    ("2345-7", "Glucose [Mass/volume] in Serum or Plasma", "mg/dL"),
    ("2160-0", "Creatinine [Mass/volume] in Serum or Plasma", "mg/dL"),
    ("6690-2", "Leukocytes [#/volume] in Blood", "10*3/uL"),
    ("718-7", "Hemoglobin [Mass/volume] in Blood", "g/dL"),
    ("2823-3", "Potassium [Moles/volume] in Serum or Plasma", "mmol/L"),
    ("2951-2", "Sodium [Moles/volume] in Serum or Plasma", "mmol/L"),
]

# Synthetic facility-local codes — these MUST land in the unmapped queue.
_LOCAL_CODES: Final[list[tuple[str, str, str]]] = [
    ("FAC-GLU", "Facility glucose panel", "mg/dL"),
    ("FAC-K", "Facility potassium", "mmol/L"),
    ("FAC-NA", "Facility sodium", "mmol/L"),
    ("FAC-WBC", "Facility WBC count", "10*3/uL"),
]

_TRIGGERS: Final[list[str]] = ["R01"] * 8 + ["R30"] + ["R31"]
_FACILITIES: Final[list[str]] = ["HOSP1", "HOSP2", "HOSP3"]


@dataclass(frozen=True)
class _ObxSpec:
    set_id: int
    value_type: str
    code: str
    text: str
    coding_system: str
    value: str
    units: str
    abnormal: str
    obs_ts: str


@dataclass(frozen=True)
class _MsgSpec:
    seed_idx: int
    trigger: str
    message_control_id: str
    patient_id: str
    encounter_id: str
    facility: str
    msg_ts: str
    obx_rows: tuple[_ObxSpec, ...]


def _value_for(code: str, rng: random.Random) -> str:
    """Generate a numeric value within a plausible range for the LOINC short code."""
    if code in {"2345-7", "FAC-GLU"}:
        return f"{70 + rng.randint(0, 60)}"
    if code in {"2160-0"}:
        return f"{0.6 + rng.random() * 0.8:.2f}"
    if code in {"6690-2", "FAC-WBC"}:
        return f"{4.0 + rng.random() * 7.0:.1f}"
    if code in {"718-7"}:
        return f"{12.0 + rng.random() * 4.5:.1f}"
    if code in {"2823-3", "FAC-K"}:
        return f"{3.5 + rng.random() * 1.5:.1f}"
    if code in {"2951-2", "FAC-NA"}:
        return f"{135 + rng.randint(0, 10)}"
    return f"{rng.randint(1, 100)}"


def _build_obx_rows(
    *, n: int, local_share: float, ts: str, rng: random.Random
) -> tuple[_ObxSpec, ...]:
    rows: list[_ObxSpec] = []
    for i in range(1, n + 1):
        is_local = rng.random() < local_share
        if is_local:
            code, text, units = rng.choice(_LOCAL_CODES)
            coding_system = "L"
        else:
            code, text, units = rng.choice(_LOINC_CODES)
            coding_system = "LN"
        rows.append(
            _ObxSpec(
                set_id=i,
                value_type="NM",
                code=code,
                text=text,
                coding_system=coding_system,
                value=_value_for(code, rng),
                units=units,
                abnormal="N",
                obs_ts=ts,
            )
        )
    return tuple(rows)


def _format_msg(spec: _MsgSpec) -> str:
    msh = (
        "MSH|^~\\&|LIS|"
        f"{spec.facility}|EHR|{spec.facility}|{spec.msg_ts}||"
        f"ORU^{spec.trigger}|{spec.message_control_id}|P|2.5"
    )
    pid = f"PID|||{spec.patient_id}"
    pv1 = (
        f"PV1||O|||||||||||||||||{spec.encounter_id}"
        if spec.trigger != "R01" or spec.encounter_id
        else ""
    )
    orc = f"ORC|RE|ORD-{spec.seed_idx:05d}"
    obr = f"OBR|1|ORD-{spec.seed_idx:05d}||PANEL^Lab Panel^L|||{spec.msg_ts}"
    obx_lines = [
        (
            f"OBX|{r.set_id}|{r.value_type}|{r.code}^{r.text}^{r.coding_system}||"
            f"{r.value}|{r.units}||{r.abnormal}|||F|||{r.obs_ts}"
        )
        for r in spec.obx_rows
    ]

    parts = [msh, pid]
    if pv1:
        parts.append(pv1)
    parts.extend([orc, obr])
    parts.extend(obx_lines)
    return "\r".join(parts) + "\r"


def build_corpus(*, seed: int = 42, n_messages: int = 50) -> str:
    """Build a deterministic ORU corpus.

    Splits across plan-driven cohorts:

    - First 30 messages: 100% LOINC-coded OBX (mapper-happy path).
    - Last 20 messages: ~50% local-coded OBX (queue-populated path).
    """
    if n_messages < 1:
        raise ValueError(f"n_messages must be >= 1; got {n_messages}")

    rng = random.Random(seed)
    specs: list[_MsgSpec] = []
    for i in range(1, n_messages + 1):
        # First 60% LOINC-only; last 40% mixes 50% local codes.
        local_share = 0.0 if i <= int(n_messages * 0.6) else 0.5
        n_obx = rng.randint(1, 3)
        # Deterministic timestamps: HH walks 08..11 and MM walks 0..55 across
        # the corpus so every message gets a unique YYYYMMDDHHMMSS string.
        hour = 8 + (i % 4)
        minute = (i * 5) % 60
        msg_ts = f"20240601{hour:02d}{minute:02d}00"
        obs_ts = msg_ts
        # R01/R30/R31 are deterministic via index modulo
        trigger = _TRIGGERS[i % len(_TRIGGERS)]
        facility = _FACILITIES[i % len(_FACILITIES)]
        # R30/R31 require encounter; R01 may or may not. Always populate to
        # keep the fixture stable across reader-side checks.
        encounter_id = f"ENC{i:05d}"
        specs.append(
            _MsgSpec(
                seed_idx=i,
                trigger=trigger,
                message_control_id=f"MSG{i:05d}",
                patient_id=f"PAT{i:05d}",
                encounter_id=encounter_id,
                facility=facility,
                msg_ts=msg_ts,
                obx_rows=_build_obx_rows(n=n_obx, local_share=local_share, ts=obs_ts, rng=rng),
            )
        )

    return "".join(_format_msg(s) for s in specs)


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    print(build_corpus(seed=42, n_messages=50))
