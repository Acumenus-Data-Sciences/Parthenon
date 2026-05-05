"""NlpBackend Protocol contract + exception hierarchy."""

from __future__ import annotations

from runtime.nlp.backend import NlpBackend
from runtime.nlp.exceptions import LlmBackendError, LlmBudgetExceeded, PromptVersionError
from runtime.nlp.types import NerInferenceResult


def test_concrete_backend_satisfies_protocol() -> None:
    class FakeBackend:
        def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
            return NerInferenceResult(
                spans=[], mappings=[], model_name="fake", prompt_version=prompt_version
            )

    backend: NlpBackend = FakeBackend()
    result = backend.infer("hi", "v0.1.0")
    assert result.model_name == "fake"


def test_llm_budget_exceeded_is_subclass_of_llm_backend_error() -> None:
    assert issubclass(LlmBudgetExceeded, LlmBackendError)


def test_prompt_version_error_is_subclass_of_llm_backend_error() -> None:
    assert issubclass(PromptVersionError, LlmBackendError)


def test_runtime_checkable_protocol_recognizes_duck_typed() -> None:
    class Walrus:
        def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
            return NerInferenceResult(spans=[], mappings=[], model_name="w", prompt_version="v")

    assert isinstance(Walrus(), NlpBackend)
