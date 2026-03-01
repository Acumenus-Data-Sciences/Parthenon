from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/encode")
async def encode_text(text: str) -> dict[str, Any]:
    raise HTTPException(status_code=501, detail="Not yet implemented - requires SapBERT model")


@router.post("/search")
async def similarity_search(query: str, top_k: int = 10) -> dict[str, Any]:
    raise HTTPException(status_code=501, detail="Not yet implemented - requires pgvector embeddings")
