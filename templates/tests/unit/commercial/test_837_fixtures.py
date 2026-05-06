"""Phase 3 Plan 1 Task 6: synthetic 837 corpus fixtures.

Verifies the three CMS-style example transactions parse cleanly and the
``build_837_corpus`` deterministic generator (seed=42) produces a 100-
claim corpus that the X12_837_Reader can ingest end-to-end with no
parse errors.

CMS publishes example 837 transactions for testing — public domain, no
PHI. We adopt the segment shapes (NPIs are public test values like
``1234567893``); subscriber/member IDs are obviously fake (``MEMBER01``).
HIGHSEC §7 still applies — the reader's PHI guard (Task 11) redacts these
identifiers from log output.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from runtime.commercial.claims.readers.x12_837 import X12_837_Reader

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = _REPO / "commercial" / "manifests" / "claims_to_omop" / "fixtures" / "synthetic"


def _load_builder():  # type: ignore[no-untyped-def]
    import sys

    builder_path = _FIXTURE_DIR / "build_837_corpus.py"
    spec = importlib.util.spec_from_file_location("build_837_corpus", builder_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_837_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.parametrize(
    "filename",
    [
        "cms_837p_example.txt",
        "cms_837i_example.txt",
        "cms_837d_example.txt",
    ],
)
def test_cms_example_parses(filename: str) -> None:
    payload = (_FIXTURE_DIR / filename).read_text()
    reader = X12_837_Reader()
    import io as _io

    claims, lines = reader.read(_io.StringIO(payload))
    assert len(claims) >= 1, f"{filename} produced no claims"
    assert all(line.charged_amount >= 0 for line in lines)
    # Claim type is inferred from SV* segments — each example file should
    # match its filename's flavor.
    expected = {"p": "P", "i": "I", "d": "D"}[filename.split("_")[1][3]]
    assert all(c.claim_type == expected for c in claims)


def test_corpus_builder_is_deterministic() -> None:
    builder = _load_builder()
    a = builder.build_corpus(seed=42, n_claims=10)
    b = builder.build_corpus(seed=42, n_claims=10)
    assert a == b


def test_corpus_builder_yields_100_mixed_claims() -> None:
    builder = _load_builder()
    payload = builder.build_corpus(seed=42, n_claims=100)
    reader = X12_837_Reader()
    import io as _io

    claims, lines = reader.read(_io.StringIO(payload))
    assert len(claims) == 100
    types = {c.claim_type for c in claims}
    # Mix should include all three flavors (P/I/D) in a 100-claim corpus.
    assert types == {"P", "I", "D"}
    # Every line should belong to a known claim.
    claim_ids = {c.claim_id for c in claims}
    for line in lines:
        assert line.claim_id in claim_ids
