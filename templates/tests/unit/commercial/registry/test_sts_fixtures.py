"""Phase 3 Plan 4B Task 6 (T-022B): synthetic STS corpus fixture."""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path

from runtime.commercial.registry.sts.reader import STSReader

_FIXTURE_DIR = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "manifests"
    / "registry_to_omop_sts"
    / "fixtures"
    / "synthetic"
)


def _load_builder() -> object:
    spec = importlib.util.spec_from_file_location(
        "build_sts_corpus", _FIXTURE_DIR / "build_sts_corpus.py"
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["build_sts_corpus"] = module
    spec.loader.exec_module(module)
    return module


def test_fixture_exists() -> None:
    assert (_FIXTURE_DIR / "build_sts_corpus.py").is_file()


def test_build_corpus_is_deterministic() -> None:
    builder = _load_builder()
    a = builder.build_corpus(seed=42, n_surgeries=10)  # type: ignore[attr-defined]
    b = builder.build_corpus(seed=42, n_surgeries=10)  # type: ignore[attr-defined]
    assert a == b


def test_corpus_yields_n_surgeries() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_surgeries=50)  # type: ignore[attr-defined]
    records = STSReader().read(io.StringIO(csv_payload))
    assert len(records) == 50


def test_corpus_covers_5_procedure_categories() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_surgeries=50)  # type: ignore[attr-defined]
    records = STSReader().read(io.StringIO(csv_payload))
    cats = {r.procedure_category for r in records}
    assert cats == {"CABG", "Valve", "Aortic", "Combined", "Other"}


def test_corpus_includes_some_complications_and_mortality() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_surgeries=50)  # type: ignore[attr-defined]
    records = STSReader().read(io.StringIO(csv_payload))
    aki_count = sum(1 for r in records if r.postop_aki)
    mortality_count = sum(1 for r in records if r.mortality_30day)
    assert aki_count >= 1  # mod-7 spread on n=50 -> 7 events
    assert mortality_count == 5  # mod-10 -> exactly 5 of 50


def test_corpus_distinct_patients() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_surgeries=50)  # type: ignore[attr-defined]
    records = STSReader().read(io.StringIO(csv_payload))
    pids = {r.patient_id for r in records}
    assert len(pids) == 50
