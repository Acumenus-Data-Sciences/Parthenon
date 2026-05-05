"""PromptRegistry version-pinned prompt loader."""

from __future__ import annotations

import pytest

from runtime.nlp.exceptions import PromptVersionError
from runtime.nlp.registry import PromptRegistry


def test_registry_loads_pinned_version() -> None:
    registry = PromptRegistry()
    prompt = registry.get("clinical_ner_v1", "v0.1.0")
    # Stub is fine for now — Task 11 replaces with the full prompt body.
    assert "system" in prompt.lower()


def test_registry_rejects_unknown_version() -> None:
    registry = PromptRegistry()
    with pytest.raises(PromptVersionError):
        registry.get("clinical_ner_v1", "v9.9.9")


def test_registry_rejects_unknown_prompt_name() -> None:
    registry = PromptRegistry()
    with pytest.raises(PromptVersionError):
        registry.get("not_a_real_prompt", "v0.1.0")
