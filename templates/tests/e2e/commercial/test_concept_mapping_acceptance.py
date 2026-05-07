"""Phase 3 Plan 6 Task 13 (T-024A): concept-mapping acceptance E2E.

Acceptance gates per plan:

- ``seen.csv``: top-1 >= 60%, top-5 >= 85%.
- ``blind.csv``: top-1 >= 50%, top-5 >= 75%.

The test is gated under ``pytest -m mapping_eval`` so the default lane
does not pull bge-base weights, run a real LLM, or pretend to have a
populated ``vocab.concept_embedding_bge`` table. Schedule + workflow
dispatch run this lane against a real DB + LLM.

If the benchmark CSVs (``commercial/runtime/commercial/mapping/
benchmark/v0.1.0/{seen,blind}.csv``) are absent, the test is skipped —
they are gitignored and generated locally via
``scripts/curate_mapping_benchmark.py``.
"""

from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Any

import pytest

_BENCHMARK_DIR = (
    Path(__file__).resolve().parents[2]
    / "commercial"
    / "runtime"
    / "commercial"
    / "mapping"
    / "benchmark"
    / "v0.1.0"
)

# Acceptance gates (per plan; non-negotiable for the seen set).
SEEN_TOP1_MIN = 0.60
SEEN_TOP5_MIN = 0.85
BLIND_TOP1_MIN = 0.50
BLIND_TOP5_MIN = 0.75


def _load_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file() or path.stat().st_size == 0:
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _accuracy(rows: list[dict[str, str]], pipeline_callable: Any, k: int) -> float:
    """Return top-k accuracy across the benchmark rows.

    ``pipeline_callable`` is a callable that takes
    ``(source_text, source_code, source_vocab) -> RerankResult``. The test
    harness wires this to a real ``ConceptMappingSuggesterNode`` against
    the live DB + LLM at run-time.
    """
    if not rows:
        return 0.0
    hits = 0
    for row in rows:
        result = pipeline_callable(row["source_text"], row["source_code"], row["source_vocab"])
        target = int(row["target_concept_id"])
        candidate_ids = [c.concept_id for c in result.candidates[:k]]
        if target in candidate_ids:
            hits += 1
    return hits / len(rows)


def _benchmark_present() -> bool:
    return (_BENCHMARK_DIR / "seen.csv").is_file() and (_BENCHMARK_DIR / "blind.csv").is_file()


def _live_pipeline_available() -> bool:
    """Real run requires a DB DSN + an LLM."""
    return bool(os.environ.get("PARTHENON_DB_URL")) and (
        os.environ.get("OPENAI_LLM_ENABLED") == "true" or os.environ.get("PARTHENON_AI_SERVICE_URL")
    )


@pytest.mark.mapping_eval
@pytest.mark.skipif(
    not _benchmark_present(),
    reason="benchmark CSVs absent — generate via scripts/curate_mapping_benchmark.py",
)
@pytest.mark.skipif(
    not _live_pipeline_available(),
    reason="needs PARTHENON_DB_URL + an LLM provider env var",
)
def test_seen_acceptance_meets_gates() -> None:
    rows = _load_csv(_BENCHMARK_DIR / "seen.csv")
    assert len(rows) >= 100, f"seen.csv too small: {len(rows)} rows"

    pipeline = _build_pipeline()
    top1 = _accuracy(rows, pipeline, k=1)
    top5 = _accuracy(rows, pipeline, k=5)
    assert top1 >= SEEN_TOP1_MIN, f"seen top-1 = {top1:.3f} < {SEEN_TOP1_MIN:.2f} acceptance gate"
    assert top5 >= SEEN_TOP5_MIN, f"seen top-5 = {top5:.3f} < {SEEN_TOP5_MIN:.2f} acceptance gate"


@pytest.mark.mapping_eval
@pytest.mark.skipif(
    not _benchmark_present(),
    reason="benchmark CSVs absent — generate via scripts/curate_mapping_benchmark.py",
)
@pytest.mark.skipif(
    not _live_pipeline_available(),
    reason="needs PARTHENON_DB_URL + an LLM provider env var",
)
def test_blind_acceptance_meets_gates() -> None:
    rows = _load_csv(_BENCHMARK_DIR / "blind.csv")
    assert len(rows) >= 50, f"blind.csv too small: {len(rows)} rows"

    pipeline = _build_pipeline()
    top1 = _accuracy(rows, pipeline, k=1)
    top5 = _accuracy(rows, pipeline, k=5)
    assert (
        top1 >= BLIND_TOP1_MIN
    ), f"blind top-1 = {top1:.3f} < {BLIND_TOP1_MIN:.2f} acceptance gate"
    assert (
        top5 >= BLIND_TOP5_MIN
    ), f"blind top-5 = {top5:.3f} < {BLIND_TOP5_MIN:.2f} acceptance gate"


def _build_pipeline() -> Any:  # pragma: no cover — only when the gates run live
    """Construct a callable that runs embed -> retrieve -> rerank against live PG.

    Lives here (not at module load) so the default test lane does NOT
    import torch / sentence-transformers / pgvector at import time.
    """
    import psycopg

    from runtime.commercial.mapping.embedder import BgeEmbedder
    from runtime.commercial.mapping.reranker import ConceptReranker
    from runtime.commercial.mapping.retriever import ConceptRetriever

    embedder = BgeEmbedder()
    retriever = ConceptRetriever()
    reranker = ConceptReranker()
    db_url = os.environ["PARTHENON_DB_URL"]

    def _run(source_text: str, source_code: str, source_vocab: str) -> Any:
        with psycopg.connect(db_url) as conn, conn.cursor() as cursor:
            vec = embedder.embed([source_text])[0]
            candidates = retriever.search(cursor, vec)
        return reranker.rerank(
            source_text=source_text,
            source_code=source_code,
            source_vocab=source_vocab,
            candidates=candidates,
        )

    return _run


# ---------- pure helper tests (always run, no LLM/DB required) ----------


def test_accuracy_zero_for_empty_rows() -> None:
    """No rows -> 0.0; doesn't NaN out."""
    assert _accuracy([], lambda *_args: None, k=1) == 0.0


def test_accuracy_one_for_perfect_pipeline() -> None:
    rows = [
        {"source_text": "x", "source_code": "X", "source_vocab": "L", "target_concept_id": "1"},
        {"source_text": "y", "source_code": "Y", "source_vocab": "L", "target_concept_id": "2"},
    ]

    class _Cand:
        def __init__(self, cid: int) -> None:
            self.concept_id = cid

    class _Result:
        def __init__(self, cid: int) -> None:
            self.candidates = [_Cand(cid)]

    def perfect(text: str, code: str, vocab: str) -> _Result:
        return _Result(1 if code == "X" else 2)

    assert _accuracy(rows, perfect, k=1) == 1.0


def test_accuracy_zero_for_always_wrong_pipeline() -> None:
    rows = [
        {"source_text": "x", "source_code": "X", "source_vocab": "L", "target_concept_id": "1"},
    ]

    class _Cand:
        def __init__(self, cid: int) -> None:
            self.concept_id = cid

    class _Result:
        def __init__(self) -> None:
            self.candidates = [_Cand(99999)]

    def always_wrong(text: str, code: str, vocab: str) -> _Result:
        return _Result()

    assert _accuracy(rows, always_wrong, k=1) == 0.0


def test_acceptance_gate_constants_match_plan() -> None:
    assert SEEN_TOP1_MIN == 0.60
    assert SEEN_TOP5_MIN == 0.85
    assert BLIND_TOP1_MIN == 0.50
    assert BLIND_TOP5_MIN == 0.75
