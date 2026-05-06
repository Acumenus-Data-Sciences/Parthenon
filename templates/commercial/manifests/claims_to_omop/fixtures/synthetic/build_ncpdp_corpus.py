"""Synthetic NCPDP D.0 corpus builder — deterministic with seed=42.

Phase 3 Plan 3 Task 6 (T-021C). Produces a 50-claim NCPDP D.0 corpus
for the validation E2E (Task 8). Mix:

- 45 B1 billings (90%) — normal pharmacy fills
- 5 B2 reversals (10%) — keyed to the first 5 SYNTH-RX-* prescriptions
- ~15% of B1 claims use an "off-vocabulary" NDC that won't map to a
  RxNorm concept — exercises the unmapped_ndc log path (Task 4 §4)

Each claim is a single NCPDP D.0 transaction (one ST, one CLP-style
flow). The corpus is a list of payloads, NOT a single envelope —
NCPDP transactions are typically batched at the application level
(via batch headers), not concatenated like X12.

Usage:

    from runtime.commercial.claims.readers.ncpdp_reader import NCPDPReader
    payloads = build_corpus(seed=42, n_claims=50)
    claims = [NCPDPReader().read(p) for p in payloads]
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final

from runtime.commercial.claims.readers.ncpdp_grammar import FS, RS

# A small pool of real NDC codes that map cleanly via concept_relationship.
# These are public CMS test NDCs (no PHI). The corpus uses them for B1/B3.
_MAPPED_NDCS: Final[Sequence[str]] = (
    "00378011305",  # metformin 500mg tablet
    "00074662303",  # atorvastatin 20mg tablet
    "00069520830",  # lisinopril 10mg tablet
    "00185014501",  # amlodipine 5mg tablet
    "00781535514",  # sertraline 50mg tablet
    "00378515101",  # omeprazole 20mg capsule
)

# A few "off-vocabulary" 11-digit codes that look like NDCs but won't map.
# Real production data has these — discontinued/recoded products, payer-
# specific custom codes. Including them lets the validation E2E exercise
# the unmapped_ndc log path.
_UNMAPPED_NDCS: Final[Sequence[str]] = (
    "99999000001",
    "99999000002",
    "99999000003",
)

# Public test NPIs (10-digit, valid Luhn). Same pool the 837 builder uses.
_NPI_POOL: Final[Sequence[str]] = (
    "1234567893",
    "1235698740",
    "1245319599",
    "1457398217",
    "1659465300",
)

_BIN_POOL: Final[Sequence[str]] = ("610001", "003585", "020107")


@dataclass(frozen=True)
class _ClaimSpec:
    rx_id: str
    transaction_code: str  # B1 / B2 / B3
    is_reversal: bool
    use_mapped_ndc: bool
    seed_idx: int


def _build_payload(spec: _ClaimSpec, rng: random.Random) -> str:
    bin_number = rng.choice(_BIN_POOL)
    npi = rng.choice(_NPI_POOL)
    ndc = rng.choice(_MAPPED_NDCS if spec.use_mapped_ndc else _UNMAPPED_NDCS)
    days_supply = rng.choice((30, 60, 90))
    quantity = (
        days_supply  # naive 1 unit/day for the fixture
    )
    ingredient_cost = round(rng.uniform(5.0, 250.0), 2)
    dispensing_fee = round(rng.uniform(0.5, 3.5), 2)
    patient_pay = round(rng.uniform(0.0, 25.0), 2)
    cardholder_id = f"MEMBER{spec.seed_idx:05d}"
    dob = f"{1940 + (spec.seed_idx % 70):04d}0101"  # spread DOBs across decades

    am01 = (
        f"AM01{FS}A1{bin_number}{FS}A3PCN001{FS}A4{spec.transaction_code}{FS}N2{npi}"
    )
    am03 = f"AM03{FS}C4{dob}{FS}CYJANE{FS}CXDOE"
    am04 = f"AM04{FS}C2{cardholder_id}{FS}CMPLAN0001"
    am07 = (
        f"AM07{FS}D2{spec.rx_id}{FS}D7{ndc}{FS}D3{days_supply}"
        f"{FS}D5{quantity:.1f}{FS}DJ1"
    )
    am11 = (
        f"AM11{FS}D9{ingredient_cost:.2f}{FS}DC{dispensing_fee:.2f}"
        f"{FS}F4{patient_pay:.2f}"
    )
    return RS.join([am01, am03, am04, am07, am11]) + RS


def build_corpus(
    *,
    seed: int = 42,
    n_claims: int = 50,
    reversal_count: int = 5,
    unmapped_rate: float = 0.15,
) -> list[str]:
    """Build a deterministic NCPDP D.0 corpus.

    Args:
        seed: RNG seed; same seed -> same output.
        n_claims: Total number of claims to generate. Must be >= 1.
        reversal_count: Number of B2 reversals at the END of the
            generated list. Each reversal mirrors a preceding B1's
            rx_id so the SQL stage's compensation logic can pair them.
        unmapped_rate: Fraction of B1/B3 claims that use an off-
            vocabulary NDC. ``0.15`` over 45 B1s -> ~7 unmapped.

    Returns:
        A list of NCPDP D.0 payload strings, one per transaction.
        The order is deterministic: B1 claims first (in seed order),
        then the reversal_count B2 reversals at the end.
    """
    if n_claims < 1:
        raise ValueError(f"n_claims must be >= 1; got {n_claims}")
    if reversal_count < 0 or reversal_count > n_claims:
        raise ValueError(f"reversal_count out of range: {reversal_count}")
    if not 0 <= unmapped_rate <= 1:
        raise ValueError(f"unmapped_rate must be in [0,1]; got {unmapped_rate}")

    rng = random.Random(seed)
    n_billings = n_claims - reversal_count
    specs: list[_ClaimSpec] = []

    for i in range(1, n_billings + 1):
        specs.append(
            _ClaimSpec(
                rx_id=f"SYNTH-RX-{i:05d}",
                transaction_code="B1",
                is_reversal=False,
                use_mapped_ndc=rng.random() >= unmapped_rate,
                seed_idx=i,
            )
        )

    for j in range(1, reversal_count + 1):
        # Reverse the first reversal_count billings — gives the SQL
        # stage easy match pairs for the compensation logic.
        target = specs[j - 1]
        specs.append(
            _ClaimSpec(
                rx_id=target.rx_id,
                transaction_code="B2",
                is_reversal=True,
                use_mapped_ndc=target.use_mapped_ndc,
                seed_idx=n_billings + j,
            )
        )

    return [_build_payload(spec, rng) for spec in specs]


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    payloads = build_corpus(seed=42, n_claims=50)
    print(f"Generated {len(payloads)} NCPDP transactions")
