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
            provider="anthropic", transport="anthropic_messages",
            provider_profile_id="anthropic-claude", entitlement_type="org_api_key",
        )
        mock_conn.execute.assert_called_once()
        params = mock_conn.execute.call_args.args[1]
        assert params["provider"] == "anthropic"
        assert params["transport"] == "anthropic_messages"
        assert params["provider_profile_id"] == "anthropic-claude"
        assert params["entitlement_type"] == "org_api_key"
        assert params["request_surface"] == "abby_chat"
        assert params["status"] == "success"
        assert params["usage_metadata"] == "{}"

    def test_record_usage_accepts_openai_metadata(self):
        tracker, mock_conn = self._mock_tracker()
        tracker.record_usage(
            user_id=2, tokens_in=90, tokens_out=25,
            cost_usd=0.0, model="gpt-5.5", request_hash="openai123",
            redaction_count=1, route_reason="cloud_first",
            provider="openai", transport="openai_responses",
            provider_profile_id="openai-responses", entitlement_type="user_api_key",
            response_latency_ms=123.4,
            usage_metadata={"fallback_profile_ids": ["local-medgemma"]},
        )
        params = mock_conn.execute.call_args.args[1]
        assert params["provider"] == "openai"
        assert params["transport"] == "openai_responses"
        assert params["provider_profile_id"] == "openai-responses"
        assert params["entitlement_type"] == "user_api_key"
        assert params["response_latency_ms"] == 123.4
        assert '"local-medgemma"' in params["usage_metadata"]

    def test_record_route_decision_writes_zero_cost_provider_neutral_row(self):
        tracker, mock_conn = self._mock_tracker()
        tracker.record_route_decision(
            user_id=3,
            provider="ollama",
            transport="ollama_chat",
            provider_profile_id="local-medgemma",
            entitlement_type="local",
            model="medgemma:27b",
            route_reason="budget_exhausted",
            status="fallback_local",
            fallback_reason="budget_exhausted",
            requested_provider_profile_id="openai-responses",
            usage_metadata={"routing_strategy": "cloud_first"},
        )

        params = mock_conn.execute.call_args.args[1]
        assert params["tokens_in"] == 0
        assert params["tokens_out"] == 0
        assert params["cost_usd"] == 0.0
        assert params["provider"] == "ollama"
        assert params["transport"] == "ollama_chat"
        assert params["provider_profile_id"] == "local-medgemma"
        assert params["entitlement_type"] == "local"
        assert params["route_reason"] == "budget_exhausted"
        assert params["status"] == "fallback_local"
        assert params["fallback_reason"] == "budget_exhausted"
        assert '"requested_profile_id": "openai-responses"' in params["usage_metadata"]

    def test_get_monthly_spend(self):
        tracker, _ = self._mock_tracker(monthly_spend=125.50)
        spend = tracker.get_monthly_spend()
        assert spend == 125.50

    def test_get_monthly_spend_applies_scope_filters(self):
        tracker, mock_conn = self._mock_tracker(monthly_spend=12.34)
        spend = tracker.get_monthly_spend(
            provider="openai",
            provider_profile_id="openai-responses",
            request_surface="abby_chat",
        )
        params = mock_conn.execute.call_args.args[1]
        assert spend == 12.34
        assert params["provider"] == "openai"
        assert params["provider_profile_id"] == "openai-responses"
        assert params["request_surface"] == "abby_chat"

    def test_get_monthly_spend_applies_entitlement_and_department_scope(self):
        tracker, mock_conn = self._mock_tracker(monthly_spend=7.50)
        spend = tracker.get_monthly_spend(
            entitlement_type="user_api_key",
            department="cardiology",
        )
        sql = mock_conn.execute.call_args.args[0].text
        params = mock_conn.execute.call_args.args[1]
        assert spend == 7.50
        assert "entitlement_type = :entitlement_type" in sql
        assert "department = :department" in sql
        assert params["entitlement_type"] == "user_api_key"
        assert params["department"] == "cardiology"

    def test_is_budget_exhausted_uses_entitlement_scope(self):
        tracker, mock_conn = self._mock_tracker(monthly_spend=96.0)
        assert tracker.is_budget_exhausted(
            monthly_budget=100.0,
            entitlement_type="acumenus_managed_api",
        ) is True
        params = mock_conn.execute.call_args.args[1]
        assert params["entitlement_type"] == "acumenus_managed_api"

    def test_is_budget_exhausted_under_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=100.0)
        assert tracker.is_budget_exhausted() is False

    def test_is_budget_exhausted_over_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=480.0)
        assert tracker.is_budget_exhausted() is True

    def test_is_budget_exhausted_uses_scoped_budget_override(self):
        tracker, mock_conn = self._mock_tracker(monthly_spend=96.0)
        assert tracker.is_budget_exhausted(
            monthly_budget=100.0,
            provider="openai",
            provider_profile_id="openai-responses",
            request_surface="abby_chat",
        ) is True
        params = mock_conn.execute.call_args.args[1]
        assert params["provider"] == "openai"
        assert params["provider_profile_id"] == "openai-responses"

    def test_should_alert_at_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=410.0)
        assert tracker.should_alert() is True

    def test_no_alert_under_threshold(self):
        tracker, _ = self._mock_tracker(monthly_spend=100.0)
        assert tracker.should_alert() is False
