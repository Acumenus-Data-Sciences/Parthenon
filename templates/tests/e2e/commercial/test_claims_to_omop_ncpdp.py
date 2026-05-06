"""Phase 3 Plan 3 Task 8 (T-021C): claims_to_omop NCPDP pharmacy E2E.

In-process reader pipeline against the seed=42 / n_claims=50 corpus.
Same pattern as Plans 1 and 2's E2Es — the full SQL pipeline is wired
to the runner once the programmatic ``run_manifest`` driver lands
(Phase 4 follow-up; ADR 0015 §"Open follow-ups").

Acceptance per plan §8:

1. 100% of B1 transactions parse + materialize a non-NULL
   ``ndc_code`` and DRUG_EXPOSURE-shaped fields.
2. B2 reversals net to 0 quantity for the reversed rx_id (when
   summed with their paired B1).
3. Throughput: the parse + reader path completes in well under
   the 30-min T-021 perf budget. CI assertion: <30s for n_claims=50.

NDC mapping success-rate (90% expected; 15% unmapped configured) is
asserted at the SQL layer in the manifest test, not here — the E2E
focuses on the reader → DRUG_EXPOSURE shape contract.
"""

from __future__ import annotations

import importlib.util
import sys
import time
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pytest

from runtime.commercial.claims.readers.ncpdp_reader import NCPDPReader

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = _REPO / "commercial" / "manifests" / "claims_to_omop" / "fixtures" / "synthetic"


def _load_ncpdp_builder():  # type: ignore[no-untyped-def]
    builder_path = _FIXTURE_DIR / "build_ncpdp_corpus.py"
    spec = importlib.util.spec_from_file_location("build_ncpdp_corpus", builder_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_ncpdp_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.slow
def test_ncpdp_e2e_meets_acceptance_gates() -> None:
    """End-to-end reader pipeline against the seed=42 / n_claims=50 corpus."""
    builder = _load_ncpdp_builder()
    payloads: list[str] = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42,
        n_claims=50,
        reversal_count=5,
        unmapped_rate=0.15,
    )

    reader = NCPDPReader()

    t0 = time.perf_counter()
    claims = [reader.read(p) for p in payloads]
    elapsed = time.perf_counter() - t0

    # Gate 1: every B1 produces a parseable claim with required fields.
    b1_claims = [c for c in claims if c.transaction_code == "B1"]
    assert len(b1_claims) == 45
    for c in b1_claims:
        assert c.ndc_code, "B1 claim missing ndc_code"
        assert len(c.ndc_code) == 11
        assert c.days_supply >= 0
        assert c.quantity_dispensed >= 0
        assert c.is_reversal is False

    # Gate 2: reversals net to zero quantity per reversed claim group.
    # Group by (cardholder_id, ndc_code, date_of_service); B1 + matching
    # B2 should net to zero (the fixture pairs are exact-mirror by design).
    reversal_keys: dict[tuple[str, str, str], Decimal] = defaultdict(lambda: Decimal(0))
    for c in claims:
        key = (c.cardholder_id, c.ndc_code, c.date_of_service.isoformat())
        sign = -1 if c.is_reversal else 1
        reversal_keys[key] += Decimal(sign) * c.quantity_dispensed

    reversal_count = sum(1 for c in claims if c.is_reversal)
    assert reversal_count == 5

    # The 5 B2 reversals each pair with their B1 — those 5 keys should
    # net to 0; the other 40 unique-fill keys remain positive.
    zero_net_keys = sum(1 for v in reversal_keys.values() if v == Decimal(0))
    positive_keys = sum(1 for v in reversal_keys.values() if v > Decimal(0))
    assert zero_net_keys == 5
    assert positive_keys >= 40

    # Gate 3: perf budget. T-021 spec is <30 min on the reference box;
    # n_claims=50 takes microseconds in CI. The 30s ceiling is a
    # regression signal.
    assert elapsed < 30.0, f"NCPDP E2E took {elapsed:.2f}s, regressed past 30s"


@pytest.mark.slow
def test_ncpdp_e2e_idempotent_on_replay() -> None:
    """Reader must produce identical NCPDPClaim objects on re-runs."""
    builder = _load_ncpdp_builder()
    payloads: list[str] = builder.build_corpus(seed=42, n_claims=50)  # type: ignore[attr-defined]

    reader = NCPDPReader()
    a = [reader.read(p) for p in payloads]
    b = [reader.read(p) for p in payloads]

    assert len(a) == len(b)
    # Pydantic frozen models compare equal when fields match.
    assert a == b
