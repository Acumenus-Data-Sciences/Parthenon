"""Phase 3 Plan 7 Task 16 (Section C): Llettuce graduation eval.

Re-runs Phase 2 Plan 2 (SciSpaCy) and Phase 2 Plan 3 (Llettuce) backends
through Phase 3 Plan 6's curated benchmark (``seen.csv``) and writes a
markdown report with per-vocabulary and SNOMED-restricted
``concept_match_rate`` for both backends. The report drives the Phase 3
graduation decision per ADR 0013 — the +5 pp SNOMED threshold is
applied separately by ``test_apply_graduation_threshold``.

Marker: ``mapping_eval`` (default lane skips it). Run explicitly via:

    uv run pytest tests/eval/test_llettuce_graduation_against_curated_benchmark.py \\
        -v -m mapping_eval

The test SKIPS cleanly if:

- benchmark CSV (``seen.csv``) is absent (gitignored, generated locally
  via ``scripts/curate_mapping_benchmark.py``).
- either backend cannot be loaded (heavy weights / sidecar / Llettuce
  package not installed). The eval is gated on demand and we'd rather
  surface a skip than a misleading 0% rate from a non-running backend.

Output: ``templates/_eval/llettuce_graduation_report.md`` and
``templates/_eval/llettuce_graduation_verdict.md`` (the latter is
written by ``test_apply_graduation_threshold``).
"""

from __future__ import annotations

import csv
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import pytest

# The curated benchmark from Plan 6 lives in the commercial wheel because
# it is generated from a customer's vocabulary. Path is repo-relative so
# the test is reusable across CI and local runs.
_BENCHMARK_DIR = (
    Path(__file__).resolve().parents[2]
    / "commercial"
    / "runtime"
    / "commercial"
    / "mapping"
    / "benchmark"
    / "v0.1.0"
)
_SEEN_CSV = _BENCHMARK_DIR / "seen.csv"

# Output artifacts go into the templates/_eval/ directory used by the
# existing ner-eval lane.
_OUT_DIR = Path(__file__).resolve().parents[2] / "_eval"
_REPORT_PATH = _OUT_DIR / "llettuce_graduation_report.md"
_VERDICT_PATH = _OUT_DIR / "llettuce_graduation_verdict.md"

# ADR 0013 threshold: Llettuce graduates if it beats SciSpaCy by >= 5 pp
# on SNOMED concept_match_rate.
GRADUATION_DELTA_PP = 0.05

_PROMPT_VERSION = "v0.1.0"


@dataclass(frozen=True)
class _BenchRow:
    source_code: str
    source_vocab: str
    source_text: str
    target_concept_id: int
    target_vocab: str


@dataclass
class _BackendStats:
    """Per-backend counts for computing concept_match_rate."""

    name: str
    total: int = 0
    matched: int = 0
    by_vocab_total: dict[str, int] = field(default_factory=dict)
    by_vocab_matched: dict[str, int] = field(default_factory=dict)
    error: str | None = None

    def record(self, target_vocab: str, hit: bool) -> None:
        self.total += 1
        self.by_vocab_total[target_vocab] = self.by_vocab_total.get(target_vocab, 0) + 1
        if hit:
            self.matched += 1
            self.by_vocab_matched[target_vocab] = self.by_vocab_matched.get(target_vocab, 0) + 1

    @property
    def concept_match_rate(self) -> float:
        return self.matched / self.total if self.total else 0.0

    def by_vocab_rate(self, vocab: str) -> float:
        denom = self.by_vocab_total.get(vocab, 0)
        if not denom:
            return 0.0
        return self.by_vocab_matched.get(vocab, 0) / denom


def _load_seen() -> list[_BenchRow]:
    rows: list[_BenchRow] = []
    if not _SEEN_CSV.is_file() or _SEEN_CSV.stat().st_size == 0:
        return rows
    with _SEEN_CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                _BenchRow(
                    source_code=str(r["source_code"]),
                    source_vocab=str(r["source_vocab"]),
                    source_text=str(r["source_text"]),
                    target_concept_id=int(r["target_concept_id"]),
                    target_vocab=str(r["target_vocab"]),
                )
            )
    return rows


def _benchmark_present() -> bool:
    return _SEEN_CSV.is_file() and _SEEN_CSV.stat().st_size > 0


# ---- Backend loaders (lazy; each may raise) -------------------------------


def _load_scispacy() -> Callable[[str], list[int]]:
    """Return a callable that runs SciSpaCy and yields concept_ids hit."""
    from runtime.nlp.backends.scispacy import SciSpacyBackend

    backend = SciSpacyBackend()

    def _run(text: str) -> list[int]:
        result = backend.infer(text, _PROMPT_VERSION)
        return [m.concept_id for m in result.mappings]

    return _run


def _load_llettuce() -> Callable[[str], list[int]]:
    """Return a callable that runs Llettuce and yields concept_ids hit."""
    from runtime.nlp.backends.llettuce import LlettuceBackend

    backend = LlettuceBackend()

    def _run(text: str) -> list[int]:
        result = backend.infer(text, _PROMPT_VERSION)
        return [m.concept_id for m in result.mappings]

    return _run


# ---- Eval driver ----------------------------------------------------------


def _run_one_backend(
    name: str,
    fn: Callable[[str], list[int]],
    rows: list[_BenchRow],
) -> _BackendStats:
    stats = _BackendStats(name=name)
    for row in rows:
        try:
            concept_ids = fn(row.source_text)
        except Exception as exc:  # pragma: no cover — eval-time failure path
            stats.error = f"{type(exc).__name__}: {exc}"
            return stats
        stats.record(row.target_vocab, row.target_concept_id in concept_ids)
    return stats


def _format_report(
    sci: _BackendStats,
    let: _BackendStats,
    n_rows: int,
) -> str:
    """Render the Llettuce graduation report.

    SNOMED concept_match_rate is the headline metric per ADR 0013.
    """
    vocabs = sorted(set(sci.by_vocab_total) | set(let.by_vocab_total))
    lines = [
        "# Llettuce Graduation Report",
        "",
        "Phase 3 Plan 7 Section C (Task 16). Re-runs the Phase 2 NER backends",
        "through the Plan 6 curated benchmark (`seen.csv`) and reports per-",
        "vocabulary `concept_match_rate`. The Phase 3 graduation decision",
        f"is driven by SNOMED `concept_match_rate` delta >= +{GRADUATION_DELTA_PP * 100:.0f} pp",
        "(ADR 0013).",
        "",
        f"- Benchmark rows: **{n_rows}**",
        "- Backends: SciSpaCy (Phase 2 Plan 2), Llettuce (Phase 2 Plan 3, eval-only)",
        "",
        "## Per-vocabulary concept_match_rate",
        "",
        "| Target vocabulary | rows | SciSpaCy | Llettuce | delta (pp) |",
        "|---|---:|---:|---:|---:|",
    ]
    for vocab in vocabs:
        n = max(sci.by_vocab_total.get(vocab, 0), let.by_vocab_total.get(vocab, 0))
        sci_rate = sci.by_vocab_rate(vocab)
        let_rate = let.by_vocab_rate(vocab)
        delta_pp = (let_rate - sci_rate) * 100
        lines.append(
            f"| {vocab} | {n} | {sci_rate:.3f} | {let_rate:.3f} | {delta_pp:+.2f} |"
        )

    sci_snomed = sci.by_vocab_rate("SNOMED")
    let_snomed = let.by_vocab_rate("SNOMED")
    delta_snomed = let_snomed - sci_snomed

    lines += [
        "",
        "## SNOMED-restricted concept_match_rate (graduation metric)",
        "",
        f"- SciSpaCy: **{sci_snomed:.3f}**",
        f"- Llettuce: **{let_snomed:.3f}**",
        f"- Delta: **{delta_snomed * 100:+.2f} pp** "
        f"(threshold: +{GRADUATION_DELTA_PP * 100:.0f} pp)",
        "",
        "## Overall concept_match_rate",
        "",
        f"- SciSpaCy: {sci.concept_match_rate:.3f} ({sci.matched}/{sci.total})",
        f"- Llettuce: {let.concept_match_rate:.3f} ({let.matched}/{let.total})",
    ]
    if sci.error:
        lines.append(f"- SciSpaCy error: `{sci.error}`")
    if let.error:
        lines.append(f"- Llettuce error: `{let.error}`")

    lines.append("")
    return "\n".join(lines) + "\n"


# ---- Tests ----------------------------------------------------------------


@pytest.mark.mapping_eval
@pytest.mark.skipif(
    not _benchmark_present(),
    reason="seen.csv absent — generate via scripts/curate_mapping_benchmark.py",
)
def test_llettuce_graduation_eval_writes_report() -> None:
    rows = _load_seen()
    assert rows, "seen.csv loaded but empty"

    try:
        sci_fn = _load_scispacy()
    except Exception as exc:  # pragma: no cover — environment-dependent
        pytest.skip(f"SciSpaCy backend unavailable: {type(exc).__name__}: {exc}")

    try:
        let_fn = _load_llettuce()
    except Exception as exc:  # pragma: no cover — environment-dependent
        pytest.skip(f"Llettuce backend unavailable: {type(exc).__name__}: {exc}")

    sci_stats = _run_one_backend("scispacy", sci_fn, rows)
    let_stats = _run_one_backend("llettuce", let_fn, rows)

    report = _format_report(sci_stats, let_stats, n_rows=len(rows))

    _OUT_DIR.mkdir(parents=True, exist_ok=True)
    _REPORT_PATH.write_text(report, encoding="utf-8")

    # Smoke assertions on the rendered report.
    body = _REPORT_PATH.read_text(encoding="utf-8")
    assert "# Llettuce Graduation Report" in body
    assert "SNOMED-restricted concept_match_rate" in body


# ---- Pure helper tests (always run, no LLM/DB/backends required) ----------


def test_backend_stats_concept_match_rate_zero_when_empty() -> None:
    stats = _BackendStats(name="x")
    assert stats.concept_match_rate == 0.0
    assert stats.by_vocab_rate("SNOMED") == 0.0


def test_backend_stats_records_per_vocab_correctly() -> None:
    stats = _BackendStats(name="x")
    stats.record("SNOMED", True)
    stats.record("SNOMED", False)
    stats.record("RxNorm", True)
    assert stats.total == 3
    assert stats.matched == 2
    assert stats.by_vocab_rate("SNOMED") == 0.5
    assert stats.by_vocab_rate("RxNorm") == 1.0
    assert stats.concept_match_rate == pytest.approx(2 / 3)


def test_format_report_contains_required_sections() -> None:
    sci = _BackendStats(name="scispacy")
    let = _BackendStats(name="llettuce")
    for _ in range(10):
        sci.record("SNOMED", True)
    for _ in range(10):
        let.record("SNOMED", True)
    body = _format_report(sci, let, n_rows=10)
    assert "# Llettuce Graduation Report" in body
    assert "Per-vocabulary concept_match_rate" in body
    assert "SNOMED-restricted concept_match_rate (graduation metric)" in body
    assert "Overall concept_match_rate" in body


def test_graduation_delta_constant_matches_adr() -> None:
    # ADR 0013: +5 pp SNOMED threshold.
    assert GRADUATION_DELTA_PP == 0.05
