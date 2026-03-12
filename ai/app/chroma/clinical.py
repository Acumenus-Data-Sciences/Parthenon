"""Clinical reference ingestion — embeds OMOP concepts via SapBERT into ChromaDB.

Queries vocab.concept for high-value domains (Condition, Drug, Procedure, Measurement)
and upserts into the clinical_reference collection.
"""
import logging
from typing import Any

from sqlalchemy import text

from app.chroma.collections import get_clinical_collection
from app.db import get_session

logger = logging.getLogger(__name__)

TARGET_DOMAINS = ("Condition", "Drug", "Procedure", "Measurement")


def ingest_clinical_concepts(
    batch_size: int = 500,
    limit: int | None = None,
) -> dict[str, int]:
    """Ingest standard OMOP concepts into the clinical reference collection.

    Queries vocab.concept for standard concepts in target domains,
    embeds concept names via SapBERT, and upserts into ChromaDB.

    Returns stats: {"total": N, "batches": N}
    """
    collection = get_clinical_collection()
    stats = {"total": 0, "batches": 0}

    if limit:
        query = text("""
            SELECT concept_id, concept_name, domain_id, vocabulary_id
            FROM vocab.concept
            WHERE standard_concept = 'S'
            AND domain_id IN :domains
            AND concept_name IS NOT NULL
            AND LENGTH(concept_name) > 2
            ORDER BY concept_id
            LIMIT :limit
        """)
    else:
        query = text("""
            SELECT concept_id, concept_name, domain_id, vocabulary_id
            FROM vocab.concept
            WHERE standard_concept = 'S'
            AND domain_id IN :domains
            AND concept_name IS NOT NULL
            AND LENGTH(concept_name) > 2
            ORDER BY concept_id
        """)

    with get_session() as session:
        params: dict[str, Any] = {"domains": TARGET_DOMAINS}
        if limit:
            params["limit"] = limit
        rows = session.execute(query, params).fetchall()

    logger.info("Found %d concepts to ingest", len(rows))

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        ids = [f"concept_{row[0]}" for row in batch]
        documents = [row[1] for row in batch]
        metadatas: list[dict[str, Any]] = [
            {
                "concept_id": row[0],
                "domain": row[2],
                "vocabulary_id": row[3],
            }
            for row in batch
        ]

        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,  # type: ignore[arg-type]
        )

        stats["batches"] += 1
        stats["total"] += len(batch)
        logger.info("Ingested batch %d: %d concepts", stats["batches"], len(batch))

    logger.info("Clinical ingestion complete: %s", stats)
    return stats
