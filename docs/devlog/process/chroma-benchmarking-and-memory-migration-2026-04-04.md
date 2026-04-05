# Chroma Benchmarking And Memory Migration

**Date:** 2026-04-04
**Status:** Complete
**Scope:** Abby ChromaDB efficiency changes, benchmark harness, and live migration validation

## Summary

Added a reusable benchmark harness at `ai/scripts/chroma_benchmark.py` to measure the ChromaDB paths changed during Abby's recent performance work. Running the benchmark against the live `parthenon-ai` and `parthenon-chromadb` containers confirmed the expected wins:

- cached collection handles remove repeated `get_or_create_collection(...)` overhead
- removing the OHDSI `count()` probe saves a round-trip per request
- removing Abby's dual-write nearly halves write latency
- the shared `conversation_memory` collection improves scan behavior and operational shape
- startup doc ingestion is now truly opt-in instead of running on every AI boot

The benchmark also exposed a migration gap: the new `conversation_memory` collection did not exist yet, while legacy `conversations_user_*` collections still held Abby history. Running `aggregate_conversations()` backfilled the shared collection and restored the new retrieval path against real data.

## Harness

Script:

```bash
python ai/scripts/chroma_benchmark.py
python ai/scripts/chroma_benchmark.py --json
docker exec -i parthenon-ai python /app/scripts/chroma_benchmark.py --json
```

What it measures:

1. Cached collection access vs repeated `get_or_create_collection(...)`
2. OHDSI retrieval with and without the removed `count()` probe
3. Legacy Abby dual-write vs shared single-write
4. Legacy per-user query vs shared filtered query
5. Legacy multi-collection FAQ scan vs shared single-collection scan
6. Startup doc-ingest disabled fast path

The harness uses live `docs` and `ohdsi_papers` collections for round-trip timing and temporary benchmark collections for write/query/scan shape comparisons. Temporary collections are cleaned up automatically.

## Live Benchmark Results

Measured from the running `parthenon-ai` container:

| Benchmark | Mean | Notes |
|----------|------|-------|
| `collection_access_legacy` | `0.63 ms` | repeated `get_or_create_collection(...)` on `docs` |
| `collection_access_cached` | `0.00 ms` | hot cached accessor |
| `ohdsi_query_only` | `9.31 ms` | current behavior |
| `ohdsi_count_plus_get` | `15.11 ms` | legacy extra round-trip |
| `legacy_dual_write` | `65.44 ms` | Abby Q&A written twice |
| `shared_single_write` | `30.64 ms` | Abby Q&A written once to shared memory |
| `legacy_per_user_query` | `1.90 ms` | one collection per user |
| `shared_filtered_query` | `1.33 ms` | one shared collection with `where={"user_id": ...}` |
| `legacy_multi_collection_scan` | `21.50 ms` | FAQ-style scan across many collections |
| `shared_single_collection_scan` | `15.48 ms` | FAQ-style scan over shared memory |
| `startup_ingest_disabled` | `0.047 ms` | disabled path returns immediately |

Interpretation:

- Removing the OHDSI `count()` probe saves about `5.81 ms` per call, roughly `38%` on that path.
- Removing Abby's dual-write cut write latency by about `53%`.
- Shared filtered point queries stay low-single-digit milliseconds and were slightly faster on the verified run than the per-user collection benchmark, while remaining materially better for writes, scans, and operations overall.
- The startup-ingest change matters because it avoids a full docs ingest during every AI worker boot, not because the disabled branch itself is expensive.

## Migration Gap Found During Benchmarking

Before the backfill:

| Collection | Count |
|-----------|-------|
| `conversations_user_1` | `6` |
| `conversations` | `6` |
| `conversation_memory` | missing |

That meant the new Abby retrieval path could query `conversation_memory` while old data still lived only in legacy collections.

Backfill command:

```bash
docker exec -i parthenon-ai python - <<'PY'
from app.chroma.memory import aggregate_conversations
print(aggregate_conversations())
PY
```

Backfill result:

```python
{'users': 1, 'total': 6, 'upserted': 6}
```

After the backfill:

| Collection | Count |
|-----------|-------|
| `conversation_memory` | `6` |
| `conversations_user_1` | `6` |

Live sanity check after migration:

```bash
docker exec -i parthenon-ai python - <<'PY'
from app.chroma.retrieval import query_user_conversations
print(query_user_conversations(user_id=1, query='What is OMOP?', top_k=3))
PY
```

The new shared-memory retrieval path returned results successfully.

## Files Added

- `ai/scripts/chroma_benchmark.py`
- `docs/devlog/process/chroma-benchmarking-and-memory-migration-2026-04-04.md`

## Follow-Up

- Keep `aggregate_conversations` available until all legacy `conversations_user_*` collections are drained.
- Run `ai/scripts/chroma_benchmark.py` after future Chroma schema or Abby memory changes so regressions are measured instead of inferred.
