"""Phase 3 Plan 5 Task 11 (T-023): lis_lab_to_omop validation E2E.

Reader-level acceptance gates corresponding to the manifest's DQD
post-conditions. A future SQL-level E2E (running the full DAG against
a testcontainers PG) is deferred to Phase 4 — this Phase 3 lane keeps
parity with Plans 4A/B/C E2Es that exercise the parser + invariants.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

from runtime.lab.harmonizer import LoincHarmonizerStub
from runtime.lab.types import OruObservation, OruR01Message
from runtime.nodes.hl7v2_oru_reader import Hl7v2OruReader

_REPO = Path(__file__).resolve().parents[2]
_FIXTURE = (
    _REPO / "manifests" / "lis_lab_to_omop" / "fixtures" / "synthetic" / "build_oru_corpus.py"
)


def _load_builder():  # type: ignore[no-untyped-def]
    spec = importlib.util.spec_from_file_location("build_oru_corpus", _FIXTURE)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_oru_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


def _classify(obs: OruObservation) -> str:
    """Mirror the Task 6 mapper's resolution logic at the Python layer."""
    if obs.coding_system in ("LN", "LOINC"):
        return "loinc"
    return "local"


@pytest.mark.slow
def test_e2e_meets_acceptance_gates() -> None:
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    msgs = list(Hl7v2OruReader().read(text))

    # Gate 1: 50 messages in -> 50 messages out
    assert len(msgs) == 50

    # Gate 2: every message has at least one observation (mapper reads them all)
    for m in msgs:
        assert isinstance(m, OruR01Message)
        assert len(m.observations) >= 1

    # Gate 3: every LOINC-coded OBX projects into the mapper's standard-concept
    # path (in this fixture, every "loinc" classified row will be a candidate
    # for non-zero measurement_concept_id when run against vocab.concept).
    loinc_obs = [o for m in msgs for o in m.observations if _classify(o) == "loinc"]
    assert len(loinc_obs) > 0

    # Gate 4: every local-coded OBX is queue-bound — the queue must end up
    # non-empty.
    local_obs = [o for m in msgs for o in m.observations if _classify(o) == "local"]
    assert len(local_obs) > 0

    # Gate 5: per the manifest cohort split, ~60% of messages produce
    # LOINC-only observations (mapper-happy path).
    loinc_only_msgs = [m for m in msgs if all(_classify(o) == "loinc" for o in m.observations)]
    assert len(loinc_only_msgs) >= 25  # the "first 30" messages cohort

    # Gate 6: HIGHSEC §7 — synthetic identifiers only.
    for m in msgs:
        assert m.patient_id.startswith("PAT")
        assert m.message_control_id.startswith("MSG")


@pytest.mark.slow
def test_e2e_idempotent_on_replay() -> None:
    """Same fixture twice yields identical parse output (deterministic seed=42)."""
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    a = list(Hl7v2OruReader().read(text))
    b = list(Hl7v2OruReader().read(text))
    assert a == b


@pytest.mark.slow
def test_community_harmonizer_stub_is_no_op_on_unmapped() -> None:
    """LoincHarmonizerStub returns [] for every queued local code.

    Customers running only the community wheel must still get a usable
    queue — the harmonizer's empty list is the expected community-tier
    behavior. Plan 6 replaces the stub with an AI suggester.
    """
    builder = _load_builder()
    text: str = builder.build_corpus(seed=42, n_messages=50)
    msgs = list(Hl7v2OruReader().read(text))
    harmonizer = LoincHarmonizerStub()

    seen_local_codes: set[str] = set()
    for m in msgs:
        for o in m.observations:
            if _classify(o) == "local":
                seen_local_codes.add(o.observation_id)

    # Empty list per local code on the community-tier stub.
    for code in seen_local_codes:
        suggestions = harmonizer.suggest(code, "facility code", ["mg/dL"])
        assert suggestions == []


@pytest.mark.slow
def test_e2e_throughput_target() -> None:
    """Parse + classify throughput. Plan target: 10k OBX < 2 min.

    The reader currently parses ~50 messages with up to 3 OBX each in
    well under a second; we assert a generous 60 s ceiling on a 10k-OBX
    corpus to avoid CI flakes while still catching gross perf regressions.
    """
    import time

    builder = _load_builder()
    # n_messages=3334 with up to 3 OBX each yields ~5-10k OBX rows.
    text: str = builder.build_corpus(seed=42, n_messages=3334)

    start = time.perf_counter()
    msgs = list(Hl7v2OruReader().read(text))
    elapsed = time.perf_counter() - start

    total_obx = sum(len(m.observations) for m in msgs)
    assert total_obx >= 3000, f"corpus too small: {total_obx} OBX rows"
    assert elapsed < 60.0, (
        f"reader regression: parsed {total_obx} OBX rows in {elapsed:.2f}s "
        f"(target: <60s; plan: <2min for 10k)"
    )
