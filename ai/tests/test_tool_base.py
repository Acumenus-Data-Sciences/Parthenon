"""Tests for the generic agent tool base (AgentToolContext + HTTP helpers)."""

from __future__ import annotations

import dataclasses

import pytest

from app.agents.tool_base import AgentToolContext, api_url, error_result, text_result


def test_context_is_frozen_and_holds_token_plus_bag() -> None:
    ctx = AgentToolContext(auth_token="tok", context={"draft_id": 7})
    assert ctx.auth_token == "tok"
    assert ctx.context["draft_id"] == 7
    with pytest.raises(dataclasses.FrozenInstanceError):
        ctx.auth_token = "other"  # type: ignore[misc]


def test_context_defaults_to_empty_bag() -> None:
    ctx = AgentToolContext(auth_token="tok")
    assert ctx.context == {}


def test_error_result_shape() -> None:
    r = error_result("boom")
    assert r["is_error"] is True
    assert r["content"][0] == {"type": "text", "text": "boom"}


def test_text_result_serializes_and_has_no_error_flag() -> None:
    r = text_result({"k": "v"})
    assert "is_error" not in r
    assert r["content"][0]["type"] == "text"
    assert "k" in r["content"][0]["text"]


def test_api_url_joins_base_and_strips_slashes(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "agency_api_base_url", "http://nginx:80/")
    assert api_url("vocabulary/search") == "http://nginx:80/api/v1/vocabulary/search"
    assert api_url("/publish/drafts/1") == "http://nginx:80/api/v1/publish/drafts/1"
