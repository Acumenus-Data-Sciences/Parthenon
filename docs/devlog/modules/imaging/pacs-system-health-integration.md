# PACS System Health Integration & Imaging Re-Linking

**Date:** 2026-03-09
**Scope:** PACS admin panel consolidation, imaging study re-linking, R health fix

---

## What Was Built

### 1. PACS Connections Full-Stack Feature
Built a complete PACS connection management system from scratch:

- **Backend:** `PacsConnection` model, `PacsConnectionController` (CRUD + test/refresh/browse/set-default), `PacsConnectionService` (DICOMweb QIDO-RS client, Orthanc statistics)
- **Frontend:** `PacsConnectionCard`, `PacsConnectionFormModal`, `PacsStudyBrowser`, TanStack Query hooks
- **Database:** `pacs_connections` migration with health check tracking and metadata cache

### 2. Orthanc Integration into System Health
Moved PACS management from a standalone admin page (`/admin/pacs-connections`) into the System Health service detail page (`/admin/system-health/orthanc`):

- Added `checkOrthanc()` health checker to `SystemHealthController`
- Added `getOrthancMetrics()` for version/AET/plugin info via Orthanc `/system`
- Added Orthanc stats display (Studies, Instances, Disk) to `SystemHealthPage` service cards
- Added `PacsManagementSection` to `ServiceDetailPage` with full CRUD, test, stats refresh, and study browsing
- Removed standalone PACS nav card from admin dashboard

### 3. Imaging Study Re-Linking
Re-linked 622 COVID Harvard imaging studies to OMOP persons using the existing `ImagingTimelineService::linkStudiesToConditionPatients('%COVID%')` method. All studies successfully linked.

### 4. R Runtime Health Fix
Fixed R Plumber health check endpoint from `/healthz` to `/health` in both `checkRRuntime()` and `getRMetrics()`.

### 5. Frontend-Backend Data Contract Fixes
Fixed 5 mismatches between frontend types and backend responses:
- `PacsStats` field names (`studies_count` → `count_studies`, `disk_used_bytes` → `total_disk_size_mb`)
- Health status enum values (added `ok` and `error` to frontend mapping)
- Study browser filter keys (snake_case → PascalCase DICOM keys)
- Study response field (`modalities_in_study` → `modalities`)
- Added `study_instance_uid` to normalized study response

## Files Created
- `backend/app/Models/App/PacsConnection.php`
- `backend/app/Http/Controllers/Api/V1/Admin/PacsConnectionController.php`
- `backend/app/Http/Requests/PacsConnectionRequest.php`
- `backend/app/Services/Imaging/PacsConnectionService.php`
- `backend/database/migrations/2026_03_09_200000_create_pacs_connections_table.php`
- `backend/database/seeders/PacsConnectionSeeder.php`
- `frontend/src/features/administration/api/pacsApi.ts`
- `frontend/src/features/administration/components/PacsConnectionCard.tsx`
- `frontend/src/features/administration/components/PacsConnectionFormModal.tsx`
- `frontend/src/features/administration/components/PacsStudyBrowser.tsx`
- `frontend/src/features/administration/hooks/usePacsConnections.ts`
- `frontend/src/features/administration/pages/PacsConnectionsPage.tsx`
- `docs/plans/2026-03-09-pacs-connector-admin-design.md`
- `docs/plans/2026-03-09-pacs-connector-implementation.md`
- `tools/download_harvard_covid.py`

## Files Modified
- `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` — Orthanc checker + R health fix
- `backend/app/Services/Imaging/DicomwebService.php` — Study field normalization
- `backend/database/seeders/DatabaseSeeder.php` — Added PacsConnectionSeeder
- `backend/routes/api.php` — PACS admin routes
- `frontend/src/features/administration/pages/AdminDashboardPage.tsx` — Removed PACS nav card
- `frontend/src/features/administration/pages/ServiceDetailPage.tsx` — Added PacsManagementSection
- `frontend/src/features/administration/pages/SystemHealthPage.tsx` — Orthanc stats display

## Gotchas
- Orthanc `/statistics` endpoint is on the REST API root, not under `/dicom-web/`
- `PacsConnectionService::refreshOrthancStats()` strips `/dicom-web` suffix to reach the correct endpoint
- Health status from `testConnection()` uses `ok`/`error`, not `healthy`/`unhealthy`
- R Plumber exposes `/health` (not the Kubernetes-convention `/healthz`)
