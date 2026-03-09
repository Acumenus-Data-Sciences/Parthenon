"""ChromaDB client singleton and health check."""
import logging

import chromadb

from app.config import settings

logger = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None


def get_chroma_client() -> chromadb.ClientAPI:
    """Return a singleton ChromaDB HTTP client."""
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
        logger.info("Connected to ChromaDB at %s:%s", settings.chroma_host, settings.chroma_port)
    return _client


def check_health() -> dict[str, object]:
    """Check ChromaDB connectivity. Returns status dict."""
    try:
        client = get_chroma_client()
        heartbeat = client.heartbeat()
        return {"status": "ok", "heartbeat": heartbeat}
    except Exception as e:
        logger.warning("ChromaDB health check failed: %s", e)
        return {"status": "error", "error": str(e)}
