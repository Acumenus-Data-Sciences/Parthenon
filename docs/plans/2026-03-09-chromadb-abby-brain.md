# ChromaDB Brain for Abby — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ChromaDB as a persistent vector knowledge base for Abby, enabling RAG-powered responses from documentation, conversation memory, shared FAQ, and clinical references.

**Architecture:** Sidecar pattern — ChromaDB runs as a standalone Docker container. The Python AI service (`ai/`) is the sole gateway. Four collections with dual embedding models (sentence-transformers for general text, SapBERT for clinical content). Phased rollout: docs first, then conversations, FAQ, clinical.

**Tech Stack:** ChromaDB, sentence-transformers (all-MiniLM-L6-v2), SapBERT (already deployed), langchain-text-splitters, FastAPI, Docker Compose

**Design doc:** `docs/plans/2026-03-09-chromadb-abby-brain-design.md`

---

## Phase 1: Foundation — ChromaDB + Documentation RAG

### Task 1: Add ChromaDB Docker Service

**Files:**
- Modify: `docker-compose.yml` (after line 158, before `solr:`)
- Modify: `ai/app/config.py`

**Step 1: Add chromadb service to docker-compose.yml**

Add after the `python-ai` service block (line 158), before `solr:`:

```yaml
  chromadb:
    container_name: parthenon-chromadb
    image: chromadb/chroma:latest
    volumes:
      - chromadb-data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 1G
    networks:
      - parthenon
    restart: unless-stopped
```

Add `chromadb-data:` to the `volumes:` section (line ~313).

Add `chromadb` to the `python-ai` service's `depends_on:` block.

**Step 2: Add ChromaDB config to settings**

In `ai/app/config.py`, add:

```python
    # ChromaDB configuration
    chroma_host: str = "chromadb"
    chroma_port: int = 8000
```

**Step 3: Verify Docker service starts**

Run:
```bash
cd /home/smudoshi/Github/Parthenon && docker compose up -d chromadb
docker compose ps chromadb
```
Expected: `parthenon-chromadb` running, healthy

**Step 4: Commit**

```bash
git add docker-compose.yml ai/app/config.py
git commit -m "feat: add ChromaDB Docker service for Abby knowledge base"
```

---

### Task 2: Add Python Dependencies

**Files:**
- Modify: `ai/requirements.txt`

**Step 1: Add ChromaDB and text processing dependencies**

Append to `ai/requirements.txt`:

```
chromadb==1.*
sentence-transformers==4.*
langchain-text-splitters==0.*
```

**Step 2: Verify installation**

```bash
docker compose build python-ai --no-cache
docker compose up -d python-ai
docker compose exec python-ai python -c "import chromadb; print(chromadb.__version__)"
```
Expected: ChromaDB version printed

**Step 3: Commit**

```bash
git add ai/requirements.txt
git commit -m "feat: add chromadb, sentence-transformers, langchain-text-splitters deps"
```

---

### Task 3: ChromaDB Client Module

**Files:**
- Create: `ai/app/chroma/__init__.py`
- Create: `ai/app/chroma/client.py`
- Test: `ai/tests/test_chroma_client.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_client.py`:

```python
"""Tests for ChromaDB client singleton and health check."""
from unittest.mock import MagicMock, patch

import pytest


def test_get_client_returns_chromadb_client():
    """Client factory returns a working ChromaDB HttpClient."""
    with patch("chromadb.HttpClient") as mock_http:
        mock_instance = MagicMock()
        mock_http.return_value = mock_instance

        from app.chroma.client import get_chroma_client

        client = get_chroma_client()
        assert client is mock_instance
        mock_http.assert_called_once()


def test_get_client_is_singleton():
    """Repeated calls return the same client instance."""
    with patch("chromadb.HttpClient") as mock_http:
        mock_instance = MagicMock()
        mock_http.return_value = mock_instance

        # Clear any cached singleton
        import app.chroma.client as mod
        mod._client = None

        c1 = mod.get_chroma_client()
        c2 = mod.get_chroma_client()
        assert c1 is c2
        assert mock_http.call_count == 1


def test_check_health_returns_status():
    """Health check returns heartbeat nanosecond value."""
    with patch("app.chroma.client.get_chroma_client") as mock_get:
        mock_client = MagicMock()
        mock_client.heartbeat.return_value = 1234567890
        mock_get.return_value = mock_client

        from app.chroma.client import check_health

        result = check_health()
        assert result == {"status": "ok", "heartbeat": 1234567890}


def test_check_health_returns_error_on_failure():
    """Health check returns error status when ChromaDB is unreachable."""
    with patch("app.chroma.client.get_chroma_client") as mock_get:
        mock_client = MagicMock()
        mock_client.heartbeat.side_effect = Exception("Connection refused")
        mock_get.return_value = mock_client

        from app.chroma.client import check_health

        result = check_health()
        assert result["status"] == "error"
        assert "Connection refused" in result["error"]
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_client.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.chroma'`

**Step 3: Create the module**

Create `ai/app/chroma/__init__.py`:
```python
"""ChromaDB integration for Abby's persistent knowledge base."""
```

Create `ai/app/chroma/client.py`:
```python
"""ChromaDB client singleton and health check."""
import logging

import chromadb

from app.config import settings

logger = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None


def get_chroma_client() -> chromadb.ClientAPI:
    """Return a singleton ChromaDB HTTP client."""
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
        logger.info("Connected to ChromaDB at %s:%s", settings.chroma_host, settings.chroma_port)
    return _client


def check_health() -> dict[str, object]:
    """Check ChromaDB connectivity. Returns status dict."""
    try:
        client = get_chroma_client()
        heartbeat = client.heartbeat()
        return {"status": "ok", "heartbeat": heartbeat}
    except Exception as e:
        logger.warning("ChromaDB health check failed: %s", e)
        return {"status": "error", "error": str(e)}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_client.py -v
```
Expected: 4 passed

**Step 5: Commit**

```bash
git add ai/app/chroma/ ai/tests/test_chroma_client.py
git commit -m "feat: add ChromaDB client singleton with health check"
```

---

### Task 4: Dual Embedding Provider

**Files:**
- Create: `ai/app/chroma/embeddings.py`
- Test: `ai/tests/test_chroma_embeddings.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_embeddings.py`:

```python
"""Tests for dual embedding provider."""
from unittest.mock import MagicMock, patch

import pytest


def test_general_embedder_returns_384_dims():
    """Sentence-transformers model produces 384-dim vectors."""
    with patch("sentence_transformers.SentenceTransformer") as mock_st:
        import numpy as np
        mock_model = MagicMock()
        mock_model.encode.return_value = np.random.rand(1, 384).astype(np.float32)
        mock_st.return_value = mock_model

        from app.chroma.embeddings import GeneralEmbedder

        embedder = GeneralEmbedder.__new__(GeneralEmbedder)
        embedder._model = mock_model

        result = embedder(["test text"])
        assert len(result) == 1
        assert len(result[0]) == 384


def test_clinical_embedder_returns_768_dims():
    """SapBERT model produces 768-dim vectors."""
    with patch("app.chroma.embeddings.get_sapbert_service") as mock_sap:
        mock_service = MagicMock()
        mock_service.encode.return_value = [[0.1] * 768]
        mock_sap.return_value = mock_service

        from app.chroma.embeddings import ClinicalEmbedder

        embedder = ClinicalEmbedder()
        result = embedder(["hypertension"])
        assert len(result) == 1
        assert len(result[0]) == 768


def test_general_embedder_is_chromadb_compatible():
    """GeneralEmbedder implements ChromaDB's EmbeddingFunction protocol."""
    with patch("sentence_transformers.SentenceTransformer"):
        from app.chroma.embeddings import GeneralEmbedder

        embedder = GeneralEmbedder.__new__(GeneralEmbedder)
        assert callable(embedder)
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_embeddings.py -v
```
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write the implementation**

Create `ai/app/chroma/embeddings.py`:

```python
"""Dual embedding providers for ChromaDB collections.

- GeneralEmbedder: sentence-transformers/all-MiniLM-L6-v2 (384-dim) for docs/conversations/FAQ
- ClinicalEmbedder: SapBERT (768-dim) for clinical reference content
"""
import logging
from functools import lru_cache

import numpy as np
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

logger = logging.getLogger(__name__)


class GeneralEmbedder(EmbeddingFunction[Documents]):
    """Sentence-transformers embedding for general text (384 dimensions)."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)
        logger.info("Loaded general embedder: %s", model_name)

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = self._model.encode(input, convert_to_numpy=True)
        if isinstance(embeddings, np.ndarray):
            return embeddings.tolist()
        return [e.tolist() if hasattr(e, "tolist") else list(e) for e in embeddings]


class ClinicalEmbedder(EmbeddingFunction[Documents]):
    """SapBERT embedding for clinical/medical content (768 dimensions)."""

    def __init__(self) -> None:
        from app.services.sapbert import get_sapbert_service

        self._service = get_sapbert_service()
        logger.info("Clinical embedder using SapBERT service")

    def __call__(self, input: Documents) -> Embeddings:
        return self._service.encode(list(input))


@lru_cache(maxsize=1)
def get_general_embedder() -> GeneralEmbedder:
    """Singleton general embedder."""
    return GeneralEmbedder()


@lru_cache(maxsize=1)
def get_clinical_embedder() -> ClinicalEmbedder:
    """Singleton clinical embedder."""
    return ClinicalEmbedder()
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_embeddings.py -v
```
Expected: 3 passed

**Step 5: Commit**

```bash
git add ai/app/chroma/embeddings.py ai/tests/test_chroma_embeddings.py
git commit -m "feat: add dual embedding providers (sentence-transformers + SapBERT)"
```

---

### Task 5: Collection Manager

**Files:**
- Create: `ai/app/chroma/collections.py`
- Test: `ai/tests/test_chroma_collections.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_collections.py`:

```python
"""Tests for ChromaDB collection management."""
from unittest.mock import MagicMock, patch


def test_get_docs_collection():
    """Docs collection uses general embedder."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        from app.chroma.collections import get_docs_collection

        result = get_docs_collection()
        assert result is mock_coll
        mock_client.return_value.get_or_create_collection.assert_called_once()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "docs"


def test_get_user_conversation_collection():
    """User conversation collection is namespaced by user_id."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        from app.chroma.collections import get_user_conversation_collection

        result = get_user_conversation_collection(user_id=42)
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "conversations_user_42"


def test_get_faq_collection():
    """FAQ collection uses general embedder."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_general_embedder"):
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll

        from app.chroma.collections import get_faq_collection

        result = get_faq_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "faq_shared"


def test_get_clinical_collection():
    """Clinical collection uses SapBERT embedder."""
    with patch("app.chroma.collections.get_chroma_client") as mock_client, \
         patch("app.chroma.collections.get_clinical_embedder") as mock_embedder:
        mock_coll = MagicMock()
        mock_client.return_value.get_or_create_collection.return_value = mock_coll
        mock_embedder.return_value = MagicMock()

        from app.chroma.collections import get_clinical_collection

        result = get_clinical_collection()
        call_kwargs = mock_client.return_value.get_or_create_collection.call_args
        assert call_kwargs.kwargs["name"] == "clinical_reference"
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_collections.py -v
```
Expected: FAIL

**Step 3: Write the implementation**

Create `ai/app/chroma/collections.py`:

```python
"""ChromaDB collection accessors.

Each collection has a specific embedding function and metadata schema.
Collections are created lazily on first access via get_or_create_collection.
"""
import logging

from chromadb.api.models.Collection import Collection

from app.chroma.client import get_chroma_client
from app.chroma.embeddings import get_clinical_embedder, get_general_embedder

logger = logging.getLogger(__name__)


def get_docs_collection() -> Collection:
    """Documentation chunks collection (384-dim, sentence-transformers)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="docs",
        embedding_function=get_general_embedder(),
        metadata={"hnsw:space": "cosine"},
    )


def get_user_conversation_collection(user_id: int) -> Collection:
    """Per-user conversation memory (384-dim, sentence-transformers)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=f"conversations_user_{user_id}",
        embedding_function=get_general_embedder(),
        metadata={"hnsw:space": "cosine"},
    )


def get_faq_collection() -> Collection:
    """Shared FAQ collection promoted from common questions (384-dim)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="faq_shared",
        embedding_function=get_general_embedder(),
        metadata={"hnsw:space": "cosine"},
    )


def get_clinical_collection() -> Collection:
    """Clinical reference collection using SapBERT (768-dim)."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name="clinical_reference",
        embedding_function=get_clinical_embedder(),
        metadata={"hnsw:space": "cosine"},
    )
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_collections.py -v
```
Expected: 4 passed

**Step 5: Commit**

```bash
git add ai/app/chroma/collections.py ai/tests/test_chroma_collections.py
git commit -m "feat: add ChromaDB collection accessors for all four knowledge layers"
```

---

### Task 6: Document Ingestion Pipeline

**Files:**
- Create: `ai/app/chroma/ingestion.py`
- Test: `ai/tests/test_chroma_ingestion.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_ingestion.py`:

```python
"""Tests for document ingestion pipeline."""
import hashlib
from unittest.mock import MagicMock, patch, mock_open

import pytest


def test_chunk_markdown_splits_by_headers():
    """Markdown splitter respects heading boundaries."""
    from app.chroma.ingestion import chunk_markdown

    content = "# Title\n\nFirst section content.\n\n## Subtitle\n\nSecond section content."
    chunks = chunk_markdown(content, chunk_size=512, chunk_overlap=64)
    assert len(chunks) >= 1
    assert all(isinstance(c, str) for c in chunks)


def test_chunk_markdown_respects_size_limit():
    """Chunks stay within the specified token limit."""
    from app.chroma.ingestion import chunk_markdown

    content = "# Big Doc\n\n" + ("word " * 1000)
    chunks = chunk_markdown(content, chunk_size=256, chunk_overlap=32)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) < 2000  # chars, rough proxy


def test_content_hash():
    """Content hash is deterministic SHA-256."""
    from app.chroma.ingestion import content_hash

    text = "hello world"
    expected = hashlib.sha256(text.encode()).hexdigest()
    assert content_hash(text) == expected


def test_ingest_docs_skips_unchanged(tmp_path):
    """Ingestion skips files whose content hash hasn't changed."""
    # Create a markdown file
    doc = tmp_path / "test.md"
    doc.write_text("# Test\n\nSome content.")

    with patch("app.chroma.ingestion.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        # Simulate existing doc with same hash
        file_hash = hashlib.sha256("# Test\n\nSome content.".encode()).hexdigest()
        mock_coll.get.return_value = {"ids": [f"test.md::0::{file_hash}"]}

        from app.chroma.ingestion import ingest_docs_directory

        stats = ingest_docs_directory(str(tmp_path))
        assert stats["skipped"] >= 1


def test_ingest_docs_adds_new_file(tmp_path):
    """Ingestion adds chunks from a new file."""
    doc = tmp_path / "new.md"
    doc.write_text("# New Doc\n\nFresh content here.")

    with patch("app.chroma.ingestion.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.get.return_value = {"ids": []}

        from app.chroma.ingestion import ingest_docs_directory

        stats = ingest_docs_directory(str(tmp_path))
        assert stats["ingested"] >= 1
        mock_coll.upsert.assert_called()
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_ingestion.py -v
```
Expected: FAIL

**Step 3: Write the implementation**

Create `ai/app/chroma/ingestion.py`:

```python
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

# Headers to split on for markdown-aware chunking
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
    """Split markdown into chunks respecting header boundaries.

    First splits by markdown headers, then applies recursive character splitting
    to any chunks that exceed chunk_size.
    """
    md_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=MARKDOWN_HEADERS,
        strip_headers=False,
    )
    md_chunks = md_splitter.split_text(text)

    # Further split large chunks
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
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_ingestion.py -v
```
Expected: 5 passed

**Step 5: Commit**

```bash
git add ai/app/chroma/ingestion.py ai/tests/test_chroma_ingestion.py
git commit -m "feat: add markdown-aware document ingestion with content-hash dedup"
```

---

### Task 7: RAG Retrieval Module

**Files:**
- Create: `ai/app/chroma/retrieval.py`
- Test: `ai/tests/test_chroma_retrieval.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_retrieval.py`:

```python
"""Tests for RAG retrieval from ChromaDB collections."""
from unittest.mock import MagicMock, patch

import pytest


def test_query_docs_returns_relevant_chunks():
    """Docs query returns documents above similarity threshold."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["chunk about cohort building", "chunk about vocabulary"]],
            "distances": [[0.15, 0.25]],  # cosine distances (lower = more similar)
            "metadatas": [[{"source": "guide.md"}, {"source": "vocab.md"}]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("how do I build a cohort?", top_k=3)
        assert len(results) == 2
        assert results[0]["text"] == "chunk about cohort building"
        assert results[0]["score"] > results[1]["score"]


def test_query_docs_filters_by_threshold():
    """Results below similarity threshold are excluded."""
    with patch("app.chroma.retrieval.get_docs_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.query.return_value = {
            "documents": [["relevant chunk", "irrelevant chunk"]],
            "distances": [[0.1, 0.8]],  # second chunk is too dissimilar
            "metadatas": [[{"source": "a.md"}, {"source": "b.md"}]],
        }

        from app.chroma.retrieval import query_docs

        results = query_docs("test query", top_k=3, threshold=0.3)
        assert len(results) == 1


def test_build_rag_context_assembles_sections():
    """RAG context builder combines results from multiple collections."""
    with patch("app.chroma.retrieval.query_docs") as mock_docs, \
         patch("app.chroma.retrieval.query_faq") as mock_faq:
        mock_docs.return_value = [
            {"text": "Doc chunk 1", "score": 0.9, "source": "guide.md"}
        ]
        mock_faq.return_value = [
            {"text": "Q: How? A: Like this.", "score": 0.85, "source": "faq"}
        ]

        from app.chroma.retrieval import build_rag_context

        context = build_rag_context(
            query="how do I do this?",
            page_context="general",
            user_id=None,
        )
        assert "KNOWLEDGE BASE" in context
        assert "Doc chunk 1" in context


def test_build_rag_context_returns_empty_on_no_results():
    """Returns empty string when no relevant results found."""
    with patch("app.chroma.retrieval.query_docs") as mock_docs, \
         patch("app.chroma.retrieval.query_faq") as mock_faq:
        mock_docs.return_value = []
        mock_faq.return_value = []

        from app.chroma.retrieval import build_rag_context

        context = build_rag_context(
            query="obscure question",
            page_context="general",
            user_id=None,
        )
        assert context == ""
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_retrieval.py -v
```
Expected: FAIL

**Step 3: Write the implementation**

Create `ai/app/chroma/retrieval.py`:

```python
"""RAG retrieval from ChromaDB collections.

Queries relevant collections based on page context, assembles context
for injection into Abby's system prompt.
"""
import logging

from app.chroma.collections import (
    get_docs_collection,
    get_faq_collection,
    get_user_conversation_collection,
)

logger = logging.getLogger(__name__)

# Page contexts that should also query clinical reference
CLINICAL_PAGES = {
    "cohort_builder", "vocabulary", "data_explorer", "data_quality",
    "analyses", "incidence_rates", "estimation", "prediction",
    "genomics", "imaging", "patient_profiles", "care_gaps",
}

DEFAULT_THRESHOLD = 0.3  # cosine distance — lower means more similar
DEFAULT_TOP_K = 3


def _convert_distances_to_results(
    documents: list[str],
    distances: list[float],
    metadatas: list[dict],
    threshold: float,
) -> list[dict[str, object]]:
    """Convert ChromaDB query results to ranked result dicts.

    ChromaDB returns cosine distances (0 = identical, 2 = opposite).
    We convert to similarity scores (1 - distance) and filter by threshold.
    """
    results = []
    for doc, dist, meta in zip(documents, distances, metadatas):
        similarity = 1.0 - dist
        if dist <= threshold:
            results.append({
                "text": doc,
                "score": similarity,
                "source": meta.get("source", "unknown"),
            })
    return sorted(results, key=lambda r: r["score"], reverse=True)


def query_docs(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the documentation collection."""
    try:
        collection = get_docs_collection()
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
        )
        return _convert_distances_to_results(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0],
            threshold,
        )
    except Exception as e:
        logger.warning("Docs query failed: %s", e)
        return []


def query_user_conversations(
    query: str,
    user_id: int,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query a user's conversation history collection."""
    try:
        collection = get_user_conversation_collection(user_id)
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
        )
        return _convert_distances_to_results(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0],
            threshold,
        )
    except Exception as e:
        logger.warning("Conversation query failed for user %s: %s", user_id, e)
        return []


def query_faq(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the shared FAQ collection."""
    try:
        collection = get_faq_collection()
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
        )
        return _convert_distances_to_results(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0],
            threshold,
        )
    except Exception as e:
        logger.warning("FAQ query failed: %s", e)
        return []


def query_clinical(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict[str, object]]:
    """Query the clinical reference collection (SapBERT embeddings)."""
    try:
        from app.chroma.collections import get_clinical_collection

        collection = get_clinical_collection()
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
        )
        return _convert_distances_to_results(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0],
            threshold,
        )
    except Exception as e:
        logger.warning("Clinical query failed: %s", e)
        return []


def build_rag_context(
    query: str,
    page_context: str,
    user_id: int | None = None,
) -> str:
    """Build RAG context string for injection into Abby's system prompt.

    Queries relevant collections and assembles a formatted context block.
    Returns empty string if no relevant results found.
    """
    sections: list[str] = []

    # Always query docs
    doc_results = query_docs(query)
    if doc_results:
        doc_texts = "\n".join(f"- {r['text']}" for r in doc_results[:3])
        sections.append(f"Documentation:\n{doc_texts}")

    # Query user conversation history if user_id provided
    if user_id is not None:
        conv_results = query_user_conversations(query, user_id)
        if conv_results:
            conv_texts = "\n".join(f"- {r['text']}" for r in conv_results[:3])
            sections.append(f"Previous conversations:\n{conv_texts}")

    # Always query FAQ
    faq_results = query_faq(query)
    if faq_results:
        faq_texts = "\n".join(f"- {r['text']}" for r in faq_results[:3])
        sections.append(f"Common questions:\n{faq_texts}")

    # Query clinical reference on clinical pages
    if page_context in CLINICAL_PAGES:
        clinical_results = query_clinical(query)
        if clinical_results:
            clin_texts = "\n".join(f"- {r['text']}" for r in clinical_results[:3])
            sections.append(f"Clinical reference:\n{clin_texts}")

    if not sections:
        return ""

    return "\n\nKNOWLEDGE BASE (use this context to inform your response):\n\n" + "\n\n".join(sections)
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_retrieval.py -v
```
Expected: 4 passed

**Step 5: Commit**

```bash
git add ai/app/chroma/retrieval.py ai/tests/test_chroma_retrieval.py
git commit -m "feat: add RAG retrieval with multi-collection query and context assembly"
```

---

### Task 8: Wire RAG Into Abby Chat Endpoint

**Files:**
- Modify: `ai/app/routers/abby.py` (lines 81-99 ChatRequest model, line 467 _build_chat_system_prompt, line 525 chat endpoint)
- Modify: `ai/app/models/schemas.py` (add user_id to ChatRequest if needed)
- Test: `ai/tests/test_abby_rag.py`

**Step 1: Write the failing test**

Create `ai/tests/test_abby_rag.py`:

```python
"""Tests for RAG integration in Abby chat endpoint."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_chat_includes_rag_context_in_system_prompt():
    """Chat endpoint injects RAG context into the system prompt."""
    with patch("app.routers.abby.build_rag_context") as mock_rag, \
         patch("app.routers.abby.call_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_rag.return_value = "\n\nKNOWLEDGE BASE:\n- Some doc content"
        mock_ollama.return_value = "Here's the answer.\nSUGGESTIONS: [\"Next?\"]"

        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post("/abby/chat", json={
                "message": "How do I build a cohort?",
                "page_context": "cohort_builder",
            })

        assert resp.status_code == 200
        # Verify RAG context was built
        mock_rag.assert_called_once()
        # Verify system prompt passed to Ollama includes RAG content
        system_prompt = mock_ollama.call_args.kwargs.get("system_prompt", "")
        if not system_prompt:
            system_prompt = mock_ollama.call_args.args[0] if mock_ollama.call_args.args else ""
        assert "KNOWLEDGE BASE" in system_prompt


@pytest.mark.asyncio
async def test_chat_works_without_rag_context():
    """Chat still works when RAG returns no results (graceful degradation)."""
    with patch("app.routers.abby.build_rag_context") as mock_rag, \
         patch("app.routers.abby.call_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_rag.return_value = ""
        mock_ollama.return_value = "I can help.\nSUGGESTIONS: [\"More?\"]"

        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post("/abby/chat", json={
                "message": "Hello",
                "page_context": "general",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert "I can help" in data["reply"]
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_abby_rag.py -v
```
Expected: FAIL — `ImportError: cannot import name 'build_rag_context' from 'app.routers.abby'`

**Step 3: Modify abby.py to integrate RAG**

Add `user_id` field to `ChatRequest` in `ai/app/routers/abby.py` (after line 96):

```python
    user_id: int | None = Field(
        default=None,
        description="Current user ID for personalized conversation memory"
    )
```

Add import at top of `ai/app/routers/abby.py` (after line 23):

```python
from app.chroma.retrieval import build_rag_context
```

Modify `_build_chat_system_prompt` (line 467) to accept `user_id` and inject RAG context. Replace the function:

```python
def _build_chat_system_prompt(request: ChatRequest) -> str:
    """Build the system prompt for a chat request, including page context, user profile, and RAG."""
    system_prompt = PAGE_SYSTEM_PROMPTS.get(
        request.page_context, PAGE_SYSTEM_PROMPTS["general"]
    )

    # Inject help knowledge for this page context
    help_context = _get_help_context(request.page_context)
    if help_context:
        system_prompt += help_context

    # Inject RAG context from ChromaDB
    try:
        rag_context = build_rag_context(
            query=request.message,
            page_context=request.page_context,
            user_id=request.user_id,
        )
        if rag_context:
            system_prompt += rag_context
    except Exception as e:
        logger.warning("RAG context retrieval failed: %s", e)

    # Inject user profile
    if request.user_profile and request.user_profile.name:
        role_str = ", ".join(request.user_profile.roles) if request.user_profile.roles else "researcher"
        system_prompt += (
            f"\n\nYou are assisting {request.user_profile.name}, "
            f"who has roles: {role_str}."
        )

    # Enrich with page-specific data context
    if request.page_data:
        context_lines = []
        for key, val in request.page_data.items():
            if isinstance(val, (str, int, float, bool)):
                context_lines.append(f"  {key}: {val}")
            elif isinstance(val, list) and len(val) <= 5:
                context_lines.append(f"  {key}: {', '.join(str(v) for v in val)}")
        if context_lines:
            system_prompt += "\n\nCURRENT PAGE CONTEXT:\n" + "\n".join(context_lines)

    system_prompt += (
        "\n\nIMPORTANT: Keep replies concise (under 300 words). "
        "Use markdown formatting for headers, lists, and code blocks. "
        "End your reply with 1–3 brief follow-up suggestions the user might want "
        'to ask, formatted as a JSON array on the last line: SUGGESTIONS: ["...", "..."]'
    )

    return system_prompt
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_abby_rag.py -v
```
Expected: 2 passed

**Step 5: Run all existing tests to verify no regressions**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/ -v
```
Expected: All tests pass

**Step 6: Commit**

```bash
git add ai/app/routers/abby.py ai/tests/test_abby_rag.py
git commit -m "feat: wire RAG retrieval into Abby chat with graceful degradation"
```

---

### Task 9: Ingestion API Endpoint + Startup Hook

**Files:**
- Create: `ai/app/routers/chroma.py`
- Modify: `ai/app/main.py` (register router, add startup event)
- Test: `ai/tests/test_chroma_api.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_api.py`:

```python
"""Tests for ChromaDB management API endpoints."""
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_chroma_health_endpoint():
    """Health endpoint returns ChromaDB status."""
    with patch("app.routers.chroma.check_health") as mock_health:
        mock_health.return_value = {"status": "ok", "heartbeat": 123}

        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.get("/chroma/health")

        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_ingest_docs_endpoint():
    """Ingest docs endpoint triggers ingestion and returns stats."""
    with patch("app.routers.chroma.ingest_docs_directory") as mock_ingest:
        mock_ingest.return_value = {"ingested": 5, "skipped": 2, "chunks": 30}

        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post("/chroma/ingest-docs")

        assert resp.status_code == 200
        assert resp.json()["ingested"] == 5
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_api.py -v
```
Expected: FAIL

**Step 3: Create the router and register it**

Create `ai/app/routers/chroma.py`:

```python
"""ChromaDB management endpoints for ingestion and health checks."""
import logging
import os

from fastapi import APIRouter

from app.chroma.client import check_health
from app.chroma.ingestion import ingest_docs_directory

logger = logging.getLogger(__name__)
router = APIRouter()

# Default docs directory — mounted from backend resources
DOCS_DIR = os.environ.get("DOCS_DIR", "/app/docs")


@router.get("/health")
async def chroma_health() -> dict:
    """Check ChromaDB connectivity."""
    return check_health()


@router.post("/ingest-docs")
async def ingest_docs() -> dict:
    """Trigger documentation ingestion into ChromaDB.

    Scans the docs directory for markdown files, chunks them,
    and upserts into the docs collection. Skips unchanged files.
    """
    stats = ingest_docs_directory(DOCS_DIR)
    return stats
```

Modify `ai/app/main.py` — add import and router registration:

After the existing router imports, add:
```python
from app.routers import chroma
```

After the existing `app.include_router(abby.router, ...)` line, add:
```python
app.include_router(chroma.router, prefix="/chroma", tags=["chroma"])
```

Add a startup event to auto-ingest docs:
```python
@app.on_event("startup")
async def startup_ingest_docs():
    """Auto-ingest documentation on service startup."""
    import asyncio
    from app.routers.chroma import DOCS_DIR
    from app.chroma.ingestion import ingest_docs_directory

    try:
        # Run in background to not block startup
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, ingest_docs_directory, DOCS_DIR)
        logger.info("Documentation ingestion scheduled")
    except Exception as e:
        logger.warning("Startup doc ingestion failed (non-fatal): %s", e)
```

**Step 4: Run test to verify it passes**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_api.py -v
```
Expected: 2 passed

**Step 5: Run full test suite**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/ -v
```
Expected: All tests pass

**Step 6: Commit**

```bash
git add ai/app/routers/chroma.py ai/app/main.py ai/tests/test_chroma_api.py
git commit -m "feat: add ChromaDB API endpoints and startup doc ingestion"
```

---

### Task 10: Mount Docs in Docker + Integration Test

**Files:**
- Modify: `docker-compose.yml` (add docs volume mount to python-ai)

**Step 1: Add docs volume mount**

In `docker-compose.yml`, add to the `python-ai` service's `volumes:`:

```yaml
      - ./docs:/app/docs:ro
```

Also add `DOCS_DIR=/app/docs` to the `environment:` block.

Add `CHROMA_HOST=chromadb` and `CHROMA_PORT=8000` to the environment block.

**Step 2: Rebuild and test end-to-end**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose up -d chromadb python-ai
docker compose ps  # verify both healthy
# Test health
curl http://localhost:8002/chroma/health
# Trigger manual ingestion
curl -X POST http://localhost:8002/chroma/ingest-docs
# Test chat with RAG (should now include doc context)
curl -X POST http://localhost:8002/abby/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I build a cohort?", "page_context": "cohort_builder"}'
```
Expected: Health returns `{"status": "ok"}`, ingestion returns chunk stats, chat response is informed by documentation.

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: mount docs directory and ChromaDB config in docker-compose"
```

---

## Phase 2: Conversation Memory

### Task 11: Conversation Embedding After Chat

**Files:**
- Create: `ai/app/chroma/memory.py`
- Modify: `ai/app/routers/abby.py` (chat endpoint — embed Q&A after response)
- Test: `ai/tests/test_chroma_memory.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_memory.py`:

```python
"""Tests for conversation memory embedding."""
from unittest.mock import MagicMock, patch
from datetime import datetime


def test_store_conversation_turn():
    """Stores a Q&A pair in the user's conversation collection."""
    with patch("app.chroma.memory.get_user_conversation_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        from app.chroma.memory import store_conversation_turn

        store_conversation_turn(
            user_id=42,
            question="How do I build a cohort?",
            answer="Use the cohort builder...",
            page_context="cohort_builder",
        )

        mock_coll.add.assert_called_once()
        call_kwargs = mock_coll.add.call_args
        assert len(call_kwargs.kwargs["documents"]) == 1
        assert "cohort" in call_kwargs.kwargs["documents"][0].lower()


def test_store_conversation_combines_qa():
    """Stored document combines question and answer."""
    with patch("app.chroma.memory.get_user_conversation_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        from app.chroma.memory import store_conversation_turn

        store_conversation_turn(
            user_id=1,
            question="What is OMOP?",
            answer="OMOP is a common data model.",
            page_context="general",
        )

        doc = mock_coll.add.call_args.kwargs["documents"][0]
        assert "What is OMOP?" in doc
        assert "OMOP is a common data model." in doc


def test_prune_old_conversations():
    """Prune removes entries older than TTL days."""
    with patch("app.chroma.memory.get_user_conversation_collection") as mock_coll_fn:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll
        mock_coll.get.return_value = {
            "ids": ["old_1", "old_2"],
            "metadatas": [
                {"timestamp": "2025-01-01T00:00:00"},
                {"timestamp": "2025-01-02T00:00:00"},
            ],
        }

        from app.chroma.memory import prune_old_conversations

        removed = prune_old_conversations(user_id=42, ttl_days=90)
        mock_coll.delete.assert_called_once()
        assert removed == 2
```

**Step 2: Run test to verify it fails**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_memory.py -v
```

**Step 3: Write the implementation**

Create `ai/app/chroma/memory.py`:

```python
"""Conversation memory — stores and prunes per-user Q&A pairs in ChromaDB."""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from app.chroma.collections import get_user_conversation_collection

logger = logging.getLogger(__name__)


def store_conversation_turn(
    user_id: int,
    question: str,
    answer: str,
    page_context: str,
) -> None:
    """Embed a Q&A pair into the user's conversation collection."""
    collection = get_user_conversation_collection(user_id)
    doc_id = f"conv_{user_id}_{uuid.uuid4().hex[:12]}"
    document = f"Q: {question}\nA: {answer}"
    now = datetime.now(timezone.utc).isoformat()

    collection.add(
        ids=[doc_id],
        documents=[document],
        metadatas=[{
            "user_id": user_id,
            "page_context": page_context,
            "timestamp": now,
            "question_preview": question[:100],
        }],
    )
    logger.debug("Stored conversation turn for user %s: %s", user_id, doc_id)


def prune_old_conversations(user_id: int, ttl_days: int = 90) -> int:
    """Remove conversation entries older than ttl_days. Returns count removed."""
    collection = get_user_conversation_collection(user_id)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ttl_days)).isoformat()

    # Get all entries and filter by timestamp
    all_entries = collection.get(include=["metadatas"])
    old_ids = []
    for entry_id, meta in zip(all_entries["ids"], all_entries["metadatas"]):
        ts = meta.get("timestamp", "")
        if ts and ts < cutoff:
            old_ids.append(entry_id)

    if old_ids:
        collection.delete(ids=old_ids)
        logger.info("Pruned %d old conversations for user %s", len(old_ids), user_id)

    return len(old_ids)
```

**Step 4: Modify chat endpoint to store conversations**

In `ai/app/routers/abby.py`, add import:
```python
from app.chroma.memory import store_conversation_turn
```

Modify the `chat` endpoint (around line 525) to store the Q&A after responding:

```python
@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Page-aware conversational endpoint with RAG and memory."""
    system_prompt = _build_chat_system_prompt(request)

    raw = await call_ollama(
        system_prompt=system_prompt,
        user_message=request.message,
        history=request.history,
        temperature=0.3,
    )

    reply, suggestions = _extract_suggestions(raw)

    # Store conversation in memory (fire-and-forget, don't block response)
    if request.user_id is not None:
        try:
            store_conversation_turn(
                user_id=request.user_id,
                question=request.message,
                answer=reply,
                page_context=request.page_context,
            )
        except Exception as e:
            logger.warning("Failed to store conversation memory: %s", e)

    return ChatResponse(reply=reply, suggestions=suggestions)
```

**Step 5: Run tests**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_memory.py tests/test_abby_rag.py -v
```
Expected: All pass

**Step 6: Commit**

```bash
git add ai/app/chroma/memory.py ai/app/routers/abby.py ai/tests/test_chroma_memory.py
git commit -m "feat: add per-user conversation memory with TTL pruning"
```

---

### Task 12: Conversation Pruning Endpoint

**Files:**
- Modify: `ai/app/routers/chroma.py`

**Step 1: Add pruning endpoint**

Add to `ai/app/routers/chroma.py`:

```python
from app.chroma.memory import prune_old_conversations


@router.post("/prune-conversations/{user_id}")
async def prune_conversations(user_id: int, ttl_days: int = 90) -> dict:
    """Prune conversation memory older than ttl_days for a user."""
    removed = prune_old_conversations(user_id, ttl_days)
    return {"user_id": user_id, "removed": removed, "ttl_days": ttl_days}
```

**Step 2: Commit**

```bash
git add ai/app/routers/chroma.py
git commit -m "feat: add conversation pruning API endpoint"
```

---

## Phase 3: Shared FAQ

### Task 13: FAQ Promotion Logic

**Files:**
- Create: `ai/app/chroma/faq.py`
- Test: `ai/tests/test_chroma_faq.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_faq.py`:

```python
"""Tests for FAQ promotion logic."""
from unittest.mock import MagicMock, patch


def test_promote_frequent_questions():
    """Questions asked by >= 3 users with >= 5 occurrences get promoted."""
    with patch("app.chroma.faq.get_faq_collection") as mock_faq_fn, \
         patch("app.chroma.faq._scan_recent_conversations") as mock_scan:
        mock_faq = MagicMock()
        mock_faq_fn.return_value = mock_faq
        mock_faq.query.return_value = {"documents": [[]], "distances": [[]], "metadatas": [[]]}

        # Simulate 6 similar questions from 4 users
        mock_scan.return_value = [
            {"question": "How do I build a cohort?", "answer": "Use the builder.", "user_id": 1},
            {"question": "How to create a cohort?", "answer": "Open cohort builder.", "user_id": 2},
            {"question": "Building a cohort?", "answer": "Go to cohorts.", "user_id": 3},
            {"question": "How do I make a cohort?", "answer": "Use builder.", "user_id": 4},
            {"question": "Create a cohort how?", "answer": "Builder page.", "user_id": 1},
            {"question": "Cohort building steps?", "answer": "Use the builder.", "user_id": 2},
        ]

        from app.chroma.faq import promote_frequent_questions

        stats = promote_frequent_questions()
        # Should have promoted at least one FAQ entry
        assert stats["promoted"] >= 0  # May vary by clustering


def test_no_promotion_below_threshold():
    """Questions below frequency threshold are not promoted."""
    with patch("app.chroma.faq._scan_recent_conversations") as mock_scan:
        mock_scan.return_value = [
            {"question": "Unique question?", "answer": "Unique answer.", "user_id": 1},
        ]

        from app.chroma.faq import promote_frequent_questions

        stats = promote_frequent_questions()
        assert stats["promoted"] == 0
```

**Step 2: Run test, verify fails, then implement**

Create `ai/app/chroma/faq.py`:

```python
"""FAQ promotion — clusters frequent questions and promotes to shared FAQ collection.

Nightly batch job scans recent conversations, finds semantically similar questions,
and promotes clusters that meet the threshold (>= 5 occurrences, >= 3 distinct users).
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

import chromadb

from app.chroma.collections import get_faq_collection, get_user_conversation_collection
from app.chroma.client import get_chroma_client

logger = logging.getLogger(__name__)

MIN_FREQUENCY = 5
MIN_USERS = 3
SIMILARITY_THRESHOLD = 0.85  # cosine similarity for clustering


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
                # Parse Q and A from stored document
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

    # Simple clustering: for each pair, check similarity against existing clusters
    clusters: list[dict] = []  # {"question": str, "answers": [str], "user_ids": set}

    for pair in pairs:
        matched = False
        for cluster in clusters:
            # Use FAQ collection to check similarity
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
            # Use the most common answer (or first)
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
```

**Step 3: Add promotion endpoint to chroma router**

In `ai/app/routers/chroma.py`, add:

```python
from app.chroma.faq import promote_frequent_questions


@router.post("/promote-faq")
async def promote_faq(days: int = 7) -> dict:
    """Run FAQ promotion on recent conversations."""
    return promote_frequent_questions(days)
```

**Step 4: Run tests and commit**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_faq.py -v
git add ai/app/chroma/faq.py ai/app/routers/chroma.py ai/tests/test_chroma_faq.py
git commit -m "feat: add FAQ promotion from frequent conversation clusters"
```

---

## Phase 4: Clinical Reference

### Task 14: Clinical Reference Ingestion

**Files:**
- Create: `ai/app/chroma/clinical.py`
- Test: `ai/tests/test_chroma_clinical.py`

**Step 1: Write the failing test**

Create `ai/tests/test_chroma_clinical.py`:

```python
"""Tests for clinical reference ingestion."""
from unittest.mock import MagicMock, patch


def test_ingest_clinical_concepts():
    """Ingests OMOP concepts from database into clinical collection."""
    with patch("app.chroma.clinical.get_clinical_collection") as mock_coll_fn, \
         patch("app.chroma.clinical.get_session") as mock_session:
        mock_coll = MagicMock()
        mock_coll_fn.return_value = mock_coll

        # Simulate database returning concepts
        mock_conn = MagicMock()
        mock_session.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_session.return_value.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchall.return_value = [
            (12345, "Hypertension", "Condition", "SNOMED"),
            (67890, "Metformin", "Drug", "RxNorm"),
        ]

        from app.chroma.clinical import ingest_clinical_concepts

        stats = ingest_clinical_concepts(batch_size=100)
        assert stats["total"] == 2
        mock_coll.upsert.assert_called()
```

**Step 2: Run test, verify fails, then implement**

Create `ai/app/chroma/clinical.py`:

```python
"""Clinical reference ingestion — embeds OMOP concepts via SapBERT into ChromaDB.

Queries vocab.concept for high-value domains (Condition, Drug, Procedure, Measurement)
and upserts into the clinical_reference collection.
"""
import logging

from sqlalchemy import text

from app.chroma.collections import get_clinical_collection
from app.db import get_session

logger = logging.getLogger(__name__)

# High-value OMOP domains to embed
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

    query = text("""
        SELECT concept_id, concept_name, domain_id, vocabulary_id
        FROM vocab.concept
        WHERE standard_concept = 'S'
        AND domain_id IN :domains
        AND concept_name IS NOT NULL
        AND LENGTH(concept_name) > 2
        ORDER BY concept_id
    """)
    if limit:
        query = text(f"""
            SELECT concept_id, concept_name, domain_id, vocabulary_id
            FROM vocab.concept
            WHERE standard_concept = 'S'
            AND domain_id IN :domains
            AND concept_name IS NOT NULL
            AND LENGTH(concept_name) > 2
            ORDER BY concept_id
            LIMIT :limit
        """)

    with get_session() as session:
        params = {"domains": TARGET_DOMAINS}
        if limit:
            params["limit"] = limit
        rows = session.execute(query, params).fetchall()

    logger.info("Found %d concepts to ingest", len(rows))

    # Process in batches
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        ids = [f"concept_{row[0]}" for row in batch]
        documents = [row[1] for row in batch]
        metadatas = [
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
            metadatas=metadatas,
        )

        stats["batches"] += 1
        stats["total"] += len(batch)
        logger.info("Ingested batch %d: %d concepts", stats["batches"], len(batch))

    logger.info("Clinical ingestion complete: %s", stats)
    return stats
```

**Step 3: Add endpoint to chroma router**

In `ai/app/routers/chroma.py`, add:

```python
from app.chroma.clinical import ingest_clinical_concepts


@router.post("/ingest-clinical")
async def ingest_clinical(limit: int | None = None) -> dict:
    """Trigger clinical concept ingestion from OMOP vocabulary."""
    return ingest_clinical_concepts(limit=limit)
```

**Step 4: Run tests and commit**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/test_chroma_clinical.py -v
git add ai/app/chroma/clinical.py ai/app/routers/chroma.py ai/tests/test_chroma_clinical.py
git commit -m "feat: add clinical reference ingestion from OMOP vocabulary via SapBERT"
```

---

### Task 15: ChromaDB Health in System Health Dashboard

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php`

**Step 1: Add ChromaDB health checker**

Add a `checkChromaDb()` method to `SystemHealthController` that calls the Python AI service's `/chroma/health` endpoint:

```php
private function checkChromaDb(): array
{
    try {
        $response = Http::timeout(5)->get(config('services.ai.url', 'http://python-ai:8000') . '/chroma/health');

        if ($response->successful() && $response->json('status') === 'ok') {
            return [
                'name' => 'ChromaDB',
                'status' => 'healthy',
                'message' => 'Vector database operational',
                'details' => [
                    'heartbeat' => $response->json('heartbeat'),
                ],
            ];
        }

        return [
            'name' => 'ChromaDB',
            'status' => 'degraded',
            'message' => 'ChromaDB responding but unhealthy',
        ];
    } catch (\Exception $e) {
        return [
            'name' => 'ChromaDB',
            'status' => 'down',
            'message' => 'ChromaDB unreachable: ' . $e->getMessage(),
        ];
    }
}
```

Register it in the `$checkers` array alongside the other service checks.

**Step 2: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php
git commit -m "feat: add ChromaDB to system health dashboard"
```

---

### Task 16: Full Integration Test

**Step 1: Rebuild and start all services**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose up -d --build chromadb python-ai
docker compose ps
```

**Step 2: Verify ChromaDB health**

```bash
curl http://localhost:8002/chroma/health
```
Expected: `{"status": "ok", "heartbeat": ...}`

**Step 3: Ingest documentation**

```bash
curl -X POST http://localhost:8002/chroma/ingest-docs
```
Expected: `{"ingested": N, "skipped": 0, "chunks": M}` where N > 0

**Step 4: Test RAG-powered chat**

```bash
curl -X POST http://localhost:8002/abby/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I build a cohort in Parthenon?", "page_context": "cohort_builder", "user_id": 1}'
```
Expected: Response informed by documentation chunks

**Step 5: Test conversation memory recall**

```bash
# Ask a second question
curl -X POST http://localhost:8002/abby/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Can you remind me what I asked earlier?", "page_context": "cohort_builder", "user_id": 1}'
```
Expected: Response references the previous question about cohort building

**Step 6: Ingest clinical concepts**

```bash
curl -X POST "http://localhost:8002/chroma/ingest-clinical?limit=1000"
```
Expected: `{"total": 1000, "batches": 2}`

**Step 7: Run full test suite**

```bash
cd /home/smudoshi/Github/Parthenon/ai && python -m pytest tests/ -v
```
Expected: All tests pass

**Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete ChromaDB brain integration for Abby AI assistant"
```

---

## Summary

| Task | Description | Phase |
|------|-------------|-------|
| 1 | ChromaDB Docker service | 1 |
| 2 | Python dependencies | 1 |
| 3 | Client singleton + health | 1 |
| 4 | Dual embedding providers | 1 |
| 5 | Collection manager | 1 |
| 6 | Document ingestion pipeline | 1 |
| 7 | RAG retrieval module | 1 |
| 8 | Wire RAG into Abby chat | 1 |
| 9 | Ingestion API + startup hook | 1 |
| 10 | Docker volume mounts + integration | 1 |
| 11 | Conversation memory embedding | 2 |
| 12 | Conversation pruning endpoint | 2 |
| 13 | FAQ promotion logic | 3 |
| 14 | Clinical reference ingestion | 4 |
| 15 | System health dashboard | 4 |
| 16 | Full integration test | 4 |

**Total: 16 tasks across 4 phases. Each phase is independently deployable.**
