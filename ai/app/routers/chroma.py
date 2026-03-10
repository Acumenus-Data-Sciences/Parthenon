"""ChromaDB management endpoints for ingestion and health checks."""
import logging
import os

from fastapi import APIRouter

from app.chroma.client import check_health
from app.chroma.ingestion import ingest_docs_directory

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
