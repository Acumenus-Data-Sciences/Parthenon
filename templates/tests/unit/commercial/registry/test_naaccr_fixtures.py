"""Phase 3 Plan 4A Task 7 (T-022A): synthetic NAACCR corpus fixture."""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path

from runtime.commercial.registry.naaccr.reader import NAACCRReader

_FIXTURE_DIR = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "manifests"
    / "registry_to_omop_naaccr"
    / "fixtures"
    / "synthetic"
)


def _load_builder() -> object:
    spec = importlib.util.spec_from_file_location(
        "build_naaccr_corpus",
        _FIXTURE_DIR / "build_naaccr_corpus.py",
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["build_naaccr_corpus"] = module
    spec.loader.exec_module(module)
    return module


def test_fixture_module_exists() -> None:
    assert (_FIXTURE_DIR / "build_naaccr_corpus.py").is_file()


def test_build_corpus_is_deterministic() -> None:
    builder = _load_builder()
    a = builder.build_corpus(seed=42, n_tumors=10)  # type: ignore[attr-defined]
    b = builder.build_corpus(seed=42, n_tumors=10)  # type: ignore[attr-defined]
    assert a == b


def test_corpus_yields_n_records() -> None:
    builder = _load_builder()
    payload = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]
    records = NAACCRReader().read(io.StringIO(payload))
    assert len(records) == 50


def test_corpus_covers_5_cancer_types() -> None:
    builder = _load_builder()
    payload = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]
    records = NAACCRReader().read(io.StringIO(payload))
    sites = {r.primary_site for r in records}
    # Breast / prostate / lung / colon / brain
    assert sites == {"C509", "C619", "C349", "C189", "C719"}


def test_corpus_all_records_are_malignant_primary() -> None:
    builder = _load_builder()
    payload = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]
    records = NAACCRReader().read(io.StringIO(payload))
    assert all(r.behavior_code_icdo3 == "3" for r in records)


def test_corpus_includes_treatment_summaries() -> None:
    """Every record has surgery; chemo / radiation / hormone vary by index."""
    builder = _load_builder()
    payload = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]
    records = NAACCRReader().read(io.StringIO(payload))
    assert all(r.rx_summary_surgery == "30" for r in records)
    chemo = sum(1 for r in records if r.rx_summary_chemo == "02")
    assert chemo >= 20  # ~half (even-indexed)


def test_corpus_uses_distinct_patient_ids() -> None:
    builder = _load_builder()
    payload = builder.build_corpus(seed=42, n_tumors=50)  # type: ignore[attr-defined]
    records = NAACCRReader().read(io.StringIO(payload))
    patient_ids = {r.patient_id_number for r in records}
    assert len(patient_ids) == 50  # one tumor per patient in v0.1
