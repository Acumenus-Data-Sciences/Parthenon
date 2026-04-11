# OMOP Extension Hardening — Security, Models, and Indexes

**Date:** 2026-04-10
**Scope:** Backend security, model correctness, migration completeness, frontend cache fix

## Context

The OMOP extension bridge — connecting app-layer imaging and genomics data to OMOP CDM standard tables — was backfilled and API-integrated by a prior agent session. A deep 6-agent audit across all layers (database integrity, backend models, controllers, migrations, SQL scripts, frontend types) found zero referential integrity violations but identified hardening gaps. This session addresses the critical and high-priority findings.

## Changes

### P0 — HIGHSEC: Permission Middleware (CRITICAL)

Imaging and genomics API routes had `auth:sanctum` (authentication) but **zero `permission:` middleware** (authorization). Any authenticated user, including `viewer` role, could upload VCFs, delete data, import to OMOP CDM, and trigger ClinVar sync.

**Fix:**
- Added `imaging` (view/create/delete/run) and `genomics` (view/upload/delete/run) permission domains to `RolePermissionSeeder`
- Added per-route `permission:` middleware to all 35 imaging routes and 18 genomics routes
- Assigned permissions to roles: admin (full), researcher (no delete), data-steward (no delete), viewer (view only)
- Reseeded permissions on the running instance

### P1a — Missing Database Indexes (HIGH)

The original bridge migrations used `Schema::hasTable()` guards for idempotency. Since tables were created by SQL scripts before the migrations ran, the entire `Schema::create` blocks were skipped — including 6 index definitions.

**Fix:** Created `2026_04_10_165000_add_missing_omop_bridge_indexes.php` with individual `Schema::table()` calls and `pg_indexes` existence guards:
- `imaging_procedure_omop_xref.source_strategy`
- `omop_genomic_test_map.mapping_status`
- `genomic_variant_omop_xref.mapping_status`
- `genomic_variant_omop_xref.specimen_id`
- `genomic_upload_omop_context_xref.mapping_status`
- `genomic_upload_omop_context_xref.person_id` (most critical — JOIN column)

### P1b — Explicit Connection on Bridge Models (CRITICAL)

All 6 bridge models (`ImagingSeriesOmopXref`, `ImagingProcedureOmopXref`, `GenomicUploadOmopContextXref`, `GenomicVariantOmopXref`, `OmopGenomicTestMap`, `OmopGeneSymbolMap`) lacked `protected $connection = 'pgsql'`. If `SourceContext` changes the default connection at runtime, these would silently query the wrong database.

**Fix:** Added `protected $connection = 'pgsql'` to all 6 models.

### P1c — Type Casts on CDM Models (HIGH)

All 6 CDM extension models (`ImageOccurrence`, `ImageFeature`, `GenomicTest`, `TargetGene`, `VariantOccurrence`, `VariantAnnotation`) had zero `$casts`. IDs returned as strings, dates as strings, concept_ids uncast.

**Fix:** Added `$casts` arrays with integer/date/datetime/float casting to all 6 models.

### P1d — Graceful Degradation on Fresh Installs (HIGH)

Stats endpoints in `ImagingController` and `GenomicsController` queried OMOP bridge tables directly. On a fresh install without the extension migrations, these crash with `QueryException`.

**Fix:** Wrapped OMOP-specific stats queries in try-catch blocks that return 0 on failure.

### P1e — Cross-Connection Relationship Warnings (CRITICAL)

16 `belongsTo` relationships on bridge models (app connection) point to CDM models (omop connection). These work for lazy/eager loading but silently fail with `whereHas()`, `has()`, or join queries.

**Fix:** Added `@internal Cross-connection (omop): do not use with whereHas/has` docblocks to all 16 cross-connection relationships.

### P2a — Hardcoded 'cdm' Connection (HIGH)

`GenomicsController::matchPersons()` had `$connectionName = 'cdm'` — a connection that doesn't exist in Parthenon.

**Fix:** Replaced with `SourceContext` resolution pattern matching `CdmModel::getConnectionName()`.

### P2b — Frontend Cache Invalidation Bug (MEDIUM)

`useMatchPersons` in `useGenomics.ts` invalidated `["genomics", "uploads", id]` which wouldn't match the list query `["genomics", "uploads", {params}]`. After matching persons, the uploads list wouldn't auto-refresh.

**Fix:** Changed to broadly invalidate `["genomics", "uploads"]` and added `["genomics", "stats"]` invalidation.

## Audit Findings (informational, not fixed this session)

- **Data quality:** 240 image_occurrence rows (14%) have placeholder date 1900-01-01; 925 rows (54%) lack anatomic_site_concept_id
- **Coverage:** 6,568 of 8,283 imaging series (79%) remain unlinked (missing person_id upstream)
- **Schema typos:** `anntation_field` and `chromosome_corrdinate` inherited from upstream OMOP Genomic extension DDL
- **No FK constraints:** By OMOP CDM convention, all referential integrity is application-enforced
- **Path traversal:** DICOM local import `dir` param resolved via `base_path()` without containment check (low risk — authenticated + file-type-limited)

## Verification

- DB integrity: zero referential violations across all bridge tables
- Migration dry-run: all 3 migrations produce valid SQL
- API smoke tests: 7/7 endpoints return correct OMOP xref data with permission middleware active
- CI: Pint pass, tsc pass, ESLint pass, Vite build pass

## Files Modified

### Security & Routes
- `backend/routes/api.php` — permission middleware on 53 routes
- `backend/database/seeders/RolePermissionSeeder.php` — imaging + genomics permission domains

### Models (12 files)
- `backend/app/Models/App/Imaging{Series,Procedure}OmopXref.php` — connection + docblocks
- `backend/app/Models/App/Genomic{Upload,Variant}Omop{Context,}Xref.php` — connection + docblocks
- `backend/app/Models/App/Omop{GenomicTestMap,GeneSymbolMap}.php` — connection
- `backend/app/Models/Cdm/{ImageOccurrence,ImageFeature,GenomicTest,TargetGene,VariantOccurrence,VariantAnnotation}.php` — casts

### Controllers
- `backend/app/Http/Controllers/Api/V1/ImagingController.php` — try-catch stats
- `backend/app/Http/Controllers/Api/V1/GenomicsController.php` — try-catch stats + SourceContext fix

### Migration
- `backend/database/migrations/2026_04_10_165000_add_missing_omop_bridge_indexes.php` — 6 missing indexes

### Frontend
- `frontend/src/features/genomics/hooks/useGenomics.ts` — cache invalidation fix
