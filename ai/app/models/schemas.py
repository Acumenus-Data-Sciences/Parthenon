from pydantic import BaseModel


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    model: str


class BatchEmbeddingRequest(BaseModel):
    texts: list[str]


class BatchEmbeddingResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    count: int


class ConceptSearchRequest(BaseModel):
    query: str
    top_k: int = 10


class ConceptCandidate(BaseModel):
    concept_id: int
    concept_name: str
    domain_id: str
    vocabulary_id: str
    score: float
    strategy: str


class ConceptSearchResponse(BaseModel):
    query: str
    candidates: list[ConceptCandidate]


class ClinicalNlpRequest(BaseModel):
    text: str
    detect_negation: bool = True


class ClinicalEntity(BaseModel):
    text: str
    start: int
    end: int
    concept_id: int | None
    concept_name: str | None
    is_negated: bool


class ClinicalNlpResponse(BaseModel):
    entities: list[ClinicalEntity]
