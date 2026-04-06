# Abby Runtime Hardening and Provenance

Date: 2026-04-06

## Summary

This pass finished the Abby optimization work that was left partially deployed on 2026-04-05. The result is that Abby now returns grounded definitions with usable source metadata, avoids persisting low-value definition turns into shared memory, uses cleaner Chroma provenance across collections, and runs on a more stable `python-ai` runtime.

The runtime work also removed the last operational blockers from the local deployment:

- `python-ai` now runs as a single worker, which avoids duplicated embedder warmup and duplicated model state.
- heavy Chroma ingestion endpoints no longer block the only worker
- SapBERT no longer triple-loads under concurrent first-use retrieval
- the Hugging Face anonymous-access warning is gone because required models now load from the local cache only
- Abby no longer throws profile-save exceptions for nonexistent or schema-misresolved users

## What Changed

### Abby answer quality and memory policy

Primary files:

- `ai/app/routers/abby.py`
- `ai/app/chroma/memory.py`
- `ai/tests/test_abby_integration.py`
- `ai/tests/test_abby_prompt.py`
- `ai/tests/test_chroma_memory.py`

Key changes:

- added grounded-definition fast path for short definition questions
- returned real `sources` objects in `/abby/chat`
- filtered reference-only chunks so URL/reference fragments are not selected as answers
- skipped live DB context when a clean docs-grounded definition is already available
- retried clipped local answers with a larger visible-answer budget
- stripped hidden reasoning more aggressively
- stopped storing `grounded_definition` replies in shared conversation memory
- deduped exact repeated Q/A conversation turns before upsert

### Chroma provenance and collection separation

Primary files:

- `ai/app/chroma/collections.py`
- `ai/app/chroma/ingestion.py`
- `ai/app/chroma/retrieval.py`
- `ai/app/routers/chroma.py`
- `ai/tests/test_chroma_ingestion.py`
- `ai/tests/test_chroma_retrieval.py`
- `ai/tests/test_chroma_api.py`
- `docs/abby-seed/*`

Key changes:

- docs chunks now persist `title`, `source_file`, `section`, `subsection`, and `heading_path`
- frontmatter titles are preserved as provenance but stripped from retrievable chunk content
- retrieval normalizes provenance fields across docs, OHDSI, and textbook results
- textbooks remain in a dedicated `medical_textbooks` collection
- `/chroma/query` now resolves known collections through app accessors instead of raw default Chroma collection handles
- seed docs were added for ClinVar, HGVS, OMOP CDM, CohortMethod, and local genomics context

### Runtime hardening

Primary files:

- `docker-compose.yml`
- `docker/python/Dockerfile`
- `ai/app/config.py`
- `ai/app/chroma/embeddings.py`
- `ai/app/services/sapbert.py`
- `ai/app/services/ollama_client.py`
- `ai/tests/test_chroma_embeddings.py`
- `ai/tests/test_health.py`

Key changes:

- `python-ai` now runs with `--workers 1`
- container runs as host UID/GID so mounted docs are readable without broad chmod changes
- writable shared model cache moved to `/models`
- SentenceTransformer and SapBERT now load with `local_files_only=True`
- added explicit local-cache validation so missing `/models` fails clearly
- SapBERT model loading is protected by an internal lock
- Ollama health probe timeout was increased so `/health` reflects the actual Abby Ollama daemon
- text generation and embeddings are now isolated onto separate Ollama daemons in compose:
  - `11435` for Abby/general generation
  - `11434` for embedding workloads
- Ollama embedding probe now retries instead of caching a transient first-connection disconnect as permanent unavailability
- expensive ingestion endpoints now use the threadpool so the API stays responsive during reindexing

## Verification

Focused tests that passed during this pass:

- `pytest ai/tests/test_abby_integration.py -q` -> `67 passed`
- `pytest ai/tests/test_abby_prompt.py -q`
- `pytest ai/tests/test_chroma_api.py -q` -> `3 passed`
- `pytest ai/tests/test_chroma_embeddings.py -q` -> `6 passed`
- `pytest ai/tests/test_chroma_ingestion.py -q`
- `pytest ai/tests/test_chroma_memory.py -q`
- `pytest ai/tests/test_chroma_retrieval.py -q`
- `pytest ai/tests/test_health.py -q` -> `2 passed`

Live checks after redeploy:

- `/health` returned Abby Ollama status `ok`
- `What is HGVS nomenclature?` returned `HGVS stands for Human Genome Variation Society nomenclature.`
- `What is ClinVar?` returned the expected grounded definition with docs-backed `sources`
- cold-start HGVS response completed in about `0.66s` after the SapBERT load-race fix
- after isolating embeddings onto the 11434 daemon, `nomic-embed-text:latest` returned a `768`-dim embedding from inside `python-ai`, and the embedding daemon stayed loaded on GPU
- during `/chroma/ingest-docs`, `/health` still returned in about `0.02s`, confirming ingestion no longer blocks the single worker
- a full `/chroma/ingest-docs` pass completed with `{"ingested":10,"skipped":2788,"chunks":337}` in about `26.77s`
- previously unreadable docs files under `/app/docs/architecture` and `/app/docs/blog` were readable inside `python-ai`
- the Hugging Face anonymous warning no longer appeared after switching embedder loads to local-cache-only mode

## Remaining Optional Work

Nothing in this pass is blocked on immediate follow-up.

The remaining work is optimization rather than repair:

- if `/models` is ever cleared or a new embedding model is introduced, the cache must be repopulated before startup because the loaders now intentionally avoid the Hugging Face Hub
