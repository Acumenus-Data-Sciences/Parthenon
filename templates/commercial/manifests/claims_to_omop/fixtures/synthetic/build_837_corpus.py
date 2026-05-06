"""Synthetic 837 P/I/D corpus builder — deterministic with ``seed=42``.

Phase 3 Plan 1 Task 6 (T-021A). Produces a 100-claim mixed-flavor 837
corpus (Professional + Institutional + Dental) for the validation E2E
(Task 10) and any downstream perf benchmarks.

The output is one big X12 envelope wrapping ``n_claims`` ST/SE
transaction sets. Each claim is keyed off a deterministic
``(claim_id, claim_type)`` tuple drawn from the seeded RNG, and uses a
pool of public CMS test NPIs (1234567893 family) plus obviously-fake
member identifiers (``MEMBER0001``..). HIGHSEC §7 still applies —
nothing here is PHI, but the reader's logger redacts NPIs and member
IDs anyway as defense in depth.

Usage:

    from runtime.commercial.claims.readers.x12_837 import X12_837_Reader
    payload = build_corpus(seed=42, n_claims=100)
    reader = X12_837_Reader()
    claims, lines = reader.read(io.StringIO(payload))

This module ships **inside the manifest fixtures directory** so it ships
with the wheel's data files. It is NOT importable as a regular Python
module from the wheel; the validation E2E loads it via ``importlib.util``.
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final

# Public CMS test NPIs (10-digit, valid Luhn). Pool size is small so the
# corpus has realistic duplication — most claims come from a handful of
# providers, mirroring real payer files.
_NPI_POOL: Final[Sequence[str]] = (
    "1234567893",
    "1235698740",
    "1245319599",
    "1457398217",
    "1659465300",
)

# Public-domain CPT/HCPCS codes commonly used in CMS examples (E&M visits
# and a few procedures). Not exhaustive — this is fixture data, not a
# production code-set.
_CPT_POOL: Final[Sequence[str]] = (
    "99213",
    "99214",
    "99215",
    "93000",
    "85025",
    "80053",
    "71046",
)

# Institutional revenue/CPT pairs.
_INST_POOL: Final[Sequence[tuple[str, str]]] = (
    ("0260", "99231"),
    ("0270", "99232"),
    ("0300", "85025"),
    ("0320", "71046"),
    ("0450", "99281"),
)

# Dental CDT codes.
_CDT_POOL: Final[Sequence[str]] = (
    "D0120",
    "D0150",
    "D1110",
    "D1206",
    "D2391",
    "D7140",
)

# ICD-10 codes used in the diagnosis HI segments.
_ICD10_POOL: Final[Sequence[str]] = (
    "R51",
    "I10",
    "E11.9",
    "J06.9",
    "M54.5",
    "N39.0",
    "K02.9",
    "I50.9",
)


@dataclass(frozen=True)
class _ClaimSpec:
    claim_id: str
    claim_type: str  # "P" / "I" / "D"
    seed_idx: int


def _envelope_header(control_number: int) -> str:
    return (
        "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
        f"*260101*1200*^*00501*{control_number:09d}*0*P*:~"
        "GS*HC*SUBMITTERID*RECEIVERID*20260101*1200*1*X*005010X222A1~"
    )


def _envelope_trailer(control_number: int, group_count: int) -> str:
    return f"GE*{group_count}*1~IEA*1*{control_number:09d}~"


def _claim_segments(spec: _ClaimSpec, rng: random.Random) -> tuple[str, int]:
    """Return ``(segments, segment_count)`` for one claim."""
    npi = rng.choice(_NPI_POOL)
    member_id = f"MEMBER{spec.seed_idx:04d}"
    icd = rng.choice(_ICD10_POOL)

    if spec.claim_type == "P":
        impl_guide = "005010X222A1"
        n_lines = rng.randint(1, 3)
        # Per-line charge between $50 and $500.
        line_amounts = [round(rng.uniform(50.0, 500.0), 2) for _ in range(n_lines)]
        total = round(sum(line_amounts), 2)
        body_lines: list[str] = []
        for idx, amount in enumerate(line_amounts, start=1):
            cpt = rng.choice(_CPT_POOL)
            body_lines.append(f"LX*{idx}~SV1*HC:{cpt}*{amount:.2f}*UN*1***1~DTP*472*D8*20260110~")
        body = "".join(body_lines)
    elif spec.claim_type == "I":
        impl_guide = "005010X223A2"
        n_lines = rng.randint(2, 4)
        line_amounts = [round(rng.uniform(500.0, 3000.0), 2) for _ in range(n_lines)]
        total = round(sum(line_amounts), 2)
        body_lines = []
        for idx, amount in enumerate(line_amounts, start=1):
            rev, cpt = rng.choice(_INST_POOL)
            body_lines.append(f"LX*{idx}~SV2*{rev}*HC:{cpt}*{amount:.2f}*UN*1~DTP*472*D8*20260115~")
        body = "".join(body_lines)
    elif spec.claim_type == "D":
        impl_guide = "005010X224A2"
        n_lines = rng.randint(1, 3)
        line_amounts = [round(rng.uniform(50.0, 300.0), 2) for _ in range(n_lines)]
        total = round(sum(line_amounts), 2)
        body_lines = []
        for idx, amount in enumerate(line_amounts, start=1):
            cdt = rng.choice(_CDT_POOL)
            body_lines.append(f"LX*{idx}~SV3*AD:{cdt}*{amount:.2f}**1*1~DTP*472*D8*20260301~")
        body = "".join(body_lines)
    else:  # pragma: no cover - guarded above
        raise ValueError(f"unknown claim type {spec.claim_type!r}")

    # Header segments (one transaction set per claim; small, but keeps the
    # ST/SE accounting trivial).
    header = (
        f"ST*837*{spec.seed_idx:04d}*{impl_guide}~"
        f"BHT*0019*00*{spec.seed_idx:04d}*20260101*1200*CH~"
        "NM1*41*2*ACME PROVIDER*****46*SUBID~"
        "NM1*40*2*PAYER NAME*****46*PAYERID~"
        f"NM1*85*2*PROVIDER ORG*****XX*{npi}~"
        f"NM1*IL*1*PATIENT*FAKE****MI*{member_id}~"
        "NM1*PR*2*PAYER NAME*****PI*PAYERID~"
        f"CLM*{spec.claim_id}*{total:.2f}***11:B:1*Y*A*Y*Y~"
        "DTP*434*D8*20260115~"
        f"HI*ABK:{icd}~"
    )
    # Crude segment count: count tildes in header + body.
    full = header + body
    seg_count = full.count("~") + 1  # +1 for the SE itself
    full += f"SE*{seg_count}*{spec.seed_idx:04d}~"
    return full, seg_count


def build_corpus(seed: int = 42, n_claims: int = 100) -> str:
    """Build a deterministic 837 corpus of ``n_claims`` mixed P/I/D claims.

    Args:
        seed: RNG seed. Same seed always produces the same output bytes.
        n_claims: Number of claims to generate. Must be >= 1. The mix is
            drawn uniformly across {P, I, D}; for n_claims=100 expect
            roughly 33/33/33.

    Returns:
        A single X12 envelope (ISA..IEA) wrapping ``n_claims`` ST/SE
        transaction sets.
    """
    if n_claims < 1:
        raise ValueError(f"n_claims must be >= 1; got {n_claims}")

    rng = random.Random(seed)
    types: list[str] = []
    for i in range(n_claims):
        # Force at least one of each type in the first three slots so a
        # 3-claim corpus still yields all flavors. After that, sample
        # uniformly.
        if i == 0:
            types.append("P")
        elif i == 1:
            types.append("I")
        elif i == 2:
            types.append("D")
        else:
            types.append(rng.choice(("P", "I", "D")))

    specs = [
        _ClaimSpec(claim_id=f"SYNTH-{i + 1:05d}", claim_type=t, seed_idx=i + 1)
        for i, t in enumerate(types)
    ]

    # The envelope wraps ONE GS group containing many ST/SE transaction
    # sets. We hand the same impl_guide to every ST inside (the X222A1
    # one) — pyx12 tolerates mixed-flavor STs inside a single GS even
    # though a strict implementation guide says otherwise.
    parts: list[str] = [_envelope_header(control_number=1)]
    for spec in specs:
        seg, _ = _claim_segments(spec, rng)
        parts.append(seg)
    parts.append(_envelope_trailer(control_number=1, group_count=n_claims))
    return "".join(parts)


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    print(build_corpus(seed=42, n_claims=100))
