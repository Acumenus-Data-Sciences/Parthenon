"""
Abby AI router — cohort parsing and page-aware conversational assistant.

Abby uses MedGemma (via Ollama) as the reasoning backbone:
  - /abby/parse-cohort  → NL description → structured cohort spec JSON
  - /abby/chat          → page-aware conversational Q&A

The cohort spec JSON is designed to be consumed by the Laravel backend,
which resolves concepts via SapBERT and assembles the final CohortExpression.
"""

import json
import logging
import os
import re
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any, AsyncGenerator, Callable, cast

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

from app.chroma.memory import store_conversation_turn
from app.chroma.retrieval import (
    build_rag_context,
    get_ranked_rag_results,
    query_docs,
    query_user_conversations,
)
from app.config import settings
from app.memory.context_assembler import ContextAssembler, ContextPiece, ContextTier
from app.memory.intent_stack import IntentStack
from app.memory.scratch_pad import ScratchPad
from app.memory.profile_learner import ProfileLearner, UserProfile as MemoryUserProfile
from app.routing.rule_router import RuleRouter, RoutingDecision
from app.routing.claude_client import ClaudeClient
from app.routing.phi_sanitizer import PHISanitizer
from app.routing.cloud_safety import POLICY_VERSION as CLOUD_SAFETY_POLICY_VERSION
from app.routing.cloud_safety import CloudSafetyFilter
from app.routing.cost_tracker import CostTracker
from app.routing.chat_adapters import (
    AnthropicMessagesAdapter,
    ChatAdapterError,
    ChatAdapterRequest,
    OllamaChatAdapter,
    OpenAICompatibleChatAdapter,
    OpenAIResponsesAdapter,
)
from app.routing.provider_profiles import (
    CAPABILITY_FLAGS,
    ENTITLEMENT_TYPES,
    ROUTING_STRATEGIES,
    TRANSPORTS,
    AbbyRouteDecision,
    build_default_provider_profiles,
    decide_abby_chat_route,
    force_local_abby_route,
    resolve_abby_chat_policy,
)

from app.agency.plan_engine import PlanEngine, PlanStep, ActionPlan
from app.agency.api_client import AgencyApiClient
from app.agency.action_logger import ActionLogger
from app.agency.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Agency plan engine (lazy-init) ───────────────────────────────────────────

_plan_engine: PlanEngine | None = None


def _get_plan_engine() -> PlanEngine:
    global _plan_engine
    if _plan_engine is None:
        from sqlalchemy import create_engine
        engine = create_engine(settings.database_url)
        _plan_engine = PlanEngine(
            action_logger=ActionLogger(engine=engine),
            api_client=AgencyApiClient(),
            db_engine=engine,
        )
    return _plan_engine


# ── Session-scoped working memory (in-memory, cleared on service restart) ────

_session_state: dict[int, dict] = {}
_SESSION_MAX_SIZE = 1000

# ── Phase 2: Routing components ──────────────────────────────────────────────

_router = RuleRouter()
_phi_sanitizer = PHISanitizer(use_ner=True)
_cloud_safety = CloudSafetyFilter()
_claude_client: ClaudeClient | None = None
_cost_tracker: CostTracker | None = None
_shared_engine: Any | None = None
_shared_redis: Any | None = None
_dq_profile_service: Any | None = None
_knowledge_surfacer: Any | None = None
_ollama_http_client: httpx.AsyncClient | None = None


_OPENAI_COMPATIBLE_BASE_URLS: dict[str, str] = {
    "deepseek": "https://api.deepseek.com",
    "mistral": "https://api.mistral.ai/v1",
    "moonshot": "https://api.moonshot.cn/v1",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
}


def _get_claude_client() -> ClaudeClient | None:
    global _claude_client
    if _claude_client is None and settings.claude_api_key:
        try:
            _claude_client = ClaudeClient(api_key=settings.claude_api_key)
        except (ValueError, RuntimeError):
            logger.warning("Claude API unavailable (anthropic package not installed or key missing), cloud routing disabled")
    return _claude_client


def _settings_dict() -> dict[str, Any]:
    if hasattr(settings, "model_dump"):
        data = cast(dict[str, Any], settings.model_dump())
    else:
        data = dict(settings.__dict__)
    data["abby_llm_base_url"] = settings.abby_llm_base_url
    data["abby_llm_model"] = settings.abby_llm_model
    return data


def _coerce_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _coerce_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _effective_chat_config(provider_policy: dict[str, Any] | None) -> Any:
    """Apply a per-request admin provider override on top of env settings."""
    if not isinstance(provider_policy, dict):
        return settings

    provider_type = str(provider_policy.get("provider_type", "")).strip().lower()
    provider_settings = provider_policy.get("settings") if isinstance(provider_policy.get("settings"), dict) else {}
    profile_id = str(provider_policy.get("profile_id", "")).strip()
    mode = str(provider_policy.get("mode", "")).strip()
    model = str(provider_policy.get("model", "")).strip()
    if not provider_type:
        return settings

    config = _settings_dict()
    if mode:
        config["abby_chat_provider_mode"] = mode

    entitlement = str(provider_settings.get("entitlement", "") or provider_policy.get("entitlement", "") or "")
    if entitlement:
        config["abby_cloud_entitlement"] = entitlement

    timeout = _coerce_int(provider_settings.get("timeout"), config.get("openai_timeout", 60))
    max_tokens = _coerce_int(provider_settings.get("max_output_tokens"), config.get("openai_max_output_tokens", 4096))
    monthly_budget = _coerce_float(provider_settings.get("monthly_budget_usd"), 0.0)

    if provider_type == "ollama":
        config["abby_chat_provider_mode"] = mode or "local_only"
        config["abby_cloud_routing_enabled"] = False
        if profile_id:
            config["abby_local_chat_profile_id"] = profile_id
        if model:
            config["abby_llm_model"] = model
            config["abby_ollama_model"] = model
        if provider_settings.get("base_url"):
            base_url = str(provider_settings["base_url"]).rstrip("/")
            config["abby_llm_base_url"] = base_url
            config["abby_ollama_base_url"] = base_url
        if provider_settings.get("timeout") is not None:
            config["ollama_timeout"] = _coerce_int(provider_settings.get("timeout"), config.get("ollama_timeout", 120))
        if provider_settings.get("max_output_tokens") is not None:
            config["ollama_num_predict"] = _coerce_int(
                provider_settings.get("max_output_tokens"),
                config.get("ollama_num_predict", 256),
            )
        return SimpleNamespace(**config)

    if provider_type == "anthropic":
        config["abby_cloud_routing_enabled"] = True
        config["abby_chat_provider_mode"] = mode or "cloud_first"
        config["abby_cloud_chat_profile_id"] = profile_id or "anthropic-claude"
        config["anthropic_profile_id"] = profile_id or "anthropic-claude"
        if model:
            config["claude_model"] = model
        config["claude_api_key"] = str(provider_settings.get("api_key", ""))
        config["claude_timeout"] = timeout
        config["claude_max_tokens"] = max_tokens
        config["anthropic_monthly_budget_usd"] = monthly_budget
        return SimpleNamespace(**config)

    if provider_type == "openai":
        config["abby_cloud_routing_enabled"] = True
        config["abby_chat_provider_mode"] = mode or "cloud_first"
        config["abby_cloud_chat_profile_id"] = profile_id or "openai-responses"
        config["openai_profile_id"] = profile_id or "openai-responses"
        if model:
            config["openai_model"] = model
        config["openai_api_key"] = str(provider_settings.get("api_key", ""))
        config["openai_base_url"] = str(provider_settings.get("base_url", "") or "")
        config["openai_timeout"] = timeout
        config["openai_max_output_tokens"] = max_tokens
        config["openai_monthly_budget_usd"] = monthly_budget
        return SimpleNamespace(**config)

    if provider_type in _OPENAI_COMPATIBLE_BASE_URLS:
        config["abby_cloud_routing_enabled"] = True
        config["abby_chat_provider_mode"] = mode or "cloud_first"
        config["abby_cloud_chat_profile_id"] = profile_id or "openai-compatible-chat"
        config["openai_compatible_profile_id"] = profile_id or "openai-compatible-chat"
        if model:
            config["openai_compatible_model"] = model
        config["openai_compatible_api_key"] = str(provider_settings.get("api_key", ""))
        config["openai_compatible_base_url"] = str(
            provider_settings.get("base_url", "") or _OPENAI_COMPATIBLE_BASE_URLS[provider_type]
        ).rstrip("/")
        config["openai_compatible_timeout"] = timeout
        config["openai_compatible_max_output_tokens"] = max_tokens
        config["openai_compatible_monthly_budget_usd"] = monthly_budget
        return SimpleNamespace(**config)

    config["abby_chat_provider_mode"] = "local_only"
    config["abby_cloud_routing_enabled"] = False
    return SimpleNamespace(**config)


def _selected_cloud_profile(config: Any = settings) -> Any:
    profiles = build_default_provider_profiles(config)
    profile_id = getattr(config, "abby_cloud_chat_profile_id", "anthropic-claude")
    profile = profiles.get(profile_id) or profiles.get("anthropic-claude")
    if profile is not None:
        return profile
    return next(profile for profile in profiles.values() if profile.is_cloud)


def _cloud_chat_available(config: Any = settings) -> bool:
    profile = _selected_cloud_profile(config)
    if profile.transport == "anthropic_messages":
        return bool(getattr(config, "claude_api_key", ""))
    if profile.transport == "openai_responses":
        return bool(getattr(config, "openai_api_key", ""))
    if profile.transport == "openai_compatible_chat":
        return bool(
            getattr(config, "openai_compatible_api_key", "")
            and getattr(config, "openai_compatible_base_url", "")
        )
    return False


def _build_cloud_chat_adapter(profile: Any, config: Any = settings) -> Any:
    if profile.transport == "anthropic_messages":
        if config is settings:
            claude_client = _get_claude_client()
        else:
            claude_client = ClaudeClient(
                api_key=getattr(config, "claude_api_key", ""),
                model=getattr(config, "claude_model", settings.claude_model),
                max_tokens=getattr(config, "claude_max_tokens", settings.claude_max_tokens),
                timeout=getattr(config, "claude_timeout", settings.claude_timeout),
            )
        if claude_client is None:
            raise ChatAdapterError(
                "Anthropic client is not configured",
                error_class="provider_unavailable",
                status_code=503,
            )
        return AnthropicMessagesAdapter(profile=profile, client=claude_client)
    if profile.transport == "openai_responses":
        return OpenAIResponsesAdapter(
            profile=profile,
            api_key=getattr(config, "openai_api_key", ""),
            base_url=getattr(config, "openai_base_url", "") or None,
            timeout_seconds=getattr(config, "openai_timeout", settings.openai_timeout),
            max_output_tokens=getattr(config, "openai_max_output_tokens", settings.openai_max_output_tokens),
        )
    if profile.transport == "openai_compatible_chat":
        return OpenAICompatibleChatAdapter(
            profile=profile,
            api_key=getattr(config, "openai_compatible_api_key", ""),
            base_url=getattr(config, "openai_compatible_base_url", ""),
            timeout_seconds=getattr(config, "openai_compatible_timeout", settings.openai_compatible_timeout),
            max_output_tokens=getattr(
                config,
                "openai_compatible_max_output_tokens",
                settings.openai_compatible_max_output_tokens,
            ),
        )
    raise ChatAdapterError(
        f"Unsupported cloud transport: {profile.transport}",
        error_class="unsupported_transport",
        status_code=503,
    )


def _get_cost_tracker() -> CostTracker:
    global _cost_tracker
    if _cost_tracker is None:
        from sqlalchemy import create_engine
        engine = create_engine(settings.database_url)
        _cost_tracker = CostTracker(
            engine=engine,
            monthly_budget=settings.cloud_monthly_budget_usd,
            cutoff_threshold=settings.cloud_budget_cutoff_threshold,
            alert_thresholds=settings.cloud_budget_alert_thresholds,
        )
    return _cost_tracker


def _profile_monthly_budget(profile: Any) -> float:
    return _coerce_float(profile.limits.get("monthly_budget_usd") if hasattr(profile, "limits") else None, 0.0)


def _cloud_budget_exhausted(config: Any = settings) -> bool:
    tracker = _get_cost_tracker()
    if tracker.is_budget_exhausted():
        return True
    cloud_profile = _selected_cloud_profile(config)
    profile_budget = _profile_monthly_budget(cloud_profile)
    if profile_budget <= 0:
        return False
    return tracker.is_budget_exhausted(
        monthly_budget=profile_budget,
        provider=cloud_profile.provider,
        provider_profile_id=cloud_profile.id,
        request_surface="abby_chat",
    )


def _budget_status_payload(config: Any = settings) -> dict[str, Any]:
    tracker = _get_cost_tracker()
    cloud_profile = _selected_cloud_profile(config)
    return {
        "global": tracker.get_budget_status(),
        "selected_profile": tracker.get_budget_status(
            monthly_budget=_profile_monthly_budget(cloud_profile),
            provider=cloud_profile.provider,
            provider_profile_id=cloud_profile.id,
            request_surface="abby_chat",
        ),
    }


def _resolve_abby_chat_route(message: str, config: Any = settings) -> AbbyRouteDecision:
    """Choose Abby's provider profile, defaulting to local Ollama for governance."""
    policy = resolve_abby_chat_policy(config)
    budget_exhausted = False
    if policy.mode not in {"local_only", "disabled"} and getattr(config, "abby_cloud_routing_enabled"):
        budget_exhausted = _cloud_budget_exhausted(config)

    return decide_abby_chat_route(
        message,
        config=config,
        rule_router=_router,
        budget_exhausted=budget_exhausted,
        cloud_client_available=lambda: _cloud_chat_available(config),
    )


def _route_abby_request(message: str) -> RoutingDecision:
    """Backward-compatible legacy route decision used by older tests/callers."""
    return _resolve_abby_chat_route(message).routing


_FALLBACK_REASONS = {
    "budget_exhausted",
    "claude_unavailable",
    "phi_blocked",
    "claude_error",
    "cloud_safety_blocked",
    "api_key_missing",
    "provider_disabled",
    "provider_rate_limited",
    "provider_quota_exhausted",
    "subscription_backend_unsupported",
    "invalid_key",
    "model_unavailable",
    "provider_error",
    "provider_safety_refusal",
    "provider_unavailable",
    "unsupported_capability",
    "local_fallback_unavailable",
    "timeout",
}


def _empty_safety_metadata(model_profile: str) -> dict[str, Any]:
    """Default prompt safety metadata for provider-neutral route reporting."""
    cloud_profile = model_profile != "medgemma"
    return {
        "cloud_safety_applied": cloud_profile,
        "cloud_safety_blocked": False,
        "blocked_context_count": 0,
        "context_pieces_before": 0,
        "context_pieces_after": 0,
        "cloud_safety_policy_version": CLOUD_SAFETY_POLICY_VERSION,
    }


def _apply_cloud_safety_filter(
    model_profile: str,
    context_pieces: list[ContextPiece],
    safety_metadata: dict[str, Any] | None = None,
) -> list[ContextPiece]:
    """Filter context before a cloud-bound prompt leaves the service."""
    metadata = _empty_safety_metadata(model_profile)
    metadata["context_pieces_before"] = len(context_pieces)

    if model_profile != "medgemma":
        safe_pieces = _cloud_safety.filter_for_cloud(context_pieces)
        metadata["context_pieces_after"] = len(safe_pieces)
        metadata["blocked_context_count"] = len(context_pieces) - len(safe_pieces)
        metadata["cloud_safety_blocked"] = metadata["blocked_context_count"] > 0
    else:
        safe_pieces = context_pieces
        metadata["context_pieces_after"] = len(context_pieces)

    if safety_metadata is not None:
        safety_metadata.clear()
        safety_metadata.update(metadata)

    return safe_pieces


def _routing_payload(
    routing: RoutingDecision,
    *,
    safety_metadata: dict[str, Any] | None = None,
    route_decision: AbbyRouteDecision | None = None,
) -> dict[str, Any]:
    """Provider-neutral routing metadata returned to Laravel/frontend callers.

    The legacy ``model``, ``reason``, and ``stage`` keys stay in place while
    richer provider/profile fields give the admin UI a stable contract to grow
    into.
    """
    safety = safety_metadata or _empty_safety_metadata(
        "claude" if routing.model == "claude" else "medgemma"
    )

    if routing.reason == "grounded_definition":
        provider = "none"
        transport = "grounded_definition"
        model_name = "none"
        profile_id = "grounded-definition"
        entitlement = "local"
        fallback_profile_ids: list[str] = []
        routing_strategy = "local_only"
        requested_profile_id = None
        profile_enabled = True
        profile_capabilities: dict[str, bool] = {}
    elif route_decision is not None:
        profile = route_decision.profile
        provider = profile.provider
        transport = profile.transport
        model_name = profile.model
        profile_id = profile.id
        entitlement = profile.entitlement
        fallback_profile_ids = [p.id for p in route_decision.fallback_profiles]
        routing_strategy = route_decision.policy.mode
        requested_profile_id = (
            route_decision.requested_profile.id
            if route_decision.requested_profile is not None
            else None
        )
        profile_enabled = profile.enabled
        profile_capabilities = profile.capability_map()
    elif routing.model == "claude":
        profiles = build_default_provider_profiles(settings)
        profile = profiles.get(settings.abby_cloud_chat_profile_id) or profiles["anthropic-claude"]
        provider = profile.provider
        transport = profile.transport
        model_name = profile.model
        profile_id = profile.id
        entitlement = profile.entitlement
        fallback_profile_ids = list(profile.fallback_profile_ids)
        routing_strategy = resolve_abby_chat_policy(settings).mode
        requested_profile_id = None
        profile_enabled = profile.enabled
        profile_capabilities = profile.capability_map()
    else:
        profile = build_default_provider_profiles(settings)[settings.abby_local_chat_profile_id]
        provider = profile.provider
        transport = profile.transport
        model_name = profile.model
        profile_id = profile.id
        entitlement = profile.entitlement
        fallback_profile_ids = list(profile.fallback_profile_ids)
        routing_strategy = resolve_abby_chat_policy(settings).mode
        requested_profile_id = None
        profile_enabled = profile.enabled
        profile_capabilities = profile.capability_map()

    return {
        "model": routing.model,
        "reason": routing.reason,
        "stage": routing.stage,
        "provider": provider,
        "transport": transport,
        "model_name": model_name,
        "profile_id": profile_id,
        "requested_profile_id": requested_profile_id,
        "entitlement": entitlement,
        "routing_strategy": routing_strategy,
        "fallback_profile_ids": fallback_profile_ids,
        "profile_enabled": profile_enabled,
        "capabilities": profile_capabilities,
        "fallback_used": routing.reason in _FALLBACK_REASONS or bool(
            route_decision.fallback_used if route_decision is not None else False
        ),
        "cloud_safety_applied": bool(safety.get("cloud_safety_applied", False)),
        "cloud_safety_blocked": bool(safety.get("cloud_safety_blocked", False)),
        "blocked_context_count": int(safety.get("blocked_context_count", 0) or 0),
        "context_pieces_before": int(safety.get("context_pieces_before", 0) or 0),
        "context_pieces_after": int(safety.get("context_pieces_after", 0) or 0),
        "cloud_safety_policy_version": safety.get(
            "cloud_safety_policy_version", CLOUD_SAFETY_POLICY_VERSION
        ),
    }


def _should_audit_local_route(route_decision: AbbyRouteDecision) -> bool:
    return (
        route_decision.routing.model == "local"
        and route_decision.routing.reason != "grounded_definition"
    )


def _audit_local_route_decision(
    route_decision: AbbyRouteDecision,
    request: "ChatRequest",
    *,
    safety_metadata: dict[str, Any] | None = None,
    streaming: bool = False,
) -> None:
    """Persist local/fallback routing decisions without blocking Abby responses."""
    if not _should_audit_local_route(route_decision):
        return

    fallback_used = route_decision.routing.reason in _FALLBACK_REASONS or route_decision.fallback_used
    status = "fallback_local" if fallback_used else "routed_local"
    requested_profile_id = (
        route_decision.requested_profile.id
        if route_decision.requested_profile is not None
        else None
    )
    try:
        _get_cost_tracker().record_route_decision(
            user_id=request.user_id,
            provider=route_decision.profile.provider,
            transport=route_decision.profile.transport,
            provider_profile_id=route_decision.profile.id,
            entitlement_type=route_decision.profile.entitlement,
            model=route_decision.profile.model,
            route_reason=route_decision.routing.reason,
            status=status,
            fallback_reason=route_decision.routing.reason if fallback_used else None,
            requested_provider_profile_id=requested_profile_id,
            usage_metadata={
                "page_context": request.page_context,
                "routing_stage": route_decision.routing.stage,
                "routing_confidence": route_decision.routing.confidence,
                "routing_strategy": route_decision.policy.mode,
                "fallback_profile_ids": [profile.id for profile in route_decision.fallback_profiles],
                "streaming": streaming,
                "safety": safety_metadata or {},
            },
        )
    except Exception:
        logger.debug("Abby local route decision audit failed", exc_info=True)


def _get_shared_engine() -> Any:
    global _shared_engine
    if _shared_engine is None:
        from sqlalchemy import create_engine
        _shared_engine = create_engine(settings.database_url, pool_pre_ping=True)
    return _shared_engine


def _get_shared_redis() -> Any:
    global _shared_redis
    if _shared_redis is None:
        try:
            import redis as redis_lib
            _shared_redis = redis_lib.from_url(settings.redis_url)
        except Exception:
            _shared_redis = False
    return None if _shared_redis is False else _shared_redis


def _get_data_profile_service() -> Any:
    global _dq_profile_service
    if _dq_profile_service is None:
        from app.knowledge.data_profile import DataProfileService
        _dq_profile_service = DataProfileService(
            engine=_get_shared_engine(),
            redis_client=_get_shared_redis(),
            cdm_schema=settings.knowledge_cdm_schema,
        )
    return _dq_profile_service


def _get_knowledge_surfacer() -> Any:
    global _knowledge_surfacer
    if _knowledge_surfacer is None:
        from app.institutional.knowledge_capture import KnowledgeCapture
        from app.institutional.knowledge_surfacing import KnowledgeSurfacer

        try:
            from app.chroma.embeddings import get_general_embedder
            embedder = get_general_embedder()
        except Exception:
            logger.debug("Institutional knowledge embedder unavailable; skipping surfacing")
            _knowledge_surfacer = False
            return None

        _knowledge_surfacer = KnowledgeSurfacer(
            knowledge_capture=KnowledgeCapture(engine=_get_shared_engine(), embedder=embedder)
        )
    return None if _knowledge_surfacer is False else _knowledge_surfacer


def _get_ollama_http_client() -> httpx.AsyncClient:
    global _ollama_http_client
    if _ollama_http_client is None:
        _ollama_http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.ollama_timeout),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            trust_env=False,
        )
    return _ollama_http_client


def _ns_to_ms(value: Any) -> float | None:
    if not isinstance(value, (int, float)):
        return None
    return round(float(value) / 1_000_000, 1)


def _log_latency(event: str, **fields: Any) -> None:
    parts = [event]
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, float):
            parts.append(f"{key}={value:.1f}")
        else:
            parts.append(f"{key}={value}")
    message = " ".join(parts)
    logger.info(message)
    if logger.name != "uvicorn.error":
        logging.getLogger("uvicorn.error").info(message)


def _get_session(conversation_id: int | None) -> dict:
    """Get or create session state for a conversation."""
    if conversation_id is None:
        return {"intent_stack": IntentStack(), "scratch_pad": ScratchPad(), "turn": 0}
    if conversation_id not in _session_state:
        # Evict oldest entry if at capacity
        if len(_session_state) >= _SESSION_MAX_SIZE:
            oldest_key = next(iter(_session_state))
            del _session_state[oldest_key]
        _session_state[conversation_id] = {
            "intent_stack": IntentStack(),
            "scratch_pad": ScratchPad(),
            "turn": 0,
        }
    return _session_state[conversation_id]


# ── Pydantic models ──────────────────────────────────────────────────────────

class CohortParseRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=3000,
                        description="Natural language cohort description")
    page_context: str = Field(default="cohort-builder",
                              description="Current UI page the user is on")


class ParsedTerm(BaseModel):
    text: str
    domain: str        # condition | drug | procedure | measurement | observation
    role: str          # entry | inclusion | exclusion
    negated: bool = False


class ParsedDemographics(BaseModel):
    sex: list[str] = []          # ['Female'] | ['Male'] | []
    age_min: int | None = None
    age_max: int | None = None
    race: list[str] = []
    ethnicity: list[str] = []
    location_state: list[str] = []


class ParsedTemporal(BaseModel):
    washout_days: int | None = None   # prior clean window
    within_days: int | None = None    # co-occurrence window
    index_date_offset: int = 0


class CohortParseResponse(BaseModel):
    cohort_name: str
    cohort_description: str
    demographics: ParsedDemographics
    terms: list[ParsedTerm]
    temporal: ParsedTemporal
    study_design: str          # prevalent | incident | new_users
    confidence: float          # 0–1, LLM self-assessment of parse quality
    warnings: list[str] = []
    raw_llm_output: str = ""   # for debug / transparency


class ChatMessage(BaseModel):
    role: str   # 'user' | 'assistant'
    content: str


class ResearchProfile(BaseModel):
    """Learned research profile from the profile_learner module."""
    research_interests: list[str] | None = []
    expertise_domains: dict[str, float] | None = {}
    interaction_preferences: dict | None = {}
    frequently_used: dict | None = {}
    interaction_count: int | None = 0

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def coerce_nulls(cls, data: Any) -> Any:
        """Coerce None/empty-list to correct empty defaults.

        PHP serialises empty arrays as [] regardless of whether the column
        is a list or a JSON object, so dict fields may arrive as [].
        """
        if isinstance(data, dict):
            dict_fields = {"expertise_domains", "interaction_preferences", "frequently_used"}
            result: dict[str, object] = {}
            for k, v in data.items():
                if v is None:
                    result[k] = [] if k == "research_interests" else ({} if k in dict_fields else 0)
                elif k in dict_fields and isinstance(v, list):
                    result[k] = {}  # [] → {}
                else:
                    result[k] = v
            return result
        return data


class UserProfile(BaseModel):
    name: str = ""
    roles: list[str] = []
    research_profile: ResearchProfile = ResearchProfile()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    page_context: str = Field(
        default="general",
        description="UI page context for Abby to tailor responses"
    )
    page_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Relevant page entity data (cohort name, current filters, etc.)"
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Prior conversation turns (last 10 recommended)"
    )
    user_profile: UserProfile | None = Field(
        default=None,
        description="Current user info for personalized responses"
    )
    user_id: int | None = Field(
        default=None,
        description="Current user ID for personalized conversation memory"
    )
    conversation_id: int | None = Field(
        default=None,
        description="Conversation ID for session memory tracking"
    )
    provider_policy: dict[str, Any] | None = Field(
        default=None,
        description="Resolved admin provider policy supplied by Laravel for this Abby turn"
    )


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = []   # quick-action prompts the UI can surface as chips
    routing: dict = {}
    confidence: str = ""
    sources: list[dict] = []


# ── Ollama helpers ───────────────────────────────────────────────────────────

SYSTEM_PROMPT_COHORT_PARSER = """\
You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM research platform.

Your task is to parse a researcher's natural-language cohort description into a structured JSON object.

RULES:
1. Output ONLY valid JSON — no markdown fences, no prose before or after.
2. Use the exact schema below.
3. For "terms", classify each clinical entity:
   - domain: condition | drug | procedure | measurement | observation
   - role: entry (index event) | inclusion (must have) | exclusion (must NOT have)
4. For demographics: extract sex, age range, race, ethnicity, US state (location_state).
5. For study_design: prevalent (any history) | incident (new diagnosis) | new_users (first drug use)
6. Set confidence between 0.0 (very uncertain) and 1.0 (clear, complete description).
7. Add warnings for ambiguous terms or geography that OMOP may not support.

OUTPUT SCHEMA:
{
  "cohort_name": "Short descriptive name",
  "cohort_description": "One-sentence clinical description",
  "demographics": {
    "sex": [],
    "age_min": null,
    "age_max": null,
    "race": [],
    "ethnicity": [],
    "location_state": []
  },
  "terms": [
    {"text": "breast cancer", "domain": "condition", "role": "entry", "negated": false}
  ],
  "temporal": {
    "washout_days": null,
    "within_days": null,
    "index_date_offset": 0
  },
  "study_design": "prevalent",
  "confidence": 0.92,
  "warnings": []
}
"""

# ── Shared capability preamble ──────────────────────────────────────────────
# Prepended to every page-specific prompt so Abby knows what she can do.

CAPABILITY_PREAMBLE = (
    "You have PostgreSQL database access to the Parthenon OMOP CDM v5.4 database "
    "as the abby_analyst role. Your access has two tiers:\n\n"
    "1. READ-ONLY access to clinical and vocabulary schemas: vocab (7M+ OMOP concepts), "
    "omop (Acumenus CDM, ~1M patients), pancreas (361-patient pancreatic cancer corpus), "
    "irsf (IRSF Natural History Study), mimiciv (MIMIC-IV ICU data), "
    "atlantic_health (Atlantic Health CDM), "
    "results/pancreas_results/irsf_results (Achilles characterization output).\n\n"
    "2. READ-WRITE access to the temp_abby scratch schema. You can CREATE tables, "
    "INSERT data, and DROP tables in temp_abby for intermediate computations, "
    "staging analytics results, or building summary tables. This is YOUR workspace.\n\n"
    "When the user asks data questions — patient counts, top conditions, lab distributions, "
    "drug frequencies, cohort sizes — you have live context tools that automatically "
    "query the database on your behalf. You can and should give specific numbers, "
    "not generic explanations.\n\n"
    "For complex analytical questions that require multiple query steps, custom joins, "
    "or intermediate result staging, you can use the Data Interrogation feature which "
    "lets you execute SQL queries directly. Use temp_abby to store intermediate results "
    "when building multi-step analyses.\n\n"
    "When a user asks 'how many patients have X' or 'what are the top Y', answer with "
    "actual data from the CDM. If the live context doesn't cover their question, suggest "
    "they switch to the Data Interrogation mode (Ask Data button) where you can run "
    "custom SQL queries for them.\n\n"
)

COMPACT_CAPABILITY_PREAMBLE = (
    "You are Abby for the Parthenon OMOP CDM platform. "
    "You can use live platform data, documentation, and institutional memory when they are provided. "
    "The clinical data schemas are read-only and `temp_abby` is your scratch workspace for multi-step analysis. "
    "When live context includes counts or entities, answer with those concrete values. "
    "If the supplied context is insufficient for a database question, suggest Data Interrogation for custom SQL.\n\n"
)

PAGE_SYSTEM_PROMPTS: dict[str, str] = {
    "cohort_builder": (
        "You are Abby, a clinical informatics assistant. "
        "The user is building a cohort definition in the Parthenon cohort builder. "
        "Help them refine inclusion/exclusion criteria, suggest OMOP concept sets, "
        "explain study design choices (new-user, prevalent, incident), and interpret "
        "the generated SQL. Be concise and clinical."
    ),
    "cohort_list": (
        "You are Abby. The user is viewing the list of cohort definitions. "
        "Help them understand cohort design strategies, compare cohorts, "
        "and explain new-user vs prevalent vs incident study designs."
    ),
    "concept_set_editor": (
        "You are Abby. The user is editing a concept set in the concept set builder. "
        "Help them add/remove concepts, decide on include-descendants strategy, "
        "understand OMOP vocabulary hierarchies, and resolve non-standard to standard mappings."
    ),
    "concept_set_list": (
        "You are Abby. The user is browsing their concept sets. "
        "Help them understand concept set organization, versioning best practices, "
        "and how concept sets feed into cohort definitions."
    ),
    "vocabulary": (
        "You are Abby. The user is searching the OMOP vocabulary. "
        "Help them find the right standard concepts, understand hierarchies, "
        "explain vocabulary differences (SNOMED, ICD10CM, RxNorm, LOINC, ATC), "
        "and suggest concept set strategies including descendants."
    ),
    "data_explorer": (
        "You are Abby. The user is viewing Achilles data characterization results "
        "for an OMOP CDM source. Help them interpret domain summaries, identify "
        "data quality signals, explain distributions (age, gender, observation periods), "
        "and compare to expected clinical data ranges."
    ),
    "data_sources": (
        "You are Abby. The user is managing OMOP CDM data sources. "
        "Help them configure source connections, understand source daimons "
        "(CDM, vocabulary, results, temp), and troubleshoot connection issues."
    ),
    "data_quality": (
        "You are Abby. The user is reviewing Data Quality Dashboard results. "
        "Explain DQD check categories (plausibility, conformance, completeness), "
        "help interpret failures and heel rules, and suggest remediation steps."
    ),
    "analyses": (
        "You are Abby. The user is on the Analyses overview page. "
        "Help them understand the different analysis types available: "
        "Characterizations, Incidence Rates, Cohort Pathways, Estimation (CohortMethod), "
        "Prediction (PatientLevelPrediction), SCCS, and Evidence Synthesis. "
        "Guide them on which analysis type fits their research question."
    ),
    "incidence_rates": (
        "You are Abby. The user is working with incidence rate analyses. "
        "Help them define time-at-risk windows, choose target and outcome cohorts, "
        "interpret incidence rate vs proportion, and understand age/sex stratification."
    ),
    "estimation": (
        "You are Abby. The user is designing a comparative effectiveness estimation. "
        "Help with propensity score methods (IPTW, stratification, matching), "
        "negative control outcomes, diagnostic checks, and interpreting hazard ratios."
    ),
    "prediction": (
        "You are Abby. The user is working with patient-level prediction models. "
        "Help them choose features, understand LASSO regularization, interpret "
        "AUROC/calibration metrics, and evaluate model performance and external validation."
    ),
    "genomics": (
        "You are Abby. The user is in the Genomics module. "
        "Help with VCF file interpretation, variant pathogenicity (ClinVar annotations), "
        "GIAB benchmark comparisons, gene panel design, pharmacogenomics (PGx), "
        "and creating genomic cohort criteria within the OMOP CDM framework."
    ),
    "imaging": (
        "You are Abby. The user is in the Medical Imaging module. "
        "Help with DICOM study management, viewer navigation, imaging analytics, "
        "modality interpretation (CT, MRI, X-ray, US), NLP extraction from reports, "
        "and creating imaging-based cohort criteria."
    ),
    "heor": (
        "You are Abby. The user is in the Health Economics & Outcomes Research module. "
        "Help with cost-effectiveness analysis (CEA), cost-utility analysis (CUA), "
        "budget impact modeling, value-based contract simulation, sensitivity analysis, "
        "and interpreting ICER thresholds and willingness-to-pay curves."
    ),
    "studies": (
        "You are Abby. The user is managing an outcomes research study in Parthenon. "
        "Help them understand study components (cohorts, characterizations, incidence rates, "
        "pathways, estimations, predictions), study lifecycle transitions, "
        "multi-site coordination, and protocol design best practices."
    ),
    "administration": (
        "You are Abby. The user is in the Administration panel. "
        "Help them configure authentication providers, manage user roles and permissions, "
        "set up AI providers, check system health, and manage data source connections."
    ),
    "patient_profiles": (
        "You are Abby. The user is viewing individual patient timelines. "
        "Help them interpret the clinical events, identify care gaps, and understand "
        "the OMOP domain structure for the events shown."
    ),
    "data_ingestion": (
        "You are Abby. The user is ingesting data into the OMOP CDM. "
        "Help with file upload formats (CSV, JSON), schema mapping strategies, "
        "concept mapping review, and data validation interpretation."
    ),
    "care_gaps": (
        "You are Abby. The user is working with care bundles and care gap analysis. "
        "Help them define quality measures, create care bundles, "
        "interpret population-level compliance, and design interventions."
    ),
    "dashboard": (
        "You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM "
        "research platform. The user is on the main dashboard. Help them navigate "
        "to the right module for their task, understand platform metrics, "
        "and get started with their research workflow."
    ),
    "patient_similarity": (
        "You are Abby. The user is in Patient Similarity. Help them compare cohort "
        "profiles, run propensity score matching and covariate balance (SMD / Love "
        "plots), find clinically similar patients, and interpret the UMAP landscape. "
        "Distinguish Compare mode (how different are A vs B) from Expand mode "
        "(find more patients like A)."
    ),
    "risk_scores": (
        "You are Abby. The user is working with clinical Risk Scores (Charlson, "
        "Elixhauser, CHA₂DS₂-VASc, HAS-BLED, APACHE). Help them choose a score, map the "
        "required OMOP inputs (conditions, drugs, measurements, demographics), run it "
        "against a cohort, and interpret score distributions and risk-band stratification."
    ),
    "standard_pros": (
        "You are Abby. The user is in Standard PROs+ (patient-reported outcomes). "
        "Help them choose validated instruments (PHQ-9, GAD-7, KCCQ-12, PROMIS), "
        "administer surveys, and interpret scoring algorithms and how PRO data is "
        "stored in the OMOP CDM (observation / measurement)."
    ),
    "morpheus": (
        "You are Abby. The user is in Morpheus, exploring inpatient patient journeys "
        "(MIMIC-IV). Help them navigate clinical timelines, interpret events across "
        "OMOP domains, and understand the inpatient visit and encounter structure."
    ),
    "commons": (
        "You are Abby. The user is in Commons, the team collaboration workspace. "
        "Help them organize channels by study or cohort, share cohort definitions and "
        "analyses, use the knowledge base, and coordinate research with collaborators."
    ),
    "phenotype_library": (
        "You are Abby. The user is in the OHDSI Phenotype Library. Help them search "
        "the phenotype definitions, understand validation status and cohort logic, and "
        "import a definition into their project as a cohort definition."
    ),
    "workbench": (
        "You are Abby. The user is in the Workbench / Investigation environment. Help "
        "them assemble investigations, organize analyses and toolsets, and use the "
        "FinnGen endpoint, cohort, and care-bundle workbenches."
    ),
    "study_packages": (
        "You are Abby. The user is working with Strategus study packages. Help them "
        "assemble, export, and execute multi-site OHDSI study packages and understand "
        "the analytic modules and artifacts a package contains."
    ),
    "mapping_assistant": (
        "You are Abby. The user is in the Mapping Assistant (Ariadne). Help them map "
        "source codes to OMOP standard concepts, review and approve AI-suggested "
        "mappings, and choose appropriate target vocabularies and domains."
    ),
    "jobs": (
        "You are Abby. The user is monitoring background jobs. Help them interpret job "
        "status and queue health, and understand how to cancel or retry failed jobs "
        "(Horizon-backed processing)."
    ),
    "gis": (
        "You are Abby. The user is in GIS Explorer. Help them load geographic data, run "
        "spatial statistics, and visualize patient populations across geographies."
    ),
    "query_assistant": (
        "You are Abby. The user is in the Query Assistant (text-to-SQL). Help them write "
        "and refine read-only SQL against the OMOP CDM, understand the available schemas "
        "and tables, and translate research questions into safe analytical queries."
    ),
    "publish": (
        "You are Abby. The user is in the Publish module. Help them assemble "
        "publications, generate manuscript tables and figures from study results, and "
        "choose appropriate export formats."
    ),
    "settings": (
        "You are Abby. The user is in their account Settings. Help them update profile, "
        "theme, locale, and notification preferences."
    ),
    "jupyter": (
        "You are Abby. The user is in the Jupyter environment. Help them launch "
        "notebooks, discover available Python packages, and connect to the OMOP "
        "database from a notebook."
    ),
    "etl_tools": (
        "You are Abby. The user is using ETL tools (WhiteRabbit source profiling, "
        "FHIR-to-CDM ingestion, Aqueduct). Help them profile source databases, plan "
        "schema mapping, and ingest data into the OMOP CDM."
    ),
    "library": (
        "You are Abby. The user is in the Library lifecycle tools. Help them manage the "
        "lifecycle of concept sets, cohort definitions, and analyses (draft → active "
        "→ archived), restore archived items, and act on cleanup suggestions for stale "
        "items. Archiving is reversible; purging is permanent."
    ),
    "general": (
        "You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM "
        "research platform. Help the user with any question about OMOP, cohort design, "
        "data quality, clinical analytics, or the Parthenon application."
    ),
}


# ── Help content knowledge base ──────────────────────────────────────────────

# Map page context → help JSON keys to inject as knowledge
CONTEXT_HELP_KEYS: dict[str, list[str]] = {
    "cohort_builder": ["cohort-builder", "cohort-builder.primary-criteria", "cohort-builder.inclusion-rules", "cohort-builder.cohort-exit"],
    "cohort_list": ["cohort-builder"],
    "concept_set_editor": ["concept-set-builder"],
    "concept_set_list": ["concept-set-builder"],
    "vocabulary": ["vocabulary-search"],
    "data_explorer": ["data-explorer", "data-explorer.dqd", "data-explorer.heel"],
    "data_sources": ["data-sources"],
    "data_quality": ["data-explorer.dqd", "data-explorer.heel"],
    "analyses": ["analyses"],
    "incidence_rates": ["incidence-rates"],
    "estimation": ["estimation"],
    "prediction": ["prediction"],
    "genomics": ["genomics"],
    "imaging": ["imaging"],
    "heor": ["heor"],
    "studies": ["studies"],
    "administration": ["admin", "admin.users", "admin.roles", "admin.auth-providers"],
    "patient_profiles": ["patient-timeline"],
    "data_ingestion": ["data-ingestion"],
    "care_gaps": ["care-gaps", "care-gaps.detail"],
    "dashboard": ["dashboard"],
    "patient_similarity": ["patient-similarity"],
    "risk_scores": ["risk-scores", "risk-scores.create", "risk-scores.detail"],
    "standard_pros": ["standard-pros", "standard-pros.detail"],
    "morpheus": ["morpheus", "morpheus.patient-journey"],
    "commons": ["commons"],
    "phenotype_library": ["phenotype-library"],
    "workbench": ["workbench", "investigation", "investigation.new"],
    "study_packages": ["study-packages"],
    "mapping_assistant": ["mapping-assistant"],
    "jobs": ["jobs"],
    "gis": ["gis"],
    "query_assistant": ["query-assistant"],
    "publish": ["publish"],
    "settings": ["settings", "settings.notifications"],
    "jupyter": ["jupyter"],
    "etl_tools": ["etl-tools", "source-profiler", "fhir-ingestion"],
    "library": ["admin.library", "library.cleanup"],
}

HELP_CONTENT: dict[str, dict[str, Any]] = {}


def _load_help_files() -> None:
    """Load help JSON files from the backend resources directory."""
    help_dir = Path(os.environ.get("HELP_DIR", "/var/www/html/resources/help"))
    if not help_dir.exists():
        # Try relative path for local development
        alt_dir = Path(__file__).parent.parent.parent.parent / "backend" / "resources" / "help"
        if alt_dir.exists():
            help_dir = alt_dir
        else:
            logger.warning("Help directory not found: %s", help_dir)
            return

    for f in help_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            key = data.get("key", f.stem)
            HELP_CONTENT[key] = data
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load help file %s: %s", f, e)

    logger.info("Loaded %d help files for Abby", len(HELP_CONTENT))


# Load at module import time
_load_help_files()


def _get_help_context(page_context: str) -> str:
    """Build a help knowledge section for the given page context."""
    keys = CONTEXT_HELP_KEYS.get(page_context, [])
    if not keys:
        return ""

    sections = []
    for key in keys:
        data = HELP_CONTENT.get(key)
        if not data:
            continue
        title = data.get("title", key)
        desc = data.get("description", "")
        tips = data.get("tips", [])
        tip_text = "\n".join(f"  - {t}" for t in tips[:5]) if tips else ""
        section = f"### {title}\n{desc}"
        if tip_text:
            section += f"\nKey tips:\n{tip_text}"
        sections.append(section)

    if not sections:
        return ""

    return "\n\nFEATURE DOCUMENTATION:\n" + "\n\n".join(sections)


async def call_ollama(system_prompt: str, user_message: str,
                      history: list[ChatMessage] | None = None,
                      temperature: float = 0.1,
                      num_predict: int | None = None,
                      config: Any = settings) -> str:
    """Call Ollama with the configured MedGemma model."""
    local_profile_id = getattr(config, "abby_local_chat_profile_id", settings.abby_local_chat_profile_id)
    local_profile = build_default_provider_profiles(config)[local_profile_id]
    adapter = OllamaChatAdapter(
        profile=local_profile,
        client=_get_ollama_http_client(),
        default_num_predict=getattr(config, "ollama_num_predict", settings.ollama_num_predict),
        keep_alive_seconds=getattr(config, "abby_ollama_keep_alive", settings.abby_ollama_keep_alive),
        timeout_seconds=getattr(config, "ollama_timeout", settings.ollama_timeout),
        log_latency=_log_latency,
        estimate_tokens=_estimate_tokens,
        ns_to_ms=_ns_to_ms,
    )
    try:
        response = await adapter.chat(
            ChatAdapterRequest(
                system_prompt=system_prompt,
                message=user_message,
                history=[
                    {"role": msg.role, "content": msg.content}
                    for msg in (history or [])[-10:]
                ],
                temperature=temperature,
                max_output_tokens=num_predict,
            )
        )
        return response.reply
    except ChatAdapterError as exc:
        logger.error("Ollama adapter failed (%s): %s", exc.error_class, exc)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/provider-health")
async def provider_health() -> dict[str, Any]:
    """Return Abby provider readiness without exposing secrets."""
    from app.services.ollama_client import check_ollama_health

    profiles = build_default_provider_profiles(settings)
    policy = resolve_abby_chat_policy(settings)
    local_profile = profiles[settings.abby_local_chat_profile_id]
    cloud_profile = profiles.get(settings.abby_cloud_chat_profile_id) or profiles["anthropic-claude"]
    local_status = await check_ollama_health(
        base_url=local_profile.base_url,
        model=local_profile.model,
    )
    cloud_status = "disabled"
    if cloud_profile.enabled:
        if not cloud_profile.key_configured:
            cloud_status = "missing_key"
        elif cloud_profile.transport == "anthropic_messages" and _get_claude_client() is None:
            cloud_status = "client_unavailable"
        else:
            cloud_status = "ready"

    fallback_profile_ids = list(policy.fallback_profile_ids)
    default_route = "local" if policy.mode == "local_only" else policy.mode
    fallback_chain = ["ollama"] if policy.mode == "local_only" else ["anthropic", "ollama"]

    return {
        "chat": {
            "default_route": default_route,
            "cloud_routing_enabled": settings.abby_cloud_routing_enabled,
            "fallback_chain": fallback_chain,
            "policy": policy.public_dict(),
            "fallback_profile_ids": fallback_profile_ids,
            "local": {
                "profile_id": local_profile.id,
                "provider": local_profile.provider,
                "transport": local_profile.transport,
                "model": local_profile.model,
                "base_url": local_profile.base_url,
                "status": local_status,
                "last_error_class": None if local_status == "ok" else local_status,
                "capabilities": local_profile.capability_map(),
            },
            "cloud": {
                "profile_id": cloud_profile.id,
                "provider": cloud_profile.provider,
                "transport": cloud_profile.transport,
                "model": cloud_profile.model,
                "status": cloud_status,
                "last_error_class": None if cloud_status in {"ready", "disabled"} else cloud_status,
                "entitlement": cloud_profile.entitlement,
                "key_configured": cloud_profile.key_configured,
                "capabilities": cloud_profile.capability_map(),
            },
            "safety": {
                "phi_detection_enabled": settings.phi_detection_enabled,
                "phi_block_on_detection": settings.phi_block_on_detection,
                "cloud_safety_filter": "enabled",
            },
            "budget": _budget_status_payload(settings),
            "profiles": [profile.public_dict() for profile in profiles.values()],
            "capability_flags": list(CAPABILITY_FLAGS),
            "routing_strategies": list(ROUTING_STRATEGIES),
            "entitlement_types": list(ENTITLEMENT_TYPES),
            "transports": list(TRANSPORTS),
        },
        "agent": {
            "provider": settings.agent_provider,
            "local_model": settings.agent_local_model,
            "local_base_url": settings.agent_local_base_url,
            "local_actions_enabled": settings.agent_local_actions_enabled,
        },
    }


@router.get("/model-inventory")
async def model_inventory() -> dict[str, Any]:
    """Return configured Abby profiles and local model tags for admin UIs."""
    from app.services.ollama_client import list_ollama_models

    profiles = build_default_provider_profiles(settings)
    policy = resolve_abby_chat_policy(settings)
    local_profile = profiles[settings.abby_local_chat_profile_id]
    ollama_inventory = await list_ollama_models(base_url=local_profile.base_url)
    local_model_names = {
        str(model.get("name", ""))
        for model in ollama_inventory.get("models", [])
        if isinstance(model, dict)
    }
    configured_model = local_profile.model
    configured_local_present = any(
        configured_model == name or configured_model in name
        for name in local_model_names
    )

    return {
        "policy": policy.public_dict(),
        "profiles": [profile.public_dict() for profile in profiles.values()],
        "local": {
            "provider": local_profile.provider,
            "base_url": local_profile.base_url,
            "status": ollama_inventory.get("status", "unavailable"),
            "configured_model": configured_model,
            "configured_model_present": configured_local_present,
            "models": ollama_inventory.get("models", []),
        },
        "profile_usage": {
            "chat": policy.default_profile_id,
            "fallbacks": list(policy.fallback_profile_ids),
            "parse_cohort": settings.abby_local_chat_profile_id,
            "agent": settings.agent_provider,
        },
        "capability_flags": list(CAPABILITY_FLAGS),
        "routing_strategies": list(ROUTING_STRATEGIES),
        "entitlement_types": list(ENTITLEMENT_TYPES),
        "transports": list(TRANSPORTS),
        "subscription_boundary": {
            "backend_subscription_quota_supported": False,
            "supported_entitlements": ["local", "org_api_key", "user_api_key", "acumenus_managed_api"],
            "external_subscription_app_is_separate_surface": True,
        },
    }


@router.post("/parse-cohort", response_model=CohortParseResponse)
async def parse_cohort(request: CohortParseRequest) -> CohortParseResponse:
    """
    Parse a natural-language cohort description into a structured spec.
    The Laravel backend uses this to resolve OMOP concepts and build the expression JSON.
    """
    raw = await call_ollama(
        system_prompt=SYSTEM_PROMPT_COHORT_PARSER,
        user_message=request.prompt,
        temperature=0.05,   # near-deterministic for structured output
        num_predict=max(settings.ollama_num_predict, 320),
    )

    # Strip any accidental markdown fences
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        logger.warning("LLM returned non-JSON output: %s\n%s", e, raw)
        # Return a minimal fallback so the Laravel regex fallback can take over
        return CohortParseResponse(
            cohort_name="Unnamed Cohort",
            cohort_description=request.prompt[:200],
            demographics=ParsedDemographics(),
            terms=[],
            temporal=ParsedTemporal(),
            study_design="prevalent",
            confidence=0.0,
            warnings=["LLM could not parse the description into structured JSON. Falling back to regex parser."],
            raw_llm_output=raw,
        )

    # Map parsed dict → response model (with defaults for any missing keys)
    demo_raw = parsed.get("demographics", {})
    temporal_raw = parsed.get("temporal", {})

    return CohortParseResponse(
        cohort_name=parsed.get("cohort_name", "Unnamed Cohort"),
        cohort_description=parsed.get("cohort_description", ""),
        demographics=ParsedDemographics(
            sex=demo_raw.get("sex", []),
            age_min=demo_raw.get("age_min"),
            age_max=demo_raw.get("age_max"),
            race=demo_raw.get("race", []),
            ethnicity=demo_raw.get("ethnicity", []),
            location_state=demo_raw.get("location_state", []),
        ),
        terms=[
            ParsedTerm(
                text=t.get("text", ""),
                domain=t.get("domain", "condition"),
                role=t.get("role", "entry"),
                negated=t.get("negated", False),
            )
            for t in parsed.get("terms", [])
        ],
        temporal=ParsedTemporal(
            washout_days=temporal_raw.get("washout_days"),
            within_days=temporal_raw.get("within_days"),
            index_date_offset=temporal_raw.get("index_date_offset", 0),
        ),
        study_design=parsed.get("study_design", "prevalent"),
        confidence=float(parsed.get("confidence", 0.5)),
        warnings=parsed.get("warnings", []),
        raw_llm_output=raw,
    )


_DATA_QUALITY_PATTERN = re.compile(
    r"\b(data\s*quality|dqd|quality\s*check|coverage|sparse|gap|temporal|conformance|completeness|plausibility)\b",
    re.I,
)
_INSTITUTIONAL_PATTERN = re.compile(
    r"\b(previous|past|recent|review|decision|worked|learned|institutional|history|memory|similar)\b",
    re.I,
)
_DEFINITION_QUERY_PATTERN = re.compile(
    r"^\s*(what\s+is|who\s+is|define|explain)\b",
    re.I,
)


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _build_response_format_rules(compact: bool) -> str:
    if compact:
        return (
            "\n\nRESPONSE FORMAT:"
            "\n- Keep replies concise."
            "\n- Use markdown when helpful."
            '\n- End with: SUGGESTIONS: ["...", "..."]'
        )

    return (
        "\n\nRESPONSE FORMAT:"
        "\n- Keep replies concise (under 300 words)."
        "\n- Use markdown formatting for headers, lists, and code blocks."
        "\n- End your reply with 1–3 next-step action prompts the user could send you"
        " to make progress toward their goal within Parthenon."
        " These are things the USER would TYPE TO YOU — short imperative commands or"
        " specific questions directed at you, NOT questions you are asking the user."
        " Good examples: \"Build the cohort definition for this study\","
        " \"Show me available heart failure concept sets\","
        " \"Analyze 30-day readmission rates for this cohort\"."
        " Bad examples: \"Would you like to explore cohort design?\","
        " \"Are you interested in specific medications?\" (those are you asking the user)."
        '\n- Format as a JSON array on the last line: SUGGESTIONS: ["...", "...", "..."]'
    )


def _get_local_num_predict(page_context: str) -> int:
    default = settings.ollama_num_predict
    compact_context_cap = {
        "general": 160,
        "dashboard": 160,
        "commons_ask_abby": 192,
        "data_quality": 192,
        "data_explorer": 192,
        "vocabulary": 192,
        "cohort_list": 192,
        "concept_set_list": 192,
        "administration": 192,
    }.get(page_context)
    resolved = default if compact_context_cap is None else min(default, compact_context_cap)

    # Larger reasoning models often spend a prefix budget inside
    # <think> blocks before producing the visible answer. If we keep the compact
    # Abby caps, the model can exhaust its token budget before it ever emits the
    # final answer. Give these models a larger floor so the user actually gets
    # a response.
    reasoning_model_markers = ("qwen", "qwq", "deepseek-r1", "ii-medical", "medgemma")
    if any(marker in settings.abby_llm_model.lower() for marker in reasoning_model_markers):
        return max(resolved, 640)

    return resolved


def _should_include_data_quality_context(request: ChatRequest) -> bool:
    if request.page_context in {"data_quality", "data_explorer", "administration"}:
        return True
    return bool(_DATA_QUALITY_PATTERN.search(request.message))


def _should_include_institutional_context(request: ChatRequest) -> bool:
    if request.page_context in {"commons_ask_abby", "studies", "analyses"}:
        return True
    return bool(_INSTITUTIONAL_PATTERN.search(request.message))


def _should_skip_live_context(request: ChatRequest, rag_context: str) -> bool:
    """Avoid database/tool noise for definition questions already grounded in docs."""
    return bool(rag_context) and bool(_DEFINITION_QUERY_PATTERN.search(request.message))


def _clean_grounded_text(text: str) -> str:
    """Flatten markdown-ish retrieved chunks into plain text sentences."""
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"^#.*$", " ", text, flags=re.MULTILINE)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*]\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"=+", " ", text)
    text = re.sub(r"[*_]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _definition_query_terms(message: str) -> list[str]:
    """Extract salient terms for simple grounded sentence selection."""
    return [
        token
        for token in re.findall(r"[a-z0-9]+", message.lower())
        if len(token) > 1 and token not in {
            "what", "who", "is", "the", "a", "an", "define", "explain", "does",
        }
    ]


def _is_reference_only_grounded_sentence(sentence: str) -> bool:
    lowered = sentence.lower()
    if "http://" in lowered or "https://" in lowered:
        return True
    if "docs/" in lowered or ".md" in lowered:
        return True
    return lowered.startswith(("source urls", "related local references"))


def _result_has_viable_grounded_sentence(result: dict[str, object], terms: list[str]) -> bool:
    """Check whether a retrieved chunk contains at least one usable definition sentence."""
    text = _clean_grounded_text(str(result.get("text", "")))
    if not text:
        return False

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence.strip()
    ]
    for sentence in sentences[:6]:
        if _is_reference_only_grounded_sentence(sentence):
            continue
        sentence_lower = sentence.lower()
        if "seed note exists" in sentence_lower:
            continue
        if any(term in sentence_lower for term in terms):
            return True
    return False


def _build_chat_sources(
    results: list[dict[str, object]],
    *,
    min_score: float = 0.55,
    limit: int = 3,
) -> list[dict[str, object]]:
    """Convert ranked retrieval results into compact API-facing source metadata."""
    sources: list[dict[str, object]] = []
    seen: set[tuple[str, str, str]] = set()

    for result in results:
        score = float(str(result.get("score", 0) or 0))
        if score < min_score:
            continue

        source_tag = str(result.get("source_tag", "") or "").strip()
        source_label = str(result.get("source_label", "") or source_tag).strip()
        title = _clean_grounded_text(str(result.get("title", "") or ""))
        source_file = str(result.get("source_file", "") or "").strip()
        key = (source_tag, title, source_file)
        if key in seen:
            continue
        seen.add(key)

        source: dict[str, object] = {
            "collection": source_tag,
            "label": source_label,
            "score": round(score, 3),
        }
        if title:
            source["title"] = title
        if source_file:
            source["source_file"] = source_file
        section = _clean_grounded_text(str(result.get("section", "") or ""))
        if section and section != title:
            source["section"] = section
        url = str(result.get("url", "") or "").strip()
        if url:
            source["url"] = url
        sources.append(source)
        if len(sources) >= limit:
            break

    return sources


def _try_grounded_definition_answer(request: ChatRequest) -> tuple[str, list[dict[str, object]]]:
    """Answer short definition questions directly from retrieved context."""
    if request.page_context != "commons_ask_abby" and request.page_context not in {
        "cohort_builder", "vocabulary", "data_explorer", "data_quality",
        "analyses", "incidence_rates", "estimation", "prediction",
        "genomics", "imaging", "patient_profiles", "care_gaps",
    }:
        return "", []

    if not _DEFINITION_QUERY_PATTERN.search(request.message):
        return "", []

    docs_results = query_docs(request.message, top_k=5, threshold=0.9)
    if docs_results and float(str(docs_results[0].get("score", 0) or 0)) >= 0.8:
        results = docs_results
    else:
        results = get_ranked_rag_results(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
    if not results:
        return "", []

    top_result = results[0]
    top_score = float(str(top_result.get("score", 0) or 0))
    if top_score < 0.55:
        return "", []

    terms = _definition_query_terms(request.message)
    candidate_results = [
        result
        for result in results[:5]
        if _result_has_viable_grounded_sentence(result, terms)
    ] or results[:5]
    candidates: list[tuple[float, str, dict[str, object]]] = []
    for idx, result in enumerate(candidate_results):
        text = _clean_grounded_text(str(result.get("text", "")))
        if not text:
            continue
        title_text = _clean_grounded_text(str(result.get("title", ""))).lower()
        source_text = _clean_grounded_text(str(result.get("source_file", ""))).lower()
        title_overlap = sum(1 for term in terms if term in title_text)
        source_overlap = sum(1 for term in terms if term in source_text)
        sentences = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", text)
            if sentence.strip()
        ]
        for sentence in sentences[:6]:
            sentence_lower = sentence.lower()
            if "seed note exists" in sentence_lower:
                continue
            if _is_reference_only_grounded_sentence(sentence):
                continue
            overlap = sum(1 for term in terms if term in sentence_lower)
            if overlap == 0:
                continue
            definitional_bonus = 0.75 if any(
                phrase in sentence_lower for phrase in (" stands for ", " is ", " are ", " refers to ")
            ) else 0.0
            score = (
                overlap
                + (title_overlap * 2.0)
                + (source_overlap * 2.0)
                + definitional_bonus
                + (0.5 if idx == 0 else 0.0)
            )
            candidates.append((score, sentence, result))

    if not candidates:
        return "", []

    candidates.sort(key=lambda item: item[0], reverse=True)
    selected: list[str] = []
    selected_results: list[dict[str, object]] = []
    seen: set[str] = set()
    for _, sentence, result in candidates:
        key = sentence.lower()
        if key in seen:
            continue
        seen.add(key)
        selected.append(sentence)
        selected_results.append(result)
        if len(selected) >= 1:
            break

    attribution_results = selected_results + [
        result for result in candidate_results
        if result not in selected_results
    ]
    return " ".join(selected).strip(), _build_chat_sources(attribution_results)


def _build_context_block(model_profile: str, pieces: list[ContextPiece]) -> tuple[str, bool]:
    if not pieces:
        return "", False

    assembler = ContextAssembler.for_model("claude" if model_profile == "claude" else "medgemma")
    selected = assembler.assemble([piece for piece in pieces if piece.content.strip()])
    if not selected:
        return "", False
    return assembler.format_prompt(selected), True


def _build_episodic_memory_context(request: ChatRequest) -> str:
    """Format long-term Abby memory retrieved from ChromaDB for prompt injection."""
    if request.user_id is None:
        return ""

    try:
        memories = query_user_conversations(
            request.message,
            request.user_id,
            top_k=3,
        )
    except Exception as e:
        logger.warning("User memory retrieval failed for user %s: %s", request.user_id, e)
        return ""

    if not memories:
        return ""

    lines = ["Relevant prior Abby conversations:"]
    seen: set[str] = set()
    for memory in memories:
        text = _clean_grounded_text(str(memory.get("text", "") or ""))
        if not text or text in seen:
            continue
        seen.add(text)

        if len(text) > 300:
            text = text[:300].rstrip() + "..."

        page_context = str(memory.get("page_context", "") or "").strip()
        prefix = "- Previous Abby exchange"
        if page_context:
            prefix += f" [{page_context}]"
        lines.append(f"{prefix}: {text}")

    return "\n".join(lines) if len(lines) > 1 else ""


def _build_chat_system_prompt(
    request: ChatRequest,
    model_profile: str = "medgemma",
    *,
    session: dict | None = None,
    safety_metadata: dict[str, Any] | None = None,
) -> str:
    """Build the system prompt for a chat request.

    Four context enrichment steps (each only injected when relevant):
      1. Help knowledge — static help docs for the current page context
      2. RAG retrieval — ChromaDB semantic search across knowledge base
      3. Live database — real-time query of Parthenon's concept sets, cohorts, analyses
      4. Page data — entity-specific data passed from the frontend
    """
    started = time.perf_counter()
    help_ms = 0.0
    rag_ms = 0.0
    live_ms = 0.0
    dq_ms = 0.0
    institutional_ms = 0.0

    page_prompt = PAGE_SYSTEM_PROMPTS.get(
        request.page_context, PAGE_SYSTEM_PROMPTS["general"]
    )
    compact = model_profile != "claude"
    system_prompt = (COMPACT_CAPABILITY_PREAMBLE if compact else CAPABILITY_PREAMBLE) + page_prompt
    context_pieces: list[ContextPiece] = []
    session_state = session or _get_session(request.conversation_id)

    # ── Step 0: Working + episodic memory ───────────────────────────────────
    intent_context = session_state["intent_stack"].get_context_string()
    if intent_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.WORKING,
                content=intent_context,
                relevance=0.85,
                tokens=_estimate_tokens(intent_context),
                source="intent_stack",
            )
        )

    scratch_context = session_state["scratch_pad"].get_context_string()
    if scratch_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.WORKING,
                content=scratch_context,
                relevance=0.7,
                tokens=_estimate_tokens(scratch_context),
                source="scratch_pad",
            )
        )

    episodic_context = _build_episodic_memory_context(request)
    if episodic_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.EPISODIC,
                content=episodic_context,
                relevance=0.88,
                tokens=_estimate_tokens(episodic_context),
                source="conversation_memory",
            )
        )

    # ── Step 1: Help knowledge (static, page-specific) ──────────────────────
    help_started = time.perf_counter()
    help_context = _get_help_context(request.page_context)
    help_ms = (time.perf_counter() - help_started) * 1000
    if help_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.PAGE,
                content=help_context,
                relevance=0.55,
                tokens=_estimate_tokens(help_context),
                source="help",
            )
        )

    # ── Step 2: RAG retrieval (ChromaDB semantic search) ─────────────────────
    rag_context = ""
    rag_started = time.perf_counter()
    try:
        rag_context = build_rag_context(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
        if rag_context:
            context_pieces.append(
                ContextPiece(
                    tier=ContextTier.SEMANTIC,
                    content=rag_context,
                    relevance=0.9,
                    tokens=_estimate_tokens(rag_context),
                    source="rag",
                )
            )
    except Exception as e:
        logger.warning("RAG context retrieval failed: %s", e)
    finally:
        rag_ms = (time.perf_counter() - rag_started) * 1000

    # ── Step 3: Live database context (only when query needs it) ─────────────
    live_context = ""
    live_started = time.perf_counter()
    try:
        if not _should_skip_live_context(request, rag_context):
            from app.chroma.live_context import query_live_context
            live_context = query_live_context(request.message, request.page_context)
            if live_context:
                context_pieces.append(
                    ContextPiece(
                        tier=ContextTier.LIVE,
                        content=live_context,
                        relevance=0.95,
                        tokens=_estimate_tokens(live_context),
                        source="live_context",
                    )
                )
    except Exception as e:
        logger.warning("Live database context failed: %s", e)
    finally:
        live_ms = (time.perf_counter() - live_started) * 1000

    # ── Step 4: Page data (entity-specific frontend context) ─────────────────
    if request.user_profile and request.user_profile.name:
        role_str = ", ".join(request.user_profile.roles) if request.user_profile.roles else "researcher"
        user_context = (
            f"\n\nYou are assisting {request.user_profile.name}, "
            f"who has roles: {role_str}."
        )
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.WORKING,
                content=user_context,
                relevance=0.45,
                tokens=_estimate_tokens(user_context),
                source="user_profile",
            )
        )

    # User research profile context (from memory learning)
    if request.user_profile and request.user_profile.research_profile:
        rp = request.user_profile.research_profile
        profile = MemoryUserProfile.from_dict(rp.model_dump())
        profile_context = profile.get_context_string()
        if profile_context:
            profile_text = f"USER RESEARCH PROFILE: {profile_context}"
            context_pieces.append(
                ContextPiece(
                    tier=ContextTier.WORKING,
                    content=profile_text,
                    relevance=0.5,
                    tokens=_estimate_tokens(profile_text),
                    source="learned_profile",
                )
            )

    if request.page_data:
        context_lines = []
        for key, val in request.page_data.items():
            if isinstance(val, (str, int, float, bool)):
                context_lines.append(f"  {key}: {val}")
            elif isinstance(val, list) and len(val) <= 5:
                context_lines.append(f"  {key}: {', '.join(str(v) for v in val)}")
        if context_lines:
            page_context_block = "CURRENT PAGE CONTEXT:\n" + "\n".join(context_lines)
            context_pieces.append(
                ContextPiece(
                    tier=ContextTier.PAGE,
                    content=page_context_block,
                    relevance=0.8,
                    tokens=_estimate_tokens(page_context_block),
                    source="page_data",
                )
            )

    # ── Step 5: Data quality warnings (safety-critical, always when relevant) ──
    if _should_include_data_quality_context(request):
        dq_started = time.perf_counter()
        try:
            profile_service = _get_data_profile_service()
            person_count = profile_service.get_person_count()
            domain_density = profile_service.get_domain_density()
            temporal_coverage = profile_service.get_temporal_coverage()
            warnings = profile_service.detect_data_gaps(
                person_count=person_count,
                domain_density=domain_density,
                temporal_coverage=temporal_coverage,
            )

            relevant_warnings = []
            msg_lower = request.message.lower()
            for w in warnings:
                if w.severity == "critical":
                    relevant_warnings.append(w)
                elif w.domain.lower() in msg_lower or w.domain == "all":
                    relevant_warnings.append(w)

            if relevant_warnings:
                warning_text = profile_service.format_warnings(relevant_warnings)
                context_pieces.append(
                    ContextPiece(
                        tier=ContextTier.LIVE,
                        content=warning_text,
                        relevance=1.0,
                        tokens=_estimate_tokens(warning_text),
                        source="data_quality",
                        is_safety_critical=True,
                    )
                )
        except Exception as e:
            logger.warning("Data quality warning injection failed: %s", e)
        finally:
            dq_ms = (time.perf_counter() - dq_started) * 1000

    # ── Step 6: Institutional knowledge surfacing ─────────────────────────
    if _should_include_institutional_context(request):
        institutional_started = time.perf_counter()
        try:
            surfacer = _get_knowledge_surfacer()
            if surfacer is not None:
                suggestions = surfacer.suggest(request.message)
                if suggestions:
                    institutional_text = surfacer.format_for_prompt(suggestions)
                    context_pieces.append(
                        ContextPiece(
                            tier=ContextTier.INSTITUTIONAL,
                            content=institutional_text,
                            relevance=0.6,
                            tokens=_estimate_tokens(institutional_text),
                            source="institutional",
                        )
                    )
        except Exception as e:
            logger.warning("Knowledge surfacing failed: %s", e)
        finally:
            institutional_ms = (time.perf_counter() - institutional_started) * 1000

    context_pieces = _apply_cloud_safety_filter(model_profile, context_pieces, safety_metadata)

    context_block, _ = _build_context_block(model_profile, context_pieces)
    if context_block:
        system_prompt += "\n\n" + context_block

    # ── Grounding rules ──────────────────────────────────────────────────────
    has_grounding_context = bool(rag_context or live_context)
    if has_grounding_context:
        system_prompt += (
            "\n\nGROUNDING RULES:"
            "\n- Base your answer PRIMARILY on the KNOWLEDGE BASE and LIVE PLATFORM DATA provided above."
            "\n- If the KNOWLEDGE BASE contains a direct definition or identification for the user's question, paraphrase THAT material first and keep the answer narrow."
            "\n- When citing specific concept sets, cohort definitions, or analyses, use ONLY the data from LIVE PLATFORM DATA. These are real entities in the user's Parthenon instance."
            "\n- When citing studies, papers, or researchers, use ONLY information from the KNOWLEDGE BASE. Do NOT invent paper titles, author names, or study details."
            "\n- Do NOT add schema names, table names, metrics, or implementation details unless they are explicitly present in the supplied context."
            "\n- If the provided context does not contain enough information, say so explicitly."
            "\n- You MAY use your general medical training knowledge for explanations, definitions, and context — but NEVER fabricate specific claims."
        )
    else:
        system_prompt += (
            "\n\nNOTE: No relevant documents or platform data were found for this query. "
            "Answer using your general knowledge but be transparent about limitations. "
            "Do NOT fabricate specific paper titles, researcher names, concept sets, or study details."
        )

    system_prompt += _build_response_format_rules(compact=compact)

    _log_latency(
        "abby_prompt_build",
        model_profile=model_profile,
        page_context=request.page_context,
        total_ms=(time.perf_counter() - started) * 1000,
        help_ms=help_ms,
        rag_ms=rag_ms,
        live_ms=live_ms,
        dq_ms=dq_ms,
        institutional_ms=institutional_ms,
        prompt_chars=len(system_prompt),
        prompt_tokens_est=_estimate_tokens(system_prompt),
        context_pieces=len(context_pieces),
        history_turns=len(request.history[-10:]) if request.history else 0,
        rag_chars=len(rag_context),
        live_chars=len(live_context),
    )

    return system_prompt


def _strip_thinking_tokens(text: str) -> str:
    """Strip internal thinking/reasoning tokens from output.

    Supported formats:
    - MedGemma: <unused94>thought...content<unused95>
    - Qwen/Ollama reasoning models: <think> ... </think>
    """
    import re

    # Remove <unused94>thought....<unused95> blocks (thinking tokens)
    text = re.sub(r"<unused94>.*?<unused95>", "", text, flags=re.DOTALL)
    # Remove orphaned thinking markers
    text = re.sub(r"<unused\d+>", "", text)
    # Remove closed Qwen-style thinking blocks.
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # If the response is only an unfinished <think> block, drop it entirely.
    text = re.sub(r"^\s*<think>.*\Z", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE)
    # Some Ollama/Gemma responses leak a plain leading "thought" line.
    text = re.sub(r"^\s*thought\s*\n+", "", text, flags=re.IGNORECASE)

    # Qwen-family models can occasionally leak plain-text meta reasoning even
    # with thinking disabled. When we see multi-paragraph "let me think"
    # scaffolding, keep only the trailing user-facing answer paragraphs.
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    meta_markers = (
        "the user is asking",
        "the user wants",
        "the user's role",
        "they want",
        "let me check",
        "let me phrase",
        "looking at",
        "i should summarize",
        "i'll stick with",
        "need to make sure",
        "keep it to one sentence",
        "check if that's covered",
        "the answer should",
        "the most concise way",
        "double-checking",
        "therefore",
        "the correct term",
        "that's one sentence",
    )
    if len(paragraphs) > 1 and any(marker in "\n\n".join(paragraphs[:-1]).lower() for marker in meta_markers):
        kept: list[str] = []
        for paragraph in reversed(paragraphs):
            lowered = paragraph.lower()
            if not kept:
                kept.append(paragraph)
                continue
            if any(marker in lowered for marker in meta_markers):
                break
            kept.append(paragraph)
        text = "\n\n".join(reversed(kept))

    return text.strip()


def _extract_suggestions(raw: str) -> tuple[str, list[str]]:
    """Extract suggestion chips from the LLM reply and clean output.

    Handles two formats:
      1. JSON array (instructed format):
            SUGGESTIONS: ["What next?", "How to fix?"]
      2. Singular plain-text lines (what MedGemma actually produces):
            Suggestion: Would you like to explore cohort design?
            Suggestion: Are you interested in specific medications?
    """
    import re

    suggestions: list[str] = []
    reply = _strip_thinking_tokens(raw.strip())

    # ── Format 1: SUGGESTIONS: ["...", "..."] ────────────────────────────────
    if "SUGGESTIONS:" in reply:
        parts = reply.rsplit("SUGGESTIONS:", 1)
        reply = parts[0].strip()
        try:
            suggestions = json.loads(parts[1].strip())
            if not isinstance(suggestions, list):
                suggestions = []
        except (json.JSONDecodeError, IndexError):
            suggestions = []
        return reply, suggestions[:3]

    # ── Format 2: Suggestion: text  (MedGemma's actual output) ───────────────
    suggestion_pattern = re.compile(r"Suggestion:\s*(.+?)(?=Suggestion:|$)", re.IGNORECASE | re.DOTALL)
    matches = suggestion_pattern.findall(reply)
    if matches:
        suggestions = [m.strip().rstrip("?. ") + "?" if not m.strip().endswith("?") else m.strip()
                       for m in matches]
        # Strip all Suggestion: lines from the reply body
        reply = re.sub(r"\s*Suggestion:\s*.+?(?=Suggestion:|$)", "", reply,
                       flags=re.IGNORECASE | re.DOTALL).strip()

    return reply, suggestions[:3]


_INCOMPLETE_REPLY_TAIL_WORDS = {
    "a", "an", "and", "as", "at", "based", "by", "for", "from", "in", "including",
    "into", "like", "of", "on", "or", "such", "than", "that", "the", "their", "this",
    "to", "using", "which", "with", "without",
}


def _looks_truncated_visible_reply(reply: str) -> bool:
    """Detect obviously clipped user-facing replies from the local model."""
    cleaned = _strip_thinking_tokens(reply).strip()
    if not cleaned:
        return False
    if cleaned.endswith(("...", "…")):
        return True
    if cleaned[-1] in '.!?"\')]}':
        return False

    if len(cleaned) >= 120:
        return True

    if len(cleaned) < 80:
        return False

    last_words = re.findall(r"[a-z0-9]+", cleaned.lower())
    if not last_words:
        return False
    return last_words[-1] in _INCOMPLETE_REPLY_TAIL_WORDS


def _needs_visible_reply_retry(raw: str, reply: str) -> bool:
    """Detect local-model outputs that are empty or visibly clipped."""
    if reply.strip():
        return _looks_truncated_visible_reply(reply)
    stripped = raw.lstrip()
    return stripped.startswith("<think>") or "<unused94>" in stripped


async def _retry_local_visible_reply(
    system_prompt: str,
    user_message: str,
    history: list[ChatMessage] | None,
    num_predict: int,
    config: Any = settings,
) -> tuple[str, list[str]]:
    """Retry once with stronger instructions and a much larger token budget."""
    retry_prompt = (
        f"{system_prompt}\n\n"
        "Return only the final user-facing answer."
        " Do not emit <think> tags, internal reasoning, or hidden scratch work."
        " Start immediately with the answer."
    )
    retry_budget = max(num_predict * 2, 1600)
    raw_retry = await call_ollama(
        system_prompt=retry_prompt,
        user_message=user_message,
        history=history,
        temperature=0.1,
        num_predict=retry_budget,
        config=config,
    )
    return _extract_suggestions(raw_retry)


def _should_store_conversation_answer(answer: str) -> bool:
    """Avoid persisting clipped or clearly low-quality Abby answers."""
    cleaned = _strip_thinking_tokens(answer).strip()
    if not cleaned or _looks_truncated_visible_reply(cleaned):
        return False
    return not re.match(r"^(results?|methods?|background|objective|conclusions?)\b[:\s-]", cleaned, re.IGNORECASE)


def _detect_request_topic(message: str) -> str:
    """Derive a coarse working-memory topic from the incoming request."""
    from app.memory.profile_learner import DOMAIN_KEYWORDS

    msg_lower = message.lower()
    detected_topics = [
        domain for domain, keywords in DOMAIN_KEYWORDS.items()
        if any(keyword in msg_lower for keyword in keywords)
    ]
    return detected_topics[0] if detected_topics else message[:80]


def _prepare_chat_session(request: ChatRequest) -> dict:
    """Advance and refresh the per-conversation working-memory session."""
    session = _get_session(request.conversation_id)
    session["turn"] += 1
    turn = session["turn"]
    session["intent_stack"].prune(current_turn=turn)
    session["intent_stack"].push(_detect_request_topic(request.message), turn=turn)
    return session


def _should_store_conversation_turn(
    request: ChatRequest,
    answer: str,
    *,
    routing_reason: str,
) -> bool:
    """Only retain durable, non-generic conversation turns in Abby memory."""
    if not _should_store_conversation_answer(answer):
        return False
    if routing_reason == "grounded_definition":
        return False
    return True


def _learn_user_profile_from_turn(user_id: int, question: str, answer: str) -> None:
    """Update the learned Abby user profile from a completed turn."""
    learner = ProfileLearner()
    profile_data = _fetch_user_profile(user_id)
    profile = MemoryUserProfile.from_dict(profile_data) if profile_data else MemoryUserProfile()
    messages_for_learning = [
        {"role": "user", "content": question},
        {"role": "assistant", "content": answer},
    ]
    updated_profile = learner.learn_from_conversation(profile, messages_for_learning)
    _save_user_profile(user_id, updated_profile.to_dict())


def _post_process_chat_turn(
    request: ChatRequest,
    reply: str,
    *,
    routing_reason: str,
) -> None:
    """Persist Abby memory/profile updates after a completed response."""
    if request.user_id is not None and _should_store_conversation_turn(
        request,
        reply,
        routing_reason=routing_reason,
    ):
        try:
            store_conversation_turn(
                user_id=request.user_id,
                question=request.message,
                answer=reply,
                page_context=request.page_context,
            )
        except Exception as e:
            logger.warning("Failed to store conversation memory: %s", e)
    elif request.user_id is not None:
        logger.info("Skipping conversation memory storage for low-quality Abby answer")

    if request.user_id is not None:
        try:
            _learn_user_profile_from_turn(request.user_id, request.message, reply)
        except Exception:
            logger.exception("Profile learning failed (non-blocking)")


def _fetch_user_profile(user_id: int) -> dict | None:
    """Fetch user's research profile from PostgreSQL."""
    try:
        from sqlalchemy import text
        with _get_shared_engine().connect() as conn:
            row = conn.execute(
                text("""
                    SELECT research_interests, expertise_domains,
                           interaction_preferences, frequently_used
                    FROM app.abby_user_profiles WHERE user_id = :uid
                """),
                {"uid": user_id},
            ).fetchone()
            if row:
                return {
                    "research_interests": row[0] or [],
                    "expertise_domains": row[1] or {},
                    "interaction_preferences": row[2] or {},
                    "frequently_used": row[3] or {},
                }
    except Exception:
        logger.exception("Failed to fetch user profile")
    return None


def _user_exists(user_id: int) -> bool:
    """Return True when the referenced app user exists."""
    try:
        from sqlalchemy import text

        with _get_shared_engine().connect() as conn:
            exists = conn.execute(
                text("SELECT EXISTS(SELECT 1 FROM app.users WHERE id = :uid)"),
                {"uid": user_id},
            ).scalar()
            return bool(exists)
    except Exception:
        logger.exception("Failed to validate Abby user id")
        return False


def _save_user_profile(user_id: int, profile_data: dict) -> None:
    """Upsert user's research profile to PostgreSQL."""
    try:
        import json as json_mod
        from sqlalchemy import text

        if not _user_exists(user_id):
            logger.info("Skipping Abby user profile save for missing user_id=%s", user_id)
            return

        with _get_shared_engine().connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO app.abby_user_profiles (user_id, research_interests,
                        expertise_domains, interaction_preferences, frequently_used, updated_at)
                    VALUES (:uid, CAST(:interests AS text[]), CAST(:expertise AS jsonb),
                            CAST(:prefs AS jsonb), CAST(:freq AS jsonb), NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        research_interests = EXCLUDED.research_interests,
                        expertise_domains = EXCLUDED.expertise_domains,
                        interaction_preferences = EXCLUDED.interaction_preferences,
                        frequently_used = EXCLUDED.frequently_used,
                        updated_at = NOW()
                """),
                {
                    "uid": user_id,
                    "interests": profile_data.get("research_interests", []),
                    "expertise": json_mod.dumps(profile_data.get("expertise_domains", {})),
                    "prefs": json_mod.dumps(profile_data.get("interaction_preferences", {})),
                    "freq": json_mod.dumps(profile_data.get("frequently_used", {})),
                },
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to save user profile")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Page-aware conversational endpoint. Abby adapts her persona and focus
    based on the current UI page and any entity data passed from the frontend.

    Abby stays on local Ollama/MedGemma by default. Optional cloud routing only
    runs when explicitly enabled by configuration.
    """
    request_started = time.perf_counter()
    session = _prepare_chat_session(request)
    effective_config = _effective_chat_config(request.provider_policy)

    route_decision = _resolve_abby_chat_route(request.message, config=effective_config)
    routing = route_decision.routing
    local_num_predict = _get_local_num_predict(request.page_context)
    safety_metadata = _empty_safety_metadata(route_decision.profile.prompt_profile)
    system_prompt = _build_chat_system_prompt(
        request,
        model_profile=route_decision.profile.prompt_profile,
        session=session,
        safety_metadata=safety_metadata,
    )
    if routing.model == "claude" and safety_metadata.get("cloud_safety_blocked"):
        logger.warning(
            "Cloud safety filter blocked %d context piece(s), falling back to local",
            safety_metadata.get("blocked_context_count", 0),
        )
        route_decision = force_local_abby_route(
            config=effective_config,
            reason="cloud_safety_blocked",
            requested_profile=route_decision.profile,
        )
        routing = route_decision.routing
        safety_metadata = _empty_safety_metadata("medgemma")
        system_prompt = _build_chat_system_prompt(
            request,
            model_profile=route_decision.profile.prompt_profile,
            session=session,
            safety_metadata=safety_metadata,
        )

    reply = ""
    suggestions: list[str] = []
    sources: list[dict[str, object]] = []
    grounded_definition_reply, grounded_sources = _try_grounded_definition_answer(request)
    if grounded_definition_reply:
        reply = grounded_definition_reply
        sources = grounded_sources
        route_decision = force_local_abby_route(config=effective_config, reason="grounded_definition")
        routing = route_decision.routing

    # Populate sources from RAG results when not grounded (so the UI can show citations)
    if not sources:
        try:
            rag_results = get_ranked_rag_results(
                query=request.message,
                page_context=request.page_context,
                user_id=request.user_id,
            )
            sources = [
                {
                    "source_label": str(r.get("source_label", "")),
                    "title": str(r.get("title", "")),
                    "section": str(r.get("section", "")),
                    "score": float(str(r.get("score", 0) or 0)),
                }
                for r in rag_results[:5]
                if float(str(r.get("score", 0) or 0)) >= 0.5
            ]
        except Exception:
            logger.debug("Source extraction for response failed (non-blocking)")

    if not reply and routing.model == "claude":
        # Cloud path: PHI sanitization + cloud safety filter
        # Build history_dicts first so we can include history content in PHI scan
        history_dicts = [{"role": m.role, "content": m.content} for m in request.history]
        # Scan only user-supplied text (message + history) for PHI.
        # The system prompt contains curated knowledge base content (paper
        # titles, author names, clinical terms) which triggers false positives.
        user_text = request.message
        for h in history_dicts:
            user_text += "\n" + h.get("content", "")
        phi_result = _phi_sanitizer.scan(user_text)

        if phi_result.phi_detected and getattr(effective_config, "phi_block_on_detection", settings.phi_block_on_detection):
            logger.warning(
                "PHI detected in cloud-bound prompt, falling back to local. "
                "Redactions: %d", phi_result.redaction_count,
            )
            route_decision = force_local_abby_route(
                config=effective_config,
                reason="phi_blocked",
                requested_profile=route_decision.profile,
            )
            routing = route_decision.routing
            safety_metadata = _empty_safety_metadata("medgemma")
            system_prompt = _build_chat_system_prompt(
                request,
                model_profile=route_decision.profile.prompt_profile,
                session=session,
                safety_metadata=safety_metadata,
            )
        else:
            # Safe to send to the selected cloud adapter.
            try:
                cloud_adapter = _build_cloud_chat_adapter(route_decision.profile, config=effective_config)
                cloud_response = await cloud_adapter.chat(
                    ChatAdapterRequest(
                        system_prompt=system_prompt,
                        message=phi_result.redacted_text if phi_result.redaction_count > 0 else request.message,
                        history=cast(list[dict[str, str]], history_dicts),
                    )
                )
                reply = cloud_response.reply

                cost_tracker = _get_cost_tracker()
                cost_tracker.record_usage(
                    user_id=request.user_id,
                    tokens_in=cloud_response.tokens_in,
                    tokens_out=cloud_response.tokens_out,
                    cost_usd=cloud_response.cost_usd,
                    model=cloud_response.model,
                    request_hash=cloud_response.request_hash,
                    redaction_count=phi_result.redaction_count,
                    route_reason=routing.reason,
                    provider=cloud_response.provider,
                    transport=cloud_response.transport,
                    provider_profile_id=route_decision.profile.id,
                    entitlement_type=route_decision.profile.entitlement,
                    status="success",
                    response_latency_ms=cloud_response.latency_ms,
                    usage_metadata={
                        "requested_profile_id": route_decision.requested_profile.id
                        if route_decision.requested_profile is not None
                        else None,
                        "fallback_profile_ids": [profile.id for profile in route_decision.fallback_profiles],
                    },
                )
                reply, suggestions = _extract_suggestions(reply)
            except ChatAdapterError as exc:
                logger.exception(
                    "Cloud adapter failed (%s), falling back to local",
                    exc.error_class,
                )
                route_decision = force_local_abby_route(
                    config=effective_config,
                    reason=exc.error_class,
                    requested_profile=route_decision.profile,
                )
                routing = route_decision.routing
                safety_metadata = _empty_safety_metadata("medgemma")
                system_prompt = _build_chat_system_prompt(
                    request,
                    model_profile=route_decision.profile.prompt_profile,
                    session=session,
                    safety_metadata=safety_metadata,
                )
            except Exception:
                logger.exception("Cloud API call failed, falling back to local")
                route_decision = force_local_abby_route(
                    config=effective_config,
                    reason="claude_error",
                    requested_profile=route_decision.profile,
                )
                routing = route_decision.routing
                safety_metadata = _empty_safety_metadata("medgemma")
                system_prompt = _build_chat_system_prompt(
                    request,
                    model_profile=route_decision.profile.prompt_profile,
                    session=session,
                    safety_metadata=safety_metadata,
                )

    if not reply and routing.model == "local":
        # Local path: MedGemma via Ollama (existing behavior)
        raw = await call_ollama(
            system_prompt=system_prompt,
            user_message=request.message,
            history=request.history,
            temperature=0.15,
            num_predict=local_num_predict,
            config=effective_config,
        )
        reply, suggestions = _extract_suggestions(raw)
        if _needs_visible_reply_retry(raw, reply):
            logger.warning(
                "Local Abby reply contained only hidden reasoning; retrying with larger token budget"
            )
            reply, suggestions = await _retry_local_visible_reply(
                system_prompt=system_prompt,
                user_message=request.message,
                history=request.history,
                num_predict=local_num_predict,
                config=effective_config,
            )

    _post_process_chat_turn(request, reply, routing_reason=routing.reason)
    _audit_local_route_decision(
        route_decision,
        request,
        safety_metadata=safety_metadata,
    )

    # Check for FAQ promotion (non-blocking)
    try:
        from app.institutional.faq_promoter import FAQPromoter
        faq = FAQPromoter(engine=_get_shared_engine())
        faq.check_and_promote(question=request.message, answer=reply)
    except Exception:
        logger.debug("FAQ promotion check failed (non-blocking)")

    # Confidence indicator
    confidence = "medium"
    if routing.model == "claude":
        confidence = "high"
    elif routing.reason == "budget_exhausted":
        confidence = "low"
        reply = (
            "*Note: This response was generated locally due to usage limits. "
            "For a more thorough analysis, try again later.*\n\n" + reply
        )

    _log_latency(
        "abby_chat_request",
        model=routing.model,
        route_reason=routing.reason,
        page_context=request.page_context,
        total_ms=(time.perf_counter() - request_started) * 1000,
        reply_chars=len(reply),
        suggestions=len(suggestions),
        history_turns=len(request.history[-10:]) if request.history else 0,
    )

    return ChatResponse(
        reply=reply,
        suggestions=suggestions,
        routing={
            **_routing_payload(
                routing,
                safety_metadata=safety_metadata,
                route_decision=route_decision,
            ),
        },
        confidence=confidence,
        sources=sources,
    )


class ExecutePlanRequest(BaseModel):
    plan_id: str
    user_id: int


@router.post("/execute-plan")
async def execute_plan_endpoint(request: ExecutePlanRequest) -> dict:
    """Execute an approved agency plan by plan_id."""
    engine = _get_plan_engine()
    plan = engine.get_plan(request.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or expired")
    if plan.user_id != request.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to execute this plan")
    engine.approve_plan(plan)
    result = await engine.execute_plan(plan)
    return result.to_dict()


async def _stream_ollama(system_prompt: str, user_message: str,
                         history: list[ChatMessage] | None = None,
                         temperature: float = 0.3,
                         num_predict: int | None = None,
                         sources: list[dict[str, object]] | None = None,
                         on_complete: Callable[[str, list[str]], None] | None = None,
                         config: Any = settings) -> AsyncGenerator[str, None]:
    """Stream tokens from Ollama as SSE events."""
    started = time.perf_counter()
    full_content = ""
    visible_content = ""
    first_token_ms: float | None = None
    final_data: dict[str, Any] | None = None
    pending = ""
    suppress_reasoning: bool | None = None
    local_profile_id = getattr(config, "abby_local_chat_profile_id", settings.abby_local_chat_profile_id)
    local_profile = build_default_provider_profiles(config)[local_profile_id]
    adapter = OllamaChatAdapter(
        profile=local_profile,
        client=_get_ollama_http_client(),
        default_num_predict=getattr(config, "ollama_num_predict", settings.ollama_num_predict),
        keep_alive_seconds=getattr(config, "abby_ollama_keep_alive", settings.abby_ollama_keep_alive),
        timeout_seconds=getattr(config, "ollama_timeout", settings.ollama_timeout),
        estimate_tokens=_estimate_tokens,
        ns_to_ms=_ns_to_ms,
    )

    try:
        async for event in adapter.stream(
            ChatAdapterRequest(
                system_prompt=system_prompt,
                message=user_message,
                history=[
                    {"role": msg.role, "content": msg.content}
                    for msg in (history or [])[-10:]
                ],
                temperature=temperature,
                max_output_tokens=num_predict,
            )
        ):
            if event.kind == "complete":
                first_token_ms = cast(float | None, event.payload.get("first_token_ms"))
                final_data = cast(dict[str, Any] | None, event.payload.get("final_data"))
                full_content = str(event.payload.get("full_content", full_content))
                continue
            if event.kind != "token":
                continue
            token = event.token
            full_content += token
            pending += token
            if suppress_reasoning is None:
                stripped_pending = pending.lstrip()
                if stripped_pending.startswith("<think>") or stripped_pending.startswith("<unused94>"):
                    suppress_reasoning = True
                elif len(pending) >= 16:
                    suppress_reasoning = False

            if suppress_reasoning is True:
                cleaned = _strip_thinking_tokens(pending)
                if cleaned:
                    visible_content += cleaned
                    yield f"data: {json.dumps({'token': cleaned})}\n\n"
                    pending = ""
                    suppress_reasoning = False
            elif suppress_reasoning is False:
                visible_content += pending
                yield f"data: {json.dumps({'token': pending})}\n\n"
                pending = ""
    except ChatAdapterError as exc:
        logger.error("Ollama streaming failed (%s): %s", exc.error_class, exc)
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"
        return
    except Exception as exc:
        logger.error("Ollama streaming failed: %s", exc)
        yield f"data: {json.dumps({'error': f'LLM service unavailable: {exc}'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # Extract suggestions from complete response
    if pending and suppress_reasoning is not True:
        visible_content += pending
        yield f"data: {json.dumps({'token': pending})}\n\n"

    _, suggestions = _extract_suggestions(full_content)
    if not visible_content.strip() and _needs_visible_reply_retry(full_content, visible_content):
        logger.warning(
            "Local Abby stream contained only hidden reasoning; retrying with larger token budget"
        )
        retry_reply, retry_suggestions = await _retry_local_visible_reply(
            system_prompt=system_prompt,
            user_message=user_message,
            history=history,
            num_predict=num_predict if num_predict is not None else settings.ollama_num_predict,
        )
        if retry_reply:
            visible_content += retry_reply
            yield f"data: {json.dumps({'token': retry_reply})}\n\n"
        if retry_suggestions:
            suggestions = retry_suggestions
    if suggestions:
        yield f"data: {json.dumps({'suggestions': suggestions})}\n\n"
    if sources:
        yield f"data: {json.dumps({'sources': sources})}\n\n"

    if on_complete is not None:
        try:
            on_complete((visible_content or full_content).strip(), suggestions)
        except Exception:
            logger.exception("Abby stream post-processing failed")

    yield "data: [DONE]\n\n"

    _log_latency(
        "abby_ollama_stream",
        model=local_profile.model,
        base_url=local_profile.base_url,
        total_ms=(time.perf_counter() - started) * 1000,
        first_token_ms=first_token_ms,
        prompt_chars=len(system_prompt),
        prompt_tokens_est=_estimate_tokens(system_prompt),
        message_chars=len(user_message),
        num_predict=num_predict if num_predict is not None else getattr(config, "ollama_num_predict", settings.ollama_num_predict),
        history_turns=len(history[-10:]) if history else 0,
        response_chars=len(visible_content or full_content),
        load_ms=_ns_to_ms(final_data.get("load_duration")) if final_data else None,
        prompt_eval_ms=_ns_to_ms(final_data.get("prompt_eval_duration")) if final_data else None,
        eval_ms=_ns_to_ms(final_data.get("eval_duration")) if final_data else None,
        ollama_total_ms=_ns_to_ms(final_data.get("total_duration")) if final_data else None,
        prompt_eval_count=final_data.get("prompt_eval_count") if final_data else None,
        eval_count=final_data.get("eval_count") if final_data else None,
    )


async def _stream_claude_response(
    system_prompt: str,
    user_message: str,
    history: list[ChatMessage] | None = None,
    sources: list[dict[str, object]] | None = None,
    request_hash: str | None = None,
    request_user_id: int | None = None,
    route_reason: str = "claude_stream",
    on_complete: Callable[[str, list[str]], None] | None = None,
    config: Any = settings,
    cloud_profile: Any | None = None,
) -> AsyncGenerator[str, None]:
    """Stream tokens from Claude as SSE events."""
    started = time.perf_counter()
    history_dicts: list[dict[str, Any]] = (
        [{"role": msg.role, "content": msg.content} for msg in history[-10:]] if history else []
    )
    full_content = ""
    final_model = getattr(config, "claude_model", settings.claude_model)
    tokens_in = 0
    tokens_out = 0
    cost_usd = 0.0
    cloud_profile = cloud_profile or _selected_cloud_profile(config)
    try:
        adapter = _build_cloud_chat_adapter(cloud_profile, config=config)
    except ChatAdapterError as exc:
        yield f"data: {json.dumps({'error': f'Cloud API unavailable: {exc}'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        async for event in adapter.stream(
            ChatAdapterRequest(
                system_prompt=system_prompt,
                message=user_message,
                history=cast(list[dict[str, str]], history_dicts),
                max_output_tokens=getattr(config, "claude_max_tokens", settings.claude_max_tokens),
            )
        ):
            if event.kind == "token":
                token = event.token
                full_content += token
                yield f"data: {json.dumps({'token': token})}\n\n"
                continue

            if event.kind == "error":
                message = event.payload.get("message", "unknown error")
                error_class = event.payload.get("error_class", "provider_error")
                logger.error("Cloud streaming failed (%s): %s", error_class, message)
                yield f"data: {json.dumps({'error': f'Cloud API unavailable: {message}'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            if event.kind == "complete":
                full_content = str(event.payload.get("full_content", full_content))
                final_model = str(event.payload.get("model", final_model))
                tokens_in = int(event.payload.get("tokens_in", 0) or 0)
                tokens_out = int(event.payload.get("tokens_out", 0) or 0)
                cost_usd = float(event.payload.get("cost_usd", 0.0) or 0.0)
    except ChatAdapterError as exc:
        logger.error("Cloud streaming failed (%s): %s", exc.error_class, exc)
        yield f"data: {json.dumps({'error': f'Cloud API unavailable: {exc}'})}\n\n"
        yield "data: [DONE]\n\n"
        return
    except Exception as exc:
        logger.exception("Cloud streaming failed")
        yield f"data: {json.dumps({'error': f'Cloud API unavailable: {exc}'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    _, suggestions = _extract_suggestions(full_content)
    if suggestions:
        yield f"data: {json.dumps({'suggestions': suggestions})}\n\n"
    if sources:
        yield f"data: {json.dumps({'sources': sources})}\n\n"

    if tokens_in > 0 or tokens_out > 0:
        try:
            _get_cost_tracker().record_usage(
                user_id=request_user_id,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost_usd,
                model=final_model,
                request_hash=request_hash or "",
                redaction_count=0,
                route_reason=route_reason,
                provider=cloud_profile.provider,
                transport=cloud_profile.transport,
                provider_profile_id=cloud_profile.id,
                entitlement_type=cloud_profile.entitlement,
                status="success",
                usage_metadata={
                    "streaming": True,
                    "fallback_profile_ids": list(cloud_profile.fallback_profile_ids),
                },
            )
        except Exception:
            logger.debug("Claude stream usage accounting failed", exc_info=True)

    if on_complete is not None:
        try:
            on_complete(full_content.strip(), suggestions)
        except Exception:
            logger.exception("Abby Claude stream post-processing failed")

    yield "data: [DONE]\n\n"

    _log_latency(
        "abby_claude_stream",
        model=final_model,
        route_reason=route_reason,
        total_ms=(time.perf_counter() - started) * 1000,
        prompt_chars=len(system_prompt),
        prompt_tokens_est=_estimate_tokens(system_prompt),
        message_chars=len(user_message),
        history_turns=len(history[-10:]) if history else 0,
        response_chars=len(full_content),
        tokens_in=tokens_in,
        tokens_out=tokens_out,
    )


async def _stream_chat_response(response: ChatResponse) -> AsyncGenerator[str, None]:
    """Emit a completed chat response over SSE for grounded/static answers."""
    if response.reply:
        for chunk in re.findall(r"\S+\s*|\n+", response.reply):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    if response.suggestions:
        yield f"data: {json.dumps({'suggestions': response.suggestions})}\n\n"
    if response.sources:
        yield f"data: {json.dumps({'sources': response.sources})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """
    SSE streaming version of the chat endpoint. Returns token-by-token
    responses as Server-Sent Events for real-time display in the UI.
    """
    started = time.perf_counter()
    session = _prepare_chat_session(request)
    effective_config = _effective_chat_config(request.provider_policy)
    grounded_definition_reply, grounded_sources = _try_grounded_definition_answer(request)
    if grounded_definition_reply:
        _post_process_chat_turn(request, grounded_definition_reply, routing_reason="grounded_definition")
        _log_latency(
            "abby_chat_stream_grounded",
            page_context=request.page_context,
            total_ms=(time.perf_counter() - started) * 1000,
            reply_chars=len(grounded_definition_reply),
            sources=len(grounded_sources),
        )
        return StreamingResponse(
            _stream_chat_response(
                ChatResponse(
                    reply=grounded_definition_reply,
                    suggestions=[],
                    routing=_routing_payload(
                        RoutingDecision(model="local", stage=0, reason="grounded_definition", confidence=1.0),
                        safety_metadata=_empty_safety_metadata("medgemma"),
                    ),
                    confidence="medium",
                    sources=grounded_sources,
                )
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    route_decision = _resolve_abby_chat_route(request.message, config=effective_config)
    routing = route_decision.routing
    safety_metadata = _empty_safety_metadata(route_decision.profile.prompt_profile)

    sources: list[dict[str, object]] = []
    try:
        rag_results = get_ranked_rag_results(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
        sources = [
            {
                "source_label": str(r.get("source_label", "")),
                "title": str(r.get("title", "")),
                "section": str(r.get("section", "")),
                "score": float(str(r.get("score", 0) or 0)),
            }
            for r in rag_results[:5]
            if float(str(r.get("score", 0) or 0)) >= 0.5
        ]
    except Exception:
        logger.debug("Source extraction for stream failed (non-blocking)")

    system_prompt = _build_chat_system_prompt(
        request,
        model_profile=route_decision.profile.prompt_profile,
        session=session,
        safety_metadata=safety_metadata,
    )
    local_num_predict = _get_local_num_predict(request.page_context)

    if routing.model == "claude" and safety_metadata.get("cloud_safety_blocked"):
        logger.warning(
            "Cloud safety filter blocked %d context piece(s), falling back to local stream",
            safety_metadata.get("blocked_context_count", 0),
        )
        route_decision = force_local_abby_route(
            config=effective_config,
            reason="cloud_safety_blocked",
            requested_profile=route_decision.profile,
        )
        routing = route_decision.routing
        safety_metadata = _empty_safety_metadata("medgemma")
        system_prompt = _build_chat_system_prompt(
            request,
            model_profile=route_decision.profile.prompt_profile,
            session=session,
            safety_metadata=safety_metadata,
        )

    if routing.model == "claude":
        history_dicts: list[dict[str, Any]] = [
            {"role": m.role, "content": m.content} for m in request.history
        ]
        user_text = request.message
        for history_item in history_dicts:
            user_text += "\n" + str(history_item.get("content", ""))
        phi_result = _phi_sanitizer.scan(user_text)
        if phi_result.phi_detected and getattr(effective_config, "phi_block_on_detection", settings.phi_block_on_detection):
            logger.warning(
                "PHI detected in cloud-bound prompt, falling back to local stream. Redactions: %d",
                phi_result.redaction_count,
            )
            route_decision = force_local_abby_route(
                config=effective_config,
                reason="phi_blocked",
                requested_profile=route_decision.profile,
            )
            routing = route_decision.routing
            safety_metadata = _empty_safety_metadata("medgemma")
            system_prompt = _build_chat_system_prompt(
                request,
                model_profile=route_decision.profile.prompt_profile,
                session=session,
                safety_metadata=safety_metadata,
            )
        else:
            request_hash = ClaudeClient._compute_hash(
                system_prompt=system_prompt,
                messages=cast(Any, [*history_dicts, {"role": "user", "content": request.message}]),
            )
            _log_latency(
                "abby_chat_stream_ready",
                model=routing.model,
                route_reason=routing.reason,
                page_context=request.page_context,
                total_ms=(time.perf_counter() - started) * 1000,
                prompt_chars=len(system_prompt),
                prompt_tokens_est=_estimate_tokens(system_prompt),
                history_turns=len(request.history[-10:]) if request.history else 0,
                sources=len(sources),
            )
            return StreamingResponse(
                _stream_claude_response(
                    system_prompt=system_prompt,
                    user_message=phi_result.redacted_text if phi_result.redaction_count > 0 else request.message,
                    history=request.history,
                    sources=sources,
                    request_hash=request_hash,
                    request_user_id=request.user_id,
                    route_reason=routing.reason,
                    config=effective_config,
                    cloud_profile=route_decision.profile,
                    on_complete=lambda reply, _suggestions: _post_process_chat_turn(
                        request,
                        reply,
                        routing_reason=routing.reason,
                    ),
                ),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

    _log_latency(
        "abby_chat_stream_ready",
        model=routing.model,
        route_reason=routing.reason,
        page_context=request.page_context,
        total_ms=(time.perf_counter() - started) * 1000,
        prompt_chars=len(system_prompt),
        prompt_tokens_est=_estimate_tokens(system_prompt),
        num_predict=local_num_predict,
        history_turns=len(request.history[-10:]) if request.history else 0,
        sources=len(sources),
    )

    def _complete_local_stream(reply: str, _suggestions: list[str]) -> None:
        _post_process_chat_turn(
            request,
            reply,
            routing_reason=routing.reason,
        )
        _audit_local_route_decision(
            route_decision,
            request,
            safety_metadata=safety_metadata,
            streaming=True,
        )

    return StreamingResponse(
        _stream_ollama(
            system_prompt=system_prompt,
            user_message=request.message,
            history=request.history,
            temperature=0.3,
            num_predict=local_num_predict,
            sources=sources,
            config=effective_config,
            on_complete=_complete_local_stream,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
