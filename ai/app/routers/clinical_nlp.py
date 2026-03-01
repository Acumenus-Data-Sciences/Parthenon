"""Clinical NLP router for entity extraction and concept linking."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.medcat import get_clinical_nlp_service

router = APIRouter()


class NlpExtractRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    link_concepts: bool = True


class ExtractedEntity(BaseModel):
    text: str
    start: int
    end: int
    label: str
    concept_id: int | None = None
    concept_name: str | None = None
    confidence: float = 0.0
    negated: bool = False
    context: str = ""


class NlpExtractResponse(BaseModel):
    entities: list[ExtractedEntity]
    entity_count: int


class BatchNlpRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=50)
    link_concepts: bool = True


class BatchNlpResponse(BaseModel):
    results: list[NlpExtractResponse]


@router.post("/extract")
async def extract_entities(request: NlpExtractRequest) -> NlpExtractResponse:
    """Extract clinical entities from text and optionally link to OMOP concepts."""
    service = get_clinical_nlp_service()
    result = await service.extract_and_link(request.text, request.link_concepts)

    entities = [
        ExtractedEntity(
            text=e.text,
            start=e.start,
            end=e.end,
            label=e.label,
            concept_id=e.concept_id,
            concept_name=e.concept_name,
            confidence=e.confidence,
            negated=e.negated,
            context=e.context,
        )
        for e in result.entities
    ]

    return NlpExtractResponse(entities=entities, entity_count=len(entities))


@router.post("/extract-batch")
async def extract_batch(request: BatchNlpRequest) -> BatchNlpResponse:
    """Extract clinical entities from multiple texts."""
    service = get_clinical_nlp_service()
    results = []

    for text in request.texts:
        result = await service.extract_and_link(text, request.link_concepts)
        entities = [
            ExtractedEntity(
                text=e.text,
                start=e.start,
                end=e.end,
                label=e.label,
                concept_id=e.concept_id,
                concept_name=e.concept_name,
                confidence=e.confidence,
                negated=e.negated,
                context=e.context,
            )
            for e in result.entities
        ]
        results.append(NlpExtractResponse(entities=entities, entity_count=len(entities)))

    return BatchNlpResponse(results=results)
