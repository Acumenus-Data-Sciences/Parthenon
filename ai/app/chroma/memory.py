"""Conversation memory — stores and prunes per-user Q&A pairs in ChromaDB.

Abby chat memory is stored in a shared Chroma collection filtered by ``user_id``.
Commons discussion messages are stored separately in a unified public
``conversations`` collection.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import chromadb

from app.chroma.client import get_chroma_client
from app.chroma.collections import (
    CONVERSATION_MEMORY_COLLECTION,
    get_conversation_memory_collection,
)

logger = logging.getLogger(__name__)

CONVERSATIONS_COLLECTION = "conversations"


def _get_unified_collection() -> chromadb.Collection:
    """Get or create the unified conversations collection."""
    from app.chroma.embeddings import get_general_embedder

    client = get_chroma_client()
    return client.get_or_create_collection(
        name=CONVERSATIONS_COLLECTION,
        embedding_function=get_general_embedder(),  # type: ignore[arg-type]
        metadata={"hnsw:space": "cosine"},
    )


def store_conversation_turn(
    user_id: int,
    question: str,
    answer: str,
    page_context: str,
) -> None:
    """Embed a Q&A pair into Abby's shared conversation-memory collection."""
    doc_id = f"conv_{user_id}_{uuid.uuid4().hex[:12]}"
    document = f"Q: {question}\nA: {answer}"
    now = datetime.now(timezone.utc).isoformat()

    metadata: dict[str, Any] = {
        "user_id": user_id,
        "page_context": page_context,
        "timestamp": now,
        "question_preview": question[:100],
        "source": "abby_chat",
    }

    conversation_memory = get_conversation_memory_collection()
    existing = conversation_memory.get(
        where={"user_id": user_id},
        include=["documents"],
    )
    existing_documents = existing.get("documents") or []
    if document in existing_documents:
        logger.debug("Skipping duplicate conversation turn for user %s", user_id)
        return

    conversation_memory.upsert(
        ids=[doc_id],
        documents=[document],
        metadatas=[metadata],
    )

    logger.debug("Stored conversation turn for user %s: %s", user_id, doc_id)


def store_commons_message(
    user_id: int,
    user_name: str,
    channel_name: str,
    message_id: int,
    body: str,
    parent_id: int | None = None,
) -> None:
    """Index a Commons discussion message into the unified conversations collection.

    Called by the Laravel backend whenever a message is created in Commons.
    Messages are stored in the unified collection only (not per-user) since
    they represent public/shared discussion, not personal Q&A memory.
    """
    doc_id = f"commons_{message_id}"
    now = datetime.now(timezone.utc).isoformat()

    # For thread replies, prefix with context
    document = body if not parent_id else f"[reply to #{parent_id}] {body}"

    metadata: dict[str, Any] = {
        "user_id": user_id,
        "user_name": user_name,
        "channel": channel_name,
        "message_id": message_id,
        "timestamp": now,
        "source": "commons",
        "question_preview": body[:100],
    }
    if parent_id:
        metadata["parent_id"] = parent_id

    unified = _get_unified_collection()
    unified.upsert(
        ids=[doc_id],
        documents=[document],
        metadatas=[metadata],
    )
    logger.debug("Indexed Commons message %d from user %s in #%s", message_id, user_name, channel_name)


def delete_commons_message(message_id: int) -> None:
    """Remove a soft-deleted Commons message from the unified collection."""
    doc_id = f"commons_{message_id}"
    unified = _get_unified_collection()
    try:
        unified.delete(ids=[doc_id])
        logger.debug("Deleted Commons message %d from conversations", message_id)
    except Exception:
        pass  # Not found is fine — idempotent


def prune_old_conversations(user_id: int, ttl_days: int = 90) -> int:
    """Remove conversation entries older than ttl_days. Returns count removed."""
    collection = get_conversation_memory_collection()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ttl_days)).isoformat()

    all_entries = collection.get(
        where={"user_id": user_id},
        include=["metadatas"],
    )
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


def aggregate_conversations() -> dict[str, int]:
    """Backfill legacy per-user collections into shared conversation memory.

    New Abby conversations are stored directly in the shared collection.
    This keeps the old migration endpoint useful for legacy data only.

    Returns stats: {"users": N, "total": N, "upserted": N}
    """
    client = get_chroma_client()
    target = get_conversation_memory_collection()

    stats: dict[str, int] = {"users": 0, "total": 0, "upserted": 0}

    for coll in client.list_collections():
        if not coll.name.startswith("conversations_user_"):
            continue

        try:
            user_id = int(coll.name.split("_")[-1])
        except ValueError:
            continue

        stats["users"] += 1
        entries = coll.get(include=["documents", "metadatas"])
        ids = entries.get("ids", [])
        docs = entries.get("documents") or []
        metas = entries.get("metadatas") or []

        if not ids:
            continue

        stats["total"] += len(ids)

        # Preserve IDs when migrating into the shared collection.
        agg_ids = list(ids)
        agg_metas: list[dict[str, Any]] = []
        for meta in metas:
            m = dict(meta) if meta else {}
            m["user_id"] = user_id
            if "source" not in m:
                m["source"] = "abby_chat"
            agg_metas.append(m)

        batch_size = 500
        for i in range(0, len(agg_ids), batch_size):
            end = i + batch_size
            target.upsert(
                ids=agg_ids[i:end],
                documents=docs[i:end],
                metadatas=agg_metas[i:end],  # type: ignore[arg-type]
            )
            stats["upserted"] += len(agg_ids[i:end])

    logger.info("Aggregated conversations: %s", stats)
    return stats
