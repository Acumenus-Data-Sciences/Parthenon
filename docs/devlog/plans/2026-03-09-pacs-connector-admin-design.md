# PACS Connector Admin Panel — Design Document

**Date:** 2026-03-09
**Status:** Approved
**Approach:** Standalone `pacs_connections` table with optional source linkage (Approach 3)

## Problem Statement

Parthenon indexes DICOM files from local directories and pushes pixel data to Orthanc via STOW-RS, but there is no admin UI to manage PACS connections, monitor storage, or browse studies. The lack of visibility led to accidental data loss when local DICOM files were deleted without realizing Parthenon only indexed file paths — not stored them intelligently.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PACS engine | Keep Orthanc | Already running, storing data, serving OHIF |
| Connection model | Multi-PACS (DICOMweb) | Support local Orthanc + external hospital PACS |
| Scope (Phase 1) | Monitor + Browse | Visibility first; Full Lifecycle (imports, push, retention) later |
| Auth | URL + optional Basic Auth | Add mTLS/OAuth2 when hospital integrations demand it |
| Data model | Standalone table + optional source FK | Clean domain separation without polluting Source/Daimon model |

## Data Model

### `pacs_connections` table (app schema, Docker PG)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | auto-increment |
| `name` | varchar(255) | Display name, e.g. "Local Orthanc", "Harvard Dataverse" |
| `type` | varchar(50) | `orthanc`, `dicomweb`, `google_healthcare`, `cloud_other` |
| `base_url` | text | DICOMweb root, e.g. `http://orthanc:8042/dicom-web` |
| `auth_type` | varchar(50) | `none`, `basic`, `bearer` |
| `credentials` | text (encrypted) | Laravel `encrypted:array` — `{username, password}` or `{token}` |
| `is_default` | boolean | Single default connection (like AI provider pattern) |
| `is_active` | boolean | Soft enable/disable |
| `source_id` | bigint nullable FK | Optional link to `sources` table |
| `last_health_check_at` | timestamp nullable | Last successful health ping |
| `last_health_status` | varchar(20) nullable | `healthy`, `degraded`, `unreachable` |
| `metadata_cache` | jsonb nullable | Cached stats: `{studies_count, series_count, instances_count, disk_used_bytes}` |
| `metadata_cached_at` | timestamp nullable | When stats were last refreshed |
| `created_at` / `updated_at` | timestamps | Standard Laravel |

**Future columns (Full Lifecycle, not built now):**
- `import_schedule` — cron expression for periodic sync
- `retention_days` — auto-delete after N days
- `storage_quota_bytes` — alert threshold

### Model: `PacsConnection`

- `encrypted:array` cast on `credentials`
- Belongs to `Source` (optional)
- Scopes: `active()`, `default()`, `byType()`

## API Layer

All under `/api/v1/admin/pacs-connections`, protected by `auth:sanctum` + `role:super-admin`.

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/` | List all connections (with cached stats) |
| `POST` | `/` | Create connection |
| `GET` | `/{id}` | Single connection detail |
| `PUT` | `/{id}` | Update connection |
| `DELETE` | `/{id}` | Soft-delete (deactivate) |
| `POST` | `/{id}/test` | Test connectivity — ping DICOMweb, return latency + capabilities |
| `POST` | `/{id}/refresh-stats` | Query PACS for live storage stats, update `metadata_cache` |
| `GET` | `/{id}/studies` | Browse studies on this PACS (proxied QIDO-RS with pagination) |
| `POST` | `/{id}/set-default` | Set as default connection (transaction) |

### Service: `PacsConnectionService`

- `testConnection(PacsConnection): HealthResult` — HTTP GET to `{base_url}/studies?limit=1`, measures latency
- `refreshStats(PacsConnection): StatsResult` — QIDO-RS counts + Orthanc `/statistics` when type is `orthanc`
- `browseStudies(PacsConnection, filters): StudyList` — Proxied QIDO-RS with PatientName, Modality, StudyDate filters
- `resolveClient(PacsConnection): HttpClient` — Builds Guzzle client with appropriate auth headers

### Form Request: `PacsConnectionRequest`

Validates: `name` required, `base_url` required + URL format, `type` in enum, `auth_type` in enum, `credentials` required when `auth_type !== 'none'`.

## Frontend — Admin PACS Connections Page

### Route: `/admin/pacs-connections`

8th section in AdminDashboardPage alongside Users, Roles, Auth Providers, AI Providers, System Health, Vocabulary, FHIR.

### Page Layout

**Top bar:** "PACS Connections" title + "Add Connection" button (teal)

**Connection Cards** (one per `pacs_connection`):
- **Header row:** Name, type badge, status dot (green/yellow/red), default star badge
- **Stats row:** 4 mini metric cards — Studies, Series, Instances, Disk Used (from `metadata_cache`)
- **Footer row:** Last checked timestamp, "Test" / "Refresh Stats" / "Browse Studies" buttons, edit/delete icons
- Inactive connections rendered with muted opacity

**Add/Edit Modal:**
- Name, Type (select), Base URL, Auth Type (select), Credentials (conditional), Link to Source (optional select)
- "Test Connection" button — shows latency + success/fail before saving

**Study Browser Drawer:**
- Slides in from right on "Browse Studies" click
- Search bar (PatientName, PatientID), filter by Modality + StudyDate range
- Table: PatientName, PatientID, StudyDate, Modality, Description, Series count
- Paginated (QIDO-RS offset/limit)
- Click row → link to `/imaging/studies/{id}` if indexed, else "Not yet indexed" badge

### Components

| Component | Purpose |
|-----------|---------|
| `PacsConnectionsPage.tsx` | Page with card grid + add modal |
| `PacsConnectionCard.tsx` | Individual connection card with stats |
| `PacsConnectionFormModal.tsx` | Add/edit form with test-before-save |
| `PacsStudyBrowser.tsx` | Right drawer with QIDO-RS study browser |

## Integration Points

### System Health Dashboard
Each active PACS connection appears as a monitored service in `/admin/system-health`. `SystemHealthController` calls `PacsConnectionService::testConnection()` during health checks.

### Imaging Module
- `DicomwebService` gains `forConnection(PacsConnection $conn)` to configure from connection's URL + credentials
- Default PACS connection used when no specific connection specified (backward compatible)
- Source selector dropdowns show PACS connections linked to sources

### Seeder
`PacsConnectionSeeder` creates one default connection: local Orthanc (`http://orthanc:8042/dicom-web`, auth_type: `none`, is_default: `true`). Runs as part of `admin:seed`.

## File Inventory

| Layer | File | Purpose |
|-------|------|---------|
| Migration | `database/migrations/2026_03_09_*_create_pacs_connections_table.php` | Schema |
| Model | `app/Models/App/PacsConnection.php` | Eloquent model |
| Service | `app/Services/Imaging/PacsConnectionService.php` | Test, stats, browse |
| Controller | `app/Http/Controllers/Api/V1/Admin/PacsConnectionController.php` | CRUD + actions |
| Request | `app/Http/Requests/PacsConnectionRequest.php` | Validation |
| Seeder | `database/seeders/PacsConnectionSeeder.php` | Default Orthanc connection |
| Routes | `routes/api.php` | Admin PACS routes |
| Frontend API | `features/administration/api/pacsApi.ts` | API client functions |
| Frontend Hook | `features/administration/hooks/usePacsConnections.ts` | TanStack Query hooks |
| Page | `features/administration/pages/PacsConnectionsPage.tsx` | Main admin page |
| Component | `features/administration/components/PacsConnectionCard.tsx` | Connection card |
| Component | `features/administration/components/PacsConnectionFormModal.tsx` | Add/edit modal |
| Component | `features/administration/components/PacsStudyBrowser.tsx` | Study browser drawer |
| Router | `app/router.tsx` | Add `/admin/pacs-connections` route |

## Future: Full Lifecycle (Phase 2)

Not built now, but the schema and service are designed to support:
- Import triggers (local directory scan, DICOMweb pull from remote)
- Scheduled periodic syncs (`import_schedule` column)
- Cross-PACS push (pull from hospital → push to local Orthanc)
- Storage quotas and alerts (`storage_quota_bytes` column)
- Retention policies (`retention_days` column)
- Delete studies from PACS
- C-FIND/C-MOVE/C-STORE for legacy DICOM protocol (DIMSE)
