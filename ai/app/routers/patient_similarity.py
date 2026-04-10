"""Patient similarity router.

Endpoints for computing patient embeddings used by the Patient Similarity Engine.
"""

from __future__ import annotations

import hashlib
import logging
import time

import asyncpg
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.patient_embeddings import (
    PATIENT_EMBEDDING_DIM,
    compute_patient_embedding,
    compute_patient_embeddings_batch,
)
from app.services.projection import (
    ProjectionResult,
    cache_result,
    compute_projection,
    get_cached_projection,
)
from app.services.temporal_similarity import compute_temporal_similarity

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


# ---------------------------------------------------------------------------
# Landscape projection models
# ---------------------------------------------------------------------------

class LandscapeRequest(BaseModel):
    """Request model for projecting patient embeddings into 2D/3D space."""

    source_id: int
    person_ids: list[int] | None = None
    dimensions: int = Field(default=3, ge=2, le=3)
    cohort_person_ids: list[int] | None = None
    max_points: int = Field(default=5000, ge=10, le=50000)


class LandscapePoint(BaseModel):
    """A single projected patient point."""

    person_id: int
    x: float
    y: float
    z: float | None = None
    cluster_id: int = 0
    is_cohort_member: bool = False
    age_bucket: int = 0
    gender_concept_id: int = 0


class LandscapeResponse(BaseModel):
    """Response model for landscape projection."""

    points: list[LandscapePoint]
    clusters: list[dict]
    quality: dict
    stats: dict


# ---------------------------------------------------------------------------
# Connection pool management
# ---------------------------------------------------------------------------

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    """Lazily create and return a connection pool for patient_feature_vectors queries."""
    global _pool  # noqa: PLW0603
    if _pool is None or _pool._closed:
        dsn = settings.database_url
        if not dsn:
            raise HTTPException(
                status_code=500,
                detail="DATABASE_URL not configured for AI service",
            )
        # asyncpg needs postgresql:// not postgres://
        if dsn.startswith("postgres://"):
            dsn = "postgresql://" + dsn[len("postgres://"):]
        _pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)
    return _pool


# ---------------------------------------------------------------------------
# Landscape endpoint
# ---------------------------------------------------------------------------

@router.post("/project", response_model=LandscapeResponse)
async def project_landscape(request: LandscapeRequest) -> LandscapeResponse:
    """Project patient embeddings into 2D/3D space via PCA->UMAP pipeline."""
    start = time.time()

    try:
        # Check cache first
        cache_key_str = f"landscape:{request.source_id}:{request.dimensions}:{request.max_points}"
        if request.person_ids:
            pid_hash = hashlib.sha256(
                ",".join(str(p) for p in sorted(request.person_ids)).encode()
            ).hexdigest()[:12]
            cache_key_str += f":{pid_hash}"

        cached = get_cached_projection(
            cache_key_str, request.max_points, 0, request.dimensions
        )
        if cached is not None:
            return _build_landscape_response(cached, request, time.time() - start)

        # Query patient_feature_vectors from PostgreSQL
        pool = await _get_pool()
        async with pool.acquire() as conn:
            if request.person_ids:
                rows = await conn.fetch(
                    """
                    SELECT person_id, embedding::text, age_bucket, gender_concept_id
                    FROM app.patient_feature_vectors
                    WHERE source_id = $1
                      AND embedding IS NOT NULL
                      AND person_id = ANY($2::bigint[])
                    """,
                    request.source_id,
                    request.person_ids,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT person_id, embedding::text, age_bucket, gender_concept_id
                    FROM app.patient_feature_vectors
                    WHERE source_id = $1
                      AND embedding IS NOT NULL
                    """,
                    request.source_id,
                )

        if not rows:
            return LandscapeResponse(
                points=[],
                clusters=[],
                quality={"outlier_count": 0, "duplicate_count": 0, "orphan_count": 0},
                stats={
                    "total_vectors": 0,
                    "projection_time_ms": 0,
                    "sampled": 0,
                },
            )

        # Deterministic sampling if too many points
        total_fetched = len(rows)
        sampled = False
        if total_fetched > request.max_points:
            seed = int(
                hashlib.sha256(str(request.source_id).encode()).hexdigest()[:8], 16
            )
            rng = np.random.RandomState(seed)
            indices = sorted(
                rng.choice(total_fetched, size=request.max_points, replace=False).tolist()
            )
            rows = [rows[i] for i in indices]
            sampled = True

        # Build cohort membership set
        cohort_set: set[int] = set()
        if request.cohort_person_ids:
            cohort_set = set(request.cohort_person_ids)

        # Parse embeddings and build metadata
        ids: list[str] = []
        embeddings_list: list[np.ndarray] = []
        metadatas: list[dict] = []

        for row in rows:
            pid = int(row["person_id"])
            emb_str = row["embedding"]
            age_bucket = int(row["age_bucket"]) if row["age_bucket"] is not None else 0
            gender_cid = int(row["gender_concept_id"]) if row["gender_concept_id"] is not None else 0

            # Parse pgvector text format: [0.1,0.2,...]
            emb = np.fromstring(emb_str.strip("[]"), sep=",", dtype=np.float32)
            if emb.size == 0:
                continue

            ids.append(str(pid))
            embeddings_list.append(emb)
            metadatas.append({
                "person_id": pid,
                "age_bucket": age_bucket,
                "gender_concept_id": gender_cid,
                "is_cohort": pid in cohort_set,
            })

        if len(ids) < 3:
            return LandscapeResponse(
                points=[
                    LandscapePoint(
                        person_id=int(mid["person_id"]),
                        x=0.0,
                        y=0.0,
                        z=0.0 if request.dimensions == 3 else None,
                        cluster_id=0,
                        is_cohort_member=bool(mid["is_cohort"]),
                        age_bucket=int(mid["age_bucket"]),
                        gender_concept_id=int(mid["gender_concept_id"]),
                    )
                    for mid in metadatas
                ],
                clusters=[],
                quality={"outlier_count": 0, "duplicate_count": 0, "orphan_count": 0},
                stats={
                    "total_vectors": total_fetched,
                    "projection_time_ms": round((time.time() - start) * 1000),
                    "sampled": len(ids),
                },
            )

        embeddings_arr = np.vstack(embeddings_list)

        # Run projection pipeline
        result = compute_projection(ids, embeddings_arr, metadatas, request.dimensions)

        # Cache for 10 minutes
        cache_result(cache_key_str, request.max_points, 0, result, request.dimensions)

        elapsed_ms = round((time.time() - start) * 1000)
        result.stats["total_vectors"] = total_fetched
        result.stats["projection_time_ms"] = elapsed_ms
        if sampled:
            result.stats["sampled"] = len(ids)

        return _build_landscape_response(result, request, time.time() - start)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to project patient landscape for source_id=%d", request.source_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Temporal similarity models
# ---------------------------------------------------------------------------

class TemporalSimilarityRequest(BaseModel):
    """Request for DTW-based temporal trajectory comparison."""

    source_id: int
    person_a_id: int
    person_b_id: int
    measurement_concept_ids: list[int] | None = None


class TemporalMeasurementResult(BaseModel):
    """Per-measurement DTW comparison result."""

    concept_id: int
    concept_name: str
    dtw_distance: float
    similarity: float
    series_a: list[dict]
    series_b: list[dict]
    alignment: list[tuple[int, int]]


class TemporalSimilarityResponse(BaseModel):
    """Response from temporal similarity computation."""

    overall_similarity: float
    per_measurement: list[TemporalMeasurementResult]


# ---------------------------------------------------------------------------
# Temporal similarity endpoint
# ---------------------------------------------------------------------------

@router.post("/temporal-similarity", response_model=TemporalSimilarityResponse)
async def temporal_similarity(request: TemporalSimilarityRequest) -> TemporalSimilarityResponse:
    """Compare two patients' lab trajectories using Dynamic Time Warping."""
    try:
        pool = await _get_pool()

        # Resolve source schema from source_daimons
        async with pool.acquire() as conn:
            cdm_row = await conn.fetchrow(
                "SELECT table_qualifier FROM app.source_daimons "
                "WHERE source_id = $1 AND daimon_type = 'CDM'",
                request.source_id,
            )
            vocab_row = await conn.fetchrow(
                "SELECT table_qualifier FROM app.source_daimons "
                "WHERE source_id = $1 AND daimon_type = 'Vocabulary'",
                request.source_id,
            )

        if cdm_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"No CDM daimon found for source_id={request.source_id}",
            )

        source_schema = str(cdm_row["table_qualifier"])
        vocab_schema = str(vocab_row["table_qualifier"]) if vocab_row else "vocab"

        result = await compute_temporal_similarity(
            pool=pool,
            person_a_id=request.person_a_id,
            person_b_id=request.person_b_id,
            source_schema=source_schema,
            vocab_schema=vocab_schema,
            measurement_concept_ids=request.measurement_concept_ids,
        )

        return TemporalSimilarityResponse(**result)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Failed to compute temporal similarity for persons %d vs %d",
            request.person_a_id,
            request.person_b_id,
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _build_landscape_response(
    result: ProjectionResult,
    request: LandscapeRequest,
    elapsed_seconds: float,
) -> LandscapeResponse:
    """Convert a ProjectionResult into a LandscapeResponse."""
    cohort_set: set[int] = set(request.cohort_person_ids or [])

    points = [
        LandscapePoint(
            person_id=int(p.id),
            x=p.x,
            y=p.y,
            z=p.z if request.dimensions == 3 else None,
            cluster_id=p.cluster_id,
            is_cohort_member=int(p.id) in cohort_set or bool(p.metadata.get("is_cohort", False)),
            age_bucket=int(p.metadata.get("age_bucket", 0)),
            gender_concept_id=int(p.metadata.get("gender_concept_id", 0)),
        )
        for p in result.points
    ]

    clusters = [
        {
            "id": c.id,
            "label": c.label,
            "centroid": c.centroid,
            "size": c.size,
        }
        for c in result.clusters
    ]

    quality = {
        "outlier_count": len(result.quality.outlier_ids),
        "duplicate_count": len(result.quality.duplicate_pairs),
        "orphan_count": len(result.quality.orphan_ids),
    }

    return LandscapeResponse(
        points=points,
        clusters=clusters,
        quality=quality,
        stats=result.stats,
    )
