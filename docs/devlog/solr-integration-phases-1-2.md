# Solr Integration — Phases 1 & 2 Devlog

**Date:** 2026-03-06
**Scope:** Infrastructure setup + Vocabulary search core

## What Was Built

### Phase 1: Infrastructure
- **Solr 9.7 Docker service** added to `docker-compose.yml` with health checks, 3G memory limit, precreated `vocabulary` core
- **Schema** (`solr/configsets/vocabulary/conf/schema.xml`): 13 fields, `text_general` for full-text search, `text_suggest` with EdgeNGram for autocomplete, `string` fields for faceting
- **Solr config** (`solrconfig.xml`): ClassicIndexSchemaFactory, edismax default parser, suggest component with AnalyzingInfixLookupFactory, Caffeine caches
- **Laravel config** (`backend/config/solr.php`): env-driven settings for host, port, timeout, core names, circuit breaker thresholds
- **SolrServiceProvider** registered as singleton

### Phase 2: Vocabulary Search
- **SolrClientWrapper** (`backend/app/Services/Solr/SolrClientWrapper.php`): HTTP client with circuit breaker pattern (Redis-backed), methods for select/suggest/addDocuments/commit/deleteAll/ping
- **VocabularySearchService** (`backend/app/Services/Solr/VocabularySearchService.php`): High-level search with edismax, facets, highlights, filter queries
- **SolrIndexVocabulary** command: Indexes OMOP concepts with synonyms, supports `--fresh`, `--domain`, `--vocabulary`, `--batch-size` flags
- **SolrBenchmark** command: Compares PostgreSQL ILIKE vs Solr with 10 medical queries, outputs stats table + JSON
- **VocabularyController** updated: Solr-first with PG fallback, new `/vocabulary/suggest` endpoint
- **HealthController** updated: Solr health check when enabled
- **Frontend**: Engine indicator (Solr/PG badge), clickable facet chips, facet counts in filter dropdowns, `useConceptSuggest` hook

## Benchmark Results (7,194,924 concepts)

| Metric | PostgreSQL | Solr | Speedup |
|--------|-----------|------|---------|
| Avg | 523.6ms | 34.7ms | **15.1x** |
| Median | 857.0ms | 28.8ms | **29.8x** |
| P95 | 1,121.2ms | 82.0ms | **13.7x** |
| Min | 64.4ms | 4.5ms | **14.3x** |

## Key Decisions
- **No Solarium PHP library** — raw HTTP via Laravel's Http facade; simpler, fewer dependencies
- **Manual URL query string** — Solr expects repeated keys (`facet.field=X&facet.field=Y`), Laravel serializes as bracket notation
- **concept_id as string** — Solr 9.x doesn't allow Points-based types for uniqueKey
- **Circuit breaker with Redis** — try-catch around all Cache calls so Redis downtime doesn't block Solr queries

## Gotchas
1. **ClassicIndexSchemaFactory requires `schema.xml`** — naming the file `managed-schema` silently fails
2. **Solr precreate vs init script** — using `solr-precreate vocabulary` in docker-compose command is simpler and more reliable than a custom init script
3. **Redis disconnection during `docker compose up`** — recreating containers can disconnect Redis from the Docker network; circuit breaker try-catch prevents 10s timeouts but Redis must be verified after container recreation
4. **Port conflicts** — host Redis on 6379 conflicts with Docker's default; always use the configured `REDIS_PORT` (6381)

## Files Created
- `solr/configsets/vocabulary/conf/schema.xml`
- `solr/configsets/vocabulary/conf/solrconfig.xml`
- `solr/configsets/vocabulary/conf/stopwords.txt`
- `solr/init/create-cores.sh`
- `backend/config/solr.php`
- `backend/app/Services/Solr/SolrClientWrapper.php`
- `backend/app/Services/Solr/VocabularySearchService.php`
- `backend/app/Console/Commands/SolrIndexVocabulary.php`
- `backend/app/Console/Commands/SolrBenchmark.php`
- `backend/app/Providers/SolrServiceProvider.php`

## Files Modified
- `docker-compose.yml` — added solr service + volume
- `backend/bootstrap/providers.php` — registered SolrServiceProvider
- `backend/.env` — added SOLR_ENABLED, SOLR_HOST, SOLR_PORT, SOLR_TIMEOUT
- `backend/app/Http/Controllers/Api/V1/VocabularyController.php` — Solr-first search + suggest
- `backend/app/Http/Controllers/Api/V1/HealthController.php` — Solr health check
- `backend/routes/api.php` — added /vocabulary/suggest route
- `frontend/src/features/vocabulary/types/vocabulary.ts` — FacetCounts, SuggestResult, engine field
- `frontend/src/features/vocabulary/api/vocabularyApi.ts` — facets, engine, suggestConcepts
- `frontend/src/features/vocabulary/hooks/useVocabularySearch.ts` — facets, engine, useConceptSuggest
- `frontend/src/features/vocabulary/components/VocabularySearchPanel.tsx` — engine badge, facet chips
