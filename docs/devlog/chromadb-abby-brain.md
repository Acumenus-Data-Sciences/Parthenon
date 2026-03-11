# ChromaDB Brain for Abby AI Assistant

**Date:** 2026-03-11
**Scope:** ChromaDB vector knowledge base — documentation RAG, conversation memory, shared FAQ, clinical reference ingestion

## What Was Built

Added ChromaDB as a persistent vector knowledge base ("brain") for Abby, enabling RAG-powered responses instead of static help JSON injection. Abby now retrieves relevant documentation chunks, recalls per-user conversation history, surfaces common Q&A, and (on clinical pages) injects OMOP concept context.

### Architecture

**Pattern:** Sidecar — ChromaDB runs as a standalone Docker container. The Python AI service is the sole gateway for all reads/writes. Laravel never talks to ChromaDB directly.

```
Laravel API -> Python AI Service -> ChromaDB (8000)
                    |                    |
               Ollama (MedGemma)    4 collections
```

**Dual Embedding Strategy:**
- `all-MiniLM-L6-v2` (384-dim, sentence-transformers) — docs, conversations, FAQ
- `SapBERT` (768-dim, already deployed) — clinical reference content

### Four Knowledge Layers

| Collection | Purpose | Embedding | Scale |
|---|---|---|---|
| `docs` | Documentation chunks from `docs/` directory | sentence-transformers | 39,092 chunks from 1,961 files |
| `conversations_user_{id}` | Per-user Q&A memory (90-day TTL) | sentence-transformers | Created per user on first chat |
| `faq_shared` | Auto-promoted frequent questions | sentence-transformers | Populated via nightly batch |
| `clinical_reference` | OMOP concepts (Condition, Drug, Procedure, Measurement) | SapBERT | Bulk-loaded from vocab.concept |

### Query Flow

1. User sends message + page_context + user_id
2. AI service queries relevant ChromaDB collections (always docs + FAQ; user conversations if user_id provided; clinical reference on clinical pages)
3. Results filtered by cosine similarity threshold (>0.7), max 3 per collection
4. RAG context injected into system prompt alongside existing page-context prompts
5. Ollama generates response with knowledge base context
6. Q&A pair stored in user's conversation collection (fire-and-forget)

### Files Created

| File | Purpose |
|------|---------|
| `ai/app/chroma/__init__.py` | Package init |
| `ai/app/chroma/client.py` | ChromaDB HTTP client singleton + health check |
| `ai/app/chroma/embeddings.py` | Dual embedding providers (GeneralEmbedder + ClinicalEmbedder) |
| `ai/app/chroma/collections.py` | Four collection accessors with lazy creation |
| `ai/app/chroma/ingestion.py` | Markdown-aware doc chunking with content-hash dedup |
| `ai/app/chroma/retrieval.py` | Multi-collection RAG query + context assembly |
| `ai/app/chroma/memory.py` | Per-user conversation storage + TTL pruning |
| `ai/app/chroma/faq.py` | FAQ promotion from frequent conversation clusters |
| `ai/app/chroma/clinical.py` | OMOP concept ingestion via SapBERT |
| `ai/app/routers/chroma.py` | Management API (health, ingest, prune, promote) |

### Files Modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added chromadb container, docs volume mount, env vars |
| `ai/requirements.txt` | Added chromadb, sentence-transformers, langchain-text-splitters; pinned transformers<5 |
| `ai/app/config.py` | Added chroma_host, chroma_port settings |
| `ai/app/main.py` | Registered chroma router, added startup doc ingestion |
| `ai/app/routers/abby.py` | Added user_id to ChatRequest, RAG context in system prompt, conversation storage |
| `backend/.../SystemHealthController.php` | Added ChromaDB health monitoring |

### API Endpoints Added

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/chroma/health` | ChromaDB connectivity check |
| POST | `/chroma/ingest-docs` | Trigger documentation ingestion |
| POST | `/chroma/ingest-clinical` | Trigger OMOP concept ingestion |
| POST | `/chroma/promote-faq` | Run FAQ promotion on recent conversations |
| POST | `/chroma/prune-conversations/{user_id}` | Remove old conversation entries |

### Test Coverage

54 tests across 8 test files, all passing:
- `test_chroma_client.py` — singleton, health check (4 tests)
- `test_chroma_embeddings.py` — dual embedders, ChromaDB compatibility (3 tests)
- `test_chroma_collections.py` — all four collection accessors (4 tests)
- `test_chroma_ingestion.py` — chunking, hashing, dedup, ingestion (5 tests)
- `test_chroma_retrieval.py` — query, filtering, context assembly (4 tests)
- `test_chroma_memory.py` — conversation storage, pruning (3 tests)
- `test_chroma_faq.py` — promotion logic, threshold enforcement (2 tests)
- `test_chroma_clinical.py` — concept ingestion, empty handling (3 tests)
- `test_abby_rag.py` — RAG integration, graceful degradation (2 tests)
- `test_chroma_api.py` — health + ingest endpoints (2 tests)

### Deployment Notes

- ChromaDB container: `chromadb/chroma:latest` — no curl/python in image, healthcheck uses `bash /dev/tcp`
- `sentence-transformers==4.*` requires `transformers<5` — pinned `transformers>=4.41,<5`
- First doc ingestion downloads `all-MiniLM-L6-v2` model (~90MB), subsequent runs use cache
- Doc ingestion is content-hash based — only re-embeds changed files on restart

### Design Documents

- `docs/plans/2026-03-09-chromadb-abby-brain-design.md` — Approved design spec
- `docs/plans/2026-03-09-chromadb-abby-brain.md` — 16-task implementation plan
