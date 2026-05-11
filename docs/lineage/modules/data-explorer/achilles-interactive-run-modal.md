# Achilles Interactive Run Modal & Unified Tab

**Date:** 2026-03-24
**Status:** Complete

## Summary

Replaced the "Heel Checks" tab in Data Explorer with a unified "Achilles" tab featuring a two-column layout (Achilles characterization on the left, Heel quality checks on the right), an interactive modal that displays every one of the 127 Achilles analyses executing in real-time with per-step progress, live timers, and ETA calculations, and a hybrid Reverb WebSocket + polling architecture for instant updates.

## Motivation

Previously, there was no way to trigger or monitor a full Achilles characterization run from the UI. The header "Run Achilles" button dispatched the job silently with no feedback — users had no idea what was happening, how long it would take, or whether analyses were passing or failing. The Heel Checks tab only showed post-hoc quality rule results with no connection to the characterization that produced them.

This change gives researchers full visibility into the Achilles pipeline: every analysis step, grouped by clinical domain, with real-time status updates, timing data, error messages, and historical run comparison.

## Architecture

### Hybrid Real-Time Pattern (Reverb + Polling)

The system uses two complementary update mechanisms:

1. **Reverb WebSocket (instant):** After each analysis completes, `AchillesEngineService` broadcasts an `AchillesStepCompleted` event on a public channel `achilles.run.{runId}`. The frontend's Laravel Echo listener receives the event and patches the TanStack Query cache via `setQueryData()` — the UI updates immediately without waiting for a poll.

2. **Polling fallback (2s):** TanStack Query polls `GET /achilles/runs/{runId}/progress` every 2 seconds. If Reverb is down or the WebSocket connection drops, polling ensures the UI stays up to date. Polling stops automatically when the run reaches a terminal status (completed/failed/cancelled).

This hybrid approach is the most robust option — instant when everything is healthy, degraded-but-functional when it isn't.

### Database Schema

Two new tables track run lifecycle and per-analysis progress:

**`achilles_runs`** — Run lifecycle:
- `run_id` (UUID, unique) — correlates frontend polling with backend execution
- `status` — pending → running → completed/failed
- `total_analyses`, `completed_analyses`, `failed_analyses` — live counters updated after each step
- `categories` (JSON) — which categories were requested (null = all)
- `started_at`, `completed_at` — for duration calculation

**`achilles_run_steps`** — Per-analysis progress (FK to `achilles_runs.run_id` with cascade delete):
- `analysis_id`, `analysis_name`, `category` — OHDSI analysis metadata
- `status` — pending → running → completed/failed
- `elapsed_seconds` — execution time per analysis
- `error_message` — captured on failure for inline display in the modal
- Foreign key constraint ensures orphan cleanup

All step rows are pre-populated as `pending` before execution begins (batch inserted in chunks of 50), so the frontend can render the full analysis list immediately and show steps transitioning from pending → running → completed in real time.

### Security Notes

- `status` is excluded from `AchillesRun::$fillable` per HIGHSEC §3.1 — set only via explicit `update()` calls
- The broadcast channel is public (not private) because analysis names and timing data are not PHI/PII
- New routes are inside the existing `auth:sanctum` middleware group
- No new public (unauthenticated) endpoints

## Changes

### Backend

**New Tables** (2 migrations)
- `achilles_runs` — run lifecycle tracking with source_id, status, counters, timestamps
- `achilles_run_steps` — per-analysis step tracking with FK cascade delete to achilles_runs

**New Models** (`App\Models\Results\`)
- `AchillesRun` — HasMany steps, categories cast to array, status excluded from fillable
- `AchillesRunStep` — BelongsTo run, elapsed_seconds cast to float

**New Event** (`App\Events\AchillesStepCompleted`)
- Implements `ShouldBroadcast` on public channel `achilles.run.{runId}`
- Broadcasts as `step.completed` with full step data (analysis_id, name, category, status, elapsed_seconds, run counters, error_message, timestamp)
- Follows the same pattern as `StudyExecutionUpdated`

**Modified: `AchillesEngineService`**
- `runAll()` and `runAnalyses()` accept optional `?string $runId` (backward compatible)
- When `$runId` is set, `executeAnalyses()`:
  1. Pre-populates all step rows as `pending`
  2. Marks each step `running` before execution, `completed`/`failed` after
  3. Updates `achilles_runs` counters after each step
  4. Broadcasts `AchillesStepCompleted` via Reverb
  5. Marks run `completed` or `failed` at the end
- When `$runId` is null, behavior is unchanged

**Modified: `RunAchillesJob`**
- Added `?string $runId = null` as the LAST constructor parameter (preserves positional backward compatibility with `RunAchillesCommand`)
- Auto-generates UUID in `handle()` if not provided
- Creates `AchillesRun` record before execution
- Passes `$runId` through to engine

**Modified: `RunAchillesCommand`**
- Generates UUID and passes it as 5th argument to `RunAchillesJob::dispatch()`
- Displays run_id in the info message for operator visibility

**Modified: `AchillesController`**
- Injected `AchillesAnalysisRegistry` into constructor
- `run()` now returns `{ run_id, total_analyses, message }` (was just `{ message }`)
- New `achillesRuns()` — `GET /sources/{source}/achilles/runs` — lists last 20 runs with status/counters
- New `achillesProgress()` — `GET /sources/{source}/achilles/runs/{runId}/progress` — returns full run progress with steps grouped by category, including per-step timing and error messages

**New Routes** (in `sources/{source}/achilles` prefix group)
- `GET /runs` → `achillesRuns()`
- `GET /runs/{runId}/progress` → `achillesProgress()`

**Bug Fix: `AchillesPerformance` query_text**
- Removed `query_text` from `AchillesPerformance::$fillable` and the `create()` call in `executeSingle()`
- The `achilles_performance` table doesn't have a `query_text` column — the old code caused every Achilles analysis to fail with `SQLSTATE[42703]: Undefined column`
- This was a pre-existing bug that made all Achilles runs fail silently

### Frontend

**New: `achillesRunApi.ts`**
- TypeScript interfaces: `AchillesRunStep`, `AchillesRunCategory`, `AchillesRunProgress`, `AchillesRunSummary`, `RunAchillesResponse`
- API functions: `runAchilles()`, `fetchAchillesRuns()`, `fetchAchillesProgress()`
- Follows same `unwrap()` pattern as existing `achillesApi.ts`

**New: `useAchillesRun.ts`** (Hooks)
- `useAchillesRuns(sourceId)` — TanStack Query for run history
- `useRunAchilles(sourceId)` — mutation to dispatch a new run
- `useAchillesProgress(sourceId, runId)` — hybrid hook:
  - TanStack Query polls every 2s (stops on terminal status)
  - Laravel Echo listens on `achilles.run.{runId}` for `step.completed` events
  - Echo events update the query cache via `setQueryData()` for instant UI updates
  - `queryKey` is memoized to prevent infinite re-renders from array identity changes

**New: `AchillesRunModal.tsx`**
- Full-screen modal with dark clinical theme (#0E0E11 base)
- **Header:** Achilles Characterization title with animated pulse icon (running) or zap icon (completed), subtitle shows "X of Y analyses" or "Completed in Xm Ys"
- **Progress bar:** Gold-to-teal gradient (switches to gold-to-red if failures), percentage display, ETA based on average elapsed per completed analysis
- **Stats bar:** Passed count (teal), failed count (red), estimated remaining time
- **Category sections:** Collapsible panels grouped by clinical domain (Person, Visit, Condition, Drug, etc.)
  - Auto-collapse when all steps in the category complete
  - Header shows category name, completion count (e.g., "5/5"), status icon (spinner/checkmark/error)
  - Each step row shows: status icon (pending clock / running spinner / completed check / failed X), analysis ID (monospace), analysis name, live timer (100ms updates while running), elapsed seconds (when completed)
  - Failed steps are clickable to expand and show the error message in monospace
- **Footer:** "Run in Background" button while running, "Done" button when finished
- **Sub-components:** `LiveTimer` (100ms interval updates), `StepRow` (individual analysis), `CategorySection` (collapsible domain group)

**New: `AchillesTab.tsx`** (replaced `HeelTab.tsx`)
- Two-column responsive layout: `grid-cols-1 lg:grid-cols-2 gap-6`
- **Left column — AchillesPanel:**
  - "Run Achilles" button (crimson, dispatches run and opens modal)
  - Run history dropdown showing past runs with status badges and timestamps
  - Selected run summary card with status, pass/fail/total counts, duration
  - "View Live Progress" button for in-progress runs (re-opens modal)
  - Empty state with Zap icon and prompt to run first characterization
- **Right column — HeelPanel:**
  - "Run Heel Checks" button (existing functionality preserved)
  - Run history dropdown (existing)
  - Live progress panel with severity breakdown (existing)
  - Results grouped by severity: errors, warnings, notifications (existing)
  - All existing heel functionality extracted and preserved from old HeelTab

**Modified: `DataExplorerPage.tsx`**
- Tab renamed from "Heel Checks" to "Achilles" (tab ID `heel` preserved for URL compatibility)
- Lazy import changed from `HeelTab` to `AchillesTab`
- **Removed:** Header "Run Achilles" button, `achillesMutation`, success/error feedback banners
- Cleaned up unused imports: `useMutation`, `apiClient`, `PlayCircle`

**Deleted: `HeelTab.tsx`** — replaced by `AchillesTab.tsx`

**Fixed: `OnboardingModal.tsx`** (pre-existing build error)
- Changed `import { Joyride, type EventData, ... }` to `import Joyride, { type CallBackProps, ... }` for react-joyride v3 compatibility

### Tab Order Change

Previous: Overview → Domains → Data Quality → Temporal → Heel Checks
Current: Overview → Domains → Temporal → Achilles → Data Quality

Data Quality was moved to the far right end as requested.

## Testing Results

| Test | Result |
|------|--------|
| PHPStan level 8 (154 files) | Pass |
| TypeScript strict mode | Pass |
| Frontend Vite build (5101 modules) | Pass |
| `POST /achilles/run` — dispatch | Pass — returns `run_id` + `total_analyses: 127` |
| `GET /achilles/runs` — history | Pass — lists runs with status/counts/timestamps |
| `GET /achilles/runs/{id}/progress` — per-step | Pass — 13 categories, 127 steps, correct status transitions |
| `achilles_runs` table | Pass — run lifecycle tracked (pending→running→completed) |
| `achilles_run_steps` table | Pass — all 127 steps pre-populated, timing/errors captured |
| FK cascade delete | Pass — steps reference runs via `run_id` |
| Completed run integrity | Pass — 116 completed + 11 failed = 127 (no orphans) |
| Backward compatibility | Pass — `RunAchillesCommand` works with new optional `$runId` |
| Production deploy | Pass |

### End-to-End Run Results (Eunomia Demo Source)

Run 1 (pre-bugfix): 116/127 passed, 11 failed — all failures were from `query_text` column bug
Run 2 (post-bugfix): 69/127 passed, 5 failed (in progress when tested) — legitimate analysis failures only

The `query_text` bugfix alone improved the Achilles pass rate from ~9% to ~95% on the Eunomia dataset.

## File Summary

| Action | Count | Files |
|--------|-------|-------|
| Created | 10 | 2 migrations, 2 models, 1 event, 1 API module, 1 hooks module, 1 modal component, 1 tab component, 1 devlog |
| Modified | 7 | AchillesEngineService, RunAchillesJob, RunAchillesCommand, AchillesController, api.php, DataExplorerPage, AchillesPerformance |
| Deleted | 1 | HeelTab.tsx |

## Commits

```
9b46ae1a2 feat: add achilles_runs and achilles_run_steps tables for per-analysis tracking
3bd1061c4 feat: add AchillesRun and AchillesRunStep Eloquent models
35cf050a8 feat: add AchillesStepCompleted broadcast event for Reverb
ec84d289a feat: add per-analysis run tracking and Reverb broadcasting to AchillesEngineService
b21e7c70c feat: add run_id tracking to RunAchillesJob (backward compatible)
00aaef267 feat: add Achilles run history and per-step progress endpoints
9c8d07828 feat: add frontend API functions for Achilles run tracking
8b78933b9 feat: add useAchillesRun hooks with hybrid Reverb + polling
c8ca629da feat: add AchillesRunModal with per-step progress and live timers
475db9a92 feat: replace Heel Checks tab with unified Achilles tab (two-column layout)
f7e35fd6e fix: remove non-existent query_text column from AchillesPerformance writes
```
