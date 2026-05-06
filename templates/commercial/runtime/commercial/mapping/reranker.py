"""``ConceptReranker`` — LLM-rerank glue for the concept-mapping pipeline.

Phase 3 Plan 6 Task 8 (T-024A). Commercial-tier (proprietary). Wraps the
Phase 2 LlmBackend (or any drop-in LLM caller) with the
``concept_rerank`` v0.1.0 prompt to rerank ``ConceptCandidate`` lists
into ``RerankResult`` rows.

Graceful degradation per Plan 6: when the LLM is unavailable, return the
retriever's top-K unchanged with ``confidence = top1.similarity * 0.7``
so the queue still progresses but the reviewer UI flags the row for
manual confirmation.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from runtime.commercial.mapping.types import ConceptCandidate, RerankResult

_LOGGER = logging.getLogger(__name__)

DEFAULT_PROMPT_VERSION = "v0.1.0"
DEFAULT_TOP_N = 5
GRACEFUL_DEGRADE_DISCOUNT = 0.7

# Type for the injected LLM caller. Returns the parsed JSON object the
# concept_rerank schema describes, or None / raises on failure.
LlmCallable = Callable[[str, str], dict[str, Any] | None]


def _prompt_dir() -> Path:
    """Locate the prompts directory in the community runtime path."""
    # commercial/runtime/commercial/mapping/reranker.py
    # -> commercial/runtime/commercial/mapping
    # -> commercial/runtime/commercial
    # -> commercial/runtime
    # -> commercial
    # -> templates/
    # but the prompts live at templates/runtime/nlp/prompts so:
    return Path(__file__).resolve().parents[4] / "runtime" / "nlp" / "prompts"


def _load_prompt(version: str = DEFAULT_PROMPT_VERSION) -> str:
    return (_prompt_dir() / version / "concept_rerank.md").read_text(encoding="utf-8")


def _format_user_prompt(
    prompt_template: str,
    *,
    source_text: str,
    source_code: str,
    source_vocab: str,
    candidates: list[ConceptCandidate],
) -> str:
    """Render the user-section of the prompt template.

    The few-shot examples and SYSTEM section are emitted verbatim so the
    backend can split them out (or pass the whole thing as one user
    message — the contract is intentionally flexible).
    """
    candidates_json = json.dumps(
        [
            {
                "concept_id": c.concept_id,
                "concept_name": c.concept_name,
                "vocabulary_id": c.vocabulary_id,
                "domain_id": c.domain_id,
                "similarity": round(c.similarity, 4),
            }
            for c in candidates
        ],
        indent=2,
    )
    return (
        prompt_template.replace("{{source_text}}", source_text)
        .replace("{{source_code}}", source_code)
        .replace("{{source_vocab}}", source_vocab)
        .replace("{{candidates_json}}", candidates_json)
    )


class ConceptReranker:
    """LLM rerank wrapper that emits ``RerankResult`` rows."""

    type_name = "concept_reranker"

    def __init__(
        self,
        llm_callable: LlmCallable | None = None,
        *,
        prompt_version: str = DEFAULT_PROMPT_VERSION,
        top_n: int = DEFAULT_TOP_N,
        rerank_model: str = "stub@unwired",
    ) -> None:
        self._llm = llm_callable
        self._prompt_version = prompt_version
        self._top_n = top_n
        self._rerank_model = rerank_model

    def rerank(
        self,
        *,
        source_text: str,
        source_code: str,
        source_vocab: str,
        candidates: list[ConceptCandidate],
    ) -> RerankResult:
        """Rerank ``candidates`` for the given source code/text.

        Returns a ``RerankResult`` of up to ``top_n`` candidates plus an
        overall confidence in [0, 1]. On LLM failure or absence, falls
        back to the retriever's order with a discounted confidence.
        """
        if not candidates:
            # Pass-through 'no opinion' result — mirrors the LoincHarmonizerStub
            # community-tier semantics.
            return RerankResult(
                source_text=source_text,
                source_code=source_code,
                source_vocab=source_vocab,
                candidates=[],
                rerank_model=self._rerank_model,
                confidence=0.0,
            )

        if self._llm is None:
            return self._degrade(source_text, source_code, source_vocab, candidates)

        try:
            prompt = _load_prompt(self._prompt_version)
            user_prompt = _format_user_prompt(
                prompt,
                source_text=source_text,
                source_code=source_code,
                source_vocab=source_vocab,
                candidates=candidates,
            )
            response = self._llm(user_prompt, self._prompt_version)
        except Exception:
            _LOGGER.exception("rerank LLM call failed; degrading")
            return self._degrade(source_text, source_code, source_vocab, candidates)

        if not response:
            return self._degrade(source_text, source_code, source_vocab, candidates)

        return self._materialize(response, source_text, source_code, source_vocab, candidates)

    def _materialize(
        self,
        response: dict[str, Any],
        source_text: str,
        source_code: str,
        source_vocab: str,
        candidates: list[ConceptCandidate],
    ) -> RerankResult:
        """Convert the JSON rerank response into a ``RerankResult``.

        Drops any candidate whose concept_id was not in the input list
        (the SYSTEM prompt forbids fabrication; if the LLM violates,
        degrade rather than trust).
        """
        cand_by_id = {c.concept_id: c for c in candidates}
        ranked_resp = response.get("ranked", [])
        out: list[ConceptCandidate] = []
        for entry in ranked_resp[: self._top_n]:
            cid = entry.get("concept_id")
            if not isinstance(cid, int) or cid not in cand_by_id:
                continue
            out.append(cand_by_id[cid])

        if not out:
            return self._degrade(source_text, source_code, source_vocab, candidates)

        confidence_raw = response.get("confidence", 0.0)
        try:
            confidence = max(0.0, min(1.0, float(confidence_raw)))
        except (TypeError, ValueError):
            confidence = 0.0

        return RerankResult(
            source_text=source_text,
            source_code=source_code,
            source_vocab=source_vocab,
            candidates=out,
            rerank_model=str(response.get("rerank_model", self._rerank_model)),
            confidence=confidence,
        )

    def _degrade(
        self,
        source_text: str,
        source_code: str,
        source_vocab: str,
        candidates: list[ConceptCandidate],
    ) -> RerankResult:
        """Graceful-degrade path: take retriever's top-N with discount."""
        top = candidates[: self._top_n]
        confidence = top[0].similarity * GRACEFUL_DEGRADE_DISCOUNT if top else 0.0
        return RerankResult(
            source_text=source_text,
            source_code=source_code,
            source_vocab=source_vocab,
            candidates=top,
            rerank_model=f"{self._rerank_model}+degraded",
            confidence=max(0.0, min(1.0, confidence)),
        )


__all__ = [
    "DEFAULT_PROMPT_VERSION",
    "DEFAULT_TOP_N",
    "GRACEFUL_DEGRADE_DISCOUNT",
    "ConceptReranker",
    "LlmCallable",
]
