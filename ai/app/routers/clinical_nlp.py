from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/extract")
async def extract_entities(text: str) -> dict[str, Any]:
    raise HTTPException(status_code=501, detail="Not yet implemented - requires MedCAT model")
