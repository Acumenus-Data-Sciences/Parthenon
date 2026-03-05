"""
Abby AI router — cohort parsing and page-aware conversational assistant.

Abby uses MedGemma (via Ollama) as the reasoning backbone:
  - /abby/parse-cohort  → NL description → structured cohort spec JSON
  - /abby/chat          → page-aware conversational Q&A

The cohort spec JSON is designed to be consumed by the Laravel backend,
which resolves concepts via SapBERT and assembles the final CohortExpression.
"""

import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────────────────

class CohortParseRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=3000,
                        description="Natural language cohort description")
    page_context: str = Field(default="cohort-builder",
                              description="Current UI page the user is on")


class ParsedTerm(BaseModel):
    text: str
    domain: str        # condition | drug | procedure | measurement | observation
    role: str          # entry | inclusion | exclusion
    negated: bool = False


class ParsedDemographics(BaseModel):
    sex: list[str] = []          # ['Female'] | ['Male'] | []
    age_min: int | None = None
    age_max: int | None = None
    race: list[str] = []
    ethnicity: list[str] = []
    location_state: list[str] = []


class ParsedTemporal(BaseModel):
    washout_days: int | None = None   # prior clean window
    within_days: int | None = None    # co-occurrence window
    index_date_offset: int = 0


class CohortParseResponse(BaseModel):
    cohort_name: str
    cohort_description: str
    demographics: ParsedDemographics
    terms: list[ParsedTerm]
    temporal: ParsedTemporal
    study_design: str          # prevalent | incident | new_users
    confidence: float          # 0–1, LLM self-assessment of parse quality
    warnings: list[str] = []
    raw_llm_output: str = ""   # for debug / transparency


class ChatMessage(BaseModel):
    role: str   # 'user' | 'assistant'
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    page_context: str = Field(
        default="general",
        description="UI page context: cohort-builder | vocabulary-search | achilles | "
                    "dqd | risk-scores | network | patient-profiles | studies | general"
    )
    page_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Relevant page entity data (cohort name, current filters, etc.)"
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Prior conversation turns (last 10 recommended)"
    )


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = []   # quick-action prompts the UI can surface as chips


# ── Ollama helpers ───────────────────────────────────────────────────────────

SYSTEM_PROMPT_COHORT_PARSER = """\
You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM research platform.

Your task is to parse a researcher's natural-language cohort description into a structured JSON object.

RULES:
1. Output ONLY valid JSON — no markdown fences, no prose before or after.
2. Use the exact schema below.
3. For "terms", classify each clinical entity:
   - domain: condition | drug | procedure | measurement | observation
   - role: entry (index event) | inclusion (must have) | exclusion (must NOT have)
4. For demographics: extract sex, age range, race, ethnicity, US state (location_state).
5. For study_design: prevalent (any history) | incident (new diagnosis) | new_users (first drug use)
6. Set confidence between 0.0 (very uncertain) and 1.0 (clear, complete description).
7. Add warnings for ambiguous terms or geography that OMOP may not support.

OUTPUT SCHEMA:
{
  "cohort_name": "Short descriptive name",
  "cohort_description": "One-sentence clinical description",
  "demographics": {
    "sex": [],
    "age_min": null,
    "age_max": null,
    "race": [],
    "ethnicity": [],
    "location_state": []
  },
  "terms": [
    {"text": "breast cancer", "domain": "condition", "role": "entry", "negated": false}
  ],
  "temporal": {
    "washout_days": null,
    "within_days": null,
    "index_date_offset": 0
  },
  "study_design": "prevalent",
  "confidence": 0.92,
  "warnings": []
}
"""

PAGE_SYSTEM_PROMPTS: dict[str, str] = {
    "cohort-builder": (
        "You are Abby, a clinical informatics assistant. "
        "The user is building a cohort definition in the Parthenon cohort builder. "
        "Help them refine inclusion/exclusion criteria, suggest OMOP concept sets, "
        "explain study design choices (new-user, prevalent, incident), and interpret "
        "the generated SQL. Be concise and clinical."
    ),
    "vocabulary-search": (
        "You are Abby. The user is searching the OMOP vocabulary. "
        "Help them find the right standard concepts, understand hierarchies, "
        "explain vocabulary differences (SNOMED, ICD10CM, RxNorm, LOINC), "
        "and suggest concept set strategies including descendants."
    ),
    "achilles": (
        "You are Abby. The user is viewing Achilles data characterization results "
        "for an OMOP CDM source. Help them interpret domain summaries, identify "
        "data quality signals, explain distributions, and compare to expected ranges."
    ),
    "dqd": (
        "You are Abby. The user is reviewing Data Quality Dashboard results. "
        "Explain DQD check categories (plausibility, conformance, completeness), "
        "help interpret failures, and suggest remediation steps."
    ),
    "risk-scores": (
        "You are Abby. The user is reviewing population risk score results "
        "(Framingham, CHA2DS2-VASc, Charlson CCI, etc.). "
        "Help them interpret risk tier distributions, explain what high confidence "
        "vs low confidence means, and compare scores across clinical groups."
    ),
    "network": (
        "You are Abby. The user is reviewing cross-site network analytics. "
        "Help them interpret I² heterogeneity statistics, explain domain coverage "
        "differences, and guide them on which sites are suitable for federated analyses."
    ),
    "patient-profiles": (
        "You are Abby. The user is viewing individual patient timelines. "
        "Help them interpret the clinical events, identify care gaps, and understand "
        "the OMOP domain structure for the events shown."
    ),
    "studies": (
        "You are Abby. The user is managing an outcomes research study in Parthenon. "
        "Help them understand study components (cohorts, characterizations, incidence rates, "
        "pathways, estimations, predictions) and guide study execution."
    ),
    "general": (
        "You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM "
        "research platform. Help the user with any question about OMOP, cohort design, "
        "data quality, clinical analytics, or the Parthenon application."
    ),
}


async def call_ollama(system_prompt: str, user_message: str,
                      history: list[ChatMessage] | None = None,
                      temperature: float = 0.1) -> str:
    """Call Ollama with the configured MedGemma model."""
    messages = [{"role": "system", "content": system_prompt}]

    if history:
        for msg in history[-10:]:  # cap at last 10 turns
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_message})

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]  # type: ignore[no-any-return]
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM service timed out.")
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        raise HTTPException(status_code=503, detail=f"LLM service unavailable: {e}")


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/parse-cohort", response_model=CohortParseResponse)
async def parse_cohort(request: CohortParseRequest) -> CohortParseResponse:
    """
    Parse a natural-language cohort description into a structured spec.
    The Laravel backend uses this to resolve OMOP concepts and build the expression JSON.
    """
    raw = await call_ollama(
        system_prompt=SYSTEM_PROMPT_COHORT_PARSER,
        user_message=request.prompt,
        temperature=0.05,   # near-deterministic for structured output
    )

    # Strip any accidental markdown fences
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1]
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        logger.warning("LLM returned non-JSON output: %s\n%s", e, raw)
        # Return a minimal fallback so the Laravel regex fallback can take over
        return CohortParseResponse(
            cohort_name="Unnamed Cohort",
            cohort_description=request.prompt[:200],
            demographics=ParsedDemographics(),
            terms=[],
            temporal=ParsedTemporal(),
            study_design="prevalent",
            confidence=0.0,
            warnings=["LLM could not parse the description into structured JSON. Falling back to regex parser."],
            raw_llm_output=raw,
        )

    # Map parsed dict → response model (with defaults for any missing keys)
    demo_raw = parsed.get("demographics", {})
    temporal_raw = parsed.get("temporal", {})

    return CohortParseResponse(
        cohort_name=parsed.get("cohort_name", "Unnamed Cohort"),
        cohort_description=parsed.get("cohort_description", ""),
        demographics=ParsedDemographics(
            sex=demo_raw.get("sex", []),
            age_min=demo_raw.get("age_min"),
            age_max=demo_raw.get("age_max"),
            race=demo_raw.get("race", []),
            ethnicity=demo_raw.get("ethnicity", []),
            location_state=demo_raw.get("location_state", []),
        ),
        terms=[
            ParsedTerm(
                text=t.get("text", ""),
                domain=t.get("domain", "condition"),
                role=t.get("role", "entry"),
                negated=t.get("negated", False),
            )
            for t in parsed.get("terms", [])
        ],
        temporal=ParsedTemporal(
            washout_days=temporal_raw.get("washout_days"),
            within_days=temporal_raw.get("within_days"),
            index_date_offset=temporal_raw.get("index_date_offset", 0),
        ),
        study_design=parsed.get("study_design", "prevalent"),
        confidence=float(parsed.get("confidence", 0.5)),
        warnings=parsed.get("warnings", []),
        raw_llm_output=raw,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Page-aware conversational endpoint. Abby adapts her persona and focus
    based on the current UI page and any entity data passed from the frontend.
    """
    system_prompt = PAGE_SYSTEM_PROMPTS.get(
        request.page_context, PAGE_SYSTEM_PROMPTS["general"]
    )

    # Enrich system prompt with page-specific data context
    if request.page_data:
        context_lines = []
        for key, val in request.page_data.items():
            if isinstance(val, (str, int, float, bool)):
                context_lines.append(f"  {key}: {val}")
            elif isinstance(val, list) and len(val) <= 5:
                context_lines.append(f"  {key}: {', '.join(str(v) for v in val)}")
        if context_lines:
            system_prompt += "\n\nCURRENT PAGE CONTEXT:\n" + "\n".join(context_lines)

    system_prompt += (
        "\n\nIMPORTANT: Keep replies concise (under 300 words). "
        "End your reply with 1–3 brief follow-up suggestions the user might want "
        'to ask, formatted as a JSON array on the last line: SUGGESTIONS: ["...", "..."]'
    )

    raw = await call_ollama(
        system_prompt=system_prompt,
        user_message=request.message,
        history=request.history,
        temperature=0.3,
    )

    # Extract suggestions from the last line if present
    suggestions: list[str] = []
    reply = raw.strip()

    if "SUGGESTIONS:" in reply:
        parts = reply.rsplit("SUGGESTIONS:", 1)
        reply = parts[0].strip()
        try:
            suggestions = json.loads(parts[1].strip())
            if not isinstance(suggestions, list):
                suggestions = []
        except (json.JSONDecodeError, IndexError):
            suggestions = []

    return ChatResponse(reply=reply, suggestions=suggestions[:3])
