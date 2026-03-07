# Solr Integration — Phase 6: Clinical Data Search

**Date:** 2026-03-06
**Scope:** Solr `clinical` core for cross-patient clinical event search from OMOP CDM tables

## What Was Built

### Solr Schema — `clinical` Core

New configset at `solr/configsets/clinical/conf/`:
- `schema.xml` — 16 fields: event_id (string uniqueKey, format: `{domain}_{sourceId}_{occurrenceId}`), event_type, person_id, concept_id, concept_name (text_general), concept_name_exact (string copyField for faceting), domain_id, vocabulary_id, event_date, event_end_date, source_id, source_name, value_as_number, value_as_string, unit, type_concept_name
- `solrconfig.xml` — edismax defaults: qf=concept_name^3 value_as_string^1, highlighting, larger cache sizes (256) for clinical data volume, 10s autoCommit
- `stopwords.txt` — standard English stopwords

### Indexing Command

`php artisan solr:index-clinical` — indexes clinical events from 6 CDM domain tables:
- **Domains:** condition_occurrence, drug_exposure, procedure_occurrence, measurement, observation, visit_occurrence
- Iterates all sources with CDM daimons, resolves CDM + vocabulary schemas per source
- Joins concept table for concept_name, domain_id, vocabulary_id
- Joins type concept for type_concept_name
- Extracts value_as_number/value_as_string for measurements and observations
- Uses DB cursors for memory efficiency on large tables
- Batches in chunks of 500, progress output every 5,000 events
- Supports `--source=ID`, `--domain=condition`, `--limit=N`, `--fresh`
- Statement timeout: 5 minutes (for large tables like measurement)

### Search Service

`ClinicalSearchService.php` — Solr-powered clinical event search:
- `search(query, filters, limit, offset)` with edismax, facets on event_type, domain_id, source_name, vocabulary_id
- Filters: source_id, person_id, event_type, domain_id, concept_id, date_from, date_to, value_min, value_max
- `deleteBySource(sourceId)` for cleanup
- Returns items, total, facets

### API Endpoint

`GET /api/v1/clinical/search` — cross-patient clinical event search:
- Query params: q, source_id, person_id, event_type, domain_id, concept_id, date_from, date_to, value_min, value_max, limit, offset
- Solr-only (no DB fallback — direct patient queries via /profiles/{personId})
- Returns `{data, total, facets, engine}`

### Global Search Integration

Updated `GlobalSearchService` to search the clinical core in parallel:
- Cmd+K palette now shows clinical events with HeartPulse icon
- Links to `/profiles/{personId}?sourceId={sourceId}`
- 6 cores searched simultaneously: vocabulary, cohorts, studies, analyses, mappings, clinical

### Admin Panel Integration

Updated `SolrAdminController`:
- `reindex('clinical')` maps to `solr:index-clinical`
- `reindex-all` includes clinical in the sequential rebuild

### Docker

Updated `docker-compose.yml`:
- Added `clinical` configset volume mount
- Added `precreate-core clinical` to Solr startup command

## Verification

- Clinical core responds to ping: 200 OK
- 4,500 events indexed from Acumenus source (1,000 per domain x 5 domains, limited run)
- Search "diabetes" -> 42 results (conditions, correct relevance)
- Facets: event_type (condition:1000, drug:1000, observation:1000, procedure:1000, visit:500)
- TypeScript compiles clean
- Production build succeeds
- PHP Pint passes
- Route registered: `GET api/v1/clinical/search`

### Known Issues (Non-fatal)
- **Measurement table timeout** on Acumenus (710M rows): The full measurement table exceeds the 5-minute query timeout. Use `--domain=measurement --limit=N` for controlled indexing, or increase `statement_timeout`. Not blocking — other domains index successfully.
- **Eunomia concept table missing**: Eunomia's vocab daimon points to `eunomia` schema but concept table doesn't exist in Docker postgres. The indexer handles this gracefully — errors are logged, other sources continue.

## Files Created
- `solr/configsets/clinical/conf/schema.xml`
- `solr/configsets/clinical/conf/solrconfig.xml`
- `solr/configsets/clinical/conf/stopwords.txt`
- `backend/app/Services/Solr/ClinicalSearchService.php`
- `backend/app/Console/Commands/SolrIndexClinical.php`

## Files Modified
- `docker-compose.yml` — clinical core mount + precreate
- `backend/app/Http/Controllers/Api/V1/PatientProfileController.php` — inject ClinicalSearchService, add searchClinical()
- `backend/app/Http/Controllers/Api/V1/Admin/SolrAdminController.php` — add clinical to reindex/reindexAll
- `backend/app/Services/Solr/GlobalSearchService.php` — add clinical core to parallel fan-out (6 cores total)
- `backend/routes/api.php` — add /clinical/search route
- `frontend/src/components/layout/CommandPalette.tsx` — HeartPulse icon for clinical results
