"""Tests for KnowledgeCapture — artifact creation, correction/finding recording, and similarity search."""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, call, patch

from app.institutional.knowledge_capture import KnowledgeArtifact, KnowledgeCapture


def _mock_capture(with_embedder: bool = False) -> tuple[KnowledgeCapture, MagicMock]:
    """Return a KnowledgeCapture backed by a mock engine and the mock connection."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    embedder = MagicMock() if with_embedder else None
    capture = KnowledgeCapture(engine=mock_engine, embedder=embedder)
    return capture, mock_conn


class TestKnowledgeCapture:
    def test_capture_cohort_creation_returns_cohort_pattern_artifact(self):
        """capture_cohort_creation returns an artifact with type 'cohort_pattern'."""
        kc, mock_conn = _mock_capture()
        mock_conn.execute.return_value.fetchone.return_value = (1,)

        artifact = kc.capture_cohort_creation(
            user_id=1,
            cohort_name="Diabetes T2 Patients",
            disease_area="endocrinology",
            cohort_data={"concept_ids": [201820], "inclusion_rules": []},
        )

        assert artifact.artifact_type == "cohort_pattern"
        mock_conn.execute.assert_called_once()

    def test_capture_analysis_completion_returns_analysis_config_artifact(self):
        """capture_analysis_completion returns an artifact with type 'analysis_config'."""
        kc, mock_conn = _mock_capture()
        mock_conn.execute.return_value.fetchone.return_value = (2,)

        artifact = kc.capture_analysis_completion(
            user_id=1,
            analysis_name="PSM Atrial Fibrillation",
            study_design="cohort",
            disease_area="cardiology",
            analysis_data={"target_id": 101, "comparator_id": 202, "outcome_id": 303},
        )

        assert artifact.artifact_type == "analysis_config"
        mock_conn.execute.assert_called_once()

    def test_capture_correction_inserts_into_abby_corrections(self):
        """capture_correction executes an INSERT into app.abby_corrections."""
        kc, mock_conn = _mock_capture()
        mock_conn.execute.return_value.fetchone.return_value = (10,)

        correction_id = kc.capture_correction(
            user_id=5,
            original_response="The incidence was 5%",
            correction="The incidence was 15%",
            context={"conversation_id": 42, "turn": 3},
        )

        mock_conn.execute.assert_called_once()
        sql_arg = str(mock_conn.execute.call_args[0][0])
        assert "abby_corrections" in sql_arg
        assert correction_id == 10

    def test_capture_data_finding_inserts_into_abby_data_findings(self):
        """capture_data_finding executes an INSERT into app.abby_data_findings."""
        kc, mock_conn = _mock_capture()
        mock_conn.execute.return_value.fetchone.return_value = (20,)

        finding_id = kc.capture_data_finding(
            discovered_by=3,
            affected_domain="condition_occurrence",
            affected_tables=["cdm.condition_occurrence"],
            finding_summary="Missing ICD-10 codes for post-2020 encounters",
            severity="warning",
            workaround="Use SNOMED concepts instead",
        )

        mock_conn.execute.assert_called_once()
        sql_arg = str(mock_conn.execute.call_args[0][0])
        assert "abby_data_findings" in sql_arg
        assert finding_id == 20

    def test_search_similar_returns_list_of_matching_artifacts(self):
        """search_similar returns a list of dicts from the DB rows."""
        kc, mock_conn = _mock_capture(with_embedder=True)
        kc._embedder.encode.return_value = [0.1] * 384

        row1 = MagicMock()
        row1._mapping = {
            "id": 1,
            "type": "cohort_pattern",
            "title": "Diabetes cohort",
            "summary": "T2DM patients",
            "tags": ["diabetes"],
            "disease_area": "endocrinology",
            "study_design": None,
            "artifact_data": {},
            "usage_count": 5,
            "accuracy_score": None,
            "status": "active",
            "created_at": "2026-03-17T00:00:00",
        }
        row2 = MagicMock()
        row2._mapping = {
            "id": 2,
            "type": "analysis_config",
            "title": "Diabetes analysis",
            "summary": "PSM analysis",
            "tags": ["diabetes", "psm"],
            "disease_area": "endocrinology",
            "study_design": "cohort",
            "artifact_data": {},
            "usage_count": 2,
            "accuracy_score": 0.95,
            "status": "active",
            "created_at": "2026-03-17T00:01:00",
        }
        mock_conn.execute.return_value.fetchall.return_value = [row1, row2]

        results = kc.search_similar("diabetes cohort analysis", limit=5)

        mock_conn.execute.assert_called_once()
        assert isinstance(results, list)
        assert len(results) == 2
        assert results[0]["type"] == "cohort_pattern"
        assert results[1]["accuracy_score"] == 0.95

    def test_increment_usage_calls_update(self):
        """increment_usage executes an UPDATE on app.abby_knowledge_artifacts."""
        kc, mock_conn = _mock_capture()

        kc.increment_usage(artifact_id=7)

        mock_conn.execute.assert_called_once()
        sql_arg = str(mock_conn.execute.call_args[0][0])
        params = mock_conn.execute.call_args[0][1]
        assert "usage_count" in sql_arg.lower()
        assert params.get("artifact_id") == 7
