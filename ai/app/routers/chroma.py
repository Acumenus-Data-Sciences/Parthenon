"""ChromaDB management endpoints for ingestion and health checks."""
import logging
import os

from fastapi import APIRouter

from app.chroma.client import check_health
from app.chroma.ingestion import ingest_docs_directory
from app.chroma.faq import promote_frequent_questions
from app.chroma.memory import prune_old_conversations

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
