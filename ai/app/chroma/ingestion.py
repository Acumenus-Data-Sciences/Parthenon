"""Document ingestion pipeline for ChromaDB.

Handles chunking, hashing, and upserting documentation into the docs collection.
Also handles OHDSI research paper ingestion from PDF-extracted JSONL.
Uses content-hash-based deduplication to avoid re-embedding unchanged files.
"""
import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from app.chroma.collections import get_docs_collection, get_ohdsi_papers_collection

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
        metadatas: list[dict[str, str | int | float | bool]] = [
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
            metadatas=metadatas,  # type: ignore[arg-type]
        )

        stats["ingested"] += 1
        stats["chunks"] += len(chunks)
        logger.info("Ingested %s: %d chunks", relative_path, len(chunks))

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
        return {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0}

    collection = get_ohdsi_papers_collection()
    corpus_path = Path(corpus_dir)
    pdf_dir = corpus_path / "pdfs"
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0}

    if not pdf_dir.exists():
        logger.warning("PDF directory not found: %s", pdf_dir)
        return stats

    # Load paper metadata from harvester state
    paper_metadata = _load_harvester_metadata(corpus_path / "metadata")

    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    logger.info("Found %d PDF files in %s", len(pdf_files), pdf_dir)

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
                include=[],
            )
            existing_ids = existing.get("ids", [])
            if existing_ids and any(file_hash in eid for eid in existing_ids):
                stats["skipped"] += 1
                continue

            # Delete old chunks if file was previously ingested with different content
            if existing_ids:
                collection.delete(ids=existing_ids)

            # Get metadata for this paper
            meta = paper_metadata.get(pdf_path.name, {})

            # Chunk the text
            chunks = chunk_plain_text(text)
            if not chunks:
                continue

            for j, chunk in enumerate(chunks):
                chunk_id = f"ohdsi::{pdf_path.name}::{j}::{file_hash}"
                chunk_meta: dict[str, str | int | float | bool] = {
                    "source_file": pdf_path.name,
                    "source": "ohdsi_corpus",
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

                batch_ids.append(chunk_id)
                batch_docs.append(chunk)
                batch_metas.append(chunk_meta)

            stats["ingested"] += 1
            stats["chunks"] += len(chunks)

            # Flush batch when full
            if len(batch_ids) >= batch_size:
                collection.upsert(
                    ids=batch_ids,
                    documents=batch_docs,
                    metadatas=batch_metas,  # type: ignore[arg-type]
                )
                batch_ids, batch_docs, batch_metas = [], [], []

        except Exception as e:
            logger.warning("Error processing %s: %s", pdf_path.name, e)
            stats["errors"] += 1

    # Flush remaining batch
    if batch_ids:
        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas,  # type: ignore[arg-type]
        )

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
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0}

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
        chunks = chunk_markdown(text, chunk_size=1500, chunk_overlap=200)
        if not chunks:
            continue

        # Get file-level metadata from manifest
        file_meta = manifest_meta.get(filepath.name, {})

        for j, chunk in enumerate(chunks):
            chunk_id = f"{source_tag}::{relative_path}::{j}::{file_hash}"
            chunk_meta: dict[str, str | int | float | bool] = {
                "source_file": relative_path,
                "source": source_tag,
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
            if file_meta.get("quality_score"):
                chunk_meta["quality_score"] = float(file_meta["quality_score"])

            batch_ids.append(chunk_id)
            batch_docs.append(chunk)
            batch_metas.append(chunk_meta)

        stats["ingested"] += 1
        stats["chunks"] += len(chunks)

        if len(batch_ids) >= batch_size:
            collection.upsert(
                ids=batch_ids,
                documents=batch_docs,
                metadatas=batch_metas,  # type: ignore[arg-type]
            )
            batch_ids, batch_docs, batch_metas = [], [], []

    # Flush remaining
    if batch_ids:
        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas,  # type: ignore[arg-type]
        )

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
            if filename:
                result[filename] = item
        return result
    except Exception as e:
        logger.warning("Failed to load manifest from %s: %s", manifest_path, e)
        return {}


def ingest_medical_textbooks(
    textbooks_dir: str,
    batch_size: int = 32,
) -> dict[str, int]:
    """Ingest pre-extracted medical textbook JSONL files into ohdsi_papers.

    Expects JSONL files produced by ingest_textbooks.py, each line containing:
    {"text": "...", "metadata": {"source": "medical_textbook", "title": "...", ...}}

    Returns stats: {"ingested": N, "skipped": N, "chunks": N, "errors": N}
    """
    collection = get_ohdsi_papers_collection()
    tb_path = Path(textbooks_dir)
    stats = {"ingested": 0, "skipped": 0, "chunks": 0, "errors": 0}

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

            for line in lines:
                try:
                    doc = json.loads(line)
                except json.JSONDecodeError:
                    continue

                text = doc.get("text", "")
                meta = doc.get("metadata", {})
                if len(text) < 100:
                    continue

                chunk_id = f"textbook::{source_key}::{meta.get('chunk_index', chunk_count)}::{file_hash}"
                chunk_meta: dict[str, str | int | float | bool] = {
                    "source_file": source_key,
                    "source": "medical_textbook",
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

                batch_ids.append(chunk_id)
                batch_docs.append(text)
                batch_metas.append(chunk_meta)
                chunk_count += 1

                if len(batch_ids) >= batch_size:
                    collection.upsert(
                        ids=batch_ids,
                        documents=batch_docs,
                        metadatas=batch_metas,  # type: ignore[arg-type]
                    )
                    batch_ids, batch_docs, batch_metas = [], [], []

            stats["ingested"] += 1
            stats["chunks"] += chunk_count
            logger.info("Ingested %s: %d chunks", filepath.name, chunk_count)

        except Exception as e:
            logger.warning("Error processing %s: %s", filepath.name, e)
            stats["errors"] += 1

    # Flush remaining
    if batch_ids:
        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas,  # type: ignore[arg-type]
        )

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

    return papers_by_filename
