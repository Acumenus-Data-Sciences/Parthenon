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
import re
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncGenerator, Callable, cast

if TYPE_CHECKING:
    from anthropic.types import MessageParam

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

from app.chroma.memory import store_conversation_turn
from app.chroma.retrieval import (
    build_rag_context,
    get_ranked_rag_results,
    query_docs,
    query_user_conversations,
)
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

from app.agency.plan_engine import PlanEngine, PlanStep, ActionPlan
from app.agency.api_client import AgencyApiClient
from app.agency.action_logger import ActionLogger
from app.agency.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Agency plan engine (lazy-init) ───────────────────────────────────────────

_plan_engine: PlanEngine | None = None


def _get_plan_engine() -> PlanEngine:
    global _plan_engine
    if _plan_engine is None:
        from sqlalchemy import create_engine
        engine = create_engine(settings.database_url)
        _plan_engine = PlanEngine(
            action_logger=ActionLogger(engine=engine),
            api_client=AgencyApiClient(),
            db_engine=engine,
        )
    return _plan_engine


# ── Session-scoped working memory (in-memory, cleared on service restart) ────

_session_state: dict[int, dict] = {}
_SESSION_MAX_SIZE = 1000

# ── Phase 2: Routing components ──────────────────────────────────────────────

_router = RuleRouter()
_phi_sanitizer = PHISanitizer(use_ner=True)
_cloud_safety = CloudSafetyFilter()
_claude_client: ClaudeClient | None = None
_cost_tracker: CostTracker | None = None
_shared_engine: Any | None = None
_shared_redis: Any | None = None
_dq_profile_service: Any | None = None
_knowledge_surfacer: Any | None = None
_ollama_http_client: httpx.AsyncClient | None = None


def _get_claude_client() -> ClaudeClient | None:
    global _claude_client
    if _claude_client is None and settings.claude_api_key:
        try:
            _claude_client = ClaudeClient(api_key=settings.claude_api_key)
        except (ValueError, RuntimeError):
            logger.warning("Claude API unavailable (anthropic package not installed or key missing), cloud routing disabled")
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


def _get_shared_engine() -> Any:
    global _shared_engine
    if _shared_engine is None:
        from sqlalchemy import create_engine
        _shared_engine = create_engine(settings.database_url, pool_pre_ping=True)
    return _shared_engine


def _get_shared_redis() -> Any:
    global _shared_redis
    if _shared_redis is None:
        try:
            import redis as redis_lib
            _shared_redis = redis_lib.from_url(settings.redis_url)
        except Exception:
            _shared_redis = False
    return None if _shared_redis is False else _shared_redis


def _get_data_profile_service() -> Any:
    global _dq_profile_service
    if _dq_profile_service is None:
        from app.knowledge.data_profile import DataProfileService
        _dq_profile_service = DataProfileService(
            engine=_get_shared_engine(),
            redis_client=_get_shared_redis(),
            cdm_schema=settings.knowledge_cdm_schema,
        )
    return _dq_profile_service


def _get_knowledge_surfacer() -> Any:
    global _knowledge_surfacer
    if _knowledge_surfacer is None:
        from app.institutional.knowledge_capture import KnowledgeCapture
        from app.institutional.knowledge_surfacing import KnowledgeSurfacer

        try:
            from app.chroma.embeddings import get_general_embedder
            embedder = get_general_embedder()
        except Exception:
            logger.debug("Institutional knowledge embedder unavailable; skipping surfacing")
            _knowledge_surfacer = False
            return None

        _knowledge_surfacer = KnowledgeSurfacer(
            knowledge_capture=KnowledgeCapture(engine=_get_shared_engine(), embedder=embedder)
        )
    return None if _knowledge_surfacer is False else _knowledge_surfacer


def _get_ollama_http_client() -> httpx.AsyncClient:
    global _ollama_http_client
    if _ollama_http_client is None:
        _ollama_http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.ollama_timeout),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            trust_env=False,
        )
    return _ollama_http_client


def _ns_to_ms(value: Any) -> float | None:
    if not isinstance(value, (int, float)):
        return None
    return round(float(value) / 1_000_000, 1)


def _log_latency(event: str, **fields: Any) -> None:
    parts = [event]
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, float):
            parts.append(f"{key}={value:.1f}")
        else:
            parts.append(f"{key}={value}")
    message = " ".join(parts)
    logger.info(message)
    if logger.name != "uvicorn.error":
        logging.getLogger("uvicorn.error").info(message)


def _get_session(conversation_id: int | None) -> dict:
    """Get or create session state for a conversation."""
    if conversation_id is None:
        return {"intent_stack": IntentStack(), "scratch_pad": ScratchPad(), "turn": 0}
    if conversation_id not in _session_state:
        # Evict oldest entry if at capacity
        if len(_session_state) >= _SESSION_MAX_SIZE:
            oldest_key = next(iter(_session_state))
            del _session_state[oldest_key]
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
    research_interests: list[str] | None = []
    expertise_domains: dict[str, float] | None = {}
    interaction_preferences: dict | None = {}
    frequently_used: dict | None = {}
    interaction_count: int | None = 0

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def coerce_nulls(cls, data: Any) -> Any:
        """Coerce None/empty-list to correct empty defaults.

        PHP serialises empty arrays as [] regardless of whether the column
        is a list or a JSON object, so dict fields may arrive as [].
        """
        if isinstance(data, dict):
            dict_fields = {"expertise_domains", "interaction_preferences", "frequently_used"}
            result: dict[str, object] = {}
            for k, v in data.items():
                if v is None:
                    result[k] = [] if k == "research_interests" else ({} if k in dict_fields else 0)
                elif k in dict_fields and isinstance(v, list):
                    result[k] = {}  # [] → {}
                else:
                    result[k] = v
            return result
        return data


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

# ── Shared capability preamble ──────────────────────────────────────────────
# Prepended to every page-specific prompt so Abby knows what she can do.

CAPABILITY_PREAMBLE = (
    "You have PostgreSQL database access to the Parthenon OMOP CDM v5.4 database "
    "as the abby_analyst role. Your access has two tiers:\n\n"
    "1. READ-ONLY access to clinical and vocabulary schemas: vocab (7M+ OMOP concepts), "
    "omop (Acumenus CDM, ~1M patients), pancreas (361-patient pancreatic cancer corpus), "
    "irsf (IRSF Natural History Study), mimiciv (MIMIC-IV ICU data), "
    "atlantic_health (Atlantic Health CDM), "
    "results/pancreas_results/irsf_results (Achilles characterization output).\n\n"
    "2. READ-WRITE access to the temp_abby scratch schema. You can CREATE tables, "
    "INSERT data, and DROP tables in temp_abby for intermediate computations, "
    "staging analytics results, or building summary tables. This is YOUR workspace.\n\n"
    "When the user asks data questions — patient counts, top conditions, lab distributions, "
    "drug frequencies, cohort sizes — you have live context tools that automatically "
    "query the database on your behalf. You can and should give specific numbers, "
    "not generic explanations.\n\n"
    "For complex analytical questions that require multiple query steps, custom joins, "
    "or intermediate result staging, you can use the Data Interrogation feature which "
    "lets you execute SQL queries directly. Use temp_abby to store intermediate results "
    "when building multi-step analyses.\n\n"
    "When a user asks 'how many patients have X' or 'what are the top Y', answer with "
    "actual data from the CDM. If the live context doesn't cover their question, suggest "
    "they switch to the Data Interrogation mode (Ask Data button) where you can run "
    "custom SQL queries for them.\n\n"
)

COMPACT_CAPABILITY_PREAMBLE = (
    "You are Abby for the Parthenon OMOP CDM platform. "
    "You can use live platform data, documentation, and institutional memory when they are provided. "
    "The clinical data schemas are read-only and `temp_abby` is your scratch workspace for multi-step analysis. "
    "When live context includes counts or entities, answer with those concrete values. "
    "If the supplied context is insufficient for a database question, suggest Data Interrogation for custom SQL.\n\n"
)

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
                      temperature: float = 0.1,
                      num_predict: int | None = None) -> str:
    """Call Ollama with the configured MedGemma model."""
    started = time.perf_counter()
    messages = [{"role": "system", "content": system_prompt}]

    if history:
        for msg in history[-10:]:  # cap at last 10 turns
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_message})

    # First attempt uses a longer timeout to accommodate cold model loads or
    # model swapping (e.g. evicting a large model like gemma3:27b takes >90s).
    # Subsequent retries use a shorter timeout since the model should be warm.
    max_retries = 2
    client = _get_ollama_http_client()

    for attempt in range(max_retries + 1):
        attempt_timeout = 180 if attempt == 0 else 60
        attempt_started = time.perf_counter()
        try:
            resp = await client.post(
                f"{settings.abby_llm_base_url}/api/chat",
                json={
                    "model": settings.abby_llm_model,
                    "messages": messages,
                    "stream": False,
                    "think": False,
                    "keep_alive": settings.abby_ollama_keep_alive,
                    "options": {
                        "temperature": temperature,
                        "num_predict": num_predict if num_predict is not None else settings.ollama_num_predict,
                    },
                },
                timeout=attempt_timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            total_ms = (time.perf_counter() - started) * 1000
            attempt_ms = (time.perf_counter() - attempt_started) * 1000
            _log_latency(
                "abby_ollama_call",
                model=settings.abby_llm_model,
                base_url=settings.abby_llm_base_url,
                attempts=attempt + 1,
                total_ms=total_ms,
                attempt_ms=attempt_ms,
                prompt_chars=len(system_prompt),
                prompt_tokens_est=_estimate_tokens(system_prompt),
                message_chars=len(user_message),
                num_predict=num_predict if num_predict is not None else settings.ollama_num_predict,
                history_turns=len(history[-10:]) if history else 0,
                response_chars=len(data.get("message", {}).get("content", "")),
                load_ms=_ns_to_ms(data.get("load_duration")),
                prompt_eval_ms=_ns_to_ms(data.get("prompt_eval_duration")),
                eval_ms=_ns_to_ms(data.get("eval_duration")),
                ollama_total_ms=_ns_to_ms(data.get("total_duration")),
                prompt_eval_count=data.get("prompt_eval_count"),
                eval_count=data.get("eval_count"),
            )
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
        num_predict=max(settings.ollama_num_predict, 320),
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


_DATA_QUALITY_PATTERN = re.compile(
    r"\b(data\s*quality|dqd|quality\s*check|coverage|sparse|gap|temporal|conformance|completeness|plausibility)\b",
    re.I,
)
_INSTITUTIONAL_PATTERN = re.compile(
    r"\b(previous|past|recent|review|decision|worked|learned|institutional|history|memory|similar)\b",
    re.I,
)
_DEFINITION_QUERY_PATTERN = re.compile(
    r"^\s*(what\s+is|who\s+is|define|explain)\b",
    re.I,
)


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _build_response_format_rules(compact: bool) -> str:
    if compact:
        return (
            "\n\nRESPONSE FORMAT:"
            "\n- Keep replies concise."
            "\n- Use markdown when helpful."
            '\n- End with: SUGGESTIONS: ["...", "..."]'
        )

    return (
        "\n\nRESPONSE FORMAT:"
        "\n- Keep replies concise (under 300 words)."
        "\n- Use markdown formatting for headers, lists, and code blocks."
        "\n- End your reply with 1–3 next-step action prompts the user could send you"
        " to make progress toward their goal within Parthenon."
        " These are things the USER would TYPE TO YOU — short imperative commands or"
        " specific questions directed at you, NOT questions you are asking the user."
        " Good examples: \"Build the cohort definition for this study\","
        " \"Show me available heart failure concept sets\","
        " \"Analyze 30-day readmission rates for this cohort\"."
        " Bad examples: \"Would you like to explore cohort design?\","
        " \"Are you interested in specific medications?\" (those are you asking the user)."
        '\n- Format as a JSON array on the last line: SUGGESTIONS: ["...", "...", "..."]'
    )


def _get_local_num_predict(page_context: str) -> int:
    default = settings.ollama_num_predict
    compact_context_cap = {
        "general": 160,
        "dashboard": 160,
        "commons_ask_abby": 192,
        "data_quality": 192,
        "data_explorer": 192,
        "vocabulary": 192,
        "cohort_list": 192,
        "concept_set_list": 192,
        "administration": 192,
    }.get(page_context)
    resolved = default if compact_context_cap is None else min(default, compact_context_cap)

    # Qwen-family reasoning models often spend a large prefix budget inside
    # <think> blocks before producing the visible answer. If we keep the compact
    # Abby caps, the model can exhaust its token budget before it ever emits the
    # final answer. Give these models a larger floor so the user actually gets
    # a response.
    reasoning_model_markers = ("qwen", "qwq", "deepseek-r1", "ii-medical")
    if any(marker in settings.abby_llm_model.lower() for marker in reasoning_model_markers):
        return max(resolved, 640)

    return resolved


def _should_include_data_quality_context(request: ChatRequest) -> bool:
    if request.page_context in {"data_quality", "data_explorer", "administration"}:
        return True
    return bool(_DATA_QUALITY_PATTERN.search(request.message))


def _should_include_institutional_context(request: ChatRequest) -> bool:
    if request.page_context in {"commons_ask_abby", "studies", "analyses"}:
        return True
    return bool(_INSTITUTIONAL_PATTERN.search(request.message))


def _should_skip_live_context(request: ChatRequest, rag_context: str) -> bool:
    """Avoid database/tool noise for definition questions already grounded in docs."""
    return bool(rag_context) and bool(_DEFINITION_QUERY_PATTERN.search(request.message))


def _clean_grounded_text(text: str) -> str:
    """Flatten markdown-ish retrieved chunks into plain text sentences."""
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"^#.*$", " ", text, flags=re.MULTILINE)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*]\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"=+", " ", text)
    text = re.sub(r"[*_]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _definition_query_terms(message: str) -> list[str]:
    """Extract salient terms for simple grounded sentence selection."""
    return [
        token
        for token in re.findall(r"[a-z0-9]+", message.lower())
        if len(token) > 1 and token not in {
            "what", "who", "is", "the", "a", "an", "define", "explain", "does",
        }
    ]


def _is_reference_only_grounded_sentence(sentence: str) -> bool:
    lowered = sentence.lower()
    if "http://" in lowered or "https://" in lowered:
        return True
    if "docs/" in lowered or ".md" in lowered:
        return True
    return lowered.startswith(("source urls", "related local references"))


def _result_has_viable_grounded_sentence(result: dict[str, object], terms: list[str]) -> bool:
    """Check whether a retrieved chunk contains at least one usable definition sentence."""
    text = _clean_grounded_text(str(result.get("text", "")))
    if not text:
        return False

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence.strip()
    ]
    for sentence in sentences[:6]:
        if _is_reference_only_grounded_sentence(sentence):
            continue
        sentence_lower = sentence.lower()
        if "seed note exists" in sentence_lower:
            continue
        if any(term in sentence_lower for term in terms):
            return True
    return False


def _build_chat_sources(
    results: list[dict[str, object]],
    *,
    min_score: float = 0.55,
    limit: int = 3,
) -> list[dict[str, object]]:
    """Convert ranked retrieval results into compact API-facing source metadata."""
    sources: list[dict[str, object]] = []
    seen: set[tuple[str, str, str]] = set()

    for result in results:
        score = float(str(result.get("score", 0) or 0))
        if score < min_score:
            continue

        source_tag = str(result.get("source_tag", "") or "").strip()
        source_label = str(result.get("source_label", "") or source_tag).strip()
        title = _clean_grounded_text(str(result.get("title", "") or ""))
        source_file = str(result.get("source_file", "") or "").strip()
        key = (source_tag, title, source_file)
        if key in seen:
            continue
        seen.add(key)

        source: dict[str, object] = {
            "collection": source_tag,
            "label": source_label,
            "score": round(score, 3),
        }
        if title:
            source["title"] = title
        if source_file:
            source["source_file"] = source_file
        section = _clean_grounded_text(str(result.get("section", "") or ""))
        if section and section != title:
            source["section"] = section
        url = str(result.get("url", "") or "").strip()
        if url:
            source["url"] = url
        sources.append(source)
        if len(sources) >= limit:
            break

    return sources


def _try_grounded_definition_answer(request: ChatRequest) -> tuple[str, list[dict[str, object]]]:
    """Answer short definition questions directly from retrieved context."""
    if request.page_context != "commons_ask_abby" and request.page_context not in {
        "cohort_builder", "vocabulary", "data_explorer", "data_quality",
        "analyses", "incidence_rates", "estimation", "prediction",
        "genomics", "imaging", "patient_profiles", "care_gaps",
    }:
        return "", []

    if not _DEFINITION_QUERY_PATTERN.search(request.message):
        return "", []

    docs_results = query_docs(request.message, top_k=5, threshold=0.9)
    if docs_results and float(str(docs_results[0].get("score", 0) or 0)) >= 0.8:
        results = docs_results
    else:
        results = get_ranked_rag_results(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
    if not results:
        return "", []

    top_result = results[0]
    top_score = float(str(top_result.get("score", 0) or 0))
    if top_score < 0.55:
        return "", []

    terms = _definition_query_terms(request.message)
    candidate_results = [
        result
        for result in results[:5]
        if _result_has_viable_grounded_sentence(result, terms)
    ] or results[:5]
    candidates: list[tuple[float, str, dict[str, object]]] = []
    for idx, result in enumerate(candidate_results):
        text = _clean_grounded_text(str(result.get("text", "")))
        if not text:
            continue
        title_text = _clean_grounded_text(str(result.get("title", ""))).lower()
        source_text = _clean_grounded_text(str(result.get("source_file", ""))).lower()
        title_overlap = sum(1 for term in terms if term in title_text)
        source_overlap = sum(1 for term in terms if term in source_text)
        sentences = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", text)
            if sentence.strip()
        ]
        for sentence in sentences[:6]:
            sentence_lower = sentence.lower()
            if "seed note exists" in sentence_lower:
                continue
            if _is_reference_only_grounded_sentence(sentence):
                continue
            overlap = sum(1 for term in terms if term in sentence_lower)
            if overlap == 0:
                continue
            definitional_bonus = 0.75 if any(
                phrase in sentence_lower for phrase in (" stands for ", " is ", " are ", " refers to ")
            ) else 0.0
            score = (
                overlap
                + (title_overlap * 2.0)
                + (source_overlap * 2.0)
                + definitional_bonus
                + (0.5 if idx == 0 else 0.0)
            )
            candidates.append((score, sentence, result))

    if not candidates:
        return "", []

    candidates.sort(key=lambda item: item[0], reverse=True)
    selected: list[str] = []
    selected_results: list[dict[str, object]] = []
    seen: set[str] = set()
    for _, sentence, result in candidates:
        key = sentence.lower()
        if key in seen:
            continue
        seen.add(key)
        selected.append(sentence)
        selected_results.append(result)
        if len(selected) >= 1:
            break

    attribution_results = selected_results + [
        result for result in candidate_results
        if result not in selected_results
    ]
    return " ".join(selected).strip(), _build_chat_sources(attribution_results)


def _build_context_block(model_profile: str, pieces: list[ContextPiece]) -> tuple[str, bool]:
    if not pieces:
        return "", False

    assembler = ContextAssembler.for_model("claude" if model_profile == "claude" else "medgemma")
    selected = assembler.assemble([piece for piece in pieces if piece.content.strip()])
    if not selected:
        return "", False
    return assembler.format_prompt(selected), True


def _build_episodic_memory_context(request: ChatRequest) -> str:
    """Format long-term Abby memory retrieved from ChromaDB for prompt injection."""
    if request.user_id is None:
        return ""

    try:
        memories = query_user_conversations(
            request.message,
            request.user_id,
            top_k=3,
        )
    except Exception as e:
        logger.warning("User memory retrieval failed for user %s: %s", request.user_id, e)
        return ""

    if not memories:
        return ""

    lines = ["Relevant prior Abby conversations:"]
    seen: set[str] = set()
    for memory in memories:
        text = _clean_grounded_text(str(memory.get("text", "") or ""))
        if not text or text in seen:
            continue
        seen.add(text)

        if len(text) > 300:
            text = text[:300].rstrip() + "..."

        page_context = str(memory.get("page_context", "") or "").strip()
        prefix = "- Previous Abby exchange"
        if page_context:
            prefix += f" [{page_context}]"
        lines.append(f"{prefix}: {text}")

    return "\n".join(lines) if len(lines) > 1 else ""


def _build_chat_system_prompt(
    request: ChatRequest,
    model_profile: str = "medgemma",
    *,
    session: dict | None = None,
) -> str:
    """Build the system prompt for a chat request.

    Four context enrichment steps (each only injected when relevant):
      1. Help knowledge — static help docs for the current page context
      2. RAG retrieval — ChromaDB semantic search across knowledge base
      3. Live database — real-time query of Parthenon's concept sets, cohorts, analyses
      4. Page data — entity-specific data passed from the frontend
    """
    started = time.perf_counter()
    help_ms = 0.0
    rag_ms = 0.0
    live_ms = 0.0
    dq_ms = 0.0
    institutional_ms = 0.0

    page_prompt = PAGE_SYSTEM_PROMPTS.get(
        request.page_context, PAGE_SYSTEM_PROMPTS["general"]
    )
    compact = model_profile != "claude"
    system_prompt = (COMPACT_CAPABILITY_PREAMBLE if compact else CAPABILITY_PREAMBLE) + page_prompt
    context_pieces: list[ContextPiece] = []
    session_state = session or _get_session(request.conversation_id)

    # ── Step 0: Working + episodic memory ───────────────────────────────────
    intent_context = session_state["intent_stack"].get_context_string()
    if intent_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.WORKING,
                content=intent_context,
                relevance=0.85,
                tokens=_estimate_tokens(intent_context),
                source="intent_stack",
            )
        )

    scratch_context = session_state["scratch_pad"].get_context_string()
    if scratch_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.WORKING,
                content=scratch_context,
                relevance=0.7,
                tokens=_estimate_tokens(scratch_context),
                source="scratch_pad",
            )
        )

    episodic_context = _build_episodic_memory_context(request)
    if episodic_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.EPISODIC,
                content=episodic_context,
                relevance=0.88,
                tokens=_estimate_tokens(episodic_context),
                source="conversation_memory",
            )
        )

    # ── Step 1: Help knowledge (static, page-specific) ──────────────────────
    help_started = time.perf_counter()
    help_context = _get_help_context(request.page_context)
    help_ms = (time.perf_counter() - help_started) * 1000
    if help_context:
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.PAGE,
                content=help_context,
                relevance=0.55,
                tokens=_estimate_tokens(help_context),
                source="help",
            )
        )

    # ── Step 2: RAG retrieval (ChromaDB semantic search) ─────────────────────
    rag_context = ""
    rag_started = time.perf_counter()
    try:
        rag_context = build_rag_context(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
        if rag_context:
            context_pieces.append(
                ContextPiece(
                    tier=ContextTier.SEMANTIC,
                    content=rag_context,
                    relevance=0.9,
                    tokens=_estimate_tokens(rag_context),
                    source="rag",
                )
            )
    except Exception as e:
        logger.warning("RAG context retrieval failed: %s", e)
    finally:
        rag_ms = (time.perf_counter() - rag_started) * 1000

    # ── Step 3: Live database context (only when query needs it) ─────────────
    live_context = ""
    live_started = time.perf_counter()
    try:
        if not _should_skip_live_context(request, rag_context):
            from app.chroma.live_context import query_live_context
            live_context = query_live_context(request.message, request.page_context)
            if live_context:
                context_pieces.append(
                    ContextPiece(
                        tier=ContextTier.LIVE,
                        content=live_context,
                        relevance=0.95,
                        tokens=_estimate_tokens(live_context),
                        source="live_context",
                    )
                )
    except Exception as e:
        logger.warning("Live database context failed: %s", e)
    finally:
        live_ms = (time.perf_counter() - live_started) * 1000

    # ── Step 4: Page data (entity-specific frontend context) ─────────────────
    if request.user_profile and request.user_profile.name:
        role_str = ", ".join(request.user_profile.roles) if request.user_profile.roles else "researcher"
        user_context = (
            f"\n\nYou are assisting {request.user_profile.name}, "
            f"who has roles: {role_str}."
        )
        context_pieces.append(
            ContextPiece(
                tier=ContextTier.WORKING,
                content=user_context,
                relevance=0.45,
                tokens=_estimate_tokens(user_context),
                source="user_profile",
            )
        )

    # User research profile context (from memory learning)
    if request.user_profile and request.user_profile.research_profile:
        rp = request.user_profile.research_profile
        profile = MemoryUserProfile.from_dict(rp.model_dump())
        profile_context = profile.get_context_string()
        if profile_context:
            profile_text = f"USER RESEARCH PROFILE: {profile_context}"
            context_pieces.append(
                ContextPiece(
                    tier=ContextTier.WORKING,
                    content=profile_text,
                    relevance=0.5,
                    tokens=_estimate_tokens(profile_text),
                    source="learned_profile",
                )
            )

    if request.page_data:
        context_lines = []
        for key, val in request.page_data.items():
            if isinstance(val, (str, int, float, bool)):
                context_lines.append(f"  {key}: {val}")
            elif isinstance(val, list) and len(val) <= 5:
                context_lines.append(f"  {key}: {', '.join(str(v) for v in val)}")
        if context_lines:
            page_context_block = "CURRENT PAGE CONTEXT:\n" + "\n".join(context_lines)
            context_pieces.append(
                ContextPiece(
                    tier=ContextTier.PAGE,
                    content=page_context_block,
                    relevance=0.8,
                    tokens=_estimate_tokens(page_context_block),
                    source="page_data",
                )
            )

    # ── Step 5: Data quality warnings (safety-critical, always when relevant) ──
    if _should_include_data_quality_context(request):
        dq_started = time.perf_counter()
        try:
            profile_service = _get_data_profile_service()
            person_count = profile_service.get_person_count()
            domain_density = profile_service.get_domain_density()
            temporal_coverage = profile_service.get_temporal_coverage()
            warnings = profile_service.detect_data_gaps(
                person_count=person_count,
                domain_density=domain_density,
                temporal_coverage=temporal_coverage,
            )

            relevant_warnings = []
            msg_lower = request.message.lower()
            for w in warnings:
                if w.severity == "critical":
                    relevant_warnings.append(w)
                elif w.domain.lower() in msg_lower or w.domain == "all":
                    relevant_warnings.append(w)

            if relevant_warnings:
                warning_text = profile_service.format_warnings(relevant_warnings)
                context_pieces.append(
                    ContextPiece(
                        tier=ContextTier.LIVE,
                        content=warning_text,
                        relevance=1.0,
                        tokens=_estimate_tokens(warning_text),
                        source="data_quality",
                        is_safety_critical=True,
                    )
                )
        except Exception as e:
            logger.warning("Data quality warning injection failed: %s", e)
        finally:
            dq_ms = (time.perf_counter() - dq_started) * 1000

    # ── Step 6: Institutional knowledge surfacing ─────────────────────────
    if _should_include_institutional_context(request):
        institutional_started = time.perf_counter()
        try:
            surfacer = _get_knowledge_surfacer()
            if surfacer is not None:
                suggestions = surfacer.suggest(request.message)
                if suggestions:
                    institutional_text = surfacer.format_for_prompt(suggestions)
                    context_pieces.append(
                        ContextPiece(
                            tier=ContextTier.INSTITUTIONAL,
                            content=institutional_text,
                            relevance=0.6,
                            tokens=_estimate_tokens(institutional_text),
                            source="institutional",
                        )
                    )
        except Exception as e:
            logger.warning("Knowledge surfacing failed: %s", e)
        finally:
            institutional_ms = (time.perf_counter() - institutional_started) * 1000

    context_block, _ = _build_context_block(model_profile, context_pieces)
    if context_block:
        system_prompt += "\n\n" + context_block

    # ── Grounding rules ──────────────────────────────────────────────────────
    has_grounding_context = bool(rag_context or live_context)
    if has_grounding_context:
        system_prompt += (
            "\n\nGROUNDING RULES:"
            "\n- Base your answer PRIMARILY on the KNOWLEDGE BASE and LIVE PLATFORM DATA provided above."
            "\n- If the KNOWLEDGE BASE contains a direct definition or identification for the user's question, paraphrase THAT material first and keep the answer narrow."
            "\n- When citing specific concept sets, cohort definitions, or analyses, use ONLY the data from LIVE PLATFORM DATA. These are real entities in the user's Parthenon instance."
            "\n- When citing studies, papers, or researchers, use ONLY information from the KNOWLEDGE BASE. Do NOT invent paper titles, author names, or study details."
            "\n- Do NOT add schema names, table names, metrics, or implementation details unless they are explicitly present in the supplied context."
            "\n- If the provided context does not contain enough information, say so explicitly."
            "\n- You MAY use your general medical training knowledge for explanations, definitions, and context — but NEVER fabricate specific claims."
        )
    else:
        system_prompt += (
            "\n\nNOTE: No relevant documents or platform data were found for this query. "
            "Answer using your general knowledge but be transparent about limitations. "
            "Do NOT fabricate specific paper titles, researcher names, concept sets, or study details."
        )

    system_prompt += _build_response_format_rules(compact=compact)

    _log_latency(
        "abby_prompt_build",
        model_profile=model_profile,
        page_context=request.page_context,
        total_ms=(time.perf_counter() - started) * 1000,
        help_ms=help_ms,
        rag_ms=rag_ms,
        live_ms=live_ms,
        dq_ms=dq_ms,
        institutional_ms=institutional_ms,
        prompt_chars=len(system_prompt),
        prompt_tokens_est=_estimate_tokens(system_prompt),
        context_pieces=len(context_pieces),
        history_turns=len(request.history[-10:]) if request.history else 0,
        rag_chars=len(rag_context),
        live_chars=len(live_context),
    )

    return system_prompt


def _strip_thinking_tokens(text: str) -> str:
    """Strip internal thinking/reasoning tokens from output.

    Supported formats:
    - MedGemma: <unused94>thought...content<unused95>
    - Qwen/Ollama reasoning models: <think> ... </think>
    """
    import re

    # Remove <unused94>thought....<unused95> blocks (thinking tokens)
    text = re.sub(r"<unused94>.*?<unused95>", "", text, flags=re.DOTALL)
    # Remove orphaned thinking markers
    text = re.sub(r"<unused\d+>", "", text)
    # Remove closed Qwen-style thinking blocks.
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # If the response is only an unfinished <think> block, drop it entirely.
    text = re.sub(r"^\s*<think>.*\Z", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE)
    # Some Ollama/Gemma responses leak a plain leading "thought" line.
    text = re.sub(r"^\s*thought\s*\n+", "", text, flags=re.IGNORECASE)

    # Qwen-family models can occasionally leak plain-text meta reasoning even
    # with thinking disabled. When we see multi-paragraph "let me think"
    # scaffolding, keep only the trailing user-facing answer paragraphs.
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    meta_markers = (
        "the user is asking",
        "the user wants",
        "the user's role",
        "they want",
        "let me check",
        "let me phrase",
        "looking at",
        "i should summarize",
        "i'll stick with",
        "need to make sure",
        "keep it to one sentence",
        "check if that's covered",
        "the answer should",
        "the most concise way",
        "double-checking",
        "therefore",
        "the correct term",
        "that's one sentence",
    )
    if len(paragraphs) > 1 and any(marker in "\n\n".join(paragraphs[:-1]).lower() for marker in meta_markers):
        kept: list[str] = []
        for paragraph in reversed(paragraphs):
            lowered = paragraph.lower()
            if not kept:
                kept.append(paragraph)
                continue
            if any(marker in lowered for marker in meta_markers):
                break
            kept.append(paragraph)
        text = "\n\n".join(reversed(kept))

    return text.strip()


def _extract_suggestions(raw: str) -> tuple[str, list[str]]:
    """Extract suggestion chips from the LLM reply and clean output.

    Handles two formats:
      1. JSON array (instructed format):
            SUGGESTIONS: ["What next?", "How to fix?"]
      2. Singular plain-text lines (what MedGemma actually produces):
            Suggestion: Would you like to explore cohort design?
            Suggestion: Are you interested in specific medications?
    """
    import re

    suggestions: list[str] = []
    reply = _strip_thinking_tokens(raw.strip())

    # ── Format 1: SUGGESTIONS: ["...", "..."] ────────────────────────────────
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

    # ── Format 2: Suggestion: text  (MedGemma's actual output) ───────────────
    suggestion_pattern = re.compile(r"Suggestion:\s*(.+?)(?=Suggestion:|$)", re.IGNORECASE | re.DOTALL)
    matches = suggestion_pattern.findall(reply)
    if matches:
        suggestions = [m.strip().rstrip("?. ") + "?" if not m.strip().endswith("?") else m.strip()
                       for m in matches]
        # Strip all Suggestion: lines from the reply body
        reply = re.sub(r"\s*Suggestion:\s*.+?(?=Suggestion:|$)", "", reply,
                       flags=re.IGNORECASE | re.DOTALL).strip()

    return reply, suggestions[:3]


_INCOMPLETE_REPLY_TAIL_WORDS = {
    "a", "an", "and", "as", "at", "based", "by", "for", "from", "in", "including",
    "into", "like", "of", "on", "or", "such", "than", "that", "the", "their", "this",
    "to", "using", "which", "with", "without",
}


def _looks_truncated_visible_reply(reply: str) -> bool:
    """Detect obviously clipped user-facing replies from the local model."""
    cleaned = _strip_thinking_tokens(reply).strip()
    if not cleaned:
        return False
    if cleaned.endswith(("...", "…")):
        return True
    if cleaned[-1] in '.!?"\')]}':
        return False

    if len(cleaned) >= 120:
        return True

    if len(cleaned) < 80:
        return False

    last_words = re.findall(r"[a-z0-9]+", cleaned.lower())
    if not last_words:
        return False
    return last_words[-1] in _INCOMPLETE_REPLY_TAIL_WORDS


def _needs_visible_reply_retry(raw: str, reply: str) -> bool:
    """Detect local-model outputs that are empty or visibly clipped."""
    if reply.strip():
        return _looks_truncated_visible_reply(reply)
    stripped = raw.lstrip()
    return stripped.startswith("<think>") or "<unused94>" in stripped


async def _retry_local_visible_reply(
    system_prompt: str,
    user_message: str,
    history: list[ChatMessage] | None,
    num_predict: int,
) -> tuple[str, list[str]]:
    """Retry once with stronger instructions and a much larger token budget."""
    retry_prompt = (
        f"{system_prompt}\n\n"
        "Return only the final user-facing answer."
        " Do not emit <think> tags, internal reasoning, or hidden scratch work."
        " Start immediately with the answer."
    )
    retry_budget = max(num_predict * 2, 1600)
    raw_retry = await call_ollama(
        system_prompt=retry_prompt,
        user_message=user_message,
        history=history,
        temperature=0.1,
        num_predict=retry_budget,
    )
    return _extract_suggestions(raw_retry)


def _should_store_conversation_answer(answer: str) -> bool:
    """Avoid persisting clipped or clearly low-quality Abby answers."""
    cleaned = _strip_thinking_tokens(answer).strip()
    if not cleaned or _looks_truncated_visible_reply(cleaned):
        return False
    return not re.match(r"^(results?|methods?|background|objective|conclusions?)\b[:\s-]", cleaned, re.IGNORECASE)


def _detect_request_topic(message: str) -> str:
    """Derive a coarse working-memory topic from the incoming request."""
    from app.memory.profile_learner import DOMAIN_KEYWORDS

    msg_lower = message.lower()
    detected_topics = [
        domain for domain, keywords in DOMAIN_KEYWORDS.items()
        if any(keyword in msg_lower for keyword in keywords)
    ]
    return detected_topics[0] if detected_topics else message[:80]


def _prepare_chat_session(request: ChatRequest) -> dict:
    """Advance and refresh the per-conversation working-memory session."""
    session = _get_session(request.conversation_id)
    session["turn"] += 1
    turn = session["turn"]
    session["intent_stack"].prune(current_turn=turn)
    session["intent_stack"].push(_detect_request_topic(request.message), turn=turn)
    return session


def _should_store_conversation_turn(
    request: ChatRequest,
    answer: str,
    *,
    routing_reason: str,
) -> bool:
    """Only retain durable, non-generic conversation turns in Abby memory."""
    if not _should_store_conversation_answer(answer):
        return False
    if routing_reason == "grounded_definition":
        return False
    return True


def _learn_user_profile_from_turn(user_id: int, question: str, answer: str) -> None:
    """Update the learned Abby user profile from a completed turn."""
    learner = ProfileLearner()
    profile_data = _fetch_user_profile(user_id)
    profile = MemoryUserProfile.from_dict(profile_data) if profile_data else MemoryUserProfile()
    messages_for_learning = [
        {"role": "user", "content": question},
        {"role": "assistant", "content": answer},
    ]
    updated_profile = learner.learn_from_conversation(profile, messages_for_learning)
    _save_user_profile(user_id, updated_profile.to_dict())


def _post_process_chat_turn(
    request: ChatRequest,
    reply: str,
    *,
    routing_reason: str,
) -> None:
    """Persist Abby memory/profile updates after a completed response."""
    if request.user_id is not None and _should_store_conversation_turn(
        request,
        reply,
        routing_reason=routing_reason,
    ):
        try:
            store_conversation_turn(
                user_id=request.user_id,
                question=request.message,
                answer=reply,
                page_context=request.page_context,
            )
        except Exception as e:
            logger.warning("Failed to store conversation memory: %s", e)
    elif request.user_id is not None:
        logger.info("Skipping conversation memory storage for low-quality Abby answer")

    if request.user_id is not None:
        try:
            _learn_user_profile_from_turn(request.user_id, request.message, reply)
        except Exception:
            logger.exception("Profile learning failed (non-blocking)")


def _fetch_user_profile(user_id: int) -> dict | None:
    """Fetch user's research profile from PostgreSQL."""
    try:
        from sqlalchemy import text
        with _get_shared_engine().connect() as conn:
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


def _user_exists(user_id: int) -> bool:
    """Return True when the referenced app user exists."""
    try:
        from sqlalchemy import text

        with _get_shared_engine().connect() as conn:
            exists = conn.execute(
                text("SELECT EXISTS(SELECT 1 FROM app.users WHERE id = :uid)"),
                {"uid": user_id},
            ).scalar()
            return bool(exists)
    except Exception:
        logger.exception("Failed to validate Abby user id")
        return False


def _save_user_profile(user_id: int, profile_data: dict) -> None:
    """Upsert user's research profile to PostgreSQL."""
    try:
        import json as json_mod
        from sqlalchemy import text

        if not _user_exists(user_id):
            logger.info("Skipping Abby user profile save for missing user_id=%s", user_id)
            return

        with _get_shared_engine().connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO app.abby_user_profiles (user_id, research_interests,
                        expertise_domains, interaction_preferences, frequently_used, updated_at)
                    VALUES (:uid, CAST(:interests AS text[]), CAST(:expertise AS jsonb),
                            CAST(:prefs AS jsonb), CAST(:freq AS jsonb), NOW())
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
    request_started = time.perf_counter()
    session = _prepare_chat_session(request)

    # Phase 2: Route to appropriate model
    cost_tracker = _get_cost_tracker()
    budget_exhausted = cost_tracker.is_budget_exhausted()
    routing = _router.route(request.message, budget_exhausted=budget_exhausted)
    if routing.model == "claude" and _get_claude_client() is None:
        logger.debug("Claude routed but no client available, falling back to local before prompt build")
        routing = RoutingDecision(model="local", stage=0, reason="claude_unavailable", confidence=1.0)
    local_num_predict = _get_local_num_predict(request.page_context)
    system_prompt = _build_chat_system_prompt(
        request,
        model_profile="claude" if routing.model == "claude" else "medgemma",
        session=session,
    )

    reply = ""
    suggestions: list[str] = []
    sources: list[dict[str, object]] = []
    grounded_definition_reply, grounded_sources = _try_grounded_definition_answer(request)
    if grounded_definition_reply:
        reply = grounded_definition_reply
        sources = grounded_sources
        routing = RoutingDecision(model="local", stage=0, reason="grounded_definition", confidence=1.0)

    # Populate sources from RAG results when not grounded (so the UI can show citations)
    if not sources:
        try:
            rag_results = get_ranked_rag_results(
                query=request.message,
                page_context=request.page_context,
                user_id=request.user_id,
            )
            sources = [
                {
                    "source_label": str(r.get("source_label", "")),
                    "title": str(r.get("title", "")),
                    "section": str(r.get("section", "")),
                    "score": float(str(r.get("score", 0) or 0)),
                }
                for r in rag_results[:5]
                if float(str(r.get("score", 0) or 0)) >= 0.5
            ]
        except Exception:
            logger.debug("Source extraction for response failed (non-blocking)")

    if not reply and routing.model == "claude" and _get_claude_client() is not None:
        # Cloud path: PHI sanitization + cloud safety filter
        # Build history_dicts first so we can include history content in PHI scan
        history_dicts = [{"role": m.role, "content": m.content} for m in request.history]
        # Scan only user-supplied text (message + history) for PHI.
        # The system prompt contains curated knowledge base content (paper
        # titles, author names, clinical terms) which triggers false positives.
        user_text = request.message
        for h in history_dicts:
            user_text += "\n" + h.get("content", "")
        phi_result = _phi_sanitizer.scan(user_text)

        if phi_result.phi_detected and settings.phi_block_on_detection:
            logger.warning(
                "PHI detected in cloud-bound prompt, falling back to local. "
                "Redactions: %d", phi_result.redaction_count,
            )
            routing = RoutingDecision(model="local", stage=0, reason="phi_blocked", confidence=1.0)
            system_prompt = _build_chat_system_prompt(
                request,
                model_profile="medgemma",
                session=session,
            )
        else:
            # Safe to send to Claude
            claude_client = _get_claude_client()
            if claude_client is None:
                raise ValueError("Claude API client is not configured")
            try:
                claude_response = claude_client.chat(
                    system_prompt=system_prompt,
                    message=phi_result.redacted_text if phi_result.redaction_count > 0 else request.message,
                    history=cast(list["MessageParam"], history_dicts),
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
                system_prompt = _build_chat_system_prompt(
                    request,
                    model_profile="medgemma",
                    session=session,
                )

    if not reply and routing.model == "local":
        # Local path: MedGemma via Ollama (existing behavior)
        raw = await call_ollama(
            system_prompt=system_prompt,
            user_message=request.message,
            history=request.history,
            temperature=0.15,
            num_predict=local_num_predict,
        )
        reply, suggestions = _extract_suggestions(raw)
        if _needs_visible_reply_retry(raw, reply):
            logger.warning(
                "Local Abby reply contained only hidden reasoning; retrying with larger token budget"
            )
            reply, suggestions = await _retry_local_visible_reply(
                system_prompt=system_prompt,
                user_message=request.message,
                history=request.history,
                num_predict=local_num_predict,
            )

    _post_process_chat_turn(request, reply, routing_reason=routing.reason)

    # Check for FAQ promotion (non-blocking)
    try:
        from app.institutional.faq_promoter import FAQPromoter
        faq = FAQPromoter(engine=_get_shared_engine())
        faq.check_and_promote(question=request.message, answer=reply)
    except Exception:
        logger.debug("FAQ promotion check failed (non-blocking)")

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

    _log_latency(
        "abby_chat_request",
        model=routing.model,
        route_reason=routing.reason,
        page_context=request.page_context,
        total_ms=(time.perf_counter() - request_started) * 1000,
        reply_chars=len(reply),
        suggestions=len(suggestions),
        history_turns=len(request.history[-10:]) if request.history else 0,
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
        sources=sources,
    )


class ExecutePlanRequest(BaseModel):
    plan_id: str
    user_id: int


@router.post("/execute-plan")
async def execute_plan_endpoint(request: ExecutePlanRequest) -> dict:
    """Execute an approved agency plan by plan_id."""
    engine = _get_plan_engine()
    plan = engine.get_plan(request.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or expired")
    if plan.user_id != request.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to execute this plan")
    engine.approve_plan(plan)
    result = await engine.execute_plan(plan)
    return result.to_dict()


async def _stream_ollama(system_prompt: str, user_message: str,
                         history: list[ChatMessage] | None = None,
                         temperature: float = 0.3,
                         num_predict: int | None = None,
                         on_complete: Callable[[str, list[str]], None] | None = None) -> AsyncGenerator[str, None]:
    """Stream tokens from Ollama as SSE events."""
    started = time.perf_counter()
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        for msg in history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    try:
        client = _get_ollama_http_client()
        async with client.stream(
            "POST",
            f"{settings.abby_llm_base_url}/api/chat",
            json={
                "model": settings.abby_llm_model,
                "messages": messages,
                "stream": True,
                "think": False,
                "keep_alive": settings.abby_ollama_keep_alive,
                "options": {
                    "temperature": temperature,
                    "num_predict": num_predict if num_predict is not None else settings.ollama_num_predict,
                },
            },
            timeout=settings.ollama_timeout,
        ) as resp:
            resp.raise_for_status()
            full_content = ""
            visible_content = ""
            first_token_ms: float | None = None
            final_data: dict[str, Any] | None = None
            pending = ""
            suppress_reasoning: bool | None = None
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    if data.get("done"):
                        final_data = data
                        break
                    token = data.get("message", {}).get("content", "")
                    if token:
                        full_content += token
                        if first_token_ms is None:
                            first_token_ms = (time.perf_counter() - started) * 1000
                        pending += token
                        if suppress_reasoning is None:
                            stripped_pending = pending.lstrip()
                            if stripped_pending.startswith("<think>") or stripped_pending.startswith("<unused94>"):
                                suppress_reasoning = True
                            elif len(pending) >= 16:
                                suppress_reasoning = False

                        if suppress_reasoning is True:
                            cleaned = _strip_thinking_tokens(pending)
                            if cleaned:
                                visible_content += cleaned
                                yield f"data: {json.dumps({'token': cleaned})}\n\n"
                                pending = ""
                                suppress_reasoning = False
                        elif suppress_reasoning is False:
                            visible_content += pending
                            yield f"data: {json.dumps({'token': pending})}\n\n"
                            pending = ""
                except json.JSONDecodeError:
                    continue

            # Extract suggestions from complete response
            if pending and suppress_reasoning is not True:
                visible_content += pending
                yield f"data: {json.dumps({'token': pending})}\n\n"

            _, suggestions = _extract_suggestions(full_content)
            if not visible_content.strip() and _needs_visible_reply_retry(full_content, visible_content):
                logger.warning(
                    "Local Abby stream contained only hidden reasoning; retrying with larger token budget"
                )
                retry_reply, retry_suggestions = await _retry_local_visible_reply(
                    system_prompt=system_prompt,
                    user_message=user_message,
                    history=history,
                    num_predict=num_predict if num_predict is not None else settings.ollama_num_predict,
                )
                if retry_reply:
                    visible_content += retry_reply
                    yield f"data: {json.dumps({'token': retry_reply})}\n\n"
                if retry_suggestions:
                    suggestions = retry_suggestions
            if suggestions:
                yield f"data: {json.dumps({'suggestions': suggestions})}\n\n"

            if on_complete is not None:
                try:
                    on_complete((visible_content or full_content).strip(), suggestions)
                except Exception:
                    logger.exception("Abby stream post-processing failed")

            yield "data: [DONE]\n\n"

            _log_latency(
                "abby_ollama_stream",
                model=settings.abby_llm_model,
                base_url=settings.abby_llm_base_url,
                total_ms=(time.perf_counter() - started) * 1000,
                first_token_ms=first_token_ms,
                prompt_chars=len(system_prompt),
                prompt_tokens_est=_estimate_tokens(system_prompt),
                message_chars=len(user_message),
                num_predict=num_predict if num_predict is not None else settings.ollama_num_predict,
                history_turns=len(history[-10:]) if history else 0,
                response_chars=len(visible_content or full_content),
                load_ms=_ns_to_ms(final_data.get("load_duration")) if final_data else None,
                prompt_eval_ms=_ns_to_ms(final_data.get("prompt_eval_duration")) if final_data else None,
                eval_ms=_ns_to_ms(final_data.get("eval_duration")) if final_data else None,
                ollama_total_ms=_ns_to_ms(final_data.get("total_duration")) if final_data else None,
                prompt_eval_count=final_data.get("prompt_eval_count") if final_data else None,
                eval_count=final_data.get("eval_count") if final_data else None,
            )
    except httpx.TimeoutException:
        yield f"data: {json.dumps({'error': 'LLM service timed out.'})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error("Ollama streaming failed: %s", e)
        yield f"data: {json.dumps({'error': f'LLM service unavailable: {e}'})}\n\n"
        yield "data: [DONE]\n\n"


async def _stream_chat_response(response: ChatResponse) -> AsyncGenerator[str, None]:
    """Emit a completed chat response over SSE for grounded/static answers."""
    if response.reply:
        yield f"data: {json.dumps({'token': response.reply})}\n\n"
    if response.suggestions:
        yield f"data: {json.dumps({'suggestions': response.suggestions})}\n\n"
    if response.sources:
        yield f"data: {json.dumps({'sources': response.sources})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """
    SSE streaming version of the chat endpoint. Returns token-by-token
    responses as Server-Sent Events for real-time display in the UI.
    """
    started = time.perf_counter()

    # Commons/studies/analyses rely heavily on fresh RAG retrieval and may be
    # routed to the higher-utility non-streaming path. Preserve the SSE
    # contract by emitting the completed chat response as streamed events.
    if request.page_context in {"commons_ask_abby", "studies", "analyses"}:
        response = await chat(request)
        _log_latency(
            "abby_chat_stream_via_chat",
            page_context=request.page_context,
            total_ms=(time.perf_counter() - started) * 1000,
            reply_chars=len(response.reply),
            sources=len(response.sources),
        )
        return StreamingResponse(
            _stream_chat_response(response),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    session = _prepare_chat_session(request)
    grounded_definition_reply, grounded_sources = _try_grounded_definition_answer(request)
    if grounded_definition_reply:
        _post_process_chat_turn(request, grounded_definition_reply, routing_reason="grounded_definition")
        _log_latency(
            "abby_chat_stream_grounded",
            page_context=request.page_context,
            total_ms=(time.perf_counter() - started) * 1000,
            reply_chars=len(grounded_definition_reply),
            sources=len(grounded_sources),
        )
        return StreamingResponse(
            _stream_chat_response(
                ChatResponse(
                    reply=grounded_definition_reply,
                    suggestions=[],
                    routing={
                        "model": "local",
                        "reason": "grounded_definition",
                        "stage": 0,
                    },
                    confidence="medium",
                    sources=grounded_sources,
                )
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    system_prompt = _build_chat_system_prompt(
        request,
        model_profile="medgemma",
        session=session,
    )
    local_num_predict = _get_local_num_predict(request.page_context)
    _log_latency(
        "abby_chat_stream_ready",
        page_context=request.page_context,
        total_ms=(time.perf_counter() - started) * 1000,
        prompt_chars=len(system_prompt),
        prompt_tokens_est=_estimate_tokens(system_prompt),
        num_predict=local_num_predict,
        history_turns=len(request.history[-10:]) if request.history else 0,
    )

    return StreamingResponse(
        _stream_ollama(
            system_prompt=system_prompt,
            user_message=request.message,
            history=request.history,
            temperature=0.3,
            num_predict=local_num_predict,
            on_complete=lambda reply, _suggestions: _post_process_chat_turn(
                request,
                reply,
                routing_reason="local",
            ),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
