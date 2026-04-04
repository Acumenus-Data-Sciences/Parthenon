"""Patient similarity router.

Endpoints for computing patient embeddings used by the Patient Similarity Engine.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.patient_embeddings import (
    PATIENT_EMBEDDING_DIM,
    compute_patient_embedding,
    compute_patient_embeddings_batch,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patient-similarity")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PatientFeatures(BaseModel):
    """Clinical features for a single patient.

    Concept lists accept int or str (PHP sends OMOP concept IDs as integers).
    lab_vector accepts either a list of floats or a dict mapping concept_id to z-score
    (PHP sends the dict form from JSONB).
    """

    person_id: int
    age_bucket: int = 0
    gender_concept_id: int = 0
    race_concept_id: int = 0
    condition_concepts: list[int | str] = Field(default_factory=list)
    lab_vector: list[float] | dict[str, float] = Field(default_factory=list)
    drug_concepts: list[int | str] = Field(default_factory=list)
    procedure_concepts: list[int | str] = Field(default_factory=list)
    variant_genes: list[str | dict] = Field(default_factory=list)


class EmbeddingResponse(BaseModel):
    """Embedding result for a single patient."""

    person_id: int
    embedding: list[float]
    dimension: int


class BatchEmbeddingRequest(BaseModel):
    """Batch request for multiple patient embeddings."""

    patients: list[PatientFeatures]


class BatchEmbeddingResponse(BaseModel):
    """Batch response containing multiple patient embeddings."""

    embeddings: list[EmbeddingResponse]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/embed", response_model=EmbeddingResponse)
async def embed_patient(request: PatientFeatures) -> EmbeddingResponse:
    """Compute a 512-dimensional embedding for a single patient."""
    try:
        features = request.model_dump()
        embedding = compute_patient_embedding(features)
        return EmbeddingResponse(
            person_id=request.person_id,
            embedding=embedding,
            dimension=PATIENT_EMBEDDING_DIM,
        )
    except Exception as exc:
        logger.exception("Failed to compute patient embedding for person_id=%d", request.person_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/embed-batch", response_model=BatchEmbeddingResponse)
async def embed_patients_batch(request: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
    """Compute 768-dimensional embeddings for a batch of patients.

    Uses batch-optimized path that deduplicates concepts across all patients
    and makes one encoding call per dimension (4 total) instead of per patient.
    """
    try:
        features_list = [p.model_dump() for p in request.patients]
        all_embeddings = compute_patient_embeddings_batch(features_list)

        results = [
            EmbeddingResponse(
                person_id=request.patients[i].person_id,
                embedding=emb,
                dimension=PATIENT_EMBEDDING_DIM,
            )
            for i, emb in enumerate(all_embeddings)
        ]
        return BatchEmbeddingResponse(embeddings=results)
    except Exception as exc:
        logger.exception("Failed to compute batch embeddings")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
