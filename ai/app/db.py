"""Database module for pgvector similarity search.

Provides SQLAlchemy engine and concept embedding search functionality.
"""

import logging
from contextlib import contextmanager
from typing import Generator

from pgvector.sqlalchemy import Vector  # type: ignore[import-untyped]
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# Schema-qualified metadata for vocab schema
vocab_metadata = MetaData(schema="vocab")

# concept_embeddings table definition
concept_embeddings_table = Table(
    "concept_embeddings",
    vocab_metadata,
    Column("concept_id", Integer, primary_key=True),
    Column("concept_name", String(255)),
    Column("embedding", Vector(768)),
)

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Get or create the SQLAlchemy engine."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.database_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Get or create the session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine())
    return _session_factory


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager for database sessions."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def search_nearest(
    embedding: list[float],
    top_k: int = 10,
) -> list[dict[str, object]]:
    """Search for nearest concept embeddings using cosine distance.

    Args:
        embedding: Query vector (768-dim).
        top_k: Number of results to return.

    Returns:
        List of dicts with concept_id, concept_name, and similarity score.
    """
    with get_session() as session:
        # Use pgvector cosine distance operator <=>
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        results = session.execute(
            text("""
                SELECT
                    ce.concept_id,
                    ce.concept_name,
                    1 - (ce.embedding <=> :embedding::vector) as similarity,
                    c.domain_id,
                    c.vocabulary_id,
                    c.standard_concept
                FROM vocab.concept_embeddings ce
                JOIN vocab.concepts c ON c.concept_id = ce.concept_id
                ORDER BY ce.embedding <=> :embedding::vector
                LIMIT :top_k
            """),
            {"embedding": embedding_str, "top_k": top_k},
        )

        return [
            {
                "concept_id": row.concept_id,
                "concept_name": row.concept_name,
                "similarity": float(row.similarity),
                "domain_id": row.domain_id,
                "vocabulary_id": row.vocabulary_id,
                "standard_concept": row.standard_concept,
            }
            for row in results
        ]
