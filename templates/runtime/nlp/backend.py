"""Pluggable NLP backend protocol — mirrors Phase 1 AnonymizerBackend."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from runtime.nlp.types import NerInferenceResult


@runtime_checkable
class NlpBackend(Protocol):
    """Contract every NLP backend (LLM, SciSpaCy, Llettuce) must satisfy."""

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        """Run NER inference against ``text`` and return a typed result."""
        ...
