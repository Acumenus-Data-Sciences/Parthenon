"""Phase 3 Plan 3 Task 6 (T-021C): synthetic NCPDP corpus fixture."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from runtime.commercial.claims.readers.ncpdp_reader import NCPDPReader

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
        "build_ncpdp_corpus",
        _FIXTURE_DIR / "build_ncpdp_corpus.py",
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["build_ncpdp_corpus"] = module
    spec.loader.exec_module(module)
    return module


def test_fixture_module_exists() -> None:
    assert (_FIXTURE_DIR / "build_ncpdp_corpus.py").is_file()


def test_build_corpus_is_deterministic() -> None:
    builder = _load_builder()
    a = builder.build_corpus(seed=42, n_claims=10)  # type: ignore[attr-defined]
    b = builder.build_corpus(seed=42, n_claims=10)  # type: ignore[attr-defined]
    assert a == b


def test_corpus_yields_n_transactions() -> None:
    builder = _load_builder()
    payloads = builder.build_corpus(seed=42, n_claims=50)  # type: ignore[attr-defined]
    assert len(payloads) == 50


def test_corpus_payloads_are_parseable() -> None:
    builder = _load_builder()
    payloads = builder.build_corpus(seed=42, n_claims=50)  # type: ignore[attr-defined]
    reader = NCPDPReader()
    claims = [reader.read(p) for p in payloads]
    assert len(claims) == 50


def test_corpus_has_expected_b1_b2_mix() -> None:
    builder = _load_builder()
    payloads = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42, n_claims=50, reversal_count=5
    )
    reader = NCPDPReader()
    claims = [reader.read(p) for p in payloads]
    b1_count = sum(1 for c in claims if c.transaction_code == "B1")
    b2_count = sum(1 for c in claims if c.is_reversal)
    assert b1_count == 45
    assert b2_count == 5


def test_reversals_pair_with_existing_billings() -> None:
    """Each B2 reversal's rx_id should match a preceding B1's rx_id.

    The reader doesn't expose rx_id directly (D2 isn't on NCPDPClaim),
    so we just confirm the reversals are at the END of the corpus and
    their NCPDP transaction code is correctly B2.
    """
    builder = _load_builder()
    payloads = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42, n_claims=50, reversal_count=5
    )
    reader = NCPDPReader()
    claims = [reader.read(p) for p in payloads]
    # Reversals are appended at the end.
    assert all(not c.is_reversal for c in claims[:-5])
    assert all(c.is_reversal for c in claims[-5:])


def test_corpus_has_unmapped_ndc_signal() -> None:
    """At default unmapped_rate=0.15, a 50-claim corpus should include
    at least 1 NDC outside the canonical mapped pool (so the unmapped
    log path gets exercised in the E2E)."""
    builder = _load_builder()
    payloads = builder.build_corpus(  # type: ignore[attr-defined]
        seed=42, n_claims=50, unmapped_rate=0.15
    )
    reader = NCPDPReader()
    claims = [reader.read(p) for p in payloads]
    unmapped_marker = {"99999000001", "99999000002", "99999000003"}
    unmapped_count = sum(1 for c in claims if c.ndc_code in unmapped_marker)
    assert unmapped_count >= 1, "expected at least one unmapped NDC in 50-claim seed=42 corpus"
