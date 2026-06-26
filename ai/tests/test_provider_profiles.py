"""Tests for Abby provider profile resolution and policy routing."""
from __future__ import annotations

from unittest.mock import patch

from app.config import settings
from app.routing.provider_profiles import (
    build_default_provider_profiles,
    decide_abby_chat_route,
    parse_model_aliases,
    resolve_model_alias,
    validate_profile_for_surface,
)
from app.routing.rule_router import RuleRouter


def test_provider_profiles_expose_secret_safe_entitlements() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        profiles = build_default_provider_profiles(settings)

    cloud = profiles["anthropic-claude"]
    public = cloud.public_dict()

    assert public["provider"] == "anthropic"
    assert public["transport"] == "anthropic_messages"
    assert public["entitlement"] == "org_api_key"
    assert public["key"]["configured"] is True
    assert "test-secret" not in str(public)


def test_default_profiles_include_openai_and_compatible_options() -> None:
    with (
        patch.object(settings, "openai_api_key", "test-openai-key"),
        patch.object(settings, "openai_compatible_api_key", "test-compatible-key"),
        patch.object(settings, "openai_compatible_base_url", "https://provider.test/v1"),
    ):
        profiles = build_default_provider_profiles(settings)

    assert profiles["openai-responses"].transport == "openai_responses"
    assert profiles["openai-responses"].key_configured is True
    assert profiles["openai-compatible-chat"].transport == "openai_compatible_chat"
    assert profiles["openai-compatible-chat"].base_url == "https://provider.test/v1"
    assert "test-openai-key" not in str(profiles["openai-responses"].public_dict())


def test_provider_router_local_default() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", False),
        patch.object(settings, "abby_chat_provider_mode", ""),
    ):
        decision = decide_abby_chat_route(
            "Build a complex study",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.policy.mode == "local_only"
    assert decision.routing.model == "local"
    assert decision.routing.reason == "local_ollama_required"
    assert decision.profile.id == "local-medgemma"


def test_provider_router_cloud_disabled_returns_local() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", False),
        patch.object(settings, "abby_chat_provider_mode", "auto_by_complexity"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Compare these study designs",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.routing.model == "local"
    assert decision.routing.reason == "provider_disabled"
    assert decision.profile.id == "local-medgemma"


def test_provider_router_missing_api_key_falls_back_local() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_first"),
        patch.object(settings, "claude_api_key", ""),
    ):
        decision = decide_abby_chat_route(
            "Compare these study designs",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: False,
        )

    assert decision.routing.model == "local"
    assert decision.routing.reason == "api_key_missing"
    assert decision.profile.id == "local-medgemma"
    assert decision.requested_profile is not None
    assert decision.requested_profile.id == "anthropic-claude"
    assert decision.fallback_used is True


def test_provider_router_budget_exhausted_falls_back_local() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "auto_by_complexity"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Compare these study designs",
            config=settings,
            rule_router=RuleRouter(),
            budget_exhausted=True,
            cloud_client_available=lambda: True,
        )

    assert decision.routing.model == "local"
    assert decision.routing.reason == "budget_exhausted"
    assert decision.profile.id == "local-medgemma"


def test_streaming_and_non_streaming_share_route_decision() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "auto_by_complexity"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        chat_decision = decide_abby_chat_route(
            "Compare these study designs and explain bias tradeoffs",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )
        stream_decision = decide_abby_chat_route(
            "Compare these study designs and explain bias tradeoffs",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert stream_decision.routing == chat_decision.routing
    assert stream_decision.profile.id == chat_decision.profile.id
    assert stream_decision.policy.mode == chat_decision.policy.mode


def test_provider_router_cloud_first_uses_cloud_when_available() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_first"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Hello Abby",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.routing.model == "claude"
    assert decision.routing.reason == "cloud_first"
    assert decision.profile.id == "anthropic-claude"


def test_provider_router_can_select_openai_cloud_profile() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_first"),
        patch.object(settings, "abby_cloud_chat_profile_id", "openai-responses"),
        patch.object(settings, "openai_api_key", "test-openai-key"),
    ):
        decision = decide_abby_chat_route(
            "Hello Abby",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.routing.model == "claude"
    assert decision.profile.id == "openai-responses"
    assert decision.profile.transport == "openai_responses"
    assert decision.profile.prompt_profile == "cloud"


def test_provider_router_can_select_openai_compatible_cloud_profile() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_first"),
        patch.object(settings, "abby_cloud_chat_profile_id", "openai-compatible-chat"),
        patch.object(settings, "openai_compatible_api_key", "test-compatible-key"),
        patch.object(settings, "openai_compatible_base_url", "https://provider.test/v1"),
    ):
        decision = decide_abby_chat_route(
            "Hello Abby",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.routing.model == "claude"
    assert decision.profile.id == "openai-compatible-chat"
    assert decision.profile.transport == "openai_compatible_chat"


def test_provider_router_cloud_only_uses_cloud() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_only"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Hello Abby",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.policy.mode == "cloud_only"
    assert decision.routing.model == "claude"
    assert decision.routing.reason == "cloud_only"
    assert decision.profile.id == "anthropic-claude"


def test_provider_router_local_first_keeps_simple_turns_local() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "local_first"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Hello Abby",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.policy.mode == "local_first"
    assert decision.routing.model == "local"
    assert decision.profile.id == "local-medgemma"


def test_provider_router_disabled_returns_local() -> None:
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "disabled"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Compare these study designs",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
        )

    assert decision.policy.mode == "disabled"
    assert decision.routing.model == "local"
    assert decision.routing.reason == "provider_disabled"


def test_provider_router_rejects_unsupported_capability() -> None:
    """A surface requiring a capability the cloud profile lacks (e.g. embeddings)
    must never route to that cloud model — it falls back local."""
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_first"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Embed these notes",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
            surface="embeddings",
            required_capabilities={"chat", "embeddings"},
        )

    assert decision.routing.model == "local"
    assert decision.routing.reason == "unsupported_capability"
    assert decision.profile.id == "local-medgemma"
    assert decision.requested_profile is not None
    assert decision.requested_profile.id == "anthropic-claude"
    assert decision.fallback_used is True


def test_provider_router_rejects_cloud_for_patient_level_surface() -> None:
    """A surface that needs patient-level context cannot use a cloud profile whose
    safety posture forbids patient-level data."""
    with (
        patch.object(settings, "abby_cloud_routing_enabled", True),
        patch.object(settings, "abby_chat_provider_mode", "cloud_first"),
        patch.object(settings, "claude_api_key", "test-secret"),
    ):
        decision = decide_abby_chat_route(
            "Summarize this patient's chart",
            config=settings,
            rule_router=RuleRouter(),
            cloud_client_available=lambda: True,
            allows_patient_level_context=True,
        )

    assert decision.routing.model == "local"
    assert decision.routing.reason == "unsupported_capability"
    assert decision.profile.id == "local-medgemma"


def test_model_alias_resolution() -> None:
    assert parse_model_aliases("a=b, c = d ,bad")["a"] == "b"
    assert parse_model_aliases("a=b, c = d ,bad")["c"] == "d"
    assert "bad" not in parse_model_aliases("a=b, c = d ,bad")

    class _Cfg:
        abby_model_aliases = "medgemma:27b=puyangwang/medgemma-27b-it:q4_0"

    assert resolve_model_alias("medgemma:27b", _Cfg()) == "puyangwang/medgemma-27b-it:q4_0"
    assert resolve_model_alias("unknown:tag", _Cfg()) == "unknown:tag"


def test_default_profiles_include_low_resource_local_fallback() -> None:
    profiles = build_default_provider_profiles(settings)
    assert "local-medgemma-4b" in profiles
    fb = profiles["local-medgemma-4b"]
    assert fb.transport == "ollama_chat"
    assert fb.entitlement == "local"
    # The 27B profile degrades to the 4B profile within the local tier first.
    assert "local-medgemma-4b" in profiles["local-medgemma"].fallback_profile_ids


def test_cloud_profiles_carry_pricing_metadata() -> None:
    with patch.object(settings, "claude_api_key", "test-secret"):
        profiles = build_default_provider_profiles(settings)
    anthropic = profiles["anthropic-claude"]
    assert anthropic.limits["input_price_per_mtok"] == 3.0
    assert anthropic.limits["output_price_per_mtok"] == 15.0


def test_provider_validator_rejects_medgemma_for_agent_loop() -> None:
    profiles = build_default_provider_profiles(settings)
    local = profiles["local-medgemma"]

    errors = validate_profile_for_surface(
        local,
        required_capabilities={"agent_loop"},
        allows_cloud=False,
        allows_patient_level_context=True,
    )

    assert "missing_capabilities:agent_loop" in errors
