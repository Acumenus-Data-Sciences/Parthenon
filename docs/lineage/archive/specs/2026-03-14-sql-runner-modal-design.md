# SQL Runner with Live Progress Modal — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Overview

Add a "Run SQL" button to the SqlBlock toolbar that launches a modal with live pg_stat_activity feedback, a data preview table, and CSV download. Uses synchronous execution on the `cdm` database connection with a 120s statement timeout.

## Backend

### New Endpoints (TextToSqlController)

#### `POST /api/v1/text-to-sql/execute`

- **Auth:** `auth:sanctum` (all users for safe queries, `super-admin` for unsafe/unknown)
- **Request:** `{ sql: string }`
- **Security:**
  - Regex validation: only `SELECT` and `WITH` statements allowed
  - Rejects DDL/DML: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`
  - If query safety is not "safe", requires `super-admin` role via Spatie
- **Execution:**
  - Generates unique execution ID (UUID)
  - Captures backend PID via `SELECT pg_backend_pid()` on `cdm` connection
  - Stores PID in Redis cache keyed by execution ID (TTL: 5 min)
  - Sets `statement_timeout = '120s'` on the connection
  - Runs query via `DB::connection('cdm')->select()`
  - Caps results at 10,000 rows
  - Caches results in Redis (TTL: 5 min) for CSV download
- **Response:** `{ execution_id, columns: string[], rows: any[][], row_count, elapsed_ms, truncated: boolean }`
- **Errors:** Returns 422 for unsafe SQL, 403 for permission denied, 504 for timeout

#### `GET /api/v1/text-to-sql/execute/{executionId}/status`

- **Auth:** `auth:sanctum`
- **Behavior:** Looks up cached PID, queries `pg_stat_activity`
- **Response:** `{ state, wait_event, elapsed_ms, active: boolean }`
- **If PID gone:** `{ active: false, state: "completed" }`

#### `GET /api/v1/text-to-sql/execute/{executionId}/download`

- **Auth:** `auth:sanctum`
- **Behavior:** Retrieves cached results, streams as CSV
- **Response:** `StreamedResponse` with `Content-Disposition: attachment; filename="query-results-{id}.csv"`
- **If expired:** Returns 404

### Database Connection

- Always uses `cdm` connection
- `statement_timeout` set per-session before query execution
- Read-only by design (CDM data)

## Frontend

### SqlBlock Enhancement

- Add "Run SQL" button (Play icon) next to existing "Copy" button in the toolbar row
- Button uses teal color scheme to differentiate from Copy
- Clicking opens `SqlRunnerModal`

### SqlRunnerModal Component

**Props:** `open`, `onClose`, `sql`

**Layout:**
- Modal size: `xl` (wide enough for data table)
- Non-dismissable while query is running (close button disabled)

**States:**

1. **Running** — Spinner animation, state label from pg_stat_activity (e.g., "active", "idle in transaction", "waiting on LWLock"), elapsed time ticker (updates every 1s)
2. **Completed** — Teal success badge, row count, elapsed time, data preview table, Download CSV button
3. **Error** — Red error banner with PostgreSQL error message, Close button enabled

**Data Preview Table:**
- Scrollable container (max-height ~400px)
- Column headers from result columns
- Shows first 100 rows with monospace font
- Badge: "Showing 100 of N rows" (or "Showing all N rows" if ≤100)
- If truncated at 10K: warning badge "Results capped at 10,000 rows"

**Footer:**
- "Download CSV" button (enabled after completion, disabled during running)
- "Close" button (disabled during running)

### API Functions (api.ts)

```typescript
executeSql(sql: string): Promise<ExecuteResponse>
getExecutionStatus(executionId: string): Promise<ExecutionStatus>
downloadExecutionCsv(executionId: string): void  // triggers browser download
```

### Data Flow

1. User clicks "Run SQL" → Modal opens → `POST /execute` fires
2. Modal starts polling `GET /status/{id}` every 1 second
3. Status updates render (state label, elapsed time)
4. `/execute` returns → polling stops → results render in table
5. "Download CSV" → `GET /download/{id}` streams file
6. Results expire after 5 minutes in Redis

## Security

- Read-only enforcement via regex (SELECT/WITH only)
- `statement_timeout = 120s` prevents runaway queries
- Row cap at 10,000 prevents memory exhaustion
- Non-safe queries gated behind `super-admin` role
- All endpoints behind `auth:sanctum`
- Execution ID is UUID — not guessable

## Files to Create/Modify

**Backend:**
- `backend/app/Http/Controllers/Api/V1/TextToSqlController.php` — Add 3 methods
- `backend/routes/api.php` — Add 3 routes

**Frontend:**
- `frontend/src/features/text-to-sql/components/SqlBlock.tsx` — Add Run button
- `frontend/src/features/text-to-sql/components/SqlRunnerModal.tsx` — New modal component
- `frontend/src/features/text-to-sql/api.ts` — Add 3 API functions + types
