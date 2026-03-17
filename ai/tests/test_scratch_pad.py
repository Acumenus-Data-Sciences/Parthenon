"""Tests for the scratch pad — session-scoped intermediate artifact storage."""
import pytest
from app.memory.scratch_pad import ScratchPad


class TestScratchPad:
    def test_store_and_retrieve_artifact(self):
        pad = ScratchPad()
        pad.store("sql_draft", "SELECT * FROM cdm.person LIMIT 10")
        assert pad.get("sql_draft") == "SELECT * FROM cdm.person LIMIT 10"

    def test_overwrite_artifact(self):
        pad = ScratchPad()
        pad.store("cohort_spec", "v1")
        pad.store("cohort_spec", "v2")
        assert pad.get("cohort_spec") == "v2"
        assert pad.get_version("cohort_spec") == 2

    def test_get_missing_returns_none(self):
        pad = ScratchPad()
        assert pad.get("nonexistent") is None

    def test_list_artifacts(self):
        pad = ScratchPad()
        pad.store("sql_draft", "SELECT 1")
        pad.store("cohort_spec", '{"entry": "diabetes"}')
        keys = pad.list_keys()
        assert set(keys) == {"sql_draft", "cohort_spec"}

    def test_clear_removes_all(self):
        pad = ScratchPad()
        pad.store("a", "1")
        pad.store("b", "2")
        pad.clear()
        assert pad.list_keys() == []

    def test_get_context_string_includes_all_artifacts(self):
        pad = ScratchPad()
        pad.store("sql_draft", "SELECT 1")
        context = pad.get_context_string()
        assert "sql_draft" in context
        assert "SELECT 1" in context

    def test_token_estimate(self):
        pad = ScratchPad()
        pad.store("short", "hello")
        assert pad.estimated_tokens() > 0

    def test_serialization_roundtrip(self):
        pad = ScratchPad()
        pad.store("key1", "value1")
        pad.store("key1", "value1_v2")
        data = pad.to_dict()
        restored = ScratchPad.from_dict(data)
        assert restored.get("key1") == "value1_v2"
        assert restored.get_version("key1") == 2
