"""Llettuce backend — UCL's clinical concept-mapping library (eval-only; Q4).

Phase 2 ships this as an EVALUATION-ONLY backend: used by the
NerEvalRunner for compare-mode metrics, NOT registered for production
manifests. Phase 3 will decide whether to graduate Llettuce based on the
report this harness produces.

The upstream package (https://github.com/Health-Informatics-UoN/lettuce)
is a uv workspace and isn't on PyPI yet, so we import it lazily and
raise a clear LlettuceBackendError if it's not installed.
"""

from __future__ import annotations

from typing import Any

from runtime.nlp.exceptions import LlettuceBackendError
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


def _lettuce_run(text: str) -> list[dict[str, Any]]:
    """Indirection over the upstream package call.

    Implemented as a module-level function so unit tests can ``patch`` it
    without standing up a real Llettuce index. The real implementation
    imports the upstream package lazily and runs the configured pipeline.
    """
    try:
        # Resolve the actual upstream API at integration time.
        # The PyPI name + entry-point may change once UCL publishes — see
        # docs/architecture/adr-0013-llettuce-eval-and-graduation.md.
        from lettuce import run as _run  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise LlettuceBackendError(
            "lettuce package not installed; install via "
            '`uv pip install "lettuce @ git+https://github.com/'
            'Health-Informatics-UoN/lettuce.git#subdirectory=lettuce"`'
        ) from exc
    return list(_run(text))


class LlettuceBackend:
    """NlpBackend implementation routing to UCL's Llettuce package."""

    def __init__(self) -> None:
        self.model_name = "lettuce-omop"

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        try:
            raw = _lettuce_run(text)
        except LlettuceBackendError:
            raise
        except Exception as exc:
            raise LlettuceBackendError(f"lettuce inference failed: {exc}") from exc

        spans: list[NerSpan] = []
        mappings: list[NerConceptMapping] = []
        for i, item in enumerate(raw):
            spans.append(
                NerSpan(
                    start=int(item["start"]),
                    end=int(item["end"]),
                    text=str(item["text"]),
                    label=str(item["label"]),
                )
            )
            if "concept_id" in item:
                mappings.append(
                    NerConceptMapping(
                        span_index=i,
                        concept_id=int(item["concept_id"]),
                        vocabulary_id=str(item["vocabulary_id"]),
                        confidence=float(item["confidence"]),
                    )
                )
        return NerInferenceResult(
            spans=spans,
            mappings=mappings,
            model_name=self.model_name,
            prompt_version=prompt_version,
        )
