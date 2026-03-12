"""ChromaDB management endpoints for ingestion, health checks, and Studio inspection."""
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
            "document": documents[i] if documents else None,
            "metadata": metadatas[i] if metadatas else None,
        }
        if include_embeddings and embeddings and i < len(embeddings):
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
