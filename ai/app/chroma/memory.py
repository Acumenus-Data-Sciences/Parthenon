"""Conversation memory — stores and prunes per-user Q&A pairs in ChromaDB.

All conversation turns (Abby chat) and Commons discussion messages are
automatically written to BOTH the per-user collection and the unified
'conversations' collection for cross-user retrieval and FAQ promotion.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import chromadb

from app.chroma.client import get_chroma_client
from app.chroma.collections import get_user_conversation_collection

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
    """Embed a Q&A pair into both the per-user and unified collections."""
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

    # Write to per-user collection
    user_collection = get_user_conversation_collection(user_id)
    user_collection.add(
        ids=[doc_id],
        documents=[document],
        metadatas=[metadata],
    )

    # Write to unified collection (continuous aggregation)
    unified = _get_unified_collection()
    unified.upsert(
        ids=[f"agg_{doc_id}"],
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


def aggregate_conversations() -> dict[str, int]:
    """Backfill: merge all per-user conversation collections into the unified collection.

    This is a one-time catch-up for conversations created before continuous
    write-through was added. New conversations are automatically dual-written.

    Returns stats: {"users": N, "total": N, "upserted": N}
    """
    client = get_chroma_client()
    target = _get_unified_collection()

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

        # Prefix IDs to avoid collisions
        agg_ids = [f"agg_{eid}" for eid in ids]
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
