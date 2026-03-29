# Project Vulcan Handoff

**Date:** 2026-03-28  
**Prepared by:** Codex  
**Scope:** FHIR ingestion unification in Data Ingestion, project-aware FHIR workspace, anonymous/public FHIR server compatibility, live validation against HAPI and Firely servers

## Executive Summary

Project Vulcan has completed the first meaningful vertical slice.

Parthenon's Data Ingestion area now has a **project-aware FHIR workspace** backed by the repo's existing first-party bulk-sync pipeline instead of treating the older bundle/NDJSON uploader as the primary product path.

The implementation also now supports **two authentication modes** for FHIR connections:

- `smart_backend_services`
- `none` for anonymous/public demo servers

This was added because live testing against:

- `https://hapi.fhir.org/baseR4`
- `https://server.fire.ly`

showed that both servers support anonymous reads and accepted anonymous `Patient/$export` requests, while the original code hard-required SMART token exchange.

The main remaining blocker is **not permissions**. It is local test environment state:

- the configured PostgreSQL test database `parthenon_testing` does not exist on `pgsql.acumenus.net`
- the local PHP environment also lacks the SQLite PDO driver, so the simple SQLite fallback cannot be used

Another agent with permission to create or configure the test database should be able to finish validation and then iterate on product polish.

---

## What Was Achieved

## 1. Canonical architecture decision captured

A repo-local implementation plan was added:

- [2026-03-28-fhir-ingestion-implementation-plan.md](/home/smudoshi/Github/Parthenon/docs/devlog/plans/2026-03-28-fhir-ingestion-implementation-plan.md)

Core decision:

- keep the existing first-party Laravel FHIR bulk-sync engine
- connect it to `ingestion_projects`
- make Data Ingestion project-aware for FHIR
- preserve the older uploader only as a sandbox utility

## 2. Backend project linkage for FHIR

FHIR is now linked to `ingestion_projects`.

### Added migrations

- [2026_03_28_140000_add_fhir_to_ingestion_projects.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_03_28_140000_add_fhir_to_ingestion_projects.php)
- [2026_03_28_150000_add_auth_mode_to_fhir_connections.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_03_28_150000_add_auth_mode_to_fhir_connections.php)

### New database fields

#### `ingestion_projects`

- `fhir_connection_id`
- `fhir_sync_mode`
- `fhir_config`
- `last_fhir_sync_run_id`
- `last_fhir_sync_at`
- `last_fhir_sync_status`

#### `fhir_sync_runs`

- `ingestion_project_id`

#### `fhir_connections`

- `auth_mode` with default `smart_backend_services`

## 3. Shared FHIR sync dispatcher introduced

New service:

- [FhirSyncDispatcherService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirSyncDispatcherService.php)

Purpose:

- centralize sync startup
- avoid duplicating logic between admin connection sync and project-scoped sync
- preserve existing `RunFhirSyncJob`
- support project-linked sync runs

## 4. Existing FHIR job pipeline reused, not replaced

The existing first-party pipeline remains the engine:

- [RunFhirSyncJob.php](/home/smudoshi/Github/Parthenon/backend/app/Jobs/Fhir/RunFhirSyncJob.php)
- [FhirBulkExportService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirBulkExportService.php)
- [FhirAuthService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirAuthService.php)
- [FhirNdjsonProcessorService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirNdjsonProcessorService.php)
- [FhirBulkMapper.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirBulkMapper.php)

### Important enhancement made

`RunFhirSyncJob` now also updates project-level state when a sync run is attached to an ingestion project:

- marks project `profiling` during in-flight export/processing
- marks project `ready` on successful completion
- marks project `failed` on failure
- records `last_fhir_sync_*` fields on the project

## 5. Project-scoped FHIR API endpoints added

Routes added under `ingestion-projects` in:

- [api.php](/home/smudoshi/Github/Parthenon/backend/routes/api.php)

Endpoints added:

- `GET /api/v1/ingestion-projects/{project}/fhir`
- `POST /api/v1/ingestion-projects/{project}/fhir/attach-connection`
- `POST /api/v1/ingestion-projects/{project}/fhir/sync`
- `GET /api/v1/ingestion-projects/{project}/fhir/sync-runs`
- `GET /api/v1/ingestion-projects/{project}/fhir/sync-runs/{run}`

Implemented in:

- [IngestionProjectController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/IngestionProjectController.php)

Admin connection sync now also uses the shared dispatcher in:

- [FhirConnectionController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php)

## 6. New project-aware FHIR workspace in the frontend

The Data Ingestion FHIR tab no longer defaults to the old standalone FHIR upload page.

### New page

- [FhirProjectWorkspacePage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/pages/FhirProjectWorkspacePage.tsx)

### The Data Ingestion page now mounts it

- [DataIngestionPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/pages/DataIngestionPage.tsx)

### New functionality exposed

- select a current ingestion project
- view attached FHIR connection
- attach an approved FHIR connection to a project
- trigger incremental sync
- trigger full sync
- view recent project-linked sync runs
- view last sync status and counts

## 7. Legacy uploader preserved as a sandbox

The older bundle/NDJSON upload flow was not deleted.

It is now embedded inside the new project workspace as a collapsible section labeled:

- `Legacy Bundle/NDJSON Sandbox`

This uses the existing component:

- [FhirIngestionPanel.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/etl/components/FhirIngestionPanel.tsx)

This satisfies the original requirement to **keep what exists** while still making the enterprise connection-backed path primary.

## 8. Frontend ingestion APIs and hooks extended

Updated:

- [ingestionApi.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/api/ingestionApi.ts)
- [useIngestionProjects.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/hooks/useIngestionProjects.ts)

Added:

- project FHIR workspace fetch
- attach connection mutation
- start sync mutation
- project FHIR state typing

## 9. Anonymous/public FHIR server support added

This is a key late-stage enhancement from live testing.

### Why this was needed

The original code assumed:

- SMART Backend Services always required
- token endpoint always required
- client ID always required
- private key effectively required for real usage
- all export/poll/download calls always send `Authorization: Bearer ...`

That works for enterprise SMART sites, but it does not work for:

- HAPI public R4 demo server
- Firely public server
- other public or locally anonymous FHIR servers

### What changed

#### Backend

- `FhirConnection.auth_mode` added
- `FhirConnection::usesSmartBackendServices()` helper added
- `FhirAuthService::getAccessToken()` returns empty token state for `auth_mode = none`
- `FhirBulkExportService` conditionally omits the `Authorization` header
- `FhirConnectionController` now:
  - validates conditionally by `auth_mode`
  - supports connection testing without SMART token exchange
  - skips private-key requirement for anonymous mode
- `FhirSyncDispatcherService` only requires private key in SMART mode

#### Frontend admin UI

Updated:

- [adminApi.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/administration/api/adminApi.ts)
- [FhirConnectionsPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/administration/pages/FhirConnectionsPage.tsx)

The admin FHIR connection form now supports:

- `SMART Backend Services`
- `None (anonymous/public server)`

When anonymous mode is selected:

- token endpoint is not needed
- client ID is not needed
- private key is not needed

---

## Live Endpoint Validation Performed

## 1. HAPI

Target:

- `https://hapi.fhir.org/baseR4`

### What was verified

- `/metadata` returns R4 `CapabilityStatement`
- capability statement advertises Bulk Data support
- anonymous `Patient` search works
- anonymous `Patient/$export` accepted with `202 Accepted`
- service-level export startup through **our own** `FhirBulkExportService` works when `auth_mode = none`

### Observed behavior

- `.well-known/smart-configuration` was not supported on this server
- polling endpoint returned `202 Accepted` with `Retry-After: 120`

### Service-level proof

This command succeeded and returned a real poll URL:

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan tinker --execute='$conn = new App\Models\App\FhirConnection([
  "site_name"=>"HAPI Demo",
  "site_key"=>"hapi-demo",
  "ehr_vendor"=>"other",
  "auth_mode"=>"none",
  "fhir_base_url"=>"https://hapi.fhir.org/baseR4",
  "token_endpoint"=>"",
  "client_id"=>"",
  "scopes"=>"system/*.read",
  "is_active"=>true,
  "incremental_enabled"=>true
]); $run = new App\Models\App\FhirSyncRun(); $url = app(App\Services\Fhir\FhirBulkExportService::class)->startExport($conn, $run, true); echo $url;'
```

## 2. Firely

Target:

- `https://server.fire.ly`

### What was verified

- `/metadata` returns R4 `CapabilityStatement`
- capability statement advertises Bulk Data support
- anonymous `Patient` search works
- anonymous `Patient/$export` accepted with `202 Accepted`
- service-level export startup through **our own** `FhirBulkExportService` works when `auth_mode = none`

### Observed behavior

- `.well-known/smart-configuration` returned an `OperationOutcome` indicating unsupported
- polling endpoint returned `202 Accepted` with `Retry-After: 120`

### Service-level proof

This command succeeded and returned a real poll URL:

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan tinker --execute='$conn = new App\Models\App\FhirConnection([
  "site_name"=>"Firely Demo",
  "site_key"=>"firely-demo",
  "ehr_vendor"=>"other",
  "auth_mode"=>"none",
  "fhir_base_url"=>"https://server.fire.ly",
  "token_endpoint"=>"",
  "client_id"=>"",
  "scopes"=>"system/*.read",
  "is_active"=>true,
  "incremental_enabled"=>true
]); $run = new App\Models\App\FhirSyncRun(); $service = app(App\Services\Fhir\FhirBulkExportService::class); $url = $service->startExport($conn, $run, true); echo $url;'
```

---

## Files Touched

### Backend

- [FhirConnectionController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php)
- [IngestionProjectController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/IngestionProjectController.php)
- [RunFhirSyncJob.php](/home/smudoshi/Github/Parthenon/backend/app/Jobs/Fhir/RunFhirSyncJob.php)
- [FhirConnection.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/FhirConnection.php)
- [FhirSyncRun.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/FhirSyncRun.php)
- [IngestionProject.php](/home/smudoshi/Github/Parthenon/backend/app/Models/App/IngestionProject.php)
- [FhirAuthService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirAuthService.php)
- [FhirBulkExportService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirBulkExportService.php)
- [FhirSyncDispatcherService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/Fhir/FhirSyncDispatcherService.php)
- [2026_03_28_140000_add_fhir_to_ingestion_projects.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_03_28_140000_add_fhir_to_ingestion_projects.php)
- [2026_03_28_150000_add_auth_mode_to_fhir_connections.php](/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_03_28_150000_add_auth_mode_to_fhir_connections.php)
- [api.php](/home/smudoshi/Github/Parthenon/backend/routes/api.php)
- [FhirIngestionProjectApiTest.php](/home/smudoshi/Github/Parthenon/backend/tests/Feature/FhirIngestionProjectApiTest.php)

### Frontend

- [adminApi.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/administration/api/adminApi.ts)
- [FhirConnectionsPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/administration/pages/FhirConnectionsPage.tsx)
- [ingestionApi.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/api/ingestionApi.ts)
- [useIngestionProjects.ts](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/hooks/useIngestionProjects.ts)
- [DataIngestionPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/pages/DataIngestionPage.tsx)
- [FhirProjectWorkspacePage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/ingestion/pages/FhirProjectWorkspacePage.tsx)

### Docs

- [2026-03-28-fhir-ingestion-implementation-plan.md](/home/smudoshi/Github/Parthenon/docs/devlog/plans/2026-03-28-fhir-ingestion-implementation-plan.md)

---

## What Was Verified

## Backend syntax

Syntax-checked successfully:

- `backend/app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php`
- `backend/app/Http/Controllers/Api/V1/IngestionProjectController.php`
- `backend/app/Jobs/Fhir/RunFhirSyncJob.php`
- `backend/app/Models/App/FhirConnection.php`
- `backend/app/Models/App/FhirSyncRun.php`
- `backend/app/Models/App/IngestionProject.php`
- `backend/app/Services/Fhir/FhirAuthService.php`
- `backend/app/Services/Fhir/FhirBulkExportService.php`
- `backend/app/Services/Fhir/FhirSyncDispatcherService.php`
- both new migrations
- `backend/tests/Feature/FhirIngestionProjectApiTest.php`

## Frontend lint

Targeted ESLint checks passed for:

- `frontend/src/features/ingestion/pages/FhirProjectWorkspacePage.tsx`
- `frontend/src/features/ingestion/pages/DataIngestionPage.tsx`
- `frontend/src/features/ingestion/api/ingestionApi.ts`
- `frontend/src/features/ingestion/hooks/useIngestionProjects.ts`
- `frontend/src/features/administration/api/adminApi.ts`
- `frontend/src/features/administration/pages/FhirConnectionsPage.tsx`

## Live service behavior

Verified:

- HAPI anonymous search
- HAPI anonymous `$export`
- Firely anonymous search
- Firely anonymous `$export`
- service-level export initiation through our PHP code for both servers

---

## What Is Still Blocked

## 1. Backend feature tests are not runnable in the current environment

Command:

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan test tests/Feature/FhirIngestionProjectApiTest.php
```

Current failure:

- PostgreSQL host is reachable
- but DB `parthenon_testing` does not exist

Observed error:

```text
SQLSTATE[08006] [7] connection to server at "pgsql.acumenus.net", port 5432 failed:
FATAL: database "parthenon_testing" does not exist
```

## 2. SQLite fallback is not usable in the current PHP runtime

Attempted fallback:

```bash
DB_CONNECTION=sqlite DB_DATABASE=':memory:' php artisan test tests/Feature/FhirIngestionProjectApiTest.php
```

Observed error:

```text
could not find driver (Connection: sqlite, SQL: PRAGMA foreign_keys = ON;)
```

Meaning:

- `pdo_sqlite` is not installed in this PHP environment

## 3. Full frontend build still has unrelated repo errors

`npm run build` in `frontend/` fails, but the failures are outside the Vulcan files.

Examples encountered:

- `LiveKitConfigPanel.tsx`
- `SemanticSearchPanel.tsx`
- `TierBreakdownChart.tsx`
- other pre-existing TS errors

This does **not** appear to be caused by Project Vulcan changes.

---

## What Another Agent Should Do Next

## Priority 1: Unblock backend test execution

The next agent should fix the test environment first.

### Option A: create the missing Postgres test DB

If the configured Postgres user has permission:

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan about | head
psql postgresql://smudoshi:acumenus@pgsql.acumenus.net/postgres -c "CREATE DATABASE parthenon_testing;"
php artisan migrate --env=testing
php artisan test tests/Feature/FhirIngestionProjectApiTest.php
```

If the URL/credentials differ, inspect:

- `.env`
- `.env.testing`
- `config/database.php`

### Option B: enable SQLite for tests

If the team prefers SQLite for feature tests, install/enable `pdo_sqlite` for the local PHP runtime and rerun:

```bash
cd /home/smudoshi/Github/Parthenon/backend
DB_CONNECTION=sqlite DB_DATABASE=':memory:' php artisan test tests/Feature/FhirIngestionProjectApiTest.php
```

## Priority 2: Run migrations locally

The new migrations must be applied before testing the UI or API:

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan migrate
```

## Priority 3: Validate the UI end-to-end

### Manual test plan

1. Start backend and frontend
2. Open Admin → FHIR Connections
3. Create a demo connection for HAPI:

```text
Site Name: HAPI Demo
Site Key: hapi-demo
Vendor: other
Auth Mode: none
FHIR Base URL: https://hapi.fhir.org/baseR4
Token Endpoint: blank
Client ID: blank
Group ID: blank
Active: true
Incremental sync: true
```

4. Test connection
5. Create a second demo connection for Firely:

```text
Site Name: Firely Demo
Site Key: firely-demo
Vendor: other
Auth Mode: none
FHIR Base URL: https://server.fire.ly
Token Endpoint: blank
Client ID: blank
Group ID: blank
Active: true
Incremental sync: true
```

6. Go to Data Ingestion
7. Create an ingestion project
8. Open FHIR tab
9. Attach one of the demo connections
10. Trigger a full sync
11. Verify:
   - run created
   - project status changes to `profiling`
   - run status advances beyond `pending`
   - connection-backed workspace updates
   - legacy sandbox remains accessible and usable

## Priority 4: Decide whether to keep anonymous mode permanently

This is currently useful and justified, but product/ops should decide:

- keep `auth_mode = none` as a supported first-class option
- or restrict it to demo/testing environments

If restricting it:

- enforce via environment flag or role gate
- hide anonymous mode in production admin UI

## Priority 5: Improve project workspace ergonomics

The first slice works, but it is still fairly utilitarian.

Recommended next frontend improvements:

- show run duration and finer-grained progress state
- add explicit links back to Admin FHIR Connections and Sync Monitor
- show resource types and file counts for the last run
- add project-level error summary cards
- add better empty state text when no connections exist

## Priority 6: Update public docs

Still needed:

- update site docs for FHIR ingestion to reflect the project-aware connection-backed workflow
- document `auth_mode`
- distinguish:
  - enterprise sync path
  - legacy sandbox uploader

Likely files:

- [17b-fhir-ingestion.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part5-ingestion/17b-fhir-ingestion.mdx)
- [17c-etl-tools.mdx](/home/smudoshi/Github/Parthenon/docs/site/docs/part5-ingestion/17c-etl-tools.mdx)

---

## Suggested Commands for the Next Agent

## Inspect config

```bash
cd /home/smudoshi/Github/Parthenon/backend
sed -n '1,220p' config/database.php
sed -n '1,220p' .env
sed -n '1,220p' .env.testing
```

## Run syntax/lint checks

```bash
cd /home/smudoshi/Github/Parthenon/backend
php -l app/Http/Controllers/Api/V1/Admin/FhirConnectionController.php
php -l app/Http/Controllers/Api/V1/IngestionProjectController.php
php -l app/Services/Fhir/FhirAuthService.php
php -l app/Services/Fhir/FhirBulkExportService.php
php -l app/Services/Fhir/FhirSyncDispatcherService.php
php -l app/Jobs/Fhir/RunFhirSyncJob.php
```

```bash
cd /home/smudoshi/Github/Parthenon/frontend
npx eslint src/features/administration/api/adminApi.ts
npx eslint src/features/administration/pages/FhirConnectionsPage.tsx
npx eslint src/features/ingestion/api/ingestionApi.ts
npx eslint src/features/ingestion/hooks/useIngestionProjects.ts
npx eslint src/features/ingestion/pages/DataIngestionPage.tsx
npx eslint src/features/ingestion/pages/FhirProjectWorkspacePage.tsx
```

## Re-run the focused backend test

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan test tests/Feature/FhirIngestionProjectApiTest.php
```

## Reproduce live export service checks

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan tinker --execute='$conn = new App\Models\App\FhirConnection([
  "site_name"=>"HAPI Demo",
  "site_key"=>"hapi-demo",
  "ehr_vendor"=>"other",
  "auth_mode"=>"none",
  "fhir_base_url"=>"https://hapi.fhir.org/baseR4",
  "token_endpoint"=>"",
  "client_id"=>"",
  "scopes"=>"system/*.read",
  "is_active"=>true,
  "incremental_enabled"=>true
]); $run = new App\Models\App\FhirSyncRun(); $url = app(App\Services\Fhir\FhirBulkExportService::class)->startExport($conn, $run, true); echo $url;'
```

```bash
cd /home/smudoshi/Github/Parthenon/backend
php artisan tinker --execute='$conn = new App\Models\App\FhirConnection([
  "site_name"=>"Firely Demo",
  "site_key"=>"firely-demo",
  "ehr_vendor"=>"other",
  "auth_mode"=>"none",
  "fhir_base_url"=>"https://server.fire.ly",
  "token_endpoint"=>"",
  "client_id"=>"",
  "scopes"=>"system/*.read",
  "is_active"=>true,
  "incremental_enabled"=>true
]); $run = new App\Models\App\FhirSyncRun(); $url = app(App\Services\Fhir\FhirBulkExportService::class)->startExport($conn, $run, true); echo $url;'
```

---

## Important Cautions

- The git worktree is dirty beyond Vulcan-related files. Do not revert unrelated user changes.
- The new feature test file exists but is not yet validated against a real test DB because the DB is missing.
- The anonymous auth mode was introduced intentionally after live endpoint testing. Do not remove it without replacing the test/demo story.
- The legacy uploader is intentionally still present, but only as a sandbox in the new workspace. Do not accidentally restore it as the default FHIR tab surface.

---

## Recommended Handoff Summary for the Next Agent

If you need a short operational summary:

1. Migrate the DB.
2. Fix the backend test environment by creating `parthenon_testing` or enabling SQLite PDO.
3. Run `tests/Feature/FhirIngestionProjectApiTest.php`.
4. Manually create HAPI and Firely anonymous connections in Admin.
5. Run end-to-end project sync tests from the Data Ingestion FHIR tab.
6. If green, continue with UI polish and docs updates.

This should be enough context for the next agent to finish Project Vulcan without rediscovering architecture decisions or repeating the endpoint research.
