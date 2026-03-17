"""Tests for ActionLogger — INSERT, SELECT, and rollback tracking."""
import pytest
from unittest.mock import MagicMock, call
from app.agency.action_logger import ActionLogger


def _mock_logger() -> tuple[ActionLogger, MagicMock]:
    """Return an ActionLogger backed by a mock engine and the mock connection."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    logger = ActionLogger(engine=mock_engine)
    return logger, mock_conn


class TestActionLogger:
    def test_log_action(self):
        """log_action executes an INSERT and returns the new row id."""
        al, mock_conn = _mock_logger()
        # fetchone returns the RETURNING id
        mock_conn.execute.return_value.fetchone.return_value = (42,)

        action_id = al.log_action(
            user_id=1,
            action_type="create",
            tool_name="create_concept_set",
            risk_level="low",
            parameters={"name": "Test Set"},
            result={"id": 99},
        )

        mock_conn.execute.assert_called_once()
        assert action_id == 42

    def test_log_action_with_checkpoint(self):
        """log_action includes checkpoint_data in the INSERT when provided."""
        al, mock_conn = _mock_logger()
        mock_conn.execute.return_value.fetchone.return_value = (7,)

        checkpoint = {"snapshot": {"concept_ids": [1, 2, 3]}}
        al.log_action(
            user_id=2,
            action_type="update",
            tool_name="update_cohort",
            risk_level="medium",
            parameters={"cohort_id": 5},
            result=None,
            checkpoint_data=checkpoint,
        )

        args = mock_conn.execute.call_args
        # The second positional argument is the params dict
        params = args[0][1]
        assert params["checkpoint_data"] is not None

    def test_get_recent_actions(self):
        """get_recent_actions returns a list of dicts from the DB rows."""
        al, mock_conn = _mock_logger()

        row1 = MagicMock()
        row1._mapping = {
            "id": 1, "user_id": 3, "action_type": "create",
            "tool_name": "create_concept_set", "risk_level": "low",
            "plan": None, "parameters": {}, "result": {}, "checkpoint_data": None,
            "rolled_back": False, "created_at": "2026-03-17T00:00:00",
        }
        row2 = MagicMock()
        row2._mapping = {
            "id": 2, "user_id": 3, "action_type": "delete",
            "tool_name": "delete_cohort", "risk_level": "high",
            "plan": None, "parameters": {}, "result": {}, "checkpoint_data": None,
            "rolled_back": True, "created_at": "2026-03-17T00:01:00",
        }
        mock_conn.execute.return_value.fetchall.return_value = [row1, row2]

        results = al.get_recent_actions(user_id=3, limit=10)

        mock_conn.execute.assert_called_once()
        assert isinstance(results, list)
        assert len(results) == 2
        assert results[0]["id"] == 1
        assert results[1]["rolled_back"] is True

    def test_mark_rolled_back(self):
        """mark_rolled_back executes an UPDATE setting rolled_back = TRUE."""
        al, mock_conn = _mock_logger()

        al.mark_rolled_back(action_id=42)

        mock_conn.execute.assert_called_once()
        # Verify the SQL contains 'rolled_back' and the param is the action id
        sql_arg = str(mock_conn.execute.call_args[0][0])
        params = mock_conn.execute.call_args[0][1]
        assert "rolled_back" in sql_arg.lower()
        assert params.get("action_id") == 42
