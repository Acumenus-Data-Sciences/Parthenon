# DQD & Heel Live Progress + Jobs Integration

**Date:** 2026-03-19
**Status:** Complete

## Summary

Added real-time 1-second polling progress panels for both DQD (Data Quality Dashboard) and Achilles Heel runs on the Data Explorer page, and integrated both job types into the Jobs page with running/completed state detection.

## Changes

### Backend

**DQD Progress Endpoint** (`DataQualityController::progress`)
- New `GET /sources/{source}/dqd/runs/{runId}/progress` — lightweight polling endpoint
- Returns: completed/total checks, pass/fail counts, per-category breakdown (completeness/conformance/plausibility), latest completed check
- Uses `DB::table()` instead of Eloquent to avoid boolean cast on `passed` column corrupting SUM aggregates

**Heel Async Execution** (`RunHeelJob`, `AchillesHeelService`)
- Converted Heel from synchronous HTTP execution to async queued job on `achilles` queue
- New `RunHeelJob` dispatched from `AchillesController::runHeel()`
- Added `run_id` UUID column to `achilles_heel_results` via migration for run tracking
- `AchillesHeelService::run()` now accepts optional `$runId` parameter
- `getResults()` returns latest run by default, or specific run by ID

**Heel Progress Endpoint** (`AchillesController::heelProgress`)
- New `GET /sources/{source}/achilles/heel/runs/{runId}/progress`
- Returns: rules completed/total, results by severity, latest rule

**Heel Runs List** (`AchillesController::heelRuns`)
- New `GET /sources/{source}/achilles/heel/runs`

**Jobs Page Integration** (`JobController`)
- `getDqdJobs()` now detects running state (completed checks < total expected) and shows progress %
- New `getHeelJobs()` collector with same running/completed state detection
- Uses `DB::table()` with explicit casts to avoid Eloquent model cast interference

**Bug Fixes**
- Fixed `AchillesHeelService` passing `Source` object instead of params array to `SqlRendererService::render()`
- Fixed `source_id` references — was using nonexistent `$source->source_id`, now uses `$source->id`
- Fixed `dqdApi.ts` — all API functions now correctly unwrap `{ data: ... }` envelope from backend responses
- Fixed `DqdRun` type to match actual API response fields (`started_at`/`completed_at` vs `created_at`)

### Frontend

**DQD Tab** (`DqdTab.tsx`)
- Live `ProgressPanel` component with overall progress bar (gradient gold-to-teal), per-category bars, pass/fail counts
- 1-second polling via TanStack Query `refetchInterval` — auto-stops on completion
- Auto-detects in-progress runs on page load (probes latest run's progress)
- Transitions to full scorecard/results view on completion
- Run history selector for viewing past runs

**Heel Tab** (`HeelTab.tsx`)
- Matching `HeelProgressPanel` with overall bar, per-severity breakdown (errors/warnings/notifications), latest rule indicator
- Same 1-second polling and auto-detection pattern as DQD
- Run history selector

**Jobs Page** (`JobsPage.tsx`)
- Added "Data Quality" and "Heel Checks" type filter chips
- `heel` added to `JobType` union
- AlertTriangle icon for Heel jobs, ShieldCheck for DQD (already existed)
- LiveTimer component for running job elapsed time display
- Progress bars in duration column for running jobs

### API & Hooks

- `dqdApi.ts`: Added `fetchDqdProgress()`, `DqdProgress` type
- `achillesApi.ts`: Added `fetchHeelProgress()`, `fetchHeelRuns()`, `HeelProgress`, `HeelRun` types; updated `runHeel()` return type for async dispatch
- `useAchillesData.ts`: Added `useDqdProgress()`, `useHeelProgress()`, `useHeelRuns()` hooks with 1s polling

## Architecture Notes

- DQD has 170 checks across 3 categories; Heel has 15 rules across 3 severities
- Both run on the `achilles` Horizon queue
- Progress is inferred from result counts (no separate job state table) — a run with fewer results than the total expected is "running"
- Heel rules query Achilles characterization results (pre-computed aggregates), not raw CDM data
