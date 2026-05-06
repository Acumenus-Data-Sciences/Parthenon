"""Phase 3 Plan 2 Task 5 (T-021B): synthetic 835 corpus fixture.

Tests the fixture builder produces a deterministic, parseable 835 with
the expected match/orphan/reversal mix.
"""

from __future__ import annotations

import importlib.util
import io
import sys
from decimal import Decimal
from pathlib import Path

from runtime.commercial.claims.readers.x12_835 import X12_835_Reader

_FIXTURE_DIR = (
    Path(__file__).resolve().parents[3]
    / "commercial"
    / "manifests"
    / "claims_to_omop"
    / "fixtures"
    / "synthetic"
)


def _load_builder() -> object:
    spec = importlib.util.spec_from_file_location(
        "build_835_corpus",
        _FIXTURE_DIR / "build_835_corpus.py",
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Register before exec so dataclass.__init__ can resolve __module__
    # via sys.modules during class creation.
    sys.modules["build_835_corpus"] = module
    spec.loader.exec_module(module)
    return module


def test_fixture_module_exists() -> None:
    assert (_FIXTURE_DIR / "build_835_corpus.py").is_file()


def test_build_corpus_is_deterministic() -> None:
    builder = _load_builder()
    a = builder.build_corpus(seed=42, n_claims=20)  # type: ignore[attr-defined]
    b = builder.build_corpus(seed=42, n_claims=20)  # type: ignore[attr-defined]
    assert a == b


def test_corpus_has_match_orphan_reversal_mix() -> None:
    builder = _load_builder()
    payload: str = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42,
        n_claims=100,
        n_orphans=5,
        reversal_rate=0.10,
    )
    items = X12_835_Reader().read(io.StringIO(payload))

    # 100 - 5 orphan = 95 matched + 5 ghost = 100 total CLPs.
    assert len(items) == 100

    # Count flavors.
    ghosts = [i for i in items if i.claim_id.startswith("GHOST-")]
    matched = [i for i in items if i.claim_id.startswith("SYNTH-")]
    reversals = [i for i in items if i.is_reversal]

    assert len(ghosts) == 5
    assert len(matched) == 95
    # ~10% reversal rate over 95 matched. Allow a 6-15 window for RNG
    # noise (the rate test is informative, not strict).
    assert 6 <= len(reversals) <= 15


def test_corpus_yields_signed_decimals_for_reversals() -> None:
    builder = _load_builder()
    payload: str = builder.build_corpus(seed=42, n_claims=100)  # type: ignore[attr-defined]
    items = X12_835_Reader().read(io.StringIO(payload))
    reversals = [i for i in items if i.is_reversal]
    assert reversals, "expected at least one reversal in seed=42 / n_claims=100"
    for r in reversals:
        assert r.paid_amount < Decimal(0)


def test_corpus_validates_against_reconciler() -> None:
    """The reconciler must produce the documented mix when fed the fixture."""
    from runtime.commercial.claims.remit_reconciler import RemitReconciler

    builder = _load_builder()
    payload: str = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42,
        n_claims=100,
        n_orphans=5,
        reversal_rate=0.10,
    )
    items = X12_835_Reader().read(io.StringIO(payload))

    # Existing keys = the SYNTH-* claim_ids only (the orphans have GHOST-*).
    matched_ids = {i.claim_id for i in items if i.claim_id.startswith("SYNTH-")}
    existing = {("PAYER001", cid, 1) for cid in matched_ids}

    plan = RemitReconciler().reconcile(items, existing)

    # Every ghost is an orphan; every reversal is a compensation;
    # everything else is an update.
    assert len(plan.orphans) == 5
    assert len(plan.compensations) == sum(1 for i in items if i.is_reversal)
    assert len(plan.updates) == 95 - len(plan.compensations)
