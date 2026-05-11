# Solr Integration — Phase 4: Analysis Results & Data Explorer

**Date:** 2026-03-06
**Scope:** Solr `analyses` core for Achilles analysis metadata search and discovery

## What Was Built

### Solr Schema — `analyses` Core

New configset at `solr/configsets/analyses/conf/`:
- `schema.xml` — fields: analysis_id, analysis_name, category, source_id, source_name, stratum_1-5_name, row_count
- `solrconfig.xml` — edismax defaults boosting analysis_name^3 category^2, highlighting, suggest component
- `stopwords.txt` — standard English stopwords
- Compound unique key: `s{source_id}_a{analysis_id}` for multi-source support

### Indexing Command

`php artisan solr:index-analyses` — indexes Achilles analysis metadata from all sources:
- Iterates sources with `results` daimons
- Calls `AchillesResultReaderService::getAvailableAnalyses()` per source
- Batches documents in chunks of 200
- Supports `--source=ID` for single-source and `--fresh` for full rebuild
- Non-fatal per-source: logs errors, continues to next source
- **Result:** 190 analyses indexed (154 from Acumenus + 36 from Eunomia) in 0.5s

### Search Service

`AnalysesSearchService.php` — Solr-powered analysis search:
- `search(query, filters, limit, offset)` with edismax, facets on category + source_name
- Filters: `source_id`, `category`
- Returns items, total, facets, highlights (same envelope as other services)

### API Endpoint

`GET /api/v1/analyses/search` — cross-source analysis search:
- Query params: `q`, `source_id`, `category`, `limit`, `offset`
- Returns `{data, total, facets, engine}` — Solr or unavailable fallback
- Added to AchillesController with injected AnalysesSearchService

### Global Search Integration

Updated `GlobalSearchService` to search the analyses core in parallel:
- Cmd+K palette now shows analysis results with BarChart3 icon
- Links to `/data-explorer?source={sourceId}&analysis={analysisId}`
- 4 cores searched simultaneously: vocabulary, cohorts, studies, analyses

### Admin Panel Integration

Updated `SolrAdminController`:
- `reindex('analyses')` now maps to `solr:index-analyses`
- `reindex-all` includes analyses in the sequential rebuild

### Bug Fix

Fixed `AchillesResultReaderService::getAvailableAnalyses()`:
- `having('row_count', '>', 0)` fails on PostgreSQL (can't reference subselect alias in HAVING)
- Replaced with `whereExists()` subquery — correct SQL for all PostgreSQL versions

### Docker

Updated `docker-compose.yml`:
- Added `analyses` configset volume mount
- Added `precreate-core analyses` to Solr startup command

## Verification

- Analyses core responds to ping: `curl http://localhost:8983/solr/analyses/admin/ping` — 200 OK
- 190 documents indexed across 2 sources
- Search "gender" → 27 results, correct relevance order
- Facets: category (Person, Condition, Drug, etc.), source_name
- TypeScript compiles clean
- Production build succeeds
- Route registered: `GET api/v1/analyses/search`

## Files Created
- `solr/configsets/analyses/conf/schema.xml`
- `solr/configsets/analyses/conf/solrconfig.xml`
- `solr/configsets/analyses/conf/stopwords.txt`
- `backend/app/Services/Solr/AnalysesSearchService.php`
- `backend/app/Console/Commands/SolrIndexAnalyses.php`

## Files Modified
- `docker-compose.yml` — analyses core mount + precreate
- `backend/app/Http/Controllers/Api/V1/AchillesController.php` — inject AnalysesSearchService, add searchAnalyses()
- `backend/app/Http/Controllers/Api/V1/Admin/SolrAdminController.php` — add analyses to reindex/reindexAll
- `backend/app/Services/Solr/GlobalSearchService.php` — add analyses core to parallel fan-out
- `backend/app/Services/Achilles/AchillesResultReaderService.php` — fix having→whereExists bug
- `backend/routes/api.php` — add /analyses/search route
- `frontend/src/components/layout/CommandPalette.tsx` — BarChart3 icon for analysis results
