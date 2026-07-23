"""Regression tests for Ariadne's BGE/pgvector query construction."""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from app.routers.ariadne import _vector_search_sql


@contextmanager
def _mock_session(session: MagicMock):
    yield session


def test_filtered_vector_search_materializes_bounded_ann_candidates() -> None:
    session = MagicMock()
    session.execute.return_value.fetchall.return_value = []

    with patch(
        "app.routers.ariadne.get_session",
        return_value=_mock_session(session),
    ):
        results = _vector_search_sql(
            embedding_str="[0.1,0.2]",
            vocab_schema="vocab",
            target_vocabularies=["LOINC"],
            target_domains=["Measurement"],
            max_results=10,
        )

    assert results == []
    statement, params = session.execute.call_args.args
    sql = str(statement)
    assert "WITH nearest AS MATERIALIZED" in sql
    assert "LIMIT :candidate_lim" in sql
    assert "c.vocabulary_id IN (:vs_vocab_0)" in sql
    assert "c.domain_id IN (:vs_domain_0)" in sql
    assert params["candidate_lim"] == 500
    assert params["vs_vocab_0"] == "LOINC"
    assert params["vs_domain_0"] == "Measurement"


def test_unfiltered_vector_search_keeps_direct_ivfflat_limit() -> None:
    session = MagicMock()
    session.execute.return_value.fetchall.return_value = []

    with patch(
        "app.routers.ariadne.get_session",
        return_value=_mock_session(session),
    ):
        results = _vector_search_sql(
            embedding_str="[0.1,0.2]",
            vocab_schema="vocab",
            target_vocabularies=None,
            target_domains=None,
            max_results=5,
        )

    assert results == []
    statement, params = session.execute.call_args.args
    sql = str(statement)
    assert "WITH nearest AS MATERIALIZED" not in sql
    assert "ORDER BY ce.embedding <=> CAST(:emb AS vector)" in sql
    assert "candidate_lim" not in params
    assert params["lim"] == 5
