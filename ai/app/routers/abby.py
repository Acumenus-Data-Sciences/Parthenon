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
import os
from pathlib import Path
from typing import Any, AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.chroma.memory import store_conversation_turn
from app.chroma.retrieval import build_rag_context
from app.config import settings
from app.memory.context_assembler import ContextAssembler, ContextPiece, ContextTier
from app.memory.intent_stack import IntentStack
from app.memory.scratch_pad import ScratchPad
from app.memory.profile_learner import ProfileLearner, UserProfile as MemoryUserProfile
from app.routing.rule_router import RuleRouter, RoutingDecision
from app.routing.claude_client import ClaudeClient
from app.routing.phi_sanitizer import PHISanitizer
from app.routing.cloud_safety import CloudSafetyFilter
from app.routing.cost_tracker import CostTracker

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Session-scoped working memory (in-memory, cleared on service restart) ────

_session_state: dict[int, dict] = {}

# ── Phase 2: Routing components ──────────────────────────────────────────────

_router = RuleRouter()
_phi_sanitizer = PHISanitizer(use_ner=True)
_cloud_safety = CloudSafetyFilter()
_claude_client: ClaudeClient | None = None
_cost_tracker: CostTracker | None = None


def _get_claude_client() -> ClaudeClient | None:
    global _claude_client
    if _claude_client is None and settings.claude_api_key:
        try:
            _claude_client = ClaudeClient()
        except ValueError:
            logger.warning("Claude API key not configured, cloud routing disabled")
    return _claude_client


def _get_cost_tracker() -> CostTracker:
    global _cost_tracker
    if _cost_tracker is None:
        from sqlalchemy import create_engine
        engine = create_engine(settings.database_url)
        _cost_tracker = CostTracker(
            engine=engine,
            monthly_budget=settings.cloud_monthly_budget_usd,
            cutoff_threshold=settings.cloud_budget_cutoff_threshold,
            alert_thresholds=settings.cloud_budget_alert_thresholds,
        )
    return _cost_tracker


def _get_session(conversation_id: int | None) -> dict:
    """Get or create session state for a conversation."""
    if conversation_id is None:
        return {"intent_stack": IntentStack(), "scratch_pad": ScratchPad(), "turn": 0}
    if conversation_id not in _session_state:
        _session_state[conversation_id] = {
            "intent_stack": IntentStack(),
            "scratch_pad": ScratchPad(),
            "turn": 0,
        }
    return _session_state[conversation_id]


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


class ResearchProfile(BaseModel):
    """Learned research profile from the profile_learner module."""
    research_interests: list[str] = []
    expertise_domains: dict[str, float] = {}
    interaction_preferences: dict = {}
    frequently_used: dict = {}
    interaction_count: int = 0


class UserProfile(BaseModel):
    name: str = ""
    roles: list[str] = []
    research_profile: ResearchProfile = ResearchProfile()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    page_context: str = Field(
        default="general",
        description="UI page context for Abby to tailor responses"
    )
    page_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Relevant page entity data (cohort name, current filters, etc.)"
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Prior conversation turns (last 10 recommended)"
    )
    user_profile: UserProfile | None = Field(
        default=None,
        description="Current user info for personalized responses"
    )
    user_id: int | None = Field(
        default=None,
        description="Current user ID for personalized conversation memory"
    )
    conversation_id: int | None = Field(
        default=None,
        description="Conversation ID for session memory tracking"
    )


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = []   # quick-action prompts the UI can surface as chips
    routing: dict = {}
    confidence: str = ""
    sources: list[dict] = []


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
    "cohort_builder": (
        "You are Abby, a clinical informatics assistant. "
        "The user is building a cohort definition in the Parthenon cohort builder. "
        "Help them refine inclusion/exclusion criteria, suggest OMOP concept sets, "
        "explain study design choices (new-user, prevalent, incident), and interpret "
        "the generated SQL. Be concise and clinical."
    ),
    "cohort_list": (
        "You are Abby. The user is viewing the list of cohort definitions. "
        "Help them understand cohort design strategies, compare cohorts, "
        "and explain new-user vs prevalent vs incident study designs."
    ),
    "concept_set_editor": (
        "You are Abby. The user is editing a concept set in the concept set builder. "
        "Help them add/remove concepts, decide on include-descendants strategy, "
        "understand OMOP vocabulary hierarchies, and resolve non-standard to standard mappings."
    ),
    "concept_set_list": (
        "You are Abby. The user is browsing their concept sets. "
        "Help them understand concept set organization, versioning best practices, "
        "and how concept sets feed into cohort definitions."
    ),
    "vocabulary": (
        "You are Abby. The user is searching the OMOP vocabulary. "
        "Help them find the right standard concepts, understand hierarchies, "
        "explain vocabulary differences (SNOMED, ICD10CM, RxNorm, LOINC, ATC), "
        "and suggest concept set strategies including descendants."
    ),
    "data_explorer": (
        "You are Abby. The user is viewing Achilles data characterization results "
        "for an OMOP CDM source. Help them interpret domain summaries, identify "
        "data quality signals, explain distributions (age, gender, observation periods), "
        "and compare to expected clinical data ranges."
    ),
    "data_sources": (
        "You are Abby. The user is managing OMOP CDM data sources. "
        "Help them configure source connections, understand source daimons "
        "(CDM, vocabulary, results, temp), and troubleshoot connection issues."
    ),
    "data_quality": (
        "You are Abby. The user is reviewing Data Quality Dashboard results. "
        "Explain DQD check categories (plausibility, conformance, completeness), "
        "help interpret failures and heel rules, and suggest remediation steps."
    ),
    "analyses": (
        "You are Abby. The user is on the Analyses overview page. "
        "Help them understand the different analysis types available: "
        "Characterizations, Incidence Rates, Cohort Pathways, Estimation (CohortMethod), "
        "Prediction (PatientLevelPrediction), SCCS, and Evidence Synthesis. "
        "Guide them on which analysis type fits their research question."
    ),
    "incidence_rates": (
        "You are Abby. The user is working with incidence rate analyses. "
        "Help them define time-at-risk windows, choose target and outcome cohorts, "
        "interpret incidence rate vs proportion, and understand age/sex stratification."
    ),
    "estimation": (
        "You are Abby. The user is designing a comparative effectiveness estimation. "
        "Help with propensity score methods (IPTW, stratification, matching), "
        "negative control outcomes, diagnostic checks, and interpreting hazard ratios."
    ),
    "prediction": (
        "You are Abby. The user is working with patient-level prediction models. "
        "Help them choose features, understand LASSO regularization, interpret "
        "AUROC/calibration metrics, and evaluate model performance and external validation."
    ),
    "genomics": (
        "You are Abby. The user is in the Genomics module. "
        "Help with VCF file interpretation, variant pathogenicity (ClinVar annotations), "
        "GIAB benchmark comparisons, gene panel design, pharmacogenomics (PGx), "
        "and creating genomic cohort criteria within the OMOP CDM framework."
    ),
    "imaging": (
        "You are Abby. The user is in the Medical Imaging module. "
        "Help with DICOM study management, viewer navigation, imaging analytics, "
        "modality interpretation (CT, MRI, X-ray, US), NLP extraction from reports, "
        "and creating imaging-based cohort criteria."
    ),
    "heor": (
        "You are Abby. The user is in the Health Economics & Outcomes Research module. "
        "Help with cost-effectiveness analysis (CEA), cost-utility analysis (CUA), "
        "budget impact modeling, value-based contract simulation, sensitivity analysis, "
        "and interpreting ICER thresholds and willingness-to-pay curves."
    ),
    "studies": (
        "You are Abby. The user is managing an outcomes research study in Parthenon. "
        "Help them understand study components (cohorts, characterizations, incidence rates, "
        "pathways, estimations, predictions), study lifecycle transitions, "
        "multi-site coordination, and protocol design best practices."
    ),
    "administration": (
        "You are Abby. The user is in the Administration panel. "
        "Help them configure authentication providers, manage user roles and permissions, "
        "set up AI providers, check system health, and manage data source connections."
    ),
    "patient_profiles": (
        "You are Abby. The user is viewing individual patient timelines. "
        "Help them interpret the clinical events, identify care gaps, and understand "
        "the OMOP domain structure for the events shown."
    ),
    "data_ingestion": (
        "You are Abby. The user is ingesting data into the OMOP CDM. "
        "Help with file upload formats (CSV, JSON), schema mapping strategies, "
        "concept mapping review, and data validation interpretation."
    ),
    "care_gaps": (
        "You are Abby. The user is working with care bundles and care gap analysis. "
        "Help them define quality measures, create care bundles, "
        "interpret population-level compliance, and design interventions."
    ),
    "dashboard": (
        "You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM "
        "research platform. The user is on the main dashboard. Help them navigate "
        "to the right module for their task, understand platform metrics, "
        "and get started with their research workflow."
    ),
    "general": (
        "You are Abby, a clinical informatics assistant for the Parthenon OMOP CDM "
        "research platform. Help the user with any question about OMOP, cohort design, "
        "data quality, clinical analytics, or the Parthenon application."
    ),
}


# ── Help content knowledge base ──────────────────────────────────────────────

# Map page context → help JSON keys to inject as knowledge
CONTEXT_HELP_KEYS: dict[str, list[str]] = {
    "cohort_builder": ["cohort-builder", "cohort-builder.primary-criteria", "cohort-builder.inclusion-rules", "cohort-builder.cohort-exit"],
    "cohort_list": ["cohort-builder"],
    "concept_set_editor": ["concept-set-builder"],
    "concept_set_list": ["concept-set-builder"],
    "vocabulary": ["vocabulary-search"],
    "data_explorer": ["data-explorer", "data-explorer.dqd", "data-explorer.heel"],
    "data_sources": ["data-sources"],
    "data_quality": ["data-explorer.dqd", "data-explorer.heel"],
    "analyses": ["analyses"],
    "incidence_rates": ["incidence-rates"],
    "estimation": ["estimation"],
    "prediction": ["prediction"],
    "genomics": ["genomics"],
    "imaging": ["imaging"],
    "heor": ["heor"],
    "studies": ["studies"],
    "administration": ["admin", "admin.users", "admin.roles", "admin.auth-providers"],
    "patient_profiles": ["patient-timeline"],
    "data_ingestion": ["data-ingestion"],
    "care_gaps": ["care-gaps"],
    "dashboard": ["dashboard"],
}

HELP_CONTENT: dict[str, dict[str, Any]] = {}


def _load_help_files() -> None:
    """Load help JSON files from the backend resources directory."""
    help_dir = Path(os.environ.get("HELP_DIR", "/var/www/html/resources/help"))
    if not help_dir.exists():
        # Try relative path for local development
        alt_dir = Path(__file__).parent.parent.parent.parent / "backend" / "resources" / "help"
        if alt_dir.exists():
            help_dir = alt_dir
        else:
            logger.warning("Help directory not found: %s", help_dir)
            return

    for f in help_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            key = data.get("key", f.stem)
            HELP_CONTENT[key] = data
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load help file %s: %s", f, e)

    logger.info("Loaded %d help files for Abby", len(HELP_CONTENT))


# Load at module import time
_load_help_files()


def _get_help_context(page_context: str) -> str:
    """Build a help knowledge section for the given page context."""
    keys = CONTEXT_HELP_KEYS.get(page_context, [])
    if not keys:
        return ""

    sections = []
    for key in keys:
        data = HELP_CONTENT.get(key)
        if not data:
            continue
        title = data.get("title", key)
        desc = data.get("description", "")
        tips = data.get("tips", [])
        tip_text = "\n".join(f"  - {t}" for t in tips[:5]) if tips else ""
        section = f"### {title}\n{desc}"
        if tip_text:
            section += f"\nKey tips:\n{tip_text}"
        sections.append(section)

    if not sections:
        return ""

    return "\n\nFEATURE DOCUMENTATION:\n" + "\n\n".join(sections)


async def call_ollama(system_prompt: str, user_message: str,
                      history: list[ChatMessage] | None = None,
                      temperature: float = 0.1) -> str:
    """Call Ollama with the configured MedGemma model."""
    messages = [{"role": "system", "content": system_prompt}]

    if history:
        for msg in history[-10:]:  # cap at last 10 turns
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_message})

    # Retry with shorter per-attempt timeout — catches intermittent GPU stalls
    # without making the user wait the full 120s.
    attempt_timeout = 30
    max_retries = 2

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=attempt_timeout) as client:
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
            if attempt < max_retries:
                logger.warning("Ollama attempt %d/%d timed out, retrying...", attempt + 1, max_retries + 1)
                continue
            raise HTTPException(status_code=504, detail="LLM service timed out after retries.")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 500 and attempt < max_retries:
                logger.warning("Ollama returned 500 on attempt %d, retrying...", attempt + 1)
                continue
            raise HTTPException(status_code=503, detail=f"LLM service error: {e}")
        except Exception as e:
            logger.error("Ollama call failed: %s", e)
            raise HTTPException(status_code=503, detail=f"LLM service unavailable: {e}")

    raise HTTPException(status_code=503, detail="LLM service unavailable: all retries exhausted")


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


def _build_chat_system_prompt(request: ChatRequest) -> str:
    """Build the system prompt for a chat request.

    Four context enrichment steps (each only injected when relevant):
      1. Help knowledge — static help docs for the current page context
      2. RAG retrieval — ChromaDB semantic search across knowledge base
      3. Live database — real-time query of Parthenon's concept sets, cohorts, analyses
      4. Page data — entity-specific data passed from the frontend
    """
    system_prompt = PAGE_SYSTEM_PROMPTS.get(
        request.page_context, PAGE_SYSTEM_PROMPTS["general"]
    )

    # ── Step 1: Help knowledge (static, page-specific) ──────────────────────
    help_context = _get_help_context(request.page_context)
    if help_context:
        system_prompt += help_context

    # ── Step 2: RAG retrieval (ChromaDB semantic search) ─────────────────────
    rag_context = ""
    try:
        rag_context = build_rag_context(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
        if rag_context:
            system_prompt += rag_context
    except Exception as e:
        logger.warning("RAG context retrieval failed: %s", e)

    # ── Step 3: Live database context (only when query needs it) ─────────────
    live_context = ""
    try:
        from app.chroma.live_context import query_live_context
        live_context = query_live_context(request.message, request.page_context)
        if live_context:
            system_prompt += live_context
    except Exception as e:
        logger.warning("Live database context failed: %s", e)

    # ── Step 4: Page data (entity-specific frontend context) ─────────────────
    if request.user_profile and request.user_profile.name:
        role_str = ", ".join(request.user_profile.roles) if request.user_profile.roles else "researcher"
        system_prompt += (
            f"\n\nYou are assisting {request.user_profile.name}, "
            f"who has roles: {role_str}."
        )

    # User research profile context (from memory learning)
    if request.user_profile and request.user_profile.research_profile:
        rp = request.user_profile.research_profile
        profile = MemoryUserProfile.from_dict(rp.model_dump())
        profile_context = profile.get_context_string()
        if profile_context:
            system_prompt += f"\n\nUSER RESEARCH PROFILE: {profile_context}"

    if request.page_data:
        context_lines = []
        for key, val in request.page_data.items():
            if isinstance(val, (str, int, float, bool)):
                context_lines.append(f"  {key}: {val}")
            elif isinstance(val, list) and len(val) <= 5:
                context_lines.append(f"  {key}: {', '.join(str(v) for v in val)}")
        if context_lines:
            system_prompt += "\n\nCURRENT PAGE CONTEXT:\n" + "\n".join(context_lines)

    # ── Grounding rules ──────────────────────────────────────────────────────
    has_context = bool(rag_context or live_context)
    if has_context:
        system_prompt += (
            "\n\nGROUNDING RULES:"
            "\n- Base your answer PRIMARILY on the KNOWLEDGE BASE and LIVE PLATFORM DATA provided above."
            "\n- When citing specific concept sets, cohort definitions, or analyses, use ONLY the data from LIVE PLATFORM DATA. These are real entities in the user's Parthenon instance."
            "\n- When citing studies, papers, or researchers, use ONLY information from the KNOWLEDGE BASE. Do NOT invent paper titles, author names, or study details."
            "\n- If the provided context does not contain enough information, say so explicitly."
            "\n- You MAY use your general medical training knowledge for explanations, definitions, and context — but NEVER fabricate specific claims."
        )
    else:
        system_prompt += (
            "\n\nNOTE: No relevant documents or platform data were found for this query. "
            "Answer using your general knowledge but be transparent about limitations. "
            "Do NOT fabricate specific paper titles, researcher names, concept sets, or study details."
        )

    system_prompt += (
        "\n\nRESPONSE FORMAT:"
        "\n- Keep replies concise (under 300 words)."
        "\n- Use markdown formatting for headers, lists, and code blocks."
        "\n- End your reply with 1–3 brief follow-up suggestions the user might want "
        'to ask, formatted as a JSON array on the last line: SUGGESTIONS: ["...", "..."]'
    )

    return system_prompt


def _strip_thinking_tokens(text: str) -> str:
    """Strip MedGemma's internal thinking/reasoning tokens from output.

    MedGemma uses <unused94>thought...content<unused95> for chain-of-thought.
    These tokens should never reach the user.
    """
    import re
    # Remove <unused94>thought....<unused95> blocks (thinking tokens)
    text = re.sub(r"<unused94>.*?<unused95>", "", text, flags=re.DOTALL)
    # Remove orphaned thinking markers
    text = re.sub(r"<unused\d+>", "", text)
    return text.strip()


def _extract_suggestions(raw: str) -> tuple[str, list[str]]:
    """Extract suggestion chips from the LLM reply and clean output."""
    suggestions: list[str] = []
    reply = _strip_thinking_tokens(raw.strip())

    if "SUGGESTIONS:" in reply:
        parts = reply.rsplit("SUGGESTIONS:", 1)
        reply = parts[0].strip()
        try:
            suggestions = json.loads(parts[1].strip())
            if not isinstance(suggestions, list):
                suggestions = []
        except (json.JSONDecodeError, IndexError):
            suggestions = []

    return reply, suggestions[:3]


def _fetch_user_profile(user_id: int) -> dict | None:
    """Fetch user's research profile from PostgreSQL."""
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT research_interests, expertise_domains,
                           interaction_preferences, frequently_used
                    FROM app.abby_user_profiles WHERE user_id = :uid
                """),
                {"uid": user_id},
            ).fetchone()
            if row:
                return {
                    "research_interests": row[0] or [],
                    "expertise_domains": row[1] or {},
                    "interaction_preferences": row[2] or {},
                    "frequently_used": row[3] or {},
                }
    except Exception:
        logger.exception("Failed to fetch user profile")
    return None


def _save_user_profile(user_id: int, profile_data: dict) -> None:
    """Upsert user's research profile to PostgreSQL."""
    try:
        import json as json_mod
        from sqlalchemy import create_engine, text
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO app.abby_user_profiles (user_id, research_interests,
                        expertise_domains, interaction_preferences, frequently_used, updated_at)
                    VALUES (:uid, :interests::text[], :expertise::jsonb,
                            :prefs::jsonb, :freq::jsonb, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        research_interests = EXCLUDED.research_interests,
                        expertise_domains = EXCLUDED.expertise_domains,
                        interaction_preferences = EXCLUDED.interaction_preferences,
                        frequently_used = EXCLUDED.frequently_used,
                        updated_at = NOW()
                """),
                {
                    "uid": user_id,
                    "interests": profile_data.get("research_interests", []),
                    "expertise": json_mod.dumps(profile_data.get("expertise_domains", {})),
                    "prefs": json_mod.dumps(profile_data.get("interaction_preferences", {})),
                    "freq": json_mod.dumps(profile_data.get("frequently_used", {})),
                },
            )
            conn.commit()
    except Exception:
        logger.exception("Failed to save user profile")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Page-aware conversational endpoint. Abby adapts her persona and focus
    based on the current UI page and any entity data passed from the frontend.

    Phase 2: Routes to Claude (cloud) or MedGemma (local) based on message
    complexity, budget status, and PHI safety checks.
    """
    system_prompt = _build_chat_system_prompt(request)

    # Working memory: track intent and update turn counter
    session = _get_session(request.conversation_id)
    session["turn"] += 1
    turn = session["turn"]
    session["intent_stack"].prune(current_turn=turn)

    # Extract topic using domain keywords
    from app.memory.profile_learner import DOMAIN_KEYWORDS
    msg_lower = request.message.lower()
    detected_topics = [domain for domain, keywords in DOMAIN_KEYWORDS.items()
                       if any(kw in msg_lower for kw in keywords)]
    topic = detected_topics[0] if detected_topics else request.message[:80]
    session["intent_stack"].push(topic, turn=turn)

    # Phase 2: Route to appropriate model
    cost_tracker = _get_cost_tracker()
    budget_exhausted = cost_tracker.is_budget_exhausted()
    routing = _router.route(request.message, budget_exhausted=budget_exhausted)

    reply = ""
    suggestions: list[str] = []

    if routing.model == "claude" and _get_claude_client() is None:
        # Claude requested but no API key configured — fall back to local silently
        logger.debug("Claude routed but no client available, falling back to local")
        routing = RoutingDecision(model="local", stage=0, reason="claude_unavailable", confidence=1.0)

    if routing.model == "claude" and _get_claude_client() is not None:
        # Cloud path: PHI sanitization + cloud safety filter
        phi_result = _phi_sanitizer.scan(system_prompt)

        if phi_result.phi_detected and settings.phi_block_on_detection:
            logger.warning(
                "PHI detected in cloud-bound prompt, falling back to local. "
                "Redactions: %d", phi_result.redaction_count,
            )
            routing = RoutingDecision(model="local", stage=0, reason="phi_blocked", confidence=1.0)
        else:
            # Safe to send to Claude
            claude_client = _get_claude_client()
            history_dicts = [{"role": m.role, "content": m.content} for m in request.history]
            try:
                claude_response = claude_client.chat(
                    system_prompt=phi_result.redacted_text,
                    message=request.message,
                    history=history_dicts,
                )
                reply = claude_response.reply

                # Record usage
                cost_tracker.record_usage(
                    user_id=request.user_id,
                    tokens_in=claude_response.tokens_in,
                    tokens_out=claude_response.tokens_out,
                    cost_usd=claude_response.cost_usd,
                    model=claude_response.model,
                    request_hash=claude_response.request_hash,
                    redaction_count=phi_result.redaction_count,
                    route_reason=routing.reason,
                )
                reply, suggestions = _extract_suggestions(reply)
            except Exception:
                logger.exception("Claude API call failed, falling back to local")
                routing = RoutingDecision(model="local", stage=0, reason="claude_error", confidence=1.0)

    if routing.model == "local":
        # Local path: MedGemma via Ollama (existing behavior)
        raw = await call_ollama(
            system_prompt=system_prompt,
            user_message=request.message,
            history=request.history,
            temperature=0.15,
        )
        reply, suggestions = _extract_suggestions(raw)

    # Store conversation in memory (fire-and-forget, don't block response)
    if request.user_id is not None:
        try:
            store_conversation_turn(
                user_id=request.user_id,
                question=request.message,
                answer=reply,
                page_context=request.page_context,
            )
        except Exception as e:
            logger.warning("Failed to store conversation memory: %s", e)

    # Learn from this conversation turn (non-blocking)
    if request.user_id is not None:
        try:
            learner = ProfileLearner()
            profile_data = _fetch_user_profile(request.user_id)
            profile = MemoryUserProfile.from_dict(profile_data) if profile_data else MemoryUserProfile()
            messages_for_learning = [
                {"role": "user", "content": request.message},
                {"role": "assistant", "content": reply},
            ]
            updated_profile = learner.learn_from_conversation(profile, messages_for_learning)
            _save_user_profile(request.user_id, updated_profile.to_dict())
        except Exception:
            logger.exception("Profile learning failed (non-blocking)")

    # Confidence indicator
    confidence = "medium"
    if routing.model == "claude":
        confidence = "high"
    elif routing.reason == "budget_exhausted":
        confidence = "low"
        reply = (
            "*Note: This response was generated locally due to usage limits. "
            "For a more thorough analysis, try again later.*\n\n" + reply
        )

    return ChatResponse(
        reply=reply,
        suggestions=suggestions,
        routing={
            "model": routing.model,
            "reason": routing.reason,
            "stage": routing.stage,
        },
        confidence=confidence,
        sources=[],  # Will be populated when context assembler is fully integrated
    )


async def _stream_ollama(system_prompt: str, user_message: str,
                         history: list[ChatMessage] | None = None,
                         temperature: float = 0.3) -> AsyncGenerator[str, None]:
    """Stream tokens from Ollama as SSE events."""
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        for msg in history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            async with client.stream(
                "POST",
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "messages": messages,
                    "stream": True,
                    "options": {"temperature": temperature},
                },
            ) as resp:
                resp.raise_for_status()
                full_content = ""
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        if data.get("done"):
                            break
                        token = data.get("message", {}).get("content", "")
                        if token:
                            full_content += token
                            yield f"data: {json.dumps({'token': token})}\n\n"
                    except json.JSONDecodeError:
                        continue

                # Extract suggestions from complete response
                _, suggestions = _extract_suggestions(full_content)
                if suggestions:
                    yield f"data: {json.dumps({'suggestions': suggestions})}\n\n"
                yield "data: [DONE]\n\n"
    except httpx.TimeoutException:
        yield f"data: {json.dumps({'error': 'LLM service timed out.'})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error("Ollama streaming failed: %s", e)
        yield f"data: {json.dumps({'error': f'LLM service unavailable: {e}'})}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """
    SSE streaming version of the chat endpoint. Returns token-by-token
    responses as Server-Sent Events for real-time display in the UI.
    """
    system_prompt = _build_chat_system_prompt(request)

    return StreamingResponse(
        _stream_ollama(
            system_prompt=system_prompt,
            user_message=request.message,
            history=request.history,
            temperature=0.3,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
