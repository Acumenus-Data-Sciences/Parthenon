"""LOINC harmonizer protocol — interface that Plan 6 (T-024) implements.

Phase 3 Plan 5 Task 9 (T-023). Community-tier (AGPLv3) defines the
shape of "given a local lab code, suggest LOINC candidates." The
community wheel ships a no-op stub (``LoincHarmonizerStub``) that
returns an empty suggestion list — customers running only the
community templates get the queue + manual review.

Plan 6 will land the commercial-tier ``BgeRerankLoincHarmonizer``
that consumes ``unmapped_local_lab_code`` queue rows and produces
non-empty Suggestion lists. The community / commercial split is
deliberate: keeping the AI-assisted mapper proprietary is the wedge,
keeping the lab interop community-grade is the moat.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field


class Suggestion(BaseModel):
    """One LOINC harmonization candidate for a local lab code."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    loinc_code: str = Field(description="Suggested LOINC concept_code")
    loinc_text: str = Field(description="Standard concept_name for the suggestion")
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score in [0, 1]; closer to 1 = stronger match",
    )
    rationale: str = Field(
        default="",
        description="Optional human-readable rationale (e.g. 'name+units exact match')",
    )


@runtime_checkable
class LoincHarmonizer(Protocol):
    """Maps a (local_code, local_text, observed_unit_examples) tuple to LOINC.

    Implementations:

    - Community-tier ``LoincHarmonizerStub`` (this module): returns ``[]``.
    - Commercial-tier (Plan 6, T-024): hybrid bge-base + LLM rerank with
      acceptance gates (top-1 >= 60%, top-5 >= 85%).
    """

    def suggest(
        self,
        local_code: str,
        local_text: str,
        examples: list[str],
    ) -> list[Suggestion]:
        """Return a ranked list of LOINC suggestions (most-likely first).

        Empty list = "no opinion" (the queue stays for manual review).
        """
        ...


class LoincHarmonizerStub:
    """Community-tier no-op LoincHarmonizer.

    Conforms to the ``LoincHarmonizer`` Protocol so callers don't need to
    branch on tier — the queue review UI just shows suggestions where
    the harmonizer returns them, and an empty list when it doesn't.
    """

    type_name = "loinc_harmonizer_stub"

    def suggest(
        self,
        local_code: str,
        local_text: str,
        examples: list[str],
    ) -> list[Suggestion]:
        return []


__all__ = ["LoincHarmonizer", "LoincHarmonizerStub", "Suggestion"]
