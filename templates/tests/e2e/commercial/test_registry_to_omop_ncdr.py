"""Phase 3 Plan 4C Task 7 (T-022C): registry_to_omop_ncdr validation E2E."""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path

import pytest

from runtime.commercial.registry.ncdr.reader import NCDRReader

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = (
    _REPO / "commercial" / "manifests" / "registry_to_omop_ncdr" / "fixtures" / "synthetic"
)


def _load_builder():  # type: ignore[no-untyped-def]
    spec = importlib.util.spec_from_file_location(
        "build_ncdr_corpus", _FIXTURE_DIR / "build_ncdr_corpus.py"
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_ncdr_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.slow
def test_ncdr_e2e_meets_acceptance_gates() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_pcis=50)  # type: ignore[attr-defined]
    records = NCDRReader().read(io.StringIO(csv_payload))

    # Gate 1: 50 in / 50 out
    assert len(records) == 50

    # Gate 2: every stent_count > 0 record has matching UDI/type lists.
    for r in records:
        assert len(r.stent_udis) == r.stent_count
        assert len(r.stent_types) == r.stent_count

    # Gate 3: total stent count >= 30 (single-stent block) + 20 (multi-
    # stent at 2-3 each) = expected ~50-60 stents on the fixture.
    total_stents = sum(r.stent_count for r in records)
    assert 50 <= total_stents <= 70

    # Gate 4: stent type distribution mostly DES (the realistic clinical
    # mix). With seed=42, expect >50% DES across all stents.
    all_types = [t for r in records for t in r.stent_types]
    if all_types:  # skip for diagnostic-only corpora
        des_pct = sum(1 for t in all_types if t == "DES") / len(all_types)
        assert des_pct >= 0.5


@pytest.mark.slow
def test_ncdr_e2e_idempotent_on_replay() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_pcis=50)  # type: ignore[attr-defined]
    a = NCDRReader().read(io.StringIO(csv_payload))
    b = NCDRReader().read(io.StringIO(csv_payload))
    assert a == b
