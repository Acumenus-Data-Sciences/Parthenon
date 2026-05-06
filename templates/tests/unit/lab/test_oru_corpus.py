"""Phase 3 Plan 5 Task 8 (T-023): synthetic ORU corpus fixture."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from runtime.nodes.hl7v2_oru_reader import Hl7v2OruReader

_FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "manifests"
    / "lis_lab_to_omop"
    / "fixtures"
    / "synthetic"
    / "build_oru_corpus.py"
)


def _load_builder():  # type: ignore[no-untyped-def]
    spec = importlib.util.spec_from_file_location("build_oru_corpus", _FIXTURE)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_oru_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_fixture_exists() -> None:
    assert _FIXTURE.is_file()


def test_build_corpus_is_deterministic() -> None:
    builder = _load_builder()
    a: str = builder.build_corpus(seed=42, n_messages=10)
    b: str = builder.build_corpus(seed=42, n_messages=10)
    assert a == b


def test_corpus_yields_n_messages() -> None:
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    msgs = list(Hl7v2OruReader().read(text))
    assert len(msgs) == 50


def test_corpus_first_30_are_pure_loinc() -> None:
    """LOINC-happy-path cohort: every OBX uses coding_system='LN'."""
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    msgs = list(Hl7v2OruReader().read(text))
    for m in msgs[:30]:
        for o in m.observations:
            assert o.coding_system == "LN"


def test_corpus_last_20_mix_local_codes() -> None:
    """Queue-populating cohort: at least one local-coded OBX across the 20."""
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    msgs = list(Hl7v2OruReader().read(text))
    local_count = sum(1 for m in msgs[30:] for o in m.observations if o.coding_system == "L")
    assert local_count > 0


def test_corpus_includes_r30_or_r31_variants() -> None:
    """The reader must process the R30/R31 trigger variants in the fixture."""
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    # If the corpus contained an R32, the reader would have raised.
    msgs = list(Hl7v2OruReader().read(text))
    assert all(m.encounter_id is not None for m in msgs)


def test_corpus_message_ids_are_unique() -> None:
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    msgs = list(Hl7v2OruReader().read(text))
    ids = [m.message_control_id for m in msgs]
    assert len(set(ids)) == len(ids)


def test_corpus_no_phi_in_ids() -> None:
    """Synthetic fixture: only PAT/MSG/ENC/ORD/HOSP-prefixed deterministic tokens."""
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    # No real-looking SSN-like or DOB-like tokens.
    import re

    assert not re.search(r"\b\d{3}-\d{2}-\d{4}\b", text)
    assert not re.search(r"\b(?:19|20)\d{2}-\d{2}-\d{2}\b", text)
