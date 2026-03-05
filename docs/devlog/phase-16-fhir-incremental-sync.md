# Phase 16 §16.11 — FHIR Incremental Sync (Phase E)

**Date:** 2026-03-05
**Status:** Complete

## What Was Built

### Incremental Sync with Deduplication
- `_since` parameter support in FHIR Bulk Export — only requests resources modified after last successful sync
- `FhirDedupService` — SHA-256 content hashing + tracking table for skip-if-unchanged and delete-then-reinsert
- Three-state dedup: **new** (insert), **unchanged** (skip), **changed** (delete old → insert new)
- Warm cache on incremental runs — loads all tracking records for the site into memory before processing
- Batch upsert for dedup tracking (chunks of 500)

### Force Full Sync Option
- API: `POST /admin/fhir-connections/{id}/sync` accepts `{ force_full: true }` to bypass `_since` and dedup skipping
- `RunFhirSyncJob` passes `forceFull` flag through export and processor
- When `force_full=true`: no `_since` param, but dedup still tracks (prevents duplicates on full re-sync)

### Frontend Sync Dropdown
- Split button: primary action is incremental (or full if no previous sync), dropdown chevron opens menu
- "Incremental Sync" — only new/updated data since last sync
- "Force Full Sync" — re-download all data with dedup-on-write (amber highlight)
- Dropdown only shows full sync option when incremental is available (has previous sync + enabled)

### Monitoring Dashboard Enhancements (Phase D)
- `GET /admin/fhir-sync/dashboard` — aggregate stats across all connections
- `GET /admin/fhir-connections/{id}/sync-runs/{runId}` — individual run detail
- `FhirSyncDashboardPage` at `/admin/fhir-sync-monitor`:
  - 6 metric cards (connections, runs, completed, failed, records, coverage)
  - Pipeline funnel visualization (extracted → mapped → written | failed)
  - 30-day sync activity timeline chart
  - Connection health panel with status indicators
  - Recent runs table (last 20) with error drill-down
  - Auto-refresh: 10s when active syncs, 60s otherwise
- "Sync Monitor" button on FhirConnectionsPage header
- SyncRunsPanel auto-refreshes during active syncs

## Database Migration
- `2026_03_05_280001_create_fhir_dedup_tracking_table`
  - Columns: site_key, fhir_resource_type, fhir_resource_id, cdm_table, cdm_row_id, content_hash (SHA-256), last_synced_at
  - Unique constraint: (site_key, resource_type, resource_id)
  - Index: (site_key, cdm_table) for cleanup queries

## Architecture Decision: CDM-Preserving Dedup
Instead of adding columns to OMOP CDM tables (which would break schema compatibility), we use a separate `fhir_dedup_tracking` table that maps FHIR resource identity → CDM row. This keeps the CDM schema pure while enabling efficient incremental updates.

## New Stats Tracked
- `skipped` — resources unchanged since last sync (content hash match)
- `updated` — resources changed since last sync (old row deleted, new inserted)

## Files Created
```
backend/app/Services/Fhir/FhirDedupService.php
backend/database/migrations/2026_03_05_280001_create_fhir_dedup_tracking_table.php
frontend/src/features/administration/pages/FhirSyncDashboardPage.tsx
```

## Files Modified
```
backend/app/Services/Fhir/FhirBulkExportService.php  (forceFull param)
backend/app/Services/Fhir/FhirBulkMapper.php  (fhir_resource_type/id in output)
backend/app/Services/Fhir/FhirNdjsonProcessorService.php  (dedup integration, incremental mode)
backend/app/Jobs/Fhir/RunFhirSyncJob.php  (forceFull, incremental detection)
backend/app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php  (dashboard, force_full, run detail)
backend/routes/api.php  (dashboard + run detail routes)
frontend/src/app/router.tsx  (sync monitor route)
frontend/src/features/administration/api/adminApi.ts  (dashboard types + API)
frontend/src/features/administration/hooks/useFhirConnections.ts  (dashboard hook, forceFull)
frontend/src/features/administration/pages/FhirConnectionsPage.tsx  (sync dropdown, monitor link, auto-refresh)
```
