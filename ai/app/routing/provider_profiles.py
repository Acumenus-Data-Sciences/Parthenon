"""Provider-neutral Abby model profiles and chat routing policy.

This layer turns today's env-backed Ollama/Anthropic settings into named
profiles. It is intentionally small and deterministic so Laravel/admin settings
can later replace the env source without changing Abby's chat contract.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from app.routing.rule_router import RoutingDecision, RuleRouter


CAPABILITY_FLAGS: tuple[str, ...] = (
    "chat",
    "streaming",
    "structured_output",
    "json_mode",
    "embeddings",
    "tool_calling",
    "agent_loop",
    "long_context",
    "vision",
    "clinical_rag",
    "patient_level_local_only",
)

ENTITLEMENT_TYPES: tuple[str, ...] = (
    "local",
    "org_api_key",
    "user_api_key",
    "acumenus_managed_api",
    "external_subscription_app",
)

TRANSPORTS: tuple[str, ...] = (
    "ollama_chat",
    "anthropic_messages",
    "openai_responses",
    "openai_compatible_chat",
    "anthropic_compatible_proxy",
    "external_subscription_app",
)

ROUTING_STRATEGIES: tuple[str, ...] = (
    "local_only",
    "cloud_only",
    "local_first",
    "cloud_first",
    "auto_by_complexity",
    "auto_by_budget",
    "disabled",
)

_MODE_ALIASES: dict[str, str] = {
    "": "",
    "local": "local_only",
    "local-only": "local_only",
    "local_only": "local_only",
    "cloud": "cloud_first",
    "cloud-only": "cloud_only",
    "cloud_only": "cloud_only",
    "cloud-first": "cloud_first",
    "cloud_first": "cloud_first",
    "local-first": "local_first",
    "local_first": "local_first",
    "auto": "auto_by_complexity",
    "auto-by-complexity": "auto_by_complexity",
    "auto_by_complexity": "auto_by_complexity",
    "auto-by-budget": "auto_by_budget",
    "auto_by_budget": "auto_by_budget",
    "disabled": "disabled",
}


@dataclass(frozen=True)
class ProviderProfile:
    """Provider-neutral model profile exposed to routing and admin diagnostics."""

    id: str
    display_name: str
    provider: str
    transport: str
    entitlement: str
    model: str
    base_url: str | None = None
    key_ref: str | None = None
    key_configured: bool = False
    capabilities: frozenset[str] = field(default_factory=frozenset)
    safety: dict[str, Any] = field(default_factory=dict)
    limits: dict[str, Any] = field(default_factory=dict)
    fallback_profile_ids: tuple[str, ...] = ()
    enabled: bool = True
    notes: tuple[str, ...] = ()

    @property
    def is_cloud(self) -> bool:
        return self.entitlement != "local" and self.transport != "ollama_chat"

    @property
    def legacy_model(self) -> str:
        if self.transport == "anthropic_messages":
            return "claude"
        return "local"

    @property
    def prompt_profile(self) -> str:
        if self.transport == "anthropic_messages":
            return "claude"
        if self.is_cloud:
            return "cloud"
        return "medgemma"

    def supports_all(self, required: set[str] | frozenset[str]) -> bool:
        return set(required).issubset(self.capabilities)

    def capability_map(self) -> dict[str, bool]:
        return {name: name in self.capabilities for name in CAPABILITY_FLAGS}

    def public_dict(self) -> dict[str, Any]:
        """Return a secret-safe admin/API representation."""
        return {
            "id": self.id,
            "display_name": self.display_name,
            "provider": self.provider,
            "transport": self.transport,
            "entitlement": self.entitlement,
            "model": self.model,
            "base_url": self.base_url,
            "key": {
                "ref": self.key_ref,
                "configured": self.key_configured,
            },
            "capabilities": self.capability_map(),
            "safety": self.safety,
            "limits": self.limits,
            "fallback_profile_ids": list(self.fallback_profile_ids),
            "enabled": self.enabled,
            "notes": list(self.notes),
        }


@dataclass(frozen=True)
class AbbyChatPolicy:
    mode: str
    default_profile_id: str
    fallback_profile_ids: tuple[str, ...]
    cloud_routing_enabled: bool
    never_send_phi_to_cloud: bool
    surface_defaults: dict[str, str]

    def public_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "default_profile_id": self.default_profile_id,
            "fallback_profile_ids": list(self.fallback_profile_ids),
            "cloud_routing_enabled": self.cloud_routing_enabled,
            "never_send_phi_to_cloud": self.never_send_phi_to_cloud,
            "surface_defaults": self.surface_defaults,
        }


@dataclass(frozen=True)
class AbbyRouteDecision:
    routing: RoutingDecision
    profile: ProviderProfile
    fallback_profiles: tuple[ProviderProfile, ...]
    policy: AbbyChatPolicy
    requested_profile: ProviderProfile | None = None

    @property
    def fallback_used(self) -> bool:
        return self.requested_profile is not None and self.profile.id != self.requested_profile.id


def _csv(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(part.strip() for part in value.split(",") if part.strip())


def parse_model_aliases(value: str | None) -> dict[str, str]:
    """Parse an ``alias=real_tag`` comma list into a mapping.

    Lets operators use a friendly tag such as ``medgemma:27b`` that resolves to
    the actually-installed Ollama tag (e.g. ``puyangwang/medgemma-27b-it:q4_0``).
    """
    aliases: dict[str, str] = {}
    for part in _csv(value):
        if "=" in part:
            alias, _, real = part.partition("=")
            alias, real = alias.strip(), real.strip()
            if alias and real:
                aliases[alias] = real
    return aliases


def resolve_model_alias(model: str, config: Any) -> str:
    """Resolve a model alias to its real tag, returning ``model`` unchanged when
    there is no alias entry."""
    aliases = parse_model_aliases(getattr(config, "abby_model_aliases", ""))
    return aliases.get(model, model)


def _monthly_budget(config: Any, attr: str) -> float:
    configured = float(getattr(config, attr, 0.0) or 0.0)
    if configured > 0:
        return configured
    return float(getattr(config, "cloud_monthly_budget_usd"))


def normalize_chat_mode(value: str | None) -> str:
    key = (value or "").strip().lower()
    return _MODE_ALIASES.get(key, key)


def build_default_provider_profiles(config: Any) -> dict[str, ProviderProfile]:
    """Build env-backed profiles for the currently implemented Abby transports."""
    local_profile_id = getattr(config, "abby_local_chat_profile_id", "local-medgemma")
    local_4b_profile_id = getattr(config, "abby_local_chat_4b_profile_id", "local-medgemma-4b")
    # The 27B profile falls back to the lower-resource 4B profile by default, then
    # to any operator-configured fallbacks, so a constrained host degrades within
    # the local tier before there is nothing left to answer with.
    local_fallbacks = (local_4b_profile_id,) + _csv(
        getattr(config, "abby_local_chat_fallback_profile_ids", "")
    )
    local_profile = ProviderProfile(
        id=local_profile_id,
        display_name="Local MedGemma 27B via Ollama",
        provider="ollama",
        transport="ollama_chat",
        entitlement="local",
        model=resolve_model_alias(getattr(config, "abby_llm_model"), config),
        base_url=getattr(config, "abby_llm_base_url"),
        capabilities=frozenset({"chat", "streaming", "clinical_rag", "patient_level_local_only"}),
        safety={
            "cloud": False,
            "phi_allowed": True,
            "patient_level_context_allowed": True,
        },
        limits={
            "timeout_seconds": getattr(config, "ollama_timeout"),
            "max_output_tokens": getattr(config, "ollama_num_predict"),
            "keep_alive_seconds": getattr(config, "abby_ollama_keep_alive"),
        },
        fallback_profile_ids=local_fallbacks,
        enabled=True,
        notes=("Default Abby chat/RAG profile.",),
    )
    local_4b_profile = ProviderProfile(
        id=local_4b_profile_id,
        display_name="Local MedGemma 4B via Ollama (low-resource fallback)",
        provider="ollama",
        transport="ollama_chat",
        entitlement="local",
        model=resolve_model_alias(getattr(config, "abby_local_chat_4b_model", "MedAIBase/MedGemma1.5:4b"), config),
        base_url=getattr(config, "abby_llm_base_url"),
        capabilities=frozenset({"chat", "streaming", "clinical_rag", "patient_level_local_only"}),
        safety={
            "cloud": False,
            "phi_allowed": True,
            "patient_level_context_allowed": True,
        },
        limits={
            "timeout_seconds": getattr(config, "ollama_timeout"),
            "max_output_tokens": getattr(config, "ollama_num_predict"),
            "keep_alive_seconds": getattr(config, "abby_ollama_keep_alive"),
        },
        fallback_profile_ids=(),
        enabled=True,
        notes=("Lower-resource local fallback for constrained hosts.",),
    )
    anthropic_profile = ProviderProfile(
        id=getattr(config, "anthropic_profile_id", "anthropic-claude"),
        display_name="Anthropic Claude API",
        provider="anthropic",
        transport="anthropic_messages",
        entitlement=getattr(config, "abby_cloud_entitlement", "org_api_key"),
        model=getattr(config, "claude_model"),
        key_ref="CLAUDE_API_KEY",
        key_configured=bool(getattr(config, "claude_api_key", "")),
        capabilities=frozenset({"chat", "streaming", "long_context"}),
        safety={
            "cloud": True,
            "phi_allowed": False,
            "patient_level_context_allowed": False,
            "cloud_safety_filter_required": True,
        },
        limits={
            "timeout_seconds": getattr(config, "claude_timeout"),
            "max_output_tokens": getattr(config, "claude_max_tokens"),
            "monthly_budget_usd": _monthly_budget(config, "anthropic_monthly_budget_usd"),
            "input_price_per_mtok": float(getattr(config, "claude_input_price_per_mtok", 3.0)),
            "output_price_per_mtok": float(getattr(config, "claude_output_price_per_mtok", 15.0)),
        },
        fallback_profile_ids=(local_profile_id,),
        enabled=bool(getattr(config, "abby_cloud_routing_enabled")),
        notes=(
            "Server-side Anthropic API profile.",
            "Claude Pro/Max subscriptions are not backend API quota.",
        ),
    )
    openai_profile = ProviderProfile(
        id=getattr(config, "openai_profile_id", "openai-responses"),
        display_name="OpenAI Responses API",
        provider="openai",
        transport="openai_responses",
        entitlement=getattr(config, "abby_cloud_entitlement", "org_api_key"),
        model=getattr(config, "openai_model", "gpt-5.5"),
        base_url=getattr(config, "openai_base_url", "") or None,
        key_ref="OPENAI_API_KEY",
        key_configured=bool(getattr(config, "openai_api_key", "")),
        capabilities=frozenset({"chat", "streaming", "structured_output", "json_mode", "long_context"}),
        safety={
            "cloud": True,
            "phi_allowed": False,
            "patient_level_context_allowed": False,
            "cloud_safety_filter_required": True,
        },
        limits={
            "timeout_seconds": getattr(config, "openai_timeout", 60),
            "max_output_tokens": getattr(config, "openai_max_output_tokens", 4096),
            "monthly_budget_usd": _monthly_budget(config, "openai_monthly_budget_usd"),
            "input_price_per_mtok": float(getattr(config, "openai_input_price_per_mtok", 0.0)),
            "output_price_per_mtok": float(getattr(config, "openai_output_price_per_mtok", 0.0)),
        },
        fallback_profile_ids=(local_profile_id,),
        enabled=bool(getattr(config, "abby_cloud_routing_enabled")),
        notes=(
            "Server-side OpenAI API profile using the Responses API.",
            "ChatGPT Plus/Pro subscriptions are not backend API quota.",
        ),
    )
    compatible_model = getattr(config, "openai_compatible_model", "") or "openai-compatible-model"
    openai_compatible_profile = ProviderProfile(
        id=getattr(config, "openai_compatible_profile_id", "openai-compatible-chat"),
        display_name="OpenAI-Compatible Chat API",
        provider="openai_compatible",
        transport="openai_compatible_chat",
        entitlement=getattr(config, "abby_cloud_entitlement", "org_api_key"),
        model=compatible_model,
        base_url=getattr(config, "openai_compatible_base_url", "") or None,
        key_ref="OPENAI_COMPATIBLE_API_KEY",
        key_configured=bool(getattr(config, "openai_compatible_api_key", "")),
        capabilities=frozenset({"chat", "streaming"}),
        safety={
            "cloud": True,
            "phi_allowed": False,
            "patient_level_context_allowed": False,
            "cloud_safety_filter_required": True,
        },
        limits={
            "timeout_seconds": getattr(config, "openai_compatible_timeout", 60),
            "max_output_tokens": getattr(config, "openai_compatible_max_output_tokens", 4096),
            "monthly_budget_usd": _monthly_budget(config, "openai_compatible_monthly_budget_usd"),
        },
        fallback_profile_ids=(local_profile_id,),
        enabled=bool(getattr(config, "abby_cloud_routing_enabled")) and bool(getattr(config, "openai_compatible_base_url", "")),
        notes=(
            "For providers that implement an OpenAI-compatible /v1/chat/completions API.",
            "Capabilities must be validated per provider/model before tool or agent use.",
        ),
    )
    return {
        local_profile.id: local_profile,
        local_4b_profile.id: local_4b_profile,
        anthropic_profile.id: anthropic_profile,
        openai_profile.id: openai_profile,
        openai_compatible_profile.id: openai_compatible_profile,
    }


def resolve_abby_chat_policy(config: Any) -> AbbyChatPolicy:
    """Resolve the effective chat policy while preserving legacy env behavior."""
    explicit_mode = normalize_chat_mode(getattr(config, "abby_chat_provider_mode", ""))
    if explicit_mode:
        mode = explicit_mode
    elif getattr(config, "abby_cloud_routing_enabled"):
        mode = "auto_by_complexity"
    else:
        mode = "local_only"

    local_profile_id = getattr(config, "abby_local_chat_profile_id", "local-medgemma")
    cloud_profile_id = getattr(config, "abby_cloud_chat_profile_id", "anthropic-claude")
    default_profile_id = getattr(config, "abby_chat_default_profile_id", "") or (
        cloud_profile_id if mode in {"cloud_only", "cloud_first"} else local_profile_id
    )
    configured_fallbacks = _csv(getattr(config, "abby_chat_fallback_profile_ids", ""))
    fallback_profile_ids = configured_fallbacks or (local_profile_id,)

    return AbbyChatPolicy(
        mode=mode,
        default_profile_id=default_profile_id,
        fallback_profile_ids=fallback_profile_ids,
        cloud_routing_enabled=bool(getattr(config, "abby_cloud_routing_enabled")),
        never_send_phi_to_cloud=bool(getattr(config, "phi_block_on_detection")),
        surface_defaults={
            "chat": default_profile_id,
            "parse_cohort": local_profile_id,
            "clinical_rag": local_profile_id,
            "study_agent": getattr(config, "agent_provider", "anthropic"),
        },
    )


def validate_profile_for_surface(
    profile: ProviderProfile,
    *,
    required_capabilities: set[str] | frozenset[str],
    allows_cloud: bool = True,
    allows_patient_level_context: bool = True,
) -> list[str]:
    errors: list[str] = []
    missing = sorted(set(required_capabilities) - profile.capabilities)
    if missing:
        errors.append(f"missing_capabilities:{','.join(missing)}")
    if profile.is_cloud and not allows_cloud:
        errors.append("cloud_not_allowed")
    if (
        profile.is_cloud
        and allows_patient_level_context
        and not profile.safety.get("patient_level_context_allowed", False)
    ):
        errors.append("patient_level_context_not_cloud_safe")
    if not profile.enabled:
        errors.append("profile_disabled")
    return errors


def _fallback_profiles(
    profiles: dict[str, ProviderProfile],
    policy: AbbyChatPolicy,
) -> tuple[ProviderProfile, ...]:
    return tuple(
        profiles[profile_id]
        for profile_id in policy.fallback_profile_ids
        if profile_id in profiles
    )


def _local_profile(profiles: dict[str, ProviderProfile]) -> ProviderProfile:
    for profile in profiles.values():
        if profile.transport == "ollama_chat":
            return profile
    raise ValueError("No local Ollama Abby provider profile is configured")


def _cloud_profile(
    profiles: dict[str, ProviderProfile],
    *,
    preferred_profile_id: str,
) -> ProviderProfile | None:
    preferred = profiles.get(preferred_profile_id)
    if preferred is not None and preferred.is_cloud:
        return preferred
    for profile_id in ("anthropic-claude", "openai-responses", "openai-compatible-chat"):
        profile = profiles.get(profile_id)
        if profile is not None and profile.is_cloud:
            return profile
    return None


def decide_abby_chat_route(
    message: str,
    *,
    config: Any,
    rule_router: RuleRouter,
    budget_exhausted: bool = False,
    cloud_client_available: Callable[[], bool] | None = None,
    surface: str = "chat",
    required_capabilities: set[str] | frozenset[str] = frozenset({"chat"}),
    requires_streaming: bool = False,
    allows_cloud: bool = True,
    allows_patient_level_context: bool = False,
) -> AbbyRouteDecision:
    """Choose a profile for one Abby chat turn.

    The returned ``routing`` preserves the legacy ``local``/``claude`` model
    values used by existing frontend/Laravel consumers. The attached profile is
    the new provider-neutral contract for admin diagnostics and future adapters.

    Routing is capability-driven: ``surface`` and ``required_capabilities`` (plus
    ``requires_streaming``) describe what the calling Abby surface needs, and
    ``allows_cloud`` / ``allows_patient_level_context`` carry the surface's safety
    posture. A cloud profile that cannot satisfy those constraints is rejected and
    the turn falls back local with reason ``unsupported_capability`` — Abby never
    silently routes to a model that lacks a required capability.
    """
    profiles = build_default_provider_profiles(config)
    policy = resolve_abby_chat_policy(config)
    local_profile = _local_profile(profiles)
    cloud_profile = _cloud_profile(profiles, preferred_profile_id=getattr(config, "abby_cloud_chat_profile_id", "anthropic-claude"))
    fallbacks = _fallback_profiles(profiles, policy)

    required = set(required_capabilities)
    if requires_streaming:
        required.add("streaming")

    def local(reason: str, stage: int = 0, confidence: float = 1.0) -> AbbyRouteDecision:
        requested = cloud_profile if reason in {"api_key_missing", "provider_disabled", "claude_unavailable", "provider_unavailable", "unsupported_capability"} else None
        return AbbyRouteDecision(
            routing=RoutingDecision(model="local", stage=stage, reason=reason, confidence=confidence),
            profile=local_profile,
            fallback_profiles=fallbacks,
            policy=policy,
            requested_profile=requested,
        )

    def cloud_capability_ok(profile: ProviderProfile) -> bool:
        """A cloud profile must satisfy the surface's capability + safety posture."""
        if not allows_cloud:
            return False
        if not profile.supports_all(required):
            return False
        if allows_patient_level_context and not profile.safety.get(
            "patient_level_context_allowed", False
        ):
            return False
        return True

    if policy.mode == "disabled":
        return local("provider_disabled")
    if budget_exhausted:
        return local("budget_exhausted")
    if policy.mode == "local_only":
        return local("local_ollama_required")

    if cloud_profile is None:
        return local("provider_disabled")
    if not cloud_capability_ok(cloud_profile):
        return local("unsupported_capability")
    if policy.mode in {"cloud_only", "cloud_first"} and not cloud_profile.enabled:
        return local("provider_disabled")
    if policy.mode in {"cloud_only", "cloud_first", "local_first", "auto_by_complexity", "auto_by_budget"}:
        if not cloud_profile.key_configured:
            if policy.mode in {"cloud_only", "cloud_first"}:
                return local("api_key_missing")
        elif (
            policy.mode in {"cloud_only", "cloud_first"}
            and cloud_client_available is not None
            and not cloud_client_available()
        ):
            if policy.mode in {"cloud_only", "cloud_first"}:
                return local("provider_unavailable")

    if policy.mode in {"cloud_only", "cloud_first"}:
        return AbbyRouteDecision(
            routing=RoutingDecision(model="claude", stage=0, reason=policy.mode, confidence=1.0),
            profile=cloud_profile,
            fallback_profiles=fallbacks,
            policy=policy,
        )

    rule_decision = rule_router.route(message, budget_exhausted=budget_exhausted)
    if rule_decision.model != "claude":
        return AbbyRouteDecision(
            routing=rule_decision,
            profile=local_profile,
            fallback_profiles=fallbacks,
            policy=policy,
        )
    if not cloud_profile.enabled:
        return local("provider_disabled")
    if not cloud_profile.key_configured:
        return local("api_key_missing")
    if cloud_client_available is not None and not cloud_client_available():
        return local("provider_unavailable")
    return AbbyRouteDecision(
        routing=rule_decision,
        profile=cloud_profile,
        fallback_profiles=fallbacks,
        policy=policy,
    )


def force_local_abby_route(
    *,
    config: Any,
    reason: str,
    requested_profile: ProviderProfile | None = None,
    stage: int = 0,
    confidence: float = 1.0,
) -> AbbyRouteDecision:
    """Build a local fallback route for runtime safety/error transitions."""
    profiles = build_default_provider_profiles(config)
    policy = resolve_abby_chat_policy(config)
    return AbbyRouteDecision(
        routing=RoutingDecision(model="local", stage=stage, reason=reason, confidence=confidence),
        profile=_local_profile(profiles),
        fallback_profiles=_fallback_profiles(profiles, policy),
        policy=policy,
        requested_profile=requested_profile,
    )
