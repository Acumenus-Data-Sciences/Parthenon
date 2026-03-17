"""One-time migration: export ChromaDB conversation collections to PostgreSQL.

Usage: python -m scripts.migrate_chroma_to_pg [--dry-run] [--user-id N]

Reads from ChromaDB per-user collections (conversations_user_{id}) and writes
embeddings to the abby_messages.embedding column in PostgreSQL.
"""
import argparse
import logging
import sys

from sqlalchemy import create_engine, text

from app.config import settings
from app.chroma.client import get_chroma_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def migrate_user_collection(chroma_client, engine, user_id: int, dry_run: bool = False) -> dict:
    """Migrate a single user's ChromaDB collection to PostgreSQL embeddings."""
    collection_name = f"conversations_user_{user_id}"
    stats = {"user_id": user_id, "chroma_count": 0, "matched": 0, "updated": 0, "errors": 0}

    try:
        collection = chroma_client.get_collection(collection_name)
    except Exception:
        logger.info(f"No collection found for user {user_id}, skipping")
        return stats

    results = collection.get(include=["documents", "embeddings", "metadatas"])
    stats["chroma_count"] = len(results["ids"])

    if dry_run:
        logger.info(f"[DRY RUN] User {user_id}: {stats['chroma_count']} documents would be migrated")
        return stats

    with engine.connect() as conn:
        for i, doc_id in enumerate(results["ids"]):
            try:
                content = results["documents"][i]
                embedding = results["embeddings"][i]

                if not embedding or not content:
                    continue

                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

                result = conn.execute(
                    text("""
                        UPDATE app.abby_messages m
                        SET embedding = :embedding::vector,
                            embedding_model = 'all-MiniLM-L6-v2'
                        FROM app.abby_conversations c
                        WHERE m.conversation_id = c.id
                          AND c.user_id = :user_id
                          AND m.content = :content
                          AND m.embedding IS NULL
                    """),
                    {
                        "embedding": embedding_str,
                        "user_id": user_id,
                        "content": content[:10000],
                    },
                )
                if result.rowcount > 0:
                    stats["updated"] += result.rowcount
                stats["matched"] += 1

            except Exception as e:
                stats["errors"] += 1
                logger.warning(f"Error migrating doc {doc_id} for user {user_id}: {e}")

        conn.commit()

    logger.info(
        f"User {user_id}: {stats['chroma_count']} in ChromaDB, "
        f"{stats['matched']} matched, {stats['updated']} updated, "
        f"{stats['errors']} errors"
    )
    return stats


def main():
    parser = argparse.ArgumentParser(description="Migrate ChromaDB conversations to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without writing")
    parser.add_argument("--user-id", type=int, help="Migrate a specific user only")
    args = parser.parse_args()

    engine = create_engine(settings.database_url)
    chroma_client = get_chroma_client()

    if args.user_id:
        user_ids = [args.user_id]
    else:
        collections = chroma_client.list_collections()
        user_ids = []
        for col in collections:
            name = col.name if hasattr(col, "name") else str(col)
            if name.startswith("conversations_user_"):
                try:
                    uid = int(name.replace("conversations_user_", ""))
                    user_ids.append(uid)
                except ValueError:
                    continue

    logger.info(f"Found {len(user_ids)} user collections to migrate")

    total_stats = {"total_chroma": 0, "total_updated": 0, "total_errors": 0}
    for user_id in sorted(user_ids):
        stats = migrate_user_collection(chroma_client, engine, user_id, dry_run=args.dry_run)
        total_stats["total_chroma"] += stats["chroma_count"]
        total_stats["total_updated"] += stats["updated"]
        total_stats["total_errors"] += stats["errors"]

    logger.info(f"\n=== Migration Summary ===")
    logger.info(f"Users processed: {len(user_ids)}")
    logger.info(f"ChromaDB documents: {total_stats['total_chroma']}")
    logger.info(f"PostgreSQL updated: {total_stats['total_updated']}")
    logger.info(f"Errors: {total_stats['total_errors']}")

    if total_stats["total_errors"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
