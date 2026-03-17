"""Tests for the intent stack — working memory topic tracking."""
import pytest
from app.memory.intent_stack import IntentStack


class TestIntentStack:
    def test_push_single_topic(self):
        stack = IntentStack(max_depth=3, expiry_turns=10)
        stack.push("diabetes prevalence", turn=1)
        assert stack.current_topic() == "diabetes prevalence"

    def test_push_respects_max_depth(self):
        stack = IntentStack(max_depth=3, expiry_turns=10)
        stack.push("topic_a", turn=1)
        stack.push("topic_b", turn=2)
        stack.push("topic_c", turn=3)
        stack.push("topic_d", turn=4)
        assert len(stack) == 3
        assert stack.current_topic() == "topic_d"
        assert "topic_a" not in [e.topic for e in stack.entries]

    def test_explicit_topic_change_clears_stack(self):
        stack = IntentStack(max_depth=3, expiry_turns=10)
        stack.push("diabetes", turn=1)
        stack.push("hypertension", turn=2)
        stack.clear_and_set("cardiovascular outcomes", turn=3)
        assert len(stack) == 1
        assert stack.current_topic() == "cardiovascular outcomes"

    def test_entries_expire_after_n_turns(self):
        stack = IntentStack(max_depth=3, expiry_turns=3)
        stack.push("old_topic", turn=1)
        stack.push("recent_topic", turn=3)
        stack.prune(current_turn=5)
        assert len(stack) == 1
        assert stack.current_topic() == "recent_topic"

    def test_empty_stack_returns_none(self):
        stack = IntentStack(max_depth=3, expiry_turns=10)
        assert stack.current_topic() is None

    def test_get_context_returns_all_active_topics(self):
        stack = IntentStack(max_depth=3, expiry_turns=10)
        stack.push("diabetes", turn=1)
        stack.push("metformin", turn=2)
        context = stack.get_context_string()
        assert "diabetes" in context
        assert "metformin" in context

    def test_refresh_topic_updates_last_active_turn(self):
        stack = IntentStack(max_depth=3, expiry_turns=3)
        stack.push("diabetes", turn=1)
        stack.refresh("diabetes", turn=3)
        stack.prune(current_turn=4)
        assert stack.current_topic() == "diabetes"

    def test_serialization_roundtrip(self):
        stack = IntentStack(max_depth=3, expiry_turns=10)
        stack.push("diabetes", turn=1)
        stack.push("metformin", turn=2)
        data = stack.to_dict()
        restored = IntentStack.from_dict(data)
        assert len(restored) == 2
        assert restored.current_topic() == "metformin"
