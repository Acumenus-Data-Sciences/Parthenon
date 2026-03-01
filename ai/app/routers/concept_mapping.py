from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ollama_client import generate_concept_mapping

router = APIRouter()


class ConceptMappingRequest(BaseModel):
    terms: list[str]
    context: str | None = None


class ConceptMappingResult(BaseModel):
    term: str
    suggested_concept: str | None
    confidence: float
    reasoning: str


@router.post("/map")
async def map_concepts(request: ConceptMappingRequest) -> dict[str, Any]:
    results = []
    for term in request.terms:
        result = await generate_concept_mapping(term, request.context)
        results.append(result)
    return {"results": results}
