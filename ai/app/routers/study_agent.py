"""StudyAgent proxy endpoints.

Proxies requests to the OHDSI StudyAgent ACP server for
AI-assisted phenotype search, cohort linting, and study design.
"""
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Module-level connection-pooled client — created once, reused across requests.
_client = httpx.AsyncClient(
    base_url=settings.study_agent_url,
    timeout=10.0,
)

# Per-endpoint timeout constants (seconds).
_TIMEOUT_HEALTH = 10.0
_TIMEOUT_TOOLS = 60.0
_TIMEOUT_FLOW = 180.0


async def _proxy_get(path: str, timeout: float = _TIMEOUT_HEALTH) -> dict[str, Any]:
    """Forward a GET request to the StudyAgent ACP server."""
    try:
        resp = await _client.get(path, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="StudyAgent service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


async def _proxy_post(path: str, payload: dict[str, Any], timeout: float = _TIMEOUT_FLOW) -> dict[str, Any]:
    """Forward a POST request to the StudyAgent ACP server."""
    try:
        resp = await _client.post(path, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="StudyAgent service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health")
async def study_agent_health() -> dict[str, Any]:
    """Check StudyAgent ACP server health including MCP status."""
    return await _proxy_get("/health", timeout=_TIMEOUT_HEALTH)


@router.get("/tools")
async def study_agent_tools() -> dict[str, Any]:
    """List all available StudyAgent MCP tools."""
    return await _proxy_get("/tools", timeout=_TIMEOUT_TOOLS)


# ---------------------------------------------------------------------------
# Phenotype flows
# ---------------------------------------------------------------------------


class PhenotypeSearchRequest(BaseModel):
    query: str = Field(..., description="Natural language phenotype search query")
    top_k: int = Field(default=10, description="Number of results to return")


@router.post("/phenotype/search")
async def phenotype_search(request: PhenotypeSearchRequest) -> dict[str, Any]:
    """Search the OHDSI PhenotypeLibrary using hybrid dense+sparse retrieval."""
    return await _proxy_post("/tools/call", {
        "name": "phenotype_search",
        "arguments": {"query": request.query, "top_k": request.top_k},
    }, timeout=_TIMEOUT_TOOLS)


class PhenotypeRecommendRequest(BaseModel):
    study_intent: str = Field(..., description="Description of the study goal")
    search_results: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Previous search results to rank (optional)",
    )


@router.post("/phenotype/recommend")
async def phenotype_recommend(request: PhenotypeRecommendRequest) -> dict[str, Any]:
    """Get AI-ranked phenotype recommendations for a study intent."""
    return await _proxy_post("/flows/phenotype_recommendation", {
        "study_intent": request.study_intent,
        "search_results": request.search_results,
    })


class PhenotypeImproveRequest(BaseModel):
    cohort_definition: dict[str, Any] = Field(
        ..., description="OHDSI cohort definition JSON to improve",
    )
    study_intent: str = Field(default="", description="Study context for improvements")


@router.post("/phenotype/improve")
async def phenotype_improve(request: PhenotypeImproveRequest) -> dict[str, Any]:
    """Get AI-suggested improvements for a cohort definition."""
    return await _proxy_post("/flows/phenotype_improvements", {
        "cohort_definition": request.cohort_definition,
        "study_intent": request.study_intent,
    })


# ---------------------------------------------------------------------------
# Study intent
# ---------------------------------------------------------------------------


class IntentSplitRequest(BaseModel):
    intent: str = Field(
        ..., description="Free-text study intent to split into target and outcome",
    )


@router.post("/intent/split")
async def intent_split(request: IntentSplitRequest) -> dict[str, Any]:
    """Split a study intent into target population and outcome statements."""
    return await _proxy_post("/flows/phenotype_intent_split", {
        "intent": request.intent,
    })


# ---------------------------------------------------------------------------
# Cohort quality
# ---------------------------------------------------------------------------


class CohortLintRequest(BaseModel):
    cohort_definition: dict[str, Any] = Field(
        ..., description="OHDSI cohort definition JSON to lint",
    )


@router.post("/cohort/lint")
async def cohort_lint(request: CohortLintRequest) -> dict[str, Any]:
    """Lint a cohort definition for design issues.

    Checks for: empty concept sets, missing washout periods, inverted
    time windows, missing includeDescendants, and more.
    """
    return await _proxy_post("/flows/cohort_critique_general_design", {
        "cohort_definition": request.cohort_definition,
    })


class ConceptSetReviewRequest(BaseModel):
    concept_set: dict[str, Any] = Field(
        ..., description="OHDSI concept set expression JSON to review",
    )


@router.post("/concept-set/review")
async def concept_set_review(request: ConceptSetReviewRequest) -> dict[str, Any]:
    """Review a concept set and propose improvements.

    Analyzes coverage, suggests missing concepts, and flags issues
    like mixed domains or missing descendant flags.
    """
    return await _proxy_post("/flows/concept_sets_review", {
        "concept_set": request.concept_set,
    })


# ---------------------------------------------------------------------------
# Convenience endpoints
# ---------------------------------------------------------------------------


class LintCohortCombinedRequest(BaseModel):
    cohort_definition: dict[str, Any] = Field(
        ..., description="OHDSI cohort definition JSON — runs both cohort lint and concept set review",
    )


@router.post("/lint-cohort")
async def lint_cohort_combined(request: LintCohortCombinedRequest) -> dict[str, Any]:
    """Run cohort lint and concept set review in sequence and return combined findings."""
    cohort = request.cohort_definition
    critique = None
    concept_review = None
    errors: list[str] = []
    try:
        critique = await _proxy_post("/flows/cohort_critique_general_design", {"cohort_definition": cohort})
    except HTTPException as e:
        errors.append(f"Cohort critique failed: {e.detail}")
    try:
        concept_review = await _proxy_post("/flows/concept_sets_review", {"concept_set": cohort})
    except HTTPException as e:
        errors.append(f"Concept set review failed: {e.detail}")
    return {"cohort_findings": critique, "concept_set_findings": concept_review, "errors": errors}


class RecommendPhenotypesConvenienceRequest(BaseModel):
    description: str = Field(..., max_length=5000, description="Study description for phenotype recommendations")


@router.post("/recommend-phenotypes")
async def recommend_phenotypes_convenience(request: RecommendPhenotypesConvenienceRequest) -> dict[str, Any]:
    """Convenience wrapper: recommend phenotypes from a plain study description."""
    return await _proxy_post("/flows/phenotype_recommendation", {"study_intent": request.description})
