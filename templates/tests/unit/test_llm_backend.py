"""LlmBackend — Ollama default + cloud OpenAI-compat + per-job budget cap.

Covers Plan 1 Tasks 6 (Ollama path), 7 (cloud path gated by env), and 8
(LlmBudgetExceeded raise once accumulated spend >= OPENAI_BUDGET_USD).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from runtime.nlp.backends.llm import LlmBackend
from runtime.nlp.exceptions import LlmBackendError, LlmBudgetExceeded
from runtime.nlp.types import NerInferenceResult

# --- Ollama default ----------------------------------------------------------


def test_default_provider_is_ollama() -> None:
    backend = LlmBackend()
    assert backend.provider == "ollama"
    assert backend.model_name == "medgemma:7b"


@patch("runtime.nlp.backends.llm.httpx.post")
def test_ollama_calls_parthenon_ai_service(mock_post: MagicMock) -> None:
    mock_post.return_value.json.return_value = {
        "spans": [{"start": 0, "end": 10, "text": "chest pain", "label": "condition"}],
        "mappings": [],
    }
    mock_post.return_value.raise_for_status = MagicMock()

    backend = LlmBackend()
    result = backend.infer("Patient reports chest pain.", "v0.1.0")
    assert isinstance(result, NerInferenceResult)
    assert result.model_name == "medgemma:7b"
    assert result.prompt_version == "v0.1.0"
    assert len(result.spans) == 1
    mock_post.assert_called_once()
    assert "parthenon-ai-service" in mock_post.call_args[0][0]


@patch("runtime.nlp.backends.llm.httpx.post")
def test_ollama_wraps_http_errors(mock_post: MagicMock) -> None:
    import httpx

    mock_post.side_effect = httpx.HTTPError("boom")
    backend = LlmBackend()
    with pytest.raises(LlmBackendError):
        backend.infer("text", "v0.1.0")


# --- Cloud path gating -------------------------------------------------------


def test_cloud_path_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_LLM_ENABLED", raising=False)
    backend = LlmBackend(provider="openai")
    # provider="openai" is requested, but env flag absent → falls back to ollama.
    assert backend.provider == "ollama"


def test_cloud_path_enabled_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    backend = LlmBackend(provider="openai")
    assert backend.provider == "openai"
    assert backend.model_name.startswith("gpt-")


# --- Cloud inference call ----------------------------------------------------


@patch("runtime.nlp.backends.llm._OpenAI")
def test_cloud_calls_openai(mock_cls: MagicMock, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=MagicMock(content='{"spans":[],"mappings":[]}'))]
    mock_completion.usage = MagicMock(prompt_tokens=100, completion_tokens=50)
    mock_cls.return_value.chat.completions.create.return_value = mock_completion

    backend = LlmBackend(provider="openai")
    result = backend.infer("test text", "v0.1.0")
    assert result.model_name.startswith("gpt-")


# --- Budget cap (Q11) --------------------------------------------------------


@patch("runtime.nlp.backends.llm._OpenAI")
def test_budget_cap_raises_when_exceeded(
    mock_cls: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OPENAI_BUDGET_USD", "0.01")

    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=MagicMock(content='{"spans":[],"mappings":[]}'))]
    # 2000 prompt tokens at $0.00015/1k = $0.0003; 2000 completion at $0.0006/1k = $0.0012
    # Per call: $0.0015 -> 7 calls = $0.0105 (just over $0.01 cap)
    mock_completion.usage = MagicMock(prompt_tokens=2000, completion_tokens=2000)
    mock_cls.return_value.chat.completions.create.return_value = mock_completion

    backend = LlmBackend(provider="openai")
    # Burn through ~$0.0105 of spend over 7 calls; the 8th must raise.
    for _ in range(7):
        backend.infer("text", "v0.1.0")
    assert backend.spent_usd > 0.01
    with pytest.raises(LlmBudgetExceeded):
        backend.infer("text", "v0.1.0")


def test_budget_cap_disabled_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_LLM_ENABLED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("OPENAI_BUDGET_USD", raising=False)
    backend = LlmBackend(provider="openai")
    # Budget of 0 means uncapped; spent_usd starts at 0 and never blocks.
    assert backend._budget_usd == 0.0
