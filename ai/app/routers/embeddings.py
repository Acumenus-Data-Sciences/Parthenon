"""Embeddings router - SapBERT encoding and pgvector similarity search."""

from fastapi import APIRouter, HTTPException

from app.db import search_nearest
from app.models.schemas import (
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
    ConceptSearchRequest,
    ConceptSearchResponse,
    EmbeddingRequest,
    EmbeddingResponse,
)
from app.services.sapbert import get_sapbert_service

router = APIRouter()


@router.post("/encode", response_model=EmbeddingResponse)
async def encode_text(request: EmbeddingRequest) -> EmbeddingResponse:
    """Encode a single text into a 768-dim SapBERT embedding."""
    try:
        service = get_sapbert_service()
        embedding = service.encode_single(request.text)

        return EmbeddingResponse(
            embedding=embedding,
            model="cambridgeltl/SapBERT-from-PubMedBERT-fulltext",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encoding failed: {e}") from e


@router.post("/encode-batch", response_model=BatchEmbeddingResponse)
async def encode_batch(request: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
    """Encode a batch of texts into 768-dim SapBERT embeddings."""
    if len(request.texts) > 256:
        raise HTTPException(status_code=400, detail="Batch size must be <= 256")

    try:
        service = get_sapbert_service()
        embeddings = service.encode(request.texts)

        return BatchEmbeddingResponse(
            embeddings=embeddings,
            model="cambridgeltl/SapBERT-from-PubMedBERT-fulltext",
            count=len(embeddings),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch encoding failed: {e}") from e


@router.post("/search", response_model=ConceptSearchResponse)
async def similarity_search(request: ConceptSearchRequest) -> ConceptSearchResponse:
    """Search for similar concepts using SapBERT embeddings and pgvector."""
    try:
        service = get_sapbert_service()

        # Encode the query text
        query_embedding = service.encode_single(request.query)

        # Search pgvector for nearest neighbors
        results = search_nearest(query_embedding, top_k=request.top_k)

        candidates = [
            {
                "concept_id": r["concept_id"],
                "concept_name": str(r["concept_name"]),
                "domain_id": str(r.get("domain_id", "")),
                "vocabulary_id": str(r.get("vocabulary_id", "")),
                "score": float(r["similarity"]),
                "strategy": "sapbert_cosine",
            }
            for r in results
        ]

        return ConceptSearchResponse(
            query=request.query,
            candidates=candidates,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Similarity search failed: {e}"
        ) from e
