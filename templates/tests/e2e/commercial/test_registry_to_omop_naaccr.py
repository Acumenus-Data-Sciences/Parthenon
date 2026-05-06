"""Phase 3 Plan 4A Task 8 (T-022A): registry_to_omop_naaccr validation E2E.

In-process reader pipeline against the seed=42 / n_tumors=50 corpus.
Same gating as Plans 1-3 E2Es — the full SQL pipeline against
testcontainers Postgres lands once the programmatic ``run_manifest``
driver ships (Phase 4 follow-up; ADR 0015 §"Open follow-ups").

Acceptance per plan §8 (DQD-equivalent post-conditions):

1. Every NAACCR record yields a parseable NAACCRRecord (50 in / 50 out).
2. All records are behavior 3 (malignant primary) — projection-eligible.
3. Treatment summary fields populate at least surgery on every record.
4. Tumor diagnosis dates are within the expected DX year (2024).
5. Reader is idempotent: same input → equal NAACCRRecord lists.
"""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path

import pytest

from runtime.commercial.registry.naaccr.reader import NAACCRReader

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = (
    _REPO / "commercial" / "manifests" / "registry_to_omop_naaccr" / "fixtures" / "synthetic"
)


def _load_builder():  # type: ignore[no-untyped-def]
    builder_path = _FIXTURE_DIR / "build_naaccr_corpus.py"
    spec = importlib.util.spec_from_file_location("build_naaccr_corpus", builder_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_naaccr_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.slow
def test_naaccr_e2e_meets_acceptance_gates() -> None:
    """End-to-end NAACCRReader against seed=42 / n_tumors=50 corpus."""
    builder = _load_builder()
    payload: str = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]

    records = NAACCRReader().read(io.StringIO(payload))

    # Gate 1: 50 in / 50 out
    assert len(records) == 50

    # Gate 2: all behavior 3 (malignant primary)
    assert all(r.behavior_code_icdo3 == "3" for r in records)

    # Gate 3: surgery populated on every record (Task 7 fixture invariant)
    assert all(r.rx_summary_surgery == "30" for r in records)
    # Chemo on ~half (even indices), radiation on ~third (mod-3), hormone on ~fifth (mod-5)
    chemo = sum(1 for r in records if r.rx_summary_chemo == "02")
    radiation = sum(1 for r in records if r.rx_summary_radiation == "20")
    hormone = sum(1 for r in records if r.rx_summary_hormone == "01")
    assert chemo >= 20
    assert radiation >= 10
    assert hormone >= 5

    # Gate 4: diagnoses are in 2024 (the fixture year)
    assert all(r.date_of_diagnosis.year == 2024 for r in records)

    # Gate 5: ICD-O-3 codes are well-formed (4-char site, 4-char histology)
    for r in records:
        assert len(r.primary_site) == 4
        assert r.primary_site.startswith("C")
        assert len(r.histologic_type_icdo3) == 4


@pytest.mark.slow
def test_naaccr_e2e_idempotent_on_replay() -> None:
    """Reader must produce identical NAACCRRecord lists on re-runs."""
    builder = _load_builder()
    payload: str = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]
    a = NAACCRReader().read(io.StringIO(payload))
    b = NAACCRReader().read(io.StringIO(payload))
    assert a == b
