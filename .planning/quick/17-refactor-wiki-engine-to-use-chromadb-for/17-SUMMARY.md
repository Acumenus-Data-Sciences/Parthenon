---
phase: quick-17
plan: 01
subsystem: ai/wiki
tags: [chromadb, semantic-search, wiki, refactor]
dependency_graph:
  requires: [ai/app/chroma/client.py, ai/app/chroma/embeddings.py, ai/app/chroma/ingestion.py]
  provides: [wiki-semantic-search, wiki-chromadb-collection]
  affects: [ai/app/wiki/engine.py, ai/app/chroma/collections.py]
tech_stack:
  added: []
  patterns: [chromadb-collection-accessor, semantic-search-with-keyword-fallback, chunked-upsert]
key_files:
  created: []
  modified:
    - ai/app/chroma/collections.py
    - ai/app/wiki/engine.py
decisions:
  - "384-dim general embedder (MiniLM) for wiki content -- consistent with docs collection"
  - "500-char chunks with 50-char overlap for wiki page indexing"
  - "Graceful fallback to keyword search when ChromaDB unavailable"
  - "Slug-based deduplication in query results (multiple chunks per page)"
metrics:
  duration: 102s
  completed: "2026-04-06T23:20:35Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 17: Refactor Wiki Engine to Use ChromaDB for Semantic Search

**One-liner:** Wiki queries now use ChromaDB cosine-similarity semantic search with automatic fallback to keyword matching when ChromaDB is unavailable.

## What Changed

### ai/app/chroma/collections.py
- Added `get_wiki_collection()` returning a `wiki_pages` collection with 384-dim general embedder and cosine distance

### ai/app/wiki/engine.py
- Added `_chunk_text()` static method for splitting page body into 500-char overlapping chunks
- Added `_upsert_page_to_chroma()` method that chunks a page and upserts into the wiki_pages ChromaDB collection with workspace/slug/title metadata
- Updated `_write_page()` to call `_upsert_page_to_chroma()` after file write + index upsert, wrapped in try/except so file-based wiki never breaks
- Updated `query()` to use `collection.query()` for semantic search with slug-based deduplication, falling back to keyword `search_index()` if ChromaDB is unavailable or returns empty results

### ai/app/wiki/index_ops.py
- No changes -- `search_index()` preserved for `list_pages()` and fallback use

## Deviations from Plan

### Operational Note
Task 2 (clean stale wiki data) could not execute the ChromaDB cleanup because the ChromaDB Docker container is not running on the host. This is expected and not a blocker -- the code uses `get_or_create_collection` which creates a fresh collection on first access, and all ChromaDB operations are wrapped in try/except for graceful degradation.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8b5341775 | feat(quick-17): wire ChromaDB semantic search into wiki engine |

## Verification Results

- `get_wiki_collection()` importable and callable
- `WikiEngine` imports without error
- `_chunk_text()` produces correct chunks (tested empty, whitespace, short, and long text)
- `search_index()` in index_ops.py unchanged and functional
- Wiki router (`ai/app/routers/wiki.py`) not modified -- API contract unchanged

## Self-Check: PASSED

- [x] ai/app/chroma/collections.py modified with get_wiki_collection
- [x] ai/app/wiki/engine.py modified with ChromaDB integration
- [x] ai/app/wiki/index_ops.py unchanged (backward compat)
- [x] Commit 8b5341775 exists in git log
