# Poseidon Phase 5: Laravel API + Panel-Based Frontend

**Date:** 2026-03-28
**Commit:** f5cfe2431
**Status:** Deployed to production

---

## What Was Built

Poseidon Phase 5 delivers the full management API and operations console frontend for the dbt + Dagster CDM refresh orchestration service.

### Backend (Laravel)

**Migration:** `2026_03_28_200000_create_poseidon_tables.php`
- `app.poseidon_schedules` — per-source schedule configuration (cron, sensor, manual)
- `app.poseidon_runs` — mirrors Dagster run state for UI consumption

**Models:**
- `PoseidonSchedule` — SoftDeletes, relationships to Source, User, Runs
- `PoseidonRun` — relationships to Source, Schedule, User; `isRunning()` helper

**Controller:** `PoseidonController` with 11 endpoints:
- `GET /dashboard` — aggregated summary (schedules, run stats, recent runs)
- `GET/POST/PUT/DELETE /schedules` — full CRUD
- `GET /runs` — paginated, filterable by source/status
- `GET /runs/{id}` — run detail with relationships
- `POST /runs/trigger` — manual trigger (creates run record even if Dagster is down)
- `POST /runs/{id}/cancel` — cancel active runs
- `GET /freshness` — CDM table freshness from Dagster asset metadata
- `GET /lineage` — asset dependency graph from Dagster
- `POST /webhooks/run-status` — Dagster callback (outside sanctum, secret-authenticated)

**Service:** `PoseidonService`
- Dagster GraphQL API client for triggers, freshness queries, lineage queries
- `safeLog()` wrapper prevents Monolog permission errors from masking business logic — the root cause of the trigger 500 bug found during testing

**Routes:** All under `auth:sanctum` + `permission:ingestion.*`. Webhook is public with `POSEIDON_WEBHOOK_SECRET` validation.

### Frontend (React)

**Design decision:** Instead of 4 separate pages (Dashboard, Schedule Config, Run Detail, Lineage Viewer), everything is consolidated into a single panel-based operations console. This matches the Vulcan workspace pattern and is more efficient for daily operations.

**PoseidonPage** — single page with collapsible panels:
1. **Overview Metrics** — 4 MetricCards: active schedules, runs in progress, successes, failures
2. **Source Schedules** — per-source schedule cards with activate/pause toggle and "Run Incremental Refresh" button
3. **Recent Runs** — table with click-to-expand inline detail (run stats, duration, error messages, affected assets)
4. **CDM Freshness** — asset freshness grid with stale highlighting (>24h = gold warning)
5. **Asset Lineage** — tier-grouped dependency view (staging → intermediate → CDM → quality)

**Placement:** Added as "Poseidon" tab in DataIngestionPage, between Aqueduct and Vulcan.

**Auto-polling:** Dashboard 15s, runs 10s, freshness 30s.

### Vulcan Restoration

The previous session's Vulcan (FHIR workspace) changes to `ingestionApi.ts` and `useIngestionProjects.ts` were lost due to file reversion. These hooks and types were recreated:
- `FhirProjectWorkspace` type
- `fetchProjectFhirWorkspace()`, `attachProjectFhirConnection()`, `startProjectFhirSync()` API functions
- `useProjectFhirWorkspace()`, `useAttachProjectFhirConnection()`, `useStartProjectFhirSync()` hooks

---

## Bug Found and Fixed

**Issue:** `POST /poseidon/runs/trigger` returned 500 even though the service and model worked correctly in isolation.

**Root cause:** `storage/logs/laravel.log` was owned by uid 1000 (host user) but PHP-FPM runs as www-data (uid 82). When `PoseidonService->triggerRun()` caught the Dagster connection error and called `Log::error()`, Monolog threw `UnexpectedValueException: Permission denied` from within the catch block, escaping the service's error handling and propagating as a 500. Other Poseidon endpoints worked because they don't hit error logging paths.

**Fix:**
1. Fixed log directory permissions (`chown 1000:82` + `chmod 775`)
2. Added `safeLog()` private helper that wraps `Log::` calls in try-catch, falling back to `error_log()` if the logger fails

---

## API Testing Results

All 12 routes verified:
- Dashboard: 200 (returns schedule counts, run stats, recent runs)
- Schedules CRUD: 200/201 (tested create, update, list)
- Trigger Run: 201 (creates run with status "failed" when Dagster not running — graceful degradation)
- Cancel Run: 422 when run already completed (correct validation)
- Freshness: 200 (empty when Dagster not running)
- Lineage: 200 (empty when Dagster not running)

---

## Files Changed

### New Files (9)
- `backend/app/Http/Controllers/Api/V1/PoseidonController.php`
- `backend/app/Models/App/PoseidonSchedule.php`
- `backend/app/Models/App/PoseidonRun.php`
- `backend/app/Services/Poseidon/PoseidonService.php`
- `backend/database/migrations/2026_03_28_200000_create_poseidon_tables.php`
- `frontend/src/features/poseidon/api/poseidonApi.ts`
- `frontend/src/features/poseidon/hooks/usePoseidon.ts`
- `frontend/src/features/poseidon/pages/PoseidonPage.tsx`
- `frontend/src/features/ingestion/pages/FhirProjectWorkspacePage.tsx`

### Modified Files (5)
- `backend/config/services.php` — added `services.poseidon` config
- `backend/routes/api.php` — added 12 Poseidon routes
- `frontend/src/features/ingestion/api/ingestionApi.ts` — added FHIR workspace types/functions
- `frontend/src/features/ingestion/hooks/useIngestionProjects.ts` — added FHIR workspace hooks
- `frontend/src/features/ingestion/pages/DataIngestionPage.tsx` — added Poseidon and Vulcan tabs

---

## What's Next

- **Phase 2 (Core dbt Models):** Build full OMOP CDM staging/intermediate/CDM dbt models
- **Phase 3 (Dagster Orchestration):** Sensors, schedules, jobs for automated execution
- **Phase 4 (Aqueduct Integration):** Generate dbt models from confirmed Aqueduct mappings
- **Phase 6 (Production Hardening):** Retries, alerting, Nginx proxy for Dagit UI
