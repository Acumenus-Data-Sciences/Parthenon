"""Phase 3 Plan 4C Task 6 (T-022C): synthetic NCDR corpus fixture."""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path

from runtime.commercial.registry.ncdr.reader import NCDRReader

_FIXTURE_DIR = (
    Path(__file__).resolve().parents[4]
    / "commercial"
    / "manifests"
    / "registry_to_omop_ncdr"
    / "fixtures"
    / "synthetic"
)


def _load_builder() -> object:
    spec = importlib.util.spec_from_file_location(
        "build_ncdr_corpus", _FIXTURE_DIR / "build_ncdr_corpus.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["build_ncdr_corpus"] = module
    spec.loader.exec_module(module)
    return module


def test_fixture_exists() -> None:
    assert (_FIXTURE_DIR / "build_ncdr_corpus.py").is_file()


def test_build_corpus_is_deterministic() -> None:
    builder = _load_builder()
    a = builder.build_corpus(seed=42, n_pcis=10)  # type: ignore[attr-defined]
    b = builder.build_corpus(seed=42, n_pcis=10)  # type: ignore[attr-defined]
    assert a == b


def test_corpus_yields_n_records() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_pcis=50)  # type: ignore[attr-defined]
    records = NCDRReader().read(io.StringIO(csv_payload))
    assert len(records) == 50


def test_corpus_pci_shape_mix() -> None:
    """Plan-driven mix: 10 diagnostic-only / 30 single-stent / 10 multi-stent."""
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_pcis=50)  # type: ignore[attr-defined]
    records = NCDRReader().read(io.StringIO(csv_payload))

    diag_only = sum(1 for r in records if r.lesion_count == 0 and r.stent_count == 0)
    single_stent = sum(1 for r in records if r.lesion_count == 1 and r.stent_count == 1)
    multi_stent = sum(1 for r in records if r.stent_count >= 2)

    assert diag_only == 10
    assert single_stent == 30
    assert multi_stent == 10


def test_corpus_stent_udi_type_lists_align() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_pcis=50)  # type: ignore[attr-defined]
    records = NCDRReader().read(io.StringIO(csv_payload))
    for r in records:
        assert len(r.stent_udis) == len(r.stent_types) == r.stent_count


def test_corpus_includes_complications_and_mortality() -> None:
    builder = _load_builder()
    csv_payload: str = builder.build_corpus(seed=42, n_pcis=50)  # type: ignore[attr-defined]
    records = NCDRReader().read(io.StringIO(csv_payload))
    aki = sum(1 for r in records if r.postop_aki)
    mortality = sum(1 for r in records if r.mortality_in_hospital)
    # mod-7 AKI on n=50 -> 7
    assert aki >= 5
    # mod-20 mortality on n=50 -> 2
    assert mortality >= 1
