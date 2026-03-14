# Solr Integration — Phase 5: Concept Mapping & Ingestion Search

**Date:** 2026-03-06
**Scope:** Solr `mappings` core for concept mapping search, faceted filtering, and global search integration

## What Was Built

### Solr Schema — `mappings` Core

New configset at `solr/configsets/mappings/conf/`:
- `schema.xml` — 17 fields: id (string uniqueKey), ingestion_job_id, source_code, source_code_text (text_general copyField), source_description, source_vocabulary_id, target_concept_id, target_concept_name, target_domain_id, confidence, strategy, review_tier, is_reviewed, source_table, source_column, source_frequency, job_file_name, created_at
- `solrconfig.xml` — edismax defaults: qf=source_code_text^3 source_description^2 target_concept_name^2 source_code^1, highlighting, caching
- `stopwords.txt` — standard English stopwords
- copyField: source_code (string) -> source_code_text (text_general) for full-text search on codes
- **Fix:** uniqueKey must be `string` type, not `pint` (Solr Points fields can't be uniqueKeys)

### Indexing Command

`php artisan solr:index-mappings` — indexes ConceptMapping records from all ingestion jobs:
- Iterates ConceptMappings with eager-loaded ingestionJob and top candidate
- Enriches each doc with target_concept_name from best MappingCandidate (rank=1)
- Caches job metadata (file name) to avoid repeated lookups
- Batches in chunks of 500 via `chunkById()`
- Supports `--job=ID` for single-job and `--fresh` for full rebuild

### Search Service

`MappingSearchService.php` — Solr-powered mapping search:
- `search(query, filters, limit, offset)` with edismax, facets on review_tier, source_vocabulary_id, target_domain_id, strategy, is_reviewed, source_table
- Filters: ingestion_job_id, review_tier, is_reviewed, source_vocabulary_id, target_domain_id, confidence_min, confidence_max
- `indexMapping(doc)` for single-document indexing
- `deleteByJob(jobId)` for cleanup on job deletion
- Returns items, total, facets (same envelope as other Solr services)

### API Endpoint

`GET /api/v1/ingestion/mappings/search` — cross-job mapping search:
- Query params: q, ingestion_job_id, review_tier, is_reviewed, source_vocabulary_id, target_domain_id, confidence_min, confidence_max, limit, offset
- Solr-first with PostgreSQL ILIKE fallback
- Returns `{data, total, facets, engine}`
- Added to MappingReviewController

### Global Search Integration

Updated `GlobalSearchService` to search the mappings core in parallel:
- Cmd+K palette now shows mapping results with GitMerge icon
- Links to `/ingestion/jobs/{jobId}/review`
- 5 cores searched simultaneously: vocabulary, cohorts, studies, analyses, mappings

### Admin Panel Integration

Updated `SolrAdminController`:
- `reindex('mappings')` maps to `solr:index-mappings`
- `reindex-all` includes mappings in the sequential rebuild

### Frontend Integration

- `ingestionApi.ts` — added `searchMappings()` function
- `MappingReviewPage.tsx` — filter tabs show Solr facet counts for review_tier when available
- `CommandPalette.tsx` — GitMerge icon for mapping type in global search results

### Docker

Updated `docker-compose.yml`:
- Added `mappings` configset volume mount
- Added `precreate-core mappings` to Solr startup command

## Verification

- Mappings core responds to ping: `curl http://localhost:8983/solr/mappings/admin/ping` — 200 OK
- Indexing command runs clean (0 docs indexed — no ingestion jobs in DB yet, as expected)
- TypeScript compiles clean
- Production build succeeds
- PHP Pint passes
- Route registered: `GET api/v1/ingestion/mappings/search`

## Files Created
- `solr/configsets/mappings/conf/schema.xml`
- `solr/configsets/mappings/conf/solrconfig.xml`
- `solr/configsets/mappings/conf/stopwords.txt`
- `backend/app/Services/Solr/MappingSearchService.php`
- `backend/app/Console/Commands/SolrIndexMappings.php`

## Files Modified
- `docker-compose.yml` — mappings core mount + precreate
- `backend/app/Http/Controllers/Api/V1/MappingReviewController.php` — inject MappingSearchService, add search()
- `backend/app/Http/Controllers/Api/V1/Admin/SolrAdminController.php` — add mappings to reindex/reindexAll
- `backend/app/Services/Solr/GlobalSearchService.php` — add mappings core to parallel fan-out
- `backend/routes/api.php` — add /ingestion/mappings/search route
- `frontend/src/features/ingestion/api/ingestionApi.ts` — add searchMappings()
- `frontend/src/features/ingestion/pages/MappingReviewPage.tsx` — facet counts on filter tabs
- `frontend/src/components/layout/CommandPalette.tsx` — GitMerge icon for mapping results
