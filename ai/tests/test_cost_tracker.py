"""Tests for cost tracker — budget enforcement and circuit breaker."""
import pytest
from unittest.mock import MagicMock
from app.routing.cost_tracker import CostTracker


class TestCostTracker:
    def _mock_tracker(self, monthly_spend=0.0, monthly_budget=500.0,
                       alert_threshold=0.80, cutoff_threshold=0.95):
        mock_engine = MagicMock()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = (monthly_spend,)
        return CostTracker(
            engine=mock_engine, monthly_budget=monthly_budget,
            alert_threshold=alert_threshold, cutoff_threshold=cutoff_threshold,
        ), mock_conn

    def test_record_usage(self):
        tracker, mock_conn = self._mock_tracker()
        tracker.record_usage(
            user_id=1, tokens_in=1000, tokens_out=500,
            cost_usd=0.0105, model="claude-sonnet-4-20250514",
            request_hash="abc123", redaction_count=0, route_reason="action_word",
        )
        mock_conn.execute.assert_called_once()

    def test_get_monthly_spend(self):
        tracker, _ = self._mock_tracker(monthly_spend=125.50)
        spend = tracker.get_monthly_spend()
        assert spend == 125.50

    def test_is_budget_exhausted_under_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=100.0)
        assert tracker.is_budget_exhausted() is False

    def test_is_budget_exhausted_over_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=480.0)
        assert tracker.is_budget_exhausted() is True

    def test_should_alert_at_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=410.0)
        assert tracker.should_alert() is True

    def test_no_alert_under_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=100.0)
        assert tracker.should_alert() is False
