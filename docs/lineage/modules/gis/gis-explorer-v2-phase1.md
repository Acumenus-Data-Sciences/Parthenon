# GIS Explorer v2 Phase 1 — Disease-Agnostic Spatial Analytics

**Date:** 2026-03-11
**Branch:** `feature/chromadb-abby-brain`
**Commits:** `14c5c358` through `91eaa912` (18 commits)

## What Was Built

Evolved the GIS Explorer from a hardcoded COVID-19 dashboard into a disease-agnostic spatial analytics tool. Users can now select any condition present in the OMOP CDM and see county-level choropleth, summary statistics, demographics, and timeline data.

### Backend (Python AI Service)

- **Solr `gis_spatial` core** — new configset with schema for condition-county aggregate documents (cases, deaths, CFR, hospitalizations, population, prevalence, time series)
- **`solr_spatial.py`** — read service using pysolr: conditions list via pivot facets with stats sum, category faceting, choropleth queries, summary via stats component, time-period faceting, batch indexing
- **`cdm_spatial_query.py`** — fully generalized from COVID-specific to any `concept_id`: refresh_county_stats computes 5 metrics per condition, builds Solr documents, pushes to index
- **`cdm_spatial.py` (models)** — new Pydantic models: `ConditionItem`, `ConditionCategory`, `ConditionSummary`, `RefreshResult`; renamed metric enum values (removed `covid_` prefix)
- **`cdm_spatial.py` (router)** — new endpoints: `GET /conditions`, `GET /conditions/categories`, `GET /summary`, `POST /reindex-all`; existing endpoints parameterized with `concept_id`
- **SNOMED category mapping** — 11 curated ancestor concept_ids mapped to clinical categories (Cardiovascular, Respiratory, Metabolic, etc.) via `concept_ancestor` hierarchy
- **Solr-first with PG fallback** — conditions, summary, time-periods try Solr, gracefully fall back to PostgreSQL

### Backend (Laravel)

- **GisController** — new proxy methods: `cdmConditions()`, `cdmConditionCategories()`, `cdmSummary()`, `cdmReindexAll()`
- **Routes** — `GET /api/v1/gis/cdm/conditions`, `/conditions/categories`, `/summary`; `POST /reindex-all` (super-admin only)
- **`solr:index-gis-spatial`** Artisan command — CLI reindexing with `--concept-id` and `--fresh` options

### Frontend (React/TypeScript)

- **`DiseaseSelector`** — three browsing modes: quick picks (top 10 by patient count), expandable SNOMED category accordion, fuzzy search with debounce
- **`DiseaseSummaryBar`** — replaces `CovidSummaryBar`, shows cases/deaths/CFR/affected counties/prevalence per 100K with date range
- **`GisPage`** rewritten — disease selection drives all downstream state; MetricSelector, TimeSlider, CountyDetail only render when a disease is selected
- **Types/API/Hooks** — all generalized: `CdmMetricType` values renamed (`covid_cases` → `cases`), all hooks accept `conceptId`, new hooks for conditions and disease summary

### Infrastructure

- Docker Compose: `gis_spatial` configset mounted + `precreate-core` in Solr startup command
- `pysolr>=3.10.0` added to AI service dependencies
- Solr core config: `backend/config/solr.php` updated with `gis_spatial` core

## Bugs Fixed During Integration

1. **Solr `copyField` to single-valued `string` fields** — `condition_name_exact` and `county_name_exact` received tokenized text via copyField, causing HTTP 400 on indexing. Fix: removed copyField directives; values set explicitly in Python indexing code.
2. **Conditions endpoint showed county count instead of patient count** — Solr pivot facet `count` returns document count (counties), not patient sum. Fix: added `{!stats=cases_sum}` tag on pivot with `{!tag=cases_sum sum=true}cases` stats field; parse `stats.stats_fields.cases.sum` from pivot response.
3. **Solr core not auto-created after container recreate** — `precreate-core` only runs on first startup; after UNLOAD the data dir persists but core doesn't. Fix: used `CREATE` API with explicit `configSet` path.

## Verification

- Solr `gis_spatial` core: 67 county documents indexed for COVID-19 (concept_id=37311061)
- All Python endpoints verified: `/conditions` (patient_count=46,930), `/summary` (67 counties, CFR 2.31%), `/time-periods` (2020-03 through 2021+)
- TypeScript compiles cleanly (`npx tsc --noEmit` — zero errors)
- Vite production build succeeds
- Deployed to production via `./deploy.sh`

## Architecture Decisions

- **Solr for read, PG for write**: County stats computed in PostgreSQL (complex joins across CDM), then pushed to Solr for fast faceted search. This avoids duplicating query logic while getting sub-millisecond read performance.
- **One document per condition-county pair**: Denormalized structure enables efficient faceting by condition and filtering by county without joins.
- **SNOMED categories via `concept_ancestor`**: Rather than manual classification, uses the OMOP vocabulary hierarchy to group conditions into 11 clinical categories. Closest ancestor wins.

## What's Next (Phase 2)

- Full reindex across all 258 conditions (~17K Solr documents expected)
- Comorbidity analysis panel
- Drug exposure correlation overlay
- Visit type distribution per county
- Performance optimization for large condition sets
