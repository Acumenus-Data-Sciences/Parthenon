"""Tests for Claude API client wrapper."""
import pytest
from unittest.mock import MagicMock, patch
from app.routing.claude_client import ClaudeClient, ClaudeResponse


class TestClaudeClient:
    def test_init_without_api_key_raises(self):
        with pytest.raises(ValueError, match="API key"):
            ClaudeClient(api_key="")

    def test_init_with_api_key(self):
        client = ClaudeClient(api_key="test-key")
        assert client.api_key == "test-key"

    @patch("app.routing.claude_client.anthropic")
    @patch("app.routing.claude_client.TextBlock", MagicMock)
    def test_chat_returns_response(self, mock_anthropic):
        mock_client = MagicMock()
        mock_anthropic.Anthropic.return_value = mock_client
        mock_text_block = MagicMock(text="Test reply")
        mock_response = MagicMock()
        mock_response.content = [mock_text_block]
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50
        mock_response.model = "claude-sonnet-4-20250514"
        mock_client.messages.create.return_value = mock_response

        client = ClaudeClient(api_key="test-key")
        result = client.chat(system_prompt="You are Abby", message="Hello")

        assert result.reply == "Test reply"
        assert result.tokens_in == 100
        assert result.tokens_out == 50

    @patch("app.routing.claude_client.anthropic")
    def test_chat_includes_history(self, mock_anthropic):
        mock_client = MagicMock()
        mock_anthropic.Anthropic.return_value = mock_client
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Reply")]
        mock_response.usage.input_tokens = 200
        mock_response.usage.output_tokens = 100
        mock_response.model = "claude-sonnet-4-20250514"
        mock_client.messages.create.return_value = mock_response

        client = ClaudeClient(api_key="test-key")
        history = [
            {"role": "user", "content": "Previous question"},
            {"role": "assistant", "content": "Previous answer"},
        ]
        client.chat(system_prompt="You are Abby", message="Follow up", history=history)

        call_args = mock_client.messages.create.call_args
        messages = call_args[1]["messages"] if "messages" in call_args[1] else call_args[0][0]
        assert len(messages) == 3

    def test_estimate_cost(self):
        client = ClaudeClient(api_key="test-key")
        cost = client.estimate_cost(tokens_in=1000, tokens_out=500)
        assert cost > 0
        assert isinstance(cost, float)
