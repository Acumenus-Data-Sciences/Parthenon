# Multi-File Ingestion with Staging Tables — Design Specification

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Phased (2 phases)

## Overview

Upgrade the Upload Files tab from a single-file-per-job pipeline to a multi-file project-oriented workflow with per-project PostgreSQL staging schemas. Researchers can upload 14+ files for a natural history study, review and rename table names, parse into queryable staging tables (all TEXT columns), profile automatically, and bridge directly into Aqueduct for ETL mapping to CDM.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Staging scope | Per-project schema (`staging_{project_id}`) | Clean lifecycle, drop schema on delete, natural Aqueduct source |
| File parsing | Hybrid: immediate < 50MB, queue ≥ 50MB | Fast feedback for typical files, safe for large ones |
| Column types | All TEXT + type metadata in field_profiles | Zero data loss, type casting at CDM write step only |
| Upload UX | Batch drag-and-drop + editable review list | Fast input, researcher renames tables before staging |
| Data model | New `IngestionProject` parent above `IngestionJob` | Non-breaking, groups files, owns staging schema |
| Upload size | No chunking, use existing 5GB PHP limit | Covers 99% of research datasets |

## Phase 1: Data Model + Staging Pipeline + Upload UX

### 1.1 Data Model

**New table: `app.ingestion_projects`**

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `name` | varchar(255) | Researcher-provided project name |
| `source_id` | bigint FK → sources, nullable | Optional target CDM source |
| `staging_schema` | varchar(50) | Auto-generated: `staging_{id}` |
| `status` | varchar(20), default 'draft' | Enum: draft, profiling, ready, mapping, completed, failed |
| `created_by` | bigint FK → users | NOT NULL |
| `file_count` | integer, default 0 | Number of files uploaded |
| `total_size_bytes` | bigint, default 0 | Sum of all file sizes |
| `notes` | text, nullable | |
| `deleted_at` | timestamp, nullable | Soft deletes |
| `timestamps` | | |

**Modified table: `app.ingestion_jobs`** — add columns:

| Column | Type | Notes |
|---|---|---|
| `ingestion_project_id` | bigint FK → ingestion_projects, nullable | NULL for legacy single-file jobs |
| `staging_table_name` | varchar(255), nullable | Table name in the staging schema after parsing |

Nullable FK ensures backward compatibility — existing jobs without a project continue working.

**Eloquent models:**

- `IngestionProject` — `$fillable`, `SoftDeletes`, relationships: `creator()`, `source()`, `jobs(): HasMany`, `ingestionJobs(): HasMany`
- `IngestionJob` — add `ingestion_project_id` and `staging_table_name` to `$fillable`, add `project(): BelongsTo`

**Policy:** `IngestionProjectPolicy` — same pattern as `EtlProjectPolicy`: owner or admin/super-admin.

### 1.2 RBAC

Reuses existing `ingestion.*` permissions — no new domain needed:

| Permission | Protects |
|---|---|
| `ingestion.view` | List/view projects and preview staging data |
| `ingestion.upload` | Create projects, upload files, stage data |
| `ingestion.run` | Trigger staging/profiling |
| `ingestion.delete` | Delete projects (soft-delete + schema cleanup) |

### 1.3 API Endpoints

All under `auth:sanctum` + ownership policy.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/ingestion-projects` | `ingestion.view` | List user's projects (paginated) |
| `POST` | `/ingestion-projects` | `ingestion.upload` | Create named project |
| `GET` | `/ingestion-projects/{project}` | `ingestion.view` | Show project + jobs + status |
| `PUT` | `/ingestion-projects/{project}` | `ingestion.upload` | Update name, notes |
| `DELETE` | `/ingestion-projects/{project}` | `ingestion.delete` | Soft-delete project |
| `POST` | `/ingestion-projects/{project}/stage` | `ingestion.upload` | Upload + stage files (multipart, multiple files) |
| `DELETE` | `/ingestion-projects/{project}/files/{job}` | `ingestion.delete` | Remove single file + drop staging table |
| `GET` | `/ingestion-projects/{project}/preview/{table}` | `ingestion.view` | Preview first 100 rows from staging table |

**Form Requests:**
- `CreateIngestionProjectRequest` — validates name (required, max 255), source_id (nullable, exists), notes (nullable)
- `StageFilesRequest` — validates files (required, array, each: file, max 5120000 KB), table_names (required, array, each: string, max 255)

**`POST /stage` multipart payload:**
```
files[]: File (multiple)
table_names[]: string (parallel array — table_names[0] is the name for files[0])
```

### 1.4 Staging Pipeline

**`StagingService`** — orchestrates the parse/stage flow.

**Per-file staging steps:**

1. Store file to `storage/app/private/ingestion/{project_id}/{table_name}.original_ext`
2. Detect format (CSV/TSV/Excel) via existing `FileUploadService::detectFormat()`
3. Read header row → sanitize column names (lowercase, special chars → underscores, truncate 63 chars, deduplicate)
4. `CREATE SCHEMA IF NOT EXISTS staging_{project_id}`
5. `CREATE TABLE staging_{project_id}.{table_name} (_row_id SERIAL PRIMARY KEY, col1 TEXT, col2 TEXT, ...)`
6. Load data:
   - CSV/TSV: PostgreSQL `COPY FROM STDIN` (fastest bulk load)
   - Excel: PhpSpreadsheet read → batch INSERT in chunks of 1000
7. Create `SourceProfile` + `FieldProfile` records (type inference, PII detection via existing services)
8. Update `IngestionJob`: `status = completed`, `staging_table_name = {table_name}`
9. Update `IngestionProject`: increment `file_count`, add to `total_size_bytes`, recompute `status`

**Hybrid size threshold:**
- File < 50MB → steps 1–9 run inline (synchronous within the HTTP request)
- File ≥ 50MB → steps 1–2 run inline (store file), steps 3–9 dispatched to `StageFileJob` on Horizon `ingestion` queue

**Project status rollup:**
- All jobs completed → `ready`
- Any job failed → `failed`
- Any job still profiling → `profiling`
- No jobs yet → `draft`

**Column name sanitization rules:**
1. Lowercase
2. Replace spaces, hyphens, dots, special chars with `_`
3. Strip leading digits (PostgreSQL identifiers can't start with a number) — prefix with `col_` if needed
4. Truncate to 63 characters
5. Deduplicate: if `name` exists, append `_2`, `_3`, etc.

**Preview endpoint:** `SELECT * FROM staging_{project_id}.{table_name} ORDER BY _row_id LIMIT {limit} OFFSET {offset}`. Uses `SET search_path` on the default `pgsql` connection (same pattern as `AchillesResultReaderService`). Returns JSON with column names and row arrays.

### 1.5 Staging Schema Cleanup

- **Soft delete** (normal): Sets `deleted_at`, does NOT drop schema. Data preserved for potential recovery.
- **Hard delete** (admin action or future purge): Drops schema `CASCADE`, deletes stored files, removes `Source` record.
- **Single file removal**: `DROP TABLE staging_{project_id}.{table_name}`, delete the `IngestionJob` and its profiles. Recompute project `file_count` and `total_size_bytes`.

### 1.6 Frontend — Upload Files Tab Restructure

**Two modes:**

**Mode 1: Project List (default)**
- Table: project name, status badge, file count, total size, created date, actions
- "New Project" button (crimson)
- Empty state with CTA
- "Legacy Jobs" collapsed section at bottom for `IngestionJob` records without `project_id`

**Mode 2: Project Detail**
- Breadcrumb: "← Projects / {project_name}"
- Status badge
- Upload zone (collapsible — expanded for `draft`, collapsed for `ready`):
  - Multi-file drag-and-drop (accepts `.csv, .tsv, .xlsx, .xls, .json`)
  - Editable review list: filename | table name (editable input) | size | remove button
  - "Stage All" button
- Staged files table:
  - Table name, row count, column count, profiling status, PII column count
  - "Preview" button → expandable inline table showing first 100 rows
  - Per-file status: spinner (profiling), green check (completed), red X (failed + error message)
- "Open in Aqueduct →" button when project status is `ready`

**File structure (new/modified):**
- Create: `features/ingestion/pages/ProjectListView.tsx`
- Create: `features/ingestion/pages/ProjectDetailView.tsx`
- Create: `features/ingestion/components/FileReviewList.tsx`
- Create: `features/ingestion/components/StagingPreview.tsx`
- Create: `features/ingestion/hooks/useIngestionProjects.ts`
- Modify: `features/ingestion/pages/IngestionDashboardPage.tsx` — becomes router between list/detail
- Modify: `features/ingestion/api/ingestionApi.ts` — add project endpoints

## Phase 2: Aqueduct Integration

### 2.1 Auto-Created Source + Profile

When `IngestionProject` status transitions to `ready`:

1. Create `Source` record:
   - `source_name = "Staging: {project_name}"`
   - `source_key = "STAGING-{project_id}"`
   - `source_connection = "pgsql"`
   - `source_dialect = "postgresql"`
2. Create `SourceDaimon` records:
   - CDM daimon: `table_qualifier = "staging_{project_id}"`
   - (No vocabulary or results daimons — staging is source data, not CDM)
3. Create `SourceProfile`:
   - `source_id = {new source id}`
   - `scan_type = "ingestion"`
   - Aggregated from per-file profiles (total tables, columns, rows, overall grade)
4. Update `IngestionProject.source_id` → the new source

This makes the staging schema visible to Aqueduct through the standard `Source` → `SourceProfile` → `FieldProfile` chain. No special-casing in Aqueduct.

### 2.2 "Open in Aqueduct" Flow

1. Frontend: Navigate to `/ingestion?tab=aqueduct`
2. Auto-select the staging source in Aqueduct's source dropdown
3. Aqueduct finds the source profile → EtlProject creation screen
4. Researcher creates mapping project → React Flow canvas shows staging tables (left) vs CDM (right)

### 2.3 Cleanup Cascade

When `IngestionProject` is soft-deleted:
- Auto-created `Source` is soft-deleted (if Source model supports it) or marked `is_deleted`
- This removes it from source dropdowns
- Historical `EtlProject` references remain intact (FK not cascaded)

## File Impact Summary

### Backend (new files)
- `app/Models/App/IngestionProject.php`
- `app/Policies/IngestionProjectPolicy.php`
- `app/Http/Controllers/Api/V1/IngestionProjectController.php`
- `app/Http/Requests/CreateIngestionProjectRequest.php`
- `app/Http/Requests/StageFilesRequest.php`
- `app/Services/Ingestion/StagingService.php` — schema creation, table creation, data loading
- `app/Services/Ingestion/ColumnNameSanitizer.php` — header sanitization rules
- `app/Jobs/Ingestion/StageFileJob.php` — queue job for large files
- `database/migrations/xxxx_create_ingestion_projects_table.php`
- `database/migrations/xxxx_add_project_id_to_ingestion_jobs.php`

### Backend (modified files)
- `app/Models/App/IngestionJob.php` — add `ingestion_project_id`, `staging_table_name` to `$fillable`, add `project()` relationship
- `app/Http/Controllers/Api/V1/IngestionController.php` — modify `upload()` to auto-create project for single-file uploads
- `routes/api.php` — add ingestion-projects route group
- `database/seeders/RolePermissionSeeder.php` — no changes (reuses `ingestion.*`)

### Frontend (new files)
- `features/ingestion/pages/ProjectListView.tsx`
- `features/ingestion/pages/ProjectDetailView.tsx`
- `features/ingestion/components/FileReviewList.tsx`
- `features/ingestion/components/StagingPreview.tsx`
- `features/ingestion/hooks/useIngestionProjects.ts`

### Frontend (modified files)
- `features/ingestion/pages/IngestionDashboardPage.tsx` — becomes project list/detail router
- `features/ingestion/api/ingestionApi.ts` — add project/staging API functions
- `features/ingestion/components/FileUploadZone.tsx` — support `multiple` files

## Non-Goals

- Chunked/resumable uploads (existing 5GB PHP limit is sufficient)
- Real-time collaboration on ingestion projects (future)
- Direct database-to-staging import (use WhiteRabbit + Aqueduct for that path)
- Type coercion at staging time (all TEXT — types applied at CDM write)
- Staging table schema evolution (re-upload replaces the table)
