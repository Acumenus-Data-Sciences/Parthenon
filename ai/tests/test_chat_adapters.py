"""Tests for provider-neutral Abby chat adapters."""
from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.routing.chat_adapters import (
    AnthropicMessagesAdapter,
    ChatAdapterError,
    ChatAdapterRequest,
    OllamaChatAdapter,
    OpenAICompatibleChatAdapter,
    OpenAIResponsesAdapter,
    classify_provider_error,
)
from app.routing.claude_client import ClaudeResponse
from app.routing.provider_profiles import ProviderProfile


def _local_profile() -> ProviderProfile:
    return ProviderProfile(
        id="local-medgemma",
        display_name="Local MedGemma",
        provider="ollama",
        transport="ollama_chat",
        entitlement="local",
        model="puyangwang/medgemma-27b-it:q4_0",
        base_url="http://ollama.test",
        capabilities=frozenset({"chat", "streaming", "clinical_rag"}),
    )


def _cloud_profile() -> ProviderProfile:
    return ProviderProfile(
        id="anthropic-claude",
        display_name="Anthropic Claude",
        provider="anthropic",
        transport="anthropic_messages",
        entitlement="org_api_key",
        model="claude-sonnet-4-20250514",
        key_ref="CLAUDE_API_KEY",
        key_configured=True,
        capabilities=frozenset({"chat", "streaming", "long_context"}),
    )


def _openai_profile() -> ProviderProfile:
    return ProviderProfile(
        id="openai-responses",
        display_name="OpenAI Responses",
        provider="openai",
        transport="openai_responses",
        entitlement="org_api_key",
        model="gpt-5.5",
        key_ref="OPENAI_API_KEY",
        key_configured=True,
        capabilities=frozenset({"chat", "streaming", "structured_output"}),
    )


def _openai_compatible_profile() -> ProviderProfile:
    return ProviderProfile(
        id="openai-compatible-chat",
        display_name="OpenAI-Compatible Chat",
        provider="openai_compatible",
        transport="openai_compatible_chat",
        entitlement="org_api_key",
        model="deepseek-chat",
        base_url="https://provider.test/v1",
        key_ref="OPENAI_COMPATIBLE_API_KEY",
        key_configured=True,
        capabilities=frozenset({"chat", "streaming"}),
    )


@dataclass
class _FakeOllamaResponse:
    payload: dict[str, Any]
    status_code: int = 200

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "http://ollama.test/api/chat")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    def json(self) -> dict[str, Any]:
        return self.payload


class _RetryingClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def post(self, url: str, **kwargs: Any) -> _FakeOllamaResponse:
        self.calls.append({"url": url, **kwargs})
        if len(self.calls) == 1:
            raise httpx.TimeoutException("cold start")
        return _FakeOllamaResponse(
            {
                "message": {"content": "Local reply"},
                "load_duration": 1_000_000,
                "prompt_eval_duration": 2_000_000,
                "eval_duration": 3_000_000,
                "total_duration": 6_000_000,
                "prompt_eval_count": 12,
                "eval_count": 5,
            }
        )


class _FakeStreamResponse:
    def __init__(self, lines: list[str], status_code: int = 200) -> None:
        self.lines = lines
        self.status_code = status_code

    async def __aenter__(self) -> "_FakeStreamResponse":
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "http://ollama.test/api/chat")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    async def aiter_lines(self):
        for line in self.lines:
            yield line


class _StreamingClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def stream(self, method: str, url: str, **kwargs: Any) -> _FakeStreamResponse:
        self.calls.append({"method": method, "url": url, **kwargs})
        return _FakeStreamResponse([
            '{"message":{"content":"Hel"}}',
            '{"message":{"content":"lo"}}',
            '{"done":true,"total_duration":6000000,"eval_count":2}',
        ])


@pytest.mark.asyncio
async def test_ollama_adapter_retries_cold_start() -> None:
    client = _RetryingClient()
    adapter = OllamaChatAdapter(
        profile=_local_profile(),
        client=client,  # type: ignore[arg-type]
        default_num_predict=256,
        keep_alive_seconds=3600,
        timeout_seconds=120,
    )

    response = await adapter.chat(
        ChatAdapterRequest(
            system_prompt="You are Abby.",
            message="Hello",
            history=[{"role": "assistant", "content": "Previous"}],
            max_output_tokens=128,
        )
    )

    assert response.reply == "Local reply"
    assert response.provider == "ollama"
    assert len(client.calls) == 2
    assert client.calls[0]["timeout"] == 180
    assert client.calls[1]["timeout"] == 60
    assert client.calls[1]["json"]["options"]["num_predict"] == 128


@pytest.mark.asyncio
async def test_ollama_stream_adapter_yields_tokens_and_completion() -> None:
    client = _StreamingClient()
    adapter = OllamaChatAdapter(
        profile=_local_profile(),
        client=client,  # type: ignore[arg-type]
        default_num_predict=256,
        keep_alive_seconds=3600,
        timeout_seconds=120,
    )

    events = [
        event
        async for event in adapter.stream(
            ChatAdapterRequest(system_prompt="You are Abby.", message="Hello", max_output_tokens=64)
        )
    ]

    assert [event.kind for event in events] == ["token", "token", "complete"]
    assert [event.token for event in events[:2]] == ["Hel", "lo"]
    assert events[-1].payload["full_content"] == "Hello"
    assert events[-1].payload["final_data"]["eval_count"] == 2
    assert client.calls[0]["json"]["stream"] is True


@pytest.mark.asyncio
async def test_anthropic_adapter_normalizes_usage() -> None:
    fake_client = MagicMock()
    fake_client.chat.return_value = ClaudeResponse(
        reply="Cloud reply",
        tokens_in=100,
        tokens_out=40,
        cost_usd=0.002,
        model="claude-sonnet-4-20250514",
        latency_ms=12.3,
        request_hash="abc123",
    )
    adapter = AnthropicMessagesAdapter(
        profile=_cloud_profile(),
        client=fake_client,
    )

    response = await adapter.chat(
        ChatAdapterRequest(
            system_prompt="You are Abby.",
            message="Analyze this",
            history=[{"role": "user", "content": "Earlier"}],
        )
    )

    assert response.reply == "Cloud reply"
    assert response.provider == "anthropic"
    assert response.transport == "anthropic_messages"
    assert response.tokens_in == 100
    assert response.tokens_out == 40
    assert response.cost_usd == 0.002
    assert response.request_hash == "abc123"


@pytest.mark.asyncio
async def test_anthropic_adapter_classifies_credit_error() -> None:
    fake_client = MagicMock()
    fake_client.chat.side_effect = RuntimeError("insufficient credit balance")
    adapter = AnthropicMessagesAdapter(
        profile=_cloud_profile(),
        client=fake_client,
    )

    with pytest.raises(ChatAdapterError) as excinfo:
        await adapter.chat(ChatAdapterRequest(system_prompt="You are Abby.", message="Analyze this"))

    assert excinfo.value.error_class == "provider_quota_exhausted"
    assert excinfo.value.retryable is False


@pytest.mark.asyncio
async def test_anthropic_stream_adapter_normalizes_tokens_and_usage() -> None:
    class FakeUsage:
        input_tokens = 120
        output_tokens = 30

    class FakeFinalMessage:
        model = "claude-sonnet-4-20250514"
        usage = FakeUsage()

    class FakeStream:
        text_stream = ["Hel", "lo"]

        def __enter__(self) -> "FakeStream":
            return self

        def __exit__(self, *args: Any) -> None:
            return None

        def get_final_message(self) -> FakeFinalMessage:
            return FakeFinalMessage()

    fake_client = MagicMock()
    fake_client.messages.stream.return_value = FakeStream()
    claude_client = MagicMock()
    claude_client.api_key = "test-key"
    claude_client.model = "claude-sonnet-4-20250514"
    claude_client.max_tokens = 4096
    claude_client.estimate_cost.return_value = 0.001

    with patch("anthropic.Anthropic", return_value=fake_client):
        adapter = AnthropicMessagesAdapter(
            profile=_cloud_profile(),
            client=claude_client,
        )
        events = [
            event
            async for event in adapter.stream(
                ChatAdapterRequest(system_prompt="You are Abby.", message="Analyze this")
            )
        ]

    assert [event.kind for event in events] == ["token", "token", "complete"]
    assert [event.token for event in events[:2]] == ["Hel", "lo"]
    assert events[-1].payload["full_content"] == "Hello"
    assert events[-1].payload["tokens_in"] == 120
    assert events[-1].payload["tokens_out"] == 30
    assert events[-1].payload["cost_usd"] == 0.001


def test_classify_provider_error_rate_limit() -> None:
    assert classify_provider_error(RuntimeError("rate limit exceeded")) == "provider_rate_limited"


def test_classify_provider_error_safety_refusal() -> None:
    assert classify_provider_error(RuntimeError("content policy safety refusal")) == "provider_safety_refusal"


@pytest.mark.asyncio
async def test_openai_adapter_normalizes_usage() -> None:
    fake_client = MagicMock()
    fake_client.responses.create.return_value = SimpleNamespace(
        output_text="OpenAI reply",
        model="gpt-5.5",
        usage=SimpleNamespace(input_tokens=90, output_tokens=25),
    )

    with patch("openai.OpenAI", return_value=fake_client):
        adapter = OpenAIResponsesAdapter(
            profile=_openai_profile(),
            api_key="test-key",
            max_output_tokens=512,
        )
        response = await adapter.chat(
            ChatAdapterRequest(system_prompt="You are Abby.", message="Analyze this")
        )

    assert response.reply == "OpenAI reply"
    assert response.provider == "openai"
    assert response.transport == "openai_responses"
    assert response.tokens_in == 90
    assert response.tokens_out == 25
    assert response.request_hash
    fake_client.responses.create.assert_called_once()


@pytest.mark.asyncio
async def test_openai_responses_stream_adapter_yields_tokens_and_usage() -> None:
    fake_client = MagicMock()
    fake_client.responses.create.return_value = [
        SimpleNamespace(type="response.output_text.delta", delta="Hel"),
        SimpleNamespace(type="response.output_text.delta", delta="lo"),
        SimpleNamespace(
            type="response.completed",
            response=SimpleNamespace(
                model="gpt-5.5",
                usage=SimpleNamespace(input_tokens=10, output_tokens=2),
            ),
        ),
    ]

    with patch("openai.OpenAI", return_value=fake_client):
        adapter = OpenAIResponsesAdapter(
            profile=_openai_profile(),
            api_key="test-key",
            max_output_tokens=512,
        )
        events = [
            event
            async for event in adapter.stream(
                ChatAdapterRequest(system_prompt="You are Abby.", message="Hello")
            )
        ]

    assert [event.kind for event in events] == ["token", "token", "complete"]
    assert [event.token for event in events[:2]] == ["Hel", "lo"]
    assert events[-1].payload["full_content"] == "Hello"
    assert events[-1].payload["tokens_in"] == 10
    assert events[-1].payload["tokens_out"] == 2


@pytest.mark.asyncio
async def test_openai_compatible_adapter_normalizes_chat_completion() -> None:
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Compatible reply"))],
        model="deepseek-chat",
        usage=SimpleNamespace(prompt_tokens=75, completion_tokens=15),
    )

    with patch("openai.OpenAI", return_value=fake_client):
        adapter = OpenAICompatibleChatAdapter(
            profile=_openai_compatible_profile(),
            api_key="test-key",
            base_url="https://provider.test/v1",
            max_output_tokens=512,
        )
        response = await adapter.chat(
            ChatAdapterRequest(system_prompt="You are Abby.", message="Analyze this")
        )

    assert response.reply == "Compatible reply"
    assert response.provider == "openai_compatible"
    assert response.transport == "openai_compatible_chat"
    assert response.tokens_in == 75
    assert response.tokens_out == 15
    fake_client.chat.completions.create.assert_called_once()


@pytest.mark.asyncio
async def test_openai_compatible_stream_adapter_yields_tokens_and_usage() -> None:
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = [
        SimpleNamespace(
            model="deepseek-chat",
            choices=[SimpleNamespace(delta=SimpleNamespace(content="Hel"))],
            usage=None,
        ),
        SimpleNamespace(
            model="deepseek-chat",
            choices=[SimpleNamespace(delta=SimpleNamespace(content="lo"))],
            usage=None,
        ),
        SimpleNamespace(
            model="deepseek-chat",
            choices=[],
            usage=SimpleNamespace(prompt_tokens=11, completion_tokens=2),
        ),
    ]

    with patch("openai.OpenAI", return_value=fake_client):
        adapter = OpenAICompatibleChatAdapter(
            profile=_openai_compatible_profile(),
            api_key="test-key",
            base_url="https://provider.test/v1",
            max_output_tokens=512,
        )
        events = [
            event
            async for event in adapter.stream(
                ChatAdapterRequest(system_prompt="You are Abby.", message="Hello")
            )
        ]

    assert [event.kind for event in events] == ["token", "token", "complete"]
    assert events[-1].payload["full_content"] == "Hello"
    assert events[-1].payload["tokens_in"] == 11
    assert events[-1].payload["tokens_out"] == 2
