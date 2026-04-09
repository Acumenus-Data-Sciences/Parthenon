"""Clinical reference ingestion — embeds OMOP concepts via SapBERT into ChromaDB.

Queries the OMOP vocabulary concept table for high-value domains
(Condition, Drug, Procedure, Measurement) and upserts into the
clinical_reference collection.
"""
import logging
import os
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.chroma.client import get_chroma_client
from app.chroma.collections import get_clinical_collection
from app.chroma.collections import clear_cached_collection
from app.config import settings

logger = logging.getLogger(__name__)

TARGET_DOMAINS = ("Condition", "Drug", "Procedure", "Measurement")


def _upsert_clinical_batch_resilient(
    collection: Any,
    ids: list[str],
    documents: list[str],
    metadatas: list[dict[str, Any]],
) -> None:
    """Retry large clinical upserts with smaller sub-batches on transient failures."""
    if not ids:
        return

    try:
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,  # type: ignore[arg-type]
        )
        return
    except Exception as exc:
        if len(ids) <= 1:
            raise
        midpoint = max(1, len(ids) // 2)
        logger.warning(
            "Clinical upsert failed for batch size %d; retrying in smaller chunks: %s",
            len(ids),
            exc,
        )
        _upsert_clinical_batch_resilient(
            collection,
            ids[:midpoint],
            documents[:midpoint],
            metadatas[:midpoint],
        )
        _upsert_clinical_batch_resilient(
            collection,
            ids[midpoint:],
            documents[midpoint:],
            metadatas[midpoint:],
        )


def _get_vocab_engine() -> Engine:
    """Get engine for the database containing OMOP vocabulary data.

    Uses GIS_DATABASE_URL (local PG with omop schema) if available,
    otherwise falls back to the default DATABASE_URL.
    """
    url = os.getenv("GIS_DATABASE_URL", settings.database_url)
    return create_engine(url, pool_size=2, pool_pre_ping=True)


def ingest_clinical_concepts(
    batch_size: int = 500,
    limit: int | None = None,
    start_offset: int = 0,
) -> dict[str, int]:
    """Ingest standard OMOP concepts into the clinical reference collection.

    Queries the OMOP concept table for standard concepts in target domains,
    embeds concept names via SapBERT, and upserts into ChromaDB.

    Returns stats: {"total": N, "batches": N}
    """
    collection = get_clinical_collection()
    stats = {"total": 0, "batches": 0}

    schema = settings.ariadne_vocab_schema  # typically "omop"

    # Exclude RxNorm Extension (1.87M NDC/pack variants) — too many for HNSW,
    # and Abby doesn't need NDC-level granularity for cohort expression translation.
    # RxNorm core (153K ingredients/clinical drugs/branded drugs) is sufficient.
    base_query = f"""
        SELECT concept_id, concept_name, domain_id, vocabulary_id, concept_class_id
        FROM {schema}.concept
        WHERE standard_concept = 'S'
        AND domain_id IN :domains
        AND concept_name IS NOT NULL
        AND LENGTH(concept_name) > 2
        AND vocabulary_id != 'RxNorm Extension'
        ORDER BY concept_id
    """
    if limit:
        base_query += " LIMIT :limit"

    engine = _get_vocab_engine()
    with engine.connect() as conn:
        params: dict[str, Any] = {"domains": TARGET_DOMAINS}
        if limit:
            params["limit"] = limit
        rows = conn.execute(text(base_query), params).fetchall()

    if start_offset > 0:
        rows = rows[start_offset:]
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
                "concept_class_id": row[4],
                "category": row[2],
                "source": "clinical_reference",
                "source_type": "omop_concept",
                "type": "clinical_concept",
            }
            for row in batch
        ]

        _upsert_clinical_batch_resilient(
            collection,
            ids,
            documents,
            metadatas,
        )

        stats["batches"] += 1
        stats["total"] += len(batch)
        logger.info("Ingested batch %d: %d concepts", stats["batches"], len(batch))

    logger.info("Clinical ingestion complete: %s", stats)
    return stats


def rebuild_clinical_concepts(
    batch_size: int = 500,
    limit: int | None = None,
    start_offset: int = 0,
) -> dict[str, int]:
    """Recreate the clinical_reference collection from the current OMOP source of truth."""
    if start_offset <= 0:
        client = get_chroma_client()
        try:
            client.delete_collection("clinical_reference")
        except Exception:
            pass
        clear_cached_collection("clinical_reference")
    return ingest_clinical_concepts(batch_size=batch_size, limit=limit, start_offset=start_offset)
