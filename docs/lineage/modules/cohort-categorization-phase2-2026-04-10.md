# Cohort Categorization Phase 2 — Domain Enrichment & Deprecation

**Date:** 2026-04-10
**Scope:** Backend + Frontend — Cohort Definitions module
**Builds on:** Phase 1 (domain/quality_tier columns, grouped view, tier badges)

## Summary

Phase 2 extends the cohort categorization system with Solr faceted search, a formal CohortDomain enum, auto-domain detection from OMOP concept vocabularies, domain NOT NULL enforcement, and cohort deprecation with supersession links.

## What Changed

### 1. Solr Faceted Search

Added `domain_s` and `quality_tier_s` fields to the Solr cohorts core schema. Both the batch indexer (`SolrIndexCohorts`) and real-time indexer (`SolrUpdateCohortJob`) now include these fields. `CohortSearchService` returns facet counts and accepts filter queries for both fields. The controller passes domain/tier filters through to Solr when search is active.

**Gotcha:** Solr configsets are mounted read-only at `/opt/solr/server/solr/configsets/` but the live core data lives at `/var/solr/data/cohorts/conf/`. Restarting the Solr container does NOT copy the updated schema. Must manually `cp` the schema into the live core and `RELOAD` the core via the admin API.

### 2. CohortDomain Enum

`App\Enums\CohortDomain` — a string-backed PHP enum with 8 clinical domain values: cardiovascular, metabolic, renal, oncology, rare-disease, pain-substance-use, pediatric, general. Includes:
- `label()` — human-readable display names
- `clinicalGroupingMap()` — maps all 39 ClinicalGrouping names (from `app.clinical_groupings`) to the 8 domains

Replaces hardcoded domain label arrays in the controller. The model casts `domain` to this enum. Store/update validation uses `Rule::in()` against enum values.

### 3. Auto-Domain Detection

`CohortDomainDetector` service infers a cohort's clinical domain from its expression JSON:
1. Extracts concept IDs from `ConceptSets[].expression.items[].concept.CONCEPT_ID`
2. Queries `vocab.concept_ancestor` to find which ClinicalGrouping anchor concepts are ancestors
3. Maps anchor groupings to CohortDomain via `clinicalGroupingMap()`
4. Majority vote — top domain wins if it accounts for >= 40% of matched concepts; otherwise falls back to `general`

The observer fires auto-detection on create (when domain is null) and on update (when expression changes but domain wasn't explicitly set). Detection failures are silently caught — never breaks the save.

**Backfill command:** `php artisan cohort:backfill-domains` detected domains for all 22 remaining null-domain cohorts. Results: 3 cardiovascular, 3 metabolic, 1 renal, 15 general (including empty-expression fixtures).

### 4. Domain NOT NULL Migration

After backfill, `domain` column is now `NOT NULL DEFAULT 'general'`. The migration includes a safety check — aborts if any active rows still have null domain, with a message to run the backfill first. The migration also handles soft-deleted rows (PostgreSQL enforces NOT NULL on all rows regardless of application-level soft deletes).

### 5. Cohort Deprecation

**New columns:** `deprecated_at` (nullable timestamp, indexed) and `superseded_by` (nullable FK to self, nullOnDelete).

**Model additions:**
- `supersededByCohort()` BelongsTo, `supersedes()` HasMany
- `scopeActive()` — filters non-deprecated
- `isDeprecated()` — boolean accessor

**New endpoints:**
- `POST /cohort-definitions/{id}/deprecate` — sets deprecated_at, optionally links superseded_by (validates replacement isn't itself deprecated)
- `POST /cohort-definitions/{id}/restore-active` — clears deprecation

**Study guard:** `StudyCohortController::store()` rejects adding deprecated cohorts to studies (422) with a message suggesting the replacement if one exists. Existing study associations are untouched.

**Frontend:**
- Detail page: amber deprecation banner with date, superseded-by link, and Restore button. Deprecate button in action bar (hidden when already deprecated).
- List views (flat + grouped): deprecated rows render with `opacity-60`, name with `line-through`, amber "Deprecated" badge.

## Files Changed

### New Files (7)
- `backend/app/Enums/CohortDomain.php`
- `backend/app/Services/Cohort/CohortDomainDetector.php`
- `backend/app/Console/Commands/CohortBackfillDomains.php`
- `backend/database/migrations/*_make_cohort_domain_not_null.php`
- `backend/database/migrations/*_add_deprecation_to_cohort_definitions.php`

### Modified Files (12)
- `solr/configsets/cohorts/conf/schema.xml`
- `backend/app/Services/Solr/CohortSearchService.php`
- `backend/app/Jobs/Solr/SolrUpdateCohortJob.php`
- `backend/app/Console/Commands/SolrIndexCohorts.php`
- `backend/app/Models/App/CohortDefinition.php`
- `backend/app/Observers/CohortDefinitionObserver.php`
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- `backend/app/Http/Controllers/Api/V1/StudyCohortController.php`
- `backend/routes/api.php`
- `frontend/src/features/cohort-definitions/types/cohortExpression.ts`
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`
- `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx`
- `frontend/src/features/cohort-definitions/api/cohortApi.ts`
- `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`

## Verification

- Pint: PASS (1425 files)
- PHPStan: PASS (0 errors, 1011 files)
- TypeScript: PASS
- Vite build: PASS
- Solr: 80 cohorts + 55 studies indexed with domain/tier facets

## Deferred to Phase 3

- Approval workflows / review status
- Expression editor quality checklist
- Phenotype library integration
