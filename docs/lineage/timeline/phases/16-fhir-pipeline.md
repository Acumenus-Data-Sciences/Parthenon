# Phase 16 §16.8–16.10 — FHIR R4 Bulk Data Pipeline

**Date:** 2026-03-05
**Status:** Complete (Phases A–C)

## What Was Built

### Phase A: FHIR Connection Management UI
- `FhirConnectionsPage.tsx` — full CRUD for FHIR R4 connections (Epic, Cerner, etc.)
- SMART Backend Services config: token URL, client ID, RS384 private key, group ID
- Test Connection button with JWT assertion generation + token exchange
- Admin dashboard nav card (teal, superAdminOnly)
- Lazy-loaded route at `/admin/fhir-connections`

### Phase B: Bulk Data Extraction Service
- `FhirAuthService` — SMART Backend Services OAuth (RS384 JWT → access token)
- `FhirBulkExportService` — full export lifecycle:
  - `startExport()` → `$export` kick-off, returns Content-Location polling URL
  - `pollExportStatus()` → async status check, returns manifest when done
  - `downloadNdjsonFiles()` → downloads all NDJSON to `storage/fhir-exports/{site}/{run}/`
  - `cleanupFiles()` → post-processing cleanup
- `RunFhirSyncJob` — long-running queued job (4hr timeout, 1 try)
  - Exponential backoff polling (10s → 120s max, 2hr timeout)
  - Status tracking: pending → exporting → downloading → processing → completed/failed
  - Updates `FhirConnection.last_sync_*` on completion
- Sync trigger endpoint: `POST /admin/fhir-connections/{id}/sync`
- Frontend: Sync button + SyncRunsPanel with status badges and metrics

### Phase C: NDJSON-to-OMOP Transformation Pipeline
- `VocabularyLookupService` — resolves FHIR coding arrays → OMOP concept_ids
  - 12 FHIR code system URIs mapped to OHDSI vocabulary_ids
  - Priority: SNOMED > LOINC > RxNorm > ICD-10 > CPT
  - "Maps to" relationship following via `concept_relationship` table
  - In-memory LRU cache (50K entries for concept + maps_to lookups)
- `CrosswalkService` — FHIR string IDs → OMOP integer IDs
  - Three crosswalk tables: patient, encounter, provider
  - Get-or-create pattern with in-memory caching
  - Lookup-only variants for clinical resource processing
- `FhirBulkMapper` — full FHIR→OMOP transformation
  - 10 resource types: Patient, Encounter, Condition, MedicationRequest/Statement/Administration, Procedure, Observation, DiagnosticReport, Immunization, AllergyIntolerance
  - Concept-driven domain routing (HL7 Vulcan IG pattern)
  - Crosswalk resolution for person_id, visit_occurrence_id, provider_id
- `FhirNdjsonProcessorService` — two-pass strategy
  - Pass 1: Patient + Encounter → populate crosswalks + person/visit_occurrence
  - Pass 2: Clinical resources → use crosswalks for referential integrity
  - Batch inserts (500 rows) with row-by-row fallback on failure

## Database Migrations
- `2026_03_05_260001_create_fhir_connections_table` — connections + sync_runs tables
- `2026_03_05_270001_create_fhir_crosswalk_tables` — patient, encounter, provider crosswalks

## Key Gotchas
- **`$connection` property collision**: Laravel's `Queueable` trait owns `$connection` (queue connection name). Renamed to `$fhirConnection` in `RunFhirSyncJob`.
- **Concept-driven routing**: A FHIR Condition may route to OMOP `observation` table if the vocab domain says "Observation". Don't assume resource type = CDM table.
- **Two-pass necessity**: Clinical resources reference Patient/Encounter via FHIR IDs. Crosswalks must be populated first or person_id/visit_occurrence_id resolution fails.

## Files Created
```
backend/app/Services/Fhir/FhirAuthService.php
backend/app/Services/Fhir/FhirBulkExportService.php
backend/app/Services/Fhir/FhirBulkMapper.php
backend/app/Services/Fhir/FhirNdjsonProcessorService.php
backend/app/Services/Fhir/VocabularyLookupService.php
backend/app/Services/Fhir/CrosswalkService.php
backend/app/Jobs/Fhir/RunFhirSyncJob.php
backend/app/Models/App/FhirConnection.php
backend/app/Models/App/FhirSyncRun.php
backend/app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php
backend/database/migrations/2026_03_05_260001_create_fhir_connections_table.php
backend/database/migrations/2026_03_05_270001_create_fhir_crosswalk_tables.php
frontend/src/features/administration/pages/FhirConnectionsPage.tsx
frontend/src/features/administration/hooks/useFhirConnections.ts
```

## Files Modified
```
frontend/src/app/router.tsx  (FHIR connections route)
frontend/src/features/administration/api/adminApi.ts  (sync API client)
frontend/src/features/administration/pages/AdminDashboardPage.tsx  (nav card)
```
