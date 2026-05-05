"""SciSpaCy backend — routes NER inference through the parthenon-scispacy sidecar.

Decision Q3: SciSpaCy ships as a separate sidecar container so customers
who don't need NER aren't forced to bundle the ~110-750 MB model in the
main parthenon-templates image. The HTTP contract matches the LLM
backend's parthenon-ai-service surface so backends are interchangeable
at the NoteNlpNode dispatch level.
"""

from __future__ import annotations

import os

import httpx

from runtime.nlp.exceptions import SciSpacyBackendError
from runtime.nlp.types import NerConceptMapping, NerInferenceResult, NerSpan


class SciSpacyBackend:
    """NlpBackend implementation routing to the parthenon-scispacy sidecar."""

    def __init__(self, sidecar_url: str | None = None) -> None:
        self.sidecar_url = sidecar_url or os.environ.get(
            "PARTHENON_SCISPACY_URL", "http://parthenon-scispacy:5101"
        )
        self.model_name = os.environ.get("SCISPACY_MODEL", "en_core_sci_md")

    def infer(self, text: str, prompt_version: str) -> NerInferenceResult:
        try:
            r = httpx.post(
                f"{self.sidecar_url}/v1/ner/infer",
                json={"text": text, "model": self.model_name},
                timeout=120.0,
            )
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SciSpacyBackendError(f"scispacy inference failed: {exc}") from exc

        spans = [NerSpan(**s) for s in data.get("spans", [])]
        mappings = [NerConceptMapping(**m) for m in data.get("mappings", [])]
        return NerInferenceResult(
            spans=spans,
            mappings=mappings,
            model_name=self.model_name,
            prompt_version=prompt_version,
        )
