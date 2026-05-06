"""NLP backend exception hierarchy."""

from __future__ import annotations


class LlmBackendError(RuntimeError):
    """Base for all NLP backend failures (LLM, SciSpaCy, Llettuce)."""


class LlmBudgetExceeded(LlmBackendError):
    """Raised when accumulated job spend exceeds the per-job budget cap (Q11)."""


class PromptVersionError(LlmBackendError):
    """Raised when the manifest pins a prompt version that doesn't exist in the registry."""


class SciSpacyBackendError(LlmBackendError):
    """Raised when the parthenon-scispacy sidecar HTTP call fails."""


class LlettuceBackendError(LlmBackendError):
    """Raised when the Llettuce upstream package fails (eval-only; Q4)."""
