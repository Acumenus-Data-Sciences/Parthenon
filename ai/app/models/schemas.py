from pydantic import BaseModel, Field


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


# --- Step 3B: Concept Mapping Engine models ---


class MappingTerm(BaseModel):
    source_code: str
    source_description: str | None = None
    source_vocabulary_id: str | None = None
    source_table: str | None = None
    source_column: str | None = None


class RankedCandidate(BaseModel):
    concept_id: int
    concept_name: str
    domain_id: str
    vocabulary_id: str
    standard_concept: str | None
    final_score: float
    strategy_scores: dict[str, float]
    primary_strategy: str


class MappingTermRequest(BaseModel):
    source_code: str
    source_description: str | None = None
    source_vocabulary_id: str | None = None
    source_table: str | None = None
    source_column: str | None = None
    sample_values: list[str] | None = None


class MappingTermResponse(BaseModel):
    term: str
    candidates: list[RankedCandidate]
    mapping_time_ms: int


class BatchMappingRequest(BaseModel):
    terms: list[MappingTerm] = Field(..., max_length=200)


class MappingResult(BaseModel):
    term: str
    source_code: str
    candidates: list[RankedCandidate]


class BatchMappingResponse(BaseModel):
    results: list[MappingResult]
    total_time_ms: int
    strategies_used: dict[str, int]
