"""Patient similarity router.

Endpoints for computing patient embeddings used by the Patient Similarity Engine.
"""

import json
import logging
import os
from typing import Any

import asyncpg
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.patient_embeddings import (
    PATIENT_EMBEDDING_DIM,
    compute_patient_embedding,
    compute_patient_embeddings_batch,
)
from app.services.phenotype_discovery import discover_phenotypes
from app.services.propensity_score import PropensityScoreService
from app.services.similarity_network_fusion import fuse_patient_network
from app.services.temporal_similarity import compute_temporal_similarity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patient-similarity")

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    """Lazily create asyncpg connection pool."""
    global _pool  # noqa: PLW0603
    if _pool is None:
        db_url = os.getenv("DATABASE_URL", "")
        _pool = await asyncpg.create_pool(db_url, min_size=1, max_size=5)
    return _pool


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
# Propensity Score Matching
# ---------------------------------------------------------------------------

class PropensityMatchRequest(BaseModel):
    """Request for propensity score matching between two cohorts."""

    source_id: int
    target_cohort_ids: list[int]
    comparator_cohort_ids: list[int]
    max_ratio: int = Field(default=4, ge=1, le=10)
    caliper_scale: float = Field(default=0.2, ge=0.05, le=1.0)


class PropensityScoreItem(BaseModel):
    person_id: int
    ps: float
    preference_score: float
    cohort: str


class MatchedPairItem(BaseModel):
    target_id: int
    comparator_id: int
    distance: float


class CovariateBalanceItem(BaseModel):
    covariate: str
    smd: float
    type: str
    domain: str


class PreferenceDistributionItem(BaseModel):
    bins: list[float]
    target_density: list[float]
    comparator_density: list[float]


class ModelMetricsItem(BaseModel):
    auc: float
    n_covariates: int
    n_target: int
    n_comparator: int
    caliper: float


class PropensityMatchResponse(BaseModel):
    propensity_scores: list[PropensityScoreItem]
    matched_pairs: list[MatchedPairItem]
    balance: dict[str, list[CovariateBalanceItem]]
    model_metrics: ModelMetricsItem
    unmatched: dict[str, list[int]]
    preference_distribution: PreferenceDistributionItem


async def _fetch_feature_vectors(
    pool: asyncpg.Pool,
    source_id: int,
    person_ids: list[int],
) -> list[dict[str, Any]]:
    """Fetch patient feature vectors from app.patient_feature_vectors."""
    rows = await pool.fetch(
        """
        SELECT person_id, age_bucket, gender_concept_id,
               condition_concepts, drug_concepts, procedure_concepts, lab_vector
        FROM app.patient_feature_vectors
        WHERE source_id = $1 AND person_id = ANY($2::bigint[])
        """,
        source_id,
        person_ids,
    )
    results: list[dict[str, Any]] = []
    for row in rows:
        feat: dict[str, Any] = {
            "person_id": row["person_id"],
            "age_bucket": row["age_bucket"] or 0,
            "gender_concept_id": row["gender_concept_id"] or 0,
        }
        # Parse JSONB columns (asyncpg returns str for jsonb)
        for col in ("condition_concepts", "drug_concepts", "procedure_concepts", "lab_vector"):
            raw = row[col]
            if raw is None:
                feat[col] = {}
            elif isinstance(raw, str):
                try:
                    feat[col] = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    feat[col] = {}
            else:
                feat[col] = raw
        results.append(feat)
    return results


@router.post("/propensity-match", response_model=PropensityMatchResponse)
async def propensity_match(request: PropensityMatchRequest) -> PropensityMatchResponse:
    """Run propensity score matching between two cohorts.

    Fits L1-regularized logistic regression on OMOP covariates, matches
    patients within caliper, returns PS distribution and balance diagnostics.
    """
    if len(request.target_cohort_ids) < 10:
        raise HTTPException(
            status_code=422,
            detail=f"Target cohort too small ({len(request.target_cohort_ids)} patients). Need at least 10.",
        )
    if len(request.comparator_cohort_ids) < 10:
        raise HTTPException(
            status_code=422,
            detail=f"Comparator cohort too small ({len(request.comparator_cohort_ids)} patients). Need at least 10.",
        )

    try:
        pool = await _get_pool()

        # Fetch feature vectors for both cohorts
        target_features = await _fetch_feature_vectors(
            pool, request.source_id, request.target_cohort_ids,
        )
        comparator_features = await _fetch_feature_vectors(
            pool, request.source_id, request.comparator_cohort_ids,
        )

        if len(target_features) < 10:
            raise HTTPException(
                status_code=422,
                detail=f"Only {len(target_features)} target patients have feature vectors. Need at least 10.",
            )
        if len(comparator_features) < 10:
            raise HTTPException(
                status_code=422,
                detail=f"Only {len(comparator_features)} comparator patients have feature vectors. Need at least 10.",
            )

        svc = PropensityScoreService()

        # Build feature matrix
        feature_matrix, labels, feature_names = svc.build_feature_matrix(
            target_features, comparator_features,
        )

        # Fit model
        ps_scores, auc = svc.fit_propensity_model(feature_matrix, labels)

        n_target = len(target_features)
        n_comparator = len(comparator_features)
        prevalence = n_target / (n_target + n_comparator)

        # Preference scores
        pref_scores = svc.compute_preference_scores(ps_scores, prevalence)

        # Split PS/pref by group
        target_ps = ps_scores[:n_target]
        comparator_ps = ps_scores[n_target:]
        target_pref = pref_scores[:n_target]
        comparator_pref = pref_scores[n_target:]

        target_ids = np.array([f["person_id"] for f in target_features], dtype=np.int64)
        comparator_ids = np.array([f["person_id"] for f in comparator_features], dtype=np.int64)

        # Match patients
        matched_pairs, unmatched_target, unmatched_comparator = svc.match_patients(
            target_indices=target_ids,
            target_ps=target_ps,
            comparator_indices=comparator_ids,
            comparator_ps=comparator_ps,
            caliper_scale=request.caliper_scale,
            max_ratio=request.max_ratio,
        )

        # Compute caliper for reporting
        eps = 0.001
        all_ps_clipped = np.clip(ps_scores, eps, 1.0 - eps)
        all_logit = np.log(all_ps_clipped / (1.0 - all_ps_clipped))
        caliper = request.caliper_scale * float(np.std(all_logit)) if float(np.std(all_logit)) > 0 else 0.2

        # Build matched row indices for balance computation
        target_id_to_row = {int(tid): i for i, tid in enumerate(target_ids)}
        comp_id_to_row = {int(cid): i + n_target for i, cid in enumerate(comparator_ids)}

        matched_t_rows = np.array(
            [target_id_to_row[p["target_id"]] for p in matched_pairs if p["target_id"] in target_id_to_row],
            dtype=np.int64,
        )
        matched_c_rows = np.array(
            [comp_id_to_row[p["comparator_id"]] for p in matched_pairs if p["comparator_id"] in comp_id_to_row],
            dtype=np.int64,
        )

        # Balance diagnostics
        balance = svc.compute_balance(
            feature_matrix, labels, matched_t_rows, matched_c_rows, feature_names,
        )

        # Preference distribution
        pref_dist = svc.compute_preference_distribution(target_pref, comparator_pref)

        # Build propensity score items
        ps_items: list[PropensityScoreItem] = []
        for i, feat in enumerate(target_features):
            ps_items.append(PropensityScoreItem(
                person_id=feat["person_id"],
                ps=round(float(target_ps[i]), 6),
                preference_score=round(float(target_pref[i]), 6),
                cohort="target",
            ))
        for i, feat in enumerate(comparator_features):
            ps_items.append(PropensityScoreItem(
                person_id=feat["person_id"],
                ps=round(float(comparator_ps[i]), 6),
                preference_score=round(float(comparator_pref[i]), 6),
                cohort="comparator",
            ))

        return PropensityMatchResponse(
            propensity_scores=ps_items,
            matched_pairs=[MatchedPairItem(**p) for p in matched_pairs],
            balance={
                "before": [CovariateBalanceItem(**b) for b in balance["before"]],
                "after": [CovariateBalanceItem(**b) for b in balance["after"]],
            },
            model_metrics=ModelMetricsItem(
                auc=round(auc, 4),
                n_covariates=len(feature_names),
                n_target=n_target,
                n_comparator=n_comparator,
                caliper=round(caliper, 6),
            ),
            unmatched={
                "target_ids": unmatched_target,
                "comparator_ids": unmatched_comparator,
            },
            preference_distribution=PreferenceDistributionItem(**pref_dist),
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Propensity score matching failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Similarity Network Fusion (SNF)
# ---------------------------------------------------------------------------


class NetworkFusionRequest(BaseModel):
    source_id: int
    cohort_person_ids: list[int]
    n_neighbors: int = Field(default=20, ge=5, le=50)
    n_iterations: int = Field(default=20, ge=5, le=50)
    top_k_edges: int = Field(default=10, ge=3, le=50)


class FusedEdge(BaseModel):
    person_a: int
    person_b: int
    similarity: float


class FusedCommunity(BaseModel):
    id: int
    member_ids: list[int]
    size: int


class ModalityContribution(BaseModel):
    modality: str
    weight: float


class ConvergenceInfo(BaseModel):
    iterations: int
    final_delta: float


class NetworkFusionResponse(BaseModel):
    edges: list[FusedEdge]
    communities: list[FusedCommunity]
    modality_contributions: list[ModalityContribution]
    convergence: ConvergenceInfo
    n_patients: int
    capped_at: int | None = None


@router.post("/network-fusion", response_model=NetworkFusionResponse)
async def network_fusion_endpoint(request: NetworkFusionRequest) -> NetworkFusionResponse:
    """Run Similarity Network Fusion across clinical modalities.

    Builds per-modality similarity matrices (conditions, drugs, procedures, labs),
    iteratively fuses them via network diffusion, then detects communities on the
    fused network using spectral clustering.
    """
    if len(request.cohort_person_ids) < 10:
        raise HTTPException(
            status_code=422,
            detail=f"Cohort too small ({len(request.cohort_person_ids)} patients). Need at least 10 for SNF.",
        )

    try:
        pool = await _get_pool()
        result = await fuse_patient_network(
            pool=pool,
            source_id=request.source_id,
            person_ids=request.cohort_person_ids,
            n_neighbors=request.n_neighbors,
            n_iterations=request.n_iterations,
            top_k_edges=request.top_k_edges,
        )
        return NetworkFusionResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("SNF network fusion failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Temporal Similarity (DTW)
# ---------------------------------------------------------------------------


class TemporalSimilarityRequest(BaseModel):
    source_id: int
    person_a_id: int
    person_b_id: int
    source_schema: str = "omop"
    vocab_schema: str = "vocab"
    measurement_concept_ids: list[int] | None = None


@router.post("/temporal-similarity")
async def temporal_similarity_endpoint(request: TemporalSimilarityRequest) -> dict:
    """Compute DTW-based temporal trajectory similarity between two patients."""
    try:
        pool = await _get_pool()
        result = await compute_temporal_similarity(
            pool=pool,
            person_a_id=request.person_a_id,
            person_b_id=request.person_b_id,
            source_schema=request.source_schema,
            vocab_schema=request.vocab_schema,
            measurement_concept_ids=request.measurement_concept_ids,
        )
        return result
    except Exception as exc:
        logger.exception("Temporal similarity computation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Phenotype Discovery (Consensus Clustering)
# ---------------------------------------------------------------------------


class PhenotypeDiscoveryRequest(BaseModel):
    source_id: int
    cohort_person_ids: list[int]
    k: int | None = None
    method: str = Field(default="consensus", pattern="^(consensus|kmeans|spectral)$")


@router.post("/discover-phenotypes")
async def discover_phenotypes_endpoint(request: PhenotypeDiscoveryRequest) -> dict:
    """Discover latent patient subphenotypes via consensus clustering."""
    if len(request.cohort_person_ids) < 10:
        raise HTTPException(
            status_code=422,
            detail=f"Cohort too small ({len(request.cohort_person_ids)} patients). Need at least 10.",
        )

    try:
        pool = await _get_pool()
        result = await discover_phenotypes(
            pool=pool,
            source_id=request.source_id,
            person_ids=request.cohort_person_ids,
            k=request.k,
            method=request.method,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Phenotype discovery failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# UMAP Patient Landscape Projection
# ---------------------------------------------------------------------------


class PatientProjectionRequest(BaseModel):
    source_id: int
    person_ids: list[int] | None = None
    cohort_person_ids: list[int] | None = None
    dimensions: int = Field(default=3, ge=2, le=3)
    max_patients: int = Field(default=5000, ge=100, le=10000)


@router.post("/project")
async def project_patients_endpoint(request: PatientProjectionRequest) -> dict:
    """Project patient feature vectors to 2D/3D via PCA + UMAP."""
    try:
        pool = await _get_pool()

        # Determine which patients to project
        if request.person_ids:
            pids = request.person_ids
        else:
            # Sample from source
            rows = await pool.fetch(
                "SELECT person_id FROM app.patient_feature_vectors WHERE source_id = $1 ORDER BY random() LIMIT $2",
                request.source_id,
                request.max_patients,
            )
            pids = [r["person_id"] for r in rows]

        if len(pids) > request.max_patients:
            rng = np.random.RandomState(42)
            idx = rng.choice(len(pids), size=request.max_patients, replace=False)
            pids = [pids[i] for i in sorted(idx)]

        cohort_set = set(request.cohort_person_ids or [])

        # Fetch embeddings
        rows = await pool.fetch(
            """
            SELECT person_id, embedding, age_bucket, gender_concept_id
            FROM app.patient_feature_vectors
            WHERE source_id = $1 AND person_id = ANY($2::bigint[])
              AND embedding IS NOT NULL
            """,
            request.source_id,
            pids,
        )

        if len(rows) < 10:
            raise HTTPException(status_code=422, detail=f"Only {len(rows)} patients have embeddings. Need at least 10.")

        person_ids_ordered = []
        embeddings = []
        metadata = []
        for row in rows:
            pid = row["person_id"]
            person_ids_ordered.append(pid)
            emb_raw = row["embedding"]
            if isinstance(emb_raw, str):
                emb = [float(x) for x in emb_raw.strip("[]").split(",")]
            elif isinstance(emb_raw, (list, np.ndarray)):
                emb = [float(x) for x in emb_raw]
            else:
                emb = list(emb_raw)
            embeddings.append(emb)
            metadata.append({
                "person_id": pid,
                "age_bucket": row["age_bucket"] or 0,
                "gender_concept_id": row["gender_concept_id"] or 0,
                "is_cohort_member": pid in cohort_set,
            })

        emb_matrix = np.array(embeddings, dtype=np.float32)

        # PCA -> UMAP
        from sklearn.decomposition import PCA

        n_components_pca = min(50, emb_matrix.shape[1], emb_matrix.shape[0] - 1)
        pca = PCA(n_components=n_components_pca)
        reduced = pca.fit_transform(emb_matrix)

        import umap

        reducer = umap.UMAP(
            n_components=request.dimensions,
            n_neighbors=min(15, len(rows) - 1),
            min_dist=0.1,
            metric="cosine",
            random_state=42,
        )
        projected = reducer.fit_transform(reduced)

        # Normalize to [-1, 1]
        for dim in range(projected.shape[1]):
            col = projected[:, dim]
            p5, p95 = np.percentile(col, [5, 95])
            span = p95 - p5
            if span > 0:
                projected[:, dim] = np.clip((col - p5) / span * 2 - 1, -1, 1)

        # K-means clustering
        from sklearn.cluster import KMeans

        n_clusters = min(8, len(rows) // 10) if len(rows) > 30 else 2
        km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_ids = km.fit_predict(reduced)

        points = []
        for i, pid in enumerate(person_ids_ordered):
            pt = {
                "person_id": pid,
                "x": round(float(projected[i, 0]), 4),
                "y": round(float(projected[i, 1]), 4),
                "cluster_id": int(cluster_ids[i]),
                **metadata[i],
            }
            if request.dimensions == 3:
                pt["z"] = round(float(projected[i, 2]), 4)
            points.append(pt)

        return {
            "points": points,
            "n_patients": len(points),
            "dimensions": request.dimensions,
            "n_clusters": n_clusters,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Patient projection failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
