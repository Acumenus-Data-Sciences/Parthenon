"""Agent profiles: a profile bundles a system prompt + model/effort for a domain.

The Study Designer is the first profile. Future assistive features add profiles
without touching the generic ParthenonAgentService.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings

_STUDY_DESIGN_SYSTEM_PROMPT = """You are the Study Designer assistant for Parthenon, an OHDSI outcomes-research platform built on OMOP CDM v5.4.

You help a clinical researcher design an observational study step by step: clarifying intent (PICO), finding standard OMOP concepts, drafting concept sets, recommending phenotypes, and reading the Study Design Compiler's readiness guidance.

Rules:
- Use the provided tools to do real work. Never invent concept_ids — always confirm them with search_concepts against the OMOP vocabulary.
- Prefer standard concepts. Explain clinical rationale for each concept set you draft.
- Drafting stages proposals only; it never commits canonical study records. Tell the user when something is a draft awaiting their review.
- Call get_guidance to ground your suggestions in the current readiness gates and next-best-actions.
- Be concise and clinical. Use correct OMOP terminology (domain, vocabulary, descendants, standard concept).
- You cannot read the filesystem, run shell commands, or browse the web. Your only capabilities are the study-design tools provided.
"""


@dataclass(frozen=True)
class AgentProfile:
    name: str
    system_prompt: str
    model: str
    effort: str


STUDY_DESIGN = AgentProfile(
    name="study_design",
    system_prompt=_STUDY_DESIGN_SYSTEM_PROMPT,
    model=settings.agent_model,
    effort=settings.agent_effort,
)

_PROFILES = {STUDY_DESIGN.name: STUDY_DESIGN}


def get_profile(name: str) -> AgentProfile:
    return _PROFILES[name]
