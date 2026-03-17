"""Tests for conversation summarizer — compresses old turns for capacity management."""
import pytest
from app.memory.summarizer import ConversationSummarizer


class TestConversationSummarizer:
    def test_should_summarize_when_over_threshold(self):
        summarizer = ConversationSummarizer(threshold_ratio=0.7, context_window=4000)
        messages = [{"role": "user", "content": "x" * 3000}]
        assert summarizer.should_summarize(messages) is True

    def test_should_not_summarize_when_under_threshold(self):
        summarizer = ConversationSummarizer(threshold_ratio=0.7, context_window=4000)
        messages = [{"role": "user", "content": "short message"}]
        assert summarizer.should_summarize(messages) is False

    def test_estimate_tokens(self):
        summarizer = ConversationSummarizer(threshold_ratio=0.7, context_window=4000)
        messages = [{"role": "user", "content": "Hello world"}, {"role": "assistant", "content": "Hi there"}]
        tokens = summarizer.estimate_tokens(messages)
        assert tokens > 0
        assert tokens < 100

    def test_split_messages_for_summarization(self):
        summarizer = ConversationSummarizer(threshold_ratio=0.7, context_window=100)
        messages = [
            {"role": "user", "content": "msg1", "turn": 1},
            {"role": "assistant", "content": "resp1", "turn": 1},
            {"role": "user", "content": "msg2", "turn": 2},
            {"role": "assistant", "content": "resp2", "turn": 2},
            {"role": "user", "content": "msg3", "turn": 3},
            {"role": "assistant", "content": "resp3", "turn": 3},
        ]
        old, recent = summarizer.split_for_summarization(messages, keep_recent=2)
        assert len(old) == 2
        assert len(recent) == 4

    def test_format_summary_prompt(self):
        summarizer = ConversationSummarizer(threshold_ratio=0.7, context_window=4000)
        messages = [
            {"role": "user", "content": "What is diabetes?"},
            {"role": "assistant", "content": "Diabetes is a metabolic condition..."},
        ]
        prompt = summarizer.format_summary_prompt(messages)
        assert "diabetes" in prompt.lower()
        assert "summarize" in prompt.lower()
