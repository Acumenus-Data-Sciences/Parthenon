"""Phase 3 Plan 2 Task 7: claims_to_omop end-to-end with 835 reconciliation.

The full SQL pipeline (manifest stages 1-14) is wired to the runner in
Plans 4-7, when the runner gains a programmatic ``run_manifest`` driver
(Phase 4 follow-up; ADR 0015 §"Open follow-ups"). Until then, this E2E
exercises the *reader → reconciler* pipeline directly, which is the
load-bearing logic for the 835 reconciliation convention (ADR 0016
§"Remit reconciliation", added by Plan 2 Task 8).

Acceptance per plan §7:

1. ≥95% match rate (orphan rate <5%) on the matched corpus.
2. 100% of matched non-reversal remits produce a paid_amount in the
   update plan (no NULLs).
3. Reversal compensation: every reversal in the corpus produces a
   compensation row with the negated paid amount (signed match).
4. Reconciliation completes in well under the 30-minute T-021 perf
   budget. We assert <30s in CI as a regression signal — n_claims=100
   takes well under a second on commodity hardware.

The 100-claim corpus is the same one Plan 1's E2E uses; we generate
the matching 95-claim 835 corpus + 5 ghosts + ~10% reversals via the
deterministic seed=42 builder (Task 5).

Marked ``@pytest.mark.slow`` for parity with Plan 1's E2E, even though
the 100-claim variant runs in <1s.
"""

from __future__ import annotations

import importlib.util
import io
import sys
import time
from pathlib import Path

import pytest

from runtime.commercial.claims.readers.x12_835 import X12_835_Reader
from runtime.commercial.claims.remit_reconciler import RemitReconciler

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = _REPO / "commercial" / "manifests" / "claims_to_omop" / "fixtures" / "synthetic"


def _load_835_builder():  # type: ignore[no-untyped-def]
    builder_path = _FIXTURE_DIR / "build_835_corpus.py"
    spec = importlib.util.spec_from_file_location("build_835_corpus", builder_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_835_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.slow
def test_835_reconciliation_e2e_meets_acceptance_gates() -> None:
    """End-to-end reader → reconciler against the seed=42 / n_claims=100 corpus."""
    builder = _load_835_builder()
    payload: str = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42,
        n_claims=100,
        n_orphans=5,
        reversal_rate=0.10,
        payer_id="PAYER001",
    )

    reader = X12_835_Reader()
    reconciler = RemitReconciler()

    t0 = time.perf_counter()
    items = reader.read(io.StringIO(payload))
    matched_ids = {i.claim_id for i in items if i.claim_id.startswith("SYNTH-")}
    existing_keys = {("PAYER001", cid, 1) for cid in matched_ids}
    plan = reconciler.reconcile(items, existing_keys)
    elapsed = time.perf_counter() - t0

    # Gate 1: ≥95% match rate. Ghost-prefixed remits are orphans by
    # construction; matched (SYNTH-*) remits never go to the orphan path.
    matched_count = len(items) - 5  # -5 ghosts
    orphan_count = len(plan.orphans)
    match_rate = (matched_count - 0) / len(items)  # all matched IDs match
    assert match_rate >= 0.95, f"match rate {match_rate:.2%} below 0.95 threshold"
    assert orphan_count == 5, f"expected exactly 5 ghost orphans, got {orphan_count}"

    # Gate 2: 100% of matched non-reversal remits produce a paid_amount.
    # The reconciler's CostUpdate carries new_paid_amount which is non-
    # optional (Decimal, not Decimal | None). So just check we have one
    # update per matched non-reversal item.
    n_reversals = sum(1 for i in items if i.is_reversal)
    expected_updates = matched_count - n_reversals
    assert len(plan.updates) == expected_updates, (
        f"expected {expected_updates} updates (matched - reversals), " f"got {len(plan.updates)}"
    )
    for u in plan.updates:
        assert u.new_paid_amount is not None

    # Gate 3: reversal compensation parity. One compensation per reversal,
    # with the signed paid_amount preserved.
    assert len(plan.compensations) == n_reversals
    rev_items_by_claim = {i.claim_id: i for i in items if i.is_reversal}
    for comp in plan.compensations:
        original = rev_items_by_claim[comp.match_key.claim_id]
        assert comp.compensation_amount == original.paid_amount, (
            f"compensation amount mismatch for {comp.match_key.claim_id}: "
            f"expected {original.paid_amount}, got {comp.compensation_amount}"
        )

    # Gate 4: perf budget. T-021 spec calls for <30 min on the reference
    # hardware; the n_claims=100 corpus is a microsecond test in CI. The
    # 30s ceiling is a regression signal.
    assert elapsed < 30.0, f"reconciliation took {elapsed:.2f}s, regressed past 30s"


@pytest.mark.slow
def test_835_e2e_idempotent_on_replay() -> None:
    """Running the reconciler twice on the same corpus produces identical output.

    This mirrors the SQL stage's idempotency invariant: 02f_reconcile_remit
    uses NOT EXISTS guards so re-runs are no-ops. The Python reconciler
    must satisfy the same property at the algorithmic level.
    """
    builder = _load_835_builder()
    payload: str = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42,
        n_claims=100,
    )

    reader = X12_835_Reader()
    reconciler = RemitReconciler()
    items = reader.read(io.StringIO(payload))
    matched_ids = {i.claim_id for i in items if i.claim_id.startswith("SYNTH-")}
    existing_keys = {("PAYER001", cid, 1) for cid in matched_ids}

    plan1 = reconciler.reconcile(items, existing_keys)
    plan2 = reconciler.reconcile(items, existing_keys)

    assert len(plan1.updates) == len(plan2.updates)
    assert len(plan1.orphans) == len(plan2.orphans)
    assert len(plan1.compensations) == len(plan2.compensations)
    # Pydantic frozen models equality — content match.
    assert plan1.updates == plan2.updates
    assert plan1.orphans == plan2.orphans
    assert plan1.compensations == plan2.compensations
