# Phase 16 Add-on: Vocabulary Management (Admin)

**Date:** 2026-03-05
**Status:** Complete

## Overview

Implemented an admin-level vocabulary update workflow that allows super-admins to upload a new Athena vocabulary ZIP file and apply it to the OMOP CDM vocabulary schema of their choice. Import runs as an async background job with live progress tracking.

## What Was Built

### Backend

#### Migration
- `2026_03_05_200001_create_vocabulary_imports_table.php`
- Tracks: `user_id`, `source_id` (nullable FK to sources), `status`, `progress_percentage`, `file_name`, `storage_path`, `file_size`, `log_output`, `error_message`, `rows_loaded`, `target_schema`, `started_at`, `completed_at`

#### Model
- `App\Models\App\VocabularyImport` — with `appendLog()` helper that timestamps each log line

#### Job
- `App\Jobs\Vocabulary\VocabularyImportJob` — 6-hour timeout, 1 attempt
- Extracts ZIP (handles nested folder from Athena), truncates, loads 9 vocab tables via PostgreSQL `COPY FROM FILE`, creates B-tree + GIN trigram indexes, runs ANALYZE
- Updates `progress_percentage` incrementally: 5% extract → 10% truncate → 10–80% table loads → 90% indexes → 100% done
- Writes timestamped log lines after each step
- On failure: sets `status=failed`, stores error message, cleans up temp files

#### Controller & Routes
- `App\Http\Controllers\Api\V1\Admin\VocabularyController`
  - `GET /api/v1/admin/vocabulary/imports` — list 20 most recent
  - `POST /api/v1/admin/vocabulary/upload` — upload ZIP, store, dispatch job
  - `GET /api/v1/admin/vocabulary/imports/{id}` — poll status
  - `DELETE /api/v1/admin/vocabulary/imports/{id}` — remove record (not running)
- All routes under `admin` prefix, `role:super-admin` middleware

#### Source-Aware Schema Targeting
- Upload accepts optional `source_id`; resolves the source's vocabulary daimon `table_qualifier` as the target schema
- Falls back to first segment of `VOCAB_DB_SEARCH_PATH` env var (e.g. `omop`, `eunomia`)
- Schema is stored on the import record and used throughout the job

### Infrastructure

#### Large File Support
- `docker/php/php.ini`: `upload_max_filesize = 5120M`, `post_max_size = 5120M`, `memory_limit = 1024M`, `max_execution_time = 0`
- `docker/nginx/default.conf`: `client_max_body_size 5120M`, `client_body_timeout 600s`, `fastcgi_read_timeout 600s`

#### Apache (Manual Step Required)
The Apache vhost at `/etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf` needs:
```apache
LimitRequestBody 5368709120
ProxyTimeout 600
```
Run as root: `sudo nano /etc/apache2/sites-available/parthenon.acumenus.net-le-ssl.conf` then `sudo apache2ctl graceful`.

### Frontend

#### API Functions (`adminApi.ts`)
- `fetchVocabImports()` — list
- `fetchVocabImport(id)` — single record with log_output
- `uploadVocabZip(file, sourceId?)` — multipart upload
- `deleteVocabImport(id)` — delete

#### `VocabularyPage.tsx`
- Drag-and-drop / browse file selector for ZIP (max 5 GB, `.zip` only)
- **Source selector dropdown** — populated from `GET /api/v1/sources`, lets admin choose which CDM's vocabulary schema to populate
- Athena download instructions panel
- Upload is disabled when an import is already active
- Import history list with:
  - Status badge (queued/running/completed/failed) with spinner for active
  - Progress bar (animated, only shown while running)
  - Target schema and source name
  - Rows loaded, elapsed time, uploaded by, date
  - Collapsible log viewer with auto-scroll (polls every 3 seconds while active)
  - Remove button for finished records

#### Route & Navigation
- `router.tsx`: `/admin/vocabulary` → lazy `VocabularyPage`
- `AdminDashboardPage.tsx`: new nav card "Vocabulary Management" (violet, super-admin only)

## Key Design Decisions

- **Async job** — vocabulary imports take 15–60 minutes; synchronous upload would timeout. The upload endpoint stores the file and immediately returns the import record. The client polls.
- **Source-aware** — different sources can use different vocabulary schemas. The import uses the source's vocabulary daimon `table_qualifier`, falling back to the configured default.
- **Table names** — the job uses OMOP CDM v5.4 table names (e.g. `concept`, `concept_relationship`) which are the actual DB table names, distinct from the Athena CSV filenames (e.g. `CONCEPT.csv`).
- **Athena ZIP structure** — Athena sometimes nests CSVs in a subdirectory inside the ZIP; the job detects this and adjusts accordingly.
- **Progress tracking in DB** — log_output accumulates as the job runs; the frontend polls every 3s and renders the log live.
- **Cleanup** — ZIP file is deleted from storage after successful import; temp extract directory is cleaned up regardless.

## Gotchas & Notes
- `max_execution_time = 0` in `php.ini` only affects web requests; jobs have their own `$timeout` property.
- The `vocab` DB connection's search_path must match the resolved `target_schema` or the COPY FROM will fail. The job sets `SET search_path` on the PDO connection before each table load.
- GIN trigram index requires the `pg_trgm` extension in PostgreSQL (pre-installed on typical OMOP setups).
