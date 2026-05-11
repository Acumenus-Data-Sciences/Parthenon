# ChromaDB Brain for Abby AI Assistant

**Date:** 2026-03-09
**Status:** Approved

## Overview

Add ChromaDB as a persistent vector knowledge base ("brain") for Parthenon's Abby AI assistant, enabling continuous learning from documentation, conversations, shared FAQ, and clinical references.

## Architecture

**Pattern:** Sidecar — ChromaDB runs as a standalone Docker container. The Python AI service is the sole gateway for all reads/writes. Laravel never talks to Chroma directly.

```
Laravel API -> Python AI Service -> ChromaDB container
                    |
               Ollama (MedGemma)
```

## Infrastructure

- **ChromaDB container** (`chromadb/chroma:latest`) in docker-compose
- Persistent volume at `/chroma/data`
- Internal network only (no public port)
- Health check on `/api/v1/heartbeat`

## Collections

| Collection | Embedding Model | Purpose | Metadata |
|---|---|---|---|
| `docs` | all-MiniLM-L6-v2 | Documentation chunks | `source`, `section`, `version` |
| `conversations_user_{id}` | all-MiniLM-L6-v2 | Per-user conversation history | `timestamp`, `page_context`, `topic` |
| `faq_shared` | all-MiniLM-L6-v2 | Promoted common Q&A | `frequency`, `last_seen`, `source_users_count` |
| `clinical_reference` | SapBERT | OMOP concepts, clinical guidelines | `concept_id`, `domain`, `vocabulary_id` |

## Embedding Strategy

- **Dual models:** SapBERT for clinical/medical content, sentence-transformers (all-MiniLM-L6-v2) for general text
- **Chunking:** 512-token chunks with 64-token overlap, markdown-aware recursive text splitter

## Query Flow

1. User sends message + page_context
2. AI service receives request
3. Query relevant Chroma collections based on page_context:
   - Always: `docs` collection
   - Always: `conversations_user_{id}` for personal history
   - Always: `faq_shared` for common answers
   - Clinical pages: also `clinical_reference`
4. Assemble RAG context (top-k results, deduplicated, ranked by relevance)
5. Inject RAG context into system prompt alongside existing page-context prompts
6. Send to Ollama (MedGemma)
7. After response, embed the Q&A pair into user's conversation collection
8. Return response to Laravel

**Relevance threshold:** Only inject results with similarity > 0.7. Max 3 chunks per collection.

## Ingestion Pipelines

### 1. Documentation (startup + on-demand)
- Scan `docs/` for markdown on AI service startup
- Content-hash files, only re-embed if changed
- Endpoint: `POST /api/chroma/ingest-docs`

### 2. Conversation Memory (real-time)
- Embed Q&A pair asynchronously after each chat response
- Store in `conversations_user_{id}` with page_context metadata
- TTL: Prune entries older than 90 days

### 3. FAQ Promotion (nightly batch)
- Cluster semantically similar questions (>0.85 similarity)
- Promote clusters with >= 5 occurrences from >= 3 distinct users
- Generate canonical Q&A pair for `faq_shared`

### 4. Clinical Reference (one-time + incremental)
- Bulk embed OMOP concepts from `vocab.concept` using SapBERT
- Filter: Condition, Drug, Procedure, Measurement domains
- Re-embed on vocabulary version change
- Endpoint: `POST /api/chroma/ingest-clinical`

## Phased Rollout

### Phase 1 — Foundation (Week 1)
- ChromaDB container in docker-compose
- `ai/app/chroma/` module (client, embeddings, collections)
- `docs` collection ingestion
- RAG retrieval wired into chat endpoint
- **Milestone:** Abby answers docs questions via vector search

### Phase 2 — Conversation Memory (Week 2)
- Per-user conversation embedding after each chat
- History retrieval in query flow
- 90-day TTL pruning
- **Milestone:** Abby recalls previous session context per user

### Phase 3 — Shared FAQ (Week 3)
- Nightly question clustering batch job
- FAQ promotion with frequency/user thresholds
- FAQ retrieval in query flow
- **Milestone:** Common questions get instant consistent answers

### Phase 4 — Clinical Reference (Week 4)
- SapBERT bulk embedding of OMOP concepts
- Clinical collection queried on medical pages
- Incremental vocab update support
- **Milestone:** Abby provides OMOP concept context for clinical discussions

## Dependencies

**Python packages** (added to `ai/requirements.txt`):
- `chromadb`
- `sentence-transformers`
- `langchain-text-splitters`

**No changes** to Laravel backend or React frontend dependencies.

## Scale

Initial target: <10 users, hundreds of documents, ~50 conversations/day. Architecture supports scaling to medium via Approach 3 (event-driven with Redis) if needed.

## New Python Module Structure

```
ai/app/chroma/
  __init__.py
  client.py        -- ChromaDB client singleton, connection, health check
  collections.py   -- Collection creation/access with embedding functions
  embeddings.py    -- Dual embedding provider (sentence-transformers + SapBERT)
  ingestion.py     -- Document chunking, metadata extraction, upsert
  retrieval.py     -- Query methods per collection, ranking, context assembly
```
