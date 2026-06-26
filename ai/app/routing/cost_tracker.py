"""Cost Tracker — budget enforcement and circuit breaker for cloud LLM usage.

Records cloud provider calls to ``app.abby_cloud_usage``, enforces a monthly USD
budget, and exposes alert / circuit-breaker helpers used by the routing pipeline
to decide whether cloud calls are permitted.
"""
from __future__ import annotations

import json
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
        provider: str = "anthropic",
        transport: str = "anthropic_messages",
        provider_profile_id: str = "anthropic-claude",
        entitlement_type: str = "org_api_key",
        request_surface: str = "abby_chat",
        status: str = "success",
        error_class: Optional[str] = None,
        fallback_reason: Optional[str] = None,
        response_latency_ms: Optional[float] = None,
        usage_metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """INSERT a provider-neutral usage row into ``app.abby_cloud_usage``.

        All parameters are stored verbatim; no aggregation is performed here.
        """
        metadata_json = json.dumps(usage_metadata or {})
        try:
            with self._engine.connect() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO app.abby_cloud_usage
                            (user_id, department, tokens_in, tokens_out,
                             cost_usd, model, request_hash,
                             sanitizer_redaction_count, route_reason,
                             provider, transport, provider_profile_id,
                             entitlement_type, request_surface, status,
                             error_class, fallback_reason, response_latency_ms,
                             usage_metadata)
                        VALUES
                            (:user_id, :department, :tokens_in, :tokens_out,
                             :cost_usd, :model, :request_hash,
                             :redaction_count, :route_reason,
                             :provider, :transport, :provider_profile_id,
                             :entitlement_type, :request_surface, :status,
                             :error_class, :fallback_reason, :response_latency_ms,
                             CAST(:usage_metadata AS jsonb))
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
                        "provider": provider,
                        "transport": transport,
                        "provider_profile_id": provider_profile_id,
                        "entitlement_type": entitlement_type,
                        "request_surface": request_surface,
                        "status": status,
                        "error_class": error_class,
                        "fallback_reason": fallback_reason,
                        "response_latency_ms": response_latency_ms,
                        "usage_metadata": metadata_json,
                    },
                )
                conn.commit()
        except Exception:
            logger.exception(
                "Failed to record cloud usage: provider=%s model=%s tokens_in=%d tokens_out=%d",
                provider,
                model,
                tokens_in,
                tokens_out,
            )

    def record_route_decision(
        self,
        *,
        user_id: Optional[int],
        provider: str,
        transport: str,
        provider_profile_id: str,
        entitlement_type: str,
        model: str,
        route_reason: str,
        status: str,
        fallback_reason: Optional[str] = None,
        requested_provider_profile_id: Optional[str] = None,
        request_surface: str = "abby_chat",
        usage_metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """Record a zero-cost Abby routing decision when no cloud API call occurs."""
        metadata = dict(usage_metadata or {})
        if requested_provider_profile_id is not None:
            metadata["requested_profile_id"] = requested_provider_profile_id
        self.record_usage(
            user_id=user_id,
            tokens_in=0,
            tokens_out=0,
            cost_usd=0.0,
            model=model,
            request_hash="",
            redaction_count=0,
            route_reason=route_reason,
            provider=provider,
            transport=transport,
            provider_profile_id=provider_profile_id,
            entitlement_type=entitlement_type,
            request_surface=request_surface,
            status=status,
            fallback_reason=fallback_reason,
            usage_metadata=metadata,
        )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_monthly_spend(
        self,
        *,
        provider: Optional[str] = None,
        provider_profile_id: Optional[str] = None,
        request_surface: Optional[str] = None,
        entitlement_type: Optional[str] = None,
        department: Optional[str] = None,
    ) -> float:
        """Return total USD spent in the current calendar month.

        Queries ``SUM(cost_usd)`` from ``app.abby_cloud_usage`` where
        ``created_at >= first day of the current month``. Optional provider,
        profile, surface, entitlement, and department filters narrow the scope
        for per-provider, per-profile, per-entitlement, and per-department
        (chargeback) budget caps.

        Returns 0.0 on any database error (fail-open for read queries).
        """
        try:
            first_of_month = date.today().replace(day=1).isoformat()
            conditions = ["created_at >= :first_of_month"]
            params: dict[str, Any] = {"first_of_month": first_of_month}
            if provider:
                conditions.append("provider = :provider")
                params["provider"] = provider
            if provider_profile_id:
                conditions.append("provider_profile_id = :provider_profile_id")
                params["provider_profile_id"] = provider_profile_id
            if request_surface:
                conditions.append("request_surface = :request_surface")
                params["request_surface"] = request_surface
            if entitlement_type:
                conditions.append("entitlement_type = :entitlement_type")
                params["entitlement_type"] = entitlement_type
            if department:
                conditions.append("department = :department")
                params["department"] = department
            where_clause = " AND ".join(conditions)
            with self._engine.connect() as conn:
                row = conn.execute(
                    text(
                        f"""
                        SELECT COALESCE(SUM(cost_usd), 0)
                        FROM app.abby_cloud_usage
                        WHERE {where_clause}
                        """
                    ),
                    params,
                ).fetchone()
            return float(row[0]) if row else 0.0
        except Exception:
            logger.exception("Failed to query monthly spend; returning 0.0")
            return 0.0

    # ------------------------------------------------------------------
    # Circuit-breaker helpers
    # ------------------------------------------------------------------

    def is_budget_exhausted(
        self,
        *,
        monthly_budget: Optional[float] = None,
        provider: Optional[str] = None,
        provider_profile_id: Optional[str] = None,
        request_surface: Optional[str] = None,
        entitlement_type: Optional[str] = None,
        department: Optional[str] = None,
    ) -> bool:
        """Return ``True`` when spend has reached or exceeded the cutoff threshold.

        When this returns ``True``, the routing pipeline should direct all
        requests to the local model regardless of routing score.
        """
        budget = self.monthly_budget if monthly_budget is None else float(monthly_budget)
        if budget <= 0:
            return False
        spend = self.get_monthly_spend(
            provider=provider,
            provider_profile_id=provider_profile_id,
            request_surface=request_surface,
            entitlement_type=entitlement_type,
            department=department,
        )
        return spend >= budget * self.cutoff_threshold

    def should_alert(
        self,
        *,
        monthly_budget: Optional[float] = None,
        provider: Optional[str] = None,
        provider_profile_id: Optional[str] = None,
        request_surface: Optional[str] = None,
        entitlement_type: Optional[str] = None,
        department: Optional[str] = None,
    ) -> bool:
        """Return ``True`` if any alert threshold has been crossed."""
        return bool(self.get_triggered_alerts(
            monthly_budget=monthly_budget,
            provider=provider,
            provider_profile_id=provider_profile_id,
            request_surface=request_surface,
            entitlement_type=entitlement_type,
            department=department,
        ))

    def get_triggered_alerts(
        self,
        *,
        monthly_budget: Optional[float] = None,
        provider: Optional[str] = None,
        provider_profile_id: Optional[str] = None,
        request_surface: Optional[str] = None,
        entitlement_type: Optional[str] = None,
        department: Optional[str] = None,
    ) -> list[float]:
        """Return the list of alert thresholds that have been crossed."""
        budget = self.monthly_budget if monthly_budget is None else float(monthly_budget)
        if budget <= 0:
            return []
        spend = self.get_monthly_spend(
            provider=provider,
            provider_profile_id=provider_profile_id,
            request_surface=request_surface,
            entitlement_type=entitlement_type,
            department=department,
        )
        return [t for t in self.alert_thresholds if spend >= budget * t]

    def get_budget_status(
        self,
        *,
        monthly_budget: Optional[float] = None,
        provider: Optional[str] = None,
        provider_profile_id: Optional[str] = None,
        request_surface: Optional[str] = None,
        entitlement_type: Optional[str] = None,
        department: Optional[str] = None,
    ) -> dict[str, Any]:
        """Return a summary dict suitable for health-check or admin endpoints."""
        budget = self.monthly_budget if monthly_budget is None else float(monthly_budget)
        spend = self.get_monthly_spend(
            provider=provider,
            provider_profile_id=provider_profile_id,
            request_surface=request_surface,
            entitlement_type=entitlement_type,
            department=department,
        )
        utilization = spend / budget if budget > 0 else 0.0
        return {
            "scope": {
                "provider": provider,
                "provider_profile_id": provider_profile_id,
                "request_surface": request_surface,
                "entitlement_type": entitlement_type,
                "department": department,
            },
            "monthly_budget_usd": budget,
            "monthly_spend_usd": round(spend, 6),
            "remaining_usd": round(max(0.0, budget - spend), 6),
            "utilization_pct": round(utilization * 100, 2),
            "budget_exhausted": self.is_budget_exhausted(
                monthly_budget=budget,
                provider=provider,
                provider_profile_id=provider_profile_id,
                request_surface=request_surface,
                entitlement_type=entitlement_type,
                department=department,
            ),
            "alert_triggered": self.should_alert(
                monthly_budget=budget,
                provider=provider,
                provider_profile_id=provider_profile_id,
                request_surface=request_surface,
                entitlement_type=entitlement_type,
                department=department,
            ),
            "triggered_thresholds": self.get_triggered_alerts(
                monthly_budget=budget,
                provider=provider,
                provider_profile_id=provider_profile_id,
                request_surface=request_surface,
                entitlement_type=entitlement_type,
                department=department,
            ),
        }

    # ------------------------------------------------------------------
    # Router calibration feedback loop
    # ------------------------------------------------------------------

    def get_routing_labels(self, limit: int = 500) -> list[dict]:
        """Get labeled routing decisions from feedback data for classifier training."""
        try:
            with self._engine.connect() as conn:
                rows = conn.execute(
                    text("""
                        SELECT
                            m_user.content AS message,
                            m_asst.metadata->>'model' AS routed_model,
                            m_asst.metadata->>'reason' AS route_reason,
                            f.rating,
                            f.category
                        FROM app.abby_feedback f
                        JOIN app.abby_messages m_asst ON m_asst.id = f.message_id
                        JOIN app.abby_messages m_user ON m_user.conversation_id = m_asst.conversation_id
                            AND m_user.role = 'user'
                            AND m_user.created_at < m_asst.created_at
                        WHERE m_asst.metadata->>'model' IS NOT NULL
                        ORDER BY f.created_at DESC
                        LIMIT :limit
                    """),
                    {"limit": limit},
                ).fetchall()
                return [
                    {"message": row[0], "routed_model": row[1], "route_reason": row[2],
                     "rating": row[3], "category": row[4]}
                    for row in rows
                ]
        except Exception:
            logger.exception("Failed to get routing labels")
            return []

    def get_routing_label_count(self) -> int:
        """Count available labeled routing decisions. Classifier training threshold: 500+."""
        try:
            with self._engine.connect() as conn:
                row = conn.execute(
                    text("""
                        SELECT COUNT(*)
                        FROM app.abby_feedback f
                        JOIN app.abby_messages m ON m.id = f.message_id
                        WHERE m.metadata->>'model' IS NOT NULL
                    """),
                ).fetchone()
                return int(row[0]) if row else 0
        except Exception:
            logger.exception("Failed to count routing labels")
            return 0
