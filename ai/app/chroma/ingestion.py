"""Document ingestion pipeline for ChromaDB.

Handles chunking, hashing, and upserting documentation into the docs collection.
Uses content-hash-based deduplication to avoid re-embedding unchanged files.
"""
import hashlib
import logging
from pathlib import Path

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from app.chroma.collections import get_docs_collection

logger = logging.getLogger(__name__)

MARKDOWN_HEADERS = [
    ("#", "h1"),
    ("##", "h2"),
    ("###", "h3"),
]


def content_hash(text: str) -> str:
    """Deterministic SHA-256 hash of text content."""
    return hashlib.sha256(text.encode()).hexdigest()


def chunk_markdown(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[str]:
    """Split markdown into chunks respecting header boundaries."""
    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=MARKDOWN_HEADERS,
        strip_headers=False,
    )
    md_chunks = md_splitter.split_text(text)

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )

    final_chunks: list[str] = []
    for doc in md_chunks:
        content = doc.page_content
        if len(content) > chunk_size:
            sub_chunks = text_splitter.split_text(content)
            final_chunks.extend(sub_chunks)
        else:
            final_chunks.append(content)

    return [c for c in final_chunks if c.strip()]


def ingest_docs_directory(docs_dir: str) -> dict[str, int]:
    """Ingest all markdown files from a directory into the docs collection.

    Uses content hashing to skip unchanged files.
    Returns stats: {"ingested": N, "skipped": N, "chunks": N}
    """
    collection = get_docs_collection()
    docs_path = Path(docs_dir)
    stats = {"ingested": 0, "skipped": 0, "chunks": 0}

    if not docs_path.exists():
        logger.warning("Docs directory not found: %s", docs_dir)
        return stats

    md_files = sorted(docs_path.rglob("*.md"))
    logger.info("Found %d markdown files in %s", len(md_files), docs_dir)

    for filepath in md_files:
        try:
            text = filepath.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning("Failed to read %s: %s", filepath, e)
            continue

        file_hash = content_hash(text)
        relative_path = str(filepath.relative_to(docs_path))

        # Check if any existing chunk has this file hash (means unchanged)
        existing = collection.get(
            where={"source": relative_path},
            include=[],
        )
        existing_ids = existing.get("ids", [])
        if existing_ids and any(file_hash in eid for eid in existing_ids):
            stats["skipped"] += 1
            continue

        # Delete old chunks for this file before upserting new ones
        if existing_ids:
            collection.delete(ids=existing_ids)

        # Chunk and upsert
        chunks = chunk_markdown(text)
        if not chunks:
            continue

        ids = [f"{relative_path}::{i}::{file_hash}" for i in range(len(chunks))]
        metadatas = [
            {
                "source": relative_path,
                "chunk_index": i,
                "version": file_hash[:8],
            }
            for i in range(len(chunks))
        ]

        collection.upsert(
            ids=ids,
            documents=chunks,
            metadatas=metadatas,
        )

        stats["ingested"] += 1
        stats["chunks"] += len(chunks)
        logger.info("Ingested %s: %d chunks", relative_path, len(chunks))

    logger.info("Ingestion complete: %s", stats)
    return stats
