"""Cost Tracker — budget enforcement and circuit breaker for cloud LLM usage.

Records every Claude API call to ``app.abby_cloud_usage``, enforces a monthly
USD budget, and exposes alert / circuit-breaker helpers used by the routing
pipeline to decide whether cloud calls are permitted.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from sqlalchemy import text

logger = logging.getLogger(__name__)


class CostTracker:
    """Track cloud LLM spending and enforce budget limits.

    Parameters
    ----------
    engine:
        SQLAlchemy engine (or any object that supports ``engine.connect()``
        as a context manager returning a connection with ``.execute()``).
    monthly_budget:
        Maximum USD spend allowed per calendar month.
    alert_threshold:
        Fraction of *monthly_budget* at which a single-threshold alert fires
        (used when *alert_thresholds* is not given explicitly).
    cutoff_threshold:
        Fraction of *monthly_budget* at which :meth:`is_budget_exhausted`
        returns ``True`` and cloud calls are blocked.
    alert_thresholds:
        Explicit list of fractional thresholds for multi-level alerting.
        If omitted, defaults to ``[alert_threshold]``.
    """

    def __init__(
        self,
        *,
        engine: Any,
        monthly_budget: float,
        alert_threshold: float = 0.80,
        cutoff_threshold: float = 0.95,
        alert_thresholds: Optional[list[float]] = None,
    ) -> None:
        self._engine = engine
        self.monthly_budget = monthly_budget
        self.cutoff_threshold = cutoff_threshold
        self.alert_thresholds: list[float] = (
            alert_thresholds if alert_thresholds is not None else [alert_threshold]
        )

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def record_usage(
        self,
        *,
        user_id: Optional[int],
        tokens_in: int,
        tokens_out: int,
        cost_usd: float,
        model: str,
        request_hash: str,
        redaction_count: int = 0,
        route_reason: str = "",
        department: Optional[str] = None,
    ) -> None:
        """INSERT a usage row into ``app.abby_cloud_usage``.

        All parameters are stored verbatim; no aggregation is performed here.
        """
        try:
            with self._engine.connect() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO app.abby_cloud_usage
                            (user_id, department, tokens_in, tokens_out,
                             cost_usd, model, request_hash,
                             sanitizer_redaction_count, route_reason)
                        VALUES
                            (:user_id, :department, :tokens_in, :tokens_out,
                             :cost_usd, :model, :request_hash,
                             :redaction_count, :route_reason)
                        """
                    ),
                    {
                        "user_id": user_id,
                        "department": department,
                        "tokens_in": tokens_in,
                        "tokens_out": tokens_out,
                        "cost_usd": cost_usd,
                        "model": model,
                        "request_hash": request_hash,
                        "redaction_count": redaction_count,
                        "route_reason": route_reason,
                    },
                )
        except Exception:
            logger.exception(
                "Failed to record cloud usage: model=%s tokens_in=%d tokens_out=%d",
                model,
                tokens_in,
                tokens_out,
            )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_monthly_spend(self) -> float:
        """Return total USD spent in the current calendar month.

        Queries ``SUM(cost_usd)`` from ``app.abby_cloud_usage`` where
        ``created_at >= first day of the current month``.

        Returns 0.0 on any database error (fail-open for read queries).
        """
        try:
            first_of_month = date.today().replace(day=1).isoformat()
            with self._engine.connect() as conn:
                row = conn.execute(
                    text(
                        """
                        SELECT COALESCE(SUM(cost_usd), 0)
                        FROM app.abby_cloud_usage
                        WHERE created_at >= :first_of_month
                        """
                    ),
                    {"first_of_month": first_of_month},
                ).fetchone()
            return float(row[0]) if row else 0.0
        except Exception:
            logger.exception("Failed to query monthly spend; returning 0.0")
            return 0.0

    # ------------------------------------------------------------------
    # Circuit-breaker helpers
    # ------------------------------------------------------------------

    def is_budget_exhausted(self) -> bool:
        """Return ``True`` when spend has reached or exceeded the cutoff threshold.

        When this returns ``True``, the routing pipeline should direct all
        requests to the local model regardless of routing score.
        """
        spend = self.get_monthly_spend()
        return spend >= self.monthly_budget * self.cutoff_threshold

    def should_alert(self) -> bool:
        """Return ``True`` if any alert threshold has been crossed."""
        return bool(self.get_triggered_alerts())

    def get_triggered_alerts(self) -> list[float]:
        """Return the list of alert thresholds that have been crossed."""
        spend = self.get_monthly_spend()
        return [t for t in self.alert_thresholds if spend >= self.monthly_budget * t]

    def get_budget_status(self) -> dict[str, Any]:
        """Return a summary dict suitable for health-check or admin endpoints."""
        spend = self.get_monthly_spend()
        utilization = spend / self.monthly_budget if self.monthly_budget > 0 else 0.0
        return {
            "monthly_budget_usd": self.monthly_budget,
            "monthly_spend_usd": round(spend, 6),
            "remaining_usd": round(max(0.0, self.monthly_budget - spend), 6),
            "utilization_pct": round(utilization * 100, 2),
            "budget_exhausted": self.is_budget_exhausted(),
            "alert_triggered": self.should_alert(),
            "triggered_thresholds": self.get_triggered_alerts(),
        }
