"""ChromaDB management endpoints for ingestion, health checks, and Studio inspection."""
from __future__ import annotations

import logging
import os
import time
from collections import Counter

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.chroma.client import check_health, get_chroma_client
from app.chroma.ingestion import ingest_docs_directory
from app.chroma.faq import promote_frequent_questions
from app.chroma.memory import prune_old_conversations
from app.chroma.clinical import ingest_clinical_concepts
from app.services.projection import ProjectionResult

logger = logging.getLogger(__name__)
router = APIRouter()

DOCS_DIR = os.environ.get("DOCS_DIR", "/app/docs")


@router.get("/health")
async def chroma_health() -> dict:
    """Check ChromaDB connectivity."""
    return check_health()


@router.post("/ingest-docs")
async def ingest_docs() -> dict:
    """Trigger documentation ingestion into ChromaDB."""
    stats = ingest_docs_directory(DOCS_DIR)
    return stats


@router.post("/prune-conversations/{user_id}")
async def prune_conversations(user_id: int, ttl_days: int = 90) -> dict:
    """Prune conversation memory older than ttl_days for a user."""
    removed = prune_old_conversations(user_id, ttl_days)
    return {"user_id": user_id, "removed": removed, "ttl_days": ttl_days}


@router.post("/promote-faq")
async def promote_faq(days: int = 7) -> dict:
    """Run FAQ promotion on recent conversations."""
    return promote_frequent_questions(days)


@router.post("/ingest-clinical")
async def ingest_clinical(limit: int | None = None) -> dict:
    """Trigger clinical concept ingestion from OMOP vocabulary."""
    return ingest_clinical_concepts(limit=limit)


# ── Studio Inspection Endpoints ──────────────────────────────────────────────


@router.get("/collections")
async def list_collections() -> list[dict]:
    """List all ChromaDB collections with vector counts."""
    client = get_chroma_client()
    result = []
    for col in client.list_collections():
        result.append({
            "name": col.name,
            "count": col.count(),
            "metadata": col.metadata or {},
        })
    return result


SAMPLE_LIMIT = 250


@router.get("/collections/{name}/overview")
async def collection_overview(name: str, include_embeddings: bool = False) -> dict:
    """Get collection overview: count, sample records, facets, metadata keys.

    Embeddings are excluded by default to keep payload small (~1MB savings).
    Pass ?include_embeddings=true for the Semantic Map tab.
    """
    client = get_chroma_client()
    try:
        col = client.get_collection(name=name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Collection '{name}' not found.")

    count = col.count()
    if count == 0:
        return {
            "name": name,
            "count": 0,
            "dimension": None,
            "metadataKeys": [],
            "facets": [],
            "sampleRecords": [],
            "collectionMetadata": col.metadata or {},
        }

    from typing import Literal, cast
    IncludeType = Literal["documents", "embeddings", "metadatas", "distances", "uris", "data"]
    include: list[IncludeType] = ["documents", "metadatas"]
    if include_embeddings:
        include.append("embeddings")

    sample = col.get(
        limit=min(count, SAMPLE_LIMIT),
        include=include,
    )

    ids = sample.get("ids", [])
    documents: list[str | None] = sample.get("documents") or [None] * len(ids)  # type: ignore[assignment]
    metadatas: list[dict[str, object] | None] = sample.get("metadatas") or [None] * len(ids)  # type: ignore[assignment]
    embeddings = sample.get("embeddings") if include_embeddings else None

    # Detect dimension from first embedding
    dimension = None
    if embeddings is not None and len(embeddings) > 0:
        first_emb = embeddings[0]
        if first_emb is not None:
            emb_list = first_emb.tolist() if hasattr(first_emb, "tolist") else first_emb  # type: ignore[union-attr]
            if isinstance(emb_list, list):
                dimension = len(emb_list)
    elif not include_embeddings and count > 0:
        # Fetch just one embedding for dimension detection
        probe = col.get(limit=1, include=["embeddings"])
        probe_embs = probe.get("embeddings")
        if probe_embs is not None and len(probe_embs) > 0 and probe_embs[0] is not None:
            p = probe_embs[0]
            emb_list = p.tolist() if hasattr(p, "tolist") else p  # type: ignore[union-attr]
            if isinstance(emb_list, list):
                dimension = len(emb_list)

    # Build sample records
    records = []
    for i, doc_id in enumerate(ids):
        record: dict = {
            "id": doc_id,
            "document": documents[i] if documents is not None and i < len(documents) else None,
            "metadata": metadatas[i] if metadatas is not None and i < len(metadatas) else None,
        }
        if include_embeddings and embeddings is not None and i < len(embeddings):
            raw = embeddings[i]
            record["embedding"] = raw.tolist() if hasattr(raw, "tolist") else raw  # type: ignore[union-attr]
        records.append(record)

    # Compute facets from metadata
    all_keys: set[str] = set()
    key_counters: dict[str, Counter] = {}
    for meta in metadatas:
        if not meta:
            continue
        for k, v in meta.items():
            all_keys.add(k)
            if k not in key_counters:
                key_counters[k] = Counter()
            label = str(v) if not isinstance(v, str) else v
            key_counters[k][label] += 1

    facets = []
    for key in sorted(all_keys):
        counter = key_counters.get(key, Counter())
        top_values = counter.most_common(10)
        facets.append({
            "key": key,
            "values": [{"label": lbl, "count": cnt} for lbl, cnt in top_values],
        })

    return {
        "name": name,
        "count": count,
        "dimension": dimension,
        "metadataKeys": sorted(all_keys),
        "facets": facets,
        "sampleRecords": records,
        "collectionMetadata": col.metadata or {},
    }


class QueryInput(BaseModel):
    collectionName: str
    queryText: str
    nResults: int = 8
    where: dict | None = None
    whereDocument: dict | None = None


@router.post("/query")
async def query_collection(body: QueryInput) -> dict:
    """Semantic query against a named collection."""
    client = get_chroma_client()
    try:
        col = client.get_collection(name=body.collectionName)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Collection '{body.collectionName}' not found.")

    start = time.time()
    kwargs: dict = {
        "query_texts": [body.queryText],
        "n_results": min(body.nResults, col.count() or 1),
        "include": ["documents", "metadatas", "distances"],
    }
    if body.where:
        kwargs["where"] = body.where
    if body.whereDocument:
        kwargs["where_document"] = body.whereDocument

    results = col.query(**kwargs)
    elapsed_ms = round((time.time() - start) * 1000)

    items = []
    result_ids = results.get("ids", [[]])[0]
    result_docs = (results.get("documents") or [[]])[0]
    result_metas = (results.get("metadatas") or [[]])[0]
    result_dists = (results.get("distances") or [[]])[0]

    for i, doc_id in enumerate(result_ids):
        items.append({
            "id": doc_id,
            "document": result_docs[i] if i < len(result_docs) else None,
            "metadata": result_metas[i] if i < len(result_metas) else None,
            "distance": result_dists[i] if i < len(result_dists) else None,
        })

    return {"items": items, "elapsedMs": elapsed_ms}


class ProjectionInput(BaseModel):
    sample_size: int = 5000
    method: str = "pca-umap"
    dimensions: int = 3


@router.post("/collections/{name}/project")
async def project_collection(name: str, body: ProjectionInput) -> dict:
    """Compute 3D projection with clustering and quality analysis."""
    if body.method != "pca-umap":
        raise HTTPException(status_code=400, detail="Only 'pca-umap' method is supported.")
    if body.dimensions not in (2, 3):
        raise HTTPException(status_code=400, detail="Dimensions must be 2 or 3.")
    if body.sample_size != 0 and (body.sample_size < 500 or body.sample_size > 100000):
        raise HTTPException(status_code=400, detail="sample_size must be 0 (all) or 500-100000.")

    from app.services.projection import (
        cache_result,
        compute_projection,
        get_cached_projection,
        sample_deterministic,
    )
    import numpy as np

    client = get_chroma_client()
    try:
        col = client.get_collection(name=name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Collection '{name}' not found.")

    total_count = col.count()
    if total_count == 0:
        raise HTTPException(status_code=400, detail="Collection is empty.")

    # Check cache
    cached = get_cached_projection(name, body.sample_size, total_count)
    if cached is not None:
        return _result_to_dict(cached)

    # Fetch all embeddings for sampling
    all_data = col.get(limit=total_count, include=["embeddings", "metadatas"])
    all_ids = all_data.get("ids", [])
    all_embeddings = all_data.get("embeddings")
    all_metadatas = all_data.get("metadatas") or [{}] * len(all_ids)

    if all_embeddings is None or len(all_embeddings) == 0:
        raise HTTPException(status_code=400, detail="Collection has no embeddings.")

    # Sample deterministically
    indices = sample_deterministic(all_ids, body.sample_size, name, total_count)

    ids = [all_ids[i] for i in indices]
    raw_embeddings = [all_embeddings[i] for i in indices]
    metadatas = [all_metadatas[i] or {} for i in indices]

    embeddings_array = np.array(
        [e.tolist() if hasattr(e, "tolist") else e for e in raw_embeddings],
        dtype=np.float32,
    )

    if len(ids) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 vectors for projection.")

    result = compute_projection(ids, embeddings_array, metadatas, body.dimensions)

    # Update stats with total
    result.stats["total_vectors"] = total_count
    result.stats["sampled"] = len(ids)

    # Cache
    cache_result(name, body.sample_size, total_count, result)

    return _result_to_dict(result)


def _result_to_dict(result: ProjectionResult) -> dict:
    """Convert ProjectionResult dataclass to JSON-safe dict."""
    return {
        "points": [
            {"id": p.id, "x": p.x, "y": p.y, "z": p.z, "metadata": p.metadata, "cluster_id": p.cluster_id}
            for p in result.points
        ],
        "clusters": [
            {"id": c.id, "label": c.label, "centroid": c.centroid, "size": c.size}
            for c in result.clusters
        ],
        "quality": {
            "outlier_ids": result.quality.outlier_ids,
            "duplicate_pairs": [list(p) for p in result.quality.duplicate_pairs],
            "orphan_ids": result.quality.orphan_ids,
        },
        "stats": result.stats,
    }
