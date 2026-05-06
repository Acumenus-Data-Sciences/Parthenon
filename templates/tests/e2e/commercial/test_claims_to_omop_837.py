"""Phase 3 Plan 1 Task 10: claims_to_omop end-to-end with cost sentinels.

The full SQL pipeline (manifest stages 1-12) is wired to the runner in
Plan 2, when the ``x12_837_reader`` node node is registered. Until then,
this E2E exercises the *reader → projector* pipeline directly, which is
the load-bearing logic for the COST projection convention (ADR 0016).

Acceptance per plan §10:

1. Generate a synthetic 837 corpus of size N such that the line count
   crosses 100k (the perf budget unit in T-021).
2. The X12_837_Reader + CostProjector pipeline processes the corpus in
   under 30 minutes (T-021 perf budget).
3. Per-(claim_type, cost_event_field, cost_concept) row counts match
   the seed=42 100-claim sentinel CSV scaled by the n_claims ratio
   within ±2%.
4. Every projected procedure_occurrence has at least one matching cost
   row at cost_event_field_concept_id=1147301 (no orphans).

The 100k-line corpus uses ``n_claims=50000`` because the corpus mix
averages ~2.23 lines/claim (measured at n_claims=100). 50k claims
≈ 111.5k lines, comfortably above the 100k floor. Smaller CI runs use
``n_claims=100`` and scale the sentinel CSV by 1.0 (i.e., assert on the
exact CSV).

Marked ``@pytest.mark.slow`` because even the small variant takes a
second to generate the corpus and the n_claims=50000 variant takes
~10s on commodity hardware (parsing only, no DB I/O).
"""

from __future__ import annotations

import csv
import importlib.util
import io
import sys
import time
from collections import defaultdict
from pathlib import Path

import pytest
import yaml

from runtime.commercial.claims.cost_projector import CostProjector
from runtime.commercial.claims.readers.x12_837 import X12_837_Reader
from runtime.commercial.claims.types import X12_837_ClaimLine

_REPO = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = _REPO / "commercial" / "manifests" / "claims_to_omop" / "fixtures" / "synthetic"
_VALIDATION_DIR = _REPO / "commercial" / "manifests" / "claims_to_omop" / "validation" / "expected"


def _load_builder():  # type: ignore[no-untyped-def]
    builder_path = _FIXTURE_DIR / "build_837_corpus.py"
    spec = importlib.util.spec_from_file_location("build_837_corpus", builder_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_837_corpus"] = mod
    spec.loader.exec_module(mod)
    return mod


def _load_expected_sentinels() -> dict[tuple[str, int, int], tuple[int, float]]:
    """Load (claim_type, cost_event_field, cost_concept) → (row_count, total)."""
    out: dict[tuple[str, int, int], tuple[int, float]] = {}
    with (_VALIDATION_DIR / "cost_sentinels.csv").open() as f:
        for row in csv.DictReader(f):
            key = (
                row["claim_type"],
                int(row["cost_event_field_concept_id"]),
                int(row["cost_concept_id"]),
            )
            out[key] = (int(row["row_count"]), float(row["total_amount"]))
    return out


def _load_post_conditions() -> dict[str, object]:
    raw = (_VALIDATION_DIR / "post_conditions.yaml").read_text()
    parsed = yaml.safe_load(raw)
    assert isinstance(parsed, dict)
    return parsed


def _project(
    claims_with_lines: tuple[list, list],  # type: ignore[type-arg]
) -> tuple[
    dict[tuple[str, int, int], tuple[int, float]],
    int,
]:
    """Run the projector pipeline; return sentinel buckets + procedure count."""
    claims, lines = claims_with_lines
    proj = CostProjector()
    claim_type = {c.claim_id: c.claim_type for c in claims}

    buckets: dict[tuple[str, int, int], list[float]] = defaultdict(lambda: [0.0, 0.0])
    procedures_seen: set[int] = set()
    procedures_with_cost: set[int] = set()

    # Line-level: every line becomes a procedure_occurrence_id.
    line_obj: X12_837_ClaimLine
    for proc_id, line_obj in enumerate(lines, start=1):
        procedures_seen.add(proc_id)
        rows = proj.project_line(line_obj, procedure_occurrence_id=proc_id)
        for r in rows:
            if r.cost_event_field_concept_id == 1147301:
                procedures_with_cost.add(r.cost_event_id)
            key = (claim_type[line_obj.claim_id], r.cost_event_field_concept_id, r.cost_concept_id)
            bucket = buckets[key]
            bucket[0] += 1
            bucket[1] += float(r.cost)

    # Header-level: institutional claims project visit-level rows. We use
    # a synthetic visit_occurrence_id space of "100000 + claim_idx".
    for visit_id, claim in enumerate(claims, start=100_000):
        rows = proj.project_claim(claim, visit_occurrence_id=visit_id)
        for r in rows:
            key = (claim.claim_type, r.cost_event_field_concept_id, r.cost_concept_id)
            bucket = buckets[key]
            bucket[0] += 1
            bucket[1] += float(r.cost)

    sentinels = {k: (int(v[0]), v[1]) for k, v in buckets.items()}
    orphans = procedures_seen - procedures_with_cost
    assert not orphans, f"{len(orphans)} procedure_occurrences without cost rows"

    return sentinels, len(procedures_seen)


def test_seed_42_n100_matches_sentinel_csv() -> None:
    """The 100-claim corpus row counts match cost_sentinels.csv exactly."""
    mod = _load_builder()
    payload = mod.build_corpus(seed=42, n_claims=100)
    reader = X12_837_Reader()
    claims, lines = reader.read(io.StringIO(payload))
    assert len(claims) == 100

    sentinels, n_procedures = _project((claims, lines))
    expected = _load_expected_sentinels()

    # Every expected key must be present in actual (the projector might
    # produce extras if the builder added new amount kinds — that's fine).
    assert set(expected) <= set(
        sentinels
    ), f"missing sentinel buckets: {set(expected) - set(sentinels)}"
    for key, (exp_count, exp_total) in expected.items():
        actual_count, actual_total = sentinels[key]
        assert actual_count == exp_count, f"{key}: row_count {actual_count} != {exp_count}"
        # Float comparison with 1-cent tolerance (Decimal→float roundoff).
        assert (
            abs(actual_total - exp_total) < 0.05
        ), f"{key}: total_amount {actual_total:.2f} != {exp_total:.2f}"


def test_post_conditions_yaml_matches_actual_counts() -> None:
    """post_conditions.yaml reference counts agree with the seed=42 corpus."""
    mod = _load_builder()
    payload = mod.build_corpus(seed=42, n_claims=100)
    reader = X12_837_Reader()
    claims, lines = reader.read(io.StringIO(payload))

    pc = _load_post_conditions()
    refs = pc["reference_counts"]
    assert isinstance(refs, dict)

    assert len(claims) == refs["total_claims"]
    assert len(lines) == refs["total_lines"]
    # Visits: in the SQL pipeline, one per claim. Procedures: one per line.
    assert len(claims) >= int(refs["visits_min"])
    assert len(lines) >= int(refs["procedures_min"])


@pytest.mark.slow
def test_100k_line_corpus_meets_perf_budget() -> None:
    """100k-line corpus parses + projects in well under 30 minutes.

    Uses n_claims=50000 → ~111.5k lines (the corpus averages 2.23 lines /
    claim at seed=42). The plan §10 acceptance is <30 minutes for the
    full SQL pipeline; the in-process reader+projector path tested here
    typically completes in ~10 seconds, leaving enormous head-room for
    the SQL stages Plan 2 wires up.
    """
    pc = _load_post_conditions()
    perf_budget_seconds = float(pc["gates"]["perf_budget_minutes"]) * 60.0  # type: ignore[index]

    mod = _load_builder()

    t0 = time.perf_counter()
    payload = mod.build_corpus(seed=42, n_claims=50_000)
    t_build = time.perf_counter() - t0

    reader = X12_837_Reader()
    t0 = time.perf_counter()
    claims, lines = reader.read(io.StringIO(payload))
    t_read = time.perf_counter() - t0

    t0 = time.perf_counter()
    sentinels, n_procedures = _project((claims, lines))
    t_project = time.perf_counter() - t0

    total = t_build + t_read + t_project
    # Lines must cross the 100k floor.
    assert len(lines) >= 100_000, f"corpus only produced {len(lines)} lines"
    assert total < perf_budget_seconds, (
        f"perf budget exceeded: build={t_build:.1f}s read={t_read:.1f}s "
        f"project={t_project:.1f}s total={total:.1f}s budget={perf_budget_seconds:.0f}s"
    )

    # Sentinel structural assertions for n_claims=50000.
    #
    # The corpus generator forces the first three claims to be P / I / D,
    # then samples uniformly from {P, I, D}. At small n the n=100 mix
    # was 39P / 26I / 35D (random walk noise), but at n=50000 the law of
    # large numbers pushes each type to ~33% with sub-1% deviation.
    # Asserting the n=100 sentinels scaled by 500 would be wrong — they
    # carry the small-N sampling noise.
    #
    # Acceptance therefore tests the LARGE-N invariant: each claim type
    # is within ±2% of n_claims/3 (post_conditions.yaml gate). This is
    # the structural shape claim_to_omop guarantees at scale.
    sentinel_tolerance_pct = float(pc["sentinel_tolerance_pct"])  # type: ignore[index]
    type_counts = {"P": 0, "I": 0, "D": 0}
    for c in claims:
        type_counts[c.claim_type] += 1
    expected_per_type = len(claims) / 3.0
    tolerance = expected_per_type * (sentinel_tolerance_pct / 100.0)
    for ct, count in type_counts.items():
        deviation = abs(count - expected_per_type)
        assert deviation < tolerance, (
            f"claim_type {ct}: count {count} not within "
            f"±{sentinel_tolerance_pct}% of expected {expected_per_type:.0f}"
        )

    # Cost row count invariant: every line emits exactly one charged row,
    # institutional claims emit one extra (visit-level charged) total.
    expected_cost_rows = len(lines) + type_counts["I"]
    actual_cost_rows = sum(v[0] for v in sentinels.values())
    assert (
        actual_cost_rows == expected_cost_rows
    ), f"expected {expected_cost_rows} cost rows, got {actual_cost_rows}"
