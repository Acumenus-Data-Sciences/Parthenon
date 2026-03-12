"""Conversation memory — stores and prunes per-user Q&A pairs in ChromaDB."""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from app.chroma.collections import get_user_conversation_collection

logger = logging.getLogger(__name__)


def store_conversation_turn(
    user_id: int,
    question: str,
    answer: str,
    page_context: str,
) -> None:
    """Embed a Q&A pair into the user's conversation collection."""
    collection = get_user_conversation_collection(user_id)
    doc_id = f"conv_{user_id}_{uuid.uuid4().hex[:12]}"
    document = f"Q: {question}\nA: {answer}"
    now = datetime.now(timezone.utc).isoformat()

    collection.add(
        ids=[doc_id],
        documents=[document],
        metadatas=[{
            "user_id": user_id,
            "page_context": page_context,
            "timestamp": now,
            "question_preview": question[:100],
        }],
    )
    logger.debug("Stored conversation turn for user %s: %s", user_id, doc_id)


def prune_old_conversations(user_id: int, ttl_days: int = 90) -> int:
    """Remove conversation entries older than ttl_days. Returns count removed."""
    collection = get_user_conversation_collection(user_id)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ttl_days)).isoformat()

    all_entries = collection.get(include=["metadatas"])
    old_ids: list[str] = []
    metadatas = all_entries.get("metadatas")
    if metadatas is None:
        return 0
    for entry_id, meta in zip(all_entries["ids"], metadatas):
        ts = str(meta.get("timestamp", ""))
        if ts and ts < cutoff:
            old_ids.append(entry_id)

    if old_ids:
        collection.delete(ids=old_ids)
        logger.info("Pruned %d old conversations for user %s", len(old_ids), user_id)

    return len(old_ids)
