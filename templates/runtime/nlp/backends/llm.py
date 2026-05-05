"""LLM-backed NER. Default provider is MedGemma via the local
``parthenon-ai-service`` (decision Q1). Cloud OpenAI-compat is gated by
``OPENAI_LLM_ENABLED=true`` for HIPAA-cleared deployments only. The cloud
path enforces a per-job spend cap via ``OPENAI_BUDGET_USD`` and raises
``LlmBudgetExceeded`` once breached (decision Q11).
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from runtime.nlp.exceptions import LlmBackendError, LlmBudgetExceeded
from runtime.nlp.registry import PromptRegistry
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan

# Lazy-imported in cloud path so the openai package is not required for the
# default Ollama deployment.
try:  # pragma: no cover - import-time fallback
    from openai import OpenAI as _OpenAI
except ImportError:  # pragma: no cover
    _OpenAI = None  # type: ignore[assignment,misc]


class LlmBackend:
    """Pluggable LLM backend with two providers.

    - ``provider="ollama"`` (default): routes to the existing
      ``parthenon-ai-service`` HTTP endpoint, which already has MedGemma
      loaded via Ollama. No new infrastructure.
    - ``provider="openai"`` (gated): direct OpenAI-compat API call. Active
      only when ``OPENAI_LLM_ENABLED=true`` AND ``OPENAI_API_KEY`` is set;
      silently falls back to ``ollama`` otherwise.

    The instance carries a per-job budget. Each cloud inference accumulates
    estimated cost from token usage; once the running total reaches
    ``OPENAI_BUDGET_USD``, the next call raises ``LlmBudgetExceeded``.
    """

    def __init__(
        self,
        provider: str = "ollama",
        registry: PromptRegistry | None = None,
        ai_service_url: str | None = None,
    ) -> None:
        self._registry = registry or PromptRegistry()
        self._ai_service_url = ai_service_url or os.environ.get(
            "PARTHENON_AI_SERVICE_URL", "http://parthenon-ai-service:8002"
        )

        self._openai: Any = None
        if provider == "openai" and os.environ.get("OPENAI_LLM_ENABLED") == "true":
            self.provider = "openai"
            self.model_name = os.environ.get("OPENAI_LLM_MODEL", "gpt-4o-mini")
            if _OpenAI is not None:
                self._openai = _OpenAI()
        else:
            self.provider = "ollama"
            self.model_name = os.environ.get("OLLAMA_MODEL", "medgemma:7b")

        self._budget_usd = float(os.environ.get("OPENAI_BUDGET_USD", "0.0"))
        self._spent_usd = 0.0
        # Default GPT-4o-mini pricing (USD per 1k tokens) as of 2026-05-05.
        self._cost_per_1k_prompt = float(os.environ.get("OPENAI_COST_PER_1K_PROMPT", "0.00015"))
        self._cost_per_1k_completion = float(
            os.environ.get("OPENAI_COST_PER_1K_COMPLETION", "0.0006")
        )

    @property
    def spent_usd(self) -> float:
        """Cumulative estimated spend on this backend instance (cloud only)."""
        return self._spent_usd

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        if self.provider == "openai":
            return self._infer_openai(text, prompt_version)
        return self._infer_ollama(text, prompt_version)

    # --- Ollama path -------------------------------------------------------
    def _infer_ollama(self, text: str, prompt_version: str) -> NerInferenceResult:
        prompt = self._registry.get("clinical_ner_v1", prompt_version)
        try:
            r = httpx.post(
                f"{self._ai_service_url}/v1/ner/infer",
                json={"text": text, "prompt": prompt, "model": self.model_name},
                timeout=120.0,
            )
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise LlmBackendError(f"ollama inference failed: {exc}") from exc

        return self._build_result(data, prompt_version)

    # --- Cloud OpenAI-compat path ------------------------------------------
    def _infer_openai(self, text: str, prompt_version: str) -> NerInferenceResult:
        if self._openai is None:
            raise LlmBackendError(
                "openai package not available; install with `uv add openai` "
                "or set OPENAI_LLM_ENABLED=false"
            )
        if self._budget_usd > 0 and self._spent_usd >= self._budget_usd:
            raise LlmBudgetExceeded(
                f"openai job spend ${self._spent_usd:.4f} >= budget ${self._budget_usd:.4f}"
            )

        prompt = self._registry.get("clinical_ner_v1", prompt_version)
        completion = self._openai.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LlmBackendError(f"openai returned non-JSON content: {content[:200]!r}") from exc

        usage = getattr(completion, "usage", None)
        if usage is not None:
            prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(usage, "completion_tokens", 0) or 0
            cost = (
                prompt_tokens / 1000 * self._cost_per_1k_prompt
                + completion_tokens / 1000 * self._cost_per_1k_completion
            )
            self._spent_usd += cost

        return self._build_result(data, prompt_version)

    # --- Shared --------------------------------------------------------------
    def _build_result(self, data: dict[str, Any], prompt_version: str) -> NerInferenceResult:
        spans = [NerSpan(**s) for s in data.get("spans", [])]
        mappings = [NerConceptMapping(**m) for m in data.get("mappings", [])]
        return NerInferenceResult(
            spans=spans,
            mappings=mappings,
            model_name=self.model_name,
            prompt_version=prompt_version,
        )
