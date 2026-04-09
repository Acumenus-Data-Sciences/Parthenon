"""Document ingestion pipeline for ChromaDB.

Handles chunking, hashing, and upserting documentation into the docs collection.
Also handles OHDSI research paper ingestion from PDF-extracted JSONL.
Uses content-hash-based deduplication to avoid re-embedding unchanged files.
"""
import hashlib
import json
import logging
import re
import csv
from pathlib import Path
from typing import Any

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from app.chroma.collections import (
    get_docs_collection,
    get_medical_textbooks_collection,
    get_ohdsi_papers_collection,
)
from app.chroma.docs_taxonomy import derive_docs_taxonomy, should_skip_docs_path
from app.chroma.quality import audit_document

logger = logging.getLogger(__name__)

MARKDOWN_HEADERS = [
    ("#", "h1"),
    ("##", "h2"),
    ("###", "h3"),
]
_UPPERCASE_TITLE_WORDS = {"cdm", "dna", "faq", "fda", "hgvs", "hipaa", "ncbi", "ohdsi", "omop", "rna"}
SOURCE_DOCUMENT_TYPES = {
    "book_of_ohdsi": "book_chapter",
    "hades_vignette": "vignette",
    "ohdsi_forums": "forum_thread",
    "ohdsi_corpus": "research_paper",
    "medical_textbook": "textbook_excerpt",
}


def _upsert_resilient(
    collection: Any,
    ids: list[str],
    documents: list[str],
    metadatas: list[dict[str, str | int | float | bool]],
    chunk_size: int,
) -> None:
    """Upsert batches with recursive fallback to smaller chunks on failure."""
    if not ids:
        return

    start = 0
    while start < len(ids):
        end = min(start + chunk_size, len(ids))
        try:
            collection.upsert(
                ids=ids[start:end],
                documents=documents[start:end],
                metadatas=metadatas[start:end],  # type: ignore[arg-type]
            )
            start = end
        except Exception as exc:
            current_size = end - start
            if current_size <= 1:
                raise

            smaller_chunk = max(1, current_size // 2)
            logger.warning(
                "Upsert failed for batch size %d; retrying in chunks of %d: %s",
                current_size,
                smaller_chunk,
                exc,
            )
            _upsert_resilient(
                collection,
                ids[start:end],
                documents[start:end],
                metadatas[start:end],
                smaller_chunk,
            )
            start = end


def content_hash(text: str) -> str:
    """Deterministic SHA-256 hash of text content."""
    return hashlib.sha256(text.encode()).hexdigest()


def _split_markdown_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Parse a simple leading YAML frontmatter block and return the remaining body."""
    if not text.startswith("---\n"):
        return {}, text

    match = re.match(r"^---\n(.*?)\n---\n?", text, flags=re.DOTALL)
    if not match:
        return {}, text

    metadata: dict[str, str] = {}
    for line in match.group(1).splitlines():
        key, _, raw_value = line.partition(":")
        if not key or not raw_value:
            continue
        value = raw_value.strip().strip("\"'")
        metadata[key.strip()] = value

    return metadata, text[match.end():]


def _humanize_path_stem(path: str) -> str:
    """Turn a file stem like `omop-common-data-model` into a readable title."""
    stem = Path(path).stem
    words = re.sub(r"[_-]+", " ", stem).strip().split()
    return " ".join(
        word.upper() if word.lower() in _UPPERCASE_TITLE_WORDS else word.capitalize()
        for word in words
    ) or stem


def _extract_markdown_title(text: str, fallback_path: str) -> str:
    """Prefer the first H1 in a markdown file; otherwise fall back to the filename."""
    frontmatter, body = _split_markdown_frontmatter(text)
    if frontmatter.get("title"):
        return frontmatter["title"]

    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return _humanize_path_stem(fallback_path)


def chunk_markdown_records(
    text: str,
    *,
    fallback_path: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[dict[str, str]]:
    """Split markdown into chunks while preserving heading-derived metadata."""
    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=MARKDOWN_HEADERS,
        strip_headers=False,
    )

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )

    file_title = _extract_markdown_title(text, fallback_path)
    _, body = _split_markdown_frontmatter(text)
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.DOTALL)
    final_chunks: list[dict[str, str]] = []
    for doc in md_splitter.split_text(body):
        content = doc.page_content.strip()
        if not content:
            continue

        headers = {str(key): str(value).strip() for key, value in doc.metadata.items() if value}
        title = headers.get("h1") or file_title
        section = headers.get("h2") or ""
        subsection = headers.get("h3") or ""
        heading_path = " > ".join(part for part in (title, section, subsection) if part)

        sub_chunks = text_splitter.split_text(content) if len(content) > chunk_size else [content]
        for sub_chunk in sub_chunks:
            chunk_text = sub_chunk.strip()
            if not chunk_text:
                continue
            final_chunks.append(
                {
                    "text": chunk_text,
                    "title": title,
                    "section": section,
                    "subsection": subsection,
                    "heading_path": heading_path,
                }
            )

    return final_chunks


def chunk_markdown(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[str]:
    """Split markdown into chunks respecting header boundaries."""
    return [
        chunk["text"]
        for chunk in chunk_markdown_records(
            text,
            fallback_path="document.md",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
    ]


def _attach_audit_metadata(
    metadata: dict[str, str | int | float | bool],
    *,
    result: Any,
) -> None:
    """Persist the audit verdict so retrieval can filter/debug low-trust chunks."""
    metadata["ingest_disposition"] = result.disposition
    metadata["ingest_reasons"] = ", ".join(result.reasons[:8])
    metadata["ingest_metadata_score"] = round(result.scores.metadata_score, 3)
    metadata["ingest_relevance_score"] = round(result.scores.relevance_score, 3)
    metadata["ingest_boilerplate_score"] = round(result.scores.boilerplate_score, 3)
    metadata["ingest_noise_score"] = round(result.scores.noise_score, 3)
    if result.quality_score is not None:
        metadata["ingest_source_quality_score"] = round(result.quality_score, 3)


def _docs_metadata_requires_refresh(
    existing_metadatas: list[dict[str, Any]] | None,
    *,
    relative_path: str,
) -> bool:
    """Return True when an unchanged docs file still needs metadata backfill."""
    expected: dict[str, str] = {
        "source_file": relative_path,
        "source_type": "markdown",
        "type": "documentation",
        **derive_docs_taxonomy(relative_path),
    }
    if not expected:
        return False

    metadatas = existing_metadatas or []
    if not metadatas:
        return True

    for meta in metadatas:
        if not meta:
            continue
        if all(str(meta.get(key) or "") == str(value) for key, value in expected.items()):
            return False
    return True


def _paper_metadata_requires_refresh(
    existing_metadatas: list[dict[str, Any]] | None,
    *,
    paper_meta: dict[str, Any],
) -> bool:
    """Return True when an unchanged paper still needs topical metadata backfill."""
    expected: dict[str, str] = {}
    for source_key, meta_key in (
        ("primary_domain", "primary_domain"),
        ("category", "category"),
        ("topic_signals", "topic_signals"),
    ):
        value = str(paper_meta.get(meta_key) or "").strip()
        if value:
            expected[source_key] = value

    if not expected:
        return False

    metadatas = existing_metadatas or []
    if not metadatas:
        return True

    for meta in metadatas:
        if not meta:
            continue
        if all(str(meta.get(key) or "") == value for key, value in expected.items()):
            return False
    return True


def _purge_missing_source_files(
    collection: Any,
    *,
    current_source_files: set[str],
    source_name: str | None = None,
    source_type: str | None = None,
    page_size: int = 5000,
    delete_batch_size: int = 1000,
) -> int:
    """Delete collection rows whose source_file no longer exists in the current corpus snapshot."""
    total = collection.count()
    if total <= 0:
        return 0

    stale_ids: list[str] = []
    for offset in range(0, total, page_size):
        batch = collection.get(limit=page_size, offset=offset, include=["metadatas"])
        batch_ids = batch.get("ids", [])
        batch_metas = batch.get("metadatas") or []
        for entry_id, meta in zip(batch_ids, batch_metas):
            if not meta:
                continue
            if source_name is not None and meta.get("source") != source_name:
                continue
            if source_type is not None and meta.get("source_type") != source_type:
                continue
            source_file = str(meta.get("source_file") or "").strip()
            if not source_file:
                continue
            if source_file in current_source_files:
                continue
            stale_ids.append(entry_id)

    deleted = 0
    for start in range(0, len(stale_ids), delete_batch_size):
        chunk = stale_ids[start:start + delete_batch_size]
        collection.delete(ids=chunk)
        deleted += len(chunk)

    if deleted:
        logger.info(
            "Purged %d stale collection rows for source=%s source_type=%s",
            deleted,
            source_name,
            source_type,
        )
    return deleted


def ingest_docs_directory(docs_dir: str) -> dict[str, int]:
    """Ingest all markdown files from a directory into the docs collection.

    Uses content hashing to skip unchanged files.
    Returns stats: {"ingested": N, "skipped": N, "chunks": N}
    """
    collection = get_docs_collection()
    docs_path = Path(docs_dir)
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "rejected": 0, "review": 0, "purged": 0}

    if not docs_path.exists():
        logger.warning("Docs directory not found: %s", docs_dir)
        return stats

    md_files = sorted(docs_path.rglob("*.md"))
    logger.info("Found %d markdown files in %s", len(md_files), docs_dir)

    current_source_files: set[str] = set()
    for filepath in md_files:
        relative_path = str(filepath.relative_to(docs_path))
        if should_skip_docs_path(relative_path):
            stats["skipped"] += 1
            continue

        try:
            text = filepath.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning("Failed to read %s: %s", filepath, e)
            continue

        file_hash = content_hash(text)

        audit_result = audit_document(
            target_collection="docs",
            source_kind="markdown",
            source_id=relative_path,
            path=str(filepath),
            text=text,
            metadata={"title": _extract_markdown_title(text, relative_path)},
        )
        if audit_result.disposition == "reject":
            stats["rejected"] += 1
            logger.info("Skipping rejected docs source %s: %s", relative_path, audit_result.reasons)
            continue
        if audit_result.disposition == "review":
            stats["review"] += 1
        current_source_files.add(relative_path)

        # Check if any existing chunk has this file hash (means unchanged)
        existing = collection.get(where={"source": relative_path}, include=["metadatas"])
        existing_ids = existing.get("ids", [])
        metadata_needs_refresh = _docs_metadata_requires_refresh(
            existing.get("metadatas"),
            relative_path=relative_path,
        )
        if existing_ids and any(file_hash in eid for eid in existing_ids) and not metadata_needs_refresh:
            stats["skipped"] += 1
            continue

        # Delete old chunks for this file before upserting new ones
        if existing_ids:
            collection.delete(ids=existing_ids)

        # Chunk and upsert
        chunks = chunk_markdown_records(text, fallback_path=relative_path)
        if not chunks:
            continue

        ids = [f"{relative_path}::{i}::{file_hash}" for i in range(len(chunks))]
        doc_taxonomy = derive_docs_taxonomy(relative_path)
        metadatas: list[dict[str, str | int | float | bool]] = [
            dict({
                "source": relative_path,
                "source_file": relative_path,
                "source_type": "markdown",
                "type": "documentation",
                "title": chunk["title"],
                "section": chunk["section"],
                "subsection": chunk["subsection"],
                "heading_path": chunk["heading_path"],
                "chunk_index": i,
                "total_chunks": len(chunks),
                "version": file_hash[:8],
                **doc_taxonomy,
            })
            for i, chunk in enumerate(chunks)
        ]
        for metadata in metadatas:
            _attach_audit_metadata(metadata, result=audit_result)

        _upsert_resilient(
            collection,
            ids,
            [chunk["text"] for chunk in chunks],
            metadatas,
            len(ids),
        )

        stats["ingested"] += 1
        stats["chunks"] += len(chunks)
        logger.info("Ingested %s: %d chunks", relative_path, len(chunks))

    stats["purged"] = _purge_missing_source_files(
        collection,
        current_source_files=current_source_files,
    )
    logger.info("Ingestion complete: %s", stats)
    return stats


def chunk_plain_text(
    text: str,
    chunk_size: int = 1500,
    chunk_overlap: int = 200,
) -> list[str]:
    """Split plain text into overlapping chunks at sentence boundaries."""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    return [c for c in splitter.split_text(text) if c.strip()]


def ingest_ohdsi_corpus(
    corpus_dir: str,
    batch_size: int = 32,
) -> dict[str, int]:
    """Ingest OHDSI research papers from a harvester corpus directory.

    Expects the corpus structure produced by the OHDSI harvester:
      corpus_dir/
        pdfs/           - Downloaded PDF files
        metadata/       - State JSON files with paper metadata

    Extracts text from PDFs using pymupdf, chunks them, and upserts into
    the ohdsi_papers ChromaDB collection with SapBERT embeddings.

    Uses content hashing to skip already-ingested papers.
    Returns stats: {"ingested": N, "skipped": N, "chunks": N, "errors": N}
    """
    try:
        import fitz  # pymupdf
    except ImportError:
        logger.error("pymupdf required for PDF ingestion. Install with: pip install pymupdf")
        return {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0, "rejected": 0, "review": 0}

    collection = get_ohdsi_papers_collection()
    corpus_path = Path(corpus_dir)
    pdf_dir = corpus_path / "pdfs"
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0, "rejected": 0, "review": 0, "purged": 0}

    if not pdf_dir.exists():
        logger.warning("PDF directory not found: %s", pdf_dir)
        return stats

    # Load paper metadata from harvester state
    paper_metadata = _load_harvester_metadata(corpus_path / "metadata")

    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    logger.info("Found %d PDF files in %s", len(pdf_files), pdf_dir)
    stats["purged"] = _purge_missing_source_files(
        collection,
        current_source_files={path.name for path in pdf_files},
        source_name="ohdsi_corpus",
    )

    # Batch upsert buffers
    batch_ids: list[str] = []
    batch_docs: list[str] = []
    batch_metas: list[dict[str, str | int | float | bool]] = []

    for i, pdf_path in enumerate(pdf_files):
        if (i + 1) % 50 == 0:
            logger.info("Processing PDF %d/%d ...", i + 1, len(pdf_files))

        try:
            doc = fitz.open(str(pdf_path))
            text = ""
            for page in doc:
                text += page.get_text("text")
            doc.close()
            text = text.strip()

            if len(text) < 200:
                logger.debug("Skipping %s: too short (%d chars)", pdf_path.name, len(text))
                stats["errors"] += 1
                continue

            file_hash = content_hash(text)

            # Check if already ingested via hash in ID
            existing = collection.get(
                where={"source_file": pdf_path.name},
                include=["metadatas"],
            )
            existing_ids = existing.get("ids", [])
            metadata_needs_refresh = _paper_metadata_requires_refresh(
                existing.get("metadatas"),
                paper_meta=paper_metadata.get(pdf_path.name, {}),
            )
            if existing_ids and any(file_hash in eid for eid in existing_ids) and not metadata_needs_refresh:
                stats["skipped"] += 1
                continue

            # Delete old chunks if file was previously ingested with different content
            if existing_ids:
                collection.delete(ids=existing_ids)

            # Get metadata for this paper
            meta = paper_metadata.get(pdf_path.name, {})

            audit_result = audit_document(
                target_collection="ohdsi_papers",
                source_kind="pdf",
                source_id=pdf_path.name,
                path=str(pdf_path),
                text=text,
                metadata={
                    "title": meta.get("title"),
                    "doi": meta.get("doi"),
                    "year": meta.get("year"),
                    "journal": meta.get("journal"),
                    "authors": meta.get("authors"),
                },
            )
            if meta.get("gate_status") in {"quarantine", "reject"}:
                logger.info(
                    "Skipping gated OHDSI PDF %s (%s): %s",
                    pdf_path.name,
                    meta.get("gate_status"),
                    meta.get("gate_reasons") or "no gate reason recorded",
                )
                stats["rejected"] += 1
                continue
            if audit_result.disposition == "reject":
                logger.info("Skipping rejected OHDSI PDF %s: %s", pdf_path.name, audit_result.reasons)
                stats["rejected"] += 1
                continue
            if audit_result.disposition == "review":
                stats["review"] += 1

            # Chunk the text
            chunks = chunk_plain_text(text)
            if not chunks:
                continue

            for j, chunk in enumerate(chunks):
                chunk_id = f"ohdsi::{pdf_path.name}::{j}::{file_hash}"
                chunk_meta: dict[str, str | int | float | bool] = {
                    "source_file": pdf_path.name,
                    "source": "ohdsi_corpus",
                    "source_type": "pdf",
                    "type": SOURCE_DOCUMENT_TYPES["ohdsi_corpus"],
                    "chunk_index": j,
                    "total_chunks": len(chunks),
                    "version": file_hash[:8],
                }
                if meta.get("title"):
                    chunk_meta["title"] = str(meta["title"])[:500]
                if meta.get("doi"):
                    chunk_meta["doi"] = str(meta["doi"])
                if meta.get("year"):
                    chunk_meta["year"] = int(meta["year"])
                    chunk_meta["publication_year"] = int(meta["year"])
                if meta.get("journal"):
                    chunk_meta["journal"] = str(meta["journal"])[:200]
                if meta.get("authors"):
                    chunk_meta["authors"] = str(meta["authors"])[:500]
                if meta.get("first_author"):
                    chunk_meta["first_author"] = str(meta["first_author"])[:200]
                if meta.get("pmid"):
                    chunk_meta["pmid"] = str(meta["pmid"])
                if meta.get("pmcid"):
                    chunk_meta["pmcid"] = str(meta["pmcid"])
                if meta.get("source"):
                    chunk_meta["source_origin"] = str(meta["source"])[:200]
                if meta.get("source_provenance"):
                    chunk_meta["source_provenance"] = str(meta["source_provenance"])[:200]
                if meta.get("metadata_source"):
                    chunk_meta["metadata_source"] = str(meta["metadata_source"])[:100]
                if meta.get("trust_tier"):
                    chunk_meta["trust_tier"] = str(meta["trust_tier"])[:50]
                if meta.get("gate_status"):
                    chunk_meta["gate_status"] = str(meta["gate_status"])[:50]
                if meta.get("gate_reasons"):
                    chunk_meta["gate_reasons"] = str(meta["gate_reasons"])[:500]
                if meta.get("primary_domain"):
                    chunk_meta["primary_domain"] = str(meta["primary_domain"])[:120]
                if meta.get("category"):
                    chunk_meta["category"] = str(meta["category"])[:120]
                if meta.get("topic_signals"):
                    chunk_meta["topic_signals"] = str(meta["topic_signals"])[:500]
                _attach_audit_metadata(chunk_meta, result=audit_result)

                batch_ids.append(chunk_id)
                batch_docs.append(chunk)
                batch_metas.append(chunk_meta)

            stats["ingested"] += 1
            stats["chunks"] += len(chunks)

            # Flush batch when full
            if len(batch_ids) >= batch_size:
                _upsert_resilient(collection, batch_ids, batch_docs, batch_metas, batch_size)
                batch_ids, batch_docs, batch_metas = [], [], []

        except Exception as e:
            logger.warning("Error processing %s: %s", pdf_path.name, e)
            stats["errors"] += 1

    # Flush remaining batch
    if batch_ids:
        _upsert_resilient(collection, batch_ids, batch_docs, batch_metas, batch_size)

    logger.info("OHDSI corpus ingestion complete: %s", stats)
    return stats


def ingest_ohdsi_knowledge(
    book_dir: str | None = None,
    vignettes_dir: str | None = None,
    forums_dir: str | None = None,
    batch_size: int = 32,
) -> dict[str, dict[str, int]]:
    """Ingest supplementary OHDSI knowledge sources into the ohdsi_papers collection.

    Handles: Book of OHDSI chapters, HADES vignettes, and forum threads.
    Each source gets metadata tags for retrieval filtering and priority weighting.

    Returns stats per source: {"book": {...}, "vignettes": {...}, "forums": {...}}
    """
    collection = get_ohdsi_papers_collection()
    all_stats: dict[str, dict[str, int]] = {}

    if book_dir:
        all_stats["book"] = _ingest_markdown_source(
            collection, Path(book_dir),
            source_tag="book_of_ohdsi",
            priority="high",
            glob_pattern="*.md",
            batch_size=batch_size,
        )

    if vignettes_dir:
        all_stats["vignettes"] = _ingest_markdown_source(
            collection, Path(vignettes_dir),
            source_tag="hades_vignette",
            priority="high",
            glob_pattern="**/*.md",
            batch_size=batch_size,
        )

    if forums_dir:
        all_stats["forums"] = _ingest_markdown_source(
            collection, Path(forums_dir),
            source_tag="ohdsi_forums",
            priority="medium",
            glob_pattern="topic_*.md",
            batch_size=batch_size,
        )

    logger.info("OHDSI knowledge ingestion complete: %s", all_stats)
    return all_stats


def _ingest_markdown_source(
    collection: Any,
    source_dir: Path,
    source_tag: str,
    priority: str,
    glob_pattern: str,
    batch_size: int = 32,
) -> dict[str, int]:
    """Ingest markdown files from a directory into the ohdsi_papers collection."""
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0, "rejected": 0, "review": 0}

    if not source_dir.exists():
        logger.warning("Source directory not found: %s", source_dir)
        return stats

    # Load manifest for metadata if available
    manifest_meta = _load_manifest_metadata(source_dir)

    md_files = sorted(source_dir.glob(glob_pattern))
    if not md_files:
        # Exclude manifest.json from count
        md_files = [f for f in md_files if f.name != "manifest.json"]

    logger.info("Ingesting %d files from %s (source: %s)", len(md_files), source_dir, source_tag)

    batch_ids: list[str] = []
    batch_docs: list[str] = []
    batch_metas: list[dict[str, str | int | float | bool]] = []

    for filepath in md_files:
        if filepath.name == "manifest.json":
            continue

        try:
            text = filepath.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning("Failed to read %s: %s", filepath, e)
            stats["errors"] += 1
            continue

        if len(text) < 100:
            continue

        file_hash = content_hash(text)
        relative_path = str(filepath.relative_to(source_dir))

        # Dedup check
        existing = collection.get(
            where={"source_file": relative_path},
            include=[],
        )
        existing_ids = existing.get("ids", [])
        if existing_ids and any(file_hash in eid for eid in existing_ids):
            stats["skipped"] += 1
            continue

        if existing_ids:
            collection.delete(ids=existing_ids)

        # Use markdown chunking for structured content
        chunks = chunk_markdown_records(
            text,
            fallback_path=relative_path,
            chunk_size=1500,
            chunk_overlap=200,
        )
        if not chunks:
            continue

        # Get file-level metadata from manifest.
        # Prefer the relative path to avoid collisions like multiple README.md files.
        file_meta = manifest_meta.get(relative_path, {}) or manifest_meta.get(filepath.name, {})

        audit_result = audit_document(
            target_collection="ohdsi_papers",
            source_kind="markdown",
            source_id=f"{source_tag}:{relative_path}",
            path=str(filepath),
            text=text,
            metadata={
                "title": file_meta.get("title") or _extract_markdown_title(text, relative_path),
                "package": file_meta.get("package"),
                "year": file_meta.get("year"),
                "quality_score": file_meta.get("quality_score"),
            },
        )
        if audit_result.disposition == "reject":
            logger.info("Skipping rejected OHDSI knowledge source %s: %s", relative_path, audit_result.reasons)
            stats["rejected"] += 1
            continue
        if audit_result.disposition == "review":
            stats["review"] += 1

        for j, chunk in enumerate(chunks):
            chunk_id = f"{source_tag}::{relative_path}::{j}::{file_hash}"
            chunk_meta: dict[str, str | int | float | bool] = {
                "source_file": relative_path,
                "source": source_tag,
                "source_type": "markdown",
                "type": SOURCE_DOCUMENT_TYPES.get(source_tag, "documentation"),
                "title": chunk.get("title", "") or _humanize_path_stem(relative_path),
                "section": chunk.get("section", ""),
                "subsection": chunk.get("subsection", ""),
                "heading_path": chunk.get("heading_path", ""),
                "chunk_index": j,
                "total_chunks": len(chunks),
                "version": file_hash[:8],
                "priority": priority,
            }
            if file_meta.get("title"):
                chunk_meta["title"] = str(file_meta["title"])[:500]
            if file_meta.get("package"):
                chunk_meta["package"] = str(file_meta["package"])
            if file_meta.get("year"):
                chunk_meta["year"] = int(file_meta["year"])
                chunk_meta["publication_year"] = int(file_meta["year"])
            if file_meta.get("quality_score"):
                chunk_meta["quality_score"] = float(file_meta["quality_score"])
            _attach_audit_metadata(chunk_meta, result=audit_result)

            batch_ids.append(chunk_id)
            batch_docs.append(chunk["text"])
            batch_metas.append(chunk_meta)

        stats["ingested"] += 1
        stats["chunks"] += len(chunks)

        if len(batch_ids) >= batch_size:
            _upsert_resilient(collection, batch_ids, batch_docs, batch_metas, batch_size)
            batch_ids, batch_docs, batch_metas = [], [], []

    # Flush remaining
    if batch_ids:
        _upsert_resilient(collection, batch_ids, batch_docs, batch_metas, batch_size)

    logger.info("  %s ingestion: %s", source_tag, stats)
    return stats


def _load_manifest_metadata(source_dir: Path) -> dict[str, dict]:
    """Load metadata from manifest.json, keyed by filename."""
    manifest_path = source_dir / "manifest.json"
    if not manifest_path.exists():
        return {}

    try:
        with open(manifest_path) as f:
            data = json.load(f)

        result = {}
        # Handle different manifest formats
        for item in data.get("chapters", []) + data.get("files", []) + data.get("topics", []):
            filename = item.get("filename", "")
            if not filename:
                # Forum topics use topic_id
                topic_id = item.get("topic_id")
                if topic_id:
                    filename = f"topic_{topic_id}.md"
            if not filename:
                continue

            keys = {str(filename)}
            if filename.endswith(".Rmd"):
                keys.add(filename.removesuffix(".Rmd") + ".md")
            if filename.endswith(".Rmarkdown"):
                keys.add(filename.removesuffix(".Rmarkdown") + ".md")

            package = item.get("package")
            if package:
                package_str = str(package)
                keys |= {f"{package_str}/{key}" for key in list(keys)}

            for key in keys:
                result[key] = item
        return result
    except Exception as e:
        logger.warning("Failed to load manifest from %s: %s", manifest_path, e)
        return {}


def ingest_medical_textbooks(
    textbooks_dir: str,
    batch_size: int = 32,
) -> dict[str, int]:
    """Ingest pre-extracted medical textbook JSONL files into medical_textbooks.

    Expects JSONL files produced by ingest_textbooks.py, each line containing:
    {"text": "...", "metadata": {"source": "medical_textbook", "title": "...", ...}}

    Returns stats: {"ingested": N, "skipped": N, "chunks": N, "errors": N}
    """
    collection = get_medical_textbooks_collection()
    tb_path = Path(textbooks_dir)
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0, "rejected": 0, "review": 0}

    if not tb_path.exists():
        logger.warning("Textbooks directory not found: %s", tb_path)
        return stats

    jsonl_files = sorted(tb_path.glob("*.jsonl"))
    logger.info("Found %d textbook JSONL files in %s", len(jsonl_files), tb_path)

    batch_ids: list[str] = []
    batch_docs: list[str] = []
    batch_metas: list[dict[str, str | int | float | bool]] = []

    for filepath in jsonl_files:
        try:
            file_text = filepath.read_text(encoding="utf-8")
            file_hash = content_hash(file_text)

            # Dedup check
            source_key = filepath.stem
            existing = collection.get(
                where={"source_file": source_key},
                include=[],
            )
            existing_ids = existing.get("ids", [])
            if existing_ids and any(file_hash in eid for eid in existing_ids):
                stats["skipped"] += 1
                continue

            if existing_ids:
                collection.delete(ids=existing_ids)

            lines = [ln for ln in file_text.strip().split("\n") if ln.strip()]
            chunk_count = 0
            sample_text_parts: list[str] = []
            representative_meta: dict[str, str | int | float | bool] = {}
            file_batch_ids: list[str] = []
            file_batch_docs: list[str] = []
            file_batch_metas: list[dict[str, str | int | float | bool]] = []

            for line in lines:
                try:
                    doc = json.loads(line)
                except json.JSONDecodeError:
                    continue

                text = doc.get("text", "")
                meta = doc.get("metadata", {})
                if len(text) < 100:
                    continue
                if len(sample_text_parts) < 40:
                    sample_text_parts.append(text)
                for key in ("title", "category", "tier", "priority"):
                    if meta.get(key) is not None and key not in representative_meta:
                        representative_meta[key] = meta[key]

                chunk_id = f"textbook::{source_key}::{meta.get('chunk_index', chunk_count)}::{file_hash}"
                chunk_meta: dict[str, str | int | float | bool] = {
                    "source_file": source_key,
                    "source": "medical_textbook",
                    "source_type": "jsonl",
                    "type": SOURCE_DOCUMENT_TYPES["medical_textbook"],
                    "chunk_index": meta.get("chunk_index", chunk_count),
                    "total_chunks": meta.get("total_chunks", len(lines)),
                    "version": file_hash[:8],
                    "priority": meta.get("priority", "medium"),
                }
                if meta.get("title"):
                    chunk_meta["title"] = str(meta["title"])[:500]
                if meta.get("category"):
                    chunk_meta["category"] = str(meta["category"])
                if meta.get("tier") is not None:
                    chunk_meta["tier"] = int(meta["tier"])

                file_batch_ids.append(chunk_id)
                file_batch_docs.append(text)
                file_batch_metas.append(chunk_meta)
                chunk_count += 1

            final_audit = audit_document(
                target_collection="medical_textbooks",
                source_kind="jsonl",
                source_id=source_key,
                path=str(filepath),
                text="\n\n".join(sample_text_parts),
                metadata=representative_meta,
            )
            if final_audit.disposition == "reject":
                stats["rejected"] += 1
                logger.info("Skipping rejected textbook %s: %s", filepath.name, final_audit.reasons)
                continue
            if final_audit.disposition == "review":
                stats["review"] += 1

            for chunk_meta in file_batch_metas:
                _attach_audit_metadata(chunk_meta, result=final_audit)

            batch_ids.extend(file_batch_ids)
            batch_docs.extend(file_batch_docs)
            batch_metas.extend(file_batch_metas)

            if len(batch_ids) >= batch_size:
                _upsert_resilient(collection, batch_ids, batch_docs, batch_metas, batch_size)
                batch_ids, batch_docs, batch_metas = [], [], []

            stats["ingested"] += 1
            stats["chunks"] += chunk_count
            logger.info("Ingested %s: %d chunks", filepath.name, chunk_count)

        except Exception as e:
            logger.warning("Error processing %s: %s", filepath.name, e)
            stats["errors"] += 1

    # Flush remaining
    if batch_ids:
        _upsert_resilient(collection, batch_ids, batch_docs, batch_metas, batch_size)

    logger.info("Medical textbook ingestion complete: %s", stats)
    return stats


def _load_harvester_metadata(metadata_dir: Path) -> dict[str, dict]:
    """Load paper metadata from harvester state files, keyed by PDF filename."""
    papers_by_filename: dict[str, dict] = {}

    for phase in ["phase5", "phase4", "phase3", "phase2", "phase1"]:
        state_file = metadata_dir / f"state_{phase}.json"
        if state_file.exists():
            try:
                with open(state_file) as f:
                    state = json.load(f)
                for paper in state.get("papers", []):
                    pdf_path = paper.get("pdf_path", "")
                    if pdf_path:
                        filename = Path(pdf_path).name
                        papers_by_filename[filename] = paper
                logger.info(
                    "Loaded metadata from %s: %d papers with PDFs",
                    state_file, len(papers_by_filename),
                )
            except Exception as e:
                logger.warning("Failed to load %s: %s", state_file, e)
            break

    if papers_by_filename:
        return papers_by_filename

    metadata_csv = metadata_dir.parent / "metadata.csv"
    if metadata_csv.exists():
        try:
            with metadata_csv.open("r", encoding="utf-8", newline="") as handle:
                for row in csv.DictReader(handle):
                    filename = str(row.get("Filename") or "").strip()
                    if not filename:
                        continue
                    papers_by_filename[filename] = {
                        "title": row.get("Title") or row.get("PDF Title") or "",
                        "doi": row.get("DOI") or "",
                        "year": row.get("Publication Year") or "",
                        "journal": row.get("Journal") or "",
                        "authors": row.get("Authors") or "",
                        "first_author": row.get("First Author") or "",
                        "pmid": row.get("PMID") or "",
                        "pmcid": row.get("PMCID") or "",
                        "source": row.get("Source") or "",
                        "metadata_source": row.get("Metadata Source") or "",
                        "source_provenance": row.get("Source Provenance") or "",
                        "trust_tier": row.get("Trust Tier") or "",
                        "gate_status": row.get("Gate Status") or "",
                        "gate_reasons": row.get("Gate Reasons") or "",
                        "primary_domain": row.get("Primary Domain") or "",
                        "category": row.get("Category") or "",
                        "topic_signals": row.get("Topic Signals") or "",
                    }
            logger.info("Loaded metadata from %s: %d papers", metadata_csv, len(papers_by_filename))
        except Exception as e:
            logger.warning("Failed to load %s: %s", metadata_csv, e)

    return papers_by_filename
