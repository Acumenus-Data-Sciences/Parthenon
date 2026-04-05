from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.services.ollama_client import check_ollama_health

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, Any]:
    ollama_status = await check_ollama_health(
        base_url=settings.abby_llm_base_url,
        model=settings.abby_llm_model,
    )
    return {
        "status": "ok",
        "service": "parthenon-ai",
        "version": "0.1.0",
        "llm": {
            "provider": "ollama",
            "model": settings.abby_llm_model,
            "base_url": settings.abby_llm_base_url,
            "status": ollama_status,
        },
    }
