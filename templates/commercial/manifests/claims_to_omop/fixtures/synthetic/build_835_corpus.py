"""Synthetic 835 corpus builder — deterministic with ``seed=42``.

Phase 3 Plan 2 Task 5 (T-021B). Produces an 835 (electronic remittance
advice) corpus matched to Plan 1's 837 corpus (``build_837_corpus.py``).
Used by the validation E2E in Task 7 to exercise the
``RemitReconciler`` against a full match/orphan/reversal mix.

Mix (deterministic):

- For ``n_claims=100`` 837s, generate 95 matching 835 remits keyed off
  the same ``SYNTH-{i:05d}`` claim_ids — so 5 of the 837 claims have
  no remit (claim-orphan case: claims received but never reconciled).
- Add 5 extra remits with ``GHOST-{i:05d}`` claim_ids that don't
  appear in the 837 corpus — remit-orphan case: remits arrived for
  claims we never loaded.
- Of the 95 matching remits, mark ~10% (10) as reversals (CLP02 = 22)
  with negated ``paid_amount``. Reversals stay matched to their
  upstream claim — Task 4 emits compensating COST rows for them.

So a fully-loaded run produces:
- 85 matched, non-reversal updates
- 10 matched reversals → compensations
- 5 unmatched (ghost) remits → orphan log entries
- 5 837 claims with no 835 → claim-orphan (caller's concern, not the
  reconciler's — every claim row sits with paid/allowed = NULL after
  Plan 1, and the reconciler simply doesn't UPDATE them)

Usage:

    from runtime.commercial.claims.readers.x12_835 import X12_835_Reader
    payload = build_corpus(seed=42, n_claims=100)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(payload))

This module ships INSIDE the manifest fixtures directory so the wheel
carries it as data. The validation E2E loads it via ``importlib.util``.
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Final

# Public CMS test payer IDs / payee NPIs. Same pool as the 837 builder
# uses for providers — the 835's payee is the provider that submitted
# the corresponding 837. The N1*PR payer name is intentionally generic.
_PAYER_NAMES: Final[Sequence[str]] = (
    "BIG INSURANCE",
    "ATLAS HEALTH",
    "VANGUARD MUTUAL",
)
_PAYEE_NPI_POOL: Final[Sequence[str]] = (
    "1234567893",
    "1235698740",
    "1245319599",
    "1457398217",
    "1659465300",
)

# Procedure codes mirror the 837 builder's pool. The reconciler matches
# on (payer_id, claim_id, line_number); procedure_code is informational.
_CPT_POOL: Final[Sequence[str]] = (
    "99213",
    "99214",
    "99215",
    "93000",
    "85025",
    "80053",
    "71046",
)


_SEG = "~"


@dataclass(frozen=True)
class _RemitSpec:
    """Drives one CLP/SVC loop in the generated 835."""

    claim_id: str
    payer_id: str
    is_reversal: bool
    is_orphan: bool  # claim_id NOT in the matched 837 corpus
    seed_idx: int


def _envelope_header(control_number: int = 1) -> str:
    isa = (
        "ISA*00*          *00*          *ZZ*PAYER          *ZZ*RECEIVERID     "
        "*240115*1200*^*00501*"
        f"{control_number:09d}"
        "*0*P*:"
    )
    gs = f"GS*HP*PAYER*RECEIVERID*20240115*1200*{control_number}*X*005010X221A1"
    st = f"ST*835*{control_number:04d}"
    return _SEG.join([isa, gs, st]) + _SEG


def _envelope_trailer(control_number: int, segment_count: int) -> str:
    se = f"SE*{segment_count}*{control_number:04d}"
    ge = f"GE*1*{control_number}"
    iea = f"IEA*1*{control_number:09d}"
    return _SEG.join([se, ge, iea]) + _SEG


def _payment_header(rng: random.Random, payer_id: str) -> tuple[str, list[str]]:
    """Top-of-envelope BPR/TRN/DTM/N1 segments, returned as (joined, list).

    The N1*PR carries the payer org name (informational) AND an XV-qualified
    ID in N104 — that's what the reader keys on for ``payer_id``. So both
    the 837 corpus and 835 corpus reconcile against the same stable
    identifier (``PAYER001`` by default).
    """
    payer = rng.choice(_PAYER_NAMES)
    payee_npi = rng.choice(_PAYEE_NPI_POOL)
    segs = [
        # BPR — payment info. Total payment is informational; we don't
        # cross-foot it against the sum of CLP04s in this fixture.
        "BPR*I*15000*C*ACH*CCP*01*123456780*DA*9876543210*1234567890**01"
        "*123456780*DA*9876543210*20240115",
        "TRN*1*0123456789*1234567890",
        "DTM*405*20240115",
        f"N1*PR*{payer}*XV*{payer_id}",
        f"N1*PE*PROVIDER GROUP*XX*{payee_npi}",
    ]
    return _SEG.join(segs) + _SEG, segs


def _clp_loop(spec: _RemitSpec, rng: random.Random) -> tuple[str, int]:
    """Build one CLP loop. Returns (segments, segment_count)."""
    cpt = rng.choice(_CPT_POOL)
    charged = Decimal(rng.randint(50, 500))
    if spec.is_reversal:
        # Reversal — paid_amount is the negation of what was previously
        # paid; CLP02 = 22.
        paid = -Decimal(rng.randint(20, int(charged - 5)))
        status = "22"
    else:
        # Normal — payer pays some fraction of charged.
        paid_pct = Decimal(rng.randint(60, 95)) / Decimal(100)
        paid = (charged * paid_pct).quantize(Decimal("0.01"))
        status = "1"
    allowed = (charged * Decimal("0.9")).quantize(Decimal("0.01"))
    patient_resp = (charged - paid - allowed + charged).max(Decimal(0))
    icn = f"ICN-{spec.seed_idx:06d}"
    segs = [
        f"CLP*{spec.claim_id}*{status}*{charged}*{paid}*{patient_resp}*MC*{icn}*11*1",
        f"SVC*HC:{cpt}*{charged}*{paid}**1",
        f"AMT*B6*{allowed}",
        "DTM*472*20240110",
    ]
    return _SEG.join(segs) + _SEG, len(segs)


def build_corpus(
    *,
    seed: int = 42,
    n_claims: int = 100,
    n_orphans: int = 5,
    reversal_rate: float = 0.10,
    payer_id: str = "PAYER001",
) -> str:
    """Build a deterministic 835 corpus.

    Args:
        seed: RNG seed. Same seed → same output bytes.
        n_claims: Total number of 837 claims to mirror. The corpus
            generates ``n_claims - n_orphans`` matched remits for IDs
            ``SYNTH-{1:05d}``..``SYNTH-{n_claims-n_orphans:05d}`` and
            ``n_orphans`` extra remits with ``GHOST-`` prefixed IDs.
        n_orphans: How many ghost remits to add at the end.
        reversal_rate: Fraction of matched remits to mark as reversals.
            ``0.10`` over 95 matches → 9-10 reversals.

    Returns:
        A single X12 envelope wrapping all CLP loops in one ST/SE
        transaction set (835 supports many CLPs per transaction).
    """
    if n_claims < 1:
        raise ValueError(f"n_claims must be >= 1; got {n_claims}")
    if n_orphans < 0:
        raise ValueError(f"n_orphans must be >= 0; got {n_orphans}")
    if not 0 <= reversal_rate <= 1:
        raise ValueError(f"reversal_rate must be in [0,1]; got {reversal_rate}")

    rng = random.Random(seed)
    matched_count = max(0, n_claims - n_orphans)

    specs: list[_RemitSpec] = []
    for i in range(1, matched_count + 1):
        is_rev = rng.random() < reversal_rate
        specs.append(
            _RemitSpec(
                claim_id=f"SYNTH-{i:05d}",
                payer_id=payer_id,
                is_reversal=is_rev,
                is_orphan=False,
                seed_idx=i,
            )
        )
    for j in range(1, n_orphans + 1):
        specs.append(
            _RemitSpec(
                claim_id=f"GHOST-{j:05d}",
                payer_id=payer_id,
                is_reversal=False,
                is_orphan=True,
                seed_idx=matched_count + j,
            )
        )

    parts: list[str] = [_envelope_header(control_number=1)]
    header_text, header_segs = _payment_header(rng, payer_id)
    parts.append(header_text)
    segment_count = 1 + len(header_segs)  # ST + payment-header segs

    for spec in specs:
        clp_text, clp_segs = _clp_loop(spec, rng)
        parts.append(clp_text)
        segment_count += clp_segs

    segment_count += 1  # SE
    parts.append(_envelope_trailer(control_number=1, segment_count=segment_count))
    return "".join(parts)


__all__ = ["build_corpus"]


if __name__ == "__main__":  # pragma: no cover
    print(build_corpus(seed=42, n_claims=100))
