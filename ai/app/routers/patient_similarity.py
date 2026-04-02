"""Patient similarity router.

Endpoints for computing patient embeddings used by the Patient Similarity Engine.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.patient_embeddings import PATIENT_EMBEDDING_DIM, compute_patient_embedding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patient-similarity")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PatientFeatures(BaseModel):
    """Clinical features for a single patient."""

    person_id: int
    age_bucket: int = 0
    gender_concept_id: int = 0
    race_concept_id: int = 0
    condition_concepts: list[str] = Field(default_factory=list)
    lab_vector: list[float] = Field(default_factory=list)
    drug_concepts: list[str] = Field(default_factory=list)
    procedure_concepts: list[str] = Field(default_factory=list)
    variant_genes: list[str] = Field(default_factory=list)


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
    """Compute 512-dimensional embeddings for a batch of patients."""
    results: list[EmbeddingResponse] = []
    for patient in request.patients:
        try:
            features = patient.model_dump()
            embedding = compute_patient_embedding(features)
            results.append(EmbeddingResponse(
                person_id=patient.person_id,
                embedding=embedding,
                dimension=PATIENT_EMBEDDING_DIM,
            ))
        except Exception as exc:
            logger.exception(
                "Failed to compute embedding for person_id=%d, skipping",
                patient.person_id,
            )
            raise HTTPException(
                status_code=500,
                detail=f"Failed on person_id={patient.person_id}: {exc}",
            ) from exc

    return BatchEmbeddingResponse(embeddings=results)
