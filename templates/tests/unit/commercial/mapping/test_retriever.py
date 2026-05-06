"""Phase 3 Plan 6 Task 6 (T-024A): ConceptRetriever pgvector top-K search."""

from __future__ import annotations

from typing import Any

import pytest

from runtime.commercial.mapping.retriever import ConceptRetriever
from runtime.commercial.mapping.types import ConceptCandidate


class _FakeCursor:
    def __init__(self, rows: list[tuple[Any, ...]]) -> None:
        self._rows = rows
        self.executes: list[tuple[str, tuple[Any, ...]]] = []

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> None:
        self.executes.append((query, params))

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._rows)

    def __iter__(self) -> Any:
        return iter(self._rows)


def _row(
    concept_id: int = 4193704,
    concept_name: str = "Glucose [Mass/volume] in Serum or Plasma",
    vocabulary_id: str = "LOINC",
    domain_id: str = "Measurement",
    standard_concept: str = "S",
    similarity: float = 0.91,
) -> tuple[Any, ...]:
    return (concept_id, concept_name, vocabulary_id, domain_id, standard_concept, similarity)


def _query_vec() -> list[float]:
    return [0.01 * (i % 7) for i in range(768)]


def test_search_returns_concept_candidates() -> None:
    cursor = _FakeCursor(rows=[_row(), _row(concept_id=2, similarity=0.85)])
    retriever = ConceptRetriever()
    out = retriever.search(cursor, _query_vec(), top_k=5)
    assert len(out) == 2
    assert isinstance(out[0], ConceptCandidate)
    assert out[0].concept_id == 4193704
    assert out[1].similarity == pytest.approx(0.85)


def test_search_clamps_similarity_to_unit_interval() -> None:
    """1 - distance can drift slightly outside [0, 1] on FP cosine; clamp it."""
    cursor = _FakeCursor(rows=[_row(similarity=1.0001), _row(similarity=-0.0001)])
    retriever = ConceptRetriever()
    out = retriever.search(cursor, _query_vec(), top_k=5)
    assert out[0].similarity == 1.0
    assert out[1].similarity == 0.0


def test_search_bind_params_pass_query_vector_twice() -> None:
    """Once for the SELECT distance projection, once for the ORDER BY."""
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    retriever.search(cursor, _query_vec(), top_k=5)
    _query, params = cursor.executes[0]
    # Params shape: (vec, domain, domain, vocab_array, vocab_array, vec, top_k)
    assert params[0] == params[5]  # vec literal repeated
    assert params[6] == 5  # top_k


def test_search_default_no_filters() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    retriever.search(cursor, _query_vec())
    _query, params = cursor.executes[0]
    assert params[1] is None  # domain_filter
    assert params[3] is None  # vocabulary_filter


def test_search_with_domain_filter() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    retriever.search(cursor, _query_vec(), domain_filter="Measurement")
    _query, params = cursor.executes[0]
    assert params[1] == "Measurement"
    assert params[2] == "Measurement"


def test_search_with_vocabulary_filter() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    retriever.search(cursor, _query_vec(), vocabulary_filter=["LOINC", "SNOMED"])
    _query, params = cursor.executes[0]
    assert params[3] == ["LOINC", "SNOMED"]
    assert params[4] == ["LOINC", "SNOMED"]


def test_search_uses_cosine_distance_operator() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    retriever.search(cursor, _query_vec())
    sql = cursor.executes[0][0]
    assert "embedding OPERATOR(public.<=>) %s::public.vector" in sql
    assert "1 - (e.embedding OPERATOR(public.<=>) %s::public.vector) AS similarity" in sql


def test_search_filters_to_standard_concepts_only() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    retriever.search(cursor, _query_vec())
    sql = cursor.executes[0][0]
    assert "c.standard_concept = 'S'" in sql
    assert "c.invalid_reason IS NULL" in sql


def test_search_top_k_default_is_50() -> None:
    """Plan: 'return top-50 candidates'."""
    assert ConceptRetriever.DEFAULT_TOP_K == 50


def test_search_rejects_invalid_top_k() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    with pytest.raises(ValueError):
        retriever.search(cursor, _query_vec(), top_k=0)
    with pytest.raises(ValueError):
        retriever.search(cursor, _query_vec(), top_k=-1)


def test_search_rejects_empty_query_embedding() -> None:
    cursor = _FakeCursor(rows=[])
    retriever = ConceptRetriever()
    with pytest.raises(ValueError):
        retriever.search(cursor, [])


def test_search_handles_null_standard_concept() -> None:
    """COALESCE(...,'') so a NULL standard_concept becomes '' not None."""
    cursor = _FakeCursor(rows=[_row(standard_concept="")])
    retriever = ConceptRetriever()
    out = retriever.search(cursor, _query_vec())
    assert out[0].standard_concept == ""
