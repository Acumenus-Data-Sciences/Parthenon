"""FAQ promotion — clusters frequent questions and promotes to shared FAQ collection.

Nightly batch job scans recent conversations, finds semantically similar questions,
and promotes clusters that meet the threshold (>= 5 occurrences, >= 3 distinct users).
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from app.chroma.collections import get_faq_collection
from app.chroma.client import get_chroma_client

logger = logging.getLogger(__name__)

MIN_FREQUENCY = 5
MIN_USERS = 3
SIMILARITY_THRESHOLD = 0.85


def _scan_recent_conversations(days: int = 7) -> list[dict]:
    """Scan all user conversation collections for recent Q&A pairs."""
    client = get_chroma_client()
    all_collections = client.list_collections()
    recent_pairs: list[dict] = []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    for coll in all_collections:
        if not coll.name.startswith("conversations_user_"):
            continue
        try:
            user_id = int(coll.name.split("_")[-1])
        except ValueError:
            continue

        entries = coll.get(include=["documents", "metadatas"])
        for doc, meta in zip(entries.get("documents", []), entries.get("metadatas", [])):
            ts = meta.get("timestamp", "")
            if ts >= cutoff:
                lines = doc.split("\n", 1)
                question = lines[0].removeprefix("Q: ") if lines else doc
                answer = lines[1].removeprefix("A: ") if len(lines) > 1 else ""
                recent_pairs.append({
                    "question": question,
                    "answer": answer,
                    "user_id": user_id,
                })

    return recent_pairs


def promote_frequent_questions(days: int = 7) -> dict[str, int]:
    """Scan recent conversations and promote frequent Q&A pairs to FAQ.

    Returns stats: {"scanned": N, "promoted": N}
    """
    pairs = _scan_recent_conversations(days)
    stats = {"scanned": len(pairs), "promoted": 0}

    if len(pairs) < MIN_FREQUENCY:
        return stats

    faq_collection = get_faq_collection()

    # Simple clustering: group by first question, then check similarity
    clusters: list[dict] = []

    for pair in pairs:
        matched = False
        for cluster in clusters:
            # Check if question is similar to cluster representative
            try:
                results = faq_collection.query(
                    query_texts=[pair["question"]],
                    n_results=1,
                )
                if results["distances"][0] and results["distances"][0][0] < (1 - SIMILARITY_THRESHOLD):
                    cluster["answers"].append(pair["answer"])
                    cluster["user_ids"].add(pair["user_id"])
                    matched = True
                    break
            except Exception:
                pass

        if not matched:
            clusters.append({
                "question": pair["question"],
                "answers": [pair["answer"]],
                "user_ids": {pair["user_id"]},
            })

    # Promote clusters meeting thresholds
    for cluster in clusters:
        freq = len(cluster["answers"])
        user_count = len(cluster["user_ids"])
        if freq >= MIN_FREQUENCY and user_count >= MIN_USERS:
            canonical_answer = cluster["answers"][0]
            doc = f"Q: {cluster['question']}\nA: {canonical_answer}"
            doc_id = f"faq_{uuid.uuid4().hex[:12]}"

            faq_collection.upsert(
                ids=[doc_id],
                documents=[doc],
                metadatas=[{
                    "frequency": freq,
                    "source_users_count": user_count,
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "source": "auto_promoted",
                }],
            )
            stats["promoted"] += 1
            logger.info("Promoted FAQ: %s (freq=%d, users=%d)", cluster["question"][:50], freq, user_count)

    return stats
